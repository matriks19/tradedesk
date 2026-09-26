/**
 * PPO-DSI-Z (CipherDecoded, Pine v6) — TradeDesk port.
 *
 *   ppo      = slowEma != 0 ? (ema(close,fast) − ema(close,slow)) / slowEma · 100 : 0
 *              (ta.ema SMA tohumlu; ısınmada slowEma = na → `na != 0` yanlış → 0)
 *   up_move  = change(high) > 0 ? change(high) : 0          (ilk mum: na > 0 yanlış → 0)
 *   dn_move  = change(low)  < 0 ? |change(low)| : 0
 *   up/dn    = son dsi_length değerin toplamı (for döngüsü; geçmiş yoksa na → dsi 0)
 *   dsi      = (up+dn) != 0 ? (up−dn)/(up+dn)·100 : 0
 *   combined = (ppo+dsi)/2; signal = sma(combined, smooth); hist = combined − signal
 *   z(s,l)   = stdev != 0 ? (s − sma(s,l)) / stdev(s,l) : 0 (ta.stdev = popülasyon, Pine
 *              referans uygulaması: 1e-10 sıfır toleransı; penceresinde na varsa na → 0)
 *   median   = ta.percentile_nearest_rank(close, zlen, 50); median_std = stdev(median, zlen)
 *   upper/lower = median ± median_std
 *   state    = var; z > thLong ve !(z < thShort) → 1, z < thShort → −1, aksi halde korunur
 *
 * Sinyaller (ta.crossover/crossunder, her iki mum da ısınmış olmalı):
 *   Z ±eşik kesişimleri, combined_z × signal_z, hist_z işaret değişimi, close × alt/üst bant,
 *   Kırılıma yakın (sıkışma): width = (upper − lower)/median;
 *     sıkışma[i] = width[i] ≤ min(width, squeezeLen)[i] · (1 + sqTol/100)
 *     sinyal = sıkışmaya giriş mumu (sıkışma[i] ve !sıkışma[i−1]).
 */
import type { Candle } from "@/lib/types";
import { ppoDsiZFetchLimit, ppoDsiZMinBars } from "./ppoDsiZLimits";

export { ppoDsiZFetchLimit, ppoDsiZMinBars };

export interface PpoDsiZOpts {
  fast?: number;
  slow?: number;
  dsiLen?: number;
  smooth?: number;
  thLong?: number;
  thShort?: number;
  zlen?: number;
  squeezeLen?: number;
  sqTol?: number;
}

export const PPO_DSI_Z_DEFAULTS = {
  fast: 12,
  slow: 26,
  dsiLen: 13,
  smooth: 9,
  thLong: 0.8,
  thShort: -0.8,
  zlen: 50,
  squeezeLen: 50,
  sqTol: 5,
};

export type PpoDsiZCond =
  | "pdz_long_up" | "pdz_short_up" | "pdz_long_dn" | "pdz_short_dn"
  | "pdz_sig_up" | "pdz_sig_dn" | "pdz_hist_pos" | "pdz_hist_neg"
  | "pdz_squeeze" | "pdz_lo_up" | "pdz_lo_dn" | "pdz_hi_up" | "pdz_hi_dn";
export const ALL_PPO_DSI_Z_CONDS: PpoDsiZCond[] = [
  "pdz_long_up", "pdz_short_up", "pdz_long_dn", "pdz_short_dn",
  "pdz_sig_up", "pdz_sig_dn", "pdz_hist_pos", "pdz_hist_neg",
  "pdz_squeeze", "pdz_lo_up", "pdz_lo_dn", "pdz_hi_up", "pdz_hi_dn",
];
export const DEFAULT_PPO_DSI_Z_CONDS: PpoDsiZCond[] = ["pdz_long_up", "pdz_short_up", "pdz_sig_up", "pdz_lo_up"];
export const PPO_DSI_Z_BEAR_CONDS = new Set<PpoDsiZCond>(["pdz_long_dn", "pdz_short_dn", "pdz_sig_dn", "pdz_hist_neg", "pdz_lo_dn", "pdz_hi_dn"]);
export const PPO_DSI_Z_NEUTRAL_CONDS = new Set<PpoDsiZCond>(["pdz_squeeze"]);
export const PPO_DSI_Z_COND_LABEL: Record<PpoDsiZCond, string> = {
  pdz_long_up: "Z +0.8↑",
  pdz_short_up: "Z −0.8↑",
  pdz_long_dn: "Z +0.8↓",
  pdz_short_dn: "Z −0.8↓",
  pdz_sig_up: "Sinyal↑",
  pdz_sig_dn: "Sinyal↓",
  pdz_hist_pos: "Hist +",
  pdz_hist_neg: "Hist −",
  pdz_squeeze: "Kırılıma yakın",
  pdz_lo_up: "Alt band↑",
  pdz_lo_dn: "Alt band↓",
  pdz_hi_up: "Üst band↑",
  pdz_hi_dn: "Üst band↓",
};
export const PPO_DSI_Z_MIN_BARS = ppoDsiZMinBars();
export const PPO_DSI_Z_FETCH_LIMIT = ppoDsiZFetchLimit();

export interface PpoDsiZResult {
  ppo: number[];
  dsi: number[];
  combined: number[];
  signal: (number | null)[];
  hist: (number | null)[];
  combinedZ: number[];
  signalZ: number[];
  histZ: number[];
  median: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  width: (number | null)[];
  squeeze: boolean[];
  state: number[];
  /** First bar where each z series is defined (not warm-up 0) */
  validFrom: { combinedZ: number; signalZ: number; band: number; squeeze: number };
  sig: Record<PpoDsiZCond, boolean[]>;
}

export function resolvePpoDsiZOpts(opts: PpoDsiZOpts = {}): Required<PpoDsiZOpts> {
  const o = { ...PPO_DSI_Z_DEFAULTS };
  for (const [k, v] of Object.entries(opts)) {
    if (v !== undefined && v !== null && Number.isFinite(Number(v))) (o as Record<string, number>)[k] = Number(v);
  }
  return {
    fast: Math.max(1, Math.floor(o.fast)),
    slow: Math.max(1, Math.floor(o.slow)),
    dsiLen: Math.max(1, Math.floor(o.dsiLen)),
    smooth: Math.max(1, Math.floor(o.smooth)),
    thLong: o.thLong,
    thShort: o.thShort,
    zlen: Math.max(2, Math.floor(o.zlen)),
    squeezeLen: Math.max(1, Math.floor(o.squeezeLen)),
    sqTol: Math.max(0, o.sqTol),
  };
}

/** Pine ta.ema (SMA seed); na → null. */
function pineEma(src: number[], len: number): (number | null)[] {
  const n = src.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const a = 2 / (len + 1);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += src[i]!;
    if (i >= len) sum -= src[i - len]!;
    if (i < len - 1) continue;
    prev = prev == null ? sum / len : a * src[i]! + (1 - a) * prev;
    out[i] = prev;
  }
  return out;
}

/** Pine ta.sma with na propagation (any na in window → na). */
function pineSma(src: (number | null)[], len: number): (number | null)[] {
  const n = src.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = len - 1; i < n; i++) {
    let s = 0;
    let ok = true;
    for (let j = i - len + 1; j <= i; j++) {
      const v = src[j];
      if (v == null) { ok = false; break; }
      s += v;
    }
    if (ok) out[i] = s / len;
  }
  return out;
}

/** Pine reference ta.stdev (population, 1e-10 zero tolerance on deviations). */
function pineStdev(src: (number | null)[], len: number): (number | null)[] {
  const avg = pineSma(src, len);
  const n = src.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = len - 1; i < n; i++) {
    const a = avg[i];
    if (a == null) continue;
    let ss = 0;
    for (let j = i - len + 1; j <= i; j++) {
      let d = (src[j] as number) - a;
      if (Math.abs(d) <= 1e-10) d = 0;
      ss += d * d;
    }
    out[i] = Math.sqrt(ss / len);
  }
  return out;
}

function zscore(src: (number | null)[], len: number): number[] {
  const m = pineSma(src, len);
  const sd = pineStdev(src, len);
  return src.map((v, i) => {
    const s = sd[i];
    // `stdev != 0` is false when stdev is na → 0
    return s != null && s !== 0 && v != null && m[i] != null ? (v - (m[i] as number)) / s : 0;
  });
}

/** Pine ta.percentile_nearest_rank */
function percentileNearestRank(src: number[], len: number, pct: number): (number | null)[] {
  const n = src.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const rank = Math.max(1, Math.ceil((Math.max(0, Math.min(100, pct)) / 100) * len));
  for (let i = len - 1; i < n; i++) {
    const w = src.slice(i - len + 1, i + 1).sort((a, b) => a - b);
    out[i] = w[Math.min(len, rank) - 1]!;
  }
  return out;
}

export function computePpoDsiZ(candles: Candle[], opts: PpoDsiZOpts = {}): PpoDsiZResult {
  const o = resolvePpoDsiZOpts(opts);
  const n = candles.length;
  const C = candles.map((c) => c.close);
  const H = candles.map((c) => c.high);
  const L = candles.map((c) => c.low);

  const ef = pineEma(C, o.fast);
  const es = pineEma(C, o.slow);
  const ppo = C.map((_, i) => {
    const s = es[i];
    return s != null && s !== 0 && ef[i] != null ? (((ef[i] as number) - s) / s) * 100 : 0;
  });
  const up: number[] = new Array(n).fill(0);
  const dn: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const ch = H[i]! - H[i - 1]!;
    const cl = L[i]! - L[i - 1]!;
    up[i] = ch > 0 ? ch : 0;
    dn[i] = cl < 0 ? Math.abs(cl) : 0;
  }
  const dsi: number[] = new Array(n).fill(0);
  for (let i = o.dsiLen - 1; i < n; i++) {
    let u = 0, d = 0;
    for (let k = 0; k < o.dsiLen; k++) { u += up[i - k]!; d += dn[i - k]!; }
    dsi[i] = u + d !== 0 ? ((u - d) / (u + d)) * 100 : 0;
  }
  const combined = ppo.map((p, i) => (p + dsi[i]!) / 2);
  const signal = pineSma(combined, o.smooth);
  const hist = combined.map((c, i) => (signal[i] == null ? null : c - (signal[i] as number)));
  const combinedZ = zscore(combined, o.zlen);
  const signalZ = zscore(signal, o.zlen);
  const histZ = zscore(hist, o.zlen);
  const median = percentileNearestRank(C, o.zlen, 50);
  const mstd = pineStdev(median, o.zlen);
  const upper = median.map((m, i) => (m == null || mstd[i] == null ? null : m + (mstd[i] as number)));
  const lower = median.map((m, i) => (m == null || mstd[i] == null ? null : m - (mstd[i] as number)));
  const width = median.map((m, i) => (m == null || m === 0 || upper[i] == null ? null : ((upper[i] as number) - (lower[i] as number)) / m));

  const vz = o.zlen - 1;
  const vs = o.smooth - 1 + o.zlen - 1;
  const vb = 2 * o.zlen - 2;
  const vq = vb + o.squeezeLen - 1;
  const squeeze: boolean[] = new Array(n).fill(false);
  for (let i = vq; i < n; i++) {
    let mn = Infinity;
    for (let j = i - o.squeezeLen + 1; j <= i; j++) mn = Math.min(mn, width[j] as number);
    squeeze[i] = (width[i] as number) <= mn * (1 + o.sqTol / 100);
  }

  const state: number[] = new Array(n).fill(0);
  let st = 0;
  for (let i = 0; i < n; i++) {
    const z = combinedZ[i]!;
    if (z > o.thLong && !(z < o.thShort)) st = 1;
    else if (z < o.thShort) st = -1;
    state[i] = st;
  }

  const sig = Object.fromEntries(ALL_PPO_DSI_Z_CONDS.map((c) => [c, new Array<boolean>(n).fill(false)])) as Record<PpoDsiZCond, boolean[]>;
  const xUp = (a0: number, a1: number, b0: number, b1: number) => a1 > b1 && a0 <= b0;
  const xDn = (a0: number, a1: number, b0: number, b1: number) => a1 < b1 && a0 >= b0;
  for (let i = 1; i < n; i++) {
    if (i - 1 >= vz) {
      const z0 = combinedZ[i - 1]!, z1 = combinedZ[i]!;
      sig.pdz_long_up[i] = xUp(z0, z1, o.thLong, o.thLong);
      sig.pdz_long_dn[i] = xDn(z0, z1, o.thLong, o.thLong);
      sig.pdz_short_up[i] = xUp(z0, z1, o.thShort, o.thShort);
      sig.pdz_short_dn[i] = xDn(z0, z1, o.thShort, o.thShort);
    }
    if (i - 1 >= vs) {
      const z0 = combinedZ[i - 1]!, z1 = combinedZ[i]!, s0 = signalZ[i - 1]!, s1 = signalZ[i]!;
      sig.pdz_sig_up[i] = xUp(z0, z1, s0, s1);
      sig.pdz_sig_dn[i] = xDn(z0, z1, s0, s1);
      const h0 = histZ[i - 1]!, h1 = histZ[i]!;
      sig.pdz_hist_pos[i] = h1 > 0 && h0 <= 0;
      sig.pdz_hist_neg[i] = h1 < 0 && h0 >= 0;
    }
    if (i - 1 >= vb) {
      const c0 = C[i - 1]!, c1 = C[i]!;
      const l0 = lower[i - 1] as number, l1 = lower[i] as number, u0 = upper[i - 1] as number, u1 = upper[i] as number;
      sig.pdz_lo_up[i] = xUp(c0, c1, l0, l1);
      sig.pdz_lo_dn[i] = xDn(c0, c1, l0, l1);
      sig.pdz_hi_up[i] = xUp(c0, c1, u0, u1);
      sig.pdz_hi_dn[i] = xDn(c0, c1, u0, u1);
    }
    if (i - 1 >= vq) sig.pdz_squeeze[i] = squeeze[i]! && !squeeze[i - 1]!;
  }

  return {
    ppo, dsi, combined, signal, hist, combinedZ, signalZ, histZ, median, upper, lower, width, squeeze, state,
    validFrom: { combinedZ: vz, signalZ: vs, band: vb, squeeze: vq },
    sig,
  };
}

export type PpoDsiZHit = { cond: PpoDsiZCond; barsAgo: number; note: string };

/** Son `maxBarsAgo` mum içindeki en yeni sinyal (koşul başına bir). */
export function ppoDsiZScan(candles: Candle[], conds: PpoDsiZCond[], maxBarsAgo: number, opts: PpoDsiZOpts = {}): PpoDsiZHit[] {
  const o = resolvePpoDsiZOpts(opts);
  if (!conds.length || candles.length < ppoDsiZMinBars(o.slow, o.zlen, o.smooth)) return [];
  const r = computePpoDsiZ(candles, o);
  const last = candles.length - 1;
  const out: PpoDsiZHit[] = [];
  for (const cond of conds) {
    const arr = r.sig[cond];
    if (!arr) continue;
    for (let ago = 0; ago <= maxBarsAgo; ago++) {
      const i = last - ago;
      if (i < 0) break;
      if (!arr[i]) continue;
      const bit = cond === "pdz_squeeze"
        ? ` genişlik ${(((r.width[i] as number) || 0) * 100).toFixed(2)}%`
        : ` z ${r.combinedZ[i]!.toFixed(2)}`;
      out.push({ cond, barsAgo: ago, note: `PPO-DSI-Z ${PPO_DSI_Z_COND_LABEL[cond]}${bit} (−${ago})` });
      break;
    }
  }
  return out;
}
