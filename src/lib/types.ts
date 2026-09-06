export type Exchange = "binance" | "bist";

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "3h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w";

/** Native Timeframe or custom like "90m" / "5h" (chart pane). */
export type ChartTimeframe = Timeframe | (string & {});

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerQuote {
  symbol: string;
  exchange: Exchange;
  last: number;
  changePct: number;
  high24h?: number;
  low24h?: number;
  volume?: number;
  quoteVolume?: number;
  delayed?: boolean;
}

export interface SymbolInfo {
  symbol: string;
  exchange: Exchange;
  base?: string;
  quote?: string;
  name?: string;
}

export type LayoutMode = 1 | 2 | 4 | 6 | 9;

export interface PaneConfig {
  id: string;
  symbol: string;
  exchange: Exchange;
  /** Native TF or custom e.g. 90m, 5h */
  timeframe: ChartTimeframe;
  indicators: IndicatorInstance[];
}

/** TradingView-style indicator taxonomy */
export type IndicatorCategory =
  | "ma"
  | "bands"
  | "momentum"
  | "trend"
  | "volatility"
  | "volume"
  | "bill_williams"
  | "levels"
  | "jurik"
  | "bigbeluga"
  | "proreal"
  | "lab"
  | "other";

export type PriceField = "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4";

export type IndicatorSource =
  | { type: "price"; field: PriceField }
  | { type: "indicator"; indicatorId: string; seriesKey?: string };

export type BuiltinIndicatorId =
  // Moving averages
  | "sma"
  | "ema"
  | "wma"
  | "vwma"
  | "smma"
  | "dema"
  | "tema"
  | "hma"
  | "alma"
  | "linreg"
  | "mcginley"
  | "tma"
  | "vma"
  | "zlema"
  | "maCross"
  // Bands / channels
  | "bollinger"
  | "keltner"
  | "donchian"
  | "envelope"
  | "priceChannel"
  | "stddevBands"
  | "fibChannel"
  | "regChannel"
  // Momentum / oscillators
  | "rsi"
  | "rsiLevelBreaks"
  | "stochastic"
  | "stochRsi"
  | "macd"
  | "cci"
  | "roc"
  | "momentum"
  | "williamsR"
  | "ultimateOsc"
  | "tsi"
  | "ppo"
  | "cmo"
  | "connorsRsi"
  | "fisher"
  | "wavetrend"
  | "trix"
  | "dpo"
  | "kst"
  | "rvi"
  // Trend
  | "supertrend"
  | "psar"
  | "adx"
  | "aroon"
  | "ichimoku"
  | "vortex"
  | "chandelier"
  | "trendStrength"
  | "heikinAshiSmooth"
  // Volatility
  | "atr"
  | "histVol"
  | "chaikinVol"
  | "massIndex"
  | "ulcerIndex"
  | "natr"
  | "bbWidth"
  | "bbPercentB"
  | "trueRange"
  | "stddev"
  // Volume
  | "obv"
  | "vwap"
  | "mfi"
  | "cmf"
  | "adl"
  | "chaikinOsc"
  | "volumeOsc"
  | "pvt"
  | "eom"
  | "forceIndex"
  | "klinger"
  | "netVolume"
  | "volumeDelta"
  // Bill Williams
  | "awesomeOsc"
  | "acceleratorOsc"
  | "alligator"
  | "fractals"
  | "gator"
  // Pivot / levels
  | "pivot"
  | "pivotFib"
  | "pivotCamarilla"
  | "pivotWoodie"
  | "pivotStandard"
  // Other
  | "highest"
  | "lowest"
  | "zigzag"
  // legacy alias kept for stored layouts
  | "cumDelta"
  // Jurik / Loxx-style (community)
  | "jma"
  | "doubleJma"
  | "jmaRibbon"
  | "jurikFilterBands"
  | "jurikVolty"
  | "jurikRsi"
  | "jurikRsx"
  | "jurikMacd"
  | "jurikCci"
  | "jurikBollinger"
  | "adaptiveJma"
  | "jurikQqe"
  | "superSmoother"
  | "jurikStoch"
  | "kaseStoch"
  | "jurikKaseStoch"
  | "jurikKaseStochPro"
  // BigBeluga / SMC-inspired
  | "orderBlocks"
  | "fairValueGaps"
  | "bosChoch"
  | "equalHighsLows"
  | "premiumDiscount"
  | "liquiditySweep"
  | "nautilusLike"
  | "voltixBands"
  | "flowTrend"
  | "moneyFlowComposite"
  | "channelDetect"
  | "highVolumePoints"
  // ProRealCode-inspired
  | "adaptiveSupertrend"
  | "adaptiveTrendChannel"
  | "qualityTrendTrail"
  | "qTrend"
  | "varWeightedReg"
  | "asymVolEnvelope"
  | "sweepReversalMap"
  | "initialBalance"
  | "fibGravityClusters"
  | "pacLiteStructure"
  | "rsiBbCombo"
  | "prtDmiPack"
  | "elderImpulse"
  | "laguerreRsi"
  | "coralTrend"
  | "nadarayaWatson"
  | "schaffTrendCycle"
  | "selfAwareTrail"
  | "adaptiveMacd"
  // Niche / az bilinen
  | "smi"
  | "coppock"
  | "vidya"
  | "frama"
  | "squeezeMomentum"
  | "softTrend"
  | "vfi"
  | "waddahAttar"
  | "halfTrend"
  | "sslChannel"
  | "rangeFilter"
  | "choppiness"
  | "bop"
  | "elderRay"
  | "adxPumpRadar"
  // Median / percentile (robust)
  | "rollingMedian"
  | "madBands"
  | "medianChannel"
  | "pliChannel"
  | "pliDeltaHybrid"
  // IFVG (Inversion FVG)
  | "ifvgZones"
  | "ifvgRsi"
  | "ifvgSmi"
  | "ifvgJurikStoch"
  // MAVK / R²
  | "mavkRibbon"
  | "rSquared"
  // Elizi Lab
  | "eliziEdge";

export interface IndicatorInputDef {
  key: string;
  label: string;
  type: "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
  options?: { value: string | number; label: string }[];
}

export interface IndicatorMeta {
  id: BuiltinIndicatorId;
  label: string;
  category: IndicatorCategory;
  pane: "main" | "sub";
  inputs: IndicatorInputDef[];
  /** Can accept a series input (indicator-on-indicator) */
  acceptsSeries?: boolean;
  /** Primary series key exposed for child indicators */
  primarySeriesKey?: string;
  /** Optional help / attribution shown in menus */
  description?: string;
}

export interface IndicatorInstance {
  id: string;
  type: BuiltinIndicatorId | "custom";
  name: string;
  params: Record<string, number | string>;
  visible: boolean;
  scriptId?: string;
  color?: string;
  source?: IndicatorSource;
  /** Parent indicator id when nested */
  parentId?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: { symbol: string; exchange: Exchange }[];
}

export type ScriptLanguage = "td" | "pine" | "js";

export interface CustomScript {
  id: string;
  name: string;
  /** Runnable TD Script or legacy JS */
  code: string;
  language: ScriptLanguage;
  /** Original paste (e.g. Pine) before conversion */
  originalCode?: string;
  originalLanguage?: ScriptLanguage;
  updatedAt: number;
  warnings?: string[];
}

export interface RiskSettings {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  accountSize: number;
  rMultiple: number;
}

export interface StoredLayout {
  mode: LayoutMode;
  panes: PaneConfig[];
  activePaneId: string;
}

export interface PatternSettings {
  swingStrength: number;
  twinTol: number;
  boxLookback: number;
  focusId: string | null;
}

export type AlertCondition = "above" | "below" | "cross_above" | "cross_below";

export interface PriceAlert {
  id: string;
  symbol: string;
  exchange: Exchange;
  condition: AlertCondition;
  price: number;
  active: boolean;
  note?: string;
  createdAt: number;
  triggeredAt?: number;
  lastPrice?: number;
}

export type DrawTool = "cursor" | "hline" | "trend" | "fib" | "measure" | "rect";

export interface ChartDrawing {
  id: string;
  paneId: string;
  tool: Exclude<DrawTool, "cursor">;
  points: { time: number; price: number }[]; // 1 for hline, 2 for trend/fib/measure/rect
  color: string;
  label?: string;
  /**
   * user = manual drawing; auto = system (formation / auto-fib).
   * New fib / formation open clears previous auto fibs; user drawings stay until temizle.
   */
  origin?: "user" | "auto";
}

export interface BotSettings {
  webhookUrl: string;
  enabled: boolean;
  secret?: string;
  /** Telegram chat id when webhookUrl is api.telegram.org/.../sendMessage */
  telegramChatId?: string;
}
