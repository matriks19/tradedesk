import type { Candle, PriceField } from "@/lib/types";

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

export function priceSeries(candles: Candle[], field: PriceField = "close"): number[] {
  return candles.map((c) => {
    switch (field) {
      case "open":
        return c.open;
      case "high":
        return c.high;
      case "low":
        return c.low;
      case "hl2":
        return (c.high + c.low) / 2;
      case "hlc3":
        return (c.high + c.low + c.close) / 3;
      case "ohlc4":
        return (c.open + c.high + c.low + c.close) / 4;
      default:
        return c.close;
    }
  });
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prev = sum / period;
      out.push(prev);
    } else {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

export function wma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - period + 1 + j] * (j + 1);
    }
    out.push(sum / denom);
  }
  return out;
}

export function dema(values: number[], period: number): (number | null)[] {
  const e1 = ema(values, period);
  const filled = e1.map((v, i) => (v == null ? values[i] : v));
  const e2 = ema(filled, period);
  return values.map((_, i) =>
    e1[i] != null && e2[i] != null
      ? 2 * (e1[i] as number) - (e2[i] as number)
      : null
  );
}

export function tema(values: number[], period: number): (number | null)[] {
  const e1 = ema(values, period);
  const f1 = e1.map((v, i) => (v == null ? values[i] : v));
  const e2 = ema(f1, period);
  const f2 = e2.map((v, i) => (v == null ? f1[i] : v));
  const e3 = ema(f2, period);
  return values.map((_, i) =>
    e1[i] != null && e2[i] != null && e3[i] != null
      ? 3 * (e1[i] as number) - 3 * (e2[i] as number) + (e3[i] as number)
      : null
  );
}

/** Hull MA approximation using WMA */
export function hull(values: number[], period = 20): (number | null)[] {
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = wma(values, half);
  const wmaFull = wma(values, period);
  const raw = values.map((_, i) =>
    wmaHalf[i] != null && wmaFull[i] != null
      ? 2 * (wmaHalf[i] as number) - (wmaFull[i] as number)
      : 0
  );
  const h = wma(raw, sqrtP);
  return values.map((_, i) =>
    wmaHalf[i] == null || wmaFull[i] == null ? null : h[i]
  );
}

export function vwma(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let pv = 0;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pv += candles[j].close * candles[j].volume;
      v += candles[j].volume;
    }
    out.push(v === 0 ? null : pv / v);
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line: (number | null)[] = values.map((_, i) =>
    ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null
  );
  const filled = line.map((v) => (v == null ? 0 : v));
  const sigRaw = ema(filled, signal);
  const sig = line.map((v, i) => (v == null ? null : sigRaw[i]));
  const hist = line.map((v, i) =>
    v != null && sig[i] != null ? v - (sig[i] as number) : null
  );
  return { macd: line, signal: sig, hist };
}

export function bollinger(
  values: number[],
  period = 20,
  mult = 2
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const mid = sma(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (mid[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - (mid[i] as number);
      sum += d * d;
    }
    const std = Math.sqrt(sum / period);
    upper.push((mid[i] as number) + mult * std);
    lower.push((mid[i] as number) - mult * std);
  }
  return { mid, upper, lower };
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < 2) return out;
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1].close;
    trs.push(
      Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev))
    );
  }
  let sum = 0;
  for (let i = 0; i < trs.length; i++) {
    sum += trs[i];
    if (i >= period) sum -= trs[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function stochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    k.push(hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100);
  }
  const kFilled = k.map((v) => v ?? 0);
  const d = sma(kFilled, dPeriod).map((v, i) => (k[i] == null ? null : v));
  return { k, d };
}

/** Stochastic on a plain series (for indicator-on-indicator) */
export function stochasticSeries(
  values: number[],
  kPeriod = 14,
  dPeriod = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hi = Math.max(hi, values[j]);
      lo = Math.min(lo, values[j]);
    }
    k.push(hi === lo ? 50 : ((values[i] - lo) / (hi - lo)) * 100);
  }
  const kFilled = k.map((v) => v ?? 0);
  const d = sma(kFilled, dPeriod).map((v, i) => (k[i] == null ? null : v));
  return { k, d };
}

export function vwap(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = [];
  let cumPV = 0;
  let cumV = 0;
  let day = "";
  for (const c of candles) {
    const d = new Date(c.time * 1000).toISOString().slice(0, 10);
    if (d !== day) {
      day = d;
      cumPV = 0;
      cumV = 0;
    }
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumV += c.volume;
    out.push(cumV === 0 ? null : cumPV / cumV);
  }
  return out;
}

export function supertrend(
  candles: Candle[],
  period = 10,
  mult = 3
): { line: (number | null)[]; direction: (-1 | 1 | null)[] } {
  const atrVals = atr(candles, period);
  const line: (number | null)[] = [];
  const direction: (-1 | 1 | null)[] = [];
  let prevUpper = 0;
  let prevLower = 0;
  let prevSt = 0;
  for (let i = 0; i < candles.length; i++) {
    if (atrVals[i] == null) {
      line.push(null);
      direction.push(null);
      continue;
    }
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let upper = hl2 + mult * (atrVals[i] as number);
    let lower = hl2 - mult * (atrVals[i] as number);
    if (i > 0 && atrVals[i - 1] != null) {
      lower =
        lower > prevLower || candles[i - 1].close < prevLower ? lower : prevLower;
      upper =
        upper < prevUpper || candles[i - 1].close > prevUpper ? upper : prevUpper;
    }
    let dir: -1 | 1;
    let st: number;
    if (i === 0 || atrVals[i - 1] == null) {
      dir = 1;
      st = lower;
    } else if (prevSt === prevUpper) {
      dir = candles[i].close > upper ? 1 : -1;
      st = dir === 1 ? lower : upper;
    } else {
      dir = candles[i].close < lower ? -1 : 1;
      st = dir === 1 ? lower : upper;
    }
    line.push(st);
    direction.push(dir);
    prevUpper = upper;
    prevLower = lower;
    prevSt = st;
  }
  return { line, direction };
}

export function donchian(
  candles: Candle[],
  period = 20
): {
  upper: (number | null)[];
  lower: (number | null)[];
  mid: (number | null)[];
} {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const mid: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      mid.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    upper.push(hi);
    lower.push(lo);
    mid.push((hi + lo) / 2);
  }
  return { upper, lower, mid };
}

export function volumeOsc(
  candles: Candle[],
  shortPeriod = 5,
  longPeriod = 10
): (number | null)[] {
  const vols = candles.map((c) => c.volume);
  const vs = ema(vols, shortPeriod);
  const vl = ema(vols, longPeriod);
  return vols.map((_, i) =>
    vs[i] != null && vl[i] != null && (vl[i] as number) !== 0
      ? (100 * ((vs[i] as number) - (vl[i] as number))) / (vl[i] as number)
      : null
  );
}

export function stochRsi(
  values: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const r = rsi(values, rsiPeriod);
  const st: (number | null)[] = [];
  for (let i = 0; i < r.length; i++) {
    if (r[i] == null || i < stochPeriod - 1) {
      st.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const v = r[j];
      if (v == null) continue;
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
    st.push(hi === lo ? 50 : (((r[i] as number) - lo) / (hi - lo)) * 100);
  }
  const filled = st.map((v) => v ?? 0);
  const k = sma(filled, kSmooth).map((v, i) => (st[i] == null ? null : v));
  const kFilled = k.map((v) => v ?? 0);
  const d = sma(kFilled, dSmooth).map((v, i) => (k[i] == null ? null : v));
  return { k, d };
}

export function cci(candles: Candle[], period = 20): (number | null)[] {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const mid = sma(tp, period);
  const out: (number | null)[] = [];
  for (let i = 0; i < tp.length; i++) {
    if (mid[i] == null) {
      out.push(null);
      continue;
    }
    let mad = 0;
    for (let j = i - period + 1; j <= i; j++) mad += Math.abs(tp[j] - (mid[i] as number));
    mad /= period;
    out.push(mad === 0 ? 0 : (tp[i] - (mid[i] as number)) / (0.015 * mad));
  }
  return out;
}

export function roc(values: number[], period = 12): (number | null)[] {
  return values.map((v, i) =>
    i < period || values[i - period] === 0
      ? null
      : ((v - values[i - period]) / values[i - period]) * 100
  );
}

export function momentum(values: number[], period = 10): (number | null)[] {
  return values.map((v, i) => (i < period ? null : v - values[i - period]));
}

export function williamsR(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    out.push(hi === lo ? -50 : ((hi - candles[i].close) / (hi - lo)) * -100);
  }
  return out;
}

export function tsi(
  values: number[],
  longPeriod = 25,
  shortPeriod = 13,
  signalPeriod = 7
): { tsi: (number | null)[]; signal: (number | null)[] } {
  const mom = values.map((v, i) => (i === 0 ? 0 : v - values[i - 1]));
  const absMom = mom.map((v) => Math.abs(v));
  const e1 = ema(mom, longPeriod);
  const e2 = ema(
    e1.map((v, i) => (v == null ? 0 : v)),
    shortPeriod
  );
  const a1 = ema(absMom, longPeriod);
  const a2 = ema(
    a1.map((v, i) => (v == null ? 0 : v)),
    shortPeriod
  );
  const line = values.map((_, i) =>
    e2[i] != null && a2[i] != null && (a2[i] as number) !== 0
      ? (100 * (e2[i] as number)) / (a2[i] as number)
      : null
  );
  const filled = line.map((v) => v ?? 0);
  const sig = ema(filled, signalPeriod).map((v, i) => (line[i] == null ? null : v));
  return { tsi: line, signal: sig };
}

export function ultimateOsc(
  candles: Candle[],
  p1 = 7,
  p2 = 14,
  p3 = 28
): (number | null)[] {
  const bp: number[] = [];
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const prev = i > 0 ? candles[i - 1].close : candles[i].close;
    const low = Math.min(candles[i].low, prev);
    bp.push(candles[i].close - low);
    tr.push(
      Math.max(candles[i].high, prev) - Math.min(candles[i].low, prev)
    );
  }
  const avg = (arr: number[], period: number, i: number) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += arr[j];
    return s;
  };
  return candles.map((_, i) => {
    const a1 = avg(bp, p1, i);
    const a2 = avg(bp, p2, i);
    const a3 = avg(bp, p3, i);
    const t1 = avg(tr, p1, i);
    const t2 = avg(tr, p2, i);
    const t3 = avg(tr, p3, i);
    if ([a1, a2, a3, t1, t2, t3].some((x) => x == null || x === 0)) return null;
    const avg7 = (a1 as number) / (t1 as number);
    const avg14 = (a2 as number) / (t2 as number);
    const avg28 = (a3 as number) / (t3 as number);
    return 100 * ((4 * avg7 + 2 * avg14 + avg28) / 7);
  });
}

export function awesomeOsc(candles: Candle[]): (number | null)[] {
  const mid = candles.map((c) => (c.high + c.low) / 2);
  const s5 = sma(mid, 5);
  const s34 = sma(mid, 34);
  return mid.map((_, i) =>
    s5[i] != null && s34[i] != null ? (s5[i] as number) - (s34[i] as number) : null
  );
}

export function ppo(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9
): {
  ppo: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line = values.map((_, i) =>
    ef[i] != null && es[i] != null && (es[i] as number) !== 0
      ? (100 * ((ef[i] as number) - (es[i] as number))) / (es[i] as number)
      : null
  );
  const filled = line.map((v) => v ?? 0);
  const sig = ema(filled, signal).map((v, i) => (line[i] == null ? null : v));
  const hist = line.map((v, i) =>
    v != null && sig[i] != null ? v - (sig[i] as number) : null
  );
  return { ppo: line, signal: sig, hist };
}

export function keltner(
  candles: Candle[],
  period = 20,
  mult = 1.5
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const mid = ema(
    candles.map((c) => (c.high + c.low + c.close) / 3),
    period
  );
  const a = atr(candles, period);
  return {
    mid,
    upper: mid.map((m, i) =>
      m != null && a[i] != null ? m + mult * (a[i] as number) : null
    ),
    lower: mid.map((m, i) =>
      m != null && a[i] != null ? m - mult * (a[i] as number) : null
    ),
  };
}

export function stddev(values: number[], period = 20): (number | null)[] {
  const mid = sma(values, period);
  return values.map((_, i) => {
    if (mid[i] == null) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - (mid[i] as number);
      sum += d * d;
    }
    return Math.sqrt(sum / period);
  });
}

export function histVol(values: number[], period = 20): (number | null)[] {
  const logs: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    logs.push(values[i - 1] === 0 ? 0 : Math.log(values[i] / values[i - 1]));
  }
  const sd = stddev(logs, period);
  return sd.map((v) => (v == null ? null : v * Math.sqrt(252) * 100));
}

export function chaikinVol(candles: Candle[], period = 10): (number | null)[] {
  const hl = candles.map((c) => c.high - c.low);
  const e = ema(hl, period);
  return e.map((v, i) => {
    if (v == null || i < period || e[i - period] == null || e[i - period] === 0)
      return null;
    return (100 * (v - (e[i - period] as number))) / (e[i - period] as number);
  });
}

export function obv(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = [];
  let prev = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      out.push(0);
      continue;
    }
    if (candles[i].close > candles[i - 1].close) prev += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) prev -= candles[i].volume;
    out.push(prev);
  }
  return out;
}

export function mfi(candles: Candle[], period = 14): (number | null)[] {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const out: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period; i < candles.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const raw = tp[j] * candles[j].volume;
      if (tp[j] > tp[j - 1]) pos += raw;
      else if (tp[j] < tp[j - 1]) neg += raw;
    }
    out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

export function cmf(candles: Candle[], period = 20): (number | null)[] {
  const out: (number | null)[] = [];
  const mfv = candles.map((c) => {
    const hl = c.high - c.low;
    if (hl === 0) return 0;
    return ((c.close - c.low - (c.high - c.close)) / hl) * c.volume;
  });
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let num = 0;
    let den = 0;
    for (let j = i - period + 1; j <= i; j++) {
      num += mfv[j];
      den += candles[j].volume;
    }
    out.push(den === 0 ? null : num / den);
  }
  return out;
}

export function adl(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = [];
  let cum = 0;
  for (const c of candles) {
    const hl = c.high - c.low;
    const clv = hl === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / hl;
    cum += clv * c.volume;
    out.push(cum);
  }
  return out;
}

export function psar(
  candles: Candle[],
  step = 0.02,
  max = 0.2
): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < 2) return out;
  let bull = true;
  let af = step;
  let ep = candles[0].high;
  let sar = candles[0].low;
  out[0] = sar;
  for (let i = 1; i < candles.length; i++) {
    const prevSar = sar;
    sar = prevSar + af * (ep - prevSar);
    if (bull) {
      sar = Math.min(sar, candles[i - 1].low, i > 1 ? candles[i - 2].low : candles[i - 1].low);
      if (candles[i].low < sar) {
        bull = false;
        sar = ep;
        ep = candles[i].low;
        af = step;
      } else {
        if (candles[i].high > ep) {
          ep = candles[i].high;
          af = Math.min(max, af + step);
        }
      }
    } else {
      sar = Math.max(sar, candles[i - 1].high, i > 1 ? candles[i - 2].high : candles[i - 1].high);
      if (candles[i].high > sar) {
        bull = true;
        sar = ep;
        ep = candles[i].high;
        af = step;
      } else {
        if (candles[i].low < ep) {
          ep = candles[i].low;
          af = Math.min(max, af + step);
        }
      }
    }
    out[i] = sar;
  }
  return out;
}

export function adx(
  candles: Candle[],
  period = 14
): {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
} {
  const n = candles.length;
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [candles[0]?.high - candles[0]?.low || 0];
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const prev = candles[i - 1].close;
    tr.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prev),
        Math.abs(candles[i].low - prev)
      )
    );
  }
  const smooth = (arr: number[]) => {
    const out: (number | null)[] = new Array(n).fill(null);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += arr[i];
      if (i === period - 1) out[i] = sum;
      else if (i >= period) {
        out[i] = (out[i - 1] as number) - (out[i - 1] as number) / period + arr[i];
      }
    }
    return out;
  };
  const str = smooth(tr);
  const sp = smooth(plusDM);
  const sm = smooth(minusDM);
  const plusDI = sp.map((v, i) =>
    v != null && str[i] != null && str[i] !== 0
      ? (100 * v) / (str[i] as number)
      : null
  );
  const minusDI = sm.map((v, i) =>
    v != null && str[i] != null && str[i] !== 0
      ? (100 * v) / (str[i] as number)
      : null
  );
  const dx = plusDI.map((p, i) => {
    const m = minusDI[i];
    if (p == null || m == null) return null;
    const s = p + m;
    return s === 0 ? 0 : (100 * Math.abs(p - m)) / s;
  });
  const adxLine: (number | null)[] = new Array(n).fill(null);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (dx[i] == null) continue;
    if (count < period) {
      sum += dx[i] as number;
      count++;
      if (count === period) adxLine[i] = sum / period;
    } else {
      adxLine[i] =
        ((adxLine[i - 1] as number) * (period - 1) + (dx[i] as number)) / period;
    }
  }
  return { adx: adxLine, plusDI, minusDI };
}

export function linreg(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sx = 0;
    let sy = 0;
    let sxy = 0;
    let sx2 = 0;
    for (let j = 0; j < period; j++) {
      const x = j;
      const y = values[i - period + 1 + j];
      sx += x;
      sy += y;
      sxy += x * y;
      sx2 += x * x;
    }
    const den = period * sx2 - sx * sx;
    const slope = den === 0 ? 0 : (period * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / period;
    out.push(intercept + slope * (period - 1));
  }
  return out;
}

export function ichimoku(
  candles: Candle[],
  tenkan = 9,
  kijun = 26,
  senkou = 52
): {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  spanA: (number | null)[];
  spanB: (number | null)[];
  chikou: (number | null)[];
} {
  const midHL = (period: number, i: number) => {
    if (i < period - 1) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    return (hi + lo) / 2;
  };
  const tenkanArr = candles.map((_, i) => midHL(tenkan, i));
  const kijunArr = candles.map((_, i) => midHL(kijun, i));
  const spanB = candles.map((_, i) => midHL(senkou, i));
  const spanA = candles.map((_, i) =>
    tenkanArr[i] != null && kijunArr[i] != null
      ? ((tenkanArr[i] as number) + (kijunArr[i] as number)) / 2
      : null
  );
  const chikou = candles.map((c, i) =>
    i + kijun < candles.length ? c.close : null
  );
  return { tenkan: tenkanArr, kijun: kijunArr, spanA, spanB, chikou };
}

export function pivotClassic(candles: Candle[]): {
  pp: (number | null)[];
  r1: (number | null)[];
  s1: (number | null)[];
  r2: (number | null)[];
  s2: (number | null)[];
} {
  const pp: (number | null)[] = [];
  const r1: (number | null)[] = [];
  const s1: (number | null)[] = [];
  const r2: (number | null)[] = [];
  const s2: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      pp.push(null);
      r1.push(null);
      s1.push(null);
      r2.push(null);
      s2.push(null);
      continue;
    }
    const prev = candles[i - 1];
    const p = (prev.high + prev.low + prev.close) / 3;
    pp.push(p);
    r1.push(2 * p - prev.low);
    s1.push(2 * p - prev.high);
    r2.push(p + (prev.high - prev.low));
    s2.push(p - (prev.high - prev.low));
  }
  return { pp, r1, s1, r2, s2 };
}

export function zigzag(candles: Candle[], pct = 5): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (!candles.length) return out;
  let lastExt = candles[0].close;
  let lastIdx = 0;
  let dir: 1 | -1 = 1;
  out[0] = lastExt;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i].close;
    const change = ((c - lastExt) / lastExt) * 100;
    if (dir === 1) {
      if (c > lastExt) {
        out[lastIdx] = null;
        lastExt = c;
        lastIdx = i;
        out[i] = c;
      } else if (change <= -pct) {
        dir = -1;
        lastExt = c;
        lastIdx = i;
        out[i] = c;
      }
    } else {
      if (c < lastExt) {
        out[lastIdx] = null;
        lastExt = c;
        lastIdx = i;
        out[i] = c;
      } else if (change >= pct) {
        dir = 1;
        lastExt = c;
        lastIdx = i;
        out[i] = c;
      }
    }
  }
  // connect sparsely: forward-fill for display as stepped line
  let last: number | null = null;
  return out.map((v) => {
    if (v != null) last = v;
    return last;
  });
}

export function highest(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let hi = -Infinity;
    for (let j = i - period + 1; j <= i; j++) hi = Math.max(hi, values[j]);
    return hi;
  });
}

export function lowest(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) lo = Math.min(lo, values[j]);
    return lo;
  });
}

/** Sketch cumulative delta from candle body * volume */
export function cumDelta(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = [];
  let cum = 0;
  for (const c of candles) {
    const body = c.close - c.open;
    const dir = body === 0 ? 0 : body > 0 ? 1 : -1;
    cum += dir * c.volume;
    out.push(cum);
  }
  return out;
}

export function toLineData(
  candles: Candle[],
  values: (number | null)[]
): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v))
      out.push({ time: candles[i].time, value: v });
  }
  return out;
}

/** Map nullable series onto candle times (for series-sourced children) */
export function seriesToLineData(
  times: number[],
  values: (number | null)[]
): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  for (let i = 0; i < times.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) out.push({ time: times[i], value: v });
  }
  return out;
}
