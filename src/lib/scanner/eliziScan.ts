/**
 * Elizi Edge scan — dedicated cross/intersection detector (not mixed into MACD).
 *
 * Definition used:
 *   Primary: Elizi +E / −E cross (edgeUp × edgeDown), same spirit as MACD line×signal.
 *   Secondary: phase entering fire (|phase| → 3) from a cooler phase on the same bar,
 *              treated as an edge “arm/fire” event when no ±E cross is fresher.
 *
 * barsAgo is measured from the last closed bar; default freshness window is 2.
 */
import type { Candle } from "@/lib/types";
import { eliziEdge, type EliziEdgeParams } from "@/lib/indicators/eliziEdge";

export type EliziBias = "bull" | "bear";

export type EliziEdgeHit = {
  bias: EliziBias;
  /** Bars since signal (0 = current/last closed bar) */
  barsAgo: number;
  /** What fired: ±E cross or phase→fire */
  kind: "edge_cross" | "phase_fire";
  edgeTemp: number;
  coherence: number;
  edgeUp: number;
  edgeDown: number;
  phase: number;
};

export type DetectEliziEdgeOpts = EliziEdgeParams & {
  /** Look back this many bars (default 2) */
  maxBarsAgo?: number;
};

function crossedAboveAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

function crossedBelowAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 >= b0 && a1 < b1;
}

function phaseFireAt(
  phase: (number | null)[],
  i: number
): EliziBias | null {
  if (i < 1) return null;
  const prev = phase[i - 1];
  const curr = phase[i];
  if (prev == null || curr == null) return null;
  const absPrev = Math.abs(prev);
  const absCurr = Math.abs(curr);
  // Enter fire (3) from cooler (0–2); sign = bias
  if (absCurr >= 3 && absPrev < 3) {
    if (curr > 0) return "bull";
    if (curr < 0) return "bear";
  }
  return null;
}

/**
 * Most recent Elizi Edge cross within maxBarsAgo.
 * Prefers ±E cross; falls back to phase→fire on the same freshness window.
 */
export function detectEliziEdgeCross(
  candles: Candle[],
  opts: DetectEliziEdgeOpts = {}
): EliziEdgeHit | null {
  const maxBarsAgo = opts.maxBarsAgo ?? 2;
  if (candles.length < 40) return null;

  const ee = eliziEdge(candles, opts);
  const last = ee.edgeUp.length - 1;
  const lookFrom = Math.max(1, last - maxBarsAgo);

  for (let i = last; i >= lookFrom; i--) {
    const bull = crossedAboveAt(ee.edgeUp, ee.edgeDown, i);
    const bear = crossedBelowAt(ee.edgeUp, ee.edgeDown, i);
    if (!bull && !bear) continue;
    const temp = ee.edgeTemp[i];
    const coh = ee.coherence[i];
    const up = ee.edgeUp[i];
    const dn = ee.edgeDown[i];
    const ph = ee.phase[i];
    if (
      temp == null ||
      coh == null ||
      up == null ||
      dn == null ||
      ph == null
    )
      continue;
    return {
      bias: bull ? "bull" : "bear",
      barsAgo: last - i,
      kind: "edge_cross",
      edgeTemp: temp,
      coherence: coh,
      edgeUp: up,
      edgeDown: dn,
      phase: ph,
    };
  }

  for (let i = last; i >= lookFrom; i--) {
    const fireBias = phaseFireAt(ee.phase, i);
    if (!fireBias) continue;
    const temp = ee.edgeTemp[i];
    const coh = ee.coherence[i];
    const up = ee.edgeUp[i];
    const dn = ee.edgeDown[i];
    const ph = ee.phase[i];
    if (
      temp == null ||
      coh == null ||
      up == null ||
      dn == null ||
      ph == null
    )
      continue;
    return {
      bias: fireBias,
      barsAgo: last - i,
      kind: "phase_fire",
      edgeTemp: temp,
      coherence: coh,
      edgeUp: up,
      edgeDown: dn,
      phase: ph,
    };
  }

  return null;
}
