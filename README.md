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
- Indicators: SMA EMA RSI MACD Bollinger ATR Stochastic VWAP Supertrend Donchian Hull VolumeOsc StochRSI
- Custom TD Script / Pine + Monaco + Community Library (≥12 installable scripts)
- Watchlists: Crypto Majors, BIST30
- Scanner: rich presets (MACD/BB/Supertrend/Stoch/ATR%/HOD…), Binance top 200 / BIST 120, concurrent klines
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
- Scanner network-bound on large universes (mitigated by batch concurrency)
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


## Community Library (Kütüphane)
Script tab → **Kütüphane**: browse/search curated TD ports (RSI Divergence, EMA Ribbon, MACD Hist, BB Mean Reversion, Supertrend ATR, VWAP, Donchian, Stoch RSI, Ichimoku, Pivots, Volume Osc, Elder Impulse, Turtle, Hull MA, Squeeze Momentum LazyBear-style, S/R swings, Engulfing, Heikin-Ashi helper). One-click install/apply; ~8 popular scripts auto-seed when no `lib_*` scripts exist.

## Scanner (improved)
- Presets gallery (TR): Aşırı satım kombosu, Momentum breakout, Hacim+EMA, MACD bull, BB sıkışma, Supertrend long, crypto/BIST gainers-losers, multi combos
- Filters: MACD cross, BB squeeze/break, Supertrend flip, ATR%, Stochastic, consecutive bars, near HOD/LOD, price vs SMA50/200, RSI divergence sketch
- Universe: Binance top 200 by quoteVolume; BIST up to 120; parallel kline fetch (batch ~10)
- UI: multi-select presets + filter chips, timeframe 15m/1h/4h/1d, progress X/Y, CSV export, sort by RSI/%Δ/volume, named preset save via `/api/store`

## Import from TradingView
1. Copy Pine source from TradingView
2. Script tab → İçe aktar → paste → Dönüştür & yükle (TD)
3. Kaydet → Aktif grafiğe uygula
4. Review warnings for dropped Pine APIs


## Jurik / Loxx + BigBeluga-inspired suites
- **Jurik / Loxx tarzı** builtins: JMA (community), Double JMA, JMA Ribbon, Jurik Filter Bands / Volty, Jurik RSI/RSX, Jurik MACD/CCI/Bollinger, Adaptive JMA, QQE (Jurik RSI), SuperSmoother, Jurik Stoch, Kase Stoch, **Jurik Kase Stochastic** (+ Pro).
- **BigBeluga / SMC tarzı** builtins: Order Blocks, Fair Value Gaps, BOS/CHoCH, Equal Highs/Lows, Premium/Discount, Liquidity Sweep, Beluga Momentum (Nautilus-like), Voltix-like Bands, Flow Trend, Money Flow Composite, Channel Detection, High Volume Points.
- Attribution: *Inspired by Loxx Jurik/Kase concepts / BigBeluga SMC concepts — community reconstructions, not affiliated.*
- **JMA (community)** = widely circulated 3-stage adaptive filter reconstruction (phase, length, power/volty) — not commercial Jurik Research software.
- Pattern overlay also draws OB / FVG / premium-discount sketches via advanced liquidity detectors.
