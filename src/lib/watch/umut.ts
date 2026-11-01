/**
 * UMUT — 4s KAL boğa uyumsuzluğu (kal_hist_div) + RSI14 boğa uyumsuzluğu 5 mum içinde birlikte. 01.11.2026.
 * Araştırma: osc-lab/kal-tp-test-20261101/combo3.py (kaldiv+rsidiv, N=5, TP10 + 2 ATR stop + 100 mum):
 *   2013 işlem, kazanma %42, PF 1.15, IS +%0.51 / OOS +%0.52 işlem başı, rastgele giriş −%0.18.
 * Kural (ileriye bakmaz): pivot dip 3/3, pivottan 3 mum sonra kesinleşir; fiyat daha düşük dip + osilatör daha yüksek dip, ≤50 mum.
 * Sinyal: iki olaydan ikincisinin geldiği mum (diğeri son 5 mum içinde, mevcut mum dahil). Giriş = sonraki 4s açılış.
 * Stop = giriş − 2·ATR14 (sinyal mumu, Wilder). Hedefler R1 +%10 (test edilen), R2 +%20, R3 +%30. Süre 100 mum.
 * YALNIZ İZLEME — işlem açmaz.
 */
import { computeKalHibrit } from "../indicators/kalHibrit";
import type { Candle } from "../types";

export interface UBar { t: number; open: number; high: number; low: number; close: number; volume: number }
export const UMUT = { N: 5, piv: 3, maxLb: 50, atrK: 2, tps: [0.1, 0.2, 0.3], trackBars: 100 };

/** Wilder RSI — combo3.py rsi() ile aynı (ilk değer index n'de, ortalama g[1..n]) */
export function rsiW(c: number[], n = 14): number[] {
  const L = c.length, out = new Array<number>(L).fill(NaN); if (L <= n) return out;
  let ag = 0, al = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; ag += d > 0 ? d : 0; al += d < 0 ? -d : 0; }
  ag /= n; al /= n;
  const f = (g: number, l: number) => 100 - 100 / (1 + g / (l === 0 ? 1e-12 : l));
  out[n] = f(ag, al);
  for (let i = n + 1; i < L; i++) { const d = c[i] - c[i - 1]; ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n; al = (al * (n - 1) + (d < 0 ? -d : 0)) / n; out[i] = f(ag, al); }
  return out;
}
/** Wilder ATR14 — kallib.py atr() ile aynı (tr[0] = h−l, tohum = ilk 14 TR ortalaması) */
export function atrW(b: UBar[], n = 14): number[] {
  const L = b.length, out = new Array<number>(L).fill(NaN); if (L < n) return out;
  const tr = b.map((x, i) => (i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close))));
  let a = 0; for (let i = 0; i < n; i++) a += tr[i]; a /= n; out[n - 1] = a;
  for (let i = n; i < L; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
  return out;
}
/** combo3.py osc_div(): olay = kesinleşme mumu i (pivot c = i−3). pv[i] = olayın (daha düşük) pivot dip indeksi */
export function oscDiv(low: number[], k: number[], piv = 3, maxLb = 50): { ev: boolean[]; pv: number[] } {
  const n = low.length, ev = new Array<boolean>(n).fill(false), pv = new Array<number>(n).fill(-1);
  let pb = -1, pp = 0, pk = 0, has = false;
  for (let i = 1; i < n; i++) {
    const c = i - piv;
    if (c - piv >= 0 && Number.isFinite(k[c])) {
      let isp = true;
      for (let j = c - piv; j <= c + piv; j++) if (j !== c && low[j] <= low[c] && (j > c || low[j] < low[c])) { isp = false; break; }
      if (isp) {
        if (has && c - pb <= maxLb && low[c] < pp && k[c] > pk) { ev[i] = true; pv[i] = c; }
        pb = c; pp = low[c]; pk = k[c]; has = true;
      }
    }
  }
  return { ev, pv };
}

export interface UmutHit { i: number; kalAt: number; rsiAt: number; pivLow: number; atr: number; rsi: number; kal: number }
/** Tüm Umut sinyalleri (mum indeksleri). Araştırmadaki gibi i ≥ 120. */
export function umutSignals(b: UBar[]): UmutHit[] {
  const n = b.length; if (n < 150) return [];
  const close = b.map((x) => x.close), low = b.map((x) => x.low);
  const kh = computeKalHibrit(b.map((x) => ({ time: Math.floor(x.t / 1000), open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume })) as Candle[]);
  const hd = kh.ev.kal_hist_div, r = rsiW(close), A = atrW(b);
  const vd = oscDiv(low, r, UMUT.piv, UMUT.maxLb), kd = oscDiv(low, kh.k, UMUT.piv, UMUT.maxLb);
  let lastD = -1e9, lastV = -1e9, lastKp = -1, lastVp = -1; const out: UmutHit[] = [];
  for (let i = 0; i < n; i++) {
    if (kd.ev[i]) lastKp = kd.pv[i];
    if (vd.ev[i]) { lastV = i; lastVp = vd.pv[i]; }
    if (hd[i]) lastD = i;
    if (i < 120) continue;
    if ((hd[i] || vd.ev[i]) && i - lastD < UMUT.N && i - lastV < UMUT.N && Number.isFinite(A[i])) {
      const pl = Math.min(lastVp >= 0 ? low[lastVp] : Infinity, lastKp >= 0 ? low[lastKp] : Infinity);
      out.push({ i, kalAt: lastD, rsiAt: lastV, pivLow: Number.isFinite(pl) ? pl : low[i], atr: A[i], rsi: r[i], kal: kh.k[i] });
    }
  }
  return out;
}

export type UmutLive = "bekliyor" | "hedefe gidiyor" | "R1" | "R2" | "R3" | "stop" | "süre doldu";
export interface UmutTrack {
  lv: { stop: number; r1: number; r2: number; r3: number }; hit: { r1: number | null; r2: number | null; r3: number | null; stop: number | null };
  stage: 0 | 1 | 2 | 3; live: UmutLive; end: "stop" | "süre" | "R3" | null; endBar: number | null; bars: number;
  last: number; hi: number; lo: number; hiPct: number; loPct: number; chgPct: number; prog: number;
  atrNow: number; pivLow: number; intact: boolean; add: boolean; addWhy: string; trackBars: number;
}
/** 100 mumluk izleme: R1→R2→R3 basamakları, stop (aynı mumda stop öncelikli, kallib sim gibi), süre. R1 sonrası stop sabit kalır (iz sürmez). */
export function umutTrack(b: UBar[], i1: number, entry: number, stop: number, pivLow: number, atrNow: number): UmutTrack {
  const T = UMUT.trackBars, lv = { stop, r1: entry * 1.1, r2: entry * 1.2, r3: entry * 1.3 }, tg = [lv.r1, lv.r2, lv.r3];
  const hit: UmutTrack["hit"] = { r1: null, r2: null, r3: null, stop: null };
  let stage: 0 | 1 | 2 | 3 = 0, end: UmutTrack["end"] = null, endBar: number | null = null, hi = -Infinity, lo = Infinity, k = 0, last = entry, minLow = Infinity;
  for (let j = i1; j < b.length && k < T; j++) {
    k++; const x = b[j]; last = x.close;
    hi = Math.max(hi, x.high); lo = Math.min(lo, x.low); minLow = Math.min(minLow, x.low);
    if (x.low <= stop) { hit.stop = k; end = "stop"; endBar = k; break; }
    for (let m = stage; m < 3; m++) if (x.high >= tg[m]) { stage = (m + 1) as 1 | 2 | 3; (hit as Record<string, number | null>)["r" + (m + 1)] = k; }
    if (stage === 3) { end = "R3"; endBar = k; break; }
    if (k >= T) { end = "süre"; endBar = k; }
  }
  const live: UmutLive = k === 0 ? "bekliyor" : end === "stop" && stage === 0 ? "stop" : end === "süre" && stage === 0 ? "süre doldu" : stage > 0 ? (("R" + stage) as UmutLive) : "hedefe gidiyor";
  const intact = minLow > pivLow;
  const open = k > 0 && end === null && stage < 3;
  const nearEntry = last <= entry + 0.25 * atrNow && last >= entry - 1 * atrNow && last > stop;
  const ranUp = hi >= entry + atrNow; // önce en az +1 ATR yükselmiş olmalı ("geri çekilme")
  const add = open && intact && nearEntry && ranUp && k >= 2;
  const addWhy = !open ? "" : !intact ? "uyumsuzluk dibi kırıldı" : last > stop && last < entry - atrNow ? "giriş −1 ATR altında, stopa yakın" : nearEntry && ranUp ? `+1 ATR yükseldikten sonra fiyat girişe geri çekildi (giriş ${last >= entry ? "üstü" : "−" + ((entry - last) / atrNow).toFixed(2) + " ATR"}), stop ve dip yapısı sağlam` : "";
  const p2 = (v: number) => +v.toFixed(2);
  const prog = k === 0 ? 0 : last >= entry ? Math.min(1, (last - entry) / (lv.r3 - entry)) : -Math.min(1, (entry - last) / Math.max(1e-12, entry - stop));
  return { lv, hit, stage, live, end, endBar, bars: k, last, hi: k ? hi : entry, lo: k ? lo : entry, hiPct: k ? p2((hi - entry) / entry * 100) : 0, loPct: k ? p2((lo - entry) / entry * 100) : 0,
    chgPct: p2((last - entry) / entry * 100), prog: +prog.toFixed(3), atrNow, pivLow, intact, add, addWhy, trackBars: T };
}
