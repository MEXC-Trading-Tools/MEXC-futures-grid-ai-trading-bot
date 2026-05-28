import type { ContractTicker } from "../api/mexc/types.js";
import type { MexcFuturesClient } from "../api/mexc/client.js";

export interface MarketSnapshot {
  symbol: string;
  lastPrice: number;
  fairPrice: number;
  indexPrice: number;
  high24: number;
  low24: number;
  fundingRate: number;
  volume24: number;
  timestamp: number;
}

export class MarketDataService {
  constructor(private readonly client: MexcFuturesClient) {}

  async getSnapshot(symbol: string): Promise<MarketSnapshot> {
    const ticker = await this.client.getTicker(symbol);
    return this.toSnapshot(ticker);
  }

  toSnapshot(ticker: ContractTicker): MarketSnapshot {
    return {
      symbol: ticker.symbol,
      lastPrice: ticker.lastPrice,
      fairPrice: ticker.fairPrice,
      indexPrice: ticker.indexPrice,
      high24: ticker.high24Price,
      low24: ticker.lower24Price,
      fundingRate: ticker.fundingRate,
      volume24: ticker.volume24,
      timestamp: ticker.timestamp,
    };
  }
}
