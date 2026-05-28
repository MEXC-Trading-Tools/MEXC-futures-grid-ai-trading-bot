#!/usr/bin/env node
import { MexcFuturesClient } from "./api/mexc/client.js";
import { MarketAnalyzer } from "./ai/market-analyzer.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./services/logger.js";
import { MarketDataService } from "./services/market-data.js";
import {
  buildGridLevelsWithPrice,
  estimateGridProfitPerCycle,
} from "./strategies/grid/grid-config.js";
import { FuturesGridEngine } from "./strategies/grid/grid-engine.js";

const HELP = `
MEXC Futures Grid AI Trading Bot — CLI

Usage:
  npm run cli -- <command> [options]

Commands:
  start [--dry-run]     Start the futures grid bot
  simulate              Preview grid levels and AI analysis
  analyze               Run AI market regime analysis
  status                Show live ticker and contract info
  ping                  Test MEXC Futures API connectivity
  help                  Show this message

Examples:
  npm run cli -- simulate
  npm run cli -- analyze
  npm run cli -- start --dry-run
  npm run dev
`;

async function cmdSimulate(): Promise<void> {
  process.env.MEXC_API_KEY = process.env.MEXC_API_KEY || "preview";
  process.env.MEXC_SECRET_KEY = process.env.MEXC_SECRET_KEY || "preview";

  const config = loadConfig({ dryRun: true });
  const client = new MexcFuturesClient({
    apiKey: "public",
    secretKey: "public",
    baseUrl: config.mexc.baseUrl,
  });

  let lastPrice =
    (config.trading.lowerPrice + config.trading.upperPrice) / 2;
  let contractSize = 0.0001;

  try {
    const [ticker, detail] = await Promise.all([
      client.getTicker(config.trading.symbol),
      client.getContractDetail(config.trading.symbol),
    ]);
    lastPrice = ticker.lastPrice;
    contractSize = detail.contractSize;
    console.log(`Current price: ${lastPrice}`);
    console.log(`Funding rate:  ${(ticker.fundingRate * 100).toFixed(4)}%`);
    console.log(`Contract size: ${contractSize}\n`);
  } catch {
    console.log(`(Could not fetch live data; using midpoint ${lastPrice})\n`);
  }

  const levels = buildGridLevelsWithPrice(
    {
      mode: config.trading.gridMode,
      lowerPrice: config.trading.lowerPrice,
      upperPrice: config.trading.upperPrice,
      levels: config.trading.levels,
      orderSize: config.trading.orderSize,
      gridDirection: config.trading.gridDirection,
    },
    lastPrice,
  );

  console.log("\n=== MEXC Futures Grid Strategy Preview ===\n");
  console.log(`Symbol:      ${config.trading.symbol}`);
  console.log(`Mode:        ${config.trading.gridMode}`);
  console.log(`Direction:   ${config.trading.gridDirection}`);
  console.log(`Leverage:    ${config.trading.leverage}x`);
  console.log(`Range:       ${config.trading.lowerPrice} — ${config.trading.upperPrice}`);
  console.log(`Levels:      ${config.trading.levels}`);
  console.log(`Order size:  ${config.trading.orderSize} contracts`);
  console.log(`AI enabled:  ${config.ai.enabled}`);
  console.log("\nGrid levels:\n");

  for (const level of levels) {
    const profit = estimateGridProfitPerCycle(
      levels,
      level.index,
      config.trading.orderSize,
      contractSize,
    );
    const profitHint = profit > 0 ? `  (~${profit.toFixed(4)} USDT/cycle)` : "";
    console.log(
      `  [${String(level.index).padStart(2)}] ${level.price.toFixed(1).padStart(12)}  →  ${level.action.padEnd(12)}${profitHint}`,
    );
  }

  console.log("\n✓ Simulation complete. Use 'start --dry-run' to test order flow.\n");
}

async function cmdAnalyze(): Promise<void> {
  process.env.MEXC_API_KEY = process.env.MEXC_API_KEY || "preview";
  process.env.MEXC_SECRET_KEY = process.env.MEXC_SECRET_KEY || "preview";

  const config = loadConfig({ dryRun: true });
  const logger = createLogger("fatal");
  const client = new MexcFuturesClient({
    apiKey: "public",
    secretKey: "public",
    baseUrl: config.mexc.baseUrl,
  });

  const marketData = new MarketDataService(client);
  const snapshot = await marketData.getSnapshot(config.trading.symbol);

  const analyzer = new MarketAnalyzer(
    {
      optimizer: {
        baseLowerPrice: config.trading.lowerPrice,
        baseUpperPrice: config.trading.upperPrice,
        baseLevels: config.trading.levels,
        baseOrderSize: config.trading.orderSize,
        baseLeverage: config.trading.leverage,
        baseDirection: config.trading.gridDirection,
        maxLeverage: 125,
        minLevels: 4,
        maxLevels: 200,
      },
    },
    logger,
  );

  const analysis = analyzer.analyze(snapshot);

  console.log("\n=== AI Market Analysis ===\n");
  console.log(`Symbol:         ${snapshot.symbol}`);
  console.log(`Last price:     ${snapshot.lastPrice}`);
  console.log(`Regime:         ${analysis.regime.regime}`);
  console.log(`Confidence:     ${(analysis.regime.confidence * 100).toFixed(1)}%`);
  console.log(`Volatility:     ${analysis.regime.volatility.toFixed(2)}%`);
  console.log(`Trend strength: ${analysis.regime.trendStrength.toFixed(2)}%`);
  console.log(`RSI:            ${analysis.regime.rsi?.toFixed(1) ?? "N/A"}`);
  console.log(`Grid suitable:  ${analysis.regime.suitableForGrid ? "Yes" : "No"}`);
  console.log(`Reason:         ${analysis.regime.reason}`);

  if (analysis.optimization.adjustments.length > 0) {
    console.log("\nSuggested adjustments:");
    for (const adj of analysis.optimization.adjustments) {
      console.log(`  • ${adj}`);
    }
  } else {
    console.log("\nNo parameter adjustments suggested.");
  }

  console.log("\nOptimized parameters:");
  const p = analysis.optimization.parameters;
  console.log(`  Range:     ${p.lowerPrice} — ${p.upperPrice}`);
  console.log(`  Levels:    ${p.levels}`);
  console.log(`  Leverage:  ${p.leverage}x`);
  console.log(`  Direction: ${p.gridDirection}`);
  console.log(`  Order sz:  ${p.orderSize}\n`);
}

async function cmdStatus(): Promise<void> {
  const config = loadConfig({ dryRun: true });
  const client = new MexcFuturesClient({
    apiKey: config.mexc.apiKey,
    secretKey: config.mexc.secretKey,
    baseUrl: config.mexc.baseUrl,
  });

  const [ticker, detail] = await Promise.all([
    client.getTicker(config.trading.symbol),
    client.getContractDetail(config.trading.symbol),
  ]);

  console.log("\n=== MEXC Futures Market Status ===\n");
  console.log(`Symbol:        ${ticker.symbol}`);
  console.log(`Last price:    ${ticker.lastPrice}`);
  console.log(`Fair price:    ${ticker.fairPrice}`);
  console.log(`24h high:      ${ticker.high24Price}`);
  console.log(`24h low:       ${ticker.lower24Price}`);
  console.log(`Funding rate:  ${(ticker.fundingRate * 100).toFixed(4)}%`);
  console.log(`Open interest: ${ticker.holdVol}`);
  console.log(`Min vol:       ${detail.minVol}`);
  console.log(`Max leverage:  ${detail.maxLeverage}x`);
}

async function cmdPing(): Promise<void> {
  const config = loadConfig({ dryRun: true });
  const client = new MexcFuturesClient({
    apiKey: "public",
    secretKey: "public",
    baseUrl: config.mexc.baseUrl,
  });

  const ok = await client.ping();
  const ticker = await client.getTicker(config.trading.symbol);

  console.log(
    `\n✓ MEXC Futures API reachable. ${config.trading.symbol} @ ${ticker.lastPrice}\n`,
  );

  if (!ok) {
    throw new Error("Ping failed");
  }
}

async function cmdStart(dryRun: boolean): Promise<void> {
  const config = loadConfig({ dryRun });
  const logger = createLogger(config.logLevel);

  const client = new MexcFuturesClient({
    apiKey: config.mexc.apiKey,
    secretKey: config.mexc.secretKey,
    baseUrl: config.mexc.baseUrl,
  });

  const engine = new FuturesGridEngine(client, config, logger);

  const shutdown = async () => {
    await engine.shutdown(!dryRun);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());

  await engine.initialize();
  await engine.deployInitialGrid();
  engine.startPolling();

  logger.info({ dryRun }, "Futures grid bot started");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";
  const dryRun = args.includes("--dry-run");

  switch (command) {
    case "simulate":
      await cmdSimulate();
      break;
    case "analyze":
      await cmdAnalyze();
      break;
    case "status":
      await cmdStatus();
      break;
    case "ping":
      await cmdPing();
      break;
    case "start":
      await cmdStart(dryRun);
      break;
    case "help":
    default:
      console.log(HELP);
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
