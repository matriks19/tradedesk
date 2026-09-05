import type { PatternBias, PatternDrawing, PatternHit } from "@/lib/patterns/types";

export type AdvancedPatternFamily = "harmonic" | "candle" | "liquidity" | "structure";

export type HarmonicName =
  | "gartley"
  | "bat"
  | "butterfly"
  | "crab"
  | "shark"
  | "cypher"
  | "abcd"
  | "xabcd"
  | "wolfe"
  | "w_bottom"
  | "m_top"
  | "swan"
  | "rising_leg"
  | "falling_leg";

export type CandleFormationName =
  | "engulfing"
  | "harami"
  | "morning_star"
  | "evening_star"
  | "three_soldiers"
  | "three_crows"
  | "doji"
  | "hammer"
  | "shooting_star"
  | "piercing"
  | "dark_cloud"
  | "tweezer_top"
  | "tweezer_bottom";

export type LiquidityName =
  | "liquidity_grab"
  | "stop_hunt"
  | "bos"
  | "choch"
  | "equal_highs"
  | "equal_lows";

export interface XABCDPoint {
  label: "X" | "A" | "B" | "C" | "D" | "1" | "2" | "3" | "4" | "5";
  time: number;
  price: number;
  index: number;
}

export interface AdvancedPatternHit {
  id: string;
  family: AdvancedPatternFamily;
  name: string;
  label: string;
  direction: PatternBias;
  confidence: number;
  symbol?: string;
  exchange?: string;
  points?: XABCDPoint[];
  prz?: { low: number; high: number; tStart: number; tEnd: number };
  entry?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  sl?: number;
  detail: string;
  tStart: number;
  tEnd: number;
  drawings: PatternDrawing[];
  timeframe?: string;
}

export function toPatternHit(a: AdvancedPatternHit): PatternHit {
  return {
    id: a.id,
    type: "advanced" as PatternHit["type"],
    label: a.timeframe ? `${a.label} · ${a.timeframe}` : a.label,
    detail: a.detail,
    bias: a.direction === "neutral" ? "neutral" : a.direction,
    confidence: a.confidence,
    tStart: a.tStart,
    tEnd: a.tEnd,
    drawings: a.drawings,
    advanced: a,
    timeframe: a.timeframe,
  };
}
