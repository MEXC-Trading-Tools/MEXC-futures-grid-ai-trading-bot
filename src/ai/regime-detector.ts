import type { MarketSnapshot } from "../services/market-data.js";
import {
  calculateATR,
  calculateBollingerBands,
  calculateRSI,
  calculateTrendStrength,
  calculateVolatility,
} from "./indicators.js";

export type MarketRegime = "range_bound" | "trending_up" | "trending_down" | "high_volatility";

export interface RegimeAnalysis {
  regime: MarketRegime;
  confidence: number;
  trendStrength: number;
  volatility: number;
  rsi: number | null;
  atr: number | null;
  suitableForGrid: boolean;
  reason: string;
}

export interface PriceHistory {
  prices: number[];
  highs: number[];
  lows: number[];
}

export class RegimeDetector {
  analyze(
    snapshot: MarketSnapshot,
    history: PriceHistory,
  ): RegimeAnalysis {
    const { prices, highs, lows } = history;

    if (prices.length < 5) {
      return {
        regime: "range_bound",
        confidence: 0.3,
        trendStrength: 0,
        volatility: 0,
        rsi: null,
        atr: null,
        suitableForGrid: true,
        reason: "Insufficient history — defaulting to range-bound",
      };
    }

    const volatility = calculateVolatility(prices);
    const trendStrength = calculateTrendStrength(prices);
    const rsi = calculateRSI(prices);
    const atr = calculateATR(highs, lows, prices);
    const bollinger = calculateBollingerBands(prices);

    let regime: MarketRegime = "range_bound";
    let confidence = 0.5;
    let suitableForGrid = true;
    let reason = "Market appears range-bound — ideal for grid trading";

    if (volatility > 4) {
      regime = "high_volatility";
      confidence = Math.min(0.95, 0.5 + volatility / 20);
      suitableForGrid = volatility < 8;
      reason = suitableForGrid
        ? "High volatility — grid with wider spacing recommended"
        : "Extreme volatility — grid trading not recommended";
    } else if (trendStrength > 1.5) {
      regime = "trending_up";
      confidence = Math.min(0.9, 0.4 + Math.abs(trendStrength) / 10);
      suitableForGrid = Math.abs(trendStrength) < 3;
      reason = suitableForGrid
        ? "Mild uptrend — long-biased grid may perform well"
        : "Strong uptrend — grid may accumulate losing positions";
    } else if (trendStrength < -1.5) {
      regime = "trending_down";
      confidence = Math.min(0.9, 0.4 + Math.abs(trendStrength) / 10);
      suitableForGrid = Math.abs(trendStrength) < 3;
      reason = suitableForGrid
        ? "Mild downtrend — short-biased grid may perform well"
        : "Strong downtrend — grid may accumulate losing positions";
    } else if (bollinger) {
      const bandWidth =
        ((bollinger.upper - bollinger.lower) / bollinger.middle) * 100;
      if (bandWidth < 3) {
        regime = "range_bound";
        confidence = 0.85;
        reason = "Tight Bollinger bands — excellent grid conditions";
      }
    }

    if (
      Math.abs(snapshot.fundingRate) > 0.001 &&
      snapshot.fundingRate > 0 &&
      regime === "trending_up"
    ) {
      suitableForGrid = false;
      reason = "High positive funding rate in uptrend — long grid costly";
    }

    return {
      regime,
      confidence,
      trendStrength,
      volatility,
      rsi,
      atr,
      suitableForGrid,
      reason,
    };
  }
}
