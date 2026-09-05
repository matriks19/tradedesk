/**
 * Jurik / Loxx-style community reconstructions.
 * Inspired by Loxx Jurik/Kase concepts — community reconstructions, not affiliated
 * with Jurik Research or commercial products. JMA labeled as "JMA (community)".
 */
import type { Candle } from "@/lib/types";
import { atr, ema, rsi, sma, stddev } from "./math";

export type JurikSmoothMode = "jma" | "jurikLite" | "ema";

/** Community JMA — 3-stage adaptive filter (length, phase, power). */
export function jma(
  values: number[],
  length = 14,
  phase = 50,
  power = 2
): (number | null)[] {
  const len = Math.max(1, Math.floor(length));
  const pow = Math.max(0.1, power);
  const phaseRatio =
    phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
  const beta = (0.45 * (len - 1)) / (0.45 * (len - 1) + 2);
  const alpha = Math.pow(beta, pow);

  const out: (number | null)[] = new Array(values.length).fill(null);
  if (!values.length) return out;

  let e0 = values[0];
  let e1 = 0;
  let e2 = 0;
  let j = values[0];

  for (let i = 0; i < values.length; i++) {
    const src = values[i];
    e0 = (1 - alpha) * src + alpha * e0;
    e1 = (src - e0) * (1 - beta) + beta * e1;
    e2 =
      (e0 + phaseRatio * e1 - j) * Math.pow(1 - alpha, 2) +
      Math.pow(alpha, 2) * e2;
    j = e2 + j;
    out[i] = i < len - 1 ? null : j;
  }
  return out;
}

/** Lighter Jurik-style smooth: single adaptive EMA with phase skew. */
export function jurikLite(
  values: number[],
  length = 14,
  phase = 50
): (number | null)[] {
  const len = Math.max(1, Math.floor(length));
  const phaseRatio =
    phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
  const beta = (0.45 * (len - 1)) / (0.45 * (len - 1) + 2);
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (!values.length) return out;
  let prev = values[0];
  let skew = 0;
  for (let i = 0; i < values.length; i++) {
    const src = values[i];
    const e = (1 - beta) * src + beta * prev;
    skew = (src - e) * (1 - beta) + beta * skew;
    prev = e + phaseRatio * skew * (1 - beta);
    out[i] = i < len - 1 ? null : prev;
  }
  return out;
}

export function smoothSeries(
  values: number[],
  mode: JurikSmoothMode,
  length: number,
  phase = 50,
  power = 2
): (number | null)[] {
  if (mode === "ema") return ema(values, Math.max(1, Math.floor(length)));
  if (mode === "jurikLite") return jurikLite(values, length, phase);
  return jma(values, length, phase, power);
}

/** Double JMA (JMA of JMA). */
export function doubleJma(
  values: number[],
  length = 14,
  phase = 50,
  power = 2
): (number | null)[] {
  const first = jma(values, length, phase, power);
  const filled = first.map((v, i) => (v == null ? values[i] : v));
  const second = jma(filled, length, phase, power);
  return first.map((v, i) => (v == null || second[i] == null ? null : second[i]));
}

/** Multi-length JMA ribbon. */
export function jmaRibbon(
  values: number[],
  lengths: number[] = [8, 13, 21, 34, 55],
  phase = 50,
  power = 2
): (number | null)[][] {
  return lengths.map((len) => jma(values, len, phase, power));
}

/**
 * Approximate Jurik "volty" — rolling absolute deviation ratio used to widen bands.
 */
export function jurikVolty(values: number[], length = 20): (number | null)[] {
  const len = Math.max(2, Math.floor(length));
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (i < len) continue;
    let sum = 0;
    let absSum = 0;
    for (let j = i - len + 1; j <= i; j++) {
      const d = values[j] - values[j - 1];
      sum += d;
      absSum += Math.abs(d);
    }
    out[i] = absSum === 0 ? 0 : Math.abs(sum) / absSum;
  }
  return out;
}

/** Filter bands: JMA ± volty-scaled ATR (or stddev fallback). */
export function jurikFilterBands(
  candles: Candle[],
  values: number[],
  length = 14,
  phase = 50,
  power = 2,
  bandMult = 1.5
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  volty: (number | null)[];
} {
  const mid = jma(values, length, phase, power);
  const a = atr(candles, length);
  const vol = jurikVolty(values, length);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (mid[i] == null || a[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const scale = 0.5 + (vol[i] ?? 0.5);
    const w = bandMult * (a[i] as number) * scale;
    upper.push((mid[i] as number) + w);
    lower.push((mid[i] as number) - w);
  }
  return { mid, upper, lower, volty: vol };
}

/** Jurik RSI / RSX-style: Wilder RSI then JMA smooth. */
export function jurikRsi(
  values: number[],
  rsiLen = 14,
  jmaLen = 8,
  phase = 50,
  power = 2
): (number | null)[] {
  const r = rsi(values, rsiLen);
  const filled = r.map((v) => (v == null ? 50 : v));
  const smooth = jma(filled, jmaLen, phase, power);
  return r.map((v, i) => (v == null || smooth[i] == null ? null : smooth[i]));
}

/** Alias RSX-style. */
export function jurikRsx(
  values: number[],
  length = 14,
  phase = 50,
  power = 2
): (number | null)[] {
  return jurikRsi(values, length, Math.max(3, Math.floor(length / 2)), phase, power);
}

export function jurikMacd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
  phase = 50,
  power = 2
): {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const f = jma(values, fast, phase, power);
  const s = jma(values, slow, phase, power);
  const line = values.map((_, i) =>
    f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null
  );
  const filled = line.map((v) => (v == null ? 0 : v));
  const sigRaw = jma(filled, signal, phase, power);
  const sig = line.map((v, i) => (v == null ? null : sigRaw[i]));
  const hist = line.map((v, i) =>
    v != null && sig[i] != null ? v - (sig[i] as number) : null
  );
  return { macd: line, signal: sig, hist };
}

export function jurikCci(
  candles: Candle[],
  period = 20,
  jmaLen = 8,
  phase = 50,
  power = 2
): (number | null)[] {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const mid = jma(tp, period, phase, power);
  const out: (number | null)[] = [];
  for (let i = 0; i < tp.length; i++) {
    if (mid[i] == null || i < period - 1) {
      out.push(null);
      continue;
    }
    let mad = 0;
    for (let j = i - period + 1; j <= i; j++) {
      mad += Math.abs(tp[j] - (mid[i] as number));
    }
    mad /= period;
    out.push(mad === 0 ? 0 : (tp[i] - (mid[i] as number)) / (0.015 * mad));
  }
  const filled = out.map((v) => v ?? 0);
  const sm = jma(filled, jmaLen, phase, power);
  return out.map((v, i) => (v == null ? null : sm[i]));
}

export function jurikBollinger(
  values: number[],
  length = 20,
  mult = 2,
  phase = 50,
  power = 2
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const mid = jma(values, length, phase, power);
  const sd = stddev(values, length);
  return {
    mid,
    upper: mid.map((m, i) =>
      m != null && sd[i] != null ? m + mult * (sd[i] as number) : null
    ),
    lower: mid.map((m, i) =>
      m != null && sd[i] != null ? m - mult * (sd[i] as number) : null
    ),
  };
}

/** ATR-adaptive length sketch → JMA. */
export function adaptiveJma(
  candles: Candle[],
  values: number[],
  baseLen = 14,
  phase = 50,
  power = 2,
  atrLen = 14
): (number | null)[] {
  const a = atr(candles, atrLen);
  const out: (number | null)[] = new Array(values.length).fill(null);
  // Approximate by blending two JMAs with length scaled by relative ATR
  const short = jma(values, Math.max(3, Math.floor(baseLen * 0.6)), phase, power);
  const long = jma(values, Math.max(5, Math.floor(baseLen * 1.4)), phase, power);
  let atrSum = 0;
  let atrCount = 0;
  for (let i = 0; i < values.length; i++) {
    if (a[i] != null) {
      atrSum += a[i] as number;
      atrCount++;
    }
    const avg = atrCount ? atrSum / atrCount : 0;
    if (short[i] == null || long[i] == null || a[i] == null || avg === 0) {
      continue;
    }
    const ratio = Math.min(2, Math.max(0.25, (a[i] as number) / avg));
    // Higher vol → shorter (more weight on short JMA)
    const w = Math.min(1, Math.max(0, (ratio - 0.5) / 1.0));
    out[i] = (1 - w) * (long[i] as number) + w * (short[i] as number);
  }
  return out;
}

/** Simplified QQE-style on Jurik RSI. */
export function jurikQqe(
  values: number[],
  rsiLen = 14,
  jmaLen = 8,
  smoothLen = 5,
  qqeFactor = 4.236,
  phase = 50,
  power = 2
): {
  rsi: (number | null)[];
  trail: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const jr = jurikRsi(values, rsiLen, jmaLen, phase, power);
  const filled = jr.map((v) => (v == null ? 50 : v));
  const ma = jma(filled, smoothLen, phase, power);
  const absDiff: number[] = filled.map((v, i) =>
    i === 0 ? 0 : Math.abs(v - filled[i - 1])
  );
  const dar = jma(absDiff, smoothLen * 2, phase, power);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const trail: (number | null)[] = [];
  let longTrail = 0;
  let shortTrail = 100;
  for (let i = 0; i < values.length; i++) {
    if (ma[i] == null || dar[i] == null || jr[i] == null) {
      upper.push(null);
      lower.push(null);
      trail.push(null);
      continue;
    }
    const delta = qqeFactor * (dar[i] as number);
    const u = (ma[i] as number) + delta;
    const l = (ma[i] as number) - delta;
    upper.push(u);
    lower.push(l);
    if ((ma[i] as number) > longTrail && i > 0) {
      longTrail = Math.max(longTrail, l);
    } else {
      longTrail = l;
    }
    if ((ma[i] as number) < shortTrail && i > 0) {
      shortTrail = Math.min(shortTrail, u);
    } else {
      shortTrail = u;
    }
    trail.push((ma[i] as number) >= 50 ? longTrail : shortTrail);
  }
  return { rsi: jr, trail, upper, lower };
}

/** Ehlers SuperSmoother (2-pole). */
export function superSmoother(
  values: number[],
  length = 10
): (number | null)[] {
  const len = Math.max(2, Math.floor(length));
  const a1 = Math.exp((-Math.SQRT2 * Math.PI) / len);
  const b1 = 2 * a1 * Math.cos((Math.SQRT2 * Math.PI) / len);
  const c2 = b1;
  const c3 = -a1 * a1;
  const c1 = 1 - c2 - c3;
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (i < 2) {
      out[i] = values[i];
      continue;
    }
    const v =
      c1 * ((values[i] + values[i - 1]) / 2) +
      c2 * (out[i - 1] as number) +
      c3 * (out[i - 2] as number);
    out[i] = i < len ? null : v;
  }
  return out;
}

/** Build Kase-style synthetic permission OHLC from `cycle` bars (rolling). */
export function syntheticPermissionOHLC(
  candles: Candle[],
  cycle: number
): { open: number[]; high: number[]; low: number[]; close: number[] } {
  const cyc = Math.max(1, Math.floor(cycle));
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - cyc + 1);
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = start; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    open.push(candles[start].open);
    high.push(hi);
    low.push(lo);
    close.push(candles[i].close);
  }
  return { open, high, low, close };
}

function stochOnSyn(
  high: number[],
  low: number[],
  close: number[],
  kLen: number
): (number | null)[] {
  const k: (number | null)[] = [];
  const period = Math.max(1, Math.floor(kLen));
  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      k.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, high[j]);
      lo = Math.min(lo, low[j]);
    }
    k.push(hi === lo ? 50 : ((close[i] - lo) / (hi - lo)) * 100);
  }
  return k;
}

export function kaseStoch(
  candles: Candle[],
  cycle = 5,
  kLen = 8,
  dLen = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const syn = syntheticPermissionOHLC(candles, cycle);
  const rawK = stochOnSyn(syn.high, syn.low, syn.close, kLen);
  const filled = rawK.map((v) => v ?? 50);
  const d = sma(filled, dLen).map((v, i) => (rawK[i] == null ? null : v));
  return { k: rawK, d };
}

export function jurikStoch(
  candles: Candle[],
  kLen = 14,
  dLen = 3,
  jmaLen = 8,
  phase = 50,
  power = 2,
  mode: JurikSmoothMode = "jma"
): { k: (number | null)[]; d: (number | null)[]; signal: (number | null)[] } {
  const rawK: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kLen - 1) {
      rawK.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - kLen + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    rawK.push(
      hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100
    );
  }
  const filled = rawK.map((v) => (v == null ? 50 : v));
  const k = smoothSeries(filled, mode, jmaLen, phase, power).map((v, i) =>
    rawK[i] == null ? null : v
  );
  const kFilled = k.map((v) => v ?? 50);
  const d = sma(kFilled, dLen).map((v, i) => (k[i] == null ? null : v));
  const signal = smoothSeries(kFilled, mode, Math.max(2, Math.floor(dLen)), phase, power).map(
    (v, i) => (k[i] == null ? null : v)
  );
  return { k, d, signal };
}

export interface JurikKaseStochResult {
  k: (number | null)[];
  d: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
  /** 1 bull permission, -1 bear, 0 neutral */
  state: (number | null)[];
  bullMark: (number | null)[];
  bearMark: (number | null)[];
  levelLo: (number | null)[];
  levelLo2: (number | null)[];
  levelHi2: (number | null)[];
  levelHi: (number | null)[];
  kSlow?: (number | null)[];
}

/**
 * Jurik Kase Stochastic — Kase permission TF stoch + community JMA smooth.
 * Enhanced: multi-level bands, signal, histogram, permission state, optional dual cycle.
 */
export function jurikKaseStoch(
  candles: Candle[],
  opts: {
    cycle?: number;
    cycleSlow?: number;
    kLen?: number;
    dLen?: number;
    jmaLen?: number;
    phase?: number;
    power?: number;
    smoothMode?: JurikSmoothMode;
    levelLo?: number;
    levelLo2?: number;
    levelHi2?: number;
    levelHi?: number;
    dualCycle?: boolean;
  } = {}
): JurikKaseStochResult {
  const cycle = opts.cycle ?? 5;
  const kLen = opts.kLen ?? 8;
  const dLen = opts.dLen ?? 3;
  const jmaLen = opts.jmaLen ?? 5;
  const phase = opts.phase ?? 50;
  const power = opts.power ?? 2;
  const mode = opts.smoothMode ?? "jma";
  const lo = opts.levelLo ?? 10;
  const lo2 = opts.levelLo2 ?? 20;
  const hi2 = opts.levelHi2 ?? 80;
  const hi = opts.levelHi ?? 90;
  const dual = opts.dualCycle ?? false;
  const cycleSlow = opts.cycleSlow ?? Math.max(cycle + 3, cycle * 2);

  const syn = syntheticPermissionOHLC(candles, cycle);
  const rawK = stochOnSyn(syn.high, syn.low, syn.close, kLen);
  const filled = rawK.map((v) => (v == null ? 50 : v));
  const k = smoothSeries(filled, mode, jmaLen, phase, power).map((v, i) =>
    rawK[i] == null ? null : v
  );
  const kFilled = k.map((v) => v ?? 50);
  const d = sma(kFilled, dLen).map((v, i) => (k[i] == null ? null : v));
  const signal = smoothSeries(
    kFilled,
    mode,
    Math.max(2, dLen),
    phase,
    power
  ).map((v, i) => (k[i] == null ? null : v));
  const hist = k.map((v, i) =>
    v != null && signal[i] != null ? v - (signal[i] as number) : null
  );

  let kSlow: (number | null)[] | undefined;
  if (dual) {
    const syn2 = syntheticPermissionOHLC(candles, cycleSlow);
    const raw2 = stochOnSyn(syn2.high, syn2.low, syn2.close, kLen);
    const f2 = raw2.map((v) => (v == null ? 50 : v));
    kSlow = smoothSeries(f2, mode, jmaLen + 2, phase, power).map((v, i) =>
      raw2[i] == null ? null : v
    );
  }

  const state: (number | null)[] = [];
  const bullMark: (number | null)[] = [];
  const bearMark: (number | null)[] = [];
  const levelLo: (number | null)[] = [];
  const levelLo2: (number | null)[] = [];
  const levelHi2: (number | null)[] = [];
  const levelHi: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    const kv = k[i];
    if (kv == null) {
      state.push(null);
      bullMark.push(null);
      bearMark.push(null);
      levelLo.push(null);
      levelLo2.push(null);
      levelHi2.push(null);
      levelHi.push(null);
      continue;
    }
    levelLo.push(lo);
    levelLo2.push(lo2);
    levelHi2.push(hi2);
    levelHi.push(hi);

    let st = 0;
    if (kv <= lo2) st = 1;
    else if (kv >= hi2) st = -1;
    if (dual && kSlow && kSlow[i] != null) {
      if (kv > (kSlow[i] as number) && kv > 50) st = 1;
      else if (kv < (kSlow[i] as number) && kv < 50) st = -1;
    }
    state.push(st);

    const prev = i > 0 ? k[i - 1] : null;
    const sig = signal[i];
    const prevSig = i > 0 ? signal[i - 1] : null;
    const crossUp =
      prev != null &&
      sig != null &&
      prevSig != null &&
      prev <= (prevSig as number) &&
      kv > (sig as number);
    const crossDn =
      prev != null &&
      sig != null &&
      prevSig != null &&
      prev >= (prevSig as number) &&
      kv < (sig as number);
    const leaveOs = prev != null && prev <= lo2 && kv > lo2;
    const leaveOb = prev != null && prev >= hi2 && kv < hi2;
    bullMark.push(crossUp || leaveOs ? lo - 5 : null);
    bearMark.push(crossDn || leaveOb ? hi + 5 : null);
  }

  return {
    k,
    d,
    signal,
    hist,
    state,
    bullMark,
    bearMark,
    levelLo,
    levelLo2,
    levelHi2,
    levelHi,
    kSlow,
  };
}

export function jurikKaseStochPro(
  candles: Candle[],
  opts: Parameters<typeof jurikKaseStoch>[1] = {}
): JurikKaseStochResult {
  return jurikKaseStoch(candles, { ...opts, dualCycle: opts?.dualCycle ?? true });
}
