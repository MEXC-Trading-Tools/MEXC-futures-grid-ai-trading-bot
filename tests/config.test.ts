import { describe, expect, it } from "vitest";
import { normalizeSymbol, ConfigSchema } from "../src/config/index.js";

describe("config", () => {
  it("normalizes symbol formats", () => {
    expect(normalizeSymbol("BTC-USDT")).toBe("BTC_USDT");
    expect(normalizeSymbol("btc_usdt")).toBe("BTC_USDT");
    expect(normalizeSymbol("BTCUSDT")).toBe("BTC_USDT");
  });

  it("validates the shipped geometric desk", () => {
    const result = ConfigSchema.safeParse({
      mexc: {
        apiKey: "key",
        secretKey: "secret",
        baseUrl: "https://api.mexc.com",
      },
      trading: {
        symbol: "BTC_USDT",
        gridMode: "geometric",
        lowerPrice: 58500,
        upperPrice: 70800,
        levels: 8,
        orderSize: 100,
        leverage: 6,
        marginMode: "isolated",
        positionMode: "one-way",
        gridDirection: "long",
        maxMarginExposure: 2000,
        stopLossPrice: 56800,
        takeProfitPrice: 72800,
        maxFundingRate: 0.0008,
        pollIntervalMs: 5000,
        dryRun: false,
      },
      ai: {
        enabled: true,
        rebalanceIntervalMs: 300000,
      },
      logLevel: "info",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trading.gridMode).toBe("geometric");
      expect(result.data.trading.levels).toBe(8);
      expect(result.data.trading.leverage).toBe(6);
      expect(result.data.trading.orderSize).toBe(100);
      expect(result.data.trading.maxFundingRate).toBe(0.0008);
    }
  });
});
