import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/index.js";
import { createLogger } from "../src/services/logger.js";
import { FuturesGridEngine } from "../src/strategies/grid/grid-engine.js";
import { createMockFuturesClient } from "./mocks/mexc-futures-mock.js";

function buildTestConfig(dryRun = true): AppConfig {
  return {
    mexc: {
      apiKey: "test",
      secretKey: "test",
      baseUrl: "https://api.mexc.com",
    },
    trading: {
      symbol: "BTC_USDT",
      gridMode: "arithmetic",
      lowerPrice: 74_000,
      upperPrice: 81_000,
      levels: 8,
      orderSize: 10,
      leverage: 10,
      marginMode: "isolated",
      positionMode: "one-way",
      gridDirection: "long",
      maxMarginExposure: 500,
      pollIntervalMs: 60_000,
      dryRun,
    },
    ai: {
      enabled: true,
      rebalanceIntervalMs: 300_000,
    },
    logLevel: "fatal",
  };
}

describe("FuturesGridEngine", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.LOG_LEVEL = "fatal";
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("initializes and builds grid levels", async () => {
    const client = createMockFuturesClient({ lastPrice: 77_500 });
    const engine = new FuturesGridEngine(
      client,
      buildTestConfig(),
      createLogger("fatal"),
    );

    await engine.initialize();
    const levels = engine.getLevels();

    expect(levels.length).toBeGreaterThan(0);
    expect(levels[0]!.price).toBeLessThan(77_500);
  });

  it("deploys initial grid in dry run", async () => {
    const client = createMockFuturesClient({ lastPrice: 77_500 });
    const engine = new FuturesGridEngine(
      client,
      buildTestConfig(true),
      createLogger("fatal"),
    );

    await engine.initialize();
    await engine.deployInitialGrid();

    const stats = engine.getStats();
    expect(stats.activeOrders).toBeGreaterThan(0);
    expect(stats.totalOpens).toBeGreaterThan(0);
  });

  it("rebalances after simulated fill", async () => {
    const client = createMockFuturesClient({ lastPrice: 77_500 });
    const engine = new FuturesGridEngine(
      client,
      buildTestConfig(true),
      createLogger("fatal"),
    );

    await engine.initialize();
    await engine.deployInitialGrid();

    const levels = engine.getLevels();
    const openLevel = levels.find((l) => l.action === "open_long");
    expect(openLevel).toBeDefined();

    const before = engine.getStats().activeOrders;
    await engine.onOrderFilled(openLevel!.index, "open_long");
    const after = engine.getStats().activeOrders;

    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("stops polling cleanly", async () => {
    const client = createMockFuturesClient({ lastPrice: 77_500 });
    const engine = new FuturesGridEngine(
      client,
      buildTestConfig(true),
      createLogger("fatal"),
    );

    await engine.initialize();
    engine.startPolling();
    engine.stop();
    await engine.shutdown(false);

    expect(engine.getStats().activeOrders).toBeGreaterThanOrEqual(0);
  });
});
