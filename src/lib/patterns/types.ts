import type { Candle } from "@/lib/types";

export type PatternBias = "bull" | "bear" | "neutral";

export type DrawingKind =
  | "trendline"
  | "ray"
  | "segment"
  | "box"
  | "hline"
  | "label"
  | "marker";

/** Chart overlay primitives in candle time/price space */
export interface PatternDrawing {
  id: string;
  kind: DrawingKind;
  /** unix seconds */
  t1: number;
  price1: number;
  t2?: number;
  price2?: number;
  label?: string;
  color?: string;
  lineWidth?: number;
  dashed?: boolean;
  /** for markers: aboveBar / belowBar */
  position?: "aboveBar" | "belowBar";
  shape?: "circle" | "arrowUp" | "arrowDown" | "square";
}

export interface PatternHit {
  id: string;
  type:
    | "hh_hl"
    | "lh_ll"
    | "double_top"
    | "double_bottom"
    | "head_shoulders"
    | "inv_head_shoulders"
    | "triangle_asc"
    | "triangle_desc"
    | "triangle_sym"
    | "flag"
    | "pennant"
    | "breakout_box"
    | "engulfing"
    | "advanced";
  label: string;
  detail: string;
  bias: PatternBias;
  confidence: number; // 0..1
  /** start/end time of pattern span */
  tStart: number;
  tEnd: number;
  drawings: PatternDrawing[];
  /** optional payload from advanced/harmonic/liquidity detectors */
  advanced?: unknown;
  /** minor = chart TF; major = 1D/3D/1W structure */
  scale?: "minor" | "major";
  /** TF the pattern was detected on */
  timeframe?: string;
}

export interface DetectOptions {
  /** swing lookback bars left/right (1..5) */
  swingStrength?: number;
  /** double top/bottom tolerance as fraction of price (default 0.015) */
  twinTol?: number;
  /** min bars between twin peaks */
  twinMinGap?: number;
  /** max bars between twin peaks */
  twinMaxGap?: number;
  /** breakout box lookback */
  boxLookback?: number;
  /** enable/disable families */
  enable?: Partial<Record<PatternHit["type"], boolean>>;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  kind: "high" | "low";
}

export type CandleSeries = Candle[];
