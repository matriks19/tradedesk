/**
 * T32 · MDO — Multi-Dimension Oscillator [T3-JMA-Jurik] (kullanıcının Pine v6 göstergesi; QUANTEX T32 ile aynı matematik).
 * İvme = normalize(power, 2·mom), Volatilite = normalize(bb_width, 2·bb), ikisi 0..100 min-max. Yalnız kapanmış mum.
 */
import type { Candle } from "@/lib/types";
import { lastClosedIndex } from "./eliziLdr4";

export type MdoParams = { len?: number; mom?: number; bb?: number; mult?: number; st?: number; x?: number; jl?: number; phase?: number };
export const MDO_DEFAULTS = { len: 100, mom: 70, bb: 100, mult: 1, st: 27, x: 15, jl: 9, phase: 0 };
export type MdoCond = "mdo_up" | "mdo_dn" | "mdo_jl" | "mdo_js";
export const ALL_MDO_CONDS: MdoCond[] = ["mdo_up", "mdo_dn", "mdo_jl", "mdo_js"];
export const DEFAULT_MDO_CONDS: MdoCond[] = ["mdo_up", "mdo_dn"];
export const MDO_BEAR_CONDS = new Set<MdoCond>(["mdo_dn", "mdo_js"]);
export const MDO_COND_LABEL: Record<MdoCond, string> = { mdo_up: "İvme↑Volatilite", mdo_dn: "Volatilite↑İvme", mdo_jl: "Jurik Al", mdo_js: "Jurik Sat" };

function opts(p?: MdoParams | null) {
  const g = (v: unknown, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  const f = (v: unknown, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  return { len: g(p?.len, 100), mom: g(p?.mom, 70), bb: Math.max(2, g(p?.bb, 100)), mult: f(p?.mult, 1), st: g(p?.st, 27), x: g(p?.x, 15), jl: g(p?.jl, 9) };
}
export function mdoMinBars(p?: MdoParams | null): number {
  const o = opts(p);
  return Math.max(3 * o.bb - 1, Math.max(o.bb - 1, o.mom) + 3 * o.mom) + 3;
}
function ema(a: number[], len: number): number[] {
  const n = a.length, o = new Array<number>(n).fill(NaN), al = 2 / (len + 1);
  let s = 0, c = 0, p = NaN;
  for (let i = 0; i < n; i++) {
    const v = a[i]!;
    if (!Number.isFinite(v)) { if (Number.isFinite(p)) o[i] = p; continue; }
    if (!Number.isFinite(p)) { s += v; c++; if (c === len) { p = s / len; o[i] = p; } continue; }
    p = al * v + (1 - al) * p; o[i] = p;
  }
  return o;
}
/** Pine normalize(): min-max (lowest/highest, na atlanır); eşitse 50. */
function norm(a: number[], len: number): number[] {
  const n = a.length, o = new Array<number>(n).fill(NaN);
  for (let i = len - 1; i < n; i++) {
    if (!Number.isFinite(a[i]!)) continue;
    let mn = Infinity, mx = -Infinity;
    for (let j = i - len + 1; j <= i; j++) { const v = a[j]!; if (Number.isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
    o[i] = mx !== mn ? (100 * (a[i]! - mn)) / (mx - mn) : 50;
  }
  return o;
}
export function computeMdo(candles: Candle[], p?: MdoParams | null) {
  const o = opts(p), c = candles.map((k) => k.close), n = c.length;
  const nan = () => new Array<number>(n).fill(NaN);
  const mom = nan(), bw = nan(), vxm = nan(), DF = new Array<number>(n), DS = new Array<number>(n);
  for (let i = o.mom; i < n; i++) mom[i] = c[i]! - c[i - o.mom]!;
  for (let i = o.bb - 1; i < n; i++) {
    let s = 0, q = 0; for (let j = i - o.bb + 1; j <= i; j++) s += c[j]!;
    const m = s / o.bb; for (let j = i - o.bb + 1; j <= i; j++) q += (c[j]! - m) ** 2;
    bw[i] = 2 * o.mult * Math.sqrt(q / o.bb);
  }
  for (let i = 0; i < n; i++) if (Number.isFinite(mom[i]!) && Number.isFinite(bw[i]!)) vxm[i] = mom[i]! * bw[i]!;
  const pw = ema(vxm, o.mom), lb = o.st * o.x, al = 2 / (1 + o.jl);
  for (let i = 0; i < n; i++) {
    let kk = 0;
    if (i >= lb - 1) { let lo = Infinity, hi = -Infinity; for (let j = i - lb + 1; j <= i; j++) { lo = Math.min(lo, c[j]!); hi = Math.max(hi, c[j]!); } const fx = hi - lo; kk = fx > 0 ? (100 * (c[i]! - lo)) / fx : 0; }
    const pf = i - o.x >= 0 ? DF[i - o.x]! : 0, ps = i - o.x >= 0 ? DS[i - o.x]! : 0;
    DF[i] = pf + al * (kk - pf); DS[i] = (ps * 2 + DF[i]!) / 3;
  }
  const sma3 = (a: number[]) => { const r = nan(); for (let q = 2; q < n; q++) r[q] = (a[q]! + a[q - 1]! + a[q - 2]!) / 3; return r; };
  const L2 = 2 * o.mom, pn = norm(pw, L2), vr = norm(bw, 2 * o.bb), trn = norm(sma3(DF), L2), sgn = norm(sma3(DS), L2);
  const need = Math.max(3 * o.bb - 1, Math.max(o.bb - 1, o.mom) + 3 * o.mom) + 1, needJ = lb + 10 * o.x + L2;
  const ev = { mdo_up: [] as boolean[], mdo_dn: [] as boolean[], mdo_jl: [] as boolean[], mdo_js: [] as boolean[] };
  for (let i = 0; i < n; i++) {
    const ok = i >= need && i > 0 && [pn[i], vr[i], pn[i - 1], vr[i - 1]].every((v) => Number.isFinite(v!));
    ev.mdo_up[i] = ok && pn[i]! > vr[i]! && pn[i - 1]! <= vr[i - 1]!;
    ev.mdo_dn[i] = ok && vr[i]! > pn[i]! && vr[i - 1]! <= pn[i - 1]!;
    const okJ = i >= needJ && i > 0 && Number.isFinite(trn[i - 1]!) && Number.isFinite(sgn[i - 1]!);
    ev.mdo_jl[i] = okJ && trn[i]! > sgn[i]! && trn[i - 1]! <= sgn[i - 1]!;
    ev.mdo_js[i] = okJ && trn[i]! < sgn[i]! && trn[i - 1]! >= sgn[i - 1]!;
  }
  return { n, need, pn, vr, trn, sgn, ev };
}
export type MdoHit = { cond: MdoCond; barsAgo: number; note: string };
export function mdoScan(candles: Candle[], conds: MdoCond[], maxBarsAgo: number, p?: MdoParams | null, o: { nowMs?: number } = {}): MdoHit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, o.nowMs), closed = candles.slice(0, lc + 1), R = computeMdo(closed, p);
  if (closed.length <= R.need) return [];
  const last = candles.length - 1, out: MdoHit[] = [], f = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  for (const cond of conds) {
    const ev = R.ev[cond];
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) {
      if (!ev[i]) continue;
      out.push({ cond, barsAgo: last - i, note: `MDO ${MDO_COND_LABEL[cond]} · İvme ${f(R.pn[i]!)} / Volatilite ${f(R.vr[i]!)} (−${last - i})` });
      break;
    }
  }
  return out;
}
