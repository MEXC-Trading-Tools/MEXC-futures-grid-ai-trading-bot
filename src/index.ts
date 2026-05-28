import { MexcFuturesClient } from "./api/mexc/client.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./services/logger.js";
import { FuturesGridEngine } from "./strategies/grid/grid-engine.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info(
    {
      symbol: config.trading.symbol,
      mode: config.trading.gridMode,
      direction: config.trading.gridDirection,
      levels: config.trading.levels,
      leverage: config.trading.leverage,
      aiEnabled: config.ai.enabled,
      dryRun: config.trading.dryRun,
    },
    "Starting MEXC Futures Grid AI Trading Bot",
  );

  const client = new MexcFuturesClient({
    apiKey: config.mexc.apiKey,
    secretKey: config.mexc.secretKey,
    baseUrl: config.mexc.baseUrl,
  });

  const engine = new FuturesGridEngine(client, config, logger);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    await engine.shutdown(true);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await engine.initialize();
  await engine.deployInitialGrid();
  engine.startPolling();

  logger.info("Bot is running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
