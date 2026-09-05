/**
 * Community Library — curated TD Script ports (TradingView-style).
 * Each entry ships runnable tdCode + optional pineOriginal.
 * TD code must be line-oriented (assignments / plot on one line each).
 */

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  tdCode: string;
  pineOriginal?: string;
  sourceNote?: string;
  /** Seed on first empty load */
  popular?: boolean;
}

export const COMMUNITY_LIBRARY: CatalogEntry[] = [
  {
    id: "rsi-divergence",
    name: "RSI Divergence",
    category: "Oscillator",
    description:
      "RSI + aşırı alım/satım çizgileri; diverjans için görsel sketch (basit).",
    tags: ["rsi", "divergence", "oversold"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
r = rsi(close, 14)
plot(r, "RSI", color=#2962ff)
hline(70, "OB", color=#ef5350)
hline(30, "OS", color=#26a69a)
hline(50, "Mid", color=#8b95a8)
bull = crossover(r, 30)
bear = crossunder(r, 70)
plotshape(bull, "DivBuy", style=triangleup, color=#26a69a)
plotshape(bear, "DivSell", style=triangledown, color=#ef5350)
`,
    pineOriginal: `//@version=5
indicator("RSI Divergence", overlay=false)
r = ta.rsi(close, 14)
plot(r, "RSI", color=color.blue)
hline(70)
hline(30)
hline(50)
`,
  },
  {
    id: "ema-ribbon",
    name: "EMA Ribbon",
    category: "Trend",
    description: "Çoklu EMA şeridi (8/13/21/34/55) — trend gücü.",
    tags: ["ema", "ribbon", "trend"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
e8 = ema(close, 8)
e13 = ema(close, 13)
e21 = ema(close, 21)
e34 = ema(close, 34)
e55 = ema(close, 55)
plot(e8, "EMA8", color=#26a69a)
plot(e13, "EMA13", color=#66bb6a)
plot(e21, "EMA21", color=#ffeb3b)
plot(e34, "EMA34", color=#ff6d00)
plot(e55, "EMA55", color=#ef5350)
`,
  },
  {
    id: "macd-hist-colors",
    name: "MACD Histogram Colors",
    category: "Oscillator",
    description: "MACD + sinyal + histogram (renkli momentum).",
    tags: ["macd", "histogram", "momentum"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
[macdLine, signal, hist] = macd(close, 12, 26, 9)
plot(macdLine, "MACD", color=#2962ff)
plot(signal, "Signal", color=#ff6d00)
plot(hist, "Hist", color=#26a69a)
bull = crossover(macdLine, signal)
bear = crossunder(macdLine, signal)
plotshape(bull, "MACD↑", style=triangleup, color=#26a69a)
plotshape(bear, "MACD↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "bb-mean-reversion",
    name: "Bollinger Mean Reversion",
    category: "Volatility",
    description: "BB bantları + orta; alt/üst dokunuş uyarıları.",
    tags: ["bollinger", "mean-reversion"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
[mid, upper, lower] = bollinger(close, 20, 2)
plot(mid, "BB Mid", color=#2962ff)
plot(upper, "BB Up", color=#ef5350)
plot(lower, "BB Low", color=#26a69a)
buy = crossover(close, lower)
sell = crossunder(close, upper)
plotshape(buy, "MR Buy", style=triangleup, color=#26a69a)
plotshape(sell, "MR Sell", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "supertrend-atr",
    name: "Supertrend ATR",
    category: "Trend",
    description: "ATR tabanlı Supertrend yaklaşımı (HL2 ± ATR*mult).",
    tags: ["supertrend", "atr", "trend"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
tr = trueRange()
atr14 = sma(tr, 14)
upper = hl2.map((v, i) => v != null && atr14[i] != null ? v + 3 * atr14[i] : null)
lower = hl2.map((v, i) => v != null && atr14[i] != null ? v - 3 * atr14[i] : null)
plot(upper, "ST Upper", color=#ef5350)
plot(lower, "ST Lower", color=#26a69a)
plot(hl2, "HL2", color=#8b95a8)
longFlip = crossover(close, upper)
shortFlip = crossunder(close, lower)
plotshape(longFlip, "ST↑", style=triangleup, color=#26a69a)
plotshape(shortFlip, "ST↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "vwap-session",
    name: "VWAP Session",
    category: "Volume",
    description: "HLC3 tabanlı kümülatif VWAP benzeri çizgi.",
    tags: ["vwap", "session", "volume"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
vw = sessionVwap()
plot(vw, "VWAP", color=#e040fb)
plot(sma(close, 20), "SMA20", color=#8b95a8)
above = crossover(close, vw)
below = crossunder(close, vw)
plotshape(above, "VWAP↑", style=triangleup, color=#26a69a)
plotshape(below, "VWAP↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "donchian-breakout",
    name: "Donchian Breakout",
    category: "Breakout",
    description: "Donchian kanalı (20) — Turtle tarzı kırılım.",
    tags: ["donchian", "breakout", "turtle"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
up = highest(high, 20)
lo = lowest(low, 20)
mid = up.map((v, i) => v != null && lo[i] != null ? (v + lo[i]) / 2 : null)
plot(up, "Donch High", color=#26a69a)
plot(lo, "Donch Low", color=#ef5350)
plot(mid, "Donch Mid", color=#2962ff)
brkUp = crossover(close, up)
brkDn = crossunder(close, lo)
plotshape(brkUp, "Break↑", style=triangleup, color=#26a69a)
plotshape(brkDn, "Break↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "stochastic-rsi",
    name: "Stochastic RSI",
    category: "Oscillator",
    description: "RSI üzerinde Stochastic — hassas momentum.",
    tags: ["stoch", "rsi", "oscillator"],
    popular: true,
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
r = rsi(close, 14)
hh = highest(r, 14)
ll = lowest(r, 14)
stochRsi = r.map((v, i) => v == null || hh[i] == null || ll[i] == null || hh[i] === ll[i] ? null : 100 * (v - ll[i]) / (hh[i] - ll[i]))
kSrc = stochRsi.map((v) => v == null ? 0 : v)
k = sma(kSrc, 3)
d = sma(k.map((v) => v == null ? 0 : v), 3)
plot(k, "StochRSI K", color=#2962ff)
plot(d, "StochRSI D", color=#ff6d00)
hline(80, "OB", color=#ef5350)
hline(20, "OS", color=#26a69a)
`,
  },
  {
    id: "ichimoku-simplified",
    name: "Ichimoku Simplified",
    category: "Trend",
    description: "Tenkan/Kijun/SpanB sketch (bulut kaydırma yok).",
    tags: ["ichimoku", "trend"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
hi9 = highest(high, 9)
lo9 = lowest(low, 9)
tenkan = hi9.map((v, i) => v != null && lo9[i] != null ? (v + lo9[i]) / 2 : null)
hi26 = highest(high, 26)
lo26 = lowest(low, 26)
kijun = hi26.map((v, i) => v != null && lo26[i] != null ? (v + lo26[i]) / 2 : null)
hi52 = highest(high, 52)
lo52 = lowest(low, 52)
spanB = hi52.map((v, i) => v != null && lo52[i] != null ? (v + lo52[i]) / 2 : null)
plot(tenkan, "Tenkan", color=#2962ff)
plot(kijun, "Kijun", color=#ef5350)
plot(spanB, "SpanB", color=#ffeb3b)
bull = crossover(tenkan, kijun)
bear = crossunder(tenkan, kijun)
plotshape(bull, "TK↑", style=triangleup, color=#26a69a)
plotshape(bear, "TK↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "pivot-points-daily",
    name: "Pivot Points Daily",
    category: "Levels",
    description: "Önceki bar HLC pivot + R1/S1 sketch.",
    tags: ["pivot", "levels", "support"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
pp = close.map((_, i) => i < 1 ? null : (high[i-1] + low[i-1] + close[i-1]) / 3)
r1 = pp.map((v, i) => v == null || i < 1 ? null : 2 * v - low[i-1])
s1 = pp.map((v, i) => v == null || i < 1 ? null : 2 * v - high[i-1])
r2 = pp.map((v, i) => v == null || i < 1 ? null : v + (high[i-1] - low[i-1]))
s2 = pp.map((v, i) => v == null || i < 1 ? null : v - (high[i-1] - low[i-1]))
plot(pp, "PP", color=#ffeb3b)
plot(r1, "R1", color=#ef5350)
plot(s1, "S1", color=#26a69a)
plot(r2, "R2", color=#e040fb)
plot(s2, "S2", color=#00bcd4)
`,
  },
  {
    id: "volume-oscillator",
    name: "Volume Oscillator",
    category: "Volume",
    description: "Kısa/uzun hacim EMA farkı (%).",
    tags: ["volume", "oscillator"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
vs = ema(volume, 5)
vl = ema(volume, 10)
osc = vs.map((v, i) => v != null && vl[i] != null && vl[i] !== 0 ? 100 * (v - vl[i]) / vl[i] : null)
plot(osc, "Vol Osc", color=#e040fb)
hline(0, "Zero", color=#8b95a8)
`,
  },
  {
    id: "elder-impulse",
    name: "Elder Impulse Sketch",
    category: "Trend",
    description: "EMA13 + MACD hist — Elder Impulse renk mantığı sketch.",
    tags: ["elder", "impulse", "macd"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
e13 = ema(close, 13)
[macdLine, signal, hist] = macd(close, 12, 26, 9)
plot(e13, "EMA13", color=#2962ff)
plot(hist, "MACD Hist", color=#26a69a)
impulseUp = e13.map((v, i) => i < 1 || v == null || e13[i-1] == null || hist[i] == null || hist[i-1] == null ? false : (v > e13[i-1] && hist[i] > hist[i-1]))
impulseDn = e13.map((v, i) => i < 1 || v == null || e13[i-1] == null || hist[i] == null || hist[i-1] == null ? false : (v < e13[i-1] && hist[i] < hist[i-1]))
plotshape(impulseUp, "Impulse↑", style=triangleup, color=#26a69a)
plotshape(impulseDn, "Impulse↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "turtle-donchian",
    name: "Turtle / Donchian",
    category: "Breakout",
    description: "Turtle sistem: 20 giriş / 10 çıkış kanalları.",
    tags: ["turtle", "donchian", "system"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
entryUp = highest(high, 20)
entryLo = lowest(low, 20)
exitUp = highest(high, 10)
exitLo = lowest(low, 10)
plot(entryUp, "Entry 20H", color=#26a69a)
plot(entryLo, "Entry 20L", color=#ef5350)
plot(exitUp, "Exit 10H", color=#66bb6a)
plot(exitLo, "Exit 10L", color=#ff6d00)
longSig = crossover(close, entryUp)
shortSig = crossunder(close, entryLo)
plotshape(longSig, "Turtle Long", style=triangleup, color=#26a69a)
plotshape(shortSig, "Turtle Short", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "hull-ma",
    name: "Hull MA",
    category: "Trend",
    description: "Hull Moving Average yaklaşımı (WMA proxy via SMA).",
    tags: ["hull", "hma", "trend"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
half = sma(close, 10)
full = sma(close, 20)
raw = half.map((v, i) => v != null && full[i] != null ? 2 * v - full[i] : null)
hma = sma(raw.map((v) => v == null ? 0 : v), 4)
plot(hma, "HMA", color=#00bcd4)
plot(sma(close, 20), "SMA20", color=#8b95a8)
bull = crossover(close, hma)
bear = crossunder(close, hma)
plotshape(bull, "HMA↑", style=triangleup, color=#26a69a)
plotshape(bear, "HMA↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "squeeze-momentum",
    name: "Squeeze Momentum",
    category: "Volatility",
    description: "LazyBear-style squeeze: BB vs KC (ATR) + momentum hist.",
    tags: ["squeeze", "lazybear", "momentum"],
    popular: true,
    sourceNote: "TradingView-style community port (LazyBear-inspired)",
    tdCode: `//@version=td1
[mid, upper, lower] = bollinger(close, 20, 2)
tr = trueRange()
atrKC = sma(tr, 20)
kcUpper = mid.map((v, i) => v != null && atrKC[i] != null ? v + 1.5 * atrKC[i] : null)
kcLower = mid.map((v, i) => v != null && atrKC[i] != null ? v - 1.5 * atrKC[i] : null)
sqzOn = upper.map((v, i) => v != null && kcUpper[i] != null && lower[i] != null && kcLower[i] != null ? (v < kcUpper[i] && lower[i] > kcLower[i]) : false)
hh = highest(high, 20)
ll = lowest(low, 20)
avgHL = hh.map((v, i) => v != null && ll[i] != null ? (v + ll[i]) / 2 : null)
basis = sma(close, 20)
avgAll = avgHL.map((v, i) => v != null && basis[i] != null ? (v + basis[i]) / 2 : null)
mom = close.map((v, i) => avgAll[i] != null ? v - avgAll[i] : null)
plot(mom, "Squeeze Mom", color=#2962ff)
plot(mid, "BB Mid", color=#8b95a8)
plotshape(sqzOn, "SQZ", style=circle, color=#ffeb3b)
hline(0, "Zero", color=#8b95a8)
`,
    pineOriginal: `//@version=5
indicator("Squeeze Momentum", overlay=false)
length = 20
[mid, upper, lower] = ta.bb(close, length, 2)
`,
  },
  {
    id: "support-resistance-swings",
    name: "Support/Resistance Swings",
    category: "Levels",
    description: "Son N bar highest/lowest — basit S/R.",
    tags: ["support", "resistance", "swings"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
res = highest(high, 20)
sup = lowest(low, 20)
mid = res.map((v, i) => v != null && sup[i] != null ? (v + sup[i]) / 2 : null)
plot(res, "Resistance", color=#ef5350)
plot(sup, "Support", color=#26a69a)
plot(mid, "Mid Range", color=#8b95a8)
`,
  },
  {
    id: "engulfing-alert",
    name: "Engulfing Alert Plot",
    category: "Candlestick",
    description: "Bullish/bearish engulfing mum formasyonu işaretleri.",
    tags: ["engulfing", "candlestick", "pattern"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
bullEng = close.map((v, i) => i < 1 ? false : (close[i-1] < open[i-1] && v > open[i] && v >= open[i-1] && open[i] <= close[i-1]))
bearEng = close.map((v, i) => i < 1 ? false : (close[i-1] > open[i-1] && v < open[i] && v <= open[i-1] && open[i] >= close[i-1]))
plot(close, "Close", color=#8b95a8)
plotshape(bullEng, "Bull Engulf", style=triangleup, color=#26a69a)
plotshape(bearEng, "Bear Engulf", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "heikin-ashi-helper",
    name: "Heikin-Ashi Trend Helper",
    category: "Candlestick",
    description: "HA close yaklaşımı + EMA — trend filtresi.",
    tags: ["heikin-ashi", "trend", "filter"],
    sourceNote: "TradingView-style community port",
    tdCode: `//@version=td1
haClose = close.map((_, i) => (open[i] + high[i] + low[i] + close[i]) / 4)
haEma = ema(haClose, 10)
plot(haClose, "HA Close", color=#00bcd4)
plot(haEma, "HA EMA10", color=#ff6d00)
bull = crossover(haClose, haEma)
bear = crossunder(haClose, haEma)
plotshape(bull, "HA↑", style=triangleup, color=#26a69a)
plotshape(bear, "HA↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "jurik-kase-stoch-notes",
    name: "Jurik Kase Stoch Notes",
    category: "Jurik / Loxx",
    description:
      "Built-in jurikKaseStoch / Pro preferred. This TD sketch mirrors permission zones. Inspired by Loxx Jurik/Kase concepts — community reconstructions, not affiliated.",
    tags: ["jurik", "kase", "stochastic", "loxx"],
    popular: true,
    sourceNote:
      "Inspired by Loxx Jurik/Kase concepts — community reconstructions, not affiliated. Prefer builtin jurikKaseStoch.",
    tdCode: `//@version=td1
r = rsi(close, 14)
k = sma(r, 5)
d = sma(k, 3)
plot(k, "KaseK~", color=#2962ff)
plot(d, "Signal", color=#ff6d00)
hline(20, "Lo2", color=#26a69a)
hline(80, "Hi2", color=#ef5350)
hline(10, "Lo", color=#78909c)
hline(90, "Hi", color=#78909c)
bull = crossover(k, 20)
bear = crossunder(k, 80)
plotshape(bull, "BullPerm", style=triangleup, color=#26a69a)
plotshape(bear, "BearPerm", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "jma-ribbon-notes",
    name: "JMA Ribbon Notes",
    category: "Jurik / Loxx",
    description:
      "Use builtin jmaRibbon for full JMA (community). EMA ribbon sketch as fallback. Inspired by Loxx Jurik concepts — not affiliated.",
    tags: ["jma", "jurik", "ribbon", "loxx"],
    sourceNote:
      "Inspired by Loxx Jurik/Kase concepts — community reconstructions, not affiliated.",
    tdCode: `//@version=td1
e8 = ema(close, 8)
e13 = ema(close, 13)
e21 = ema(close, 21)
e34 = ema(close, 34)
e55 = ema(close, 55)
plot(e8, "JMA~8", color=#26a69a)
plot(e13, "JMA~13", color=#66bb6a)
plot(e21, "JMA~21", color=#ffeb3b)
plot(e34, "JMA~34", color=#ff6d00)
plot(e55, "JMA~55", color=#ef5350)
`,
  },
  {
    id: "beluga-momentum-notes",
    name: "Beluga Momentum Notes",
    category: "BigBeluga / SMC",
    description:
      "Prefer builtin nautilusLike. RSI+MFI blend sketch. Inspired by BigBeluga SMC concepts — community reconstructions, not affiliated.",
    tags: ["bigbeluga", "nautilus", "momentum", "smc"],
    popular: true,
    sourceNote:
      "Inspired by BigBeluga SMC concepts — community reconstructions, not affiliated. Prefer builtin nautilusLike.",
    tdCode: `//@version=td1
r = rsi(close, 14)
plot(r, "BelugaMom~", color=#2962ff)
hline(80, "ExhUp", color=#ef5350)
hline(20, "ExhLow", color=#26a69a)
hline(50, "Mid", color=#8b95a8)
bull = crossover(r, 20)
bear = crossunder(r, 80)
plotshape(bull, "BM↑", style=triangleup, color=#26a69a)
plotshape(bear, "BM↓", style=triangledown, color=#ef5350)
`,
  },
  {
    id: "smc-premium-discount-notes",
    name: "SMC Premium/Discount Notes",
    category: "BigBeluga / SMC",
    description:
      "Prefer builtin premiumDiscount / orderBlocks / fairValueGaps. Inspired by BigBeluga SMC concepts — not affiliated.",
    tags: ["smc", "premium", "discount", "bigbeluga"],
    sourceNote:
      "Inspired by BigBeluga SMC concepts — community reconstructions, not affiliated.",
    tdCode: `//@version=td1
hi = highest(high, 50)
lo = lowest(low, 50)
mid = hi.map((v, i) => v != null && lo[i] != null ? (v + lo[i]) / 2 : null)
prem = hi.map((v, i) => v != null && lo[i] != null ? lo[i] + (v - lo[i]) * 0.7 : null)
disc = hi.map((v, i) => v != null && lo[i] != null ? lo[i] + (v - lo[i]) * 0.3 : null)
plot(hi, "RangeHigh", color=#ef535088)
plot(prem, "Premium", color=#ef5350)
plot(mid, "EQ", color=#2962ff)
plot(disc, "Discount", color=#26a69a)
plot(lo, "RangeLow", color=#26a69a88)
`,
  },
  {
    id: "voltix-bands-notes",
    name: "Voltix-like Bands Notes",
    category: "BigBeluga / SMC",
    description:
      "Prefer builtin voltixBands (JMA + adaptive ATR). Inspired by BigBeluga concepts — not affiliated.",
    tags: ["voltix", "bands", "bigbeluga", "atr"],
    sourceNote:
      "Inspired by BigBeluga SMC concepts — community reconstructions, not affiliated.",
    tdCode: `//@version=td1
[mid, upper, lower] = bollinger(close, 20, 1.8)
plot(mid, "Voltix~Mid", color=#2962ff)
plot(upper, "Voltix~Up", color=#ef5350)
plot(lower, "Voltix~Low", color=#26a69a)
`,
  },

];

export const POPULAR_CATALOG_IDS = COMMUNITY_LIBRARY.filter((e) => e.popular).map(
  (e) => e.id
);

export function catalogToScript(entry: CatalogEntry) {
  return {
    id: `lib_${entry.id}`,
    name: entry.name,
    code: entry.tdCode,
    language: "td" as const,
    originalCode: entry.pineOriginal,
    originalLanguage: entry.pineOriginal ? ("pine" as const) : undefined,
    updatedAt: Date.now(),
    warnings: entry.sourceNote ? [entry.sourceNote] : undefined,
  };
}

export function getPopularSeedScripts() {
  return COMMUNITY_LIBRARY.filter((e) => e.popular).map(catalogToScript);
}
