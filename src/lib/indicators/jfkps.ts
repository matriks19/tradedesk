/**
 * T31 · JFKPS — Jurik-Filtered Kase Permission Stochastic [Loxx] (sadık port; QUANTEX T31 ile aynı matematik).
 * lookBack = pstLength·pstX; TripleDF/TripleDS [pstX] geri başvurulu rekurans (nz=0); sma(3); Loxx jurik_filt
 * (uyarlamalı JMA, loxxjuriktools/1 bilinen açık kaynak dökümü). Yalnız kapanmış mum.
 */
import type { Candle } from "@/lib/types";
import { lastClosedIndex } from "./eliziLdr4";

export type JfkpsParams = { len?: number; x?: number; sm?: number; jl?: number; phase?: number };
export const JFKPS_DEFAULTS = { len: 9, x: 5, sm: 3, jl: 10, phase: 0 };
export type JfkpsCond = "jf_long" | "jf_short" | "jf_green" | "jf_red";
export const ALL_JFKPS_CONDS: JfkpsCond[] = ["jf_long", "jf_short", "jf_green", "jf_red"];
export const DEFAULT_JFKPS_CONDS: JfkpsCond[] = ["jf_long", "jf_short"];
export const JFKPS_BEAR_CONDS = new Set<JfkpsCond>(["jf_short", "jf_red"]);
export const JFKPS_COND_LABEL: Record<JfkpsCond, string> = { jf_long: "L Long", jf_short: "S Short", jf_green: "Trend Yeşil", jf_red: "Trend Kırmızı" };

function opts(p?: JfkpsParams | null) {
  const g = (v: unknown, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  const ph = Number(p?.phase);
  return { len: g(p?.len, 9), x: g(p?.x, 5), sm: g(p?.sm, 3), jl: g(p?.jl, 10), ph: Math.max(-100, Math.min(100, Number.isFinite(ph) ? ph : 0)) };
}
export function jfkpsMinBars(p?: JfkpsParams | null): number {
  const o = opts(p);
  return o.len * o.x + 10 * o.x + 3 * o.jl + 4;
}
/** Loxx jurik_filt (uyarlamalı). */
export function loxxJurik(src: number[], len: number, phase: number): number[] {
  const n = src.length, out = new Array<number>(n).fill(NaN);
  let f = -1;
  for (let i = 0; i < n; i++) if (Number.isFinite(src[i]!)) { f = i; break; }
  if (f < 0) return out;
  const len1 = Math.max(Math.log(Math.sqrt(0.5 * (len - 1))) / Math.log(2) + 2, 0), len2 = Math.sqrt(0.5 * (len - 1)) * len1;
  const pow1 = Math.max(len1 - 2, 0.5), beta = (0.45 * (len - 1)) / (0.45 * (len - 1) + 2);
  const div = 1 / (10 + (10 * Math.min(Math.max(len - 10, 0), 100)) / 100);
  const PR = phase < -100 ? 0.5 : phase > 100 ? 2.5 : 1.5 + phase * 0.01, bet = len2 / (len2 + 1), avL = 2 / (Math.max(4 * len, 30) + 1);
  let bsmax = src[f]!, bsmin = src[f]!, vsum = 0, avolty = 0, ma1 = 0, det0 = 0, e2 = 0, jrk = src[f]!;
  const vh: number[] = [];
  for (let i = f; i < n; i++) {
    const x = src[i]!, c = i - f;
    if (!Number.isFinite(x)) { out[i] = jrk; continue; }
    const del1 = c ? x - bsmax : 0, del2 = c ? x - bsmin : 0, volty = Math.max(Math.abs(del1), Math.abs(del2));
    vh.push(volty);
    if (c) { vsum = vsum + div * (volty - (c >= 10 ? vh[c - 10]! : 0)); avolty = avolty + avL * (vsum - avolty); }
    const dV = avolty > 0 ? volty / avolty : 0, dVolty = Math.max(1, Math.min(Math.pow(len1, 1 / pow1), dV));
    const pow2 = Math.pow(dVolty, pow1), Kv = Math.pow(bet, Math.sqrt(pow2));
    bsmax = del1 > 0 ? x : x - Kv * del1;
    bsmin = del2 < 0 ? x : x - Kv * del2;
    const alpha = Math.pow(beta, pow2);
    if (c) { ma1 = (1 - alpha) * x + alpha * ma1; det0 = (x - ma1) * (1 - beta) + beta * det0; }
    const ma2 = ma1 + PR * det0;
    if (c >= len) { e2 = (ma2 - jrk) * Math.pow(1 - alpha, 2) + alpha * alpha * e2; jrk = e2 + jrk; } else { e2 = 0; jrk = x; }
    out[i] = jrk;
  }
  return out;
}
export type JfkpsResult = { n: number; need: number; pss: number[]; pst: number[]; trend: number[]; ev: { long: boolean[]; short: boolean[] } };
export function computeJfkps(candles: Candle[], p?: JfkpsParams | null): JfkpsResult {
  const o = opts(p), n = candles.length, lb = o.len * o.x, al = 2 / (1 + o.sm);
  const DF = new Array<number>(n), DS = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let mn = NaN, mx = NaN;
    if (i >= lb - 1) { mn = Infinity; mx = -Infinity; for (let j = i - lb + 1; j <= i; j++) { mn = Math.min(mn, candles[j]!.low); mx = Math.max(mx, candles[j]!.high); } }
    const fmax = mx - mn, K = fmax > 0 ? (100 * (candles[i]!.close - mn)) / fmax : 0;
    const pf = i - o.x >= 0 ? DF[i - o.x]! : 0, ps = i - o.x >= 0 ? DS[i - o.x]! : 0;
    DF[i] = pf + al * (K - pf);
    DS[i] = (ps * 2 + DF[i]!) / 3;
  }
  const sma3 = (a: number[]) => a.map((_, q) => (q >= 2 ? (a[q]! + a[q - 1]! + a[q - 2]!) / 3 : NaN));
  const pss = loxxJurik(sma3(DS), o.jl, o.ph), pst = loxxJurik(sma3(DF), o.jl, o.ph);
  const need = lb + 10 * o.x + 3 * o.jl + 3, trend: number[] = [], ev = { long: [] as boolean[], short: [] as boolean[] };
  for (let i = 0; i < n; i++) {
    let t = i ? trend[i - 1]! : 0;
    if (pst[i]! > pss[i]!) t = 1;
    if (pst[i]! < pss[i]!) t = -1;
    trend[i] = t;
    const ok = i >= need && i > 0 && Number.isFinite(pst[i - 1]!) && Number.isFinite(pss[i - 1]!);
    ev.long[i] = ok && pst[i]! > pss[i]! && pst[i - 1]! <= pss[i - 1]!;
    ev.short[i] = ok && pst[i]! < pss[i]! && pst[i - 1]! >= pss[i - 1]!;
  }
  return { n, need, pss, pst, trend, ev };
}
export type JfkpsHit = { cond: JfkpsCond; barsAgo: number; note: string };
export function jfkpsScan(candles: Candle[], conds: JfkpsCond[], maxBarsAgo: number, p?: JfkpsParams | null, o: { nowMs?: number } = {}): JfkpsHit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, o.nowMs), closed = candles.slice(0, lc + 1), R = computeJfkps(closed, p);
  if (closed.length <= R.need) return [];
  const last = candles.length - 1, out: JfkpsHit[] = [], f = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  for (const cond of conds) {
    if (cond === "jf_green" || cond === "jf_red") {
      if (R.trend[lc] === (cond === "jf_green" ? 1 : -1) && last - lc <= maxBarsAgo)
        out.push({ cond, barsAgo: last - lc, note: `JFKPS ${JFKPS_COND_LABEL[cond]} (pst ${f(R.pst[lc]!)} / pss ${f(R.pss[lc]!)})` });
      continue;
    }
    const ev = cond === "jf_long" ? R.ev.long : R.ev.short;
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) {
      if (!ev[i]) continue;
      out.push({ cond, barsAgo: last - i, note: `JFKPS ${JFKPS_COND_LABEL[cond]} · pst ${f(R.pst[i]!)} / pss ${f(R.pss[i]!)} (−${last - i})` });
      break;
    }
  }
  return out;
}
