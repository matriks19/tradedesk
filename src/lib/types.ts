export type Exchange = "binance" | "bist";

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "1w";

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
  timeframe: Timeframe;
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
  | "cumDelta";

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
