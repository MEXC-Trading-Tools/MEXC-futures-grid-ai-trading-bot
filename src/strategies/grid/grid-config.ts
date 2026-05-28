import type { GridDirection, GridMode } from "../../config/index.js";
import { add, divide, multiply, round } from "../../utils/decimal.js";
import type { GridOrderAction } from "../../api/mexc/types.js";

export interface GridStrategyConfig {
  mode: GridMode;
  lowerPrice: number;
  upperPrice: number;
  levels: number;
  orderSize: number;
  gridDirection: GridDirection;
}

export interface GridLevel {
  index: number;
  price: number;
  action: GridOrderAction;
}

export function resolveGridAction(
  price: number,
  lastPrice: number,
  direction: GridDirection,
): GridOrderAction | null {
  if (direction === "long") {
    if (price < lastPrice) return "open_long";
    if (price > lastPrice) return "close_long";
    return null;
  }

  if (direction === "short") {
    if (price > lastPrice) return "open_short";
    if (price < lastPrice) return "close_short";
    return null;
  }

  // neutral: alternate open/close on both sides
  if (price < lastPrice) return "open_long";
  if (price > lastPrice) return "open_short";
  return null;
}

export function resolveRebalanceAction(
  filledAction: GridOrderAction,
  direction: GridDirection,
): GridOrderAction | null {
  switch (filledAction) {
    case "open_long":
      return "close_long";
    case "close_long":
      return direction === "neutral" ? "open_short" : "open_long";
    case "open_short":
      return "close_short";
    case "close_short":
      return direction === "neutral" ? "open_long" : "open_short";
  }
}

export function buildGridLevels(config: GridStrategyConfig): GridLevel[] {
  const { mode, lowerPrice, upperPrice, levels, gridDirection } = config;

  if (levels < 2) {
    throw new Error("Grid requires at least 2 levels");
  }

  const midPrice = (lowerPrice + upperPrice) / 2;
  const prices: number[] = [];

  if (mode === "arithmetic") {
    const step = divide(upperPrice - lowerPrice, levels - 1);
    for (let i = 0; i < levels; i++) {
      prices.push(round(add(lowerPrice, multiply(step, i))));
    }
  } else {
    const ratio = Math.pow(upperPrice / lowerPrice, 1 / (levels - 1));
    for (let i = 0; i < levels; i++) {
      prices.push(round(lowerPrice * Math.pow(ratio, i)));
    }
  }

  return prices.map((price, index) => ({
    index,
    price,
    action: resolveGridAction(price, midPrice, gridDirection) ?? "open_long",
  }));
}

export function buildGridLevelsWithPrice(
  config: GridStrategyConfig,
  lastPrice: number,
): GridLevel[] {
  const { mode, lowerPrice, upperPrice, levels, gridDirection } = config;

  if (levels < 2) {
    throw new Error("Grid requires at least 2 levels");
  }

  const prices: number[] = [];

  if (mode === "arithmetic") {
    const step = divide(upperPrice - lowerPrice, levels - 1);
    for (let i = 0; i < levels; i++) {
      prices.push(round(add(lowerPrice, multiply(step, i))));
    }
  } else {
    const ratio = Math.pow(upperPrice / lowerPrice, 1 / (levels - 1));
    for (let i = 0; i < levels; i++) {
      prices.push(round(lowerPrice * Math.pow(ratio, i)));
    }
  }

  return prices
    .map((price, index) => {
      const action = resolveGridAction(price, lastPrice, gridDirection);
      return action ? { index, price, action } : null;
    })
    .filter((level): level is GridLevel => level !== null);
}

export function findNearestLevelIndex(
  levels: GridLevel[],
  price: number,
): number {
  let nearest = 0;
  let minDiff = Math.abs(levels[0]!.price - price);

  for (let i = 1; i < levels.length; i++) {
    const diff = Math.abs(levels[i]!.price - price);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = i;
    }
  }

  return nearest;
}

export function getLevelAbove(levels: GridLevel[], index: number): GridLevel | null {
  return index < levels.length - 1 ? levels[index + 1]! : null;
}

export function getLevelBelow(levels: GridLevel[], index: number): GridLevel | null {
  return index > 0 ? levels[index - 1]! : null;
}

export function estimateGridProfitPerCycle(
  levels: GridLevel[],
  levelIndex: number,
  orderSize: number,
  contractSize: number,
): number {
  const level = levels[levelIndex];
  if (!level) return 0;

  const above = getLevelAbove(levels, levelIndex);
  const below = getLevelBelow(levels, levelIndex);

  if (level.action === "open_long" && above) {
    return multiply(above.price - level.price, orderSize * contractSize);
  }

  if (level.action === "open_short" && below) {
    return multiply(level.price - below.price, orderSize * contractSize);
  }

  return 0;
}

export function findLevelByIndex(
  levels: GridLevel[],
  index: number,
): GridLevel | undefined {
  return levels.find((l) => l.index === index);
}

export function findAdjacentLevelForRebalance(
  levels: GridLevel[],
  filledLevel: GridLevel,
  filledAction: GridOrderAction,
  direction: GridDirection,
): GridLevel | null {
  const targetAction = resolveRebalanceAction(filledAction, direction);
  if (!targetAction) return null;

  const candidates =
    filledAction === "open_long" || filledAction === "close_short"
      ? levels.filter((l) => l.price > filledLevel.price)
      : levels.filter((l) => l.price < filledLevel.price);

  const sorted =
    filledAction === "open_long" || filledAction === "close_short"
      ? candidates.sort((a, b) => a.price - b.price)
      : candidates.sort((a, b) => b.price - a.price);

  return sorted.find((l) => l.action === targetAction) ?? sorted[0] ?? null;
}
