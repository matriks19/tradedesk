/**
 * T32 · MDO — Multi-Dimension Oscillator [JMA] (kullanıcının Pine v6 göstergesi; QUANTEX T32 ile aynı matematik).
 * İvme = power_norm (−100..100), Volatilite = vol_rank (percentrank 0..100). Kesişimler ham değerlerle. Yalnız kapanmış mum.
 */
import type { Candle } from "@/lib/types";
import { lastClosedIndex } from "./eliziLdr4";

export type MdoParams = { len?: number; mom?: number; bb?: number; mult?: number; st?: number; x?: number; jl?: number; phase?: number; power?: number };
export const MDO_DEFAULTS = { len: 100, mom: 70, bb: 100, mult: 1, st: 27, x: 15, jl: 9, phase: 0, power: 2 };
export type MdoCond = "mdo_up" | "mdo_dn" | "mdo_jl" | "mdo_js";
export const ALL_MDO_CONDS: MdoCond[] = ["mdo_up", "mdo_dn", "mdo_jl", "mdo_js"];
export const DEFAULT_MDO_CONDS: MdoCond[] = ["mdo_up", "mdo_dn"];
export const MDO_BEAR_CONDS = new Set<MdoCond>(["mdo_dn", "mdo_js"]);
export const MDO_COND_LABEL: Record<MdoCond, string> = { mdo_up: "İvme↑Volatilite", mdo_dn: "Volatilite↑İvme", mdo_jl: "Jurik Al", mdo_js: "Jurik Sat" };

function opts(p?: MdoParams | null) {
  const g = (v: unknown, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : d; };
  const f = (v: unknown, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  const ph = Number(p?.phase);
  return { len: g(p?.len, 100), mom: g(p?.mom, 70), bb: Math.max(2, g(p?.bb, 100)), mult: f(p?.mult, 1), st: g(p?.st, 27), x: g(p?.x, 15), jl: g(p?.jl, 9),
    ph: Math.max(-100, Math.min(100, Number.isFinite(ph) ? ph : 0)), pw: f(p?.power, 2) };
}
export function mdoMinBars(p?: MdoParams | null): number {
  const o = opts(p);
  return Math.max(o.bb - 1 + o.len, 2 * o.mom + o.len, o.st * o.x + 3 * o.jl) + 2;
}
function jma(x: number[], len: number, phase: number, power: number): number[] {
  const n = x.length, o = new Array<number>(n).fill(NaN), PR = phase < -100 ? 0.5 : phase > 100 ? 2.5 : phase / 100 + 1.5;
  const beta = (0.45 * (len - 1)) / (0.45 * (len - 1) + 2), al = Math.pow(beta, power);
  let e0 = 0, e1 = 0, e2 = 0, j = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i]!; if (!Number.isFinite(v)) continue;
    e0 = (1 - al) * v + al * e0; e1 = (v - e0) * (1 - beta) + beta * e1; e2 = (e0 + PR * e1 - j) * Math.pow(1 - al, 2) + al * al * e2; j = e2 + j; o[i] = j;
  }
  return o;
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
export function computeMdo(candles: Candle[], p?: MdoParams | null) {
  const o = opts(p), c = candles.map((k) => k.close), n = c.length;
  const nan = () => new Array<number>(n).fill(NaN);
  const mom = nan(), bbw = nan(), vr = nan(), vxm = nan(), pn = nan(), k2 = new Array<number>(n);
  for (let i = o.mom; i < n; i++) mom[i] = ((c[i]! - c[i - o.mom]!) / c[i - o.mom]!) * 100;
  for (let i = o.bb - 1; i < n; i++) {
    let s = 0, q = 0; for (let j = i - o.bb + 1; j <= i; j++) s += c[j]!;
    const m = s / o.bb; for (let j = i - o.bb + 1; j <= i; j++) q += (c[j]! - m) ** 2;
    const dv = o.mult * Math.sqrt(q / o.bb); bbw[i] = m !== 0 ? ((2 * dv) / m) * 100 : 0;
  }
  for (let i = o.len; i < n; i++) {
    if (!Number.isFinite(bbw[i - o.len]!)) continue;
    let cnt = 0; for (let j = i - o.len; j < i; j++) if (bbw[j]! <= bbw[i]!) cnt++;
    vr[i] = (100 * cnt) / o.len;
  }
  for (let i = 0; i < n; i++) if (Number.isFinite(mom[i]!) && Number.isFinite(bbw[i]!)) vxm[i] = mom[i]! * bbw[i]!;
  const pw = ema(vxm, o.mom);
  for (let i = o.len - 1; i < n; i++) {
    let pk = -Infinity, bad = false;
    for (let j = i - o.len + 1; j <= i; j++) { if (!Number.isFinite(pw[j]!)) { bad = true; break; } pk = Math.max(pk, Math.abs(pw[j]!)); }
    if (!bad) pn[i] = pk > 0 ? (100 * pw[i]!) / pk : 0;
  }
  const lb = o.st * o.x;
  for (let i = 0; i < n; i++) {
    if (i < lb - 1) { k2[i] = 50; continue; }
    let lo = Infinity, hi = -Infinity; for (let j = i - lb + 1; j <= i; j++) { lo = Math.min(lo, c[j]!); hi = Math.max(hi, c[j]!); }
    k2[i] = hi > lo ? (100 * (c[i]! - lo)) / (hi - lo) : 50;
  }
  const tr = jma(k2, o.jl, o.ph, o.pw), sg = jma(tr, o.jl, o.ph, o.pw);
  const trn = tr.map((v) => (v - 50) * 2), sgn = sg.map((v) => (v - 50) * 2);
  const need = Math.max(o.bb - 1 + o.len, 2 * o.mom + o.len) + 1, needJ = lb + 3 * o.jl;
  const ev = { mdo_up: [] as boolean[], mdo_dn: [] as boolean[], mdo_jl: [] as boolean[], mdo_js: [] as boolean[] };
  for (let i = 0; i < n; i++) {
    const ok = i >= need && i > 0 && [pn[i], vr[i], pn[i - 1], vr[i - 1]].every((v) => Number.isFinite(v!));
    ev.mdo_up[i] = ok && pn[i]! > vr[i]! && pn[i - 1]! <= vr[i - 1]!;
    ev.mdo_dn[i] = ok && vr[i]! > pn[i]! && vr[i - 1]! <= pn[i - 1]!;
    const okJ = i >= needJ && i > 0;
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
