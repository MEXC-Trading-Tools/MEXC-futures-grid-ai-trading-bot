import type { MexcFuturesClient } from "../../api/mexc/client.js";
import { FUTURES_OPEN_TYPE } from "../../api/mexc/types.js";
import type { GridOrderAction } from "../../api/mexc/types.js";
import type { AppConfig } from "../../config/index.js";
import { MarketAnalyzer } from "../../ai/market-analyzer.js";
import type { Logger } from "../../services/logger.js";
import { MarketDataService } from "../../services/market-data.js";
import { RiskManager } from "../../services/risk-manager.js";
import { FuturesOrderManager } from "./futures-order-manager.js";
import {
  buildGridLevelsWithPrice,
  findAdjacentLevelForRebalance,
  findLevelByIndex,
  type GridLevel,
} from "./grid-config.js";
import { PositionTracker } from "./position-tracker.js";

export interface GridEngineStats {
  totalOpens: number;
  totalCloses: number;
  profitCycles: number;
  activeOrders: number;
  lastPrice: number;
  marginExposure: number;
  unrealisedPnl: number;
  aiAdjustments: number;
  currentRegime: string;
}

export class FuturesGridEngine {
  private levels: GridLevel[] = [];
  private readonly orderManager: FuturesOrderManager;
  private readonly riskManager: RiskManager;
  private readonly positionTracker: PositionTracker;
  private readonly marketData: MarketDataService;
  private readonly marketAnalyzer: MarketAnalyzer | null;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private aiTimer: ReturnType<typeof setInterval> | null = null;
  private contractSize = 0.0001;
  private aiAdjustments = 0;
  private currentRegime = "unknown";
  private stats: GridEngineStats = {
    totalOpens: 0,
    totalCloses: 0,
    profitCycles: 0,
    activeOrders: 0,
    lastPrice: 0,
    marginExposure: 0,
    unrealisedPnl: 0,
    aiAdjustments: 0,
    currentRegime: "unknown",
  };

  constructor(
    private readonly client: MexcFuturesClient,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {
    const { trading } = config;

    this.orderManager = new FuturesOrderManager(
      client,
      {
        symbol: trading.symbol,
        leverage: trading.leverage,
        openType:
          trading.marginMode === "isolated"
            ? FUTURES_OPEN_TYPE.ISOLATED
            : FUTURES_OPEN_TYPE.CROSS,
        dryRun: trading.dryRun,
      },
      logger,
    );

    this.riskManager = new RiskManager({
      maxMarginExposure: trading.maxMarginExposure,
      orderSize: trading.orderSize,
      leverage: trading.leverage,
      contractSize: this.contractSize,
      stopLossPrice: trading.stopLossPrice,
      takeProfitPrice: trading.takeProfitPrice,
      maxFundingRate: trading.maxFundingRate,
    });

    this.positionTracker = new PositionTracker();
    this.marketData = new MarketDataService(client);

    this.marketAnalyzer = config.ai.enabled
      ? new MarketAnalyzer(
          {
            optimizer: {
              baseLowerPrice: trading.lowerPrice,
              baseUpperPrice: trading.upperPrice,
              baseLevels: trading.levels,
              baseOrderSize: trading.orderSize,
              baseLeverage: trading.leverage,
              baseDirection: trading.gridDirection,
              maxLeverage: 125,
              minLevels: 4,
              maxLevels: 200,
            },
          },
          logger,
        )
      : null;
  }

  getLevels(): GridLevel[] {
    return [...this.levels];
  }

  getStats(): GridEngineStats {
    const pos = this.positionTracker.getState();
    return {
      ...this.stats,
      activeOrders: this.orderManager.getActiveOrders().length,
      marginExposure: this.riskManager.getMarginExposure(),
      unrealisedPnl: pos.unrealisedPnl,
      aiAdjustments: this.aiAdjustments,
      currentRegime: this.currentRegime,
    };
  }

  async initialize(): Promise<void> {
    const { trading } = this.config;

    try {
      const detail = await this.client.getContractDetail(trading.symbol);
      const precision = this.client.extractPrecision(detail);
      this.orderManager.setPrecision(precision);
      this.contractSize = precision.contractSize;
      this.riskManager.setContractSize(precision.contractSize);

      this.logger.info(
        {
          symbol: detail.symbol,
          contractSize: precision.contractSize,
          minVol: precision.minVol,
          maxVol: precision.maxVol,
          priceUnit: precision.priceUnit,
        },
        "Contract precision loaded",
      );

      if (!trading.dryRun) {
        await this.client.setLeverage(
          trading.symbol,
          trading.leverage,
          trading.marginMode === "isolated"
            ? FUTURES_OPEN_TYPE.ISOLATED
            : FUTURES_OPEN_TYPE.CROSS,
        );
        this.logger.info({ leverage: trading.leverage }, "Leverage configured");
      }
    } catch (err) {
      this.logger.warn({ err }, "Could not load contract detail");
    }

    const snapshot = await this.marketData.getSnapshot(trading.symbol);
    this.stats.lastPrice = snapshot.lastPrice;

    this.rebuildLevels(snapshot.lastPrice);

    const riskCheck = this.riskManager.validateGridConfig(this.levels);
    if (!riskCheck.allowed) {
      throw new Error(riskCheck.reason);
    }

    const fundingCheck = this.riskManager.checkFundingRate(snapshot.fundingRate);
    if (!fundingCheck.allowed) {
      throw new Error(fundingCheck.reason);
    }

    if (!trading.dryRun) {
      const positions = await this.client.getOpenPositions(trading.symbol);
      this.positionTracker.syncFromExchange(positions);
    }

    this.logger.info(
      {
        levels: this.levels.length,
        range: [this.levels[0]?.price, this.levels.at(-1)?.price],
        lastPrice: snapshot.lastPrice,
        fundingRate: snapshot.fundingRate,
        mode: trading.gridMode,
        direction: trading.gridDirection,
        leverage: trading.leverage,
        aiEnabled: this.config.ai.enabled,
        dryRun: trading.dryRun,
      },
      "Futures grid engine initialized",
    );
  }

  private rebuildLevels(lastPrice: number): void {
    const { trading } = this.config;
    this.levels = buildGridLevelsWithPrice(
      {
        mode: trading.gridMode,
        lowerPrice: trading.lowerPrice,
        upperPrice: trading.upperPrice,
        levels: trading.levels,
        orderSize: trading.orderSize,
        gridDirection: trading.gridDirection,
      },
      lastPrice,
    );
  }

  async deployInitialGrid(): Promise<void> {
    const snapshot = await this.marketData.getSnapshot(
      this.config.trading.symbol,
    );
    this.stats.lastPrice = snapshot.lastPrice;
    this.rebuildLevels(snapshot.lastPrice);

    for (const level of this.levels) {
      await this.placeOrderIfAllowed(level);
    }

    this.logger.info(
      {
        lastPrice: snapshot.lastPrice,
        activeOrders: this.orderManager.getActiveOrders().length,
      },
      "Initial futures grid deployed",
    );
  }

  private async placeOrderIfAllowed(level: GridLevel): Promise<void> {
    if (this.orderManager.findOrderByLevel(level.index, level.action)) {
      return;
    }

    const { orderSize } = this.config.trading;
    const isClose =
      level.action === "close_long" || level.action === "close_short";

    if (isClose) {
      const canClose =
        level.action === "close_long"
          ? this.positionTracker.canCloseLong(orderSize)
          : this.positionTracker.canCloseShort(orderSize);

      if (!canClose) {
        this.logger.debug(
          { levelIndex: level.index, action: level.action },
          "Skipping close order — no position",
        );
        return;
      }
    } else {
      const risk = this.riskManager.canPlaceOrder(level.price, orderSize);
      if (!risk.allowed) {
        this.logger.warn(
          { levelIndex: level.index, reason: risk.reason },
          "Order blocked by risk manager",
        );
        return;
      }
    }

    await this.orderManager.placeLimitOrder(
      level.index,
      level.action,
      level.price,
      orderSize,
      isClose,
    );

    if (isClose) {
      this.stats.totalCloses += 1;
    } else {
      this.stats.totalOpens += 1;
      this.riskManager.recordOpenPosition(level.price, orderSize);
    }
  }

  async onOrderFilled(
    levelIndex: number,
    action: GridOrderAction,
  ): Promise<void> {
    const { orderSize, gridDirection } = this.config.trading;
    const filledLevel = findLevelByIndex(this.levels, levelIndex);

    if (!filledLevel) return;

    this.positionTracker.recordFill(action, orderSize, filledLevel.price);

    const isClose = action === "close_long" || action === "close_short";

    if (isClose) {
      this.riskManager.recordClosePosition(filledLevel.price, orderSize);
    }

    const nextLevel = findAdjacentLevelForRebalance(
      this.levels,
      filledLevel,
      action,
      gridDirection,
    );

    if (nextLevel) {
      await this.placeOrderIfAllowed(nextLevel);
    }

    if (isClose) {
      this.stats.profitCycles += 1;
    }
  }

  async pollAndRebalance(): Promise<void> {
    const snapshot = await this.marketData.getSnapshot(
      this.config.trading.symbol,
    );
    this.stats.lastPrice = snapshot.lastPrice;

    const trigger = this.riskManager.checkPriceTriggers(snapshot.lastPrice);
    if (trigger) {
      this.logger.warn(
        { trigger, lastPrice: snapshot.lastPrice },
        "Price trigger hit — shutting down grid",
      );
      await this.shutdown(true);
      return;
    }

    const fundingCheck = this.riskManager.checkFundingRate(snapshot.fundingRate);
    if (!fundingCheck.allowed) {
      this.logger.warn(
        { fundingRate: snapshot.fundingRate },
        "Funding rate exceeded — pausing new orders",
      );
    }

    if (!this.config.trading.dryRun) {
      const positions = await this.client.getOpenPositions(
        this.config.trading.symbol,
      );
      this.positionTracker.syncFromExchange(positions);
    }

    const previousOrders = this.orderManager.getActiveOrders();
    await this.orderManager.syncWithExchange();
    const currentOrders = this.orderManager.getActiveOrders();

    const filled = previousOrders.filter(
      (prev) =>
        !currentOrders.some((c) => c.externalOid === prev.externalOid),
    );

    for (const order of filled) {
      if (order.state === "live" || order.state === "filled") {
        this.logger.info(
          {
            levelIndex: order.levelIndex,
            action: order.action,
            price: order.price,
          },
          "Order filled — rebalancing grid",
        );
        await this.onOrderFilled(order.levelIndex, order.action);
      }
    }

    this.stats.activeOrders = this.orderManager.getActiveOrders().length;
  }

  async runAiAnalysis(): Promise<void> {
    if (!this.marketAnalyzer) return;

    const snapshot = await this.marketData.getSnapshot(
      this.config.trading.symbol,
    );
    const analysis = this.marketAnalyzer.analyze(snapshot);

    this.currentRegime = analysis.regime.regime;
    this.stats.currentRegime = analysis.regime.regime;

    if (!analysis.regime.suitableForGrid) {
      this.logger.warn(
        { reason: analysis.regime.reason },
        "AI recommends pausing grid — unfavorable conditions",
      );
      return;
    }

    const { parameters, adjustments } = analysis.optimization;

    if (adjustments.length > 0) {
      this.aiAdjustments += adjustments.length;
      this.stats.aiAdjustments = this.aiAdjustments;

      this.logger.info(
        {
          regime: analysis.regime.regime,
          confidence: analysis.regime.confidence,
          adjustments,
          newRange: [parameters.lowerPrice, parameters.upperPrice],
          newLevels: parameters.levels,
          newLeverage: parameters.leverage,
        },
        "AI grid parameters updated",
      );

      this.config.trading.lowerPrice = parameters.lowerPrice;
      this.config.trading.upperPrice = parameters.upperPrice;
      this.config.trading.levels = parameters.levels;
      this.config.trading.orderSize = parameters.orderSize;
      this.config.trading.leverage = parameters.leverage;
      this.config.trading.gridDirection = parameters.gridDirection;

      this.rebuildLevels(snapshot.lastPrice);
    }
  }

  startPolling(): void {
    if (this.running) return;
    this.running = true;

    const interval = this.config.trading.pollIntervalMs;
    this.pollTimer = setInterval(() => {
      void this.pollAndRebalance().catch((err) => {
        this.logger.error({ err }, "Poll cycle failed");
      });
    }, interval);

    if (this.marketAnalyzer && this.config.ai.enabled) {
      const aiInterval = this.config.ai.rebalanceIntervalMs;
      this.aiTimer = setInterval(() => {
        void this.runAiAnalysis().catch((err) => {
          this.logger.error({ err }, "AI analysis failed");
        });
      }, aiInterval);

      void this.runAiAnalysis().catch((err) => {
        this.logger.error({ err }, "Initial AI analysis failed");
      });
    }

    this.logger.info(
      { pollMs: interval, aiMs: this.config.ai.rebalanceIntervalMs },
      "Grid polling started",
    );
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.aiTimer) {
      clearInterval(this.aiTimer);
      this.aiTimer = null;
    }
    this.logger.info("Futures grid engine stopped");
  }

  async shutdown(cancelOrders = true): Promise<void> {
    this.stop();

    if (cancelOrders && !this.config.trading.dryRun) {
      try {
        await this.client.cancelAllOrders(this.config.trading.symbol);
        this.logger.info("All open orders canceled");
      } catch (err) {
        this.logger.error({ err }, "Failed to cancel orders on shutdown");
      }
    }
  }
}
