import { divide, multiply, round } from "../utils/decimal.js";

export interface PricePoint {
  price: number;
  timestamp: number;
}

export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return round(divide(sum, period));
}

export function calculateEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i]! * k + ema * (1 - k);
  }

  return round(ema);
}

export function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i]! - prices[i - 1]!;
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs));
}

export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  if (highs.length < period + 1) return null;

  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i]! - lows[i]!,
      Math.abs(highs[i]! - closes[i - 1]!),
      Math.abs(lows[i]! - closes[i - 1]!),
    );
    trueRanges.push(tr);
  }

  const recent = trueRanges.slice(-period);
  return round(recent.reduce((a, b) => a + b, 0) / period);
}

export function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDevMultiplier = 2,
): { middle: number; upper: number; lower: number } | null {
  const sma = calculateSMA(prices, period);
  if (sma === null) return null;

  const slice = prices.slice(-period);
  const variance =
    slice.reduce((sum, p) => sum + (p - sma) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    middle: sma,
    upper: round(sma + stdDevMultiplier * stdDev),
    lower: round(sma - stdDevMultiplier * stdDev),
  };
}

export function calculateVolatility(prices: number[], period = 20): number {
  if (prices.length < 2) return 0;

  const slice = prices.slice(-period);
  const returns: number[] = [];

  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1]!;
    if (prev !== 0) {
      returns.push((slice[i]! - prev) / prev);
    }
  }

  if (returns.length === 0) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;

  return round(Math.sqrt(variance) * 100);
}

export function calculateTrendStrength(prices: number[]): number {
  if (prices.length < 10) return 0;

  const emaShort = calculateEMA(prices, 9);
  const emaLong = calculateEMA(prices, 21);

  if (emaShort === null || emaLong === null || emaLong === 0) return 0;

  return round(((emaShort - emaLong) / emaLong) * 100);
}

export function estimateGridSpacing(
  price: number,
  atr: number,
): { lower: number; upper: number } {
  const halfRange = multiply(atr, 1.5);
  return {
    lower: round(price - halfRange),
    upper: round(price + halfRange),
  };
}

export function suggestLeverage(
  volatility: number,
  maxLeverage: number,
): number {
  if (volatility > 5) return Math.min(5, maxLeverage);
  if (volatility > 3) return Math.min(10, maxLeverage);
  if (volatility > 1.5) return Math.min(20, maxLeverage);
  return Math.min(50, maxLeverage);
}

export function suggestOrderSizeMultiplier(rsi: number | null): number {
  if (rsi === null) return 1;
  if (rsi < 30) return 1.2;
  if (rsi > 70) return 0.8;
  return 1;
}
