import type { MexcFuturesClient } from "../../api/mexc/client.js";
import type {
  ContractPrecision,
  FuturesOpenType,
  GridOrderAction,
} from "../../api/mexc/types.js";
import { gridActionToSide } from "../../api/mexc/types.js";
import type { Logger } from "../../services/logger.js";
import { formatPrice, formatVolume } from "../../utils/decimal.js";

export interface FuturesGridOrder {
  levelIndex: number;
  action: GridOrderAction;
  price: number;
  vol: number;
  externalOid: string;
  orderId?: string;
  state: "pending" | "live" | "filled" | "canceled";
}

export interface FuturesOrderManagerConfig {
  symbol: string;
  leverage: number;
  openType: FuturesOpenType;
  dryRun: boolean;
}

let orderCounter = 0;

export function generateExternalOid(prefix: string): string {
  orderCounter += 1;
  return `${prefix}${Date.now()}${orderCounter}`.slice(0, 32);
}

export class FuturesOrderManager {
  private readonly activeOrders = new Map<string, FuturesGridOrder>();
  private precision: ContractPrecision | null = null;

  constructor(
    private readonly client: MexcFuturesClient,
    private readonly config: FuturesOrderManagerConfig,
    private readonly logger: Logger,
  ) {}

  setPrecision(precision: ContractPrecision): void {
    this.precision = precision;
  }

  getActiveOrders(): FuturesGridOrder[] {
    return Array.from(this.activeOrders.values());
  }

  findOrderByLevel(
    levelIndex: number,
    action: GridOrderAction,
  ): FuturesGridOrder | undefined {
    return Array.from(this.activeOrders.values()).find(
      (o) => o.levelIndex === levelIndex && o.action === action,
    );
  }

  async placeLimitOrder(
    levelIndex: number,
    action: GridOrderAction,
    price: number,
    vol: number,
    reduceOnly = false,
  ): Promise<FuturesGridOrder> {
    const externalOid = generateExternalOid("fgrid");
    const px = formatPrice(price, this.precision?.priceUnit);
    const volume = formatVolume(vol, this.precision?.volUnit ?? 1);

    const gridOrder: FuturesGridOrder = {
      levelIndex,
      action,
      price,
      vol: Number(volume),
      externalOid,
      state: "pending",
    };

    if (this.config.dryRun) {
      this.logger.info(
        { levelIndex, action, price: px, vol: volume, externalOid },
        "[DRY RUN] Would place futures limit order",
      );
      gridOrder.state = "live";
      gridOrder.orderId = String(Date.now());
      this.activeOrders.set(externalOid, gridOrder);
      return gridOrder;
    }

    const result = await this.client.placeOrder({
      symbol: this.config.symbol,
      price: Number(px),
      vol: Number(volume),
      side: gridActionToSide(action),
      type: 1,
      openType: this.config.openType,
      leverage: this.config.leverage,
      externalOid,
      positionMode: 2,
      reduceOnly,
    });

    gridOrder.orderId = result.orderId;
    gridOrder.state = "live";
    this.activeOrders.set(externalOid, gridOrder);

    this.logger.info(
      { orderId: result.orderId, levelIndex, action, price: px, vol: volume },
      "Futures limit order placed",
    );

    return gridOrder;
  }

  async cancelOrder(externalOid: string): Promise<void> {
    const order = this.activeOrders.get(externalOid);
    if (!order?.orderId) return;

    if (this.config.dryRun) {
      order.state = "canceled";
      this.activeOrders.delete(externalOid);
      return;
    }

    await this.client.cancelOrder(order.orderId);
    order.state = "canceled";
    this.activeOrders.delete(externalOid);
  }

  async syncWithExchange(): Promise<void> {
    if (this.config.dryRun) {
      return;
    }

    const exchangeOrders = await this.client.getOpenOrders(this.config.symbol);
    const exchangeOids = new Set(
      exchangeOrders.map((o) => o.externalOid).filter(Boolean),
    );

    for (const exOrder of exchangeOrders) {
      if (!exOrder.externalOid) continue;
      const local = this.activeOrders.get(exOrder.externalOid);
      if (local) {
        local.orderId = exOrder.orderId;
        local.state = exOrder.state === 3 ? "filled" : "live";
      }
    }

    for (const [oid, order] of this.activeOrders.entries()) {
      if (order.state === "live" && !exchangeOids.has(oid)) {
        order.state = "filled";
        this.activeOrders.delete(oid);
      }
    }
  }

  markFilled(externalOid: string): FuturesGridOrder | undefined {
    const order = this.activeOrders.get(externalOid);
    if (order) {
      order.state = "filled";
      this.activeOrders.delete(externalOid);
    }
    return order;
  }
}
