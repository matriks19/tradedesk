/**
 * V12 Çift K2 Long (v12k2) — "Maneva Multi Structure + MTF Stoch V12" (Pine v6) kullanıcı kuralı. İşlem/emir YOK (yalnız izleme + sanal/paper).
 * Referans (birebir port): /workspace/osc-lab/mmsmtf-v12-20261104/mms.py + both3/run.py (xover + bölge −30), LONG; koşul = pch×K2c ∨ comb×K2c.
 *  Grafik/iş TF = 30dk (kapanmış mumlar). Mixed osilatör Length 55, Smoothing 15; ATR 14, reversal 1.5 × önceki ATR; ağırlıklar 1/1/1.
 *  Stoch 140/30/30: K1 = 15dk (30dk mum kapanışında kapanan 15dk mumu), K2 = 30dk. K2c = 2·K2 − 100.
 *  priceChannel = (osc(close)+osc(high)+osc(low))/3; core = (price + flow + leg)/(1 + flowVar + legVar); combined = 0.5·core + 0.5·(K1 − K2).
 *  LONG (kullanıcı son kararı 04.11.2026): kapanmış 30dk mumda priceChannel VEYA combined K2c'yi yukarı keser VE o mumda K2c < −30
 *  (iki çizgi şartı yok). Pozisyondayken gelen ikinci kesişim yok sayılır (coin başına tek pozisyon — tüketici tarafında).
 *  Backtest çıkışı (a): giriş sonraki 30dk açılış, TP %5, stop yok, 100 mum süre sınırı. Short: orijinalde yok; evS = AYNALI kural (aşağı kesiş + K2c > +30) — yalnız ayrı v12lsdip paper botu kullanır.
 */
export const V12K2 = { len: 55, sm: 15, atr: 14, rev: 1.5, sn: 140, sk: 30, sd: 30, zone: -30, tp: 0.05, maxBars: 100, tf1: 9e5, tf2: 18e5 } as const;
export interface VBars { t: number[]; o?: number[]; h: number[]; l: number[]; c: number[]; v?: number[] }
const NAN = NaN, fin = Number.isFinite;

/** SMA: penceredeki n değerin hepsi sonlu olmalı (mms.sma) */
function sma(x: number[], n: number): number[] {
  const m = x.length, o = new Array<number>(m).fill(NAN); let s = 0, k = 0;
  for (let i = 0; i < m; i++) { const v = x[i]; if (!fin(v)) { s = 0; k = 0; continue; } s += v; k++; if (k > n) { s -= x[i - n]; k = n; } if (k === n) o[i] = s / n; }
  return o;
}
/** Pine ta.rma: tohum = ilk tam n'lik pencerenin SMA'sı, sonra alpha 1/n; NaN gelirse önceki değer korunur (mms.rma) */
function rma(x: number[], n: number): number[] {
  const m = x.length, o = new Array<number>(m).fill(NAN); let prev = NAN;
  for (let i = 0; i < m; i++) {
    if (!fin(prev)) {
      if (i >= n - 1) { let s = 0, ok = true; for (let j = i - n + 1; j <= i; j++) { if (!fin(x[j])) { ok = false; break; } s += x[j]; } if (ok) { prev = s / n; o[i] = prev; } }
    } else { if (fin(x[i])) prev = (x[i] + (n - 1) * prev) / n; o[i] = prev; }
  }
  return o;
}
function rsi(src: number[], n: number): number[] {
  const m = src.length, g = new Array<number>(m).fill(NAN), l = new Array<number>(m).fill(NAN);
  for (let i = 1; i < m; i++) { const d = src[i] - src[i - 1]; g[i] = Math.max(d, 0); l[i] = Math.max(-d, 0); }
  const G = rma(g, n), L = rma(l, n), o = new Array<number>(m).fill(NAN);
  for (let i = 0; i < m; i++) if (fin(G[i]) && fin(L[i])) o[i] = G[i] === 0 && L[i] === 0 ? 50 : L[i] === 0 ? 100 : G[i] === 0 ? 0 : 100 - 100 / (1 + G[i] / L[i]);
  return o;
}
/** Mixed osilatör: (RSI·2−100 + CCI sıkıştırılmış + LOC)/3, sonra SMA(sm) */
function osc(src: number[], n: number, sm: number): number[] {
  const m = src.length, R = rsi(src, n), res = new Array<number>(m).fill(NAN);
  for (let i = n - 1; i < m; i++) {
    let s = 0, top = -Infinity, bot = Infinity;
    for (let j = i - n + 1; j <= i; j++) { s += src[j]; if (src[j] > top) top = src[j]; if (src[j] < bot) bot = src[j]; }
    const mu = s / n; let dv = 0; for (let j = i - n + 1; j <= i; j++) dv += Math.abs(src[j] - mu); dv /= n;
    let cc = 0; if (dv !== 0) { const cci = (src[i] - mu) / (0.015 * dv); cc = 100 * cci / (100 + Math.abs(cci)); }
    const loc = top === bot ? 0 : 200 * (src[i] - bot) / (top - bot) - 100;
    if (fin(R[i])) res[i] = (2 * (R[i] - 50) + cc + loc) / 3;
  }
  return sma(res, sm);
}
function hh(x: number[], n: number) { const m = x.length, o = new Array<number>(m).fill(NAN); for (let i = n - 1; i < m; i++) { let v = -Infinity; for (let j = i - n + 1; j <= i; j++) if (x[j] > v) v = x[j]; o[i] = v; } return o; }
function ll(x: number[], n: number) { const m = x.length, o = new Array<number>(m).fill(NAN); for (let i = n - 1; i < m; i++) { let v = Infinity; for (let j = i - n + 1; j <= i; j++) if (x[j] < v) v = x[j]; o[i] = v; } return o; }
/** Stoch K = SMA(sk) of raw stoch(len) (mms.stoch_src) */
export function stochK(b: VBars, len: number = V12K2.sn, sk: number = V12K2.sk): number[] {
  const H = hh(b.h, len), L = ll(b.l, len), raw = b.c.map((c, i) => (i < len - 1 ? NAN : H[i] === L[i] ? 50 : 100 * (c - L[i]) / (H[i] - L[i])));
  return sma(raw, sk);
}
const xover = (a: number[], b: number[], i: number) => i > 0 && [a[i], b[i], a[i - 1], b[i - 1]].every(fin) && a[i] > b[i] && a[i - 1] <= b[i - 1];
const xunder = (a: number[], b: number[], i: number) => i > 0 && [a[i], b[i], a[i - 1], b[i - 1]].every(fin) && a[i] < b[i] && a[i - 1] >= b[i - 1];

export interface V12Ev { i: number; k2c: number; pch: number; comb: number; k1: number; k2: number; core: number; /** hangi çizgi kesti */ by: "pch" | "comb" | "ikisi" }
/** b30 = kapanmış 30dk mumlar (t = açılış ms, hacim gerekir), b15 = kapanmış 15dk mumlar. */
export function v12k2Eval(b30: VBars, b15: VBars) {
  const P = V12K2, n = b30.c.length, { h, l, c } = b30, v = (b30.v || []).map((x) => (fin(x) ? x : 0));
  while (v.length < n) v.push(0);
  const oc = osc(c, P.len, P.sm), oh = osc(h, P.len, P.sm), ol = osc(l, P.len, P.sm), pch = oc.map((x, i) => (x + oh[i] + ol[i]) / 3);
  // akış: OBV, A/D, PVT
  const obv = new Array<number>(n), ad = new Array<number>(n), pvt = new Array<number>(n); let so = 0, sa = 0, sp = 0;
  for (let i = 0; i < n; i++) {
    const ch = i > 0 ? c[i] - c[i - 1] : 0; so += Math.sign(ch) * v[i]; obv[i] = so;
    sa += (h[i] === l[i] ? 0 : (2 * c[i] - h[i] - l[i]) / (h[i] - l[i])) * v[i]; ad[i] = sa;
    const pc = i > 0 ? c[i - 1] : NAN; sp += !fin(pc) || pc === 0 ? 0 : (c[i] - pc) / pc * v[i]; pvt[i] = sp;
  }
  const oo = osc(obv, P.len, P.sm), aa = osc(ad, P.len, P.sm), pp = osc(pvt, P.len, P.sm), vw = P.len + P.sm - 1, avgv = sma(v, vw);
  const flow = new Array<number>(n).fill(NAN);
  for (let i = vw - 1; i < n; i++) if (avgv[i] > 0 && fin(oo[i]) && fin(aa[i]) && fin(pp[i])) flow[i] = (oo[i] + aa[i] + pp[i]) / 3;
  // ATR14 (Pine rma), önceki mumun ATR'si ile zigzag
  const tr = c.map((_, i) => (i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
  const A = rma(tr, P.atr);
  const prevP = new Array<number>(n).fill(NAN), curP = new Array<number>(n).fill(NAN), conf = new Array<number>(n).fill(0);
  { let pivot = NAN, previous = NAN, extreme = NAN, threshold = NAN, dir = 0, cp = 0;
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? A[i - 1] : NAN;
      if (fin(a) && a > 0) {
        if (!fin(pivot)) { pivot = c[i]; extreme = c[i]; threshold = P.rev * a; }
        else if (dir === 0) { if (Math.abs(c[i] - pivot) >= threshold) { dir = c[i] > pivot ? 1 : -1; extreme = c[i]; } }
        else {
          if (dir * (c[i] - extreme) > 0) extreme = c[i];
          if (dir * (extreme - c[i]) >= threshold) { previous = pivot; pivot = extreme; cp++; dir = -dir; extreme = c[i]; threshold = P.rev * a; }
        }
      }
      prevP[i] = previous; curP[i] = pivot; conf[i] = cp;
    }
  }
  const lraw = new Array<number>(n).fill(NAN), ready = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!fin(prevP[i])) continue;
    const lb = Math.min(prevP[i], curP[i]), lt = Math.max(prevP[i], curP[i]);
    if (conf[i] >= 2 && lt > lb) { ready[i] = true; lraw[i] = Math.max(-100, Math.min(100, 200 * (c[i] - lb) / (lt - lb) - 100)); }
  }
  const legS = sma(lraw, P.sm), leg = legS.map((x, i) => (ready[i] ? x : NAN));
  const core = pch.map((x, i) => { const fw = fin(flow[i]), lw = fin(leg[i]); return (x + (fw ? flow[i] : 0) + (lw ? leg[i] : 0)) / (1 + (fw ? 1 : 0) + (lw ? 1 : 0)); });
  // K1: 30dk mum kapanışında kapanan 15dk mumu (kapanış = 30dk kapanış), K2: aynı 30dk mum
  const K15 = stochK(b15), K30 = stochK(b30), k1 = new Array<number>(n).fill(NAN), k2 = K30.slice();
  { let j = -1; for (let i = 0; i < n; i++) { const tc = b30.t[i] + P.tf2; while (j + 1 < b15.t.length && b15.t[j + 1] + P.tf1 <= tc) j++; if (j >= 0) { const tcs = b15.t[j] + P.tf1; if (tcs > b30.t[i] && tc - tcs < P.tf1) k1[i] = K15[j]; } } }
  const comb = new Array<number>(n).fill(NAN), k2c = k2.map((x) => 2 * x - 100);
  for (let i = 0; i < n; i++) if (fin(k1[i]) && fin(k2[i]) && fin(core[i])) comb[i] = 0.5 * core[i] + 0.5 * (k1[i] - k2[i]);
  const ev: V12Ev[] = [];
  for (let i = 1; i < n; i++) {
    if (!(k2c[i] < P.zone) || !fin(A[i])) continue;
    const a = xover(pch, k2c, i), b = xover(comb, k2c, i); if (!a && !b) continue;
    ev.push({ i, k2c: k2c[i], pch: pch[i], comb: comb[i], k1: k1[i], k2: k2[i], core: core[i], by: a && b ? "ikisi" : a ? "pch" : "comb" });
  }
  /** aynalı SHORT: priceChannel VEYA combined K2c'yi AŞAĞI keser VE K2c > +30 */
  const evS: V12Ev[] = [];
  for (let i = 1; i < n; i++) {
    if (!(k2c[i] > -P.zone) || !fin(A[i])) continue;
    const a = xunder(pch, k2c, i), b = xunder(comb, k2c, i); if (!a && !b) continue;
    evS.push({ i, k2c: k2c[i], pch: pch[i], comb: comb[i], k1: k1[i], k2: k2[i], core: core[i], by: a && b ? "ikisi" : a ? "pch" : "comb" });
  }
  return { pch, core, comb, k1, k2, k2c, atr: A, ev, evS, need: 260 };
}
