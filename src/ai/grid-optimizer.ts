import type { GridDirection } from "../config/index.js";
import type { MarketSnapshot } from "../services/market-data.js";
import { clamp, round } from "../utils/decimal.js";
import {
  estimateGridSpacing,
  suggestLeverage,
  suggestOrderSizeMultiplier,
} from "./indicators.js";
import type { RegimeAnalysis } from "./regime-detector.js";

export interface GridParameters {
  lowerPrice: number;
  upperPrice: number;
  levels: number;
  orderSize: number;
  leverage: number;
  gridDirection: GridDirection;
}

export interface OptimizationResult {
  parameters: GridParameters;
  adjustments: string[];
  confidence: number;
}

export interface OptimizerConfig {
  baseLowerPrice: number;
  baseUpperPrice: number;
  baseLevels: number;
  baseOrderSize: number;
  baseLeverage: number;
  baseDirection: GridDirection;
  maxLeverage: number;
  minLevels: number;
  maxLevels: number;
}

export class GridOptimizer {
  constructor(private readonly config: OptimizerConfig) {}

  optimize(
    snapshot: MarketSnapshot,
    regime: RegimeAnalysis,
  ): OptimizationResult {
    const adjustments: string[] = [];
    let lowerPrice = this.config.baseLowerPrice;
    let upperPrice = this.config.baseUpperPrice;
    let levels = this.config.baseLevels;
    let orderSize = this.config.baseOrderSize;
    let leverage = this.config.baseLeverage;
    let gridDirection = this.config.baseDirection;

    if (regime.atr !== null && regime.atr > 0) {
      const spacing = estimateGridSpacing(
        snapshot.lastPrice,
        regime.atr,
      );

      const aiLower = Math.max(spacing.lower, this.config.baseLowerPrice * 0.9);
      const aiUpper = Math.min(spacing.upper, this.config.baseUpperPrice * 1.1);

      if (
        aiUpper - aiLower <
        this.config.baseUpperPrice - this.config.baseLowerPrice
      ) {
        lowerPrice = round(Math.max(aiLower, snapshot.lastPrice * 0.95));
        upperPrice = round(Math.min(aiUpper, snapshot.lastPrice * 1.05));
        adjustments.push(
          `AI adjusted range to ${lowerPrice}–${upperPrice} based on ATR`,
        );
      }
    }

    if (regime.volatility > 3) {
      levels = clamp(
        Math.floor(this.config.baseLevels * 0.7),
        this.config.minLevels,
        this.config.maxLevels,
      );
      adjustments.push(`Reduced levels to ${levels} for high volatility`);
    } else if (regime.volatility < 1 && regime.regime === "range_bound") {
      levels = clamp(
        Math.floor(this.config.baseLevels * 1.2),
        this.config.minLevels,
        this.config.maxLevels,
      );
      adjustments.push(`Increased levels to ${levels} for tight range`);
    }

    const suggestedLeverage = suggestLeverage(
      regime.volatility,
      this.config.maxLeverage,
    );
    if (suggestedLeverage < leverage) {
      leverage = suggestedLeverage;
      adjustments.push(`Reduced leverage to ${leverage}x for risk control`);
    }

    const sizeMultiplier = suggestOrderSizeMultiplier(regime.rsi);
    if (sizeMultiplier !== 1) {
      orderSize = round(orderSize * sizeMultiplier);
      adjustments.push(
        `Adjusted order size to ${orderSize} (RSI: ${regime.rsi?.toFixed(1) ?? "N/A"})`,
      );
    }

    if (regime.regime === "trending_up" && gridDirection !== "long") {
      gridDirection = "long";
      adjustments.push("Switched to long-biased grid for uptrend");
    } else if (regime.regime === "trending_down" && gridDirection !== "short") {
      gridDirection = "short";
      adjustments.push("Switched to short-biased grid for downtrend");
    } else if (regime.regime === "range_bound" && gridDirection !== "neutral") {
      gridDirection = "neutral";
      adjustments.push("Switched to neutral grid for range-bound market");
    }

    if (lowerPrice >= upperPrice) {
      lowerPrice = this.config.baseLowerPrice;
      upperPrice = this.config.baseUpperPrice;
      adjustments.push("Reverted to base range — AI bounds invalid");
    }

    return {
      parameters: {
        lowerPrice,
        upperPrice,
        levels,
        orderSize,
        leverage,
        gridDirection,
      },
      adjustments,
      confidence: regime.confidence,
    };
  }
}
