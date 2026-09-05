/**
 * BigBeluga / SMC-inspired overlays & oscillators — original implementations
 * from public feature concepts (order blocks, FVG, structure, etc.).
 * Inspired by BigBeluga SMC concepts — community reconstructions, not affiliated.
 */
import type { Candle } from "@/lib/types";
import { adx, atr, cmf, ema, linreg, mfi, rsi, sma } from "./math";
import { jma, jurikVolty } from "./jurik";

function swingHigh(candles: Candle[], i: number, left: number, right: number): boolean {
  if (i < left || i + right >= candles.length) return false;
  const p = candles[i].high;
  for (let j = i - left; j <= i + right; j++) {
    if (j === i) continue;
    if (candles[j].high >= p) return false;
  }
  return true;
}

function swingLow(candles: Candle[], i: number, left: number, right: number): boolean {
  if (i < left || i + right >= candles.length) return false;
  const p = candles[i].low;
  for (let j = i - left; j <= i + right; j++) {
    if (j === i) continue;
    if (candles[j].low <= p) return false;
  }
  return true;
}

/** Order block zones as step series (top/bottom + bias). */
export function orderBlocks(
  candles: Candle[],
  swing = 3,
  impulseMult = 1.2
): {
  bullTop: (number | null)[];
  bullBot: (number | null)[];
  bearTop: (number | null)[];
  bearBot: (number | null)[];
  mid: (number | null)[];
} {
  const n = candles.length;
  const bullTop: (number | null)[] = new Array(n).fill(null);
  const bullBot: (number | null)[] = new Array(n).fill(null);
  const bearTop: (number | null)[] = new Array(n).fill(null);
  const bearBot: (number | null)[] = new Array(n).fill(null);
  const mid: (number | null)[] = new Array(n).fill(null);
  const a = atr(candles, 14);

  let curBull: { top: number; bot: number } | null = null;
  let curBear: { top: number; bot: number } | null = null;

  for (let i = swing; i < n - swing; i++) {
    const atrV = a[i] ?? 0;
    if (swingLow(candles, i, swing, swing)) {
      // Impulse up after low: look ahead for strong bullish move
      let impulse = false;
      for (let j = i + 1; j <= Math.min(n - 1, i + swing + 2); j++) {
        if (candles[j].close - candles[i].low > impulseMult * atrV) {
          impulse = true;
          break;
        }
      }
      if (impulse) {
        curBull = {
          top: Math.max(candles[i].open, candles[i].close),
          bot: candles[i].low,
        };
      }
    }
    if (swingHigh(candles, i, swing, swing)) {
      let impulse = false;
      for (let j = i + 1; j <= Math.min(n - 1, i + swing + 2); j++) {
        if (candles[i].high - candles[j].close > impulseMult * atrV) {
          impulse = true;
          break;
        }
      }
      if (impulse) {
        curBear = {
          top: candles[i].high,
          bot: Math.min(candles[i].open, candles[i].close),
        };
      }
    }
  }

  // Forward-fill active zones; invalidate when price closes through
  curBull = null;
  curBear = null;
  for (let i = swing; i < n; i++) {
    const atrV = a[i] ?? 0;
    // detect new OBs with lookback confirmed swings (right side available if i-swing)
    const si = i - swing;
    if (si >= swing && swingLow(candles, si, swing, swing)) {
      let impulse = false;
      for (let j = si + 1; j <= i; j++) {
        if (candles[j].close - candles[si].low > impulseMult * atrV) {
          impulse = true;
          break;
        }
      }
      if (impulse) {
        curBull = {
          top: Math.max(candles[si].open, candles[si].close),
          bot: candles[si].low,
        };
      }
    }
    if (si >= swing && swingHigh(candles, si, swing, swing)) {
      let impulse = false;
      for (let j = si + 1; j <= i; j++) {
        if (candles[si].high - candles[j].close > impulseMult * atrV) {
          impulse = true;
          break;
        }
      }
      if (impulse) {
        curBear = {
          top: candles[si].high,
          bot: Math.min(candles[si].open, candles[si].close),
        };
      }
    }

    if (curBull && candles[i].close < curBull.bot) curBull = null;
    if (curBear && candles[i].close > curBear.top) curBear = null;

    if (curBull) {
      bullTop[i] = curBull.top;
      bullBot[i] = curBull.bot;
      mid[i] = (curBull.top + curBull.bot) / 2;
    }
    if (curBear) {
      bearTop[i] = curBear.top;
      bearBot[i] = curBear.bot;
      if (mid[i] == null) mid[i] = (curBear.top + curBear.bot) / 2;
    }
  }
  return { bullTop, bullBot, bearTop, bearBot, mid };
}

/** 3-candle Fair Value Gaps as step band series. */
export function fairValueGaps(
  candles: Candle[],
  extend = 20
): {
  bullTop: (number | null)[];
  bullBot: (number | null)[];
  bearTop: (number | null)[];
  bearBot: (number | null)[];
} {
  const n = candles.length;
  const bullTop: (number | null)[] = new Array(n).fill(null);
  const bullBot: (number | null)[] = new Array(n).fill(null);
  const bearTop: (number | null)[] = new Array(n).fill(null);
  const bearBot: (number | null)[] = new Array(n).fill(null);

  type Gap = { top: number; bot: number; end: number; bull: boolean };
  const active: Gap[] = [];

  for (let i = 2; i < n; i++) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    // Bullish FVG: candle0 high < candle2 low
    if (c0.high < c2.low) {
      active.push({
        top: c2.low,
        bot: c0.high,
        end: Math.min(n - 1, i + extend),
        bull: true,
      });
    }
    // Bearish FVG: candle0 low > candle2 high
    if (c0.low > c2.high) {
      active.push({
        top: c0.low,
        bot: c2.high,
        end: Math.min(n - 1, i + extend),
        bull: false,
      });
    }
    // Fill / expire
    for (let g = active.length - 1; g >= 0; g--) {
      const gap = active[g];
      if (i > gap.end) {
        active.splice(g, 1);
        continue;
      }
      if (gap.bull && candles[i].low <= gap.bot) {
        active.splice(g, 1);
        continue;
      }
      if (!gap.bull && candles[i].high >= gap.top) {
        active.splice(g, 1);
        continue;
      }
      if (gap.bull) {
        bullTop[i] = gap.top;
        bullBot[i] = gap.bot;
      } else {
        bearTop[i] = gap.top;
        bearBot[i] = gap.bot;
      }
    }
  }
  return { bullTop, bullBot, bearTop, bearBot };
}

/** BOS / CHoCH level lines (step). */
export function bosChoch(
  candles: Candle[],
  swing = 3
): {
  bos: (number | null)[];
  choch: (number | null)[];
  bias: (number | null)[];
} {
  const n = candles.length;
  const bos: (number | null)[] = new Array(n).fill(null);
  const choch: (number | null)[] = new Array(n).fill(null);
  const bias: (number | null)[] = new Array(n).fill(null);

  const sh: { i: number; price: number }[] = [];
  const sl: { i: number; price: number }[] = [];
  for (let i = swing; i < n - swing; i++) {
    if (swingHigh(candles, i, swing, swing)) sh.push({ i, price: candles[i].high });
    if (swingLow(candles, i, swing, swing)) sl.push({ i, price: candles[i].low });
  }

  let lastBos: number | null = null;
  let lastChoch: number | null = null;
  let trend = 0; // 1 bull -1 bear

  for (let i = 0; i < n; i++) {
    const confirmedSh = sh.filter((s) => s.i + swing <= i);
    const confirmedSl = sl.filter((s) => s.i + swing <= i);
    if (confirmedSh.length >= 2 && confirmedSl.length >= 2) {
      const h1 = confirmedSh[confirmedSh.length - 2];
      const h2 = confirmedSh[confirmedSh.length - 1];
      const l1 = confirmedSl[confirmedSl.length - 2];
      const l2 = confirmedSl[confirmedSl.length - 1];
      const wasBull = h2.price > h1.price && l2.price > l1.price;
      const wasBear = h2.price < h1.price && l2.price < l1.price;

      if (l2.price > l1.price && candles[i].close > h1.price) {
        lastBos = h1.price;
        trend = 1;
      }
      if (h2.price < h1.price && candles[i].close < l1.price) {
        lastBos = l1.price;
        trend = -1;
      }
      if (wasBull && candles[i].close < l2.price) {
        lastChoch = l2.price;
        trend = -1;
      }
      if (wasBear && candles[i].close > h2.price) {
        lastChoch = h2.price;
        trend = 1;
      }
    }
    bos[i] = lastBos;
    choch[i] = lastChoch;
    bias[i] = trend === 0 ? null : trend;
  }
  return { bos, choch, bias };
}

/** Equal highs / lows liquidity levels. */
export function equalHighsLows(
  candles: Candle[],
  swing = 3,
  tolPct = 0.15
): {
  eqh: (number | null)[];
  eql: (number | null)[];
} {
  const n = candles.length;
  const eqh: (number | null)[] = new Array(n).fill(null);
  const eql: (number | null)[] = new Array(n).fill(null);
  const highs: { i: number; price: number }[] = [];
  const lows: { i: number; price: number }[] = [];
  for (let i = swing; i < n - swing; i++) {
    if (swingHigh(candles, i, swing, swing)) highs.push({ i, price: candles[i].high });
    if (swingLow(candles, i, swing, swing)) lows.push({ i, price: candles[i].low });
  }
  let lastEqh: number | null = null;
  let lastEql: number | null = null;
  for (let i = 0; i < n; i++) {
    const hs = highs.filter((h) => h.i + swing <= i);
    const ls = lows.filter((l) => l.i + swing <= i);
    for (let a = hs.length - 1; a >= 1 && a >= hs.length - 6; a--) {
      for (let b = a - 1; b >= 0 && b >= a - 5; b--) {
        const avg = (hs[a].price + hs[b].price) / 2;
        if (Math.abs(hs[a].price - hs[b].price) / avg <= tolPct / 100) {
          lastEqh = avg;
          break;
        }
      }
    }
    for (let a = ls.length - 1; a >= 1 && a >= ls.length - 6; a--) {
      for (let b = a - 1; b >= 0 && b >= a - 5; b--) {
        const avg = (ls[a].price + ls[b].price) / 2;
        if (Math.abs(ls[a].price - ls[b].price) / avg <= tolPct / 100) {
          lastEql = avg;
          break;
        }
      }
    }
    eqh[i] = lastEqh;
    eql[i] = lastEql;
  }
  return { eqh, eql };
}

/** Premium / discount / equilibrium from rolling range. */
export function premiumDiscount(
  candles: Candle[],
  lookback = 50
): {
  premium: (number | null)[];
  equilibrium: (number | null)[];
  discount: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
} {
  const n = candles.length;
  const lb = Math.max(5, Math.floor(lookback));
  const premium: (number | null)[] = [];
  const equilibrium: (number | null)[] = [];
  const discount: (number | null)[] = [];
  const high: (number | null)[] = [];
  const low: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i < lb - 1) {
      premium.push(null);
      equilibrium.push(null);
      discount.push(null);
      high.push(null);
      low.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - lb + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    const mid = (hi + lo) / 2;
    const prem = lo + (hi - lo) * 0.7;
    const disc = lo + (hi - lo) * 0.3;
    high.push(hi);
    low.push(lo);
    equilibrium.push(mid);
    premium.push(prem);
    discount.push(disc);
  }
  return { premium, equilibrium, discount, high, low };
}

/** Liquidity sweep markers (price at sweep) + state. */
export function liquiditySweep(
  candles: Candle[],
  lookback = 20
): {
  sweepHigh: (number | null)[];
  sweepLow: (number | null)[];
  state: (number | null)[];
} {
  const n = candles.length;
  const lb = Math.max(5, Math.floor(lookback));
  const sweepHigh: (number | null)[] = new Array(n).fill(null);
  const sweepLow: (number | null)[] = new Array(n).fill(null);
  const state: (number | null)[] = new Array(n).fill(null);
  for (let i = lb; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - lb; j < i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    const c = candles[i];
    const rng = c.high - c.low || 1;
    if (c.high > hi && c.close < hi && (c.high - Math.max(c.open, c.close)) / rng > 0.4) {
      sweepHigh[i] = c.high;
      state[i] = -1;
    }
    if (c.low < lo && c.close > lo && (Math.min(c.open, c.close) - c.low) / rng > 0.4) {
      sweepLow[i] = c.low;
      state[i] = 1;
    }
  }
  return { sweepHigh, sweepLow, state };
}

/**
 * Nautilus-like / Beluga Momentum — original composite:
 * blend RSI + MFI + trend strength → smoothed oscillator with exhaustion zones.
 */
export function nautilusLike(
  candles: Candle[],
  len = 14,
  smooth = 5
): {
  osc: (number | null)[];
  signal: (number | null)[];
  upperEx: (number | null)[];
  lowerEx: (number | null)[];
  mid: (number | null)[];
} {
  const closes = candles.map((c) => c.close);
  const r = rsi(closes, len);
  const mf = mfi(candles, len);
  const e = ema(closes, len);
  const trend: (number | null)[] = closes.map((c, i) => {
    if (e[i] == null) return null;
    const diff = ((c - (e[i] as number)) / (e[i] as number)) * 100;
    return 50 + Math.max(-50, Math.min(50, diff * 8));
  });
  const raw = closes.map((_, i) => {
    if (r[i] == null || mf[i] == null || trend[i] == null) return null;
    return 0.4 * (r[i] as number) + 0.35 * (mf[i] as number) + 0.25 * (trend[i] as number);
  });
  const filled = raw.map((v) => v ?? 50);
  const osc = jma(filled, smooth, 50, 2).map((v, i) => (raw[i] == null ? null : v));
  const oscFilled = osc.map((v) => v ?? 50);
  const signal = ema(oscFilled, Math.max(2, Math.floor(smooth))).map((v, i) =>
    osc[i] == null ? null : v
  );
  const upperEx = osc.map((v) => (v == null ? null : 80));
  const lowerEx = osc.map((v) => (v == null ? null : 20));
  const mid = osc.map((v) => (v == null ? null : 50));
  return { osc, signal, upperEx, lowerEx, mid };
}

/** Voltix-like adaptive ATR/vol bands around JMA. */
export function voltixBands(
  candles: Candle[],
  length = 20,
  mult = 1.8,
  phase = 50
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  upper2: (number | null)[];
  lower2: (number | null)[];
} {
  const closes = candles.map((c) => c.close);
  const mid = jma(closes, length, phase, 2);
  const a = atr(candles, length);
  const vol = jurikVolty(closes, length);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const upper2: (number | null)[] = [];
  const lower2: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (mid[i] == null || a[i] == null) {
      upper.push(null);
      lower.push(null);
      upper2.push(null);
      lower2.push(null);
      continue;
    }
    const scale = 0.75 + (vol[i] ?? 0.5);
    const w = mult * (a[i] as number) * scale;
    upper.push((mid[i] as number) + w);
    lower.push((mid[i] as number) - w);
    upper2.push((mid[i] as number) + w * 1.6);
    lower2.push((mid[i] as number) - w * 1.6);
  }
  return { mid, upper, lower, upper2, lower2 };
}

/** Flow Trend: DI/ADX blend + JMA slope + volume confirm. */
export function flowTrend(
  candles: Candle[],
  len = 14
): {
  flow: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
} {
  const dmi = adx(candles, len);
  const closes = candles.map((c) => c.close);
  const jm = jma(closes, len, 50, 2);
  const slope: (number | null)[] = jm.map((v, i) => {
    if (v == null || i < 1 || jm[i - 1] == null) return null;
    return (v - (jm[i - 1] as number)) / (Math.abs(jm[i - 1] as number) || 1);
  });
  const vols = candles.map((c) => c.volume);
  const volMa = sma(vols, len);
  const flow = closes.map((_, i) => {
    if (dmi.adx[i] == null || dmi.plusDI[i] == null || dmi.minusDI[i] == null || slope[i] == null)
      return null;
    const di = (dmi.plusDI[i] as number) - (dmi.minusDI[i] as number);
    const volBoost =
      volMa[i] != null && (volMa[i] as number) > 0
        ? Math.min(1.5, vols[i] / (volMa[i] as number))
        : 1;
    return di * 0.5 + (slope[i] as number) * 1000 * 0.3 + ((dmi.adx[i] as number) - 20) * 0.2 * volBoost;
  });
  const filled = flow.map((v) => v ?? 0);
  const signal = ema(filled, Math.max(3, Math.floor(len / 2))).map((v, i) =>
    flow[i] == null ? null : v
  );
  const hist = flow.map((v, i) =>
    v != null && signal[i] != null ? v - (signal[i] as number) : null
  );
  return { flow, signal, hist };
}

/** Money flow composite: CMF + MFI normalized. */
export function moneyFlowComposite(
  candles: Candle[],
  len = 14
): {
  flow: (number | null)[];
  mfiLine: (number | null)[];
  cmfLine: (number | null)[];
  signal: (number | null)[];
} {
  const mf = mfi(candles, len);
  const c = cmf(candles, len);
  const flow = candles.map((_, i) => {
    if (mf[i] == null || c[i] == null) return null;
    // CMF [-1,1] → [0,100], blend with MFI
    const cmf100 = ((c[i] as number) + 1) * 50;
    return 0.55 * (mf[i] as number) + 0.45 * cmf100;
  });
  const filled = flow.map((v) => v ?? 50);
  const signal = ema(filled, 5).map((v, i) => (flow[i] == null ? null : v));
  return { flow, mfiLine: mf, cmfLine: c, signal };
}

/** Channel detection highlight: Donchian + regression mid. */
export function channelDetect(
  candles: Candle[],
  len = 20
): {
  upper: (number | null)[];
  lower: (number | null)[];
  mid: (number | null)[];
  reg: (number | null)[];
  width: (number | null)[];
} {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const mid: (number | null)[] = [];
  const closes = candles.map((c) => c.close);
  const reg = linreg(closes, len);
  const width: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < len - 1) {
      upper.push(null);
      lower.push(null);
      mid.push(null);
      width.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - len + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    upper.push(hi);
    lower.push(lo);
    mid.push((hi + lo) / 2);
    width.push(hi === 0 ? null : ((hi - lo) / hi) * 100);
  }
  return { upper, lower, mid, reg, width };
}

/** High volume points at swings. */
export function highVolumePoints(
  candles: Candle[],
  volMult = 2,
  swing = 2
): {
  bullVol: (number | null)[];
  bearVol: (number | null)[];
  volMa: (number | null)[];
} {
  const n = candles.length;
  const vols = candles.map((c) => c.volume);
  const volMa = sma(vols, 20);
  const bullVol: (number | null)[] = new Array(n).fill(null);
  const bearVol: (number | null)[] = new Array(n).fill(null);
  for (let i = swing; i < n - swing; i++) {
    if (volMa[i] == null || (volMa[i] as number) === 0) continue;
    if (vols[i] < volMult * (volMa[i] as number)) continue;
    if (swingLow(candles, i, swing, swing) || candles[i].close > candles[i].open) {
      if (swingLow(candles, i, swing, swing) || vols[i] > volMult * (volMa[i] as number)) {
        if (candles[i].close >= candles[i].open || swingLow(candles, i, swing, swing)) {
          bullVol[i] = candles[i].low;
        }
      }
    }
    if (swingHigh(candles, i, swing, swing) || candles[i].close < candles[i].open) {
      if (swingHigh(candles, i, swing, swing)) {
        bearVol[i] = candles[i].high;
      }
    }
  }
  return { bullVol, bearVol, volMa };
}
