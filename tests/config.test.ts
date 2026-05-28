import { describe, expect, it } from "vitest";
import { normalizeSymbol, ConfigSchema } from "../src/config/index.js";

describe("config", () => {
  it("normalizes symbol formats", () => {
    expect(normalizeSymbol("BTC-USDT")).toBe("BTC_USDT");
    expect(normalizeSymbol("btc_usdt")).toBe("BTC_USDT");
    expect(normalizeSymbol("BTCUSDT")).toBe("BTC_USDT");
  });

  it("validates config schema", () => {
    const result = ConfigSchema.safeParse({
      mexc: {
        apiKey: "key",
        secretKey: "secret",
        baseUrl: "https://api.mexc.com",
      },
      trading: {
        symbol: "BTC_USDT",
        gridMode: "arithmetic",
        lowerPrice: 74000,
        upperPrice: 81000,
        levels: 10,
        orderSize: 10,
        leverage: 10,
        marginMode: "isolated",
        positionMode: "one-way",
        gridDirection: "long",
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
  });
});
