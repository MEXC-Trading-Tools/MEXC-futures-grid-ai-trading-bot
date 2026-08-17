import { describe, expect, it } from "vitest";
import {
  buildGridLevelsWithPrice,
  estimateGridProfitPerCycle,
  resolveGridAction,
  resolveRebalanceAction,
} from "../src/strategies/grid/grid-config.js";

const LAST = 64_316;

describe("grid-config", () => {
  it("resolves long grid actions", () => {
    expect(resolveGridAction(58_500, LAST, "long")).toBe("open_long");
    expect(resolveGridAction(70_800, LAST, "long")).toBe("close_long");
  });

  it("resolves short grid actions", () => {
    expect(resolveGridAction(70_800, LAST, "short")).toBe("open_short");
    expect(resolveGridAction(58_500, LAST, "short")).toBe("close_short");
  });

  it("builds geometric levels around a live last with opens below and closes above", () => {
    const levels = buildGridLevelsWithPrice(
      {
        mode: "geometric",
        lowerPrice: 58_500,
        upperPrice: 70_800,
        levels: 8,
        orderSize: 100,
        gridDirection: "long",
      },
      LAST,
    );

    expect(levels.length).toBeGreaterThan(0);
    expect(levels.some((l) => l.action === "open_long")).toBe(true);
    expect(levels.some((l) => l.action === "close_long")).toBe(true);
    expect(levels.filter((l) => l.price < LAST).every((l) => l.action === "open_long")).toBe(
      true,
    );
    expect(levels.filter((l) => l.price > LAST).every((l) => l.action === "close_long")).toBe(
      true,
    );

    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!.price).toBeGreaterThan(levels[i - 1]!.price);
    }
  });

  it("estimates gross cycle profit using contractSize", () => {
    const levels = buildGridLevelsWithPrice(
      {
        mode: "geometric",
        lowerPrice: 58_500,
        upperPrice: 70_800,
        levels: 8,
        orderSize: 100,
        gridDirection: "long",
      },
      LAST,
    );
    const openIdx = levels.findIndex((l) => l.action === "open_long");
    expect(openIdx).toBeGreaterThanOrEqual(0);
    const gross = estimateGridProfitPerCycle(levels, openIdx, 100, 0.0001);
    expect(gross).toBeGreaterThan(0);
  });

  it("rebalances open long to close long", () => {
    expect(resolveRebalanceAction("open_long", "long")).toBe("close_long");
    expect(resolveRebalanceAction("close_long", "long")).toBe("open_long");
    expect(resolveRebalanceAction("close_long", "neutral")).toBe("open_short");
  });
});
