import type { MarketSnapshot } from "../services/market-data.js";
import type { Logger } from "../services/logger.js";
import { GridOptimizer, type OptimizerConfig } from "./grid-optimizer.js";
import { RegimeDetector, type PriceHistory, type RegimeAnalysis } from "./regime-detector.js";

export interface MarketAnalyzerConfig {
  optimizer: OptimizerConfig;
  maxHistoryLength?: number;
}

export interface AnalysisResult {
  snapshot: MarketSnapshot;
  regime: RegimeAnalysis;
  optimization: ReturnType<GridOptimizer["optimize"]>;
}

export class MarketAnalyzer {
  private readonly regimeDetector = new RegimeDetector();
  private readonly optimizer: GridOptimizer;
  private readonly maxHistory: number;
  private readonly history: PriceHistory = {
    prices: [],
    highs: [],
    lows: [],
  };

  constructor(
    config: MarketAnalyzerConfig,
    private readonly logger: Logger,
  ) {
    this.optimizer = new GridOptimizer(config.optimizer);
    this.maxHistory = config.maxHistoryLength ?? 100;
  }

  recordSnapshot(snapshot: MarketSnapshot): void {
    this.history.prices.push(snapshot.lastPrice);
    this.history.highs.push(snapshot.high24);
    this.history.lows.push(snapshot.low24);

    if (this.history.prices.length > this.maxHistory) {
      this.history.prices.shift();
      this.history.highs.shift();
      this.history.lows.shift();
    }
  }

  analyze(snapshot: MarketSnapshot): AnalysisResult {
    this.recordSnapshot(snapshot);

    const regime = this.regimeDetector.analyze(snapshot, this.history);
    const optimization = this.optimizer.optimize(snapshot, regime);

    this.logger.debug(
      {
        regime: regime.regime,
        confidence: regime.confidence,
        suitable: regime.suitableForGrid,
        adjustments: optimization.adjustments,
      },
      "AI market analysis complete",
    );

    return { snapshot, regime, optimization };
  }

  getHistoryLength(): number {
    return this.history.prices.length;
  }
}
