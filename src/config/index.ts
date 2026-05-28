import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const GridModeSchema = z.enum(["arithmetic", "geometric"]);
const MarginModeSchema = z.enum(["isolated", "cross"]);
const PositionModeSchema = z.enum(["one-way", "dual"]);
const GridDirectionSchema = z.enum(["long", "short", "neutral"]);

export const ConfigSchema = z.object({
  mexc: z.object({
    apiKey: z.string().min(1),
    secretKey: z.string().min(1),
    baseUrl: z.string().url(),
  }),
  trading: z.object({
    symbol: z.string().min(1),
    gridMode: GridModeSchema,
    lowerPrice: z.number().positive(),
    upperPrice: z.number().positive(),
    levels: z.number().int().min(2).max(200),
    orderSize: z.number().positive(),
    leverage: z.number().int().min(1).max(500),
    marginMode: MarginModeSchema,
    positionMode: PositionModeSchema,
    gridDirection: GridDirectionSchema,
    maxMarginExposure: z.number().positive().optional(),
    stopLossPrice: z.number().positive().optional(),
    takeProfitPrice: z.number().positive().optional(),
    maxFundingRate: z.number().positive().optional(),
    pollIntervalMs: z.number().int().min(1000).default(5000),
    dryRun: z.boolean().default(false),
  }),
  ai: z.object({
    enabled: z.boolean().default(true),
    rebalanceIntervalMs: z.number().int().min(60_000).default(300_000),
  }),
  logLevel: z.string().default("info"),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type GridMode = z.infer<typeof GridModeSchema>;
export type GridDirection = z.infer<typeof GridDirectionSchema>;
export type MarginMode = z.infer<typeof MarginModeSchema>;

/** Normalize BTC-USDT, btc_usdt → BTC_USDT */
export function normalizeSymbol(raw: string): string {
  const cleaned = raw.replace(/[- ]/g, "_").toUpperCase();
  if (cleaned.includes("_")) {
    return cleaned;
  }
  if (cleaned.endsWith("USDT")) {
    return `${cleaned.slice(0, -4)}_USDT`;
  }
  return cleaned;
}

export function loadConfig(overrides?: Partial<{ dryRun: boolean }>): AppConfig {
  const lowerPrice = Number(process.env.GRID_LOWER_PRICE);
  const upperPrice = Number(process.env.GRID_UPPER_PRICE);

  const raw = {
    mexc: {
      apiKey: process.env.MEXC_API_KEY ?? "",
      secretKey: process.env.MEXC_SECRET_KEY ?? "",
      baseUrl: process.env.MEXC_BASE_URL ?? "https://api.mexc.com",
    },
    trading: {
      symbol: normalizeSymbol(process.env.MEXC_SYMBOL ?? "BTC_USDT"),
      gridMode: (process.env.GRID_MODE ?? "arithmetic") as GridMode,
      lowerPrice,
      upperPrice,
      levels: Number(process.env.GRID_LEVELS ?? 10),
      orderSize: Number(process.env.GRID_ORDER_SIZE ?? 10),
      leverage: Number(process.env.LEVERAGE ?? 10),
      marginMode: (process.env.MARGIN_MODE ?? "isolated") as MarginMode,
      positionMode: (process.env.POSITION_MODE ?? "one-way") as
        | "one-way"
        | "dual",
      gridDirection: (process.env.GRID_DIRECTION ?? "long") as GridDirection,
      maxMarginExposure: process.env.MAX_MARGIN_EXPOSURE
        ? Number(process.env.MAX_MARGIN_EXPOSURE)
        : undefined,
      stopLossPrice: process.env.STOP_LOSS_PRICE
        ? Number(process.env.STOP_LOSS_PRICE)
        : undefined,
      takeProfitPrice: process.env.TAKE_PROFIT_PRICE
        ? Number(process.env.TAKE_PROFIT_PRICE)
        : undefined,
      maxFundingRate: process.env.MAX_FUNDING_RATE
        ? Number(process.env.MAX_FUNDING_RATE)
        : undefined,
      pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
      dryRun: overrides?.dryRun ?? process.env.DRY_RUN === "true",
    },
    ai: {
      enabled: process.env.AI_ENABLED !== "false",
      rebalanceIntervalMs: Number(
        process.env.AI_REBALANCE_INTERVAL_MS ?? 300_000,
      ),
    },
    logLevel: process.env.LOG_LEVEL ?? "info",
  };

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  if (parsed.data.trading.lowerPrice >= parsed.data.trading.upperPrice) {
    throw new Error("GRID_LOWER_PRICE must be less than GRID_UPPER_PRICE");
  }

  return parsed.data;
}
