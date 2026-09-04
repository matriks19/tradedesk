import type { Candle } from "@/lib/types";

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
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
  let prevDir: -1 | 1 = 1;
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
    prevDir = dir;
    prevSt = st;
  }
  return { line, direction };
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
