export interface MexcFuturesResponse<T> {
  success: boolean;
  code: number;
  data: T;
  message?: string;
}

export interface ContractTicker {
  symbol: string;
  lastPrice: number;
  bid1: number;
  ask1: number;
  volume24: number;
  amount24: number;
  holdVol: number;
  lower24Price: number;
  high24Price: number;
  riseFallRate: number;
  riseFallValue: number;
  indexPrice: number;
  fairPrice: number;
  fundingRate: number;
  timestamp: number;
}

export interface ContractDetail {
  symbol: string;
  displayName: string;
  contractSize: number;
  priceScale: number;
  volScale: number;
  priceUnit: number;
  volUnit: number;
  minVol: number;
  maxVol: number;
  minLeverage: number;
  maxLeverage: number;
  takerFeeRate: number;
  makerFeeRate: number;
}

export type FuturesOrderSide = 1 | 2 | 3 | 4;
export type FuturesOrderType = 1 | 2 | 3 | 4 | 5;
export type FuturesOpenType = 1 | 2;
export type FuturesOrderState = 1 | 2 | 3 | 4 | 5;

export interface FuturesOrder {
  orderId: string;
  symbol: string;
  positionId?: number;
  price: number;
  vol: number;
  leverage: number;
  side: FuturesOrderSide;
  category: number;
  orderType: FuturesOrderType;
  dealVol: number;
  dealAvgPrice: number;
  openType: FuturesOpenType;
  state: FuturesOrderState;
  externalOid?: string;
  profit?: number;
  createTime?: number;
  updateTime?: number;
}

export interface FuturesPosition {
  positionId: number;
  symbol: string;
  holdVol: number;
  holdAvgPrice: number;
  openType: FuturesOpenType;
  positionType: 1 | 2;
  leverage: number;
  unrealisedPnl: number;
  realisedPnl: number;
  liquidatePrice: number;
  margin: number;
}

export interface PlaceFuturesOrderRequest {
  symbol: string;
  price: number;
  vol: number;
  side: FuturesOrderSide;
  type?: FuturesOrderType;
  openType: FuturesOpenType;
  leverage?: number;
  externalOid?: string;
  positionMode?: 1 | 2;
  reduceOnly?: boolean;
}

export interface PlaceFuturesOrderResult {
  orderId: string;
  ts: number;
}

export interface OpenOrdersPage {
  pageSize: number;
  totalCount: number;
  totalPage: number;
  currentPage: number;
  resultList: FuturesOrder[];
}

export interface ContractPrecision {
  priceUnit: number;
  volUnit: number;
  minVol: number;
  maxVol: number;
  contractSize: number;
}

export type GridOrderAction = "open_long" | "close_long" | "open_short" | "close_short";

export const FUTURES_SIDE = {
  OPEN_LONG: 1 as const,
  CLOSE_SHORT: 2 as const,
  OPEN_SHORT: 3 as const,
  CLOSE_LONG: 4 as const,
};

export const FUTURES_ORDER_TYPE = {
  LIMIT: 1 as const,
  POST_ONLY: 2 as const,
  IOC: 3 as const,
  FOK: 4 as const,
  MARKET: 5 as const,
};

export const FUTURES_OPEN_TYPE = {
  ISOLATED: 1 as const,
  CROSS: 2 as const,
};

export const FUTURES_POSITION_MODE = {
  DUAL: 1 as const,
  ONE_WAY: 2 as const,
};

export function gridActionToSide(action: GridOrderAction): FuturesOrderSide {
  switch (action) {
    case "open_long":
      return FUTURES_SIDE.OPEN_LONG;
    case "close_long":
      return FUTURES_SIDE.CLOSE_LONG;
    case "open_short":
      return FUTURES_SIDE.OPEN_SHORT;
    case "close_short":
      return FUTURES_SIDE.CLOSE_SHORT;
  }
}

export function sideToGridAction(side: FuturesOrderSide): GridOrderAction {
  switch (side) {
    case 1:
      return "open_long";
    case 2:
      return "close_short";
    case 3:
      return "open_short";
    case 4:
      return "close_long";
  }
}

export function isOrderFilled(state: FuturesOrderState): boolean {
  return state === 3;
}

export function isOrderActive(state: FuturesOrderState): boolean {
  return state === 1 || state === 2;
}
