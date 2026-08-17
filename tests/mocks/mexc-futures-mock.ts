import type { MexcFuturesClient } from "../../src/api/mexc/client.js";
import type {
  ContractDetail,
  ContractTicker,
  FuturesOrder,
  FuturesPosition,
  PlaceFuturesOrderRequest,
  PlaceFuturesOrderResult,
} from "../../src/api/mexc/types.js";

export function createMockFuturesClient(overrides?: {
  lastPrice?: number;
  minVol?: number;
}): MexcFuturesClient {
  const lastPrice = overrides?.lastPrice ?? 64_316;
  const orders: FuturesOrder[] = [];

  const contractDetail: ContractDetail = {
    symbol: "BTC_USDT",
    displayName: "BTC_USDT PERPETUAL",
    contractSize: 0.0001,
    priceScale: 1,
    volScale: 0,
    priceUnit: 0.1,
    volUnit: 1,
    minVol: overrides?.minVol ?? 1,
    maxVol: 400_000,
    minLeverage: 1,
    maxLeverage: 500,
    takerFeeRate: 0.0002,
    makerFeeRate: 0,
  };

  const mock = {
    ping: async () => true,
    getTicker: async (symbol: string): Promise<ContractTicker> => ({
      symbol,
      lastPrice,
      bid1: lastPrice,
      ask1: lastPrice + 0.1,
      volume24: 1_000_000,
      amount24: 6_300_000_000,
      holdVol: 500_000,
      lower24Price: lastPrice * 0.98,
      high24Price: lastPrice * 1.02,
      riseFallRate: 0.01,
      riseFallValue: 100,
      indexPrice: lastPrice,
      fairPrice: lastPrice,
      fundingRate: 0.0001,
      timestamp: Date.now(),
    }),
    getContractDetail: async (): Promise<ContractDetail> => contractDetail,
    extractPrecision: () => ({
      priceUnit: 0.1,
      volUnit: 1,
      minVol: 1,
      maxVol: 400_000,
      contractSize: 0.0001,
    }),
    getOpenOrders: async (): Promise<FuturesOrder[]> => [...orders],
    placeOrder: async (
      req: PlaceFuturesOrderRequest,
    ): Promise<PlaceFuturesOrderResult> => {
      const orderId = String(Date.now());
      orders.push({
        orderId,
        symbol: req.symbol,
        price: req.price,
        vol: req.vol,
        leverage: req.leverage ?? 6,
        side: req.side,
        category: 1,
        orderType: 1,
        dealVol: 0,
        dealAvgPrice: 0,
        openType: req.openType,
        state: 2,
        externalOid: req.externalOid,
      });
      return { orderId, ts: Date.now() };
    },
    cancelOrder: async (): Promise<void> => {
      orders.length = 0;
    },
    cancelAllOrders: async (): Promise<void> => {
      orders.length = 0;
    },
    getOpenPositions: async (): Promise<FuturesPosition[]> => [],
    setLeverage: async (): Promise<void> => {},
  };

  return mock as unknown as MexcFuturesClient;
}
