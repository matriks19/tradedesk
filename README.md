# TradeDesk

TradingView-class web terminal: Binance (live) + BIST (delayed/best-effort).

## Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- lightweight-charts, Zustand, Monaco (dynamic import)
- JSON file store under data/store.json

## Setup
From /workspace/tradedesk: install dependencies, then run the next.js development server.
Open http://localhost:3000
For production: run the build script then the start script.

## Features
- Multi-chart layouts 1/2/4/6/9 (symbol + timeframe per pane)
- Live Binance USDT candles + volume (REST + browser WS)
- USDT spot searchable; BIST ticker list searchable
- Indicators: SMA EMA RSI MACD Bollinger ATR Stochastic VWAP Supertrend
- Custom JS sandbox + Monaco + 3 samples (no fs/network)
- Watchlists: Crypto Majors, BIST30
- Scanner: RSI, pct change, volume spike, EMA cross
- Heatmap (pct change)
- Pattern hints: HH/HL, breakout, engulfing
- TP/SL risk panel with R multiples + chart lines
- Turkish UI labels

## Data notes
Binance public REST/WS. BIST via Yahoo public .IS endpoints with Gecikmeli banner — never fake live prices.

## Custom scripts
Script tab -> save -> apply to active chart. Helpers: sma ema plot. Series: close high low open volume candles.

## Built-in indicators
Add math in src/lib/indicators/math.ts and register in registry.ts

## Persistence
Zustand localStorage for layout; data/store.json via /api/store for watchlists/scripts.

## Roadmap (not v1)
Orders, Pine parity, licensed BIST live feed, drawings, alerts, cloud sync.

## Known gaps
- BIST Yahoo may fail or rate-limit
- Scanner limited to ~40-80 symbols per run
- Shared sub-pane for oscillators
- No auth
- Indicator math practical not vendor-identical


## Formasyonlar (Patterns)
Detects and **draws on chart**: double top/bottom, H&S / inverse H&S, ascending/descending/symmetric triangles, flag/pennant sketch, HH/HL structure, breakout boxes, engulfing.
- Canvas overlay (trendlines, boxes, necklines, labels) + candle markers
- Formasyonlar panel: click a hit to highlight drawings; tunable swing / twin tolerance / box lookback

## TD Script
Small DSL (`//@version=td1`), compiles to JS sandbox:
```
fast = sma(close, 9)
slow = sma(close, 21)
plot(fast, "SMA9", color=#26a69a)
bull = crossover(fast, slow)
plotshape(bull, "Al")
```
Builtins: sma ema rsi macd bollinger highest lowest crossover crossunder plot plotshape hline strategy.entry/close stubs.

## Pine ↔ TD
- Paste TradingView Pine (v5-ish) in Script → İçe aktar → Dönüştür & yükle
- Best-effort: ta.sma/ema/rsi/macd/bb, plot, hline, crossover; unsupported features become warnings
- Export TD as Pine via "Pine olarak dışa aktar"
- Library stores `code` (runnable TD) + optional `originalCode` (raw Pine)

## Import from TradingView
1. Copy Pine source from TradingView
2. Script tab → İçe aktar → paste → Dönüştür & yükle (TD)
3. Kaydet → Aktif grafiğe uygula
4. Review warnings for dropped Pine APIs
