# MEXC Futures Grid AI Trading Bot

Production-grade **MEXC USDT-margined futures grid trading bot** with **AI-adaptive strategy optimization**. Automates open/close cycles across a configurable price grid using **arithmetic** or **geometric** spacing, with leverage control, margin risk limits, funding-rate guards, and intelligent market regime detection.

---

## Features

| Feature | Description |
|---------|-------------|
| **Futures grid** | Long, short, or neutral grid with open/close order pairs |
| **AI optimization** | Adaptive range, levels, leverage, and direction from market regime |
| **Regime detection** | RSI, ATR, Bollinger, volatility, and trend analysis |
| **Risk controls** | Max margin exposure, stop-loss / take-profit, funding-rate limits |
| **Leverage & margin** | Isolated or cross margin, configurable leverage |
| **Dry run** | Full order-flow simulation without exchange writes |
| **CLI toolkit** | `simulate`, `analyze`, `status`, `ping`, `start` commands |
| **Type-safe** | Zod config validation, strict TypeScript |

---

## Project structure

```
MEXC-futures-grid-ai-trading-bot/
├── src/
│   ├── api/mexc/              # MEXC Futures REST client, HMAC auth, types
│   ├── ai/                    # Market analyzer, regime detector, grid optimizer
│   ├── config/                # Environment & Zod validation
│   ├── strategies/grid/       # Grid engine, order manager, position tracker
│   ├── services/              # Logger, risk manager, market data
│   ├── utils/                 # Decimal math, retry helper
│   ├── index.ts               # Main entry (long-running bot)
│   └── cli.ts                 # CLI commands
├── tests/                     # Unit & integration tests
├── .env.example
├── package.json
└── README.md
```

---

## Requirements

- **Node.js** 20 or later
- **MEXC API key** with futures order permissions (KYC required)
- Sufficient USDT margin on the futures account

---

## Quick start

```bash
cd MEXC-futures-grid-ai-trading-bot
npm install
cp .env.example .env
```

Edit `.env` with your MEXC credentials and grid parameters.

### Test API connectivity

```bash
npm run cli -- ping
```

### Preview grid (no live orders)

```bash
npm run cli -- simulate
```

### Run AI market analysis

```bash
npm run cli -- analyze
```

### Dry run (simulated orders, no exchange writes)

```bash
npm run cli -- start --dry-run
```

### Start bot (live trading)

```bash
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

---

## Configuration

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `MEXC_API_KEY` | API key from MEXC |
| `MEXC_SECRET_KEY` | Secret key |
| `MEXC_SYMBOL` | Contract, e.g. `BTC_USDT` or `BTC-USDT` |
| `GRID_MODE` | `arithmetic` or `geometric` |
| `GRID_LOWER_PRICE` | Grid floor price |
| `GRID_UPPER_PRICE` | Grid ceiling price |
| `GRID_LEVELS` | Number of price levels (2–200) |
| `GRID_ORDER_SIZE` | Contracts per grid level |
| `LEVERAGE` | Futures leverage (1–500) |
| `MARGIN_MODE` | `isolated` or `cross` |
| `POSITION_MODE` | `one-way` or `dual` |
| `GRID_DIRECTION` | `long`, `short`, or `neutral` |
| `AI_ENABLED` | Enable AI adaptive optimization (`true`/`false`) |
| `AI_REBALANCE_INTERVAL_MS` | AI re-analysis interval (default 300000) |
| `MAX_MARGIN_EXPOSURE` | Optional max USDT margin exposure |
| `STOP_LOSS_PRICE` | Optional stop-loss trigger price |
| `TAKE_PROFIT_PRICE` | Optional take-profit trigger price |
| `MAX_FUNDING_RATE` | Optional max absolute funding rate |
| `POLL_INTERVAL_MS` | Order sync interval (default 5000) |

---

## How futures grid trading works

1. **Deploy**: Place **open** limit orders below/above current price on each grid level.
2. **Open fills**: Automatically place a **close** order at the adjacent level (profit on the spread).
3. **Close fills**: Place a new **open** order to re-enter the grid.
4. **AI loop**: Periodically analyzes market regime and adjusts range, levels, leverage, and direction.
5. **Poll**: Syncs open orders with MEXC and rebalances on each fill.

```
Price →
  CLOSE LONG @ 81k ────────
  OPEN LONG  @ 79k ────────
  ─── current ~ 77.5k ───
  OPEN LONG  @ 76k ────────
  OPEN LONG  @ 74k ────────
```

---

## AI strategy

The AI module analyzes:

- **Volatility** — widens/narrows grid range via ATR
- **Trend strength** — shifts direction bias (long/short/neutral)
- **RSI** — adjusts order size at extremes
- **Funding rate** — pauses trading when funding is unfavorable
- **Bollinger bands** — confirms range-bound conditions

Regimes: `range_bound`, `trending_up`, `trending_down`, `high_volatility`

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled bot |
| `npm run dev` | Run with `tsx` |
| `npm run cli -- simulate` | Preview grid levels |
| `npm run cli -- analyze` | Run AI market analysis |
| `npm run cli -- status` | Show live ticker |
| `npm run cli -- ping` | Test MEXC API connectivity |
| `npm run cli -- start --dry-run` | Start in dry-run mode |
| `npm test` | Run test suite |
| `npm run lint` | Typecheck without emit |

---

## Safety

- Always test with `--dry-run` first before live trading.
- Futures grid bots amplify both gains and losses via leverage.
- Grid strategies underperform in strong trends; range-bound markets suit grids best.
- Set `MAX_MARGIN_EXPOSURE` to cap downside.
- Use `STOP_LOSS_PRICE` and `TAKE_PROFIT_PRICE` for automated exit rules.
- Monitor funding rates — high funding can erode grid profits.
- Never commit `.env` or share API keys.

---

## License

MIT

---

## Technical support

> ### Need help?
>
> For setup, configuration, bugs, or trading-bot support, contact us on Telegram:
>
> # [@tradingtermin](https://t.me/tradingtermin)
>
> **Telegram:** [@tradingtermin](https://t.me/tradingtermin)

**Support contact (Telegram):** [**@tradingtermin**](https://t.me/tradingtermin)
