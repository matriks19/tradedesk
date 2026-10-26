/**
 * T47 · Fear & Greed Index [BigBeluga] (kullanıcının Pine v6 göstergesi; QUANTEX T47 ile aynı matematik).
 * FG = (RSI + Trend(SMA uzaklığı ×4 +50, 0..100) + Hacim akışı(alış hacmi / toplam)) / 3. Yalnız kapanmış mum.
 * Çipler: uyumsuzluk (teyitli pivot 5/5, 5–60 mum), ikili/üçlü dip (FG ≤45) ve tepe (FG ≥55), aşırı bölge kesişimleri.
 */
import type { Candle } from "@/lib/types";
import { lastClosedIndex } from "./eliziLdr4";

export type FearGreedParams = { rsi?: number; trd?: number; flow?: number; ob?: number; os?: number; tol?: number; rtol?: number; cw?: number };
export const FEAR_GREED_DEFAULTS = { rsi: 14, trd: 50, flow: 20, ob: 70, os: 30, tol: 8, rtol: 3, cw: 10 };
export type FearGreedCond = "fg_pd" | "fg_nd" | "fg_d2" | "fg_d3" | "fg_t2" | "fg_t3" | "fg_xf" | "fg_xg" | "fg_d2bb" | "fg_t2bb" | "fg_d3bb" | "fg_t3bb" | "fg_ra" | "fg_rs" | "fg_rad" | "fg_rst" | "fg_radb" | "fg_rstb";
export const ALL_FEAR_GREED_CONDS: FearGreedCond[] = ["fg_pd", "fg_nd", "fg_d2", "fg_d3", "fg_t2", "fg_t3", "fg_d2bb", "fg_t2bb", "fg_d3bb", "fg_t3bb", "fg_xf", "fg_xg", "fg_ra", "fg_rs", "fg_rad", "fg_rst", "fg_radb", "fg_rstb"];
export const DEFAULT_FEAR_GREED_CONDS: FearGreedCond[] = ["fg_pd", "fg_nd", "fg_d2", "fg_d3", "fg_t2", "fg_t3", "fg_d2bb", "fg_d3bb", "fg_ra", "fg_rad", "fg_radb"];
export const FEAR_GREED_BEAR_CONDS = new Set<FearGreedCond>(["fg_nd", "fg_t2", "fg_t3", "fg_t2bb", "fg_t3bb", "fg_xg", "fg_rs", "fg_rst", "fg_rstb"]);
export const FEAR_GREED_COND_LABEL: Record<FearGreedCond, string> = {
  fg_pd: "Pozitif uyumsuzluk",
  fg_nd: "Negatif uyumsuzluk",
  fg_d2: "İkili dip",
  fg_d3: "Üçlü dip",
  fg_t2: "İkili tepe",
  fg_t3: "Üçlü tepe",
  fg_d2bb: "İkili dip + 2. BB alt dokunuş",
  fg_t2bb: "İkili tepe + 2. BB üst dokunuş",
  fg_d3bb: "Üçlü dip + 3. BB alt dokunuş",
  fg_t3bb: "Üçlü tepe + 3. BB üst dokunuş",
  fg_xf: "Aşırı Korku 30↓",
  fg_xg: "Aşırı Açgözlülük 70↑",
  fg_ra: "Korku≤30 → RSI 30↑",
  fg_rs: "Açgözlülük≥70 → RSI 70↓",
  fg_rad: "Korku+RSI + İkili/Üçlü dip",
  fg_rst: "Açgözlülük+RSI + İkili/Üçlü tepe",
  fg_radb: "Korku+RSI + dip BB dokunuş",
  fg_rstb: "Açgözlülük+RSI + tepe BB dokunuş",
};
const PV = 5;
const RANGE_UPPER = 60;

function opts(p?: FearGreedParams | null) {
  const g = (v: unknown, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  return {
    rsi: Math.round(g(p?.rsi, 14)), trd: Math.round(g(p?.trd, 50)), flow: Math.round(g(p?.flow, 20)),
    ob: g(p?.ob, 70), os: g(p?.os, 30), tol: g(p?.tol, 8),
    rtol: Number.isFinite(Number(p?.rtol)) && Number(p?.rtol) >= 0 ? Number(p?.rtol) : 3, cw: Math.round(g(p?.cw, 10)),
  };
}
export function fearGreedMinBars(p?: FearGreedParams | null): number {
  const o = opts(p);
  return Math.max(o.trd, o.flow, o.rsi + 1) + PV * 2 + 2;
}

export function computeFearGreed(candles: Candle[], p?: FearGreedParams | null, opt: { noDedupe?: boolean } = {}) {
  const o = opts(p), n = candles.length;
  const C = candles.map((k) => k.close), O = candles.map((k) => k.open), H = candles.map((k) => k.high), Lw = candles.map((k) => k.low);
  const V = candles.map((k) => Number(k.volume) || 0);
  const rsi = new Array<number>(n).fill(NaN), fg = new Array<number>(n).fill(NaN);
  let ag = 0, al = 0;
  for (let i = 1; i < n; i++) {
    const ch = C[i]! - C[i - 1]!, u = ch > 0 ? ch : 0, d = ch < 0 ? -ch : 0;
    if (i <= o.rsi) { ag += u; al += d; if (i === o.rsi) { ag /= o.rsi; al /= o.rsi; rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } }
    else { ag = (ag * (o.rsi - 1) + u) / o.rsi; al = (al * (o.rsi - 1) + d) / o.rsi; rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
  }
  for (let i = 0; i < n; i++) {
    if (i < o.trd - 1 || i < o.flow - 1) continue;
    let s = 0; for (let j = i - o.trd + 1; j <= i; j++) s += C[j]!;
    const sma = s / o.trd, fT = Math.max(0, Math.min(100, 50 + ((C[i]! - sma) / sma) * 100 * 4));
    let tv = 0, bv = 0; for (let j = i - o.flow + 1; j <= i; j++) { tv += V[j]!; if (C[j]! >= O[j]!) bv += V[j]!; }
    const fV = tv > 0 ? (bv / tv) * 100 : 50, fM = Number.isFinite(rsi[i]!) ? rsi[i]! : 50;
    fg[i] = (fM + fT + fV) / 3;
  }
  const ev: Record<FearGreedCond, boolean[]> = {} as Record<FearGreedCond, boolean[]>;
  for (const c of ALL_FEAR_GREED_CONDS) ev[c] = new Array<boolean>(n).fill(false);
  // BB(20,2) fiyat bantları — 2. dokunuş epizodu için
  const bU = new Array<number>(n).fill(NaN), bL = new Array<number>(n).fill(NaN);
  for (let i = 19; i < n; i++) {
    let s0 = 0, q0 = 0; for (let j = i - 19; j <= i; j++) { s0 += C[j]!; q0 += C[j]! * C[j]!; }
    const m0 = s0 / 20, sd0 = Math.sqrt(Math.max(q0 / 20 - m0 * m0, 0)); bU[i] = m0 + 2 * sd0; bL[i] = m0 - 2 * sd0;
  }
  const tch = (x: number, low: boolean) => (low ? Lw[x]! <= bL[x]! : H[x]! >= bU[x]!);
  const near = (x: number, low: boolean, hiLim: number) => { for (let y = Math.max(0, x - PV); y <= Math.min(hiLim, x + PV); y++) if (tch(y, low)) return y; return -1; };
  /** Her pivot civarında ayrı BB dokunuşu; ardışık dokunuşlar arasında banda değmeyen en az bir mum (tepe: üst bant). */
  const bbN = (piv: number[], c: number, low: boolean) => {
    let prevT = -1;
    for (let z = 0; z < piv.length; z++) {
      const lim = z + 1 < piv.length ? piv[z + 1]! - 1 : c, t = near(piv[z]!, low, lim);
      if (t < 0 || t <= prevT) return false;
      if (prevT >= 0) { let gap = false; for (let y = prevT + 1; y < t; y++) if (!tch(y, low)) { gap = true; break; } if (!gap) return false; }
      prevT = t;
    }
    return true;
  };
  let lastG = -99, lastF = -99;
  for (let i = 1; i < n; i++) {
    if (!Number.isFinite(fg[i]!) || !Number.isFinite(fg[i - 1]!)) continue;
    if (fg[i]! > o.ob && fg[i - 1]! <= o.ob && i - lastG >= 5) { ev.fg_xg[i] = true; lastG = i; }
    if (fg[i]! < o.os && fg[i - 1]! >= o.os && i - lastF >= 5) { ev.fg_xf[i] = true; lastF = i; }
  }
  const pl: number[] = [], ph: number[] = [];
  for (let j = PV; j < n - PV; j++) {
    if (!Number.isFinite(fg[j]!)) continue;
    let isL = true, isH = true;
    for (let z = 1; z <= PV; z++) {
      const a = fg[j - z]!, b = fg[j + z]!;
      if (!Number.isFinite(a) || !Number.isFinite(b)) { isL = isH = false; break; }
      if (a < fg[j]! || b <= fg[j]!) isL = false;
      if (a > fg[j]! || b >= fg[j]!) isH = false;
    }
    if (isL) pl.push(j);
    if (isH) ph.push(j);
  }
  // Tekrar önleme: her chip yapı başına 1 kez; FG bölgeden çıkınca (dip >45 / tepe <55) veya fiyat yapının ucunu kırınca yeniden kurulur.
  const dd = !opt.noDedupe;
  const walk = (P: number[], low: boolean) => {
    const arm: Partial<Record<FearGreedCond, boolean>> = {}, ext: Partial<Record<FearGreedCond, number>> = {}, lastC: Partial<Record<FearGreedCond, number>> = {};
    const fire = (key: FearGreedCond, c: number, pivs: number[]) => {
      if (dd) {
        if (arm[key] === false) {
          for (let y = lastC[key]! + 1; y <= c; y++) {
            if (low ? fg[y]! > 45 || Lw[y]! < ext[key]! : fg[y]! < 55 || H[y]! > ext[key]!) { arm[key] = true; break; }
          }
          if (arm[key] === false) return;
        }
        arm[key] = false; lastC[key] = c;
        ext[key] = low ? Math.min(...pivs.map((x) => Lw[x]!)) : Math.max(...pivs.map((x) => H[x]!));
      }
      ev[key][c] = true;
    };
    for (let q = 0; q < P.length; q++) {
      const pv = P[q]!, c = pv + PV;
      if (c >= n) continue;
      const prev = P.slice(0, q).filter((x) => pv - x >= PV && pv - x <= RANGE_UPPER);
      if (prev.length) {
        const pp = prev[prev.length - 1]!;
        if (low) { if (Lw[pv]! < Lw[pp]! && fg[pv]! > fg[pp]!) ev.fg_pd[c] = true; }
        else if (H[pv]! > H[pp]! && fg[pv]! < fg[pp]!) ev.fg_nd[c] = true;
      }
      const inZone = (x: number) => (low ? fg[x]! <= 45 : fg[x]! >= 55);
      if (!inZone(pv)) continue;
      const m = prev.filter((x) => inZone(x) && Math.abs(fg[x]! - fg[pv]!) <= o.tol);
      if (!m.length) continue;
      const f0 = m[m.length - 1]!;
      const lvl = low ? fg[pv]! >= fg[f0]! - 1 : fg[pv]! <= fg[f0]! + 1;
      const pc = low ? C[c]! > C[pv]! : C[c]! < C[pv]!;
      if (!lvl || !pc) continue;
      if (m.length >= 2) {
        const p3 = [m[m.length - 2]!, f0, pv];
        fire(low ? "fg_d3" : "fg_t3", c, p3);
        if (bbN(p3, c, low)) fire(low ? "fg_d3bb" : "fg_t3bb", c, p3);
      } else fire(low ? "fg_d2" : "fg_t2", c, [f0, pv]);
      if (bbN([f0, pv], c, low)) fire(low ? "fg_d2bb" : "fg_t2bb", c, [f0, pv]);
    }
  };
  walk(pl, true);
  walk(ph, false);
  // RSI(14) kesişimi + FG bölgesi (FG ≤ os+rtol / ≥ ob−rtol); kombolar: son cw mumda ikili/üçlü yapı (veya BB versiyonu)
  const anyIn = (keys: FearGreedCond[], i: number) => { for (let y = Math.max(0, i - o.cw); y <= i; y++) for (const k of keys) if (ev[k][y]) return true; return false; };
  for (let i = 1; i < n; i++) {
    const r0 = rsi[i - 1]!, r1 = rsi[i]!, f = fg[i]!;
    if (!Number.isFinite(r0) || !Number.isFinite(r1) || !Number.isFinite(f)) continue;
    if (r0 < 30 && r1 >= 30 && f <= o.os + o.rtol) {
      ev.fg_ra[i] = true;
      if (anyIn(["fg_d2", "fg_d3"], i)) ev.fg_rad[i] = true;
      if (anyIn(["fg_d2bb", "fg_d3bb"], i)) ev.fg_radb[i] = true;
    }
    if (r0 > 70 && r1 <= 70 && f >= o.ob - o.rtol) {
      ev.fg_rs[i] = true;
      if (anyIn(["fg_t2", "fg_t3"], i)) ev.fg_rst[i] = true;
      if (anyIn(["fg_t2bb", "fg_t3bb"], i)) ev.fg_rstb[i] = true;
    }
  }
  return { n, need: fearGreedMinBars(p), fg, ob: o.ob, os: o.os, ev };
}

export function fearGreedState(v: number, ob = 70, os = 30): string {
  if (!Number.isFinite(v)) return "—";
  return v >= ob ? "Aşırı Açgözlülük" : v >= 55 ? "Açgözlülük" : v <= os ? "Aşırı Korku" : v <= 45 ? "Korku" : "Nötr";
}

export type FearGreedHit = { cond: FearGreedCond; barsAgo: number; note: string };
export function fearGreedScan(candles: Candle[], conds: FearGreedCond[], maxBarsAgo: number, p?: FearGreedParams | null, o: { nowMs?: number } = {}): FearGreedHit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, o.nowMs), closed = candles.slice(0, lc + 1), R = computeFearGreed(closed, p);
  if (closed.length <= R.need) return [];
  const last = candles.length - 1, out: FearGreedHit[] = [];
  for (const cond of conds) {
    const ev = R.ev[cond];
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) {
      if (!ev[i]) continue;
      const v = R.fg[i]!;
      out.push({ cond, barsAgo: last - i, note: `F&G ${FEAR_GREED_COND_LABEL[cond]} · FG ${Number.isFinite(v) ? v.toFixed(0) : "—"} ${fearGreedState(v, R.ob, R.os)} (−${last - i})` });
      break;
    }
  }
  return out;
}
