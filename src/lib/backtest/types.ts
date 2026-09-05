import type { Candle, Exchange, Timeframe } from "@/lib/types";

export type Regime = "Bull" | "Bear" | "Range";

export type StrategyPresetId =
  | "emaCross"
  | "rsiOsOb"
  | "macdCross"
  | "supertrendFlip"
  | "jurikKasePermission"
  | "bbBreak"
  | "emaRsiConfirm"
  | "zScorePullback"
  | "diAdxTrend"
  | "aroonLongTrend"
  | "jurikOsBounce"
  | "orbVwapFiltered"
  | "vwapBounce"
  | "rsi2MeanRev"
  | "donchianTurtle"
  | "supertrendAdx"
  | "adxPumpStages"
  | "codeStrategy"
  | "custom";

export interface BacktestParams {
  symbol: string;
  exchange: Exchange;
  timeframe: Timeframe;
  preset: StrategyPresetId;
  /** Custom: buy when close crosses above SMA(fast), etc. — used lightly */
  customRules?: {
    entryLong?: "emaCross" | "rsiOs" | "macdCross" | "stFlip";
    entryShort?: "emaCross" | "rsiOb" | "macdCross" | "stFlip";
  };
  /** Pasted strategy source (Pine-lite / TD) when preset === codeStrategy */
  strategyCode?: string;
  allowShort: boolean;
  /** Use ATR-based SL/TP (can combine with signal exits) */
  useAtrStops?: boolean;
  /** Honor exitLong/exitShort from strategy (default true for signal strategies) */
  useSignalExits?: boolean;
  slAtrMult: number;
  tpAtrMult: number;
  positionSize: number; // quote currency notional
  commissionBps: number;
  warmup: number;
  /** How many candles to fetch (max ~1000) */
  candleLimit?: number;
  /** Preset-specific knobs */
  fast?: number;
  slow?: number;
  rsiPeriod?: number;
  rsiOs?: number;
  rsiOb?: number;
  atrPeriod?: number;
  stMult?: number;
  bbPeriod?: number;
  bbMult?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  /** Z-score pullback */
  zLength?: number;
  regimeSMA?: number;
  entryZ?: number;
  exitZ?: number;
  /** ADX / Aroon */
  adxPeriod?: number;
  adxMin?: number;
  aroonPeriod?: number;
  /** ORB / session */
  orbBars?: number;
  /** Donchian / Turtle */
  donchianPeriod?: number;
  donchianExitPeriod?: number;
  /** RSI2 (+ optional SMA regime filter) */
  requireRegimeAbove?: boolean;
  /** VWAP bounce: max distance from VWAP as fraction of ATR (default 0.35) */
  vwapTouchAtr?: number;
  /** ADX Pump Radar stage knobs */
  momPeriod?: number;
  cciPeriod?: number;
  smoothLen?: number;
  medianLen?: number;
  adxWake?: number;
  adxConfirm?: number;
  fastSmooth?: number;
}

export interface BacktestTrade {
  id: string;
  side: "long" | "short";
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  rMultiple: number;
  reason: string;
  entryRegime: Regime;
  barsHeld: number;
}

export interface RegimeStats {
  regime: Regime;
  trades: number;
  wins: number;
  winRate: number;
  profitFactor: number;
  avgPnl: number;
  netPnl: number;
}

export interface BacktestSummary {
  netPnl: number;
  profitFactor: number;
  winRate: number;
  trades: number;
  wins: number;
  losses: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpe: number;
  avgR: number;
  expectancy: number;
  avgBarsHeld: number;
  avgWin: number;
  avgLoss: number;
  longTrades: number;
  shortTrades: number;
  longNetPnl: number;
  shortNetPnl: number;
  bestTrade: number;
  worstTrade: number;
}

export interface BacktestResult {
  params: BacktestParams;
  summary: BacktestSummary;
  byRegime: RegimeStats[];
  byHour: { hour: number; trades: number; netPnl: number; winRate: number }[];
  byDay: { day: number; trades: number; netPnl: number; winRate: number }[];
  byMonth: { key: string; trades: number; netPnl: number; winRate: number }[];
  equity: { time: number; equity: number }[];
  trades: BacktestTrade[];
  regimes: Regime[];
  ranAt: number;
  candleCount: number;
  codeWarnings?: string[];
}

export type SignalFn = (
  candles: Candle[],
  i: number,
  ctx: Record<string, unknown>
) => {
  long?: boolean;
  short?: boolean;
  exitLong?: boolean;
  exitShort?: boolean;
  reason?: string;
};
