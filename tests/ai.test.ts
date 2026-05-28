import { describe, expect, it } from "vitest";
import {
  calculateRSI,
  calculateSMA,
  calculateTrendStrength,
  calculateVolatility,
  suggestLeverage,
} from "../src/ai/indicators.js";
import { RegimeDetector } from "../src/ai/regime-detector.js";

describe("indicators", () => {
  const prices = [
    100, 101, 102, 101, 103, 104, 103, 105, 106, 105, 107, 108, 107, 109, 110,
    109, 111, 112, 111, 113,
  ];

  it("calculates SMA", () => {
    const sma = calculateSMA(prices, 5);
    expect(sma).not.toBeNull();
    expect(sma!).toBeGreaterThan(100);
    expect(sma!).toBeLessThan(120);
  });

  it("calculates RSI in valid range", () => {
    const rsi = calculateRSI(prices);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(0);
    expect(rsi!).toBeLessThanOrEqual(100);
  });

  it("calculates volatility", () => {
    expect(calculateVolatility(prices)).toBeGreaterThan(0);
  });

  it("suggests lower leverage for high volatility", () => {
    expect(suggestLeverage(6, 125)).toBeLessThanOrEqual(5);
    expect(suggestLeverage(0.5, 125)).toBeGreaterThan(10);
  });
});

describe("RegimeDetector", () => {
  it("detects range-bound market", () => {
    const detector = new RegimeDetector();
    const snapshot = {
      symbol: "BTC_USDT",
      lastPrice: 77_500,
      fairPrice: 77_500,
      indexPrice: 77_500,
      high24: 78_000,
      low24: 77_000,
      fundingRate: 0.0001,
      volume24: 1_000_000,
      timestamp: Date.now(),
    };

    const history = {
      prices: Array.from({ length: 30 }, (_, i) => 77_000 + (i % 5) * 100),
      highs: Array.from({ length: 30 }, () => 78_000),
      lows: Array.from({ length: 30 }, () => 77_000),
    };

    const result = detector.analyze(snapshot, history);
    expect(result.regime).toBeDefined();
    expect(result.suitableForGrid).toBe(true);
  });
});

describe("calculateTrendStrength", () => {
  it("returns positive for uptrend", () => {
    const uptrend = Array.from({ length: 30 }, (_, i) => 70_000 + i * 200);
    expect(calculateTrendStrength(uptrend)).toBeGreaterThan(0);
  });
});
