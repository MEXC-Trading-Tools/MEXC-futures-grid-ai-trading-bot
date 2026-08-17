import { describe, expect, it } from "vitest";
import { RiskManager } from "../src/services/risk-manager.js";
import { buildGridLevelsWithPrice } from "../src/strategies/grid/grid-config.js";

describe("RiskManager", () => {
  it("blocks orders exceeding margin exposure", () => {
    const rm = new RiskManager({
      maxMarginExposure: 1,
      orderSize: 100,
      leverage: 6,
      contractSize: 0.0001,
    });

    const result = rm.canPlaceOrder(64_316, 100);
    expect(result.allowed).toBe(false);
  });

  it("allows orders within the shipped margin cap", () => {
    const rm = new RiskManager({
      maxMarginExposure: 2000,
      orderSize: 100,
      leverage: 6,
      contractSize: 0.0001,
    });

    const result = rm.canPlaceOrder(64_316, 100);
    expect(result.allowed).toBe(true);
  });

  it("triggers stop loss below the grid floor", () => {
    const rm = new RiskManager({
      orderSize: 100,
      leverage: 6,
      stopLossPrice: 56_800,
    });

    expect(rm.checkPriceTriggers(56_700)).toBe("stop_loss");
    expect(rm.checkPriceTriggers(58_500)).toBeNull();
  });

  it("triggers take profit above the grid ceiling", () => {
    const rm = new RiskManager({
      orderSize: 100,
      leverage: 6,
      takeProfitPrice: 72_800,
    });

    expect(rm.checkPriceTriggers(72_900)).toBe("take_profit");
    expect(rm.checkPriceTriggers(70_800)).toBeNull();
  });

  it("blocks when absolute funding exceeds the shipped cap", () => {
    const rm = new RiskManager({
      orderSize: 100,
      leverage: 6,
      maxFundingRate: 0.0008,
    });

    expect(rm.checkFundingRate(0.0003).allowed).toBe(true);
    expect(rm.checkFundingRate(0.0009).allowed).toBe(false);
    expect(rm.checkFundingRate(-0.001).allowed).toBe(false);
  });

  it("validates the shipped geometric grid", () => {
    const rm = new RiskManager({ orderSize: 100, leverage: 6 });
    const levels = buildGridLevelsWithPrice(
      {
        mode: "geometric",
        lowerPrice: 58_500,
        upperPrice: 70_800,
        levels: 8,
        orderSize: 100,
        gridDirection: "long",
      },
      64_316,
    );

    expect(rm.validateGridConfig(levels).allowed).toBe(true);
  });
});
