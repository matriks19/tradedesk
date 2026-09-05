import type {
  Candle,
  BuiltinIndicatorId,
  IndicatorInstance,
  IndicatorMeta,
  IndicatorCategory,
  PriceField,
} from "@/lib/types";
import {
  acceleratorOsc,
  adl,
  adx,
  alligator,
  alma,
  aroon,
  atr,
  awesomeOsc,
  bbPercentB,
  bbWidth,
  bollinger,
  cci,
  chaikinOsc,
  chaikinVol,
  chandelier,
  cmf,
  cmo,
  connorsRsi,
  cumDelta,
  dema,
  donchian,
  dpo,
  ema,
  envelope,
  eom,
  fibChannel,
  fisher,
  forceIndex,
  fractals,
  gator,
  heikinAshiSmooth,
  highest,
  histVol,
  hull,
  ichimoku,
  keltner,
  klinger,
  kst,
  linreg,
  lowest,
  maCross,
  macd,
  massIndex,
  mcginley,
  mfi,
  momentum,
  natr,
  netVolume,
  obv,
  pivotCamarilla,
  pivotClassic,
  pivotFib,
  pivotStandard,
  pivotWoodie,
  ppo,
  priceChannel,
  priceSeries,
  psar,
  pvt,
  regChannel,
  roc,
  rsi,
  rvi,
  seriesToLineData,
  sma,
  smma,
  stddev,
  stddevBands,
  stochastic,
  stochasticSeries,
  stochRsi,
  supertrend,
  tema,
  tma,
  toLineData,
  trendStrength,
  trix,
  trueRange,
  tsi,
  ulcerIndex,
  ultimateOsc,
  vma,
  volumeOsc,
  vortex,
  vwap,
  vwma,
  wavetrend,
  williamsR,
  wma,
  zigzag,
  zlema,
} from "./math";
import {
  adaptiveJma,
  doubleJma,
  jma,
  jmaRibbon,
  jurikBollinger,
  jurikCci,
  jurikFilterBands,
  jurikKaseStoch,
  jurikKaseStochPro,
  jurikMacd,
  jurikQqe,
  jurikRsi,
  jurikRsx,
  jurikStoch,
  jurikVolty,
  kaseStoch,
  superSmoother,
  type JurikSmoothMode,
} from "./jurik";
import {
  bosChoch,
  channelDetect,
  equalHighsLows,
  fairValueGaps,
  flowTrend,
  highVolumePoints,
  liquiditySweep,
  moneyFlowComposite,
  nautilusLike,
  orderBlocks,
  premiumDiscount,
  voltixBands,
} from "./beluga";

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

const CRED_JURIK =
  "Inspired by Loxx Jurik/Kase concepts — community reconstructions, not affiliated. JMA = JMA (community).";
const CRED_BELUGA =
  "Inspired by BigBeluga SMC concepts — community reconstructions, not affiliated.";

function sel(
  key: string,
  label: string,
  def: string,
  options: { value: string; label: string }[]
) {
  return { key, label, type: "select" as const, default: def, options };
}

const SMOOTH_MODE = sel("smoothMode", "Smooth", "jma", [
  { value: "jma", label: "JMA (community)" },
  { value: "jurikLite", label: "Jurik-lite" },
  { value: "ema", label: "EMA" },
]);

export const BUILTIN_LIST: IndicatorMeta[] = [
  // —— Hareketli Ortalamalar (ma)
  { id: "sma", label: "SMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "sma", inputs: [num("period", "Period", 20), src()] },
  { id: "ema", label: "EMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "ema", inputs: [num("period", "Period", 21), src()] },
  { id: "wma", label: "WMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "wma", inputs: [num("period", "Period", 20), src()] },
  { id: "vwma", label: "VWMA", category: "ma", pane: "main", acceptsSeries: false, primarySeriesKey: "vwma", inputs: [num("period", "Period", 20)] },
  { id: "smma", label: "SMMA / RMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "smma", inputs: [num("period", "Period", 14), src()] },
  { id: "dema", label: "DEMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "dema", inputs: [num("period", "Period", 20), src()] },
  { id: "tema", label: "TEMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "tema", inputs: [num("period", "Period", 20), src()] },
  { id: "hma", label: "HMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "hma", inputs: [num("period", "Period", 20), src()] },
  { id: "alma", label: "ALMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "alma", inputs: [num("period", "Period", 9), num("offset", "Offset", 0.85, 0, 1, 0.01), num("sigma", "Sigma", 6, 0.1, 20, 0.1), src()] },
  { id: "linreg", label: "LSMA / LinReg", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "linreg", inputs: [num("period", "Period", 14), src()] },
  { id: "mcginley", label: "McGinley Dynamic", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "mcg", inputs: [num("period", "Period", 14), src()] },
  { id: "tma", label: "Triangular MA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "tma", inputs: [num("period", "Period", 20), src()] },
  { id: "vma", label: "Variable MA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "vma", inputs: [num("period", "Period", 20), src()] },
  { id: "zlema", label: "Zero Lag EMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "zlema", inputs: [num("period", "Period", 20), src()] },
  { id: "maCross", label: "MA Cross", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "fast", inputs: [num("fast", "Fast", 9), num("slow", "Slow", 21), src()] },

  // —— Bantlar / Kanallar (bands)
  { id: "bollinger", label: "Bollinger Bands", category: "bands", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "keltner", label: "Keltner Channels", category: "bands", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("mult", "Mult", 1.5, 0.5, 10, 0.1)] },
  { id: "donchian", label: "Donchian Channels", category: "bands", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", inputs: [num("period", "Period", 20)] },
  { id: "envelope", label: "Envelope", category: "bands", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("pct", "Percent", 2.5, 0.1, 50, 0.1), src()] },
  { id: "priceChannel", label: "Price Channel", category: "bands", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", inputs: [num("period", "Period", 20)] },
  { id: "stddevBands", label: "StdDev Bands", category: "bands", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "fibChannel", label: "Fibonacci Channel", category: "bands", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", inputs: [num("period", "Period", 50)] },
  { id: "regChannel", label: "Regression Channel", category: "bands", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", inputs: [num("period", "Period", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },

  // —— Momentum / Osilatörler
  { id: "rsi", label: "RSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "rsi", inputs: [num("period", "Period", 14), src()] },
  { id: "stochastic", label: "Stochastic", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "k", inputs: [num("kPeriod", "%K Period", 14), num("dPeriod", "%D Period", 3)] },
  { id: "stochRsi", label: "Stoch RSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "k", inputs: [num("rsiPeriod", "RSI Period", 14), num("stochPeriod", "Stoch Period", 14), num("kSmooth", "K Smooth", 3), num("dSmooth", "D Smooth", 3), src()] },
  { id: "macd", label: "MACD", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "macd", inputs: [num("fast", "Fast", 12), num("slow", "Slow", 26), num("signal", "Signal", 9), src()] },
  { id: "cci", label: "CCI", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "cci", inputs: [num("period", "Period", 20)] },
  { id: "roc", label: "ROC", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "roc", inputs: [num("period", "Period", 12), src()] },
  { id: "momentum", label: "Momentum", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "mom", inputs: [num("period", "Period", 10), src()] },
  { id: "williamsR", label: "Williams %R", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "wr", inputs: [num("period", "Period", 14)] },
  { id: "ultimateOsc", label: "Ultimate Oscillator", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "uo", inputs: [num("p1", "Period 1", 7), num("p2", "Period 2", 14), num("p3", "Period 3", 28)] },
  { id: "tsi", label: "TSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "tsi", inputs: [num("longPeriod", "Long", 25), num("shortPeriod", "Short", 13), num("signalPeriod", "Signal", 7), src()] },
  { id: "ppo", label: "PPO", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "ppo", inputs: [num("fast", "Fast", 12), num("slow", "Slow", 26), num("signal", "Signal", 9), src()] },
  { id: "cmo", label: "CMO", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "cmo", inputs: [num("period", "Period", 14), src()] },
  { id: "connorsRsi", label: "Connors RSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "crsi", inputs: [num("rsiPeriod", "RSI", 3), num("streakPeriod", "Streak", 2), num("pctRankPeriod", "Percent Rank", 100), src()] },
  { id: "fisher", label: "Fisher Transform", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "fisher", inputs: [num("period", "Period", 10), src()] },
  { id: "wavetrend", label: "WaveTrend", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "wt1", inputs: [num("channelLen", "Channel", 10), num("avgLen", "Average", 21)] },
  { id: "trix", label: "TRIX", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "trix", inputs: [num("period", "Period", 18), src()] },
  { id: "dpo", label: "DPO", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "dpo", inputs: [num("period", "Period", 21), src()] },
  { id: "kst", label: "Know Sure Thing", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "kst", inputs: [num("sig", "Signal", 9), src()] },
  { id: "rvi", label: "RVI", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "rvi", inputs: [num("period", "Period", 10)] },

  // —— Trend
  { id: "supertrend", label: "Supertrend", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "st", inputs: [num("period", "ATR Period", 10), num("mult", "Multiplier", 3, 0.5, 20, 0.1)] },
  { id: "psar", label: "Parabolic SAR", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "psar", inputs: [num("step", "Step", 0.02, 0.001, 0.5, 0.001), num("max", "Max", 0.2, 0.01, 1, 0.01)] },
  { id: "adx", label: "ADX / DMI", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "adx", inputs: [num("period", "Period", 14)] },
  { id: "aroon", label: "Aroon", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "osc", inputs: [num("period", "Period", 14)] },
  { id: "ichimoku", label: "Ichimoku Cloud", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "tenkan", inputs: [num("tenkan", "Tenkan", 9), num("kijun", "Kijun", 26), num("senkou", "Senkou", 52)] },
  { id: "vortex", label: "Vortex", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "vip", inputs: [num("period", "Period", 14)] },
  { id: "chandelier", label: "Chandelier Exit", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "long", inputs: [num("period", "Period", 22), num("mult", "Mult", 3, 0.5, 20, 0.1)] },
  { id: "trendStrength", label: "Trend Strength", category: "trend", pane: "sub", acceptsSeries: true, primarySeriesKey: "ts", inputs: [num("period", "Period", 20), src()] },
  { id: "heikinAshiSmooth", label: "Heikin-Ashi Smooth", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "ha", inputs: [num("period", "Period", 10)] },

  // —— Volatilite
  { id: "atr", label: "ATR", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "atr", inputs: [num("period", "Period", 14)] },
  { id: "histVol", label: "Historical Volatility", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "hv", inputs: [num("period", "Period", 20), src()] },
  { id: "chaikinVol", label: "Chaikin Volatility", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "cv", inputs: [num("period", "Period", 10)] },
  { id: "massIndex", label: "Mass Index", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "mi", inputs: [num("period", "Period", 25)] },
  { id: "ulcerIndex", label: "Ulcer Index", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "ui", inputs: [num("period", "Period", 14), src()] },
  { id: "natr", label: "Normalized ATR", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "natr", inputs: [num("period", "Period", 14)] },
  { id: "bbWidth", label: "Bollinger Width", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "width", inputs: [num("period", "Period", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "bbPercentB", label: "Bollinger %B", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "pctb", inputs: [num("period", "Period", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "trueRange", label: "True Range", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "tr", inputs: [] },
  { id: "stddev", label: "Standard Deviation", category: "volatility", pane: "sub", acceptsSeries: true, primarySeriesKey: "sd", inputs: [num("period", "Period", 20), src()] },

  // —— Hacim
  { id: "obv", label: "OBV", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "obv", inputs: [] },
  { id: "vwap", label: "VWAP", category: "volume", pane: "main", acceptsSeries: false, primarySeriesKey: "vwap", inputs: [] },
  { id: "mfi", label: "MFI", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "mfi", inputs: [num("period", "Period", 14)] },
  { id: "cmf", label: "CMF", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "cmf", inputs: [num("period", "Period", 20)] },
  { id: "adl", label: "ADL", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "adl", inputs: [] },
  { id: "chaikinOsc", label: "Chaikin Oscillator", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "cho", inputs: [num("fast", "Fast", 3), num("slow", "Slow", 10)] },
  { id: "volumeOsc", label: "Volume Oscillator", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "vo", inputs: [num("shortPeriod", "Short", 5), num("longPeriod", "Long", 10)] },
  { id: "pvt", label: "PVT", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "pvt", inputs: [] },
  { id: "eom", label: "Ease of Movement", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "eom", inputs: [num("period", "Period", 14)] },
  { id: "forceIndex", label: "Force Index", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "fi", inputs: [num("period", "Period", 13)] },
  { id: "klinger", label: "Klinger (simplified)", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "kvo", inputs: [num("fast", "Fast", 34), num("slow", "Slow", 55), num("signal", "Signal", 13)] },
  { id: "netVolume", label: "Net Volume", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "nv", inputs: [] },
  { id: "volumeDelta", label: "Volume Delta", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "vd", inputs: [] },

  // —— Bill Williams
  { id: "awesomeOsc", label: "Awesome Oscillator", category: "bill_williams", pane: "sub", acceptsSeries: false, primarySeriesKey: "ao", inputs: [] },
  { id: "acceleratorOsc", label: "Accelerator Oscillator", category: "bill_williams", pane: "sub", acceptsSeries: false, primarySeriesKey: "ac", inputs: [] },
  { id: "alligator", label: "Alligator", category: "bill_williams", pane: "main", acceptsSeries: false, primarySeriesKey: "jaw", inputs: [num("jawPeriod", "Jaw", 13), num("teethPeriod", "Teeth", 8), num("lipsPeriod", "Lips", 5)] },
  { id: "fractals", label: "Fractals", category: "bill_williams", pane: "main", acceptsSeries: false, primarySeriesKey: "up", inputs: [] },
  { id: "gator", label: "Gator Oscillator", category: "bill_williams", pane: "sub", acceptsSeries: false, primarySeriesKey: "upper", inputs: [] },

  // —— Pivot / Seviye
  { id: "pivot", label: "Pivot Classic", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "pp", inputs: [] },
  { id: "pivotStandard", label: "Pivot Points Standard", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "pp", inputs: [] },
  { id: "pivotFib", label: "Pivot Fibonacci", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "pp", inputs: [] },
  { id: "pivotCamarilla", label: "Pivot Camarilla", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "pp", inputs: [] },
  { id: "pivotWoodie", label: "Pivot Woodie", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "pp", inputs: [] },

  // —— Diğer
  { id: "highest", label: "Highest High", category: "other", pane: "main", acceptsSeries: true, primarySeriesKey: "hi", inputs: [num("period", "Period", 20), src()] },
  { id: "lowest", label: "Lowest Low", category: "other", pane: "main", acceptsSeries: true, primarySeriesKey: "lo", inputs: [num("period", "Period", 20), src()] },
  { id: "zigzag", label: "ZigZag", category: "other", pane: "main", acceptsSeries: false, primarySeriesKey: "zz", inputs: [num("pct", "Deviation %", 5, 0.5, 50, 0.5)] },
  { id: "cumDelta", label: "Cumulative Delta (legacy)", category: "other", pane: "sub", acceptsSeries: false, primarySeriesKey: "cd", inputs: [] },

  // —— Jurik / Loxx tarzı
  { id: "jma", label: "JMA (community)", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "jma", description: CRED_JURIK, inputs: [num("period", "Length", 14), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "doubleJma", label: "Double JMA", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "djma", description: CRED_JURIK, inputs: [num("period", "Length", 14), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "jmaRibbon", label: "JMA Ribbon", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "j8", description: CRED_JURIK, inputs: [num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "jurikFilterBands", label: "Jurik Filter Bands", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: CRED_JURIK, inputs: [num("period", "Length", 14), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), num("mult", "Band Mult", 1.5, 0.2, 10, 0.1), src()] },
  { id: "jurikVolty", label: "Jurik Volty (approx)", category: "jurik", pane: "sub", acceptsSeries: true, primarySeriesKey: "volty", description: CRED_JURIK, inputs: [num("period", "Length", 20), src()] },
  { id: "jurikRsi", label: "Jurik RSI", category: "jurik", pane: "sub", acceptsSeries: true, primarySeriesKey: "jrsi", description: CRED_JURIK, inputs: [num("rsiLen", "RSI Length", 14), num("jmaLen", "JMA Length", 8), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "jurikRsx", label: "Jurik RSX-style", category: "jurik", pane: "sub", acceptsSeries: true, primarySeriesKey: "rsx", description: CRED_JURIK, inputs: [num("period", "Length", 14), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "jurikMacd", label: "Jurik MACD", category: "jurik", pane: "sub", acceptsSeries: true, primarySeriesKey: "macd", description: CRED_JURIK, inputs: [num("fast", "Fast", 12), num("slow", "Slow", 26), num("signal", "Signal", 9), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "jurikCci", label: "Jurik CCI", category: "jurik", pane: "sub", acceptsSeries: false, primarySeriesKey: "cci", description: CRED_JURIK, inputs: [num("period", "Period", 20), num("jmaLen", "JMA Length", 8), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1)] },
  { id: "jurikBollinger", label: "Jurik Bollinger", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: CRED_JURIK, inputs: [num("period", "Length", 20), num("mult", "Mult", 2, 0.5, 10, 0.1), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), src()] },
  { id: "adaptiveJma", label: "Adaptive JMA", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "ajma", description: CRED_JURIK, inputs: [num("period", "Base Length", 14), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), num("atrLen", "ATR Length", 14), src()] },
  { id: "jurikQqe", label: "QQE (Jurik RSI)", category: "jurik", pane: "sub", acceptsSeries: true, primarySeriesKey: "rsi", description: CRED_JURIK, inputs: [num("rsiLen", "RSI", 14), num("jmaLen", "JMA", 8), num("smoothLen", "Smooth", 5), num("qqeFactor", "QQE Factor", 4.236, 0.5, 20, 0.001), num("phase", "Phase", 50, -100, 100, 1), src()] },
  { id: "superSmoother", label: "Ehlers SuperSmoother", category: "jurik", pane: "main", acceptsSeries: true, primarySeriesKey: "ss", description: "Ehlers 2-pole SuperSmoother helper for Jurik suite.", inputs: [num("period", "Length", 10), src()] },
  { id: "jurikStoch", label: "Jurik Stochastic", category: "jurik", pane: "sub", acceptsSeries: false, primarySeriesKey: "k", description: CRED_JURIK, inputs: [num("kLen", "%K", 14), num("dLen", "%D", 3), num("jmaLen", "JMA Length", 8), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), SMOOTH_MODE] },
  { id: "kaseStoch", label: "Kase Permission Stoch", category: "jurik", pane: "sub", acceptsSeries: false, primarySeriesKey: "k", description: CRED_JURIK, inputs: [num("cycle", "Cycle", 5), num("kLen", "%K", 8), num("dLen", "%D", 3)] },
  { id: "jurikKaseStoch", label: "Jurik Kase Stochastic", category: "jurik", pane: "sub", acceptsSeries: false, primarySeriesKey: "k", description: CRED_JURIK + " Kase permission TF + JMA smooth + bands/signal/hist.", inputs: [num("cycle", "Cycle", 5), num("kLen", "%K", 8), num("dLen", "%D", 3), num("jmaLen", "JMA Length", 5), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), num("levelLo", "Level Lo", 10, 0, 50, 1), num("levelLo2", "Level Lo2", 20, 0, 50, 1), num("levelHi2", "Level Hi2", 80, 50, 100, 1), num("levelHi", "Level Hi", 90, 50, 100, 1), SMOOTH_MODE] },
  { id: "jurikKaseStochPro", label: "Jurik Kase Stoch Pro", category: "jurik", pane: "sub", acceptsSeries: false, primarySeriesKey: "k", description: CRED_JURIK + " Dual-cycle permission + full plots.", inputs: [num("cycle", "Fast Cycle", 5), num("cycleSlow", "Slow Cycle", 10), num("kLen", "%K", 8), num("dLen", "%D", 3), num("jmaLen", "JMA Length", 5), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), num("levelLo", "Level Lo", 10, 0, 50, 1), num("levelLo2", "Level Lo2", 20, 0, 50, 1), num("levelHi2", "Level Hi2", 80, 50, 100, 1), num("levelHi", "Level Hi", 90, 50, 100, 1), SMOOTH_MODE] },

  // —— BigBeluga / SMC tarzı
  { id: "orderBlocks", label: "Order Blocks", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", description: CRED_BELUGA, inputs: [num("swing", "Swing", 3), num("impulseMult", "Impulse ATR×", 1.2, 0.5, 5, 0.1)] },
  { id: "fairValueGaps", label: "Fair Value Gaps", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "bullTop", description: CRED_BELUGA, inputs: [num("extend", "Extend Bars", 20)] },
  { id: "bosChoch", label: "BOS / CHoCH", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "bos", description: CRED_BELUGA, inputs: [num("swing", "Swing", 3)] },
  { id: "equalHighsLows", label: "Equal Highs/Lows", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "eqh", description: CRED_BELUGA, inputs: [num("swing", "Swing", 3), num("tolPct", "Tolerance %", 0.15, 0.01, 2, 0.01)] },
  { id: "premiumDiscount", label: "Premium / Discount", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "equilibrium", description: CRED_BELUGA, inputs: [num("lookback", "Lookback", 50)] },
  { id: "liquiditySweep", label: "Liquidity Sweep", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "state", description: CRED_BELUGA, inputs: [num("lookback", "Lookback", 20)] },
  { id: "nautilusLike", label: "Beluga Momentum (Nautilus-like)", category: "bigbeluga", pane: "sub", acceptsSeries: false, primarySeriesKey: "osc", description: CRED_BELUGA + " Original RSI+MFI+trend blend.", inputs: [num("period", "Length", 14), num("smooth", "Smooth", 5)] },
  { id: "voltixBands", label: "Voltix-like Bands", category: "bigbeluga", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: CRED_BELUGA, inputs: [num("period", "Length", 20), num("mult", "Mult", 1.8, 0.5, 10, 0.1), num("phase", "Phase", 50, -100, 100, 1), src()] },
  { id: "flowTrend", label: "Flow Trend", category: "bigbeluga", pane: "sub", acceptsSeries: false, primarySeriesKey: "flow", description: CRED_BELUGA, inputs: [num("period", "Length", 14)] },
  { id: "moneyFlowComposite", label: "Money Flow Composite", category: "bigbeluga", pane: "sub", acceptsSeries: false, primarySeriesKey: "flow", description: CRED_BELUGA, inputs: [num("period", "Length", 14)] },
  { id: "channelDetect", label: "Channel Detection", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", description: CRED_BELUGA, inputs: [num("period", "Length", 20)] },
  { id: "highVolumePoints", label: "High Volume Points", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "bullVol", description: CRED_BELUGA, inputs: [num("volMult", "Vol Mult", 2, 1, 10, 0.1), num("swing", "Swing", 2)] },
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
  ma: "Hareketli Ortalamalar",
  bands: "Bantlar / Kanallar",
  momentum: "Momentum / Osilatörler",
  trend: "Trend",
  volatility: "Volatilite",
  volume: "Hacim",
  bill_williams: "Bill Williams",
  levels: "Pivot / Seviye",
  jurik: "Jurik / Loxx tarzı",
  bigbeluga: "BigBeluga / SMC tarzı",
  other: "Diğer",
};

export const CATEGORY_ORDER: IndicatorCategory[] = [
  "ma",
  "bands",
  "momentum",
  "trend",
  "volatility",
  "volume",
  "bill_williams",
  "levels",
  "jurik",
  "bigbeluga",
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
    case "vwma": {
      const period = n(p, "period", 20);
      const v = vwma(candles, period);
      push([line(inst, "vwma", "main", color, candles, v, `VWMA(${period})`)], { vwma: v });
      break;
    }
    case "smma": {
      const period = n(p, "period", 14);
      const v = smma(values, period);
      push([line(inst, "smma", "main", color, candles, v, `SMMA(${period})`)], { smma: v });
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
    case "alma": {
      const period = n(p, "period", 9);
      const v = alma(values, period, n(p, "offset", 0.85), n(p, "sigma", 6));
      push([line(inst, "alma", "main", color, candles, v, `ALMA(${period})`)], { alma: v });
      break;
    }
    case "linreg": {
      const period = n(p, "period", 14);
      const v = linreg(values, period);
      push([line(inst, "linreg", "main", color, candles, v, `LSMA(${period})`)], { linreg: v });
      break;
    }
    case "mcginley": {
      const period = n(p, "period", 14);
      const v = mcginley(values, period);
      push([line(inst, "mcg", "main", color, candles, v, `McGinley(${period})`)], { mcg: v });
      break;
    }
    case "tma": {
      const period = n(p, "period", 20);
      const v = tma(values, period);
      push([line(inst, "tma", "main", color, candles, v, `TMA(${period})`)], { tma: v });
      break;
    }
    case "vma": {
      const period = n(p, "period", 20);
      const v = vma(values, period);
      push([line(inst, "vma", "main", color, candles, v, `VMA(${period})`)], { vma: v });
      break;
    }
    case "zlema": {
      const period = n(p, "period", 20);
      const v = zlema(values, period);
      push([line(inst, "zlema", "main", color, candles, v, `ZLEMA(${period})`)], { zlema: v });
      break;
    }
    case "maCross": {
      const fast = n(p, "fast", 9);
      const slow = n(p, "slow", 21);
      const m = maCross(values, fast, slow);
      push(
        [
          line(inst, "fast", "main", "#2962ff", candles, m.fast, `EMA(${fast})`),
          line(inst, "slow", "main", "#ff6d00", candles, m.slow, `EMA(${slow})`),
        ],
        { fast: m.fast, slow: m.slow }
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
    case "envelope": {
      const e = envelope(values, n(p, "period", 20), n(p, "pct", 2.5));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, e.mid, "Env Mid"),
          line(inst, "up", "main", "#ef5350", candles, e.upper, "Env Up"),
          line(inst, "lo", "main", "#26a69a", candles, e.lower, "Env Low"),
        ],
        { mid: e.mid, upper: e.upper, lower: e.lower }
      );
      break;
    }
    case "priceChannel": {
      const d = priceChannel(candles, n(p, "period", 20));
      push(
        [
          line(inst, "up", "main", "#26a69a", candles, d.upper, "PC Up"),
          line(inst, "lo", "main", "#ef5350", candles, d.lower, "PC Low"),
          line(inst, "mid", "main", "#2962ff", candles, d.mid, "PC Mid"),
        ],
        { upper: d.upper, lower: d.lower, mid: d.mid }
      );
      break;
    }
    case "stddevBands": {
      const b = stddevBands(values, n(p, "period", 20), n(p, "mult", 2));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, b.mid, "SD Mid"),
          line(inst, "up", "main", "#ef5350", candles, b.upper, "SD Up"),
          line(inst, "lo", "main", "#26a69a", candles, b.lower, "SD Low"),
        ],
        { mid: b.mid, upper: b.upper, lower: b.lower }
      );
      break;
    }
    case "fibChannel": {
      const f = fibChannel(candles, n(p, "period", 50));
      push(
        [
          line(inst, "up", "main", "#ef5350", candles, f.upper, "Fib High"),
          line(inst, "r618", "main", "#ff6d00", candles, f.r618, "Fib 0.618"),
          line(inst, "mid", "main", "#2962ff", candles, f.mid, "Fib 0.5"),
          line(inst, "r382", "main", "#00bcd4", candles, f.r382, "Fib 0.382"),
          line(inst, "lo", "main", "#26a69a", candles, f.lower, "Fib Low"),
        ],
        { upper: f.upper, mid: f.mid, lower: f.lower, r382: f.r382, r618: f.r618 }
      );
      break;
    }
    case "regChannel": {
      const r = regChannel(values, n(p, "period", 20), n(p, "mult", 2));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, r.mid, "Reg Mid"),
          line(inst, "up", "main", "#ef5350", candles, r.upper, "Reg Up"),
          line(inst, "lo", "main", "#26a69a", candles, r.lower, "Reg Low"),
        ],
        { mid: r.mid, upper: r.upper, lower: r.lower }
      );
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
    case "cmo": {
      const period = n(p, "period", 14);
      const v = cmo(values, period);
      push([line(inst, "cmo", "sub", color, candles, v, `CMO(${period})`)], { cmo: v });
      break;
    }
    case "connorsRsi": {
      const v = connorsRsi(
        values,
        n(p, "rsiPeriod", 3),
        n(p, "streakPeriod", 2),
        n(p, "pctRankPeriod", 100)
      );
      push([line(inst, "crsi", "sub", color, candles, v, "Connors RSI")], { crsi: v });
      break;
    }
    case "fisher": {
      const f = fisher(values, n(p, "period", 10));
      push(
        [
          line(inst, "fisher", "sub", "#2962ff", candles, f.fisher, "Fisher"),
          line(inst, "trigger", "sub", "#ff6d00", candles, f.trigger, "Trigger"),
        ],
        { fisher: f.fisher, trigger: f.trigger }
      );
      break;
    }
    case "wavetrend": {
      const w = wavetrend(candles, n(p, "channelLen", 10), n(p, "avgLen", 21));
      push(
        [
          line(inst, "wt1", "sub", "#2962ff", candles, w.wt1, "WT1"),
          line(inst, "wt2", "sub", "#ff6d00", candles, w.wt2, "WT2"),
        ],
        { wt1: w.wt1, wt2: w.wt2 }
      );
      break;
    }
    case "trix": {
      const period = n(p, "period", 18);
      const v = trix(values, period);
      push([line(inst, "trix", "sub", color, candles, v, `TRIX(${period})`)], { trix: v });
      break;
    }
    case "dpo": {
      const period = n(p, "period", 21);
      const v = dpo(values, period);
      push([line(inst, "dpo", "sub", color, candles, v, `DPO(${period})`)], { dpo: v });
      break;
    }
    case "kst": {
      const k = kst(values);
      push(
        [
          line(inst, "kst", "sub", "#2962ff", candles, k.kst, "KST"),
          line(inst, "sig", "sub", "#ff6d00", candles, k.signal, "Signal"),
        ],
        { kst: k.kst, signal: k.signal }
      );
      break;
    }
    case "rvi": {
      const r = rvi(candles, n(p, "period", 10));
      push(
        [
          line(inst, "rvi", "sub", "#2962ff", candles, r.rvi, "RVI"),
          line(inst, "sig", "sub", "#ff6d00", candles, r.signal, "Signal"),
        ],
        { rvi: r.rvi, signal: r.signal }
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
    case "aroon": {
      const a = aroon(candles, n(p, "period", 14));
      push(
        [
          line(inst, "up", "sub", "#26a69a", candles, a.up, "Aroon Up"),
          line(inst, "down", "sub", "#ef5350", candles, a.down, "Aroon Down"),
          line(inst, "osc", "sub", "#2962ff", candles, a.osc, "Aroon Osc"),
        ],
        { up: a.up, down: a.down, osc: a.osc }
      );
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
    case "vortex": {
      const v = vortex(candles, n(p, "period", 14));
      push(
        [
          line(inst, "vip", "sub", "#26a69a", candles, v.vip, "+VI"),
          line(inst, "vim", "sub", "#ef5350", candles, v.vim, "-VI"),
        ],
        { vip: v.vip, vim: v.vim }
      );
      break;
    }
    case "chandelier": {
      const c = chandelier(candles, n(p, "period", 22), n(p, "mult", 3));
      push(
        [
          line(inst, "long", "main", "#26a69a", candles, c.long, "CE Long"),
          line(inst, "short", "main", "#ef5350", candles, c.short, "CE Short"),
        ],
        { long: c.long, short: c.short }
      );
      break;
    }
    case "trendStrength": {
      const period = n(p, "period", 20);
      const v = trendStrength(values, period);
      push([line(inst, "ts", "sub", color, candles, v, `TrendStr(${period})`)], { ts: v });
      break;
    }
    case "heikinAshiSmooth": {
      const period = n(p, "period", 10);
      const v = heikinAshiSmooth(candles, period);
      push([line(inst, "ha", "main", color, candles, v, `HA Smooth(${period})`)], { ha: v });
      break;
    }
    case "atr": {
      const period = n(p, "period", 14);
      const v = atr(candles, period);
      push([line(inst, "atr", "sub", color, candles, v, `ATR(${period})`)], { atr: v });
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
    case "massIndex": {
      const period = n(p, "period", 25);
      const v = massIndex(candles, period);
      push([line(inst, "mi", "sub", color, candles, v, `Mass(${period})`)], { mi: v });
      break;
    }
    case "ulcerIndex": {
      const period = n(p, "period", 14);
      const v = ulcerIndex(values, period);
      push([line(inst, "ui", "sub", color, candles, v, `Ulcer(${period})`)], { ui: v });
      break;
    }
    case "natr": {
      const period = n(p, "period", 14);
      const v = natr(candles, period);
      push([line(inst, "natr", "sub", color, candles, v, `NATR(${period})`)], { natr: v });
      break;
    }
    case "bbWidth": {
      const v = bbWidth(values, n(p, "period", 20), n(p, "mult", 2));
      push([line(inst, "width", "sub", color, candles, v, "BB Width")], { width: v });
      break;
    }
    case "bbPercentB": {
      const v = bbPercentB(values, n(p, "period", 20), n(p, "mult", 2));
      push([line(inst, "pctb", "sub", color, candles, v, "BB %B")], { pctb: v });
      break;
    }
    case "trueRange": {
      const v = trueRange(candles);
      push([line(inst, "tr", "sub", color, candles, v, "True Range")], { tr: v });
      break;
    }
    case "stddev": {
      const period = n(p, "period", 20);
      const v = stddev(values, period);
      push([line(inst, "sd", "sub", color, candles, v, `StdDev(${period})`)], { sd: v });
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
    case "adl": {
      const v = adl(candles);
      push([line(inst, "adl", "sub", color, candles, v, "ADL")], { adl: v });
      break;
    }
    case "chaikinOsc": {
      const v = chaikinOsc(candles, n(p, "fast", 3), n(p, "slow", 10));
      push([hist(inst, "cho", "sub", color, candles, v, "Chaikin Osc")], { cho: v });
      break;
    }
    case "volumeOsc": {
      const v = volumeOsc(candles, n(p, "shortPeriod", 5), n(p, "longPeriod", 10));
      push([hist(inst, "vo", "sub", "#e040fb", candles, v, "Vol Osc")], { vo: v });
      break;
    }
    case "pvt": {
      const v = pvt(candles);
      push([line(inst, "pvt", "sub", color, candles, v, "PVT")], { pvt: v });
      break;
    }
    case "eom": {
      const period = n(p, "period", 14);
      const v = eom(candles, period);
      push([line(inst, "eom", "sub", color, candles, v, `EOM(${period})`)], { eom: v });
      break;
    }
    case "forceIndex": {
      const period = n(p, "period", 13);
      const v = forceIndex(candles, period);
      push([hist(inst, "fi", "sub", color, candles, v, `FI(${period})`)], { fi: v });
      break;
    }
    case "klinger": {
      const k = klinger(candles, n(p, "fast", 34), n(p, "slow", 55), n(p, "signal", 13));
      push(
        [
          line(inst, "kvo", "sub", "#2962ff", candles, k.kvo, "KVO"),
          line(inst, "sig", "sub", "#ff6d00", candles, k.signal, "Signal"),
        ],
        { kvo: k.kvo, signal: k.signal }
      );
      break;
    }
    case "netVolume": {
      const v = netVolume(candles);
      push([hist(inst, "nv", "sub", color, candles, v, "Net Volume")], { nv: v });
      break;
    }
    case "volumeDelta": {
      const v = cumDelta(candles);
      push([line(inst, "vd", "sub", color, candles, v, "Volume Delta")], { vd: v });
      break;
    }
    case "awesomeOsc": {
      const v = awesomeOsc(candles);
      push([hist(inst, "ao", "sub", color, candles, v, "AO")], { ao: v });
      break;
    }
    case "acceleratorOsc": {
      const v = acceleratorOsc(candles);
      push([hist(inst, "ac", "sub", color, candles, v, "AC")], { ac: v });
      break;
    }
    case "alligator": {
      const a = alligator(
        candles,
        n(p, "jawPeriod", 13),
        n(p, "teethPeriod", 8),
        n(p, "lipsPeriod", 5)
      );
      push(
        [
          line(inst, "jaw", "main", "#2962ff", candles, a.jaw, "Jaw"),
          line(inst, "teeth", "main", "#ef5350", candles, a.teeth, "Teeth"),
          line(inst, "lips", "main", "#26a69a", candles, a.lips, "Lips"),
        ],
        { jaw: a.jaw, teeth: a.teeth, lips: a.lips }
      );
      break;
    }
    case "fractals": {
      const f = fractals(candles);
      push(
        [
          line(inst, "up", "main", "#26a69a", candles, f.up, "Fractal Up"),
          line(inst, "down", "main", "#ef5350", candles, f.down, "Fractal Down"),
        ],
        { up: f.up, down: f.down }
      );
      break;
    }
    case "gator": {
      const g = gator(candles);
      push(
        [
          hist(inst, "upper", "sub", "#26a69a", candles, g.upper, "Gator Up"),
          hist(inst, "lower", "sub", "#ef5350", candles, g.lower, "Gator Down"),
        ],
        { upper: g.upper, lower: g.lower }
      );
      break;
    }
    case "pivot":
    case "pivotStandard": {
      const pv = inst.type === "pivotStandard" ? pivotStandard(candles) : pivotClassic(candles);
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
    case "pivotFib": {
      const pv = pivotFib(candles);
      push(
        [
          line(inst, "pp", "main", "#2962ff", candles, pv.pp, "PP"),
          line(inst, "r1", "main", "#ef5350", candles, pv.r1, "R1"),
          line(inst, "s1", "main", "#26a69a", candles, pv.s1, "S1"),
          line(inst, "r2", "main", "#ef5350", candles, pv.r2, "R2"),
          line(inst, "s2", "main", "#26a69a", candles, pv.s2, "S2"),
          line(inst, "r3", "main", "#ef535088", candles, pv.r3, "R3"),
          line(inst, "s3", "main", "#26a69a88", candles, pv.s3, "S3"),
        ],
        { pp: pv.pp, r1: pv.r1, s1: pv.s1, r2: pv.r2, s2: pv.s2, r3: pv.r3, s3: pv.s3 }
      );
      break;
    }
    case "pivotCamarilla": {
      const pv = pivotCamarilla(candles);
      push(
        [
          line(inst, "pp", "main", "#2962ff", candles, pv.pp, "PP"),
          line(inst, "r1", "main", "#ef5350", candles, pv.r1, "R1"),
          line(inst, "s1", "main", "#26a69a", candles, pv.s1, "S1"),
          line(inst, "r2", "main", "#ef5350", candles, pv.r2, "R2"),
          line(inst, "s2", "main", "#26a69a", candles, pv.s2, "S2"),
          line(inst, "r3", "main", "#ef535088", candles, pv.r3, "R3"),
          line(inst, "s3", "main", "#26a69a88", candles, pv.s3, "S3"),
        ],
        { pp: pv.pp, r1: pv.r1, s1: pv.s1, r2: pv.r2, s2: pv.s2, r3: pv.r3, s3: pv.s3 }
      );
      break;
    }
    case "pivotWoodie": {
      const pv = pivotWoodie(candles);
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
    case "jma": {
      const period = n(p, "period", 14);
      const v = jma(values, period, n(p, "phase", 50), n(p, "power", 2));
      push([line(inst, "jma", "main", color, candles, v, `JMA(${period})`)], { jma: v });
      break;
    }
    case "doubleJma": {
      const period = n(p, "period", 14);
      const v = doubleJma(values, period, n(p, "phase", 50), n(p, "power", 2));
      push([line(inst, "djma", "main", color, candles, v, `DJMA(${period})`)], { djma: v });
      break;
    }
    case "jmaRibbon": {
      const phase = n(p, "phase", 50);
      const power = n(p, "power", 2);
      const lens = [8, 13, 21, 34, 55];
      const cols = ["#26a69a", "#66bb6a", "#ffeb3b", "#ff6d00", "#ef5350"];
      const ribs = jmaRibbon(values, lens, phase, power);
      const plots = ribs.map((v, i) =>
        line(inst, `j${lens[i]}`, "main", cols[i], candles, v, `JMA${lens[i]}`)
      );
      const storeMap: Record<string, (number | null)[]> = {};
      ribs.forEach((v, i) => {
        storeMap[`j${lens[i]}`] = v;
      });
      push(plots, storeMap);
      break;
    }
    case "jurikFilterBands": {
      const b = jurikFilterBands(
        candles,
        values,
        n(p, "period", 14),
        n(p, "phase", 50),
        n(p, "power", 2),
        n(p, "mult", 1.5)
      );
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, b.mid, "JF Mid"),
          line(inst, "up", "main", "#ef5350", candles, b.upper, "JF Up"),
          line(inst, "lo", "main", "#26a69a", candles, b.lower, "JF Low"),
        ],
        { mid: b.mid, upper: b.upper, lower: b.lower, volty: b.volty }
      );
      break;
    }
    case "jurikVolty": {
      const period = n(p, "period", 20);
      const v = jurikVolty(values, period);
      push([line(inst, "volty", "sub", color, candles, v, `Volty(${period})`)], { volty: v });
      break;
    }
    case "jurikRsi": {
      const v = jurikRsi(
        values,
        n(p, "rsiLen", 14),
        n(p, "jmaLen", 8),
        n(p, "phase", 50),
        n(p, "power", 2)
      );
      push([line(inst, "jrsi", "sub", color, candles, v, "Jurik RSI")], { jrsi: v });
      break;
    }
    case "jurikRsx": {
      const v = jurikRsx(values, n(p, "period", 14), n(p, "phase", 50), n(p, "power", 2));
      push([line(inst, "rsx", "sub", color, candles, v, "RSX")], { rsx: v });
      break;
    }
    case "jurikMacd": {
      const m = jurikMacd(
        values,
        n(p, "fast", 12),
        n(p, "slow", 26),
        n(p, "signal", 9),
        n(p, "phase", 50),
        n(p, "power", 2)
      );
      push(
        [
          line(inst, "macd", "sub", "#2962ff", candles, m.macd, "J-MACD"),
          line(inst, "sig", "sub", "#ff6d00", candles, m.signal, "Signal"),
          hist(inst, "hist", "sub", "#26a69a", candles, m.hist, "Hist"),
        ],
        { macd: m.macd, signal: m.signal, hist: m.hist }
      );
      break;
    }
    case "jurikCci": {
      const v = jurikCci(
        candles,
        n(p, "period", 20),
        n(p, "jmaLen", 8),
        n(p, "phase", 50),
        n(p, "power", 2)
      );
      push([line(inst, "cci", "sub", color, candles, v, "Jurik CCI")], { cci: v });
      break;
    }
    case "jurikBollinger": {
      const b = jurikBollinger(
        values,
        n(p, "period", 20),
        n(p, "mult", 2),
        n(p, "phase", 50),
        n(p, "power", 2)
      );
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, b.mid, "JB Mid"),
          line(inst, "up", "main", "#ef5350", candles, b.upper, "JB Up"),
          line(inst, "lo", "main", "#26a69a", candles, b.lower, "JB Low"),
        ],
        { mid: b.mid, upper: b.upper, lower: b.lower }
      );
      break;
    }
    case "adaptiveJma": {
      const v = adaptiveJma(
        candles,
        values,
        n(p, "period", 14),
        n(p, "phase", 50),
        n(p, "power", 2),
        n(p, "atrLen", 14)
      );
      push([line(inst, "ajma", "main", color, candles, v, "Adaptive JMA")], { ajma: v });
      break;
    }
    case "jurikQqe": {
      const q = jurikQqe(
        values,
        n(p, "rsiLen", 14),
        n(p, "jmaLen", 8),
        n(p, "smoothLen", 5),
        n(p, "qqeFactor", 4.236),
        n(p, "phase", 50),
        2
      );
      push(
        [
          line(inst, "rsi", "sub", "#2962ff", candles, q.rsi, "J-RSI"),
          line(inst, "trail", "sub", "#ff6d00", candles, q.trail, "Trail"),
          line(inst, "up", "sub", "#ef535088", candles, q.upper, "QQE Up"),
          line(inst, "lo", "sub", "#26a69a88", candles, q.lower, "QQE Low"),
        ],
        { rsi: q.rsi, trail: q.trail, upper: q.upper, lower: q.lower }
      );
      break;
    }
    case "superSmoother": {
      const period = n(p, "period", 10);
      const v = superSmoother(values, period);
      push([line(inst, "ss", "main", color, candles, v, `SS(${period})`)], { ss: v });
      break;
    }
    case "jurikStoch": {
      const mode = String(p.smoothMode || "jma") as JurikSmoothMode;
      const s = jurikStoch(
        candles,
        n(p, "kLen", 14),
        n(p, "dLen", 3),
        n(p, "jmaLen", 8),
        n(p, "phase", 50),
        n(p, "power", 2),
        mode
      );
      push(
        [
          line(inst, "k", "sub", "#2962ff", candles, s.k, "%K"),
          line(inst, "d", "sub", "#ff6d00", candles, s.d, "%D"),
          line(inst, "sig", "sub", "#e040fb", candles, s.signal, "Signal"),
        ],
        { k: s.k, d: s.d, signal: s.signal }
      );
      break;
    }
    case "kaseStoch": {
      const s = kaseStoch(candles, n(p, "cycle", 5), n(p, "kLen", 8), n(p, "dLen", 3));
      push(
        [
          line(inst, "k", "sub", "#2962ff", candles, s.k, "Kase %K"),
          line(inst, "d", "sub", "#ff6d00", candles, s.d, "Kase %D"),
        ],
        { k: s.k, d: s.d }
      );
      break;
    }
    case "jurikKaseStoch":
    case "jurikKaseStochPro": {
      const mode = String(p.smoothMode || "jma") as JurikSmoothMode;
      const pro = inst.type === "jurikKaseStochPro";
      const s = (pro ? jurikKaseStochPro : jurikKaseStoch)(candles, {
        cycle: n(p, "cycle", 5),
        cycleSlow: n(p, "cycleSlow", 10),
        kLen: n(p, "kLen", 8),
        dLen: n(p, "dLen", 3),
        jmaLen: n(p, "jmaLen", 5),
        phase: n(p, "phase", 50),
        power: n(p, "power", 2),
        smoothMode: mode,
        levelLo: n(p, "levelLo", 10),
        levelLo2: n(p, "levelLo2", 20),
        levelHi2: n(p, "levelHi2", 80),
        levelHi: n(p, "levelHi", 90),
        dualCycle: pro,
      });
      const plots: PlotSeries[] = [
        line(inst, "k", "sub", "#2962ff", candles, s.k, "JKS %K"),
        line(inst, "d", "sub", "#ff6d00", candles, s.d, "%D"),
        line(inst, "sig", "sub", "#e040fb", candles, s.signal, "Signal"),
        hist(inst, "hist", "sub", "#26a69a", candles, s.hist, "Hist"),
        line(inst, "lo", "sub", "#78909c55", candles, s.levelLo, "L10"),
        line(inst, "lo2", "sub", "#78909c88", candles, s.levelLo2, "L20"),
        line(inst, "hi2", "sub", "#78909c88", candles, s.levelHi2, "L80"),
        line(inst, "hi", "sub", "#78909c55", candles, s.levelHi, "L90"),
        line(inst, "bull", "sub", "#26a69a", candles, s.bullMark, "Bull"),
        line(inst, "bear", "sub", "#ef5350", candles, s.bearMark, "Bear"),
        line(inst, "state", "sub", "#ffeb3b88", candles, s.state, "State"),
      ];
      const storeMap: Record<string, (number | null)[]> = {
        k: s.k,
        d: s.d,
        signal: s.signal,
        hist: s.hist,
        state: s.state,
      };
      if (s.kSlow) {
        plots.push(line(inst, "kSlow", "sub", "#00bcd4", candles, s.kSlow, "Slow %K"));
        storeMap.kSlow = s.kSlow;
      }
      push(plots, storeMap);
      break;
    }
    case "orderBlocks": {
      const o = orderBlocks(candles, n(p, "swing", 3), n(p, "impulseMult", 1.2));
      push(
        [
          line(inst, "bullTop", "main", "#26a69a", candles, o.bullTop, "Bull OB Top"),
          line(inst, "bullBot", "main", "#26a69a88", candles, o.bullBot, "Bull OB Bot"),
          line(inst, "bearTop", "main", "#ef5350", candles, o.bearTop, "Bear OB Top"),
          line(inst, "bearBot", "main", "#ef535088", candles, o.bearBot, "Bear OB Bot"),
          line(inst, "mid", "main", "#8b95a8", candles, o.mid, "OB Mid"),
        ],
        { bullTop: o.bullTop, bullBot: o.bullBot, bearTop: o.bearTop, bearBot: o.bearBot, mid: o.mid }
      );
      break;
    }
    case "fairValueGaps": {
      const f = fairValueGaps(candles, n(p, "extend", 20));
      push(
        [
          line(inst, "bullTop", "main", "#26a69a", candles, f.bullTop, "FVG Bull Top"),
          line(inst, "bullBot", "main", "#26a69a88", candles, f.bullBot, "FVG Bull Bot"),
          line(inst, "bearTop", "main", "#ef5350", candles, f.bearTop, "FVG Bear Top"),
          line(inst, "bearBot", "main", "#ef535088", candles, f.bearBot, "FVG Bear Bot"),
        ],
        { bullTop: f.bullTop, bullBot: f.bullBot, bearTop: f.bearTop, bearBot: f.bearBot }
      );
      break;
    }
    case "bosChoch": {
      const b = bosChoch(candles, n(p, "swing", 3));
      push(
        [
          line(inst, "bos", "main", "#26a69a", candles, b.bos, "BOS"),
          line(inst, "choch", "main", "#ab47bc", candles, b.choch, "CHoCH"),
          line(inst, "bias", "main", "#ffeb3b55", candles, b.bias, "Bias"),
        ],
        { bos: b.bos, choch: b.choch, bias: b.bias }
      );
      break;
    }
    case "equalHighsLows": {
      const e = equalHighsLows(candles, n(p, "swing", 3), n(p, "tolPct", 0.15));
      push(
        [
          line(inst, "eqh", "main", "#ffa726", candles, e.eqh, "EQH"),
          line(inst, "eql", "main", "#29b6f6", candles, e.eql, "EQL"),
        ],
        { eqh: e.eqh, eql: e.eql }
      );
      break;
    }
    case "premiumDiscount": {
      const pd = premiumDiscount(candles, n(p, "lookback", 50));
      push(
        [
          line(inst, "high", "main", "#ef535088", candles, pd.high, "Range High"),
          line(inst, "premium", "main", "#ef5350", candles, pd.premium, "Premium"),
          line(inst, "equilibrium", "main", "#2962ff", candles, pd.equilibrium, "EQ"),
          line(inst, "discount", "main", "#26a69a", candles, pd.discount, "Discount"),
          line(inst, "low", "main", "#26a69a88", candles, pd.low, "Range Low"),
        ],
        {
          high: pd.high,
          premium: pd.premium,
          equilibrium: pd.equilibrium,
          discount: pd.discount,
          low: pd.low,
        }
      );
      break;
    }
    case "liquiditySweep": {
      const ls = liquiditySweep(candles, n(p, "lookback", 20));
      push(
        [
          line(inst, "swH", "main", "#ef5350", candles, ls.sweepHigh, "Sweep High"),
          line(inst, "swL", "main", "#26a69a", candles, ls.sweepLow, "Sweep Low"),
          line(inst, "state", "main", "#ffeb3b88", candles, ls.state, "State"),
        ],
        { sweepHigh: ls.sweepHigh, sweepLow: ls.sweepLow, state: ls.state }
      );
      break;
    }
    case "nautilusLike": {
      const nm = nautilusLike(candles, n(p, "period", 14), n(p, "smooth", 5));
      push(
        [
          line(inst, "osc", "sub", "#2962ff", candles, nm.osc, "Beluga Mom"),
          line(inst, "sig", "sub", "#ff6d00", candles, nm.signal, "Signal"),
          line(inst, "up", "sub", "#ef535055", candles, nm.upperEx, "Exh Up"),
          line(inst, "lo", "sub", "#26a69a55", candles, nm.lowerEx, "Exh Low"),
          line(inst, "mid", "sub", "#8b95a855", candles, nm.mid, "Mid"),
        ],
        { osc: nm.osc, signal: nm.signal, mid: nm.mid }
      );
      break;
    }
    case "voltixBands": {
      // use resolved values via jma path inside helper — pass candles; length from params
      const vb = voltixBands(candles, n(p, "period", 20), n(p, "mult", 1.8), n(p, "phase", 50));
      // if series source, rebuild mid around values
      const mid =
        inst.source?.type === "indicator"
          ? jma(values, n(p, "period", 20), n(p, "phase", 50), 2)
          : vb.mid;
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, mid, "Voltix Mid"),
          line(inst, "up", "main", "#ef5350", candles, vb.upper, "Voltix Up"),
          line(inst, "lo", "main", "#26a69a", candles, vb.lower, "Voltix Low"),
          line(inst, "up2", "main", "#ef535055", candles, vb.upper2, "Voltix Up2"),
          line(inst, "lo2", "main", "#26a69a55", candles, vb.lower2, "Voltix Low2"),
        ],
        { mid, upper: vb.upper, lower: vb.lower, upper2: vb.upper2, lower2: vb.lower2 }
      );
      break;
    }
    case "flowTrend": {
      const f = flowTrend(candles, n(p, "period", 14));
      push(
        [
          line(inst, "flow", "sub", "#2962ff", candles, f.flow, "Flow"),
          line(inst, "sig", "sub", "#ff6d00", candles, f.signal, "Signal"),
          hist(inst, "hist", "sub", "#26a69a", candles, f.hist, "Hist"),
        ],
        { flow: f.flow, signal: f.signal, hist: f.hist }
      );
      break;
    }
    case "moneyFlowComposite": {
      const m = moneyFlowComposite(candles, n(p, "period", 14));
      push(
        [
          line(inst, "flow", "sub", "#2962ff", candles, m.flow, "MF Comp"),
          line(inst, "sig", "sub", "#ff6d00", candles, m.signal, "Signal"),
          line(inst, "mfi", "sub", "#00bcd488", candles, m.mfiLine, "MFI"),
        ],
        { flow: m.flow, signal: m.signal, mfi: m.mfiLine, cmf: m.cmfLine }
      );
      break;
    }
    case "channelDetect": {
      const c = channelDetect(candles, n(p, "period", 20));
      push(
        [
          line(inst, "up", "main", "#26a69a", candles, c.upper, "Chan Up"),
          line(inst, "lo", "main", "#ef5350", candles, c.lower, "Chan Low"),
          line(inst, "mid", "main", "#2962ff", candles, c.mid, "Chan Mid"),
          line(inst, "reg", "main", "#e040fb", candles, c.reg, "Reg"),
        ],
        { upper: c.upper, lower: c.lower, mid: c.mid, reg: c.reg, width: c.width }
      );
      break;
    }
    case "highVolumePoints": {
      const hv = highVolumePoints(candles, n(p, "volMult", 2), n(p, "swing", 2));
      push(
        [
          line(inst, "bullVol", "main", "#26a69a", candles, hv.bullVol, "HV Bull"),
          line(inst, "bearVol", "main", "#ef5350", candles, hv.bearVol, "HV Bear"),
        ],
        { bullVol: hv.bullVol, bearVol: hv.bearVol, volMa: hv.volMa }
      );
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

void seriesToLineData;
