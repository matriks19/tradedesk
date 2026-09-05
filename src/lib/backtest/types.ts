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
  allowShort: boolean;
  slAtrMult: number;
  tpAtrMult: number;
  positionSize: number; // quote currency notional
  commissionBps: number;
  warmup: number;
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
}

export interface BacktestResult {
  params: BacktestParams;
  summary: BacktestSummary;
  byRegime: RegimeStats[];
  byHour: { hour: number; trades: number; netPnl: number; winRate: number }[];
  byDay: { day: number; trades: number; netPnl: number; winRate: number }[];
  equity: { time: number; equity: number }[];
  trades: BacktestTrade[];
  regimes: Regime[];
  ranAt: number;
  candleCount: number;
}

export type SignalFn = (
  candles: Candle[],
  i: number,
  ctx: Record<string, unknown>
) => { long?: boolean; short?: boolean; reason?: string };
