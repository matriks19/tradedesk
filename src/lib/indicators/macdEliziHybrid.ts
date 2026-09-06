/**
 * MACD × Elizi hybrid — weighted composite so MACD leads timing (Elizi alone lags).
 *
 * Default weights: 60% MACD hist-norm + 40% Elizi ±E spread-norm.
 * AL/SAT = hybrid × signal EMA cross (same spirit as MACD line×signal).
 */
import type { Candle } from "@/lib/types";
import { closes, ema, macd, stdev } from "@/lib/indicators/math";
import { eliziEdge, type EliziEdgeParams } from "@/lib/indicators/eliziEdge";

export type MacdEliziHybridParams = EliziEdgeParams & {
  fast?: number;
  slow?: number;
  signalPeriod?: number;
  /** MACD weight 0–1 (default 0.6) */
  wMacd?: number;
  /** Elizi weight 0–1 (default 0.4); renormalized with wMacd */
  wElizi?: number;
  /** Rolling std window for normalization */
  normLen?: number;
  /** EMA of hybrid for cross signal */
  hybridSignal?: number;
};

export type MacdEliziHybridResult = {
  /** Composite score ~[-1, 1] */
  hybrid: (number | null)[];
  /** EMA of hybrid */
  signal: (number | null)[];
  /** hybrid − signal */
  hist: (number | null)[];
  macdNorm: (number | null)[];
  eliziNorm: (number | null)[];
  macd: (number | null)[];
  macdSignal: (number | null)[];
  macdHist: (number | null)[];
  edgeUp: (number | null)[];
  edgeDown: (number | null)[];
  edgeTemp: (number | null)[];
  crossUp: (number | null)[];
  crossDn: (number | null)[];
};

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

function tanh(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e2 = Math.exp(2 * x);
  return (e2 - 1) / (e2 + 1);
}

function normSeries(
  raw: (number | null)[],
  len: number
): (number | null)[] {
  const n = raw.length;
  const out = fillNull(n);
  // stdev needs dense numbers — build proxy with 0 for nulls for window only
  const dense = raw.map((v) => (v == null || !Number.isFinite(v) ? 0 : v));
  const sd = stdev(dense, len);
  for (let i = 0; i < n; i++) {
    const v = raw[i];
    if (v == null || !Number.isFinite(v)) continue;
    const s = sd[i];
    const denom = s != null && s > 1e-12 ? s : 1e-12;
    out[i] = tanh(v / denom);
  }
  return out;
}

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

export function macdEliziHybrid(
  candles: Candle[],
  opts: MacdEliziHybridParams = {}
): MacdEliziHybridResult {
  const fast = opts.fast ?? 12;
  const slow = opts.slow ?? 26;
  const signalPeriod = opts.signalPeriod ?? 9;
  const normLen = opts.normLen ?? 50;
  const hybridSignalLen = opts.hybridSignal ?? 5;
  let wM = opts.wMacd ?? 0.6;
  let wE = opts.wElizi ?? 0.4;
  const wSum = wM + wE;
  if (wSum > 0) {
    wM /= wSum;
    wE /= wSum;
  } else {
    wM = 0.6;
    wE = 0.4;
  }

  const n = candles.length;
  const m = macd(closes(candles), fast, slow, signalPeriod);
  const ee = eliziEdge(candles, opts);

  const macdNorm = normSeries(m.hist, normLen);
  const spread = fillNull(n);
  for (let i = 0; i < n; i++) {
    const up = ee.edgeUp[i];
    const dn = ee.edgeDown[i];
    if (up == null || dn == null) continue;
    spread[i] = up - dn;
  }
  const eliziNorm = normSeries(spread, normLen);

  const hybrid = fillNull(n);
  for (let i = 0; i < n; i++) {
    const a = macdNorm[i];
    const b = eliziNorm[i];
    if (a == null && b == null) continue;
    const aa = a ?? 0;
    const bb = b ?? 0;
    // If one side missing, still allow the other (scaled)
    if (a == null) hybrid[i] = bb;
    else if (b == null) hybrid[i] = aa;
    else hybrid[i] = wM * aa + wE * bb;
  }

  // EMA wants number[]; map null→NaN then restore
  const hybridDense = hybrid.map((v) => (v == null ? NaN : v));
  // Replace leading NaNs with 0 for EMA warm-up stability
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(hybridDense[i]!)) {
      first = i;
      break;
    }
  }
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(hybridDense[i]!)) {
      hybridDense[i] = first >= 0 && i > first ? hybridDense[i - 1]! : 0;
    }
  }
  const sigRaw = ema(hybridDense, hybridSignalLen);
  const signal = fillNull(n);
  const hist = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (hybrid[i] == null) continue;
    signal[i] = sigRaw[i];
    if (sigRaw[i] != null) hist[i] = (hybrid[i] as number) - (sigRaw[i] as number);
  }

  const crossUp = fillNull(n);
  const crossDn = fillNull(n);
  for (let i = 1; i < n; i++) {
    if (crossedAboveAt(hybrid, signal, i)) crossUp[i] = 1;
    if (crossedBelowAt(hybrid, signal, i)) crossDn[i] = 1;
  }

  return {
    hybrid,
    signal,
    hist,
    macdNorm,
    eliziNorm,
    macd: m.macd,
    macdSignal: m.signal,
    macdHist: m.hist,
    edgeUp: ee.edgeUp,
    edgeDown: ee.edgeDown,
    edgeTemp: ee.edgeTemp,
    crossUp,
    crossDn,
  };
}
