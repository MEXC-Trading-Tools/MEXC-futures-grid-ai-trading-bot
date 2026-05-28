import { describe, expect, it } from "vitest";
import {
  buildGridLevelsWithPrice,
  resolveGridAction,
  resolveRebalanceAction,
} from "../src/strategies/grid/grid-config.js";

describe("grid-config", () => {
  it("resolves long grid actions", () => {
    expect(resolveGridAction(74_000, 77_500, "long")).toBe("open_long");
    expect(resolveGridAction(80_000, 77_500, "long")).toBe("close_long");
  });

  it("resolves short grid actions", () => {
    expect(resolveGridAction(80_000, 77_500, "short")).toBe("open_short");
    expect(resolveGridAction(74_000, 77_500, "short")).toBe("close_short");
  });

  it("builds levels with current price", () => {
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

    expect(levels.length).toBeGreaterThan(0);
    expect(levels.some((l) => l.action === "open_long")).toBe(true);
  });

  it("rebalances open long to close long", () => {
    expect(resolveRebalanceAction("open_long", "long")).toBe("close_long");
    expect(resolveRebalanceAction("close_long", "long")).toBe("open_long");
  });
});
