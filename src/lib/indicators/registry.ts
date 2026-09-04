import type {
  Candle,
  BuiltinIndicatorId,
  IndicatorInstance,
  IndicatorMeta,
  IndicatorCategory,
  PriceField,
} from "@/lib/types";
import {
  adl,
  adx,
  atr,
  awesomeOsc,
  bollinger,
  cci,
  chaikinVol,
  cmf,
  cumDelta,
  dema,
  donchian,
  ema,
  highest,
  histVol,
  hull,
  ichimoku,
  keltner,
  linreg,
  lowest,
  macd,
  mfi,
  momentum,
  obv,
  pivotClassic,
  ppo,
  priceSeries,
  psar,
  roc,
  rsi,
  seriesToLineData,
  sma,
  stddev,
  stochastic,
  stochasticSeries,
  stochRsi,
  supertrend,
  tema,
  toLineData,
  tsi,
  ultimateOsc,
  volumeOsc,
  vwap,
  vwma,
  williamsR,
  wma,
  zigzag,
} from "./math";

export interface PlotSeries {
  id: string;
  pane: "main" | "sub";
  type: "line" | "histogram";
  color: string;
  data: { time: number; value: number }[];
  title?: string;
  /** Key used when nesting (primary series) */
  seriesKey?: string;
}

const SOURCE_OPTIONS = [
  { value: "close", label: "Close" },
  { value: "open", label: "Open" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
  { value: "hl2", label: "HL2" },
  { value: "hlc3", label: "HLC3" },
  { value: "ohlc4", label: "OHLC4" },
];

function num(
  key: string,
  label: string,
  def: number,
  min = 1,
  max = 500,
  step = 1
) {
  return { key, label, type: "number" as const, min, max, step, default: def };
}

function src(def: string = "close") {
  return {
    key: "source",
    label: "Source",
    type: "select" as const,
    default: def,
    options: SOURCE_OPTIONS,
  };
}

export const BUILTIN_LIST: IndicatorMeta[] = [
  // Trend
  { id: "sma", label: "SMA", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "sma", inputs: [num("period", "Period", 20), src()] },
  { id: "ema", label: "EMA", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "ema", inputs: [num("period", "Period", 21), src()] },
  { id: "wma", label: "WMA", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "wma", inputs: [num("period", "Period", 20), src()] },
  { id: "dema", label: "DEMA", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "dema", inputs: [num("period", "Period", 20), src()] },
  { id: "tema", label: "TEMA", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "tema", inputs: [num("period", "Period", 20), src()] },
  { id: "hma", label: "HMA", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "hma", inputs: [num("period", "Period", 20), src()] },
  { id: "vwma", label: "VWMA", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "vwma", inputs: [num("period", "Period", 20)] },
  { id: "ichimoku", label: "Ichimoku", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "tenkan", inputs: [num("tenkan", "Tenkan", 9), num("kijun", "Kijun", 26), num("senkou", "Senkou", 52)] },
  { id: "supertrend", label: "Supertrend", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "st", inputs: [num("period", "ATR Period", 10), num("mult", "Multiplier", 3, 0.5, 20, 0.1)] },
  { id: "psar", label: "Parabolic SAR", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "psar", inputs: [num("step", "Step", 0.02, 0.001, 0.5, 0.001), num("max", "Max", 0.2, 0.01, 1, 0.01)] },
  { id: "adx", label: "ADX / DMI", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "adx", inputs: [num("period", "Period", 14)] },
  { id: "linreg", label: "Linear Regression", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "linreg", inputs: [num("period", "Period", 14), src()] },
  // Momentum
  { id: "rsi", label: "RSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "rsi", inputs: [num("period", "Period", 14), src()] },
  { id: "stochastic", label: "Stochastic", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "k", inputs: [num("kPeriod", "%K Period", 14), num("dPeriod", "%D Period", 3)] },
  { id: "stochRsi", label: "Stoch RSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "k", inputs: [num("rsiPeriod", "RSI Period", 14), num("stochPeriod", "Stoch Period", 14), num("kSmooth", "K Smooth", 3), num("dSmooth", "D Smooth", 3), src()] },
  { id: "macd", label: "MACD", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "macd", inputs: [num("fast", "Fast", 12), num("slow", "Slow", 26), num("signal", "Signal", 9), src()] },
  { id: "cci", label: "CCI", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "cci", inputs: [num("period", "Period", 20)] },
  { id: "roc", label: "ROC", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "roc", inputs: [num("period", "Period", 12), src()] },
  { id: "momentum", label: "Momentum", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "mom", inputs: [num("period", "Period", 10), src()] },
  { id: "williamsR", label: "Williams %R", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "wr", inputs: [num("period", "Period", 14)] },
  { id: "tsi", label: "TSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "tsi", inputs: [num("longPeriod", "Long", 25), num("shortPeriod", "Short", 13), num("signalPeriod", "Signal", 7), src()] },
  { id: "ultimateOsc", label: "Ultimate Oscillator", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "uo", inputs: [num("p1", "Period 1", 7), num("p2", "Period 2", 14), num("p3", "Period 3", 28)] },
  { id: "awesomeOsc", label: "Awesome Oscillator", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "ao", inputs: [] },
  { id: "ppo", label: "PPO", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "ppo", inputs: [num("fast", "Fast", 12), num("slow", "Slow", 26), num("signal", "Signal", 9), src()] },
  // Volatility
  { id: "bollinger", label: "Bollinger Bands", category: "volatility", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "keltner", label: "Keltner Channels", category: "volatility", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("mult", "Mult", 1.5, 0.5, 10, 0.1)] },
  { id: "donchian", label: "Donchian Channels", category: "volatility", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", inputs: [num("period", "Period", 20)] },
  { id: "atr", label: "ATR", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "atr", inputs: [num("period", "Period", 14)] },
  { id: "stddev", label: "Standard Deviation", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "sd", inputs: [num("period", "Period", 20), src()] },
  { id: "histVol", label: "Historical Volatility", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "hv", inputs: [num("period", "Period", 20), src()] },
  { id: "chaikinVol", label: "Chaikin Volatility", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "cv", inputs: [num("period", "Period", 10)] },
  // Volume
  { id: "vwap", label: "VWAP", category: "volume", pane: "main", acceptsSeries: false, primarySeriesKey: "vwap", inputs: [] },
  { id: "obv", label: "OBV", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "obv", inputs: [] },
  { id: "mfi", label: "MFI", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "mfi", inputs: [num("period", "Period", 14)] },
  { id: "cmf", label: "CMF", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "cmf", inputs: [num("period", "Period", 20)] },
  { id: "volumeOsc", label: "Volume Oscillator", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "vo", inputs: [num("shortPeriod", "Short", 5), num("longPeriod", "Long", 10)] },
  { id: "adl", label: "ADL (Accumulation/Distribution)", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "adl", inputs: [] },
  // Other
  { id: "pivot", label: "Pivot Points (Classic)", category: "other", pane: "main", acceptsSeries: false, primarySeriesKey: "pp", inputs: [] },
  { id: "zigzag", label: "ZigZag", category: "other", pane: "main", acceptsSeries: false, primarySeriesKey: "zz", inputs: [num("pct", "Deviation %", 5, 0.5, 50, 0.5)] },
  { id: "highest", label: "Highest", category: "other", pane: "main", acceptsSeries: true, primarySeriesKey: "hi", inputs: [num("period", "Period", 20), src()] },
  { id: "lowest", label: "Lowest", category: "other", pane: "main", acceptsSeries: true, primarySeriesKey: "lo", inputs: [num("period", "Period", 20), src()] },
  { id: "cumDelta", label: "Cumulative Delta (sketch)", category: "other", pane: "sub", acceptsSeries: false, primarySeriesKey: "cd", inputs: [] },
];

export const BUILTIN_META: Record<BuiltinIndicatorId, IndicatorMeta> =
  Object.fromEntries(BUILTIN_LIST.map((m) => [m.id, m])) as Record<
    BuiltinIndicatorId,
    IndicatorMeta
  >;

/** @deprecated defaults map for store compatibility */
export function defaultsFor(type: BuiltinIndicatorId): Record<string, number | string> {
  const meta = BUILTIN_META[type];
  const out: Record<string, number | string> = {};
  for (const inp of meta.inputs) out[inp.key] = inp.default;
  return out;
}

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
  trend: "Trend",
  momentum: "Momentum",
  volatility: "Volatility",
  volume: "Volume",
  other: "Other",
};

export const CATEGORY_ORDER: IndicatorCategory[] = [
  "trend",
  "momentum",
  "volatility",
  "volume",
  "other",
];

const COLORS = [
  "#2962ff",
  "#ff6d00",
  "#e040fb",
  "#00bcd4",
  "#ffeb3b",
  "#8bc34a",
  "#f44336",
  "#9c27b0",
  "#26a69a",
  "#ef5350",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function n(p: Record<string, number | string>, key: string, def: number): number {
  const v = p[key];
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : def;
}

function resolveSourceValues(
  candles: Candle[],
  inst: IndicatorInstance,
  seriesCache: Map<string, Record<string, (number | null)[]>>
): number[] {
  const src = inst.source;
  if (!src || src.type === "price") {
    const field = (src?.type === "price" ? src.field : undefined) ||
      (String(inst.params.source || "close") as PriceField);
    return priceSeries(candles, field);
  }
  const parent = seriesCache.get(src.indicatorId);
  const key = src.seriesKey || Object.keys(parent || {})[0];
  const series = parent?.[key];
  if (!series) return priceSeries(candles, "close");
  // fill nulls with previous for child math stability
  let last = series.find((v) => v != null) ?? 0;
  return series.map((v) => {
    if (v != null) {
      last = v;
      return v;
    }
    return last as number;
  });
}

function line(
  inst: IndicatorInstance,
  key: string,
  pane: "main" | "sub",
  color: string,
  candles: Candle[],
  values: (number | null)[],
  title: string
): PlotSeries {
  return {
    id: `${inst.id}-${key}`,
    pane,
    type: "line",
    color,
    data: toLineData(candles, values),
    title,
    seriesKey: key,
  };
}

function hist(
  inst: IndicatorInstance,
  key: string,
  pane: "main" | "sub",
  color: string,
  candles: Candle[],
  values: (number | null)[],
  title: string
): PlotSeries {
  return {
    id: `${inst.id}-${key}`,
    pane,
    type: "histogram",
    color,
    data: toLineData(candles, values),
    title,
    seriesKey: key,
  };
}

export function computeBuiltin(
  inst: IndicatorInstance,
  candles: Candle[],
  seriesCache?: Map<string, Record<string, (number | null)[]>>
): PlotSeries[] {
  if (inst.type === "custom") return [];
  const cache = seriesCache ?? new Map();
  const values = resolveSourceValues(candles, inst, cache);
  const color = inst.color ?? COLORS[hash(inst.id) % COLORS.length];
  const p = inst.params;
  const meta = BUILTIN_META[inst.type as BuiltinIndicatorId];
  const pane = meta?.pane ?? "main";
  const store: Record<string, (number | null)[]> = {};
  const out: PlotSeries[] = [];

  const push = (plots: PlotSeries[], seriesMap: Record<string, (number | null)[]>) => {
    Object.assign(store, seriesMap);
    out.push(...plots);
  };

  switch (inst.type) {
    case "sma": {
      const period = n(p, "period", 20);
      const v = sma(values, period);
      push([line(inst, "sma", "main", color, candles, v, `SMA(${period})`)], { sma: v });
      break;
    }
    case "ema": {
      const period = n(p, "period", 21);
      const v = ema(values, period);
      push([line(inst, "ema", "main", color, candles, v, `EMA(${period})`)], { ema: v });
      break;
    }
    case "wma": {
      const period = n(p, "period", 20);
      const v = wma(values, period);
      push([line(inst, "wma", "main", color, candles, v, `WMA(${period})`)], { wma: v });
      break;
    }
    case "dema": {
      const period = n(p, "period", 20);
      const v = dema(values, period);
      push([line(inst, "dema", "main", color, candles, v, `DEMA(${period})`)], { dema: v });
      break;
    }
    case "tema": {
      const period = n(p, "period", 20);
      const v = tema(values, period);
      push([line(inst, "tema", "main", color, candles, v, `TEMA(${period})`)], { tema: v });
      break;
    }
    case "hma": {
      const period = n(p, "period", 20);
      const v = hull(values, period);
      push([line(inst, "hma", "main", color, candles, v, `HMA(${period})`)], { hma: v });
      break;
    }
    case "vwma": {
      const period = n(p, "period", 20);
      const v = vwma(candles, period);
      push([line(inst, "vwma", "main", color, candles, v, `VWMA(${period})`)], { vwma: v });
      break;
    }
    case "ichimoku": {
      const ich = ichimoku(candles, n(p, "tenkan", 9), n(p, "kijun", 26), n(p, "senkou", 52));
      push(
        [
          line(inst, "tenkan", "main", "#2962ff", candles, ich.tenkan, "Tenkan"),
          line(inst, "kijun", "main", "#ff6d00", candles, ich.kijun, "Kijun"),
          line(inst, "spanA", "main", "#26a69a88", candles, ich.spanA, "Span A"),
          line(inst, "spanB", "main", "#ef535088", candles, ich.spanB, "Span B"),
        ],
        { tenkan: ich.tenkan, kijun: ich.kijun, spanA: ich.spanA, spanB: ich.spanB }
      );
      break;
    }
    case "supertrend": {
      const st = supertrend(candles, n(p, "period", 10), n(p, "mult", 3));
      push([line(inst, "st", "main", "#00bcd4", candles, st.line, "Supertrend")], { st: st.line });
      break;
    }
    case "psar": {
      const v = psar(candles, n(p, "step", 0.02), n(p, "max", 0.2));
      push([line(inst, "psar", "main", color, candles, v, "PSAR")], { psar: v });
      break;
    }
    case "adx": {
      const a = adx(candles, n(p, "period", 14));
      push(
        [
          line(inst, "adx", "sub", "#2962ff", candles, a.adx, "ADX"),
          line(inst, "plusDI", "sub", "#26a69a", candles, a.plusDI, "+DI"),
          line(inst, "minusDI", "sub", "#ef5350", candles, a.minusDI, "-DI"),
        ],
        { adx: a.adx, plusDI: a.plusDI, minusDI: a.minusDI }
      );
      break;
    }
    case "linreg": {
      const period = n(p, "period", 14);
      const v = linreg(values, period);
      push([line(inst, "linreg", "main", color, candles, v, `LinReg(${period})`)], { linreg: v });
      break;
    }
    case "rsi": {
      const period = n(p, "period", 14);
      const v = rsi(values, period);
      push([line(inst, "rsi", "sub", color, candles, v, `RSI(${period})`)], { rsi: v });
      break;
    }
    case "stochastic": {
      const kp = n(p, "kPeriod", 14);
      const dp = n(p, "dPeriod", 3);
      const s =
        inst.source?.type === "indicator"
          ? stochasticSeries(values, kp, dp)
          : stochastic(candles, kp, dp);
      push(
        [
          line(inst, "k", "sub", "#2962ff", candles, s.k, "%K"),
          line(inst, "d", "sub", "#ff6d00", candles, s.d, "%D"),
        ],
        { k: s.k, d: s.d }
      );
      break;
    }
    case "stochRsi": {
      const sr = stochRsi(
        values,
        n(p, "rsiPeriod", 14),
        n(p, "stochPeriod", 14),
        n(p, "kSmooth", 3),
        n(p, "dSmooth", 3)
      );
      push(
        [
          line(inst, "k", "sub", "#2962ff", candles, sr.k, "StochRSI %K"),
          line(inst, "d", "sub", "#ff6d00", candles, sr.d, "StochRSI %D"),
        ],
        { k: sr.k, d: sr.d }
      );
      break;
    }
    case "macd": {
      const m = macd(values, n(p, "fast", 12), n(p, "slow", 26), n(p, "signal", 9));
      push(
        [
          line(inst, "macd", "sub", "#2962ff", candles, m.macd, "MACD"),
          line(inst, "sig", "sub", "#ff6d00", candles, m.signal, "Signal"),
          hist(inst, "hist", "sub", "#26a69a", candles, m.hist, "Hist"),
        ],
        { macd: m.macd, signal: m.signal, hist: m.hist }
      );
      break;
    }
    case "cci": {
      const period = n(p, "period", 20);
      const v = cci(candles, period);
      push([line(inst, "cci", "sub", color, candles, v, `CCI(${period})`)], { cci: v });
      break;
    }
    case "roc": {
      const period = n(p, "period", 12);
      const v = roc(values, period);
      push([line(inst, "roc", "sub", color, candles, v, `ROC(${period})`)], { roc: v });
      break;
    }
    case "momentum": {
      const period = n(p, "period", 10);
      const v = momentum(values, period);
      push([line(inst, "mom", "sub", color, candles, v, `Mom(${period})`)], { mom: v });
      break;
    }
    case "williamsR": {
      const period = n(p, "period", 14);
      const v = williamsR(candles, period);
      push([line(inst, "wr", "sub", color, candles, v, `%R(${period})`)], { wr: v });
      break;
    }
    case "tsi": {
      const t = tsi(values, n(p, "longPeriod", 25), n(p, "shortPeriod", 13), n(p, "signalPeriod", 7));
      push(
        [
          line(inst, "tsi", "sub", "#2962ff", candles, t.tsi, "TSI"),
          line(inst, "sig", "sub", "#ff6d00", candles, t.signal, "Signal"),
        ],
        { tsi: t.tsi, signal: t.signal }
      );
      break;
    }
    case "ultimateOsc": {
      const v = ultimateOsc(candles, n(p, "p1", 7), n(p, "p2", 14), n(p, "p3", 28));
      push([line(inst, "uo", "sub", color, candles, v, "UO")], { uo: v });
      break;
    }
    case "awesomeOsc": {
      const v = awesomeOsc(candles);
      push([hist(inst, "ao", "sub", color, candles, v, "AO")], { ao: v });
      break;
    }
    case "ppo": {
      const m = ppo(values, n(p, "fast", 12), n(p, "slow", 26), n(p, "signal", 9));
      push(
        [
          line(inst, "ppo", "sub", "#2962ff", candles, m.ppo, "PPO"),
          line(inst, "sig", "sub", "#ff6d00", candles, m.signal, "Signal"),
          hist(inst, "hist", "sub", "#26a69a", candles, m.hist, "Hist"),
        ],
        { ppo: m.ppo, signal: m.signal, hist: m.hist }
      );
      break;
    }
    case "bollinger": {
      const period = n(p, "period", 20);
      const mult = n(p, "mult", 2);
      const b = bollinger(values, period, mult);
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, b.mid, "BB Mid"),
          line(inst, "up", "main", "#ef5350", candles, b.upper, "BB Up"),
          line(inst, "lo", "main", "#26a69a", candles, b.lower, "BB Low"),
        ],
        { mid: b.mid, upper: b.upper, lower: b.lower }
      );
      break;
    }
    case "keltner": {
      const k = keltner(candles, n(p, "period", 20), n(p, "mult", 1.5));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, k.mid, "KC Mid"),
          line(inst, "up", "main", "#ef5350", candles, k.upper, "KC Up"),
          line(inst, "lo", "main", "#26a69a", candles, k.lower, "KC Low"),
        ],
        { mid: k.mid, upper: k.upper, lower: k.lower }
      );
      break;
    }
    case "donchian": {
      const d = donchian(candles, n(p, "period", 20));
      push(
        [
          line(inst, "up", "main", "#26a69a", candles, d.upper, "Donch Up"),
          line(inst, "lo", "main", "#ef5350", candles, d.lower, "Donch Low"),
          line(inst, "mid", "main", "#2962ff", candles, d.mid, "Donch Mid"),
        ],
        { upper: d.upper, lower: d.lower, mid: d.mid }
      );
      break;
    }
    case "atr": {
      const period = n(p, "period", 14);
      const v = atr(candles, period);
      push([line(inst, "atr", "sub", color, candles, v, `ATR(${period})`)], { atr: v });
      break;
    }
    case "stddev": {
      const period = n(p, "period", 20);
      const v = stddev(values, period);
      push([line(inst, "sd", "sub", color, candles, v, `StdDev(${period})`)], { sd: v });
      break;
    }
    case "histVol": {
      const period = n(p, "period", 20);
      const v = histVol(values, period);
      push([line(inst, "hv", "sub", color, candles, v, `HV(${period})`)], { hv: v });
      break;
    }
    case "chaikinVol": {
      const period = n(p, "period", 10);
      const v = chaikinVol(candles, period);
      push([line(inst, "cv", "sub", color, candles, v, `Chaikin Vol(${period})`)], { cv: v });
      break;
    }
    case "vwap": {
      const v = vwap(candles);
      push([line(inst, "vwap", "main", "#e040fb", candles, v, "VWAP")], { vwap: v });
      break;
    }
    case "obv": {
      const v = obv(candles);
      push([line(inst, "obv", "sub", color, candles, v, "OBV")], { obv: v });
      break;
    }
    case "mfi": {
      const period = n(p, "period", 14);
      const v = mfi(candles, period);
      push([line(inst, "mfi", "sub", color, candles, v, `MFI(${period})`)], { mfi: v });
      break;
    }
    case "cmf": {
      const period = n(p, "period", 20);
      const v = cmf(candles, period);
      push([line(inst, "cmf", "sub", color, candles, v, `CMF(${period})`)], { cmf: v });
      break;
    }
    case "volumeOsc": {
      const v = volumeOsc(candles, n(p, "shortPeriod", 5), n(p, "longPeriod", 10));
      push([hist(inst, "vo", "sub", "#e040fb", candles, v, "Vol Osc")], { vo: v });
      break;
    }
    case "adl": {
      const v = adl(candles);
      push([line(inst, "adl", "sub", color, candles, v, "ADL")], { adl: v });
      break;
    }
    case "pivot": {
      const pv = pivotClassic(candles);
      push(
        [
          line(inst, "pp", "main", "#2962ff", candles, pv.pp, "PP"),
          line(inst, "r1", "main", "#ef5350", candles, pv.r1, "R1"),
          line(inst, "s1", "main", "#26a69a", candles, pv.s1, "S1"),
          line(inst, "r2", "main", "#ef535088", candles, pv.r2, "R2"),
          line(inst, "s2", "main", "#26a69a88", candles, pv.s2, "S2"),
        ],
        { pp: pv.pp, r1: pv.r1, s1: pv.s1, r2: pv.r2, s2: pv.s2 }
      );
      break;
    }
    case "zigzag": {
      const v = zigzag(candles, n(p, "pct", 5));
      push([line(inst, "zz", "main", color, candles, v, "ZigZag")], { zz: v });
      break;
    }
    case "highest": {
      const period = n(p, "period", 20);
      const v = highest(values, period);
      push([line(inst, "hi", "main", color, candles, v, `Highest(${period})`)], { hi: v });
      break;
    }
    case "lowest": {
      const period = n(p, "period", 20);
      const v = lowest(values, period);
      push([line(inst, "lo", "main", color, candles, v, `Lowest(${period})`)], { lo: v });
      break;
    }
    case "cumDelta": {
      const v = cumDelta(candles);
      push([line(inst, "cd", "sub", color, candles, v, "Cum Delta")], { cd: v });
      break;
    }
    default:
      break;
  }

  cache.set(inst.id, store);
  return out;
}

/** Topological compute: parents before children */
export function computeAllIndicators(
  indicators: IndicatorInstance[],
  candles: Candle[]
): PlotSeries[] {
  const cache = new Map<string, Record<string, (number | null)[]>>();
  const byId = new Map(indicators.map((i) => [i.id, i]));
  const depth = (inst: IndicatorInstance, seen = new Set<string>()): number => {
    if (!inst.source || inst.source.type !== "indicator") return 0;
    if (seen.has(inst.id)) return 0;
    seen.add(inst.id);
    const parent = byId.get(inst.source.indicatorId);
    return 1 + (parent ? depth(parent, seen) : 0);
  };
  const sorted = [...indicators].sort((a, b) => depth(a) - depth(b));
  const all: PlotSeries[] = [];
  for (const ind of sorted) {
    if (!ind.visible) continue;
    if (ind.type === "custom") continue;
    all.push(...computeBuiltin(ind, candles, cache));
  }
  return all;
}

export function formatIndicatorLabel(
  inst: IndicatorInstance,
  all: IndicatorInstance[]
): string {
  const meta = inst.type !== "custom" ? BUILTIN_META[inst.type] : null;
  const base = meta?.label ?? inst.name;
  if (inst.source?.type === "indicator") {
    const parent = all.find(
      (x) => x.id === (inst.source as { indicatorId: string }).indicatorId
    );
    const pMeta = parent && parent.type !== "custom" ? BUILTIN_META[parent.type] : null;
    const pName = pMeta
      ? `${pMeta.label}${parent?.params.period != null ? ` ${parent.params.period}` : ""}`
      : parent?.name ?? "…";
    return `${base} (${pName})`;
  }
  const period = inst.params.period;
  if (period != null) return `${base} ${period}`;
  return base;
}

// silence unused import in case tree-shaking
void seriesToLineData;
