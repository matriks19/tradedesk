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

export type BuiltinIndicatorId =
  | "sma"
  | "ema"
  | "rsi"
  | "macd"
  | "bollinger"
  | "atr"
  | "stochastic"
  | "vwap"
  | "supertrend"
  | "donchian"
  | "hull"
  | "volumeOsc"
  | "stochRsi";

export interface IndicatorInstance {
  id: string;
  type: BuiltinIndicatorId | "custom";
  name: string;
  params: Record<string, number | string>;
  visible: boolean;
  scriptId?: string;
  color?: string;
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
