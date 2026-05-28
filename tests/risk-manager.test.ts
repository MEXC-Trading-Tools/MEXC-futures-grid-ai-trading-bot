import { describe, expect, it } from "vitest";
import { RiskManager } from "../src/services/risk-manager.js";
import { buildGridLevelsWithPrice } from "../src/strategies/grid/grid-config.js";

describe("RiskManager", () => {
  it("blocks orders exceeding margin exposure", () => {
    const rm = new RiskManager({
      maxMarginExposure: 1,
      orderSize: 10,
      leverage: 10,
      contractSize: 0.0001,
    });

    const result = rm.canPlaceOrder(80_000, 10);
    expect(result.allowed).toBe(false);
  });

  it("allows orders within margin limits", () => {
    const rm = new RiskManager({
      maxMarginExposure: 10_000,
      orderSize: 10,
      leverage: 10,
      contractSize: 0.0001,
    });

    const result = rm.canPlaceOrder(80_000, 10);
    expect(result.allowed).toBe(true);
  });

  it("triggers stop loss", () => {
    const rm = new RiskManager({
      orderSize: 10,
      leverage: 10,
      stopLossPrice: 75_000,
    });

    expect(rm.checkPriceTriggers(74_000)).toBe("stop_loss");
    expect(rm.checkPriceTriggers(76_000)).toBeNull();
  });

  it("validates grid config", () => {
    const rm = new RiskManager({ orderSize: 10, leverage: 10 });
    const levels = buildGridLevelsWithPrice(
      {
        mode: "arithmetic",
        lowerPrice: 74_000,
        upperPrice: 81_000,
        levels: 8,
        orderSize: 10,
        gridDirection: "long",
      },
      77_500,
    );

    expect(rm.validateGridConfig(levels).allowed).toBe(true);
  });
});
