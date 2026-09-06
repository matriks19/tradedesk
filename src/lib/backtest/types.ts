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
  | "pumpFadeShort"
  | "dumpStages"
  | "pumpFadeDelta"
  | "eliziEdgeFire"
  | "eliziEdgeExhaust"
  | "exhaustDelta"
  | "exhaustFlow"
  | "exhaustSmiExit"
  | "hybridMacdPump"
  | "hybridMacdPumpLong"
  | "shortRsiOb"
  | "shortTsiSignal"
  | "shortRsiDiv"
  | "shortTsiDiv"
  | "shortEnergyFade"
  | "macdEma200"
  | "macdEmaStack"
  | "earlyFisher"
  | "earlyStoch"
  | "earlyWaveTrend"
  | "earlyConnors"
  | "earlyFisherTrend"
  | "qTrendOnly"
  | "qTrendKlinger"
  | "jurikBbTurtle"
  | "jurikDonchHybrid"
  | "jurikMaDonch"
  | "jurikMaCross"
  | "donchianBlaster"
  | "donchianBlasterHma"
  | "oscQqe"
  | "oscSchaff"
  | "oscLaguerre"
  | "oscSqueeze"
  | "oscStochRsi"
  | "oscSmi"
  | "oscWaddah"
  | "oscCoppock"
  | "eliziPulse"
  | "eliziPulseAnd"
  | "smiLongOnly"
  | "eliziStack"
  | "hybridSmiLong"
  | "hybridSmiAnd"
  | "oscTsi"
  | "tsiLongOnly"
  | "oscTsiOb"
  | "twinNeck"
  | "tripleNeck"
  | "diagonalBounce"
  | "diagonalBreak"
  | "srCombo"
  | "twinLongOnly"
  | "diagonalBreakLong"
  | "diagonalBreakShort"
  | "shortHybridOr"
  | "shortHybridAnd"
  | "shortHybridSmart"
  | "shortHybridElite"
  | "ema13HighLow"
  | "ema13HighLowChannel"
  | "ema13HighLowLong"
  | "zlsmaChandelier"
  | "zlsmaChandelierLong"
  | "bayesianTrend"
  | "bayesianTrendLong"
  | "multiKernel"
  | "multiKernelLong"
  | "multiKernelRq"
  | "multiKernelRqLong"
  | "bayesKernelOr"
  | "bayesKernelAnd"
  | "bayesKernelHybrid"
  | "gainzAlgoV2"
  | "gainzAlgoV2Long"
  | "eliziNexus"
  | "eliziNexus1h"
  | "eliziNexus4h"
  | "eliziNexusSoft1h"
  | "eliziNexusSoft4h"
  | "smcFvg"
  | "smcFvgLong"
  | "ictOb"
  | "ictObLong"
  | "ictBosLong"
  | "vortexCross"
  | "vortexLong"
  | "forceIndex"
  | "forceLong"
  | "cmfZero"
  | "cmfLong"
  | "vidyaCross"
  | "vidyaLong"
  | "framaCross"
  | "framaLong"
  | "sslChannel"
  | "sslLong"
  | "vfiCross"
  | "vfiLong"
  | "elderImpulse"
  | "elderLong"
  | "cmoZero"
  | "cmoLong"
  | "massBulge"
  | "bopZero"
  | "bopLong"
  | "klingerLong"
  | "squeezeLong"
  | "halfTrendLong"
  | "coralLong"
  | "alligatorLong"
  | "kstLong"
  | "trixLong"
  | "rviLong"
  | "aoLong"
  | "uoLong"
  | "dpoLong"
  | "ppoLong"
  | "stDivFireflyLong"
  | "stDivFirefly"
  | "stDivWeighted"
  | "fireflyLong"
  | "oscSqueezeLong"
  | "pliBreakLong"
  | "pliDeltaHybridLong"
  | "madBandsLong"
  | "medianCrossLong"
  | "ifvgLong"
  | "ifvgRsiLong"
  | "ifvgRsiBi"
  | "ifvgSmiLong"
  | "ifvgSmiBi"
  | "ifvgJurikStochLong"
  | "ifvgJurikStochBi"
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
  /** Elizi Edge knobs */
  erLen?: number;
  atrLen?: number;
  volLen?: number;
  volLong?: number;
  flowSmooth?: number;
  tempSmooth?: number;
  effHigh?: number;
  zlsmaLen?: number;
  cePeriod?: number;
  ceMult?: number;
  bayesianLen?: number;
  bayesianGap?: number;
  bayesianSigGap?: number;
  kernelLookback?: number;
  kernelBandwidth?: number;
  kernelAlpha?: number;
  surpriseHigh?: number;
  coherenceArmed?: number;
  fireTemp?: number;
  armedTemp?: number;
  probeTemp?: number;
}

export interface BacktestSignalEvent {
  /** bar index in the candle series */
  barIndex: number;
  time: number;
  price: number;
  /** al = long entry signal, sat = short entry or long exit signal */
  side: "al" | "sat";
  /** raw kind for filtering */
  kind: "long" | "short" | "exitLong" | "exitShort";
  reason: string;
  /** filled relative to last bar when result is built */
  barsAgo: number;
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
  /** Strategy signal history (newest-friendly via barsAgo) */
  signals: BacktestSignalEvent[];
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
