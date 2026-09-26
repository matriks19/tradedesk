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
  qTrend,
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
  smi,
  coppock,
  vidya,
  frama,
  squeezeMomentum,
  softTrend,
  vfi,
  waddahAttar,
  halfTrend,
  sslChannel,
  rangeFilter,
  choppiness,
  bop,
  elderRay,
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
import {
  adaptiveMacd,
  adaptiveSupertrend,
  adaptiveTrendChannel,
  asymVolEnvelope,
  coralTrend,
  elderImpulse,
  fibGravityClusters,
  initialBalance,
  laguerreRsi,
  nadarayaWatson,
  pacLiteStructure,
  prtDmiPack,
  qualityTrendTrail,
  rsiBbCombo,
  schaffTrendCycle,
  selfAwareTrail,
  sweepReversalMap,
  varWeightedRegression,
} from "./proreal";
import { adxPumpRadar } from "./adxPump";
import { eliziEdge } from "./eliziEdge";
import { macdEliziHybrid } from "./macdEliziHybrid";
import {
  rollingMedian,
  madBands,
  medianChannel,
  pliChannel,
  pliDeltaHybrid,
} from "./median";
import { computeIfvgSeries, computeIfvgRsi, computeIfvgSmi, computeIfvgJurikStoch } from "./ifvg";
import { computeMavkIndicator, computeRSquaredIndicator } from "./mavk";
import { rsiBreakMarkerSeries } from "@/lib/scanner/rsiScan";
import { macdCrossMarkerSeries } from "@/lib/scanner/macdScan";
import { eliziCrossMarkerSeries } from "@/lib/scanner/eliziScan";
import { computeRsiPuNu } from "./rsiPuNu";
import {
  computeDescendingBreak,
  computeDescendingBreakV2,
} from "./descendingBreak";
import { diagonalSr as computeDiagonalSr } from "./diagonalSr";
import { hamJurikTpo } from "./hamJurikTpo";
import { hamAoJrmaZ } from "./hamAoJrmaZ";
import { aohamJrmaEngine } from "./aohamJrmaEngine";
import { goldKeko } from "./goldKeko";
import { doktorHull as computeDoktorHull } from "./doktorHull";
import { multiDipBb as computeMultiDipBb } from "./multiDipBb";
import { bbDivLg as computeBbDivLg } from "./bbDivLg";
import { maSimple as computeMaSimple } from "./maSimple";
import { kijunBb as computeKijunBb } from "./kijunBb";
import {
  pdoSeries as computePdoSeries,
  pdoPatternScan as computePdoPatterns,
  pdoCrossEvents,
  pdoSeparatedBandAt,
  pdoZone as pdoZoneOf,
  candlesToK as pdoCandlesToK,
  resolvePdoOpts,
  refBoll as pdoRefBoll,
  toNullable as pdoToNullable,
  type PdoPatternEvent,
} from "./pdo";

export type PlotMarker = {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text: string;
};

export interface PlotSeries {
  id: string;
  pane: "main" | "sub";
  type: "line" | "histogram";
  color: string;
  /** Prefer one point per candle; omit `value` for LWC whitespace (keeps time indices synced). */
  data: ({ time: number; value: number; color?: string } | { time: number })[];
  title?: string;
  /** Key used when nesting (primary series) */
  seriesKey?: string;
  /** Root sub-indicator instance id — each distinct group gets its own chart panel */
  paneGroup?: string;
  /** Owning indicator instance id */
  indicatorId?: string;
  /** Lightweight-charts series markers (AL/SAT etc.) */
  markers?: PlotMarker[];
  /** Histogram taban değeri (LWC `base`, örn. PDO P/D çubukları 50'den) */
  base?: number;
  /** Çizgi kalınlığı (varsayılan 2) */
  lineWidth?: 1 | 2 | 3 | 4;
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
const CRED_PROREAL =
  "Inspired by ProRealCode / community themes — conceptual reimplementations, not affiliated; no ProBuilder verbatim.";

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
  { id: "vidya", label: "VIDYA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "vidya", inputs: [num("period", "Period", 14), src()] },
  { id: "frama", label: "FRAMA", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "frama", inputs: [num("period", "Period", 16), src()] },
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
  { id: "rsiLevelBreaks", label: "RSI Kırılım (30/50/70)", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "rsi", description: "RSI + 30/50/70 yatay seviyeler + kırılım işaretleri. Osilatör→RSI tarama ile aynı mantık (detectRsiBreaks).", inputs: [num("period", "Periyot", 14), num("lvl30", "Seviye 1", 30, 1, 99, 1), num("lvl50", "Seviye 2", 50, 1, 99, 1), num("lvl70", "Seviye 3", 70, 1, 99, 1), num("showMarkers", "İşaretler", 1, 0, 1, 1), src()] },
  { id: "rsiPuNu", label: "RSI PU/NU (diverjans)", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "rsi", description: "Pine RSI regular diverjans: PU (fiyat LL + RSI HL), NU (fiyat HH + RSI LH). Pivot lbL/lbR + range. Tarama: rsiPuNu filtresi.", inputs: [num("rsiLen", "RSI Periyot", 14), num("lbL", "Pivot Sol", 15), num("lbR", "Pivot Sağ", 2), num("rangeLower", "Range Alt", 15), num("rangeUpper", "Range Üst", 60), num("showMarkers", "PU/NU işaretleri", 1, 0, 1, 1)] },
  { id: "stochastic", label: "Stochastic", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "k", inputs: [num("kPeriod", "%K Period", 14), num("dPeriod", "%D Period", 3)] },
  { id: "stochRsi", label: "Stoch RSI", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "k", inputs: [num("rsiPeriod", "RSI Period", 14), num("stochPeriod", "Stoch Period", 14), num("kSmooth", "K Smooth", 3), num("dSmooth", "D Smooth", 3), src()] },
  { id: "macd", label: "MACD (kesişim işaretli)", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "macd", description: "MACD + sinyal + hist + AL/SAT kesişim işaretleri. Osilatör→MACD tarama ile aynı mantık (detectMacdCross).", inputs: [num("fast", "Fast", 12), num("slow", "Slow", 26), num("signal", "Signal", 9), num("showMarkers", "Kesişim işaretleri", 1, 0, 1, 1), src()] },
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
  { id: "smi", label: "SMI (Stokastik Momentum)", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "smi", inputs: [num("qLength", "Q Length", 14), num("rLength", "R Length", 20), num("signal", "Signal", 5)] },
  { id: "coppock", label: "Coppock Curve", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "coppock", inputs: [num("rocLong", "ROC Long", 14), num("rocShort", "ROC Short", 11), num("wmaPeriod", "WMA", 10), src()] },
  { id: "squeezeMomentum", label: "Squeeze Momentum", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "mom", inputs: [num("length", "Length", 20), num("bbMult", "BB Mult", 2, 0.5, 10, 0.1), num("kcMult", "KC Mult", 1.5, 0.5, 10, 0.1)] },
  { id: "waddahAttar", label: "Waddah Attar Explosion", category: "momentum", pane: "sub", acceptsSeries: true, primarySeriesKey: "up", inputs: [num("fast", "Fast EMA", 20), num("slow", "Slow EMA", 40), num("bbPeriod", "BB Period", 20), num("bbMult", "BB Mult", 2, 0.5, 10, 0.1), num("sensitivity", "Sensitivity", 150, 1, 500, 1), src()] },
  { id: "bop", label: "Balance of Power", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "bop", inputs: [num("smooth", "Smooth", 14)] },
  { id: "elderRay", label: "Elder Ray", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "bull", inputs: [num("period", "EMA Period", 13)] },

  // —— Trend
  { id: "supertrend", label: "Supertrend", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "st", inputs: [num("period", "ATR Period", 10), num("mult", "Multiplier", 3, 0.5, 20, 0.1)] },
  { id: "psar", label: "Parabolic SAR", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "psar", inputs: [num("step", "Step", 0.02, 0.001, 0.5, 0.001), num("max", "Max", 0.2, 0.01, 1, 0.01)] },
  { id: "adx", label: "ADX / DMI", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "adx", inputs: [num("period", "Period", 14)] },
  { id: "adxPumpRadar", label: "ADX Pump Radar (Saf/CCI/Medyan/Mom)", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "osc", description: "4 ADX + Bollinger + karışım DI: Saf ADX | ADX×CCI | ADX×Medyan | ADX×Momentum; plusDIMix/minusDIMix. Early: Mom-ADX+CCI+%B; Mid: karışım DI; Confirm: Saf/Medyan ≥25.", inputs: [num("adxPeriod", "ADX Period", 14), num("fastSmooth", "Hızlı DX Smooth", 3), num("medianLen", "Medyan Uzunluk", 5), num("momPeriod", "Mom/ROC", 7), num("cciPeriod", "CCI Period", 10), num("bbPeriod", "BB Period", 20), num("bbMult", "BB Mult", 2, 0.5, 10, 0.1), num("smoothLen", "Osc Smooth", 3), num("adxConfirm", "ADX Onay", 25), num("adxWake", "ADX Uyanış", 15)] },
  { id: "aroon", label: "Aroon", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "osc", inputs: [num("period", "Period", 14)] },
  { id: "ichimoku", label: "Ichimoku Cloud", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "tenkan", inputs: [num("tenkan", "Tenkan", 9), num("kijun", "Kijun", 26), num("senkou", "Senkou", 52)] },
  { id: "vortex", label: "Vortex", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "vip", inputs: [num("period", "Period", 14)] },
  { id: "chandelier", label: "Chandelier Exit", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "long", inputs: [num("period", "Period", 22), num("mult", "Mult", 3, 0.5, 20, 0.1)] },
  { id: "trendStrength", label: "Trend Strength", category: "trend", pane: "sub", acceptsSeries: true, primarySeriesKey: "ts", inputs: [num("period", "Period", 20), src()] },
  { id: "heikinAshiSmooth", label: "Heikin-Ashi Smooth", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "ha", inputs: [num("period", "Period", 10)] },
  { id: "softTrend", label: "SoftTrend", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "line", inputs: [num("period", "EMA Period", 20), num("atrPeriod", "ATR Period", 14), num("mult", "ATR Mult", 1.5, 0.5, 10, 0.1)] },
  { id: "descendingBreak", label: "Düşen Kırılımı", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "trend", description: "İki alçalan pivot high trend çizgisi; close üstüne kırılım (Break Out). İsteğe bağlı S/R pivot kutuları. Tarama: descendingBreak ≤2 bar.", inputs: [num("lookback", "Pivot Lookback", 20), num("srBoxes", "S/R Kutuları", 1, 0, 1, 1), num("showMarkers", "Break Out işaretleri", 1, 0, 1, 1)] },
  { id: "diagonalSr", label: "Diyagonal S/R", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "support", description: "pikusov: asimetrik window-pivot (x2=int(x1/2)), kesişmemiş diyagonal fan + temas ikili/üçlü. Diag tüm çizgileri koyar. Tarama ≤2 bar.", inputs: [num("pivotWindow", "Pivot pencere", 6, 2, 40, 1), num("historyBars", "Lookback", 300, 50, 2000, 10), num("left", "Temas sol", 30), num("right", "Temas sağ", 30), num("showMarkers", "İşaretler (son 2 bar)", 0, 0, 1, 1)] },
  { id: "descendingBreakV2", label: "Düşen Kırılımı v2", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "ema5", description: "Pine v2 multi-şart AL: EMA5>20>50, VWMA, RSI 50–75, CCI>90, Ichimoku SpanA>B, Aroon, hacim×1.3 + cooldown. Tarama: descendingBreakV2.", inputs: [num("cooldownBars", "Cooldown-down", 10), num("showMarkers", "AL işaretleri", 1, 0, 1, 1)] },
  { id: "halfTrend", label: "HalfTrend", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "ht", inputs: [num("amplitude", "Amplitude", 2), num("channelDeviation", "Channel Dev", 2, 0.5, 10, 0.1), num("atrPeriod", "ATR Period", 100)] },
  { id: "sslChannel", label: "SSL Channel", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "sslUp", inputs: [num("period", "Period", 10)] },
  { id: "rangeFilter", label: "Range Filter", category: "trend", pane: "main", acceptsSeries: true, primarySeriesKey: "filter", inputs: [num("period", "Period", 20), num("mult", "Mult", 2.5, 0.1, 20, 0.1), src()] },

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
  { id: "choppiness", label: "Choppiness Index", category: "volatility", pane: "sub", acceptsSeries: false, primarySeriesKey: "chop", inputs: [num("period", "Period", 14)] },

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
  { id: "vfi", label: "VFI (Volume Flow)", category: "volume", pane: "sub", acceptsSeries: false, primarySeriesKey: "vfi", inputs: [num("period", "Period", 130), num("coef", "Coef", 0.2, 0.01, 5, 0.01), num("vcoef", "Vol Coef", 2.5, 0.5, 10, 0.1), num("signal", "Signal", 5)] },

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
  { id: "jurikKaseStoch", label: "Jurik Kase Stochastic", category: "jurik", pane: "sub", acceptsSeries: false, primarySeriesKey: "k", description: CRED_JURIK + " Kase permission TF + JMA smooth + bands/signal/hist. IFVG×Jurik Kase uses 2× mobile defaults (cycle 10 / kLen 18 / dLen 6 / jmaLen 20 / phase 0).", inputs: [num("cycle", "Cycle", 5), num("kLen", "%K", 8), num("dLen", "%D", 3), num("jmaLen", "JMA Length", 5), num("phase", "Phase", 50, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), num("levelLo", "Level Lo", 10, 0, 50, 1), num("levelLo2", "Level Lo2", 20, 0, 50, 1), num("levelHi2", "Level Hi2", 80, 50, 100, 1), num("levelHi", "Level Hi", 90, 50, 100, 1), SMOOTH_MODE] },
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

  // —— ProRealCode tarzı
  { id: "adaptiveSupertrend", label: "Adaptive SuperTrend", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "st", description: CRED_PROREAL, inputs: [num("atrLen", "ATR Length", 10), num("baseMult", "Base Mult", 2, 0.5, 10, 0.1), num("lookback", "Cluster Lookback", 50)] },
  { id: "adaptiveTrendChannel", label: "Adaptive Trend Channel", category: "proreal", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: CRED_PROREAL, inputs: [num("period", "Period", 40), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "qTrend", label: "Q-Trend (Tarasenko)", category: "lab", pane: "main", acceptsSeries: false, primarySeriesKey: "trend", description: "Tarasenko Q-Trend: mid-range TL ± ATR epsilon. Video defaults ATR 40 / EMA 10.", inputs: [num("trendPeriod", "Trend Period", 200), num("atrPeriod", "ATR Period", 40), num("atrMult", "ATR Mult", 1, 0.1, 5, 0.1), num("smoothPeriod", "EMA Smooth", 10)] },
  { id: "qualityTrendTrail", label: "Quality Trend Trail", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "trail", description: CRED_PROREAL, inputs: [num("atrLen", "ATR", 14), num("mult", "Mult", 2.5, 0.5, 10, 0.1), num("qualLen", "Quality Len", 20)] },
  { id: "varWeightedReg", label: "Variance-Weighted Regression", category: "proreal", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: CRED_PROREAL, inputs: [num("period", "Period", 30), num("mult", "Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "asymVolEnvelope", label: "Asym Volatility Envelope", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", description: CRED_PROREAL, inputs: [num("period", "Period", 20), num("upMult", "Up Mult", 2, 0.5, 10, 0.1), num("dnMult", "Down Mult", 2, 0.5, 10, 0.1)] },
  { id: "sweepReversalMap", label: "Sweep Reversal Map", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "state", description: CRED_PROREAL, inputs: [num("lookback", "Lookback", 20), num("confirm", "Confirm", 2)] },
  { id: "initialBalance", label: "Initial Balance", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "ibMid", description: CRED_PROREAL, inputs: [num("sessionBars", "Session Bars", 4, 1, 48, 1)] },
  { id: "fibGravityClusters", label: "Fibonacci Gravity Clusters", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "cluster", description: CRED_PROREAL, inputs: [num("swing", "Swing", 3), num("lookback", "Lookback", 80)] },
  { id: "pacLiteStructure", label: "PAC-lite Structure", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "hh", description: CRED_PROREAL, inputs: [num("swing", "Swing", 2)] },
  { id: "rsiBbCombo", label: "RSI+BB Mean Reversion", category: "proreal", pane: "sub", acceptsSeries: true, primarySeriesKey: "combo", description: CRED_PROREAL, inputs: [num("rsiLen", "RSI", 14), num("bbLen", "BB Period", 20), num("bbMult", "BB Mult", 2, 0.5, 10, 0.1), src()] },
  { id: "prtDmiPack", label: "PRT DMI/ADX Pack", category: "proreal", pane: "sub", acceptsSeries: false, primarySeriesKey: "adx", description: CRED_PROREAL, inputs: [num("period", "Period", 14)] },
  { id: "elderImpulse", label: "Elder Impulse System", category: "proreal", pane: "sub", acceptsSeries: true, primarySeriesKey: "impulse", description: CRED_PROREAL, inputs: [num("emaLen", "EMA", 13), num("macdFast", "MACD Fast", 12), num("macdSlow", "MACD Slow", 26), num("macdSig", "Signal", 9), src()] },
  { id: "laguerreRsi", label: "Laguerre RSI", category: "proreal", pane: "sub", acceptsSeries: true, primarySeriesKey: "lrsi", description: CRED_PROREAL, inputs: [num("gamma", "Gamma", 0.5, 0.05, 0.95, 0.01), src()] },
  { id: "coralTrend", label: "Coral Trend", category: "proreal", pane: "main", acceptsSeries: true, primarySeriesKey: "coral", description: CRED_PROREAL, inputs: [num("period", "Period", 34), num("mult", "Mult", 0.4, 0.05, 2, 0.05), src()] },
  { id: "nadarayaWatson", label: "Nadaraya-Watson Band", category: "proreal", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: CRED_PROREAL, inputs: [num("bandwidth", "Bandwidth", 8, 1, 50, 1), num("mult", "Mult", 1.5, 0.2, 5, 0.1), src()] },
  { id: "schaffTrendCycle", label: "Schaff Trend Cycle", category: "proreal", pane: "sub", acceptsSeries: true, primarySeriesKey: "stc", description: CRED_PROREAL, inputs: [num("period", "Cycle", 10), num("fast", "Fast", 23), num("slow", "Slow", 50), src()] },
  { id: "selfAwareTrail", label: "Self-Aware Trend Trail", category: "proreal", pane: "main", acceptsSeries: false, primarySeriesKey: "trail", description: CRED_PROREAL, inputs: [num("atrLen", "ATR", 10), num("mult", "Mult", 3, 0.5, 10, 0.1), num("qiLen", "QI Length", 14)] },
  { id: "adaptiveMacd", label: "Adaptive MACD", category: "proreal", pane: "sub", acceptsSeries: true, primarySeriesKey: "macd", description: CRED_PROREAL, inputs: [num("baseFast", "Base Fast", 12), num("baseSlow", "Base Slow", 26), num("signal", "Signal", 9), src()] },

  // —— Medyan / PLI (robust)
  { id: "rollingMedian", label: "Medyan (Rolling)", category: "ma", pane: "main", acceptsSeries: true, primarySeriesKey: "median", description: "Kayan medyan — ortalamaya göre aykırı değerlere dirençli.", inputs: [num("period", "Periyot", 20), src()] },
  { id: "madBands", label: "MAD Bantları", category: "bands", pane: "main", acceptsSeries: true, primarySeriesKey: "mid", description: "Medyan ± k·1.4826·MAD — BB yerine robust bant.", inputs: [num("period", "Periyot", 20), num("mult", "Çarpan", 2, 0.5, 10, 0.1), num("outerMult", "Dış Çarpan", 3, 0.5, 10, 0.1), src()] },
  { id: "medianChannel", label: "Medyan Kanal", category: "bands", pane: "main", acceptsSeries: false, primarySeriesKey: "medClose", description: "Yüksek/düşük/kapanış kayan medyan kanalı.", inputs: [num("period", "Periyot", 20)] },
  { id: "pliChannel", label: "PLI Kanal (oran)", category: "bands", pane: "main", acceptsSeries: true, primarySeriesKey: "upper", description: "TradingView percentile_linear_interpolation kanalı; oran=upper/lower−1 (daralma = squeeze). Go-10-Pli tarzı.", inputs: [num("length", "Uzunluk", 50), num("x", "Percentil X", 5, 0.5, 40, 0.5), src()] },
  { id: "pliDeltaHybrid", label: "PLI×Delta Hibrit", category: "lab", pane: "sub", acceptsSeries: false, primarySeriesKey: "oran", description: "PLI daralma (oran) × işaretli bar delta hacmi. Squeeze sonrası kırılım/sekme + destekleyici delta. Skor 0–100.", inputs: [num("length", "PLI Uzunluk", 50), num("x", "Percentil X", 5, 0.5, 40, 0.5), num("deltaSmooth", "Delta EMA", 5), num("narrowLookback", "Daralma Lookback", 50), num("narrowPct", "Daralma %", 25, 5, 50, 1), num("narrowMemory", "Daralma Bellek", 5)] },

  // —— IFVG
  { id: "ifvgZones", label: "IFVG Bölgeler", category: "bigbeluga", pane: "main", acceptsSeries: false, primarySeriesKey: "zoneTop", description: "Inversion FVG bölgeleri + retest AL/SAT. Formasyon IFVG taraması ile birlikte kullanılabilir (grafikte stack + backtest AND preset).", inputs: [num("swingStrength", "Swing", 2), num("maxInvLookforward", "İnv. Lookforward", 40), num("maxRetestLookforward", "Retest Lookforward", 30), num("zoneExtend", "Zone Extend", 8)] },
  { id: "ifvgRsi", label: "IFVG×RSI", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "rsi", description: "IFVG uygulanmış RSI: tam RSI + bias bağlamı (rsiIfvg) + IFVG retest × OS/OB teyit sinyalleri. Formasyon IFVG taraması ile birlikte kullanılabilir. (İkincil — tercih: IFVG×SMI)", inputs: [num("rsiPeriod", "RSI Periyot", 14), num("os", "OS", 35, 1, 50, 1), num("ob", "OB", 65, 50, 99, 1), num("swingStrength", "Swing", 2), num("maxInvLookforward", "İnv. Lookforward", 40), num("maxRetestLookforward", "Retest Lookforward", 30)] },
  { id: "ifvgSmi", label: "IFVG×SMI", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "smi", description: "IFVG uygulanmış SMI (Blau): smi+signal + bias bağlamı (smiIfvg) + IFVG retest × SMI/signal cross teyit (playbook SMI Long tarzı, soft ≤0/≥0 seviye). Tercih edilen IFVG confluence.", inputs: [num("k", "SMI K", 14), num("d", "SMI D", 20), num("ema", "Signal EMA", 5), num("os", "OS", -40, -100, 0, 1), num("ob", "OB", 40, 0, 100, 1), num("swingStrength", "Swing", 2), num("maxInvLookforward", "İnv. Lookforward", 40), num("maxRetestLookforward", "Retest Lookforward", 30)] },
  { id: "ifvgJurikStoch", label: "IFVG×Jurik Kase", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "k", description: "IFVG uygulanmış Loxx Jurik Kase Stochastic (jurikKaseStoch k/d; 2× JFKPS+ADX: Periyot 18, Cycle 10, Smoothing 6, JMA 20, Phase 0). AL: IFVG bull retest × K 20↑ kırılım (önceki K≤20, şimdi K>20). SAT: IFVG bear retest × K 80↓ kırılım (önceki K≥80, şimdi K<80). Pane: OS/OB + breakUp20/breakDn20/breakUp80/breakDn80 işaretleri. İsteğe bağlı K/D cross (useKdCross, varsayılan kapalı).", inputs: [num("kLen", "Periyot", 18), num("cycle", "Synthetic/Cycle", 10), num("dLen", "Smoothing", 6), num("jmaLen", "Jurik Smoothing", 20), num("phase", "Jurik Phase", 0, -100, 100, 1), num("power", "Power", 2, 0.1, 10, 0.1), num("os", "OS", 20, 1, 50, 1), num("ob", "OB", 80, 50, 99, 1), num("useKdCross", "K/D Cross", 0, 0, 1, 1), num("swingStrength", "Swing", 2), num("maxInvLookforward", "İnv. Lookforward", 40), num("maxRetestLookforward", "Retest Lookforward", 30)] },

  { id: "mavkRibbon", label: "MAVK Şerit", category: "ma", pane: "main", acceptsSeries: false, primarySeriesKey: "mid", description: "Çoklu EMA/SMA şerit (8/13/21/34/55/89). Küme: (max-min)/fiyat ≤ eşik. Formasyon MAVK taraması ile birlikte.", inputs: [num("p1", "MA1", 8), num("p2", "MA2", 13), num("p3", "MA3", 21), num("p4", "MA4", 34), num("p5", "MA5", 55), num("p6", "MA6", 89), num("clusterPct", "Küme %", 1.5, 0.2, 5, 0.1), num("useSma", "SMA (0=EMA)", 0, 0, 1, 1)] },
  { id: "rSquared", label: "R-Squared", category: "trend", pane: "sub", acceptsSeries: false, primarySeriesKey: "r2", description: "Kapanış üzerinde lineer regresyon R² (0–1). Düşük R² (~0.15–0.3) sonra yükseliş + MAVK küme = tarama sinyali.", inputs: [num("period", "Lookback", 30)] },

  // —— Elizi Lab
  { id: "eliziEdge", label: "Elizi Edge (Uyum·Sürpriz·İvme)", category: "lab", pane: "sub", acceptsSeries: false, primarySeriesKey: "edgeTemp", description: "Elizi Lab — soft Temp hist + ±E lines; AL/SAT at +E/−E cross (below/above bar). Detail=On for raws. Not classic TA; validate in backtest.", inputs: [num("erLen", "ER Length", 10), num("atrLen", "ATR Length", 14), num("adxPeriod", "ADX Period", 14), num("bbPeriod", "BB Period", 20), num("bbMult", "BB Mult", 2, 0.5, 10, 0.1), num("volLen", "Vol Short", 5), num("volLong", "Vol Long", 10), num("flowSmooth", "Flow Smooth", 3), num("tempSmooth", "Temp Smooth", 4), num("effHigh", "Eff High", 0.45, 0.1, 1, 0.01), num("surpriseHigh", "Surprise High", 0.85, 0.2, 3, 0.05), num("coherenceArmed", "Coh Armed", 0.6, 0.2, 1, 0.05), num("fireTemp", "Fire Temp", 62, 20, 100, 1), num("armedTemp", "Armed Temp", 48, 10, 100, 1), num("probeTemp", "Probe Temp", 32, 5, 100, 1), num("showMarkers", "AL/SAT işaretleri", 1, 0, 1, 1), sel("detailMode", "Detail Series", "0", [{ value: "0", label: "Primary (Temp/±E/Faz)" }, { value: "1", label: "Full (Uyum/Sürpriz/Verim…)" }])] },
  { id: "hamJurikTpo", label: "HAM Jurik TPO", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "osc", description: "HAM + Jurik RMA Trend Pulse. Hızlı/yavaş HAM osc kesişimi. Semi-raw, 4 renk hist. Tarama: raw×osc, hızlı×yavaş, setup/onay/AL.", inputs: [num("hamLen", "HAM Hızlı", 21), num("hamLenSlow", "HAM Yavaş", 34), num("rawLen", "Raw Hızlı", 10), num("rawLenSlow", "Raw Yavaş", 21), num("momSpan", "Mom Span", 10), num("normLen", "Norm Len", 80), num("jLen", "Jurik RMA", 20), num("jPhase", "Phase", 0, -100, 100, 1), num("postSmooth", "Final Smooth", 5), num("showRawHam", "Semi-raw", 1, 0, 1, 1), num("showHistogram", "Histogram", 1, 0, 1, 1), num("showMarkers", "Flip işaretleri", 1, 0, 1, 1)] },
  { id: "hamAoJrmaZ", label: "HAM+AO JRMA Z", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "rmaSignal", description: "HAM momentum + Awesome Oscillator blend → softsign → pos/neg trend → Jurik-like core + RMA signal (z-scored). Liste: RMA↑PT, AO↑PT/NT, PT↔NT kesişim (kenar). TV Long = jurik×rma↑ olabilir (ters).", inputs: [num("hamMomLen", "HAM Mom", 21), num("volBaseLen", "Vol Base", 34), num("hamPower", "HAM Power", 1.2, 0.1, 5, 0.1), num("aoFast", "AO Fast", 5), num("aoSlow", "AO Slow", 34), num("hamWeight", "HAM W", 0.6, 0, 1, 0.05), num("aoWeight", "AO W", 0.4, 0, 1, 0.05), num("trendLen", "Trend Len", 34), num("trendBoost", "Trend Boost", 1.3, 0.5, 3, 0.1), num("preSmoothLen", "Pre Smooth", 3), num("jurikLen", "Jurik Len", 8), num("rmaLen", "RMA Len", 13), num("postSmoothLen", "Post Smooth", 2), num("zLen", "Z Len", 89)] },
  { id: "aohamJrmaEngine", label: "Gold (AOHAM JRMA)", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "aoPlot", description: "AOHAM_JRMA_ENGINE — real Jurik + AO/Score/RMA 0–100 plots. Liste Gold: AO×Score AL/SAT, AO×RMA AL/SAT (ana), PT↔NT (garanti). Edge-only.", inputs: [num("hamMomLen", "HAM Mom", 21), num("volBaseLen", "Vol Base", 34), num("hamPower", "HAM Power", 1.2, 0.1, 5, 0.1), num("aoFast", "AO Fast", 5), num("aoSlow", "AO Slow", 34), num("wHam", "HAM W", 0.6, 0, 1, 0.05), num("wAo", "AO W", 0.4, 0, 1, 0.05), num("trendLen", "Trend Len", 34), num("trendBoost", "Trend Boost", 1.3, 0.5, 3, 0.1), num("jrmaLen", "Jurik Len", 8), num("jrmaPhase", "Jurik Phase", 0, -100, 100, 1), num("jrmaPower", "Jurik Power", 2, 0.1, 5, 0.1), num("jrmaRmaLen", "RMA Len", 13), num("preSmooth", "Pre Smooth", 3), num("postSmooth", "Post Smooth", 2), num("normLen", "Norm Len", 40), num("zLen", "Z Len", 89)] },
  { id: "goldKeko", label: "Gold2 (KEKO)", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "oscMain", description: "GOLD/KEKO — kutuplu enerji kırılım osilatörü. Liste Gold2: Raw/Core/Disp × RMA AL/SAT, kırılım, şarj, kutup (kenar-only).", inputs: [num("hamMomLen", "HAM Mom", 21), num("volBaseLen", "Vol Base", 34), num("hamPower", "HAM Power", 1.2, 0.1, 5, 0.1), num("aoFast", "AO Fast", 5), num("aoSlow", "AO Slow", 34), num("hamWeight", "HAM W", 0.6, 0, 1, 0.05), num("aoWeight", "AO W", 0.4, 0, 1, 0.05), num("bbLen", "BB Len", 20), num("bbMult", "BB Mult", 2, 0.5, 5, 0.1), num("kcLen", "KC Len", 20), num("kcMult", "KC Mult", 1.5, 0.5, 5, 0.1), num("peLen", "PE Len", 100), num("compressionThresh", "Sıkışma Z", 0.5, 0, 3, 0.05), num("cmfLen", "CMF Len", 21), num("polarWeightCMF", "Polar CMF", 0.6, 0, 1, 0.05), num("polarWeightHam", "Polar HAM", 0.4, 0, 1, 0.05), num("preSmoothLen", "Pre Smooth", 3), num("jurikLen", "Jurik Len", 8), num("rmaLen", "RMA Len", 13), num("postSmoothLen", "Post Smooth", 2), num("zLen", "Z Len", 89), num("displaySignalLen", "Disp EMA", 5), num("histScale", "Hist Scale", 18, 1, 100, 0.5), num("minChargeForSignal", "Min Şarj", 30, 0, 100, 1)] },
  { id: "doktorHull", label: "Doktor Hull", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "h21", description: "Hull ribbon 8/13/21/50/100/200 (Hma/Ehma/Thma). Grafik AL: 13×50↑, SAT: 21×50↓. Tarama: 100↑200 AL, 21↓100 SAT + kesişimler. Liste TF≈4h, ≥400 mum.", inputs: [sel("mode", "Hull Type", "Hma", [{ value: "Hma", label: "Hma" }, { value: "Ehma", label: "Ehma" }, { value: "Thma", label: "Thma" }]), num("showRibbon", "Ribbon", 1, 0, 1, 1), num("showMarkers", "AL/SAT", 1, 0, 1, 1), num("thickness", "Kalınlık", 2, 1, 5, 1)] },
  { id: "bbDivLg", label: "BB+RSI Div + LG", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "lowerBB", description: "BB alt dokunuş + RSI OS + bullish RSI div VEYA unconfirmed Liquidity Grab. Opsiyonel EMA50+ADX trend. BUY = sinyal + mum onayı. Liste tarama TF mumları.", inputs: [num("bbLen", "BB Periyot", 20), num("bbMult", "BB Mult", 2, 0.5, 5, 0.1), num("rsiLen", "RSI Periyot", 14), num("rsiOS", "RSI OS", 30), num("divLbL", "Div Pivot Sol", 5), num("divLbR", "Div Pivot Sağ", 5), num("divRangeLower", "Div Min Bar", 5), num("lgWickMult", "LG Fitil", 2, 1, 5, 0.1), num("lgVolMult", "LG Hacim", 1.3, 1, 3, 0.1), num("useTrend", "Trend Filtre", 1, 0, 1, 1), num("emaLen", "EMA", 50), num("useADX", "ADX Filtre", 1, 0, 1, 1), num("adxLen", "ADX Periyot", 14), num("adxMin", "ADX Min", 20), num("showMarkers", "Sinyal işaretleri", 1, 0, 1, 1)] },
  { id: "maSimple", label: "MA Basit (20-50-100-200)", category: "ma", pane: "main", acceptsSeries: false, primarySeriesKey: "sma20", description: "SMA 20/50/100/200 şerit. Liste: boğa/ayı yığını, SMA×SMA↑, fiyat×SMA↑, EMA10×SMA20 (hızlı). Hafif kart.", inputs: [num("p20", "SMA20", 20), num("p50", "SMA50", 50), num("p100", "SMA100", 100), num("p200", "SMA200", 200), num("showMarkers", "Kesişim işaretleri", 1, 0, 1, 1), num("showEma10", "EMA10 çiz", 0, 0, 1, 1)] },
  { id: "pdo", label: "PDO (Stoch hibrit)", category: "momentum", pane: "sub", acceptsSeries: false, primarySeriesKey: "pdo", description: "PDO — Pump/Dump Osilatörü (kripto-tarayici). Mavi PDO = Stoch %K + yapı sapması, turuncu sinyal = %D + aynı sapma, EMA2. Yeşil P = PUMP skoru, kırmızı D = DUMP skoru (EMA2) + 50 tabanlı yeşil/kırmızı çubuklar; P×D kesişimi = trend↑/↓. AL: ≤30 bölgeden yukarı kesişim, SAT: ≥70'ten aşağı. T10: kesişim + ayrı mumda alt BB teması. UA/US uyumsuzluk + 2D/3D/2T/3T yapı çizgileri. Mod 'ema' = eski PDO.", inputs: [num("stochWeight", "Stoch ağırlığı %", 70, 50, 100, 1), num("smooth", "Yumuşatma (EMA)", 2, 1, 30, 1), sel("crossMode", "Kesişim modu", "kd", [{ value: "kd", label: "Yeni (K/D)" }, { value: "ema", label: "Eski (EMA)" }]), num("low", "Dip bölge", 30, 5, 50, 1), num("high", "Tepe bölge", 70, 50, 95, 1), num("showMarkers", "AL/SAT/T10 işaretleri", 1, 0, 1, 1), num("showPatterns", "UA/US + 2D/3D çizgileri", 1, 0, 1, 1), num("showPD", "Yeşil P / kırmızı D çizgileri", 1, 0, 1, 1), num("showTrend", "Trend kesişimi (P×D) işaretleri", 1, 0, 1, 1), num("trendColor", "PDO çizgisini trende göre boya", 0, 0, 1, 1), num("showOld", "Eski kesişim işaretleri", 0, 0, 1, 1)] },
  { id: "kijunBb", label: "Kijun + BB", category: "trend", pane: "main", acceptsSeries: false, primarySeriesKey: "kijun", description: "Kijun (Donchian orta, 26) + Kijun üzerinde Bollinger (24, 2σ). Liste: fiyat×alt/üst band (erken), Kijun×orta (trend onayı). Hafif kart.", inputs: [num("basePeriods", "Kijun periyot", 26), num("bbLength", "BB Periyot", 24), num("bbStdDev", "BB StdDev", 2, 0.5, 5, 0.1), num("showMarkers", "Kesişim işaretleri", 1, 0, 1, 1)] },
  { id: "multiDipBb", label: "Çoklu Dip + BB", category: "levels", pane: "main", acceptsSeries: false, primarySeriesKey: "lowerBB", description: "İkili/üçlü dip + Bollinger alt band + S/R yakınlık + majör düşen direnç kırılımı. Pivot lbL/lbR onayında sinyal. Diyagonal (pikusov) + yatay pivot destek çizgileri chart'ta. Üçlü > ikili. Liste TF≈1h.", inputs: [num("lbL", "Pivot Sol", 3), num("lbR", "Pivot Sağ", 3), num("bbLength", "BB Periyot", 20), num("bbMult", "BB Mult", 2, 0.5, 5, 0.1), num("bbProximity", "BB Yakınlık %", 0.5, 0, 5, 0.1), num("dipSensitivity", "Dip ATR", 1.5, 0.5, 5, 0.1), num("minDipDistance", "Min Mum", 5), num("maxDipDistance", "Max Mum", 30), num("rsiOversold", "RSI Üst", 40), num("srTolAtr", "S/R ATR tol", 0.75, 0.2, 3, 0.05), num("srTolPct", "S/R % tol", 0.35, 0.05, 2, 0.05), num("majBreakLookback", "Majör kırılım pivot", 20, 5, 50, 1), num("breakComboBars", "Dip→kırılım pencere", 8, 1, 30, 1), num("showMarkers", "Sinyal işaretleri", 1, 0, 1, 1), num("showSr", "S/R çizgileri", 1, 0, 1, 1)] },
  { id: "macdEliziHybrid", label: "MACD×Elizi (60/40)", category: "lab", pane: "sub", acceptsSeries: false, primarySeriesKey: "hybrid", description: "MACD %60 + Elizi ±E %40 weighted composite. MACD leads timing (Elizi alone lags). AL/SAT = hybrid×signal cross. Osilatör→M×E tarama ile aynı.", inputs: [num("fast", "MACD Fast", 12), num("slow", "MACD Slow", 26), num("signalPeriod", "MACD Signal", 9), num("wMacd", "MACD Ağırlık", 0.6, 0, 1, 0.05), num("wElizi", "Elizi Ağırlık", 0.4, 0, 1, 0.05), num("normLen", "Norm Len", 50), num("hybridSignal", "Hybrid Signal", 5), num("showMarkers", "AL/SAT işaretleri", 1, 0, 1, 1), num("erLen", "ER Length", 10), num("atrLen", "ATR Length", 14), num("adxPeriod", "ADX Period", 14)] },
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
  proreal: "ProRealCode tarzı",
  lab: "Elizi Lab",
  other: "Diğer",
};

export const CATEGORY_ORDER: IndicatorCategory[] = [
  "ma",
  "bands",
  "momentum",
  "trend",
  "lab",
  "volatility",
  "volume",
  "bill_williams",
  "levels",
  "jurik",
  "bigbeluga",
  "proreal",
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
    indicatorId: inst.id,
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
    indicatorId: inst.id,
  };
}

/** MA Basit chart marker tables (series key → short label). */
const MA_SIMPLE_SMA_X = [
  ["x_20_50", "20↑50"],
  ["x_20_100", "20↑100"],
  ["x_20_200", "20↑200"],
  ["x_50_100", "50↑100"],
  ["x_50_200", "50↑200"],
  ["x_100_200", "100↑200"],
] as const;
const MA_SIMPLE_PX_X = [
  ["price_x_20", "20"],
  ["price_x_50", "50"],
  ["price_x_100", "100"],
  ["price_x_200", "200"],
] as const;

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
    case "rsiLevelBreaks": {
      const period = n(p, "period", 14);
      const lvl30 = n(p, "lvl30", 30);
      const lvl50 = n(p, "lvl50", 50);
      const lvl70 = n(p, "lvl70", 70);
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const levels = [lvl30, lvl50, lvl70];
      // Same cross rules as Osilatör→RSI (detectRsiBreaks) when on price source
      const markers =
        inst.source?.type !== "indicator"
          ? rsiBreakMarkerSeries(candles, { period, levels })
          : (() => {
              const series = rsi(values, period);
              const nBars = series.length;
              const breakUp: (number | null)[] = Array(nBars).fill(null);
              const breakDn: (number | null)[] = Array(nBars).fill(null);
              for (let i = 1; i < nBars; i++) {
                const prev = series[i - 1];
                const curr = series[i];
                if (prev == null || curr == null) continue;
                for (const level of levels) {
                  if (prev <= level && curr > level) breakUp[i] = 1;
                  if (prev >= level && curr < level) breakDn[i] = 1;
                }
              }
              return { rsi: series, breakUp, breakDn };
            })();
      const lvl30Line = candles.map(() => lvl30 as number | null);
      const lvl50Line = candles.map(() => lvl50 as number | null);
      const lvl70Line = candles.map(() => lvl70 as number | null);
      const plots: PlotSeries[] = [
        line(inst, "rsi", "sub", color, candles, markers.rsi, `RSI(${period})`),
        line(inst, "lvl30", "sub", "#26a69a88", candles, lvl30Line, String(lvl30)),
        line(inst, "lvl50", "sub", "#787b8655", candles, lvl50Line, String(lvl50)),
        line(inst, "lvl70", "sub", "#ef535088", candles, lvl70Line, String(lvl70)),
      ];
      if (showMarkers) {
        const markUp = markers.breakUp.map((v, i) =>
          v === 1 ? (markers.rsi[i] ?? lvl50) : null
        );
        const markDn = markers.breakDn.map((v, i) =>
          v === 1 ? (markers.rsi[i] ?? lvl50) : null
        );
        plots.push(
          hist(inst, "breakUp", "sub", "#69f0ae", candles, markUp, "↑ kırılım"),
          hist(inst, "breakDn", "sub", "#ff5252", candles, markDn, "↓ kırılım")
        );
      }
      push(plots, {
        rsi: markers.rsi,
        lvl30: lvl30Line,
        lvl50: lvl50Line,
        lvl70: lvl70Line,
        breakUp: markers.breakUp,
        breakDn: markers.breakDn,
      });
      break;
    }
    case "stochastic": {
      const kp = n(p, "kPeriod", 14);
      const dp = n(p, "dPeriod", 3);
      const c = (k: string, d: string) =>
        typeof p[k] === "string" && p[k] ? String(p[k]) : d;
      const colorK = c("colorK", "#2962ff");
      const colorD = c("colorD", "#ff6d00");
      const s =
        inst.source?.type === "indicator"
          ? stochasticSeries(values, kp, dp)
          : stochastic(candles, kp, dp);
      push(
        [
          line(inst, "k", "sub", colorK, candles, s.k, "%K"),
          line(inst, "d", "sub", colorD, candles, s.d, "%D"),
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
      const fast = n(p, "fast", 12);
      const slow = n(p, "slow", 26);
      const sigP = n(p, "signal", 9);
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      // Prefer shared scan helper when on price (keeps chart ≡ Osilatör→MACD)
      const fromScan =
        inst.source?.type !== "indicator"
          ? macdCrossMarkerSeries(candles, {
              fast,
              slow,
              signalPeriod: sigP,
            })
          : null;
      const m = fromScan
        ? {
            macd: fromScan.macd,
            signal: fromScan.signal,
            hist: fromScan.hist,
            crossUp: fromScan.crossUp,
            crossDn: fromScan.crossDn,
          }
        : (() => {
            const raw = macd(values, fast, slow, sigP);
            const nBars = raw.macd.length;
            const crossUp: (number | null)[] = Array(nBars).fill(null);
            const crossDn: (number | null)[] = Array(nBars).fill(null);
            for (let i = 1; i < nBars; i++) {
              const a0 = raw.macd[i - 1];
              const a1 = raw.macd[i];
              const b0 = raw.signal[i - 1];
              const b1 = raw.signal[i];
              if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
              if (a0 <= b0 && a1 > b1) crossUp[i] = 1;
              if (a0 >= b0 && a1 < b1) crossDn[i] = 1;
            }
            return { ...raw, crossUp, crossDn };
          })();
      const c = (k: string, d: string) =>
        typeof p[k] === "string" && p[k] ? String(p[k]) : d;
      const colorMacd = c("colorMacd", "#2962ff");
      const colorSignal = c("colorSignal", "#ff6d00");
      const colorHist = c("colorHist", "#26a69a");
      const colorHistUp = c("colorHistUp", colorHist);
      const colorHistDn = c("colorHistDn", colorHist);
      const histPlot = hist(inst, "hist", "sub", colorHist, candles, m.hist, "Hist");
      if (colorHistUp !== colorHist || colorHistDn !== colorHist) {
        histPlot.data = histPlot.data.map((pt, i) => {
          if (!("value" in pt) || pt.value == null) return pt;
          const hv = m.hist[i];
          const col =
            hv == null ? colorHist : hv >= 0 ? colorHistUp : colorHistDn;
          return { time: pt.time, value: pt.value, color: col };
        });
      }
      const plots: PlotSeries[] = [
        line(inst, "macd", "sub", colorMacd, candles, m.macd, "MACD"),
        line(inst, "sig", "sub", colorSignal, candles, m.signal, "Signal"),
        histPlot,
      ];
      if (showMarkers) {
        const markUp = m.crossUp.map((v, i) =>
          v === 1 ? (m.macd[i] ?? 0) : null
        );
        const markDn = m.crossDn.map((v, i) =>
          v === 1 ? (m.macd[i] ?? 0) : null
        );
        plots.push(
          hist(inst, "crossUp", "sub", "#69f0ae", candles, markUp, "AL↑"),
          hist(inst, "crossDn", "sub", "#ff5252", candles, markDn, "SAT↓")
        );
      }
      push(plots, {
        macd: m.macd,
        signal: m.signal,
        hist: m.hist,
        crossUp: m.crossUp,
        crossDn: m.crossDn,
      });
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
    case "adxPumpRadar": {
      const rr = adxPumpRadar(candles, {
        adxPeriod: n(p, "adxPeriod", 14),
        fastSmooth: n(p, "fastSmooth", 3),
        medianLen: n(p, "medianLen", 5),
        momPeriod: n(p, "momPeriod", 7),
        cciPeriod: n(p, "cciPeriod", 10),
        bbPeriod: n(p, "bbPeriod", 20),
        bbMult: n(p, "bbMult", 2),
        smoothLen: n(p, "smoothLen", 3),
        adxConfirm: n(p, "adxConfirm", 25),
        adxWake: n(p, "adxWake", 15),
      });
      push(
        [
          line(inst, "adx", "sub", "#e0e0e0", candles, rr.adx, "Saf ADX"),
          line(inst, "adxCci", "sub", "#00e5ff", candles, rr.adxCci, "ADX×CCI"),
          line(inst, "adxMedian", "sub", "#ffeb3b", candles, rr.adxMedian, "ADX×Medyan"),
          line(inst, "adxMom", "sub", "#ff9100", candles, rr.adxMom, "ADX×Momentum"),
          line(inst, "plusDIMix", "sub", "#69f0ae", candles, rr.plusDIMix, "Karışım +DI"),
          line(inst, "minusDIMix", "sub", "#ff5252", candles, rr.minusDIMix, "Karışım −DI"),
          hist(inst, "osc", "sub", color, candles, rr.osc, "Pump Osc"),
          hist(inst, "stage", "sub", "#e040fb55", candles, rr.stage, "Aşama"),
          line(inst, "early", "sub", "#00bcd466", candles, rr.early, "Erken Skor"),
          line(inst, "mid", "sub", "#ffc10766", candles, rr.mid, "Orta Skor"),
          line(inst, "confirm", "sub", "#8bc34a66", candles, rr.confirm, "Onay Skor"),
          line(inst, "pctB", "sub", "#ce93d866", candles, rr.pctB, "BB %B"),
        ],
        {
          osc: rr.osc,
          stage: rr.stage,
          early: rr.early,
          mid: rr.mid,
          confirm: rr.confirm,
          bias: rr.bias,
          adx: rr.adx,
          adxCci: rr.adxCci,
          adxMedian: rr.adxMedian,
          adxMom: rr.adxMom,
          plusDI: rr.plusDI,
          minusDI: rr.minusDI,
          plusDIMix: rr.plusDIMix,
          minusDIMix: rr.minusDIMix,
          diSpread: rr.diSpread,
          pctB: rr.pctB,
          bbWidth: rr.bbWidth,
        }
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
    case "qTrend": {
      const q = qTrend(candles, {
        trendPeriod: n(p, "trendPeriod", 200),
        atrPeriod: n(p, "atrPeriod", 40),
        atrMult: n(p, "atrMult", 1),
        smoothPeriod: n(p, "smoothPeriod", 10),
      });
      push(
        [line(inst, "trend", "main", "#7c4dff", candles, q.trend, "Q-Trend")],
        { trend: q.trend, dir: q.dir }
      );
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

    case "adaptiveSupertrend": {
      const a = adaptiveSupertrend(candles, n(p, "atrLen", 10), n(p, "baseMult", 2), n(p, "lookback", 50));
      push(
        [line(inst, "st", "main", color, candles, a.st, "Adapt ST")],
        { st: a.st, dir: a.dir, mult: a.mult, atr: a.atrLine }
      );
      break;
    }
    case "adaptiveTrendChannel": {
      const period = n(p, "period", 40);
      const c = adaptiveTrendChannel(values, candles, period, n(p, "mult", 2));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, c.mid, "ATC Mid"),
          line(inst, "up", "main", "#ef5350", candles, c.upper, "ATC Up"),
          line(inst, "lo", "main", "#26a69a", candles, c.lower, "ATC Low"),
          line(inst, "fit", "sub", "#e040fb", candles, c.fit, "Fit %"),
        ],
        { mid: c.mid, upper: c.upper, lower: c.lower, fit: c.fit }
      );
      break;
    }
    case "qualityTrendTrail": {
      const q = qualityTrendTrail(candles, n(p, "atrLen", 14), n(p, "mult", 2.5), n(p, "qualLen", 20));
      push(
        [
          line(inst, "trail", "main", color, candles, q.trail, "Quality Trail"),
          line(inst, "quality", "sub", "#00bcd4", candles, q.quality, "Quality"),
        ],
        { trail: q.trail, quality: q.quality, dir: q.dir }
      );
      break;
    }
    case "varWeightedReg": {
      const v = varWeightedRegression(values, n(p, "period", 30), n(p, "mult", 2));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, v.mid, "VWReg"),
          line(inst, "up", "main", "#ef5350", candles, v.upper, "VW Up"),
          line(inst, "lo", "main", "#26a69a", candles, v.lower, "VW Low"),
        ],
        { mid: v.mid, upper: v.upper, lower: v.lower }
      );
      break;
    }
    case "asymVolEnvelope": {
      const e = asymVolEnvelope(candles, n(p, "period", 20), n(p, "upMult", 2), n(p, "dnMult", 2));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, e.mid, "Asym Mid"),
          line(inst, "up", "main", "#ef5350", candles, e.upper, "Asym Up"),
          line(inst, "lo", "main", "#26a69a", candles, e.lower, "Asym Low"),
        ],
        { mid: e.mid, upper: e.upper, lower: e.lower }
      );
      break;
    }
    case "sweepReversalMap": {
      const s = sweepReversalMap(candles, n(p, "lookback", 20), n(p, "confirm", 2));
      push(
        [
          line(inst, "bull", "main", "#26a69a", candles, s.bull, "Sweep Bull"),
          line(inst, "bear", "main", "#ef5350", candles, s.bear, "Sweep Bear"),
        ],
        { bull: s.bull, bear: s.bear, state: s.state }
      );
      break;
    }
    case "initialBalance": {
      const ib = initialBalance(candles, n(p, "sessionBars", 4));
      push(
        [
          line(inst, "ibHigh", "main", "#26a69a", candles, ib.ibHigh, "IB High"),
          line(inst, "ibLow", "main", "#ef5350", candles, ib.ibLow, "IB Low"),
          line(inst, "ibMid", "main", "#2962ff", candles, ib.ibMid, "IB Mid"),
        ],
        { ibHigh: ib.ibHigh, ibLow: ib.ibLow, ibMid: ib.ibMid }
      );
      break;
    }
    case "fibGravityClusters": {
      const f = fibGravityClusters(candles, n(p, "swing", 3), n(p, "lookback", 80));
      push(
        [
          line(inst, "cluster", "main", "#e040fb", candles, f.cluster, "Fib Gravity"),
          line(inst, "gravUp", "main", "#26a69a88", candles, f.gravUp, "Grav Up"),
          line(inst, "gravDn", "main", "#ef535088", candles, f.gravDn, "Grav Dn"),
        ],
        { cluster: f.cluster, gravUp: f.gravUp, gravDn: f.gravDn }
      );
      break;
    }
    case "pacLiteStructure": {
      const p2 = pacLiteStructure(candles, n(p, "swing", 2));
      push(
        [
          line(inst, "hh", "main", "#26a69a", candles, p2.hh, "HH"),
          line(inst, "hl", "main", "#8bc34a", candles, p2.hl, "HL"),
          line(inst, "lh", "main", "#ff6d00", candles, p2.lh, "LH"),
          line(inst, "ll", "main", "#ef5350", candles, p2.ll, "LL"),
        ],
        { hh: p2.hh, hl: p2.hl, lh: p2.lh, ll: p2.ll }
      );
      break;
    }
    case "rsiBbCombo": {
      const c = rsiBbCombo(values, n(p, "rsiLen", 14), n(p, "bbLen", 20), n(p, "bbMult", 2));
      push(
        [
          line(inst, "combo", "sub", color, candles, c.combo, "RSI+BB"),
          line(inst, "rsi", "sub", "#2962ff88", candles, c.rsiLine, "RSI"),
          line(inst, "pctb", "sub", "#ff6d0088", candles, c.pctB, "%B"),
        ],
        { combo: c.combo, rsi: c.rsiLine, pctb: c.pctB }
      );
      break;
    }
    case "prtDmiPack": {
      const d = prtDmiPack(candles, n(p, "period", 14));
      push(
        [
          line(inst, "adx", "sub", "#e040fb", candles, d.adx, "ADX"),
          line(inst, "dip", "sub", "#26a69a", candles, d.dip, "+DI"),
          line(inst, "dim", "sub", "#ef5350", candles, d.dim, "-DI"),
          hist(inst, "dx", "sub", "#2962ff55", candles, d.dx, "DX"),
        ],
        { adx: d.adx, dip: d.dip, dim: d.dim, dx: d.dx }
      );
      break;
    }
    case "elderImpulse": {
      const e = elderImpulse(values, n(p, "emaLen", 13), n(p, "macdFast", 12), n(p, "macdSlow", 26), n(p, "macdSig", 9));
      push(
        [
          hist(inst, "impulse", "sub", color, candles, e.impulse, "Impulse"),
          line(inst, "ema", "main", "#2962ff", candles, e.emaLine, "Elder EMA"),
          hist(inst, "hist", "sub", "#ff6d00", candles, e.hist, "MACD Hist"),
        ],
        { impulse: e.impulse, ema: e.emaLine, hist: e.hist }
      );
      break;
    }
    case "laguerreRsi": {
      const l = laguerreRsi(values, n(p, "gamma", 0.5));
      push([line(inst, "lrsi", "sub", color, candles, l.lrsi, "Laguerre RSI")], { lrsi: l.lrsi });
      break;
    }
    case "coralTrend": {
      const c = coralTrend(values, n(p, "period", 34), n(p, "mult", 0.4));
      push([line(inst, "coral", "main", color, candles, c.coral, "Coral")], { coral: c.coral, dir: c.dir });
      break;
    }
    case "nadarayaWatson": {
      const nw = nadarayaWatson(values, n(p, "bandwidth", 8), n(p, "mult", 1.5));
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, nw.mid, "NW Mid"),
          line(inst, "up", "main", "#ef5350", candles, nw.upper, "NW Up"),
          line(inst, "lo", "main", "#26a69a", candles, nw.lower, "NW Low"),
        ],
        { mid: nw.mid, upper: nw.upper, lower: nw.lower }
      );
      break;
    }
    case "schaffTrendCycle": {
      const s = schaffTrendCycle(values, n(p, "period", 10), n(p, "fast", 23), n(p, "slow", 50));
      push(
        [
          line(inst, "stc", "sub", color, candles, s.stc, "STC"),
          line(inst, "macd", "sub", "#ff6d0088", candles, s.macd, "MACD"),
        ],
        { stc: s.stc, macd: s.macd }
      );
      break;
    }
    case "selfAwareTrail": {
      const s = selfAwareTrail(candles, n(p, "atrLen", 10), n(p, "mult", 3), n(p, "qiLen", 14));
      push(
        [
          line(inst, "trail", "main", color, candles, s.trail, "Self-Aware Trail"),
          line(inst, "qi", "sub", "#00bcd4", candles, s.qi, "QI"),
        ],
        { trail: s.trail, qi: s.qi, dir: s.dir }
      );
      break;
    }
    case "adaptiveMacd": {
      const m = adaptiveMacd(values, candles, n(p, "baseFast", 12), n(p, "baseSlow", 26), n(p, "signal", 9));
      push(
        [
          line(inst, "macd", "sub", "#2962ff", candles, m.macd, "Adapt MACD"),
          line(inst, "sig", "sub", "#ff6d00", candles, m.sig, "Signal"),
          hist(inst, "hist", "sub", "#26a69a", candles, m.hist, "Hist"),
        ],
        { macd: m.macd, sig: m.sig, hist: m.hist }
      );
      break;
    }
    case "smi": {
      const s = smi(candles, n(p, "qLength", 14), n(p, "rLength", 20), n(p, "signal", 5));
      push(
        [
          line(inst, "smi", "sub", "#2962ff", candles, s.smi, "SMI"),
          line(inst, "sig", "sub", "#ff6d00", candles, s.signal, "Signal"),
        ],
        { smi: s.smi, signal: s.signal }
      );
      break;
    }
    case "coppock": {
      const v = coppock(values, n(p, "rocLong", 14), n(p, "rocShort", 11), n(p, "wmaPeriod", 10));
      push([line(inst, "coppock", "sub", color, candles, v, "Coppock")], { coppock: v });
      break;
    }
    case "vidya": {
      const period = n(p, "period", 14);
      const v = vidya(values, period);
      push([line(inst, "vidya", "main", color, candles, v, `VIDYA(${period})`)], { vidya: v });
      break;
    }
    case "frama": {
      const period = n(p, "period", 16);
      const v = frama(values, period);
      push([line(inst, "frama", "main", color, candles, v, `FRAMA(${period})`)], { frama: v });
      break;
    }
    case "squeezeMomentum": {
      const s = squeezeMomentum(candles, n(p, "length", 20), n(p, "bbMult", 2), n(p, "kcMult", 1.5));
      push(
        [
          hist(inst, "mom", "sub", "#2962ff", candles, s.mom, "Squeeze Mom"),
          line(inst, "sqz", "sub", "#ffeb3b", candles, s.squeeze, "Squeeze On"),
        ],
        { mom: s.mom, squeeze: s.squeeze }
      );
      break;
    }
    case "softTrend": {
      const s = softTrend(candles, n(p, "period", 20), n(p, "atrPeriod", 14), n(p, "mult", 1.5));
      push(
        [
          line(inst, "line", "main", color, candles, s.line, "SoftTrend"),
          line(inst, "up", "main", "#ef535088", candles, s.upper, "ST Up"),
          line(inst, "lo", "main", "#26a69a88", candles, s.lower, "ST Low"),
        ],
        { line: s.line, upper: s.upper, lower: s.lower, dir: s.dir }
      );
      break;
    }
    case "vfi": {
      const v = vfi(candles, n(p, "period", 130), n(p, "coef", 0.2), n(p, "vcoef", 2.5), n(p, "signal", 5));
      push(
        [
          line(inst, "vfi", "sub", "#2962ff", candles, v.vfi, "VFI"),
          line(inst, "sig", "sub", "#ff6d00", candles, v.signal, "Signal"),
        ],
        { vfi: v.vfi, signal: v.signal }
      );
      break;
    }
    case "waddahAttar": {
      const w = waddahAttar(
        values,
        candles,
        n(p, "fast", 20),
        n(p, "slow", 40),
        n(p, "bbPeriod", 20),
        n(p, "bbMult", 2),
        n(p, "sensitivity", 150)
      );
      push(
        [
          hist(inst, "up", "sub", "#26a69a", candles, w.up, "WAE Up"),
          hist(inst, "down", "sub", "#ef5350", candles, w.down, "WAE Down"),
          line(inst, "exp", "sub", "#ffeb3b", candles, w.explosion, "Explosion"),
          line(inst, "dz", "sub", "#78909c", candles, w.deadZone, "Dead Zone"),
        ],
        { up: w.up, down: w.down, explosion: w.explosion, deadZone: w.deadZone }
      );
      break;
    }
    case "halfTrend": {
      const h = halfTrend(candles, n(p, "amplitude", 2), n(p, "channelDeviation", 2), n(p, "atrPeriod", 100));
      push(
        [
          line(inst, "ht", "main", color, candles, h.ht, "HalfTrend"),
          line(inst, "ah", "main", "#ef535088", candles, h.atrHigh, "HT High"),
          line(inst, "al", "main", "#26a69a88", candles, h.atrLow, "HT Low"),
        ],
        { ht: h.ht, atrHigh: h.atrHigh, atrLow: h.atrLow, dir: h.dir }
      );
      break;
    }
    case "sslChannel": {
      const s = sslChannel(candles, n(p, "period", 10));
      push(
        [
          line(inst, "sslUp", "main", "#26a69a", candles, s.sslUp, "SSL Up"),
          line(inst, "sslDown", "main", "#ef5350", candles, s.sslDown, "SSL Down"),
        ],
        { sslUp: s.sslUp, sslDown: s.sslDown, dir: s.dir }
      );
      break;
    }
    case "rangeFilter": {
      const r = rangeFilter(values, n(p, "period", 20), n(p, "mult", 2.5));
      push(
        [
          line(inst, "filter", "main", color, candles, r.filter, "Range Filter"),
          line(inst, "up", "main", "#ef535088", candles, r.upper, "RF Up"),
          line(inst, "lo", "main", "#26a69a88", candles, r.lower, "RF Low"),
        ],
        { filter: r.filter, upper: r.upper, lower: r.lower, dir: r.dir }
      );
      break;
    }
    case "choppiness": {
      const period = n(p, "period", 14);
      const v = choppiness(candles, period);
      push([line(inst, "chop", "sub", color, candles, v, `CHOP(${period})`)], { chop: v });
      break;
    }
    case "bop": {
      const smooth = n(p, "smooth", 14);
      const v = bop(candles, smooth);
      push([line(inst, "bop", "sub", color, candles, v, `BOP(${smooth})`)], { bop: v });
      break;
    }

    case "rollingMedian": {
      const period = n(p, "period", 20);
      const v = rollingMedian(values, period);
      push([line(inst, "median", "main", color, candles, v, `Medyan(${period})`)], { median: v });
      break;
    }
    case "madBands": {
      const period = n(p, "period", 20);
      const mult = n(p, "mult", 2);
      const outerMult = n(p, "outerMult", 3);
      const b = madBands(values, period, mult, outerMult);
      push(
        [
          line(inst, "mid", "main", "#2962ff", candles, b.mid, "MAD Mid"),
          line(inst, "up", "main", "#ef5350", candles, b.upper, "MAD Up"),
          line(inst, "lo", "main", "#26a69a", candles, b.lower, "MAD Low"),
          line(inst, "oup", "main", "#ef535055", candles, b.outerUpper, "MAD Outer Up"),
          line(inst, "olo", "main", "#26a69a55", candles, b.outerLower, "MAD Outer Low"),
        ],
        { mid: b.mid, upper: b.upper, lower: b.lower, outerUpper: b.outerUpper, outerLower: b.outerLower, mad: b.mad }
      );
      break;
    }
    case "medianChannel": {
      const period = n(p, "period", 20);
      const ch = medianChannel(candles, period);
      push(
        [
          line(inst, "medHigh", "main", "#ef5350", candles, ch.medHigh, "Med High"),
          line(inst, "medClose", "main", "#2962ff", candles, ch.medClose, "Med Close"),
          line(inst, "medLow", "main", "#26a69a", candles, ch.medLow, "Med Low"),
        ],
        { medHigh: ch.medHigh, medLow: ch.medLow, medClose: ch.medClose }
      );
      break;
    }
    case "pliChannel": {
      const length = n(p, "length", 50);
      const x = n(p, "x", 5);
      const ch = pliChannel(values, length, x);
      push(
        [
          line(inst, "upper", "main", "#ef5350", candles, ch.upper, `PLI Up(${100 - x})`),
          line(inst, "lower", "main", "#26a69a", candles, ch.lower, `PLI Lo(${x})`),
          line(inst, "oran", "sub", "#e040fb", candles, ch.oran, "oran (genişlik)"),
        ],
        { upper: ch.upper, lower: ch.lower, oran: ch.oran }
      );
      break;
    }
    case "pliDeltaHybrid": {
      const h = pliDeltaHybrid(candles, {
        length: n(p, "length", 50),
        x: n(p, "x", 5),
        deltaSmooth: n(p, "deltaSmooth", 5),
        narrowLookback: n(p, "narrowLookback", 50),
        narrowPct: n(p, "narrowPct", 25),
        narrowMemory: n(p, "narrowMemory", 5),
      });
      // bar tint via signed hist (bias) + oran sub + score
      const longHist = h.longSignal.map((v) => (v === 1 ? 1 : null));
      const shortHist = h.shortSignal.map((v) => (v === 1 ? -1 : null));
      push(
        [
          line(inst, "oran", "sub", "#e040fb", candles, h.oran, "oran"),
          hist(inst, "deltaEma", "sub", "#42a5f5", candles, h.deltaEma, "ΔVol EMA"),
          line(inst, "score", "sub", "#ffeb3b", candles, h.score, "Skor"),
          hist(inst, "narrow", "sub", "#90a4ae88", candles, h.narrow, "Daralma"),
          hist(inst, "longSig", "sub", "#26a69a", candles, longHist, "Long"),
          hist(inst, "shortSig", "sub", "#ef5350", candles, shortHist, "Short"),
          line(inst, "upper", "main", "#ef535088", candles, h.upper, "PLI Up"),
          line(inst, "lower", "main", "#26a69a88", candles, h.lower, "PLI Lo"),
        ],
        {
          upper: h.upper,
          lower: h.lower,
          oran: h.oran,
          deltaVol: h.deltaVol,
          deltaEma: h.deltaEma,
          narrow: h.narrow,
          longSignal: h.longSignal,
          shortSignal: h.shortSignal,
          score: h.score,
          barBias: h.barBias,
        }
      );
      break;
    }

    case "ifvgZones": {
      const s = computeIfvgSeries(candles, {
        swingStrength: n(p, "swingStrength", 2),
        maxInvLookforward: n(p, "maxInvLookforward", 40),
        maxRetestLookforward: n(p, "maxRetestLookforward", 30),
        zoneExtend: n(p, "zoneExtend", 8),
        lookbackFvgs: 0,
        maxHits: 0,
      });
      const longHist = s.longSignal.map((v) => (v === 1 ? 1 : null));
      const shortHist = s.shortSignal.map((v) => (v === 1 ? -1 : null));
      const biasHist = s.bias.map((v) => (v == null || v === 0 ? null : v));
      push(
        [
          line(inst, "zoneTop", "main", "#7e57c2", candles, s.zoneTop, "IFVG Top"),
          line(inst, "zoneBot", "main", "#7e57c288", candles, s.zoneBot, "IFVG Bot"),
          hist(inst, "bias", "main", "#ab47bc55", candles, biasHist, "Bias"),
          hist(inst, "longSig", "main", "#26a69a", candles, longHist, "AL"),
          hist(inst, "shortSig", "main", "#ef5350", candles, shortHist, "SAT"),
          hist(inst, "inverted", "main", "#7e57c2", candles, s.inverted, "INV"),
          hist(inst, "sweep", "main", "#ffb74d", candles, s.sweep, "Süpürme"),
        ],
        {
          zoneTop: s.zoneTop,
          zoneBot: s.zoneBot,
          bias: s.bias,
          inverted: s.inverted,
          sweep: s.sweep,
          longSignal: s.longSignal,
          shortSignal: s.shortSignal,
          score: s.score,
          entry: s.entry,
          stop: s.stop,
          tp1: s.tp1,
        }
      );
      break;
    }
    case "ifvgRsi": {
      const s = computeIfvgRsi(candles, {
        rsiPeriod: n(p, "rsiPeriod", 14),
        os: n(p, "os", 35),
        ob: n(p, "ob", 65),
        swingStrength: n(p, "swingStrength", 2),
        maxInvLookforward: n(p, "maxInvLookforward", 40),
        maxRetestLookforward: n(p, "maxRetestLookforward", 30),
        lookbackFvgs: 0,
        maxHits: 0,
      });
      const osLine = candles.map(() => s.os as number | null);
      const obLine = candles.map(() => s.ob as number | null);
      const longHist = s.longSignal.map((v) => (v === 1 ? 1 : null));
      const shortHist = s.shortSignal.map((v) => (v === 1 ? -1 : null));
      push(
        [
          line(inst, "rsi", "sub", color, candles, s.rsi, "RSI"),
          line(inst, "rsiIfvg", "sub", "#7e57c2", candles, s.rsiIfvg, "RSI·IFVG"),
          line(inst, "os", "sub", "#26a69a88", candles, osLine, "OS"),
          line(inst, "ob", "sub", "#ef535088", candles, obLine, "OB"),
          hist(inst, "longSig", "sub", "#26a69a", candles, longHist, "AL"),
          hist(inst, "shortSig", "sub", "#ef5350", candles, shortHist, "SAT"),
          line(inst, "score", "sub", "#ffeb3b55", candles, s.score, "Skor"),
        ],
        {
          rsi: s.rsi,
          rsiIfvg: s.rsiIfvg,
          longSignal: s.longSignal,
          shortSignal: s.shortSignal,
          score: s.score,
        }
      );
      break;
    }
    case "ifvgSmi": {
      const s = computeIfvgSmi(candles, {
        k: n(p, "k", 14),
        d: n(p, "d", 20),
        ema: n(p, "ema", 5),
        os: n(p, "os", -40),
        ob: n(p, "ob", 40),
        swingStrength: n(p, "swingStrength", 2),
        maxInvLookforward: n(p, "maxInvLookforward", 40),
        maxRetestLookforward: n(p, "maxRetestLookforward", 30),
        lookbackFvgs: 0,
        maxHits: 0,
      });
      const osLine = candles.map(() => s.os as number | null);
      const obLine = candles.map(() => s.ob as number | null);
      const zeroLine = candles.map(() => 0 as number | null);
      const longHist = s.longSignal.map((v) => (v === 1 ? 1 : null));
      const shortHist = s.shortSignal.map((v) => (v === 1 ? -1 : null));
      push(
        [
          line(inst, "smi", "sub", color, candles, s.smi, "SMI"),
          line(inst, "sig", "sub", "#ff6d00", candles, s.signal, "Signal"),
          line(inst, "smiIfvg", "sub", "#7e57c2", candles, s.smiIfvg, "SMI·IFVG"),
          line(inst, "os", "sub", "#26a69a88", candles, osLine, "OS"),
          line(inst, "ob", "sub", "#ef535088", candles, obLine, "OB"),
          line(inst, "zero", "sub", "#787b8655", candles, zeroLine, "0"),
          hist(inst, "longSig", "sub", "#26a69a", candles, longHist, "AL"),
          hist(inst, "shortSig", "sub", "#ef5350", candles, shortHist, "SAT"),
          line(inst, "score", "sub", "#ffeb3b55", candles, s.score, "Skor"),
        ],
        {
          smi: s.smi,
          signal: s.signal,
          smiIfvg: s.smiIfvg,
          longSignal: s.longSignal,
          shortSignal: s.shortSignal,
          score: s.score,
        }
      );
      break;
    }

    case "ifvgJurikStoch": {
      const s = computeIfvgJurikStoch(candles, {
        cycle: n(p, "cycle", 10),
        kLen: n(p, "kLen", 18),
        dLen: n(p, "dLen", 6),
        jmaLen: n(p, "jmaLen", 20),
        phase: n(p, "phase", 0),
        power: n(p, "power", 2),
        os: n(p, "os", 20),
        ob: n(p, "ob", 80),
        useKdCross: n(p, "useKdCross", 0) !== 0,
        swingStrength: n(p, "swingStrength", 2),
        maxInvLookforward: n(p, "maxInvLookforward", 40),
        maxRetestLookforward: n(p, "maxRetestLookforward", 30),
        lookbackFvgs: 0,
        maxHits: 0,
      });
      const osLine = candles.map(() => s.os as number | null);
      const obLine = candles.map(() => s.ob as number | null);
      const longHist = s.longSignal.map((v) => (v === 1 ? 1 : null));
      const shortHist = s.shortSignal.map((v) => (v === 1 ? -1 : null));
      // Pane markers for raw K level breaks (scaled near OS/OB for visibility)
      const markUp20 = s.breakUp20.map((v) => (v === 1 ? s.os : null));
      const markDn20 = s.breakDn20.map((v) => (v === 1 ? s.os : null));
      const markUp80 = s.breakUp80.map((v) => (v === 1 ? s.ob : null));
      const markDn80 = s.breakDn80.map((v) => (v === 1 ? s.ob : null));
      push(
        [
          line(inst, "k", "sub", color, candles, s.k, "%K"),
          line(inst, "d", "sub", "#ff6d00", candles, s.d, "%D"),
          line(inst, "kIfvg", "sub", "#7e57c2", candles, s.kIfvg, "K·IFVG"),
          line(inst, "os", "sub", "#26a69a88", candles, osLine, "OS"),
          line(inst, "ob", "sub", "#ef535088", candles, obLine, "OB"),
          hist(inst, "longSig", "sub", "#26a69a", candles, longHist, "AL"),
          hist(inst, "shortSig", "sub", "#ef5350", candles, shortHist, "SAT"),
          hist(inst, "breakUp20", "sub", "#69f0ae", candles, markUp20, "20↑"),
          hist(inst, "breakDn20", "sub", "#80cbc4", candles, markDn20, "20↓"),
          hist(inst, "breakUp80", "sub", "#ff8a80", candles, markUp80, "80↑"),
          hist(inst, "breakDn80", "sub", "#ff5252", candles, markDn80, "80↓"),
          line(inst, "score", "sub", "#ffeb3b55", candles, s.score, "Skor"),
        ],
        {
          k: s.k,
          d: s.d,
          kIfvg: s.kIfvg,
          longSignal: s.longSignal,
          shortSignal: s.shortSignal,
          score: s.score,
          breakUp20: s.breakUp20,
          breakDn20: s.breakDn20,
          breakUp80: s.breakUp80,
          breakDn80: s.breakDn80,
        }
      );
      break;
    }

    case "mavkRibbon": {
      const s = computeMavkIndicator(candles, {
        p1: n(p, "p1", 8),
        p2: n(p, "p2", 13),
        p3: n(p, "p3", 21),
        p4: n(p, "p4", 34),
        p5: n(p, "p5", 55),
        p6: n(p, "p6", 89),
        clusterPct: n(p, "clusterPct", 1.5) / 100,
        useSma: n(p, "useSma", 0) >= 1,
      });
      const clusterHist = s.clustered.map((v) => (v === 1 ? 1 : null));
      push(
        [
          line(inst, "ma1", "main", "#42a5f5", candles, s.ma1, "MA1"),
          line(inst, "ma2", "main", "#26a69a", candles, s.ma2, "MA2"),
          line(inst, "ma3", "main", "#66bb6a", candles, s.ma3, "MA3"),
          line(inst, "ma4", "main", "#ffa726", candles, s.ma4, "MA4"),
          line(inst, "ma5", "main", "#ef5350", candles, s.ma5, "MA5"),
          line(inst, "ma6", "main", "#ab47bc", candles, s.ma6, "MA6"),
          line(inst, "upper", "main", "#7e57c288", candles, s.upper, "Üst"),
          line(inst, "lower", "main", "#7e57c288", candles, s.lower, "Alt"),
          line(inst, "mid", "main", "#7e57c2", candles, s.mid, "MAVK Mid"),
          hist(inst, "cluster", "main", "#ab47bc55", candles, clusterHist, "Küme"),
        ],
        {
          ma1: s.ma1,
          ma2: s.ma2,
          ma3: s.ma3,
          ma4: s.ma4,
          ma5: s.ma5,
          ma6: s.ma6,
          upper: s.upper,
          lower: s.lower,
          mid: s.mid,
          clusterPct: s.clusterPct,
          clustered: s.clustered,
        }
      );
      break;
    }
    case "rSquared": {
      const s = computeRSquaredIndicator(candles, n(p, "period", 30));
      const riseHist = s.rising.map((v) => (v === 1 ? 1 : null));
      push(
        [
          line(inst, "r2", "sub", "#7e57c2", candles, s.r2, "R²"),
          line(inst, "low", "sub", "#26a69a88", candles, s.low, "Düşük"),
          line(inst, "mid", "sub", "#90a4ae55", candles, s.mid, "0.5"),
          hist(inst, "rising", "sub", "#26a69a", candles, riseHist, "↑"),
        ],
        { r2: s.r2, rising: s.rising }
      );
      break;
    }
    case "eliziEdge": {
      const eliziParams = {
        erLen: n(p, "erLen", 10),
        atrLen: n(p, "atrLen", 14),
        adxPeriod: n(p, "adxPeriod", 14),
        bbPeriod: n(p, "bbPeriod", 20),
        bbMult: n(p, "bbMult", 2),
        volLen: n(p, "volLen", 5),
        volLong: n(p, "volLong", 10),
        flowSmooth: n(p, "flowSmooth", 3),
        tempSmooth: n(p, "tempSmooth", 4),
        effHigh: n(p, "effHigh", 0.45),
        surpriseHigh: n(p, "surpriseHigh", 0.85),
        coherenceArmed: n(p, "coherenceArmed", 0.6),
        fireTemp: n(p, "fireTemp", 62),
        armedTemp: n(p, "armedTemp", 48),
        probeTemp: n(p, "probeTemp", 32),
      };
      const ee = eliziEdge(candles, eliziParams);
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      // ±E cross flags (same rules as eliziCrossMarkerSeries / detectEliziEdgeCross)
      const crosses = (() => {
        const nBars = ee.edgeUp.length;
        const crossUp: (number | null)[] = Array(nBars).fill(null);
        const crossDn: (number | null)[] = Array(nBars).fill(null);
        for (let i = 1; i < nBars; i++) {
          const a0 = ee.edgeUp[i - 1];
          const a1 = ee.edgeUp[i];
          const b0 = ee.edgeDown[i - 1];
          const b1 = ee.edgeDown[i];
          if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
          if (a0 <= b0 && a1 > b1) crossUp[i] = 1;
          if (a0 >= b0 && a1 < b1) crossDn[i] = 1;
        }
        return { crossUp, crossDn };
      })();
      const detailOn = String(p.detailMode ?? "0") === "1";
      // Soft palette (pastel / translucent — not neon)
      const SOFT_TEMP_UP = "#a5d6a755";
      const SOFT_TEMP_DN = "#ef9a9a55";
      const SOFT_TEMP_FLAT = "#b39ddb44";
      const SOFT_PHASE = "#ce93d844";
      const SOFT_UP = "#81c784";
      const SOFT_DN = "#e57373";
      // Scale for readable shared pane (0–100-ish)
      const coh100 = ee.coherence.map((v) => (v == null ? null : v * 100));
      const surScaled = ee.volSurprise.map((v) =>
        v == null ? null : Math.min(v * 40, 100)
      );
      const phaseScaled = ee.phase.map((v) => (v == null ? null : v * 20));
      // Soft hist: tint by bias (bull mint / bear coral / flat lavender)
      const tempHist = hist(inst, "edgeTemp", "sub", SOFT_TEMP_FLAT, candles, ee.edgeTemp, "Edge Temp");
      tempHist.data = tempHist.data.map((pt, i) => {
        if (!("value" in pt) || pt.value == null) return pt;
        const b = ee.bias[i];
        const c =
          b != null && b > 0
            ? SOFT_TEMP_UP
            : b != null && b < 0
              ? SOFT_TEMP_DN
              : SOFT_TEMP_FLAT;
        return { time: pt.time, value: pt.value, color: c };
      });
      const phaseHist = hist(inst, "phase", "sub", SOFT_PHASE, candles, phaseScaled, "Faz");
      phaseHist.data = phaseHist.data.map((pt) => {
        if (!("value" in pt) || pt.value == null) return pt;
        return { time: pt.time, value: pt.value, color: SOFT_PHASE };
      });
      const upLine = line(inst, "edgeUp", "sub", SOFT_UP, candles, ee.edgeUp, "Elizi +E");
      const markers: PlotMarker[] = [];
      if (showMarkers) {
        for (let i = 0; i < candles.length; i++) {
          const t = candles[i]!.time;
          if (crosses.crossUp[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: SOFT_UP,
              shape: "arrowUp",
              text: "AL",
            });
          }
          if (crosses.crossDn[i] === 1) {
            markers.push({
              time: t,
              position: "aboveBar",
              color: SOFT_DN,
              shape: "arrowDown",
              text: "SAT",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        upLine.markers = markers;
      }
      // Transparent main-pane series so AL/SAT also sits on price bars
      // (PatternOverlay owns candle setMarkers; this series is independent).
      const priceAnchor = candles.map((c, i) => {
        if (crosses.crossUp[i] === 1) return c.low;
        if (crosses.crossDn[i] === 1) return c.high;
        return null;
      });
      const priceMarks = line(
        inst,
        "crossMark",
        "main",
        "rgba(0,0,0,0)",
        candles,
        priceAnchor,
        ""
      );
      if (showMarkers && markers.length) {
        priceMarks.markers = markers;
      }
      const primary: PlotSeries[] = [
        tempHist,
        upLine,
        line(inst, "edgeDown", "sub", SOFT_DN, candles, ee.edgeDown, "Elizi −E"),
        phaseHist,
        ...(showMarkers && markers.length ? [priceMarks] : []),
      ];
      const detail: PlotSeries[] = detailOn
        ? [
            line(inst, "coherence", "sub", "#ce93d8aa", candles, coh100, "Uyum"),
            line(inst, "surprise", "sub", "#ffcc80aa", candles, surScaled, "Sürpriz"),
            line(
              inst,
              "efficiency",
              "sub",
              "#90a4ae99",
              candles,
              ee.pathEfficiency.map((v) => (v == null ? null : v * 100)),
              "Verim"
            ),
            line(inst, "diAccel", "sub", "#80deea", candles, ee.diAccel, "DI İvme"),
            line(
              inst,
              "flowAgree",
              "sub",
              "#c5e1a5",
              candles,
              ee.flowAgree.map((v) => (v == null ? null : v * 50)),
              "Akış"
            ),
          ]
        : [];
      push([...primary, ...detail], {
        edgeTemp: ee.edgeTemp,
        edgeUp: ee.edgeUp,
        edgeDown: ee.edgeDown,
        coherence: ee.coherence,
        volSurprise: ee.volSurprise,
        phase: ee.phase,
        bias: ee.bias,
        pathEfficiency: ee.pathEfficiency,
        diAccel: ee.diAccel,
        diAccel2: ee.diAccel2,
        bbPressure: ee.bbPressure,
        flowAgree: ee.flowAgree,
        diSpread: ee.diSpread,
        pctB: ee.pctB,
        adx: ee.adx,
        plusDI: ee.plusDI,
        minusDI: ee.minusDI,
        crossUp: crosses.crossUp,
        crossDn: crosses.crossDn,
      });
      break;
    }

    case "doktorHull": {
      const modeRaw = String(p.mode ?? "Hma");
      const mode =
        modeRaw === "Ehma" || modeRaw === "Thma" ? modeRaw : "Hma";
      const showRibbon = n(p, "showRibbon", 1) !== 0;
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const dh = computeDoktorHull(candles, { mode: mode as "Hma" | "Ehma" | "Thma" });
      const c8 = String(p.color8 ?? "#00ff00");
      const c13 = String(p.color13 ?? "#7cfc00");
      const c21 = String(p.color21 ?? "#ffff00");
      const c50 = String(p.color50 ?? "#ff8c00");
      const c100 = String(p.color100 ?? "#ff0000");
      const c200 = String(p.color200 ?? "#8b0000");
      const plots = showRibbon
        ? [
            line(inst, "h8", "main", c8, candles, dh.h8, "Hull 8"),
            line(inst, "h13", "main", c13, candles, dh.h13, "Hull 13"),
            line(inst, "h21", "main", c21, candles, dh.h21, "Hull 21"),
            line(inst, "h50", "main", c50, candles, dh.h50, "Hull 50"),
            line(inst, "h100", "main", c100, candles, dh.h100, "Hull 100"),
            line(inst, "h200", "main", c200, candles, dh.h200, "Hull 200"),
          ]
        : [
            line(inst, "h21", "main", c21, candles, dh.h21, "Hull 21"),
            line(inst, "h50", "main", c50, candles, dh.h50, "Hull 50"),
          ];
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const t = candles[i]!.time;
          if (dh.chartBuy[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: "#7cff7c",
              shape: "arrowUp",
              text: "AL",
            });
          }
          if (dh.chartSell[i] === 1) {
            markers.push({
              time: t,
              position: "aboveBar",
              color: "#ff5252",
              shape: "arrowDown",
              text: "SAT",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        if (plots[0]) plots[0].markers = markers;
      }
      push(plots, {
        h8: dh.h8,
        h13: dh.h13,
        h21: dh.h21,
        h50: dh.h50,
        h100: dh.h100,
        h200: dh.h200,
      });
      break;
    }


    case "bbDivLg": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const s = computeBbDivLg(candles, {
        bbLen: n(p, "bbLen", 20),
        bbMult: n(p, "bbMult", 2),
        rsiLen: n(p, "rsiLen", 14),
        rsiOS: n(p, "rsiOS", 30),
        divLbL: n(p, "divLbL", 5),
        divLbR: n(p, "divLbR", 5),
        divRangeLower: n(p, "divRangeLower", 5),
        lgWickMult: n(p, "lgWickMult", 2),
        lgVolMult: n(p, "lgVolMult", 1.3),
        useTrend: n(p, "useTrend", 1) !== 0,
        emaLen: n(p, "emaLen", 50),
        useADX: n(p, "useADX", 1) !== 0,
        adxLen: n(p, "adxLen", 14),
        adxMin: n(p, "adxMin", 20),
      });
      const lower = line(inst, "lowerBB", "main", "#42a5f5", candles, s.lowerBB, "BB Alt");
      const emaL = line(inst, "ema", "main", "#ab47bc", candles, s.ema, "EMA");
      const plots: PlotSeries[] = [lower, emaL];
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const t = candles[i]!.time;
          if (s.buy[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: "#76ff03",
              shape: "arrowUp",
              text: "BUY",
            });
          } else if (s.lg[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: "#ef5350",
              shape: "circle",
              text: "LG",
            });
          } else if (s.divBb[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: "#66bb6a",
              shape: "arrowUp",
              text: "DIV",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        if (plots[0]) plots[0].markers = markers;
      }
      push(plots, {
        lowerBB: s.lowerBB,
        midBB: s.midBB,
        upperBB: s.upperBB,
        ema: s.ema,
      });
      break;
    }

    case "maSimple": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const s = computeMaSimple(candles, {
        p20: n(p, "p20", 20),
        p50: n(p, "p50", 50),
        p100: n(p, "p100", 100),
        p200: n(p, "p200", 200),
      });
      const showEma10 = n(p, "showEma10", 0) !== 0;
      const plots: PlotSeries[] = [
        line(inst, "sma20", "main", "#42a5f5", candles, s.sma20, "SMA20"),
        line(inst, "sma50", "main", "#ab47bc", candles, s.sma50, "SMA50"),
        line(inst, "sma100", "main", "#ffa726", candles, s.sma100, "SMA100"),
        line(inst, "sma200", "main", "#ef5350", candles, s.sma200, "SMA200"),
      ];
      if (showEma10) {
        plots.push(
          line(inst, "ema10", "main", "#ffee58", candles, s.ema10, "EMA10")
        );
      }
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const t = candles[i]!.time;
          // SMA×SMA crosses → one arrow per bar (e.g. "20↑50 50↑200")
          const smaX = MA_SIMPLE_SMA_X.filter(([k]) => s[k][i] === 1).map(
            ([, txt]) => txt
          );
          if (smaX.length) {
            markers.push({
              time: t,
              position: "belowBar",
              color: smaX.some((x) => x.endsWith("200")) ? "#26a69a" : "#66bb6a",
              shape: "arrowUp",
              text: smaX.join(" "),
            });
          }
          // close×SMA crosses → one circle per bar (e.g. "Px↑20/100")
          const pxX = MA_SIMPLE_PX_X.filter(([k]) => s[k][i] === 1).map(
            ([, txt]) => txt
          );
          if (pxX.length) {
            markers.push({
              time: t,
              position: "belowBar",
              color: "#90caf9",
              shape: "circle",
              text: `Px↑${pxX.join("/")}`,
            });
          }
          if (showEma10 && s.ema10_x_sma20[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: "#ffee58",
              shape: "arrowUp",
              text: "E10↑20",
            });
          } else if (showEma10 && s.ema10_x_sma20_dn[i] === 1) {
            markers.push({
              time: t,
              position: "aboveBar",
              color: "#ff7043",
              shape: "arrowDown",
              text: "E10↓20",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        if (plots[0]) plots[0].markers = markers;
      }
      push(plots, {
        sma20: s.sma20,
        sma50: s.sma50,
        sma100: s.sma100,
        sma200: s.sma200,
        ...(showEma10 ? { ema10: s.ema10 } : {}),
      });
      break;
    }

    case "pdo": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const showPatterns = n(p, "showPatterns", 1) !== 0;
      const P = resolvePdoOpts({
        stochWeight: n(p, "stochWeight", 70),
        smooth: n(p, "smooth", 2),
        crossMode: p.crossMode === "ema" ? "ema" : "kd",
        low: n(p, "low", 30),
        high: n(p, "high", 70),
      });
      const k = pdoCandlesToK(candles);
      const ser = computePdoSeries(k, P);
      const N = candles.length;
      const lvl = (v: number) => new Array<number | null>(N).fill(v);
      const showPD = n(p, "showPD", 1) !== 0;
      const showTrend = n(p, "showTrend", 1) !== 0;
      const trendColor = n(p, "trendColor", 0) !== 0;
      const showOld = n(p, "showOld", 0) !== 0;
      const GREEN = "#16a34a";
      const RED = "#dc2626";
      const plots: PlotSeries[] = [];
      if (showPD) {
        // Referans moveOscSeries: 50 tabanlı P (yeşil) ve D (kırmızı) çubuklar + çizgiler.
        const bar = (key: string, arr: number[], col: string): PlotSeries => ({
          id: `${inst.id}-${key}`,
          pane: "sub",
          type: "histogram",
          color: col,
          base: 50,
          data: candles.map((c, i) => (Number.isFinite(arr[i]!) ? { time: c.time, value: arr[i]! } : { time: c.time })),
          title: "",
          seriesKey: key,
          indicatorId: inst.id,
        });
        plots.push(bar("pumpBar", ser.pump, "rgba(22,163,74,0.34)"));
        plots.push(bar("dumpBar", ser.dump, "rgba(220,38,38,0.34)"));
        const pl = line(inst, "pump", "sub", GREEN, candles, pdoToNullable(ser.pump), "P");
        const dl = line(inst, "dump", "sub", RED, candles, pdoToNullable(ser.dump), "D");
        pl.lineWidth = 1;
        dl.lineWidth = 1;
        plots.push(pl, dl);
      }
      const pdoLine = line(inst, "pdo", "sub", "#2563eb", candles, pdoToNullable(ser.raw), "PDO");
      if (trendColor) {
        // İsteğe bağlı: PDO çizgisi P>D iken yeşil, D>P iken kırmızı (referansta yok).
        pdoLine.data = pdoLine.data.map((pt, i) =>
          "value" in pt && Number.isFinite(ser.pump[i]!) && Number.isFinite(ser.dump[i]!)
            ? { ...pt, color: ser.pump[i]! > ser.dump[i]! ? GREEN : RED }
            : pt
        );
      }
      plots.push(
        pdoLine,
        line(inst, "signal", "sub", "#ff6d00", candles, pdoToNullable(ser.signal), "Sinyal"),
        line(inst, "lvlLow", "sub", "#26a69a88", candles, lvl(P.low), String(P.low)),
        line(inst, "lvl50", "sub", "#787b8655", candles, lvl(50), "50"),
        line(inst, "lvlHigh", "sub", "#ef535088", candles, lvl(P.high), String(P.high))
      );
      const markers: PlotMarker[] = [];
      if (showTrend && N > 1) {
        // Trend kesişimi: yeşil P çizgisi kırmızı D'yi yukarı keser → trend↑; tersi → trend↓.
        for (let i = 1; i < N; i++) {
          const a0 = ser.pump[i - 1]!, a1 = ser.pump[i]!, b0 = ser.dump[i - 1]!, b1 = ser.dump[i]!;
          if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(b0) || !Number.isFinite(b1)) continue;
          if (a0 <= b0 && a1 > b1)
            markers.push({ time: candles[i]!.time, position: "belowBar", color: GREEN, shape: "circle", text: "T↑" });
          else if (a0 >= b0 && a1 < b1)
            markers.push({ time: candles[i]!.time, position: "aboveBar", color: RED, shape: "circle", text: "T↓" });
        }
      }
      if (showOld && N > 1) {
        const o = computePdoSeries(k, { ...P, crossMode: "ema", smooth: 5, signal: 5 });
        for (const e of pdoCrossEvents(o.raw, o.signal, null)) {
          markers.push({
            time: candles[e.index]!.time,
            position: e.direction === "up" ? "belowBar" : "aboveBar",
            color: e.direction === "up" ? "#65a30d" : "#b91c1c",
            shape: "square",
            text: e.direction === "up" ? "E↑" : "E↓",
          });
        }
      }
      const zone = pdoZoneOf(P);
      if (showMarkers && N > 1) {
        for (const e of pdoCrossEvents(ser.raw, ser.signal, zone)) {
          const v = ser.raw[e.index]!;
          markers.push({
            time: candles[e.index]!.time,
            position: e.direction === "up" ? "belowBar" : "aboveBar",
            color: e.direction === "up" ? GREEN : RED,
            shape: e.direction === "up" ? "arrowUp" : "arrowDown",
            text: `${e.direction === "up" ? "AL" : "SAT"} ${Math.round(v)}`,
          });
        }
        // T10: durumun açıldığı mum (kesişim + ayrı mumda alt bant)
        const bb = pdoRefBoll(k.c, P.bollLen, P.bollMult);
        let prevUp = false;
        let prevDn = false;
        for (let m = 1; m < N; m++) {
          const up = !!pdoSeparatedBandAt(k, ser.raw, ser.signal, bb.lo, m + 1, "up", P.t10SignalBars, P.t10BandWindow, P.t10BandTol, zone);
          const dn = !!pdoSeparatedBandAt(k, ser.raw, ser.signal, bb.lo, m + 1, "down", P.t10SignalBars, P.t10BandWindow, P.t10BandTol, zone);
          if (up && !prevUp)
            markers.push({ time: candles[m]!.time, position: "belowBar", color: "#7c3aed", shape: "circle", text: "T10" });
          if (dn && !prevDn)
            markers.push({ time: candles[m]!.time, position: "aboveBar", color: "#7c3aed", shape: "circle", text: "T10" });
          prevUp = up;
          prevDn = dn;
        }
      }
      if (showPatterns && N > 30) {
        const pat = computePdoPatterns(k, ser.raw, {
          bars: P.patternBars,
          pivot: P.pivot,
          tol: P.tol,
          rise: P.rise,
          divMin: P.divMin,
          live: P.live,
          touch: P.touch,
          from: 0,
        });
        const all: PdoPatternEvent[] = [
          ...pat.ua,
          ...pat.us,
          ...pat.uaLive,
          ...pat.usLive,
          ...pat.doubleBottom,
          ...pat.tripleBottom,
          ...pat.doubleTop,
          ...pat.tripleTop,
        ].sort((x, y) => x.to - y.to);
        for (const e of all) {
          markers.push({
            time: candles[e.to]!.time,
            position: e.side === "buy" ? "belowBar" : "aboveBar",
            color: e.side === "buy" ? "#00c853" : "#ff1744",
            shape: "square",
            text: e.live ? `${e.label}*` : e.label,
          });
        }
        // Son 3 yapı için pivot çizgileri (fiyat + PDO paneli), hafif tut.
        const seg = (a: number, b: number, va: number, vb: number) => {
          const vals: (number | null)[] = new Array(N).fill(null);
          for (let i = a; i <= b; i++) vals[i] = va + ((vb - va) * (i - a)) / Math.max(1, b - a);
          return vals;
        };
        all.slice(-3).forEach((e, i) => {
          const col = e.side === "buy" ? "#00c853" : "#ff1744";
          plots.push(line(inst, `patPx${i}`, "main", col, candles, seg(e.from, e.to, e.priceFrom, e.priceTo), i === 0 ? "PDO yapı" : ""));
          plots.push(line(inst, `patOsc${i}`, "sub", col, candles, seg(e.from, e.to, e.oscFrom, e.oscTo), ""));
        });
      }
      markers.sort((a, b) => a.time - b.time);
      if (markers.length) pdoLine.markers = markers;
      push(plots, {
        pdo: pdoToNullable(ser.raw),
        signal: pdoToNullable(ser.signal),
        pump: pdoToNullable(ser.pump),
        dump: pdoToNullable(ser.dump),
      });
      break;
    }

    case "kijunBb": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const k = computeKijunBb(candles, {
        basePeriods: n(p, "basePeriods", 26),
        bbLength: n(p, "bbLength", 24),
        bbStdDev: n(p, "bbStdDev", 2),
      });
      const plots: PlotSeries[] = [
        line(inst, "kijun", "main", "#2962ff", candles, k.kijun, "Kijun"),
        line(inst, "basis", "main", "#ef5350", candles, k.basis, "BB orta"),
        line(inst, "upper", "main", "#42a5f5", candles, k.upper, "BB üst"),
        line(inst, "lower", "main", "#42a5f5", candles, k.lower, "BB alt"),
      ];
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const t = candles[i]!.time;
          if (k.kijun_mid_up[i] === 1) {
            markers.push({ time: t, position: "belowBar", color: "#26a69a", shape: "arrowUp", text: "K↑" });
          } else if (k.kijun_mid_dn[i] === 1) {
            markers.push({ time: t, position: "aboveBar", color: "#ef5350", shape: "arrowDown", text: "K↓" });
          }
          if (k.px_lower_up[i] === 1) {
            markers.push({ time: t, position: "belowBar", color: "#90caf9", shape: "circle", text: "alt↑" });
          } else if (k.px_lower_dn[i] === 1) {
            markers.push({ time: t, position: "aboveBar", color: "#ff7043", shape: "circle", text: "alt↓" });
          } else if (k.px_upper_up[i] === 1) {
            markers.push({ time: t, position: "belowBar", color: "#66bb6a", shape: "circle", text: "üst↑" });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        if (plots[0]) plots[0].markers = markers;
      }
      push(plots, {
        kijun: k.kijun,
        basis: k.basis,
        upper: k.upper,
        lower: k.lower,
      });
      break;
    }

    case "multiDipBb": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const showSr = n(p, "showSr", 1) !== 0;
      const md = computeMultiDipBb(candles, {
        lbL: n(p, "lbL", 3),
        lbR: n(p, "lbR", 3),
        bbLength: n(p, "bbLength", 20),
        bbMult: n(p, "bbMult", 2),
        bbProximity: n(p, "bbProximity", 0.5),
        dipSensitivity: n(p, "dipSensitivity", 1.5),
        minDipDistance: n(p, "minDipDistance", 5),
        maxDipDistance: n(p, "maxDipDistance", 30),
        rsiOversold: n(p, "rsiOversold", 40),
        srTolAtr: n(p, "srTolAtr", 0.75),
        srTolPct: n(p, "srTolPct", 0.35),
        majBreakLookback: n(p, "majBreakLookback", 20),
        breakComboBars: n(p, "breakComboBars", 8),
      });
      const lower = line(inst, "lowerBB", "main", "#42a5f5", candles, md.lowerBB, "BB Alt");
      const zone = line(inst, "captureZone", "main", "#90caf9", candles, md.captureZone, "Yakalama");
      const plots: PlotSeries[] = [lower, zone];
      if (showSr) {
        const last = candles.length - 1;
        // Same raster as diagonalSr — DiagSeg uses i0/p0/p1
        const rasterDiag = (seg: {
          i0: number;
          p0: number;
          p1: number;
        }) => {
          const vals: (number | null)[] = new Array(candles.length).fill(null);
          if (last < 0 || last === seg.i0) return vals;
          for (let i = seg.i0; i <= last; i++) {
            vals[i] =
              seg.p0 + ((seg.p1 - seg.p0) * (i - seg.i0)) / (last - seg.i0);
          }
          return vals;
        };
        const colorSup = "#7BCB8B";
        const colorRes = "#ff77ad";
        const colorFlat = "#26a69a";
        // Always draw nearest continuous support used by the scan (diagonalSr fallback)
        const hasSupLine = md.supportLine.some((v) => v != null);
        if (hasSupLine) {
          plots.push(
            line(
              inst,
              "support",
              "main",
              colorSup,
              candles,
              md.supportLine,
              "Destek"
            )
          );
        }
        const hasResLine = md.resistanceLine.some((v) => v != null);
        if (hasResLine) {
          plots.push(
            line(
              inst,
              "resistance",
              "main",
              colorRes,
              candles,
              md.resistanceLine,
              "Direnç"
            )
          );
        }
        // Fan segments (nearest already ranked in multiDipBb)
        md.linesSup.slice(0, 4).forEach((seg, i) => {
          plots.push(
            line(
              inst,
              `sup${i}`,
              "main",
              colorSup,
              candles,
              rasterDiag(seg),
              i === 0 && !hasSupLine ? "Destek↘" : ""
            )
          );
        });
        md.linesRes.slice(0, 3).forEach((seg, i) => {
          plots.push(
            line(
              inst,
              `res${i}`,
              "main",
              "#ff77ad99",
              candles,
              rasterDiag(seg),
              i === 0 && !hasResLine ? "Direnç↘" : ""
            )
          );
        });
        // Horizontal flats — extend left so stubs are visible on the main pane
        md.flatSupports.slice(0, 4).forEach((flat, i) => {
          const vals: (number | null)[] = new Array(candles.length).fill(null);
          const start = Math.min(flat.i0, Math.max(0, last - 100));
          for (let j = start; j <= last; j++) vals[j] = flat.price;
          plots.push(
            line(
              inst,
              `flatSup${i}`,
              "main",
              colorFlat,
              candles,
              vals,
              i === 0 ? "Yatay destek" : ""
            )
          );
        });
        // Last-resort: if still no SR plots beyond BB, force nearest flat from pivots already in md
        const srCount = plots.length - 2;
        if (srCount <= 0 && md.flatSupports.length === 0 && candles.length > 0) {
          // should be rare — multiDipBb guarantees flats when pivots exist
        }
      }
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const tm = candles[i]!.time;
          if (md.dipBbBreak[i] === 1) {
            markers.push({
              time: tm,
              position: "belowBar",
              color: "#ffd54f",
              shape: "arrowUp",
              text: "Dip+Kırılım",
            });
          } else if (md.majResBreak[i] === 1) {
            markers.push({
              time: tm,
              position: "aboveBar",
              color: "#ea80fc",
              shape: "arrowUp",
              text: "Majör kırılım",
            });
          } else if (md.dipBbSr[i] === 1) {
            markers.push({
              time: tm,
              position: "belowBar",
              color: "#00e676",
              shape: "arrowUp",
              text: "BB+S/R",
            });
          } else if (md.dipSr[i] === 1) {
            markers.push({
              time: tm,
              position: "belowBar",
              color: "#69f0ae",
              shape: "circle",
              text: "Dip+S/R",
            });
          } else if (md.tripleDip[i] === 1) {
            markers.push({
              time: tm,
              position: "belowBar",
              color: "#ff9800",
              shape: "arrowUp",
              text: "ÜÇLÜ",
            });
          } else if (md.doubleDip[i] === 1) {
            markers.push({
              time: tm,
              position: "belowBar",
              color: "#4caf50",
              shape: "arrowUp",
              text: "İKİLİ",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        if (plots[0]) plots[0].markers = markers;
      }
      push(plots, {
        lowerBB: md.lowerBB,
        captureZone: md.captureZone,
        midBB: md.midBB,
        support: md.supportLine,
        resistance: md.resistanceLine,
      });
      break;
    }

    case "macdEliziHybrid": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const h = macdEliziHybrid(candles, {
        fast: n(p, "fast", 12),
        slow: n(p, "slow", 26),
        signalPeriod: n(p, "signalPeriod", 9),
        wMacd: n(p, "wMacd", 0.6),
        wElizi: n(p, "wElizi", 0.4),
        normLen: n(p, "normLen", 50),
        hybridSignal: n(p, "hybridSignal", 5),
        erLen: n(p, "erLen", 10),
        atrLen: n(p, "atrLen", 14),
        adxPeriod: n(p, "adxPeriod", 14),
      });
      const SOFT_UP = "#81c784";
      const SOFT_DN = "#e57373";
      const SOFT_HIST_UP = "#a5d6a766";
      const SOFT_HIST_DN = "#ef9a9a66";
      const hybridLine = line(inst, "hybrid", "sub", "#7e57c2", candles, h.hybrid, "M×E Hybrid");
      const sigLine = line(inst, "sig", "sub", "#ffb74d", candles, h.signal, "M×E Signal");
      const histPlot = hist(inst, "hist", "sub", SOFT_HIST_UP, candles, h.hist, "M×E Hist");
      histPlot.data = histPlot.data.map((pt) => {
        if (!("value" in pt) || pt.value == null) return pt;
        return {
          time: pt.time,
          value: pt.value,
          color: pt.value >= 0 ? SOFT_HIST_UP : SOFT_HIST_DN,
        };
      });
      const plots: PlotSeries[] = [
        hybridLine,
        sigLine,
        histPlot,
        line(inst, "macdNorm", "sub", "#90caf9aa", candles, h.macdNorm, "MACDⁿ"),
        line(inst, "eliziNorm", "sub", "#ce93d8aa", candles, h.eliziNorm, "Eliziⁿ"),
      ];
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const t = candles[i]!.time;
          if (h.crossUp[i] === 1) {
            markers.push({
              time: t,
              position: "belowBar",
              color: SOFT_UP,
              shape: "arrowUp",
              text: "AL",
            });
          }
          if (h.crossDn[i] === 1) {
            markers.push({
              time: t,
              position: "aboveBar",
              color: SOFT_DN,
              shape: "arrowDown",
              text: "SAT",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        hybridLine.markers = markers;
        const priceAnchor = candles.map((c, i) => {
          if (h.crossUp[i] === 1) return c.low;
          if (h.crossDn[i] === 1) return c.high;
          return null;
        });
        const priceMarks = line(
          inst,
          "crossMark",
          "main",
          "rgba(0,0,0,0)",
          candles,
          priceAnchor,
          ""
        );
        if (markers.length) priceMarks.markers = markers;
        if (markers.length) plots.push(priceMarks);
      }
      push(plots, {
        hybrid: h.hybrid,
        signal: h.signal,
        hist: h.hist,
        macdNorm: h.macdNorm,
        eliziNorm: h.eliziNorm,
        crossUp: h.crossUp,
        crossDn: h.crossDn,
      });
      break;
    }

    case "elderRay": {
      const e = elderRay(candles, n(p, "period", 13));
      push(
        [
          hist(inst, "bull", "sub", "#26a69a", candles, e.bull, "Bull Power"),
          hist(inst, "bear", "sub", "#ef5350", candles, e.bear, "Bear Power"),
          line(inst, "ema", "main", "#78909c", candles, e.ema, "Elder EMA"),
        ],
        { bull: e.bull, bear: e.bear, ema: e.ema }
      );
      break;
    }
    case "rsiPuNu": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const r = computeRsiPuNu(candles, {
        rsiLen: n(p, "rsiLen", 14),
        lbL: n(p, "lbL", 15),
        lbR: n(p, "lbR", 2),
        rangeLower: n(p, "rangeLower", 15),
        rangeUpper: n(p, "rangeUpper", 60),
      });
      const plots: PlotSeries[] = [
        line(inst, "rsi", "sub", color, candles, r.rsi, "RSI"),
        line(inst, "lvl30", "sub", "#26a69a55", candles, candles.map(() => 30 as number | null), "30"),
        line(inst, "lvl70", "sub", "#ef535055", candles, candles.map(() => 70 as number | null), "70"),
      ];
      if (showMarkers) {
        plots.push(
          hist(inst, "pu", "sub", "#69f0ae", candles, r.pu, "PU"),
          hist(inst, "nu", "sub", "#ff5252", candles, r.nu, "NU")
        );
      }
      push(plots, {
        rsi: r.rsi,
        pu: r.pu,
        nu: r.nu,
        pivotLow: r.pivotLow,
        pivotHigh: r.pivotHigh,
      });
      break;
    }
    case "descendingBreak": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const srOn = n(p, "srBoxes", 1) !== 0;
      const d = computeDescendingBreak(candles, {
        lookback: n(p, "lookback", 20),
        srBoxes: srOn,
      });
      const plots: PlotSeries[] = [
        line(inst, "trend", "main", "#ff9800", candles, d.trend, "Düşen TL"),
      ];
      if (srOn) {
        plots.push(
          line(inst, "resBox", "main", "#ef535088", candles, d.resBox, "Direnç"),
          line(inst, "supBox", "main", "#26a69a88", candles, d.supBox, "Destek")
        );
      }
      const trendLine = plots[0]!;
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          if (d.breakOut[i] === 1) {
            markers.push({
              time: candles[i]!.time,
              position: "belowBar",
              color: "#69f0ae",
              shape: "arrowUp",
              text: "Break Out",
            });
          }
        }
        markers.sort((a, b) => a.time - b.time);
        if (markers.length) trendLine.markers = markers;
        // Anchor marks on price
        const priceAnchor = candles.map((c, i) =>
          d.breakOut[i] === 1 ? c.low : null
        );
        const priceMarks = line(
          inst,
          "breakMark",
          "main",
          "rgba(0,0,0,0)",
          candles,
          priceAnchor,
          ""
        );
        if (markers.length) {
          priceMarks.markers = markers;
          plots.push(priceMarks);
        }
      }
      push(plots, {
        trend: d.trend,
        breakOut: d.breakOut,
        resBox: d.resBox,
        supBox: d.supBox,
        pivotHigh: d.pivotHigh,
        pivotLow: d.pivotLow,
      });
      break;
    }
    case "diagonalSr": {
      const showMarkers = n(p, "showMarkers", 0) !== 0;
      const d = computeDiagonalSr(candles, {
        pivotWindow: n(p, "pivotWindow", 6),
        historyBars: n(p, "historyBars", 300),
        left: n(p, "left", 30),
        right: n(p, "right", 30),
      });
      const last = candles.length - 1;
      const plots: PlotSeries[] = [];
      const raster = (seg: { i0: number; p0: number; t1: number; p1: number }) => {
        const vals: (number | null)[] = new Array(candles.length).fill(null);
        if (last < 0 || last === seg.i0) return vals;
        for (let i = seg.i0; i <= last; i++) {
          vals[i] = seg.p0 + ((seg.p1 - seg.p0) * (i - seg.i0)) / (last - seg.i0);
        }
        return vals;
      };
      const c = (k: string, dflt: string) =>
        typeof p[k] === "string" && p[k] ? String(p[k]) : dflt;
      const colorSup = c("colorSup", "#7BCB8B");
      const colorRes = c("colorRes", "#ff77ad");
      d.linesSup.forEach((seg, i) => {
        plots.push(
          line(inst, `sup${i}`, "main", colorSup, candles, raster(seg), i === 0 ? "Destek" : "")
        );
      });
      d.linesRes.forEach((seg, i) => {
        plots.push(
          line(inst, `res${i}`, "main", colorRes, candles, raster(seg), i === 0 ? "Direnç" : "")
        );
      });
      if (!plots.length) {
        plots.push(line(inst, "support", "main", colorSup, candles, d.support, "Destek"));
      }
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        const from = Math.max(0, candles.length - 3);
        for (let i = from; i < candles.length; i++) {
          const tm = candles[i]!.time;
          if (d.bounceLong[i])
            markers.push({ time: tm, position: "belowBar", color: "#7BCB8B", shape: "arrowUp", text: "Temas" });
          if (d.bounceShort[i])
            markers.push({ time: tm, position: "aboveBar", color: "#ff77ad", shape: "arrowDown", text: "Temas" });
          if (d.breakLong[i])
            markers.push({ time: tm, position: "belowBar", color: "#69f0ae", shape: "arrowUp", text: "Kırılım" });
          if (d.breakShort[i])
            markers.push({ time: tm, position: "aboveBar", color: "#ff8a80", shape: "arrowDown", text: "Kırılım" });
          if (d.dbLong[i])
            markers.push({ time: tm, position: "belowBar", color: "#17ff27", shape: "circle", text: "İkili dip" });
          if (d.dtShort[i])
            markers.push({ time: tm, position: "aboveBar", color: "#ff77ad", shape: "circle", text: "İkili tepe" });
          if (d.tbLong[i])
            markers.push({ time: tm, position: "belowBar", color: "#2DD204", shape: "square", text: "Üçlü dip" });
          if (d.ttShort[i])
            markers.push({ time: tm, position: "aboveBar", color: "#ff1744", shape: "square", text: "Üçlü tepe" });
        }
        markers.sort((a, b) => a.time - b.time);
        if (markers.length) plots[0]!.markers = markers;
      }
      push(plots, {
        support: d.support,
        resistance: d.resistance,
      });
      break;
    }
    case "hamJurikTpo": {
      const showRaw = n(p, "showRawHam", 1) !== 0;
      const showHist = n(p, "showHistogram", 1) !== 0;
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const h = hamJurikTpo(candles, {
        hamLen: n(p, "hamLen", 21),
        hamLenSlow: n(p, "hamLenSlow", 34),
        rawLen: n(p, "rawLen", 10),
        rawLenSlow: n(p, "rawLenSlow", 21),
        momSpan: n(p, "momSpan", 10),
        normLen: n(p, "normLen", 80),
        jLen: n(p, "jLen", 20),
        jPhase: n(p, "jPhase", 0),
        postSmooth: n(p, "postSmooth", 5),
      });
      const c = (k: string, d: string) =>
        typeof p[k] === "string" && p[k] ? String(p[k]) : d;
      const colorOsc = c("colorOsc", "#18d0bd");
      const colorSlow = c("colorSlow", "#ffb74d");
      const colorRaw = c("colorRaw", "#8b95a899");
      const colorRawSlow = c("colorRawSlow", "#ce93d8");
      const colorHistUp = c("colorHistUp", "#00c878");
      const colorHistDn = c("colorHistDn", "#dc283c");
      const remapHist = (col: string | null) => {
        if (!col) return colorHistUp + "66";
        if (col === "#00c878") return colorHistUp;
        if (col === "#006446") return colorHistUp + "99";
        if (col === "#dc283c") return colorHistDn;
        if (col === "#8c1e28") return colorHistDn + "99";
        return col;
      };
      const oscLine = line(inst, "osc", "sub", colorOsc, candles, h.osc, "HAM Osc");
      oscLine.data = oscLine.data.map((pt, i) => {
        if (!("value" in pt) || pt.value == null) return pt;
        return {
          time: pt.time,
          value: pt.value,
          color: h.regime[i] === 1 ? colorOsc : "#cf1d3a",
        };
      });
      const plots: PlotSeries[] = [
        line(inst, "zero", "sub", "#8b95a888", candles, candles.map(() => 0), "0"),
        line(inst, "ob", "sub", "#ef535033", candles, candles.map(() => 60), "+60"),
        line(inst, "os", "sub", "#26a69a33", candles, candles.map(() => -60), "-60"),
        oscLine,
        line(inst, "oscSlow", "sub", colorSlow, candles, h.oscSlow, "HAM Yavaş"),
      ];
      if (showRaw) {
        plots.push(line(inst, "raw", "sub", colorRaw, candles, h.oscDisplay, "Raw hızlı"));
        plots.push(line(inst, "rawSlow", "sub", colorRawSlow, candles, h.rawSlow, "Raw yavaş"));
      }
      if (showHist) {
        const hp = hist(inst, "hist", "sub", colorHistUp + "66", candles, h.hist, "Hist");
        hp.data = hp.data.map((pt, i) => {
          if (!("value" in pt) || pt.value == null) return pt;
          return {
            time: pt.time,
            value: pt.value,
            color: remapHist(h.histColor[i]),
          };
        });
        plots.push(hp);
      }
      if (showMarkers) {
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          const tm = candles[i]!.time;
          if (h.bullFlip[i])
            markers.push({ time: tm, position: "belowBar", color: "#18d0bd", shape: "arrowUp", text: "AL" });
          if (h.bearFlip[i])
            markers.push({ time: tm, position: "aboveBar", color: "#cf1d3a", shape: "arrowDown", text: "SAT" });
          if (h.rawCrossOsc[i])
            markers.push({ time: tm, position: "belowBar", color: "#18d0bd", shape: "circle", text: "raw×osc" });
          if (h.rawCrossOscDown[i])
            markers.push({ time: tm, position: "aboveBar", color: "#cf1d3a", shape: "circle", text: "raw×osc" });
          if (h.dualCrossUp[i])
            markers.push({ time: tm, position: "belowBar", color: colorOsc, shape: "arrowUp", text: "H×Y" });
          if (h.dualCrossDown[i])
            markers.push({ time: tm, position: "aboveBar", color: colorSlow, shape: "arrowDown", text: "H×Y" });
          if (h.rawDualUp[i])
            markers.push({ time: tm, position: "belowBar", color: colorRaw, shape: "circle", text: "raw H×Y" });
          if (h.rawDualDown[i])
            markers.push({ time: tm, position: "aboveBar", color: colorRawSlow, shape: "circle", text: "raw H×Y" });
          if (h.rawSlowXOsc[i])
            markers.push({ time: tm, position: "belowBar", color: colorRawSlow, shape: "circle", text: "rawY×osc" });
          if (h.rawSlowXOscDown[i])
            markers.push({ time: tm, position: "aboveBar", color: colorRawSlow, shape: "circle", text: "rawY×osc" });
          if (h.oscFastZeroUp[i])
            markers.push({ time: tm, position: "belowBar", color: colorOsc, shape: "circle", text: "H0" });
          if (h.oscFastZeroDown[i])
            markers.push({ time: tm, position: "aboveBar", color: colorOsc, shape: "circle", text: "H0" });
          if (h.rawCrossHist[i])
            markers.push({ time: tm, position: "belowBar", color: "#81c784", shape: "circle", text: "raw×hist" });
        }
        if (markers.length) oscLine.markers = markers;
      }
      push(plots, { osc: h.osc, oscSlow: h.oscSlow, raw: h.oscDisplay, rawSlow: h.rawSlow, hist: h.hist });
      break;
    }

    case "hamAoJrmaZ": {
      const s = hamAoJrmaZ(candles, {
        hamMomLen: n(p, "hamMomLen", 21),
        volBaseLen: n(p, "volBaseLen", 34),
        hamPower: n(p, "hamPower", 1.2),
        aoFast: n(p, "aoFast", 5),
        aoSlow: n(p, "aoSlow", 34),
        hamWeight: n(p, "hamWeight", 0.6),
        aoWeight: n(p, "aoWeight", 0.4),
        trendLen: n(p, "trendLen", 34),
        trendBoost: n(p, "trendBoost", 1.3),
        preSmoothLen: n(p, "preSmoothLen", 3),
        jurikLen: n(p, "jurikLen", 8),
        rmaLen: n(p, "rmaLen", 13),
        postSmoothLen: n(p, "postSmoothLen", 2),
        zLen: n(p, "zLen", 89),
      });
      const cRma = String(p.colorRma ?? "#18d0bd");
      const cJurik = String(p.colorJurik ?? "#ffb74d");
      const cAo = String(p.colorAo ?? "#7e57c2");
      const cPos = String(p.colorPos ?? "#26a69a");
      const cNeg = String(p.colorNeg ?? "#ef5350");
      const plots = [
        line(inst, "zero", "sub", "#8b95a888", candles, candles.map(() => 0), "0"),
        line(inst, "aoSmooth", "sub", cAo, candles, s.aoSmooth, "AO debug"),
        line(inst, "jurikCore", "sub", cJurik, candles, s.jurikCore, "Jurik core"),
        line(inst, "rmaSignal", "sub", cRma, candles, s.rmaSignal, "RMA signal"),
        line(inst, "posTrend", "sub", cPos, candles, s.posTrend, "Pos trend"),
        line(inst, "negTrend", "sub", cNeg, candles, s.negTrend, "Neg trend"),
      ];
      push(plots, {
        aoSmooth: s.aoSmooth,
        jurikCore: s.jurikCore,
        rmaSignal: s.rmaSignal,
        posTrend: s.posTrend,
        negTrend: s.negTrend,
        blend: s.blend,
      });
      break;
    }

    case "aohamJrmaEngine": {
      const s = aohamJrmaEngine(candles, {
        hamMomLen: n(p, "hamMomLen", 21),
        volBaseLen: n(p, "volBaseLen", 34),
        hamPower: n(p, "hamPower", 1.2),
        aoFast: n(p, "aoFast", 5),
        aoSlow: n(p, "aoSlow", 34),
        wHam: n(p, "wHam", 0.6),
        wAo: n(p, "wAo", 0.4),
        trendLen: n(p, "trendLen", 34),
        trendBoost: n(p, "trendBoost", 1.3),
        jrmaLen: n(p, "jrmaLen", 8),
        jrmaPhase: n(p, "jrmaPhase", 0),
        jrmaPower: n(p, "jrmaPower", 2),
        jrmaRmaLen: n(p, "jrmaRmaLen", 13),
        preSmooth: n(p, "preSmooth", 3),
        postSmooth: n(p, "postSmooth", 2),
        normLen: n(p, "normLen", 40),
        zLen: n(p, "zLen", 89),
      });
      const cAo = String(p.colorAo ?? "#ff9800");
      const cRma = String(p.colorRma ?? "#e040fb");
      const cScore = String(p.colorScore ?? "#76ff03");
      const cScoreShort = String(p.colorScoreShort ?? "#ff1744");
      const cPos = String(p.colorPos ?? "#76ff03");
      const cNeg = String(p.colorNeg ?? "#ff1744");
      const cHam = String(p.colorHam ?? "#2979ff");
      const cDisplay = String(p.colorDisplay ?? "#ffffff");
      const plots = [
        line(inst, "mid50", "sub", "#8b95a888", candles, candles.map(() => 50), "50"),
        line(inst, "displayPlot", "sub", cDisplay, candles, s.displayPlot, "Display"),
        line(inst, "posPlot", "sub", cPos, candles, s.posPlot, "PT"),
        line(inst, "negPlot", "sub", cNeg, candles, s.negPlot, "NT"),
        line(inst, "scoreLongPlot", "sub", cScore, candles, s.scoreLongPlot, "Score L"),
        line(inst, "scoreShortPlot", "sub", cScoreShort, candles, s.scoreShortPlot, "Score S"),
        line(inst, "aoPlot", "sub", cAo, candles, s.aoPlot, "AO"),
        line(inst, "rawSigPlot", "sub", cRma, candles, s.rawSigPlot, "RMA"),
        line(inst, "hamPlot", "sub", cHam, candles, s.hamPlot, "HAM"),
      ];
      push(plots, {
        displayPlot: s.displayPlot,
        posPlot: s.posPlot,
        negPlot: s.negPlot,
        scoreLongPlot: s.scoreLongPlot,
        scoreShortPlot: s.scoreShortPlot,
        aoPlot: s.aoPlot,
        rawSigPlot: s.rawSigPlot,
        hamPlot: s.hamPlot,
        jurikCore: s.jurikCore,
        rmaSignal: s.rmaSignal,
        histSmooth: s.histSmooth,
      });
      break;
    }

    case "goldKeko": {
      const s = goldKeko(candles, {
        hamMomLen: n(p, "hamMomLen", 21),
        volBaseLen: n(p, "volBaseLen", 34),
        hamPower: n(p, "hamPower", 1.2),
        aoFast: n(p, "aoFast", 5),
        aoSlow: n(p, "aoSlow", 34),
        hamWeight: n(p, "hamWeight", 0.6),
        aoWeight: n(p, "aoWeight", 0.4),
        bbLen: n(p, "bbLen", 20),
        bbMult: n(p, "bbMult", 2),
        kcLen: n(p, "kcLen", 20),
        kcMult: n(p, "kcMult", 1.5),
        peLen: n(p, "peLen", 100),
        compressionThresh: n(p, "compressionThresh", 0.5),
        cmfLen: n(p, "cmfLen", 21),
        polarWeightCMF: n(p, "polarWeightCMF", 0.6),
        polarWeightHam: n(p, "polarWeightHam", 0.4),
        preSmoothLen: n(p, "preSmoothLen", 3),
        jurikLen: n(p, "jurikLen", 8),
        rmaLen: n(p, "rmaLen", 13),
        postSmoothLen: n(p, "postSmoothLen", 2),
        zLen: n(p, "zLen", 89),
        displaySignalLen: n(p, "displaySignalLen", 5),
        histScale: n(p, "histScale", 18),
        minChargeForSignal: n(p, "minChargeForSignal", 30),
      });
      const cHam = String(p.colorHam ?? "#e91e8c");
      const cCore = String(p.colorCore ?? "#212121");
      const cRma = String(p.colorRma ?? "#2196f3");
      const cDisp = String(p.colorDisp ?? "#ffffff");
      const cHistUp = String(p.colorHistUp ?? "#76ff03");
      const plots = [
        line(inst, "zero", "sub", "#8b95a888", candles, candles.map(() => 0), "0"),
        line(inst, "oscRawDebug", "sub", cHam, candles, s.oscRawDebug, "HAM/Raw"),
        line(inst, "oscMain", "sub", cCore, candles, s.oscMain, "Core"),
        line(inst, "oscSignal", "sub", cRma, candles, s.oscSignal, "RMA"),
        line(inst, "oscDisplay", "sub", cDisp, candles, s.oscDisplay, "Display"),
        line(inst, "energyTank", "sub", "#9e9e9e", candles, s.energyTank, "Tank"),
        line(inst, "histPlot", "sub", cHistUp, candles, s.histPlot, "Hist"),
      ];
      push(plots, {
        oscMain: s.oscMain,
        oscDisplay: s.oscDisplay,
        oscSignal: s.oscSignal,
        oscRawDebug: s.oscRawDebug,
        energyTank: s.energyTank,
        histPlot: s.histPlot,
        kineticRaw: s.kineticRaw,
        kineticCore: s.kineticCore,
        kineticSignal: s.kineticSignal,
      });
      break;
    }
    case "descendingBreakV2": {
      const showMarkers = n(p, "showMarkers", 1) !== 0;
      const r = computeDescendingBreakV2(candles, {
        cooldownBars: n(p, "cooldownBars", 10),
      });
      const plots: PlotSeries[] = [
        line(inst, "ema5", "main", "#81c784", candles, r.ema5, "EMA5"),
        line(inst, "ema20", "main", "#64b5f6", candles, r.ema20, "EMA20"),
        line(inst, "ema50", "main", "#ffb74d", candles, r.ema50, "EMA50"),
      ];
      if (showMarkers) {
        const mark = r.signal.map((v, i) =>
          v === 1 ? candles[i]!.low : null
        );
        const markers: PlotMarker[] = [];
        for (let i = 0; i < candles.length; i++) {
          if (r.signal[i] !== 1) continue;
          markers.push({
            time: candles[i]!.time,
            position: "belowBar",
            color: "#81c784",
            shape: "arrowUp",
            text: "AL",
          });
        }
        const markLine = line(
          inst,
          "alMark",
          "main",
          "rgba(0,0,0,0)",
          candles,
          mark,
          ""
        );
        markLine.markers = markers;
        plots.push(markLine);
      }
      push(plots, {
        ema5: r.ema5,
        ema20: r.ema20,
        ema50: r.ema50,
        signal: r.signal,
      });
      break;
    }
    default:
      break;
  }

  cache.set(inst.id, store);
  return out;
}

function resolvePaneTarget(
  inst: IndicatorInstance,
  byId: Map<string, IndicatorInstance>
): { pane: "main" | "sub"; paneGroup?: string } {
  const chain: IndicatorInstance[] = [inst];
  let cur = inst;
  const seen = new Set<string>([inst.id]);
  while (cur.source?.type === "indicator") {
    const parent = byId.get(cur.source.indicatorId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.push(parent);
    cur = parent;
  }
  // Prefer root-most sub ancestor so children stay in parent sub panel
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i];
    if (node.type === "custom") continue;
    const m = BUILTIN_META[node.type as BuiltinIndicatorId];
    if (m?.pane === "sub") {
      return { pane: "sub", paneGroup: node.id };
    }
  }
  if (inst.type !== "custom") {
    const m = BUILTIN_META[inst.type as BuiltinIndicatorId];
    if (m?.pane === "sub") return { pane: "sub", paneGroup: inst.id };
  }
  return { pane: "main" };
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
    const target = resolvePaneTarget(ind, byId);
    let plots: PlotSeries[] = [];
    try {
      plots = computeBuiltin(ind, candles, cache);
    } catch (e) {
      console.warn("indicator compute failed", ind.type, e);
      continue;
    }
    const nestedOnSub =
      target.pane === "sub" && target.paneGroup != null && target.paneGroup !== ind.id;
    for (const p of plots) {
      if (nestedOnSub) {
        // Child of a sub indicator stays in the parent's sub panel
        p.pane = "sub";
        p.paneGroup = target.paneGroup;
      } else if (p.pane === "sub") {
        // Each top-level sub (or sub-series from a main indicator) gets its own panel group
        p.paneGroup = p.paneGroup ?? target.paneGroup ?? ind.id;
      }
      p.indicatorId = ind.id;
      all.push(p);
    }
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
