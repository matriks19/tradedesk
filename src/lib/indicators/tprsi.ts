/**
 * T45 · TP RSI v2.3.2 (TrendlineProject) — sadık port: Laguerre RSI (γ 0.5), 3 EMA bulutu (21/48, 103/149, 206/499),
 * osilatör üstünde BB(50,2), sıkışma (BB genişliği persentil ≤10 / 100 mum), uyumsuzluk (pivot 5/5, ≤60 mum, normal+gizli),
 * re-entry AL/SAT motoru (puan 0-5, min 2, bekleme 5 mum, çıkış BB orta çizgi, stop 10 puan).
 * Yalnız kapanmış mum. Uyumsuzluk pivotu 5 mum sonra onaylanır (olay onay mumunda — repaint yok).
 * Kombin: TPRSI AL + JFKPS AL (Kase pst×pss, Vortex ADX > eşik ve +DI > −DI) son 3 mumda.
 */
import type { Candle } from "@/lib/types";
import { lastClosedIndex } from "./eliziLdr4";
import { computeJfkps } from "./jfkps";

export type TprsiParams = { gamma?: number; bb?: number; mult?: number; minScore?: number; cool?: number; divWin?: number; piv?: number; maxLb?: number; depthLen?: number; depthPct?: number; sqPct?: number; stop?: number;
  jfLen?: number; jfX?: number; jfSm?: number; jfJl?: number; jfPh?: number; adxLen?: number; adxThr?: number; adxSm?: number; comboWin?: number };
export const TPRSI_DEFAULTS: Required<TprsiParams> = { gamma: 0.5, bb: 50, mult: 2, minScore: 2, cool: 5, divWin: 10, piv: 5, maxLb: 60, depthLen: 5, depthPct: 10, sqPct: 10, stop: 10,
  jfLen: 27, jfX: 15, jfSm: 12, jfJl: 30, jfPh: 0, adxLen: 100, adxThr: 0.2, adxSm: 9, comboWin: 3 };
export type TprsiCond = "tp_al" | "tp_sat" | "tp_p3" | "tp_sq" | "tp_bdiv" | "tp_bdivh" | "tp_jf";
export const ALL_TPRSI_CONDS: TprsiCond[] = ["tp_al", "tp_sat", "tp_p3", "tp_sq", "tp_bdiv", "tp_bdivh", "tp_jf"];
export const DEFAULT_TPRSI_CONDS: TprsiCond[] = ["tp_al", "tp_sat", "tp_jf"];
export const TPRSI_BEAR_CONDS = new Set<TprsiCond>(["tp_sat"]);
export const TPRSI_COND_LABEL: Record<TprsiCond, string> = { tp_al: "TPRSI AL", tp_sat: "TPRSI SAT", tp_p3: "AL Puan≥3", tp_sq: "SQ çıkış ↑", tp_bdiv: "Boğa uyumsuzluk", tp_bdivh: "Gizli boğa uyumsuzluk", tp_jf: "TPRSI AL + JFKPS AL (3 mum)" };
export function tprsiOpts(p?: TprsiParams | null): Required<TprsiParams> { const o: any = { ...TPRSI_DEFAULTS }; for (const k in p ?? {}) { const v = +(p as any)[k]; if (Number.isFinite(v)) o[k] = v; } return o; }
export function tprsiMinBars(p?: TprsiParams | null): number { const o = tprsiOpts(p); return Math.max(520, o.jfLen * o.jfX + 10 * o.jfX + 3 * o.jfJl + 3); }

const ema = (a: number[], len: number) => { const n = a.length, o = new Array<number>(n).fill(NaN), al = 2 / (len + 1); let s = 0, c = 0, p = NaN;
  for (let i = 0; i < n; i++) { const v = a[i]!; if (!Number.isFinite(p)) { s += v; c++; if (c === len) { p = s / len; o[i] = p; } continue; } p = al * v + (1 - al) * p; o[i] = p; } return o; };
const smaSd = (a: number[], len: number) => { const n = a.length, m = new Array<number>(n).fill(NaN), sd = new Array<number>(n).fill(NaN); let s = 0, q = 0;
  for (let i = 0; i < n; i++) { s += a[i]!; q += a[i]! * a[i]!; if (i >= len) { s -= a[i - len]!; q -= a[i - len]! * a[i - len]!; } if (i >= len - 1) { const mu = s / len; m[i] = mu; sd[i] = Math.sqrt(Math.max(q / len - mu * mu, 0)); } } return [m, sd]; };
// Pine ta.percentrank: önceki len değerin kaçı ≤ güncel (%)
const prank = (a: number[], len: number) => a.map((v, i) => { if (i < len || !Number.isFinite(v)) return NaN; let c = 0; for (let j = i - len; j < i; j++) if (a[j]! <= v) c++; return (100 * c) / len; });
const pivot = (a: number[], i: number, L: number, hi: boolean) => { const c = i - L; if (c - L < 0) return NaN; const v = a[c]!; if (!Number.isFinite(v)) return NaN;
  for (let j = c - L; j <= c + L; j++) { if (j === c) continue; const w = a[j]!; if (hi ? (j < c ? w > v : w >= v) : (j < c ? w < v : w <= v)) return NaN; } return v; };
function vortex(cs: Candle[], period: number, sm: number) { const n = cs.length, adx = new Array<number>(n).fill(NaN), pl = new Array<number>(n).fill(NaN), mi = new Array<number>(n).fill(NaN);
  const tr = cs.map((c, i) => (i ? Math.max(c.high - c.low, Math.abs(c.high - cs[i - 1]!.close), Math.abs(c.low - cs[i - 1]!.close)) : c.high - c.low));
  const vp = cs.map((c, i) => (i ? Math.abs(c.high - cs[i - 1]!.low) : NaN)), vm = cs.map((c, i) => (i ? Math.abs(c.low - cs[i - 1]!.high) : NaN));
  const raw = new Array<number>(n).fill(NaN);
  for (let i = period; i < n; i++) { let a = 0, b = 0, t = 0; for (let j = i - period + 1; j <= i; j++) { a += vp[j]!; b += vm[j]!; t += tr[j]!; } const P = a / Math.max(t, 1e-4), M = b / Math.max(t, 1e-4);
    pl[i] = P; mi[i] = M; raw[i] = (100 * (Math.abs(P - M) * 10)) / Math.max((P + M) * 10, 1e-4); }
  const a1 = Math.exp((-Math.PI * Math.SQRT2) / Math.max(sm, 1)), c2 = 2 * a1 * Math.cos((Math.SQRT2 * Math.PI) / sm), c3 = -a1 * a1, c1 = 1 - c2 - c3; let f1 = 0, f2 = 0;
  for (let i = 0; i < n; i++) { const x = Number.isFinite(raw[i]!) ? raw[i]! : 0, xp = i && Number.isFinite(raw[i - 1]!) ? raw[i - 1]! : 0; const f = (c1 * (x + xp)) / 2 + c2 * f1 + c3 * f2; f2 = f1; f1 = f; adx[i] = Number.isFinite(raw[i]!) ? f : NaN; }
  return { adx, pl, mi };
}
export type TprsiResult = { n: number; need: number; osc: number[]; up: number[]; lo: number[]; mid: number[]; c1s: number[]; c1l: number[]; c5s: number[]; c5l: number[]; sq: boolean[]; bScore: number[]; sScore: number[]; ev: Record<"al" | "sat" | "p3" | "sq" | "bdiv" | "bdivh" | "jf", boolean[]> };
export function computeTprsi(cs: Candle[], p?: TprsiParams | null): TprsiResult {
  const o = tprsiOpts(p), n = cs.length, g = o.gamma, c = cs.map((x) => x.close);
  const osc = new Array<number>(n); let L0 = 0, L1 = 0, L2 = 0, L3 = 0;
  for (let i = 0; i < n; i++) { const p0 = L0, p1 = L1, p2 = L2; L0 = (1 - g) * c[i]! + g * p0; L1 = -g * L0 + p0 + g * p1; L2 = -g * L1 + p1 + g * p2; L3 = -g * L2 + p2 + g * L3;
    const cu = (L0 >= L1 ? L0 - L1 : 0) + (L1 >= L2 ? L1 - L2 : 0) + (L2 >= L3 ? L2 - L3 : 0), cd = (L0 < L1 ? L1 - L0 : 0) + (L1 < L2 ? L2 - L1 : 0) + (L2 < L3 ? L3 - L2 : 0); osc[i] = cu + cd !== 0 ? (100 * cu) / (cu + cd) : 50; }
  const [mid, sd] = smaSd(osc, o.bb), up = mid.map((m, i) => m + o.mult * sd[i]!), lo = mid.map((m, i) => m - o.mult * sd[i]!);
  const bw = mid.map((m, i) => (up[i]! - lo[i]!) / m), bwr = prank(bw, 100), sq = bwr.map((r) => r <= o.sqPct), opr = prank(osc, 200);
  const c1s = ema(osc, 21), c1l = ema(osc, 48), c5s = ema(osc, 206), c5l = ema(osc, 499);
  const ev = { al: [], sat: [], p3: [], sq: [], bdiv: [], bdivh: [], jf: [] } as unknown as TprsiResult["ev"], bScore: number[] = [], sScore: number[] = [];
  const rH: number[] = [], rHb: number[] = [], rL: number[] = [], rLb: number[] = [], pH: number[] = [], pL: number[] = [];
  const hi = cs.map((x) => x.high), lw = cs.map((x) => x.low);
  let lastBull = NaN, lastBear = NaN, pos = 0, entry = NaN, lastBuy = NaN, lastSell = NaN; const P = o.piv;
  const X = (a: number[], b: number[], i: number) => i > 0 && a[i]! > b[i]! && a[i - 1]! <= b[i - 1]!, U = (a: number[], b: number[], i: number) => i > 0 && a[i]! < b[i]! && a[i - 1]! >= b[i - 1]!;
  for (let i = 0; i < n; i++) {
    const ph = pivot(osc, i, P, true), pl = pivot(osc, i, P, false), pph = pivot(hi, i, P, true), ppl = pivot(lw, i, P, false);
    const push = (A: number[], v: number, B?: number[]) => { A.unshift(v); if (B) B.unshift(i - P); if (A.length > 10) { A.pop(); if (B) B.pop(); } };
    if (Number.isFinite(ph)) push(rH, ph, rHb); if (Number.isFinite(pl)) push(rL, pl, rLb); if (Number.isFinite(pph)) push(pH, pph); if (Number.isFinite(ppl)) push(pL, ppl);
    let bReg = false, sReg = false, bHid = false, sHid = false;
    if (Number.isFinite(pl) && rL.length >= 2 && pL.length >= 2) { const d = i - rLb[1]!; if (d <= o.maxLb && d > P) { if (pL[0]! < pL[1]! && rL[0]! > rL[1]!) bReg = true; if (pL[0]! > pL[1]! && rL[0]! < rL[1]!) bHid = true; } }
    if (Number.isFinite(ph) && rH.length >= 2 && pH.length >= 2) { const d = i - rHb[1]!; if (d <= o.maxLb && d > P) { if (pH[0]! > pH[1]! && rH[0]! < rH[1]!) sReg = true; if (pH[0]! < pH[1]! && rH[0]! > rH[1]!) sHid = true; } }
    if (bReg || bHid) lastBull = i; if (sReg || sHid) lastBear = i;
    const bdr = Number.isFinite(lastBull) && i - lastBull <= o.divWin, sdr = Number.isFinite(lastBear) && i - lastBear <= o.divWin;
    const tb = c1s[i]! >= c1l[i]!, mb = c5s[i]! >= c5l[i]!;
    let mnp = Infinity, mxp = -Infinity; for (let j = Math.max(0, i - o.depthLen + 1); j <= i; j++) { if (opr[j]! < mnp) mnp = opr[j]!; if (opr[j]! > mxp) mxp = opr[j]!; }
    const dl = i >= o.depthLen - 1 && mnp <= o.depthPct, dh = i >= o.depthLen - 1 && mxp >= 100 - o.depthPct;
    const bs = (tb ? 1 : 0) + (mb ? 1 : 0) + (bdr ? 1 : 0) + (dl ? 1 : 0) + (cs[i]!.close > cs[i]!.open ? 1 : 0);
    const ss = (!tb ? 1 : 0) + (!mb ? 1 : 0) + (sdr ? 1 : 0) + (dh ? 1 : 0) + (cs[i]!.close < cs[i]!.open ? 1 : 0); bScore[i] = bs; sScore[i] = ss;
    const ok = Number.isFinite(lo[i - 1] ?? NaN);
    const buy = ok && X(osc, lo, i) && bs >= o.minScore && (Number.isNaN(lastBuy) || i - lastBuy >= o.cool) && pos !== 1;
    const sell = ok && U(osc, up, i) && ss >= o.minScore && (Number.isNaN(lastSell) || i - lastSell >= o.cool) && pos !== -1;
    const exL = pos === 1 && (X(osc, mid, i) || (o.stop > 0 && osc[i]! <= entry - o.stop)) && !sell, exS = pos === -1 && (U(osc, mid, i) || (o.stop > 0 && osc[i]! >= entry + o.stop)) && !buy;
    if (buy) { pos = 1; entry = osc[i]!; lastBuy = i; } else if (sell) { pos = -1; entry = osc[i]!; lastSell = i; } else if (exL || exS) { pos = 0; entry = NaN; }
    ev.al[i] = buy; ev.sat[i] = sell; ev.p3[i] = buy && bs >= 3; ev.bdiv[i] = bReg; ev.bdivh[i] = bHid;
    ev.sq[i] = i > 0 && !sq[i] && sq[i - 1]! && Number.isFinite(bwr[i]!) && osc[i]! > mid[i]!;
  }
  const J = computeJfkps(cs, { len: o.jfLen, x: o.jfX, sm: o.jfSm, jl: o.jfJl, phase: o.jfPh }), V = vortex(cs, o.adxLen, o.adxSm), W = o.comboWin;
  const kl = J.ev.long.map((v, i) => v && V.adx[i]! > o.adxThr && V.pl[i]! > V.mi[i]!);
  for (let i = 0; i < n; i++) { let a = false, b = false; for (let j = Math.max(0, i - W + 1); j <= i; j++) { if (ev.al[j]) a = true; if (kl[j]) b = true; } ev.jf[i] = a && b && (ev.al[i]! || kl[i]!); }
  return { n, need: tprsiMinBars(p), osc, up, lo, mid, c1s, c1l, c5s, c5l, sq, bScore, sScore, ev };
}
export type TprsiHit = { cond: TprsiCond; barsAgo: number; note: string };
const EVK: Record<TprsiCond, keyof TprsiResult["ev"]> = { tp_al: "al", tp_sat: "sat", tp_p3: "p3", tp_sq: "sq", tp_bdiv: "bdiv", tp_bdivh: "bdivh", tp_jf: "jf" };
export function tprsiScan(candles: Candle[], conds: TprsiCond[], maxBarsAgo: number, p?: TprsiParams | null, o: { nowMs?: number } = {}): TprsiHit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, o.nowMs), closed = candles.slice(0, lc + 1), R = computeTprsi(closed, p);
  if (closed.length < R.need) return [];
  const last = candles.length - 1, out: TprsiHit[] = [];
  for (const cond of conds) { const e = R.ev[EVK[cond]];
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) if (e[i]) { const sc = TPRSI_BEAR_CONDS.has(cond) ? R.sScore[i] : R.bScore[i];
      out.push({ cond, barsAgo: last - i, note: `TP RSI ${TPRSI_COND_LABEL[cond]} · puan ${sc}/5 · osc ${R.osc[i]!.toFixed(1)}` }); break; } }
  return out;
}
