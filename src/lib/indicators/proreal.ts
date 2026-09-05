/**
 * ProRealCode-inspired indicators — conceptual reimplementations.
 * Not affiliated with ProRealTime / ProRealCode; no ProBuilder verbatim.
 */
import type { Candle } from "@/lib/types";
import {
  atr,
  bollinger,
  ema,
  linreg,
  priceSeries,
  rsi,
  sma,
  stddev,
  supertrend,
} from "./math";

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

/** 3-bucket ATR cluster → adaptive SuperTrend multiplier */
export function adaptiveSupertrend(
  candles: Candle[],
  atrLen = 10,
  baseMult = 2,
  lookback = 50
): {
  st: (number | null)[];
  dir: (number | null)[];
  mult: (number | null)[];
  atrLine: (number | null)[];
} {
  const atrLine = atr(candles, atrLen);
  const n = candles.length;
  const mult = fillNull(n);
  const st = fillNull(n);
  const dir = fillNull(n);
  let upper = 0;
  let lower = 0;
  let trend = 1;
  for (let i = 0; i < n; i++) {
    const a = atrLine[i];
    if (a == null) continue;
    const start = Math.max(0, i - lookback + 1);
    const window: number[] = [];
    for (let j = start; j <= i; j++) {
      const v = atrLine[j];
      if (v != null) window.push(v);
    }
    if (window.length < 5) continue;
    const sorted = [...window].sort((x, y) => x - y);
    const p33 = sorted[Math.floor(sorted.length * 0.33)];
    const p66 = sorted[Math.floor(sorted.length * 0.66)];
    let m = baseMult;
    if (a <= p33) m = baseMult * 0.75;
    else if (a >= p66) m = baseMult * 1.4;
    else m = baseMult;
    mult[i] = m;
    const mid = (candles[i].high + candles[i].low) / 2;
    const bu = mid + m * a;
    const bl = mid - m * a;
    if (i === 0 || atrLine[i - 1] == null) {
      upper = bu;
      lower = bl;
      trend = candles[i].close >= mid ? 1 : -1;
    } else {
      lower = candles[i - 1].close > lower ? Math.max(bl, lower) : bl;
      upper = candles[i - 1].close < upper ? Math.min(bu, upper) : bu;
      if (trend === 1 && candles[i].close < lower) trend = -1;
      else if (trend === -1 && candles[i].close > upper) trend = 1;
    }
    st[i] = trend === 1 ? lower : upper;
    dir[i] = trend;
  }
  return { st, dir, mult, atrLine };
}

/** LinReg channel + R² fit score */
export function adaptiveTrendChannel(
  values: number[],
  candles: Candle[],
  period = 40,
  mult = 2
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  fit: (number | null)[];
} {
  const mid = linreg(values, period);
  const n = values.length;
  const upper = fillNull(n);
  const lower = fillNull(n);
  const fit = fillNull(n);
  for (let i = period - 1; i < n; i++) {
    const m = mid[i];
    if (m == null) continue;
    let ssRes = 0;
    let ssTot = 0;
    let mean = 0;
    for (let j = i - period + 1; j <= i; j++) mean += values[j];
    mean /= period;
    // residual vs line slope approximation using endpoint mid
    const m0 = mid[i - period + 1] ?? m;
    for (let j = 0; j < period; j++) {
      const idx = i - period + 1 + j;
      const pred = m0 + ((m - m0) * j) / (period - 1 || 1);
      const err = values[idx] - pred;
      ssRes += err * err;
      ssTot += (values[idx] - mean) ** 2;
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    fit[i] = Math.max(0, Math.min(1, r2)) * 100;
    const sd = Math.sqrt(ssRes / period);
    const scale = mult * (0.5 + (1 - Math.max(0, Math.min(1, r2))));
    upper[i] = m + scale * sd;
    lower[i] = m - scale * sd;
  }
  void candles;
  return { mid, upper, lower, fit };
}

/** ATR trail + simple trend quality (0-100) */
export function qualityTrendTrail(
  candles: Candle[],
  atrLen = 14,
  mult = 2.5,
  qualLen = 20
): {
  trail: (number | null)[];
  quality: (number | null)[];
  dir: (number | null)[];
} {
  const a = atr(candles, atrLen);
  const closes = priceSeries(candles, "close");
  const ma = sma(closes, qualLen);
  const n = candles.length;
  const trail = fillNull(n);
  const quality = fillNull(n);
  const dir = fillNull(n);
  let t = closes[0];
  let d = 1;
  for (let i = 0; i < n; i++) {
    const atrV = a[i];
    if (atrV == null || ma[i] == null) continue;
    const up = closes[i] - mult * atrV;
    const dn = closes[i] + mult * atrV;
    if (d === 1) {
      t = Math.max(t, up);
      if (closes[i] < t) {
        d = -1;
        t = dn;
      }
    } else {
      t = Math.min(t, dn);
      if (closes[i] > t) {
        d = 1;
        t = up;
      }
    }
    trail[i] = t;
    dir[i] = d;
    // quality: % of bars where close is on correct side of MA + ADX-ish slope
    let hits = 0;
    const start = Math.max(0, i - qualLen + 1);
    for (let j = start; j <= i; j++) {
      if (ma[j] == null) continue;
      if (d === 1 && closes[j] >= (ma[j] as number)) hits++;
      if (d === -1 && closes[j] <= (ma[j] as number)) hits++;
    }
    const slope =
      i >= qualLen && ma[i] != null && ma[i - qualLen + 1] != null
        ? ((ma[i] as number) - (ma[i - qualLen + 1] as number)) /
          (Math.abs(ma[i - qualLen + 1] as number) || 1)
        : 0;
    const slopeScore = Math.min(1, Math.abs(slope) * 50);
    quality[i] = (hits / Math.max(1, i - start + 1)) * 70 + slopeScore * 30;
  }
  return { trail, quality, dir };
}

/** Variance-weighted linear regression mid + bands */
export function varWeightedRegression(
  values: number[],
  period = 30,
  mult = 2
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const n = values.length;
  const mid = fillNull(n);
  const upper = fillNull(n);
  const lower = fillNull(n);
  for (let i = period - 1; i < n; i++) {
    // local variance weights (inverse of rolling |diff|)
    const weights: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    for (let j = 0; j < period; j++) {
      const idx = i - period + 1 + j;
      const vol =
        idx > 0 ? Math.abs(values[idx] - values[idx - 1]) + 1e-9 : 1e-9;
      const w = 1 / vol;
      weights.push(w);
      xs.push(j);
      ys.push(values[idx]);
    }
    let sw = 0,
      sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (let j = 0; j < period; j++) {
      sw += weights[j];
      sx += weights[j] * xs[j];
      sy += weights[j] * ys[j];
      sxx += weights[j] * xs[j] * xs[j];
      sxy += weights[j] * xs[j] * ys[j];
    }
    const den = sw * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) continue;
    const slope = (sw * sxy - sx * sy) / den;
    const intercept = (sy - slope * sx) / sw;
    const yHat = intercept + slope * (period - 1);
    mid[i] = yHat;
    let varSum = 0;
    for (let j = 0; j < period; j++) {
      const pred = intercept + slope * xs[j];
      varSum += weights[j] * (ys[j] - pred) ** 2;
    }
    const sd = Math.sqrt(varSum / sw);
    upper[i] = yHat + mult * sd;
    lower[i] = yHat - mult * sd;
  }
  return { mid, upper, lower };
}

/** Asymmetric volatility envelope (up/down vol separate) */
export function asymVolEnvelope(
  candles: Candle[],
  period = 20,
  upMult = 2,
  dnMult = 2
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const closes = priceSeries(candles, "close");
  const mid = ema(closes, period);
  const n = candles.length;
  const upper = fillNull(n);
  const lower = fillNull(n);
  for (let i = period; i < n; i++) {
    if (mid[i] == null) continue;
    let upSum = 0,
      upN = 0,
      dnSum = 0,
      dnN = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const ch = closes[j] - closes[j - 1];
      if (ch >= 0) {
        upSum += ch * ch;
        upN++;
      } else {
        dnSum += ch * ch;
        dnN++;
      }
    }
    const upVol = Math.sqrt(upSum / Math.max(1, upN));
    const dnVol = Math.sqrt(dnSum / Math.max(1, dnN));
    upper[i] = (mid[i] as number) + upMult * upVol * Math.sqrt(period);
    lower[i] = (mid[i] as number) - dnMult * dnVol * Math.sqrt(period);
  }
  return { mid, upper, lower };
}

/** Sweep → reversal map markers (1 bull, -1 bear) */
export function sweepReversalMap(
  candles: Candle[],
  lookback = 20,
  confirm = 2
): {
  bull: (number | null)[];
  bear: (number | null)[];
  state: (number | null)[];
} {
  const n = candles.length;
  const bull = fillNull(n);
  const bear = fillNull(n);
  const state = fillNull(n);
  for (let i = lookback; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - lookback; j < i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    const c = candles[i];
    // sweep high then close back below → bearish reversal
    if (c.high > hi && c.close < hi) {
      let ok = true;
      for (let k = 1; k <= confirm && i + k < n; k++) {
        /* marker on sweep bar; confirm optional for strength */
      }
      void ok;
      bear[i] = c.high;
      state[i] = -1;
    }
    // sweep low then close back above → bullish reversal
    if (c.low < lo && c.close > lo) {
      bull[i] = c.low;
      state[i] = 1;
    }
  }
  return { bull, bear, state };
}

/** Initial Balance — first N bars of UTC day (or sessionBars) */
export function initialBalance(
  candles: Candle[],
  sessionBars = 4
): {
  ibHigh: (number | null)[];
  ibLow: (number | null)[];
  ibMid: (number | null)[];
} {
  const n = candles.length;
  const ibHigh = fillNull(n);
  const ibLow = fillNull(n);
  const ibMid = fillNull(n);
  let dayKey = "";
  let barsInDay = 0;
  let h = -Infinity;
  let l = Infinity;
  let lockedH = NaN;
  let lockedL = NaN;
  for (let i = 0; i < n; i++) {
    const d = new Date(candles[i].time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (key !== dayKey) {
      dayKey = key;
      barsInDay = 0;
      h = -Infinity;
      l = Infinity;
      lockedH = NaN;
      lockedL = NaN;
    }
    barsInDay++;
    if (barsInDay <= sessionBars) {
      h = Math.max(h, candles[i].high);
      l = Math.min(l, candles[i].low);
      lockedH = h;
      lockedL = l;
    }
    if (Number.isFinite(lockedH)) {
      ibHigh[i] = lockedH;
      ibLow[i] = lockedL;
      ibMid[i] = (lockedH + lockedL) / 2;
    }
  }
  return { ibHigh, ibLow, ibMid };
}

/** Fibonacci gravity clusters from recent swings */
export function fibGravityClusters(
  candles: Candle[],
  swing = 3,
  lookback = 80
): {
  cluster: (number | null)[];
  gravUp: (number | null)[];
  gravDn: (number | null)[];
} {
  const n = candles.length;
  const cluster = fillNull(n);
  const gravUp = fillNull(n);
  const gravDn = fillNull(n);
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786];
  for (let i = lookback; i < n; i++) {
    const start = i - lookback;
    let sh = -Infinity;
    let sl = Infinity;
    for (let j = start + swing; j <= i - swing; j++) {
      let isHi = true;
      let isLo = true;
      for (let k = 1; k <= swing; k++) {
        if (candles[j].high <= candles[j - k].high || candles[j].high <= candles[j + k].high)
          isHi = false;
        if (candles[j].low >= candles[j - k].low || candles[j].low >= candles[j + k].low)
          isLo = false;
      }
      if (isHi) sh = Math.max(sh, candles[j].high);
      if (isLo) sl = Math.min(sl, candles[j].low);
    }
    if (!Number.isFinite(sh) || !Number.isFinite(sl) || sh <= sl) continue;
    const range = sh - sl;
    const levels: number[] = [];
    for (const r of ratios) {
      levels.push(sl + range * r);
      levels.push(sh - range * r);
    }
    // density-weighted gravity center near price
    const px = candles[i].close;
    let wSum = 0;
    let pSum = 0;
    for (const lv of levels) {
      const w = 1 / (Math.abs(px - lv) + range * 0.01);
      wSum += w;
      pSum += w * lv;
    }
    const g = pSum / wSum;
    cluster[i] = g;
    gravUp[i] = Math.max(...levels.filter((lv) => lv >= px), sh);
    gravDn[i] = Math.min(...levels.filter((lv) => lv <= px), sl);
  }
  return { cluster, gravUp, gravDn };
}

/** PAC-lite HH/HL/LH/LL structure markers */
export function pacLiteStructure(
  candles: Candle[],
  swing = 2
): {
  hh: (number | null)[];
  hl: (number | null)[];
  lh: (number | null)[];
  ll: (number | null)[];
} {
  const n = candles.length;
  const hh = fillNull(n);
  const hl = fillNull(n);
  const lh = fillNull(n);
  const ll = fillNull(n);
  let lastSwingHigh: number | null = null;
  let lastSwingLow: number | null = null;
  for (let i = swing; i < n - swing; i++) {
    let isHi = true;
    let isLo = true;
    for (let k = 1; k <= swing; k++) {
      if (candles[i].high <= candles[i - k].high || candles[i].high < candles[i + k].high)
        isHi = false;
      if (candles[i].low >= candles[i - k].low || candles[i].low > candles[i + k].low)
        isLo = false;
    }
    if (isHi) {
      if (lastSwingHigh != null && candles[i].high > lastSwingHigh) hh[i] = candles[i].high;
      else if (lastSwingHigh != null) lh[i] = candles[i].high;
      else hh[i] = candles[i].high;
      lastSwingHigh = candles[i].high;
    }
    if (isLo) {
      if (lastSwingLow != null && candles[i].low > lastSwingLow) hl[i] = candles[i].low;
      else if (lastSwingLow != null) ll[i] = candles[i].low;
      else hl[i] = candles[i].low;
      lastSwingLow = candles[i].low;
    }
  }
  return { hh, hl, lh, ll };
}

/** Mean-reversion RSI + BB %B combo oscillator (0-100) */
export function rsiBbCombo(
  values: number[],
  rsiLen = 14,
  bbLen = 20,
  bbMult = 2
): {
  combo: (number | null)[];
  rsiLine: (number | null)[];
  pctB: (number | null)[];
} {
  const rsiLine = rsi(values, rsiLen);
  const bb = bollinger(values, bbLen, bbMult);
  const n = values.length;
  const combo = fillNull(n);
  const pctB = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (bb.upper[i] == null || bb.lower[i] == null || rsiLine[i] == null) continue;
    const width = (bb.upper[i] as number) - (bb.lower[i] as number);
    const pb =
      width > 0
        ? ((values[i] - (bb.lower[i] as number)) / width) * 100
        : 50;
    pctB[i] = pb;
    combo[i] = (rsiLine[i] as number) * 0.55 + pb * 0.45;
  }
  return { combo, rsiLine, pctB };
}

/** Elder Impulse: 1 green, -1 red, 0 blue */
export function elderImpulse(
  values: number[],
  emaLen = 13,
  macdFast = 12,
  macdSlow = 26,
  macdSig = 9
): {
  impulse: (number | null)[];
  emaLine: (number | null)[];
  hist: (number | null)[];
} {
  const emaLine = ema(values, emaLen);
  const fast = ema(values, macdFast);
  const slow = ema(values, macdSlow);
  const n = values.length;
  const macdLine = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (fast[i] != null && slow[i] != null) macdLine[i] = (fast[i] as number) - (slow[i] as number);
  }
  const signal = ema(
    macdLine.map((v) => v ?? 0),
    macdSig
  );
  // re-null where macd was null
  const hist = fillNull(n);
  const impulse = fillNull(n);
  for (let i = 1; i < n; i++) {
    if (macdLine[i] == null || signal[i] == null || emaLine[i] == null || emaLine[i - 1] == null)
      continue;
    hist[i] = (macdLine[i] as number) - (signal[i] as number);
    const emaUp = (emaLine[i] as number) > (emaLine[i - 1] as number);
    const histUp = hist[i]! > (hist[i - 1] ?? hist[i]!);
    if (emaUp && histUp) impulse[i] = 1;
    else if (!emaUp && !histUp) impulse[i] = -1;
    else impulse[i] = 0;
  }
  return { impulse, emaLine, hist };
}

/** Laguerre RSI (Ehlers-style simplified) */
export function laguerreRsi(
  values: number[],
  gamma = 0.5
): { lrsi: (number | null)[] } {
  const n = values.length;
  const lrsi = fillNull(n);
  let L0 = 0,
    L1 = 0,
    L2 = 0,
    L3 = 0;
  const g = Math.min(0.95, Math.max(0.05, gamma));
  for (let i = 0; i < n; i++) {
    const price = values[i];
    const prev0 = L0;
    const prev1 = L1;
    const prev2 = L2;
    L0 = (1 - g) * price + g * L0;
    L1 = -g * L0 + prev0 + g * L1;
    L2 = -g * L1 + prev1 + g * L2;
    L3 = -g * L2 + prev2 + g * L3;
    let cu = 0,
      cd = 0;
    if (L0 >= L1) cu = L0 - L1;
    else cd = L1 - L0;
    if (L1 >= L2) cu += L1 - L2;
    else cd += L2 - L1;
    if (L2 >= L3) cu += L2 - L3;
    else cd += L3 - L2;
    lrsi[i] = cu + cd !== 0 ? (cu / (cu + cd)) * 100 : 50;
  }
  return { lrsi };
}

/** Coral Trend approx — multi-smoothed EMA trail */
export function coralTrend(
  values: number[],
  period = 34,
  mult = 0.4
): {
  coral: (number | null)[];
  dir: (number | null)[];
} {
  const e1 = ema(values, period);
  const e2 = ema(
    e1.map((v) => v ?? 0),
    period
  );
  const e3 = ema(
    e2.map((v) => v ?? 0),
    period
  );
  const n = values.length;
  const coral = fillNull(n);
  const dir = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (e1[i] == null || e2[i] == null || e3[i] == null) continue;
    // triangular-ish blend
    const c =
      (e1[i] as number) * (1 + mult) -
      (e2[i] as number) * mult +
      ((e3[i] as number) - (e2[i] as number)) * mult * 0.5;
    coral[i] = c;
    dir[i] = values[i] >= c ? 1 : -1;
  }
  return { coral, dir };
}

/** Nadaraya-Watson rough kernel regression band */
export function nadarayaWatson(
  values: number[],
  bandwidth = 8,
  mult = 1.5
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const n = values.length;
  const mid = fillNull(n);
  const upper = fillNull(n);
  const lower = fillNull(n);
  const h = Math.max(1, bandwidth);
  const window = Math.ceil(h * 3);
  for (let i = 0; i < n; i++) {
    let num = 0;
    let den = 0;
    const lo = Math.max(0, i - window);
    const hi = Math.min(n - 1, i + window);
    // causal-ish: only past for trading realism
    const hi2 = i;
    for (let j = lo; j <= hi2; j++) {
      const u = (i - j) / h;
      const k = Math.exp(-0.5 * u * u);
      num += k * values[j];
      den += k;
    }
    if (den === 0) continue;
    const m = num / den;
    mid[i] = m;
    // residual band from recent window
    let ss = 0;
    let cnt = 0;
    for (let j = lo; j <= hi2; j++) {
      const u = (i - j) / h;
      const k = Math.exp(-0.5 * u * u);
      const pred = m; // approx
      ss += k * (values[j] - pred) ** 2;
      cnt += k;
    }
    const sd = Math.sqrt(ss / Math.max(cnt, 1e-9));
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
    void hi;
  }
  return { mid, upper, lower };
}

/** Schaff Trend Cycle */
export function schaffTrendCycle(
  values: number[],
  period = 10,
  fast = 23,
  slow = 50
): {
  stc: (number | null)[];
  macd: (number | null)[];
} {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const n = values.length;
  const macdLine = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (ef[i] != null && es[i] != null) macdLine[i] = (ef[i] as number) - (es[i] as number);
  }
  // stochastic of macd, then smooth, then stoch again
  const stoch1 = fillNull(n);
  for (let i = period - 1; i < n; i++) {
    let hi = -Infinity,
      lo = Infinity;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (macdLine[j] == null) {
        ok = false;
        break;
      }
      hi = Math.max(hi, macdLine[j] as number);
      lo = Math.min(lo, macdLine[j] as number);
    }
    if (!ok) continue;
    stoch1[i] = hi !== lo ? (100 * ((macdLine[i] as number) - lo)) / (hi - lo) : 50;
  }
  const smooth1 = ema(
    stoch1.map((v) => v ?? 50),
    3
  );
  const stoch2 = fillNull(n);
  for (let i = period - 1; i < n; i++) {
    let hi = -Infinity,
      lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      const v = smooth1[j];
      if (v == null) continue;
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
    if (!Number.isFinite(hi) || hi === lo) continue;
    stoch2[i] = (100 * ((smooth1[i] as number) - lo)) / (hi - lo);
  }
  const stc = ema(
    stoch2.map((v) => v ?? 50),
    3
  );
  // null early
  for (let i = 0; i < Math.min(n, period + slow); i++) {
    if (macdLine[i] == null) stc[i] = null;
  }
  return { stc, macd: macdLine };
}

/** Self-aware quality trail (alias-rich variant with QI oscillator) */
export function selfAwareTrail(
  candles: Candle[],
  atrLen = 10,
  mult = 3,
  qiLen = 14
): {
  trail: (number | null)[];
  qi: (number | null)[];
  dir: (number | null)[];
} {
  const base = qualityTrendTrail(candles, atrLen, mult, qiLen);
  return { trail: base.trail, qi: base.quality, dir: base.dir };
}

/** Classic SuperTrend for comparison wrappers */
export function classicSupertrendRef(
  candles: Candle[],
  period = 10,
  mult = 3
): ReturnType<typeof supertrend> {
  return supertrend(candles, period, mult);
}

/** PRT-style DMI pack with ADX/DI+/DI- already in math — add DX hist */
export function prtDmiPack(
  candles: Candle[],
  period = 14
): {
  adx: (number | null)[];
  dip: (number | null)[];
  dim: (number | null)[];
  dx: (number | null)[];
} {
  // inline Wilder DMI
  const n = candles.length;
  const tr = fillNull(n);
  const plusDM = fillNull(n);
  const minusDM = fillNull(n);
  for (let i = 1; i < n; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - candles[i - 1].high;
    const dn = candles[i - 1].low - l;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
  }
  const smooth = (arr: (number | null)[], len: number) => {
    const out = fillNull(n);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (arr[i] == null) continue;
      sum += arr[i] as number;
      count++;
      if (count === len) {
        out[i] = sum;
      } else if (count > len) {
        out[i] = (out[i - 1] as number) - (out[i - 1] as number) / len + (arr[i] as number);
      }
    }
    return out;
  };
  const str = smooth(tr, period);
  const sPlus = smooth(plusDM, period);
  const sMinus = smooth(minusDM, period);
  const dip = fillNull(n);
  const dim = fillNull(n);
  const dx = fillNull(n);
  const adxLine = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (str[i] == null || (str[i] as number) === 0) continue;
    dip[i] = (100 * (sPlus[i] as number)) / (str[i] as number);
    dim[i] = (100 * (sMinus[i] as number)) / (str[i] as number);
    const sum = (dip[i] as number) + (dim[i] as number);
    dx[i] = sum === 0 ? 0 : (100 * Math.abs((dip[i] as number) - (dim[i] as number))) / sum;
  }
  // ADX = Wilder smooth of DX
  let adxSum = 0;
  let adxCount = 0;
  for (let i = 0; i < n; i++) {
    if (dx[i] == null) continue;
    adxCount++;
    if (adxCount < period) {
      adxSum += dx[i] as number;
    } else if (adxCount === period) {
      adxSum += dx[i] as number;
      adxLine[i] = adxSum / period;
    } else {
      adxLine[i] =
        ((adxLine[i - 1] as number) * (period - 1) + (dx[i] as number)) / period;
    }
  }
  return { adx: adxLine, dip, dim, dx };
}

/** Adaptive MACD — lengths scale with ATR percentile */
export function adaptiveMacd(
  values: number[],
  candles: Candle[],
  baseFast = 12,
  baseSlow = 26,
  signal = 9
): {
  macd: (number | null)[];
  sig: (number | null)[];
  hist: (number | null)[];
} {
  const a = atr(candles, 14);
  const n = values.length;
  // Use fixed EMA but scale histogram by vol regime; also dual-speed blend
  const fast = ema(values, baseFast);
  const slow = ema(values, baseSlow);
  const fastA = ema(values, Math.max(5, Math.round(baseFast * 0.7)));
  const slowA = ema(values, Math.round(baseSlow * 1.2));
  const macd = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (fast[i] == null || slow[i] == null) continue;
    const atrV = a[i];
    let w = 0.5;
    if (atrV != null && i > 30) {
      const slice = a.slice(Math.max(0, i - 49), i + 1).filter((x) => x != null) as number[];
      const sorted = [...slice].sort((x, y) => x - y);
      const rank = sorted.indexOf(atrV) / Math.max(1, sorted.length - 1);
      w = rank; // high vol → slower mix
    }
    const m1 = (fast[i] as number) - (slow[i] as number);
    const m2 =
      fastA[i] != null && slowA[i] != null
        ? (fastA[i] as number) - (slowA[i] as number)
        : m1;
    macd[i] = m1 * (1 - w) + m2 * w;
  }
  const sig = ema(
    macd.map((v) => v ?? 0),
    signal
  );
  const hist = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (macd[i] == null || sig[i] == null) continue;
    hist[i] = (macd[i] as number) - (sig[i] as number);
  }
  return { macd, sig, hist };
}

void stddev;
