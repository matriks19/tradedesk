/**
 * T30 · FRACTAL 8 Ribbons — kullanıcının Pine v4 göstergesi (sadık port; QUANTEX T30 ile aynı matematik).
 * ap = hlc3; wta(m) = ema(ci, n2·m·mult), ci = 100·(ap−esa)/ema(|ap−esa|, n1·m·mult), esa = ema(ap, n1·m·mult), m = 1..128.
 * Level'lar bir önceki mumdan ve nz() ile. Sinyaller yalnız ilgili bileşenler ısınmışsa (nz→0 sahte kesişim üretmez).
 * Kırmızı = Level 1, Yeşil = Level 2, Siyah = Level 5. Yalnız kapanmış mum.
 */
import type { Candle } from "@/lib/types";
import { lastClosedIndex } from "./eliziLdr4";

export const FRACTAL8_FETCH_LIMIT = 1000;
export type Fractal8Params = { n1?: number; n2?: number; ob?: number; mult?: number; /** "auto" veya 1, 0.5, 0.25, 0.125, 0.0625 */ scale?: number | "auto" };
export const FR8_SCALES = [1, 0.5, 0.25, 0.125, 0.0625];
export const fr8ScaleLabel = (sc: number) => (sc >= 1 ? "1" : `1/${Math.round(1 / sc)}`);
export const FR8_DEFAULTS = { n1: 10, n2: 21, ob: 75, mult: 1 };
export type Fractal8Cond = "fr8_up12" | "fr8_dn12" | "fr8_up15" | "fr8_up25" | "fr8_dn25";
export const ALL_FRACTAL8_CONDS: Fractal8Cond[] = ["fr8_up12", "fr8_dn12", "fr8_up15", "fr8_up25", "fr8_dn25"];
export const DEFAULT_FRACTAL8_CONDS: Fractal8Cond[] = ["fr8_up12", "fr8_dn12"];
export const FRACTAL8_BEAR_CONDS = new Set<Fractal8Cond>(["fr8_dn12", "fr8_dn25"]);
export const FRACTAL8_COND_LABEL: Record<Fractal8Cond, string> = {
  fr8_up12: "Kırmızı↑Yeşil AL",
  fr8_dn12: "Kırmızı↓Yeşil SAT",
  fr8_up15: "Kırmızı↑Siyah AL",
  fr8_up25: "Yeşil↑Siyah AL",
  fr8_dn25: "Yeşil↓Siyah SAT",
};

function opts(p?: Fractal8Params | null) {
  const g = (v: unknown, d: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : d;
  };
  return {
    n1: Math.round(g(p?.n1, 10)),
    n2: Math.round(g(p?.n2, 21)),
    ob: g(p?.ob, 75),
    mult: Math.max(1, Math.round(g(p?.mult, 1))),
  };
}
const per = (o: ReturnType<typeof opts>, sc: number, base: number, m: number) => Math.max(2, Math.round(base * m * o.mult * sc));
const needAt = (o: ReturnType<typeof opts>, sc: number, m: number) => 2 * per(o, sc, o.n1, m) + per(o, sc, o.n2, m) + 1;
/** Otomatik: Level 5 dahil tüm seviyelerin ısınıp ≥50 mum geçerli kaldığı en büyük ölçek (QUANTEX ile aynı). */
export function fractal8PickScale(p: Fractal8Params | null | undefined, n: number): { sc: number; auto: boolean } {
  const o = opts(p), v = Number(p?.scale);
  if (p?.scale !== undefined && p.scale !== "auto" && Number.isFinite(v) && v > 0) return { sc: v, auto: false };
  for (const sc of FR8_SCALES) if (needAt(o, sc, 128) + 50 <= n) return { sc, auto: true };
  return { sc: FR8_SCALES[FR8_SCALES.length - 1]!, auto: true };
}
/** Level 1/2 için gereken mum (Otomatik'te en küçük ölçek varsayılır). */
export function fractal8MinBars(p?: Fractal8Params | null): number {
  const o = opts(p), v = Number(p?.scale);
  const sc = p?.scale !== undefined && p.scale !== "auto" && Number.isFinite(v) && v > 0 ? v : FR8_SCALES[FR8_SCALES.length - 1]!;
  return needAt(o, sc, 16);
}
/** Pine ema: ilk len geçerli değerin SMA'sı ile tohumlanır. */
function ema(x: number[], len: number): number[] {
  const o = new Array<number>(x.length).fill(NaN);
  const a = 2 / (len + 1);
  let cnt = 0, sum = 0, e = NaN;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    if (!Number.isFinite(v)) continue;
    if (!Number.isFinite(e)) {
      cnt++; sum += v;
      if (cnt >= len) { e = sum / len; o[i] = e; }
    } else { e = a * v + (1 - a) * e; o[i] = e; }
  }
  return o;
}
export type Fractal8Result = { n: number; need: number; sc: number; scLbl: string; lv: number[][]; v12: boolean[]; v15: boolean[]; ev: Record<"up12" | "dn12" | "up15" | "up25" | "dn25", boolean[]> };

export function computeFractal8(candles: Candle[], p?: Fractal8Params | null): Fractal8Result {
  const o = opts(p), n = candles.length, M = [1, 2, 4, 8, 16, 32, 64, 128];
  const PS = fractal8PickScale(p, n), sc = PS.sc;
  const ap = candles.map((c) => (c.high + c.low + c.close) / 3);
  const W: Record<number, number[]> = {};
  for (const m of M) {
    const L1 = per(o, sc, o.n1, m), L2 = per(o, sc, o.n2, m);
    const esa = ema(ap, L1);
    const dd = ema(ap.map((v, i) => (Number.isFinite(esa[i]!) ? Math.abs(v - esa[i]!) : NaN)), L1);
    const ci = ap.map((v, i) => (Number.isFinite(esa[i]!) && Number.isFinite(dd[i]!) && dd[i] !== 0 ? (100 * (v - esa[i]!)) / dd[i]! : NaN));
    W[m] = ema(ci, L2);
  }
  const nz = (m: number, j: number) => { const v = j >= 0 ? W[m]![j]! : NaN; return Number.isFinite(v) ? v : 0; };
  const ok = (ms: number[], j: number) => j >= 0 && ms.every((m) => Number.isFinite(W[m]![j]!));
  const lv: number[][] = [[], [], [], [], []], v12: boolean[] = [], v15: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const j = i - 1;
    lv[0]![i] = (nz(1, j) + nz(2, j) + nz(4, j) + nz(8, j) + nz(16, j)) / 5;
    lv[1]![i] = (nz(4, j) + nz(8, j) + nz(16, j)) / 3;
    lv[2]![i] = (nz(8, j) + nz(16, j) + nz(32, j)) / 3;
    lv[3]![i] = (nz(16, j) + nz(32, j) + nz(64, j)) / 3;
    lv[4]![i] = (nz(8, j) + nz(16, j) + nz(32, j) + nz(64, j) + nz(128, j)) / 5;
    v12[i] = ok([1, 2, 4, 8, 16], j);
    v15[i] = v12[i]! && ok([32, 64, 128], j);
  }
  const ev = { up12: [] as boolean[], dn12: [] as boolean[], up15: [] as boolean[], up25: [] as boolean[], dn25: [] as boolean[] };
  const A = lv[0]!, B = lv[1]!, C = lv[4]!;
  for (let i = 0; i < n; i++) {
    const q = i - 1, a12 = i > 0 && v12[i]! && v12[q]!, a5 = i > 0 && v15[i]! && v15[q]!;
    ev.up12[i] = a12 && A[i]! > B[i]! && A[q]! <= B[q]!;
    ev.dn12[i] = a12 && A[i]! < B[i]! && A[q]! >= B[q]!;
    ev.up15[i] = a5 && A[i]! > C[i]! && A[q]! <= C[q]!;
    ev.up25[i] = a5 && B[i]! > C[i]! && B[q]! <= C[q]!;
    ev.dn25[i] = a5 && B[i]! < C[i]! && B[q]! >= C[q]!;
  }
  return { n, need: needAt(o, sc, 16), sc, scLbl: fr8ScaleLabel(sc) + (PS.auto ? " (oto)" : ""), lv, v12, v15, ev };
}

const EV_KEY: Record<Fractal8Cond, keyof Fractal8Result["ev"]> = { fr8_up12: "up12", fr8_dn12: "dn12", fr8_up15: "up15", fr8_up25: "up25", fr8_dn25: "dn25" };
export type Fractal8Hit = { cond: Fractal8Cond; barsAgo: number; note: string };

export function fractal8Scan(candles: Candle[], conds: Fractal8Cond[], maxBarsAgo: number, p?: Fractal8Params | null, o: { nowMs?: number } = {}): Fractal8Hit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, o.nowMs);
  const closed = candles.slice(0, lc + 1);
  const R = computeFractal8(closed, p);
  if (closed.length < R.need) return [];
  const last = candles.length - 1, out: Fractal8Hit[] = [];
  for (const cond of conds) {
    const ev = R.ev[EV_KEY[cond]];
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) {
      if (!ev[i]) continue;
      out.push({ cond, barsAgo: last - i, note: `FR8 ölçek ${R.scLbl} · ${FRACTAL8_COND_LABEL[cond]} · K ${R.lv[0]![i]!.toFixed(1)} / Y ${R.lv[1]![i]!.toFixed(1)}${R.v15[i] ? ` / S ${R.lv[4]![i]!.toFixed(1)}` : ""} (−${last - i})` });
      break;
    }
  }
  return out;
}
