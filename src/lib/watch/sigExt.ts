/**
 * Sinyale hazırlık ek kaynakları (01.11.2026) — robot (watch.ts) ve tarayıcı (public/sig-ext.js, bun build) AYNI kodu kullanır.
 *  1) Hibrit MACD+Pump Long-only (TradeDesk 9cfb970, presets.ts "hybridMacdPumpLong"):
 *     long = MACD(12,26,9) yukarı kesişim  VEYA  (ADX Pump kademesi |stage|≥2 ve yükseliyor, bias>0, MACD zaten sinyal üstünde, +DI>−DI).
 *  2) KDC-MACD (osc-lab/kdc-macd-20261030/kdcmacd.py, kağıt bot): 30dk KDC (Stoch 100/15/30) K↑D, sonra ≤10 saat içinde
 *     kapanmış 1s mumda MACD(12,26,9, pandas ewm adjust=False) yukarı kesişim; her KDC kesişimini ilk MACD kesişimi tüketir. Yalnız LONG.
 *  3) İkili (KDC-MACD + Umut): aynı coinde KDC-MACD sinyali ile Umut (4s KAL + RSI14 boğa uyumsuzluğu) sinyali birbirinden < 5 adet 4s mum arayla.
 *     KDC-MACD'nin 1s sinyal mumu, içinde bulunduğu 4s muma eşlenir; o 4s mum kapanmadan sayılmaz. Sinyal mumu = ikisinden sonraki olanın 4s mumu.
 */
import { macd as macdTD, adx } from "../indicators/math";
import { adxPumpRadar } from "../indicators/adxPump";
import { umutSignals, type UBar, type UmutHit, UMUT } from "./umut";
import type { Candle } from "../types";

const H1 = 36e5, H4 = 4 * H1, M30 = 18e5;
const toC = (b: UBar[]) => b.map((x) => ({ time: Math.floor(x.t / 1000), open: x.open, high: x.high, low: x.low, close: x.close, volume: x.volume })) as Candle[];

// ---------------- Hibrit MACD+Pump (Long-only) ----------------
export interface HybridSeries { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[]; stage: (number | null)[]; bias: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[]; long: boolean[]; via: ("macd" | "pump" | null)[] }
export function hybridMacdPump(b: UBar[]): HybridSeries {
  const c = toC(b), cl = b.map((x) => x.close), m = macdTD(cl, 12, 26, 9), d = adx(c, 14);
  const r = adxPumpRadar(c, { adxPeriod: 14, fastSmooth: 3, medianLen: 5, momPeriod: 7, cciPeriod: 10, bbPeriod: 20, bbMult: 2, smoothLen: 3, adxConfirm: 25, adxWake: 15 });
  const n = b.length, long = new Array<boolean>(n).fill(false), via = new Array<"macd" | "pump" | null>(n).fill(null);
  const xa = (a: (number | null)[], q: (number | null)[], i: number) => i >= 1 && a[i] != null && q[i] != null && a[i - 1] != null && q[i - 1] != null && (a[i - 1] as number) <= (q[i - 1] as number) && (a[i] as number) > (q[i] as number);
  for (let i = 1; i < n; i++) {
    if (m.macd[i] == null || m.signal[i] == null || r.stage[i] == null || r.bias[i] == null) continue;
    const macdBull = xa(m.macd, m.signal, i), macdUp = (m.macd[i] as number) > (m.signal[i] as number), bias = r.bias[i] as number;
    const absSt = Math.abs(r.stage[i] as number), absPrev = Math.abs((r.stage[i - 1] as number) ?? 0);
    const pumpEsc = absSt >= 2 && absSt > absPrev && bias > 0;
    const diBull = d.plusDI[i] != null && d.minusDI[i] != null && (d.plusDI[i] as number) > (d.minusDI[i] as number);
    if (macdBull || (pumpEsc && macdUp && diBull)) { long[i] = true; via[i] = macdBull ? "macd" : "pump"; }
  }
  return { macd: m.macd, signal: m.signal, hist: m.hist, stage: r.stage, bias: r.bias, plusDI: d.plusDI, minusDI: d.minusDI, long, via };
}

// ---------------- KDC-MACD (kdcmacd.py birebir) ----------------
const KP = 100, M1 = 15, M2 = 30, WIN_H = 10, WARM = 200;
function rollMean(a: number[], w: number): number[] { const n = a.length, o = new Array<number>(n).fill(NaN); for (let i = w - 1; i < n; i++) { let s = 0, ok = true; for (let j = i - w + 1; j <= i; j++) { if (!Number.isFinite(a[j])) { ok = false; break; } s += a[j]; } if (ok) o[i] = s / w; } return o; }
/** KDC: raw%K = 100·(C−LL100)/(HH100−LL100); K = SMA15(raw); D = SMA30(K) */
export function kdc(b: UBar[]): { k: number[]; d: number[] } {
  const n = b.length, raw = new Array<number>(n).fill(NaN);
  for (let i = KP - 1; i < n; i++) { let lo = Infinity, hi = -Infinity; for (let j = i - KP + 1; j <= i; j++) { if (b[j].low < lo) lo = b[j].low; if (b[j].high > hi) hi = b[j].high; } const rg = hi - lo; raw[i] = rg === 0 ? NaN : (100 * (b[i].close - lo)) / rg; }
  const k = rollMean(raw, M1); return { k, d: rollMean(k, M2) };
}
function ewm(a: number[], span: number): number[] { const al = 2 / (span + 1), o = new Array<number>(a.length).fill(NaN); let p = NaN; for (let i = 0; i < a.length; i++) { p = Number.isFinite(p) ? al * a[i] + (1 - al) * p : a[i]; o[i] = p; } return o; }
/** pandas c.ewm(span, adjust=False) MACD — kdcmacd.py ile aynı */
export function macdPd(c: number[]): { m: number[]; s: number[] } { const e12 = ewm(c, 12), e26 = ewm(c, 26), m = e12.map((v, i) => v - e26[i]); return { m, s: ewm(m, 9) }; }
const up = (a: number[], q: number[], i: number) => i >= 1 && Number.isFinite(a[i]) && Number.isFinite(q[i]) && Number.isFinite(a[i - 1]) && Number.isFinite(q[i - 1]) && a[i] > q[i] && a[i - 1] <= q[i - 1];
export interface KdcHit { i: number; T: number; kt: number; lagH: number; kdcK: number; kdcD: number; macd: number; sig: number }
/** b30/b1h: yalnız kapanmış mumlar (t = açılış ms). Dönüş: tamamlanan her KDC→MACD dizisi (i = 1s mum indeksi, T = 1s kapanış). */
export function kdcMacdSignals(b30: UBar[], b1h: UBar[]): { hits: KdcHit[]; kx: number[]; k: number[]; d: number[]; m: number[]; s: number[] } {
  const K = kdc(b30), kx: number[] = [];
  for (let i = WARM; i < b30.length; i++) if (up(K.k, K.d, i)) kx.push(i);
  const M = macdPd(b1h.map((x) => x.close)), hits: KdcHit[] = []; let used = -1; // kx dizisinde tüketilen son indeks
  for (let i = WARM; i < b1h.length; i++) {
    if (!up(M.m, M.s, i)) continue;
    const T = b1h[i].t + H1, lo = T - WIN_H * H1; let best = -1;
    for (let q = used + 1; q < kx.length; q++) { const kt = b30[kx[q]].t + M30; if (kt >= T) break; if (kt >= lo) best = q; }
    if (best >= 0) { const kt = b30[kx[best]].t + M30; hits.push({ i, T, kt, lagH: (T - kt) / H1, kdcK: K.k[kx[best]], kdcD: K.d[kx[best]], macd: M.m[i], sig: M.s[i] }); }
    while (used + 1 < kx.length && b30[kx[used + 1]].t + M30 < T) used++;
  }
  return { hits, kx, k: K.k, d: K.d, m: M.m, s: M.s };
}

// ---------------- İkili: KDC-MACD + Umut (4s, < 5 mum) ----------------
export interface IkiliHit { i: number; umutI: number; kdcI4: number; kdc: KdcHit; umut: UmutHit }
/** 4s mum indeksi: KDC-MACD 1s sinyal mumunun içinde bulunduğu 4s mum (yalnız kapanmış 4s mumlar; yoksa −1) */
export function to4h(b4: UBar[], t1h: number): number { const t4 = Math.floor(t1h / H4) * H4; let lo = 0, hi = b4.length - 1; while (lo <= hi) { const md = (lo + hi) >> 1; if (b4[md].t === t4) return md; if (b4[md].t < t4) lo = md + 1; else hi = md - 1; } return -1; }
export function ikiliSignals(b4: UBar[], b30: UBar[], b1h: UBar[], umut?: UmutHit[], kdcHits?: KdcHit[]): { hits: IkiliHit[]; umut: UmutHit[]; kdc: KdcHit[] } {
  const U = umut || umutSignals(b4), KH = kdcHits || kdcMacdSignals(b30, b1h).hits, out: IkiliHit[] = [], seen = new Set<number>();
  for (const k of KH) {
    const k4 = to4h(b4, b1h[k.i].t); if (k4 < 0) continue;
    // en yakın Umut sinyali (< 5 mum, her iki yön)
    let bu: UmutHit | null = null; for (const u of U) if (Math.abs(u.i - k4) < UMUT.N && (!bu || Math.abs(u.i - k4) < Math.abs(bu.i - k4))) bu = u;
    if (!bu) continue; const i = Math.max(bu.i, k4); if (seen.has(i)) continue; seen.add(i);
    out.push({ i, umutI: bu.i, kdcI4: k4, kdc: k, umut: bu });
  }
  out.sort((a, b) => a.i - b.i); return { hits: out, umut: U, kdc: KH };
}
