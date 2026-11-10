/**
 * YIMA Pro (4s) — kullanıcının yima_fixdate.py betiğinin BİREBİR TS portu (pandas semantiği korunur). İşlem/emir YOK (yalnız paper).
 * Referans: /workspace/yima-test/yima_fixdate.py (dayfirst=False düzeltmeli kullanıcı betiği).
 *  - ATR: TR'nin ewm(alpha=0.01, adjust=False) ortalaması ("ATR100"); Supertrend 4 × ATR, başlangıç yönü düşüş (betikteki yaklaşık/deterministik hâl).
 *  - osc = HMA25(close − supertrend) / (4·ATR); macd = EMA8(osc) − EMA21(osc).
 *  - YIMA fast = yima(5,55,12), slow = yima(25,240,24); spread = 100·(fast−slow)/close; hist = spread − EMA9(spread); EMA200(close).
 *  - LONG : macd 0'ı yukarı keser (macd>0 ve önceki ≤0) ∧ close < close[−3] (3 mum geri çekilme) ∧ close > EMA200 ∧ hist > 0
 *  - SHORT: macd 0'ı aşağı keser ∧ close > close[−3] ∧ close < EMA200 ∧ hist < 0
 *  - Aynı yönde iki KABUL EDİLEN sinyal arası ≥ 6 mum (cooldown); ilk 250 mum atlanır. Çıkış: giriş mumundan 6 mum sonra (süre çıkışı); stop/TP yok.
 */
export interface YBars { t: number[]; h: number[]; l: number[]; c: number[] }
export const YIMA = { need: 250, hold: 6, cool: 6, st: 4, atrAlpha: 0.01 } as const;
const fin = Number.isFinite;

/** pandas ewm(span=n, adjust=False): ilk geçerli değer tohum; sonradan gelen NaN önceki değeri korur */
function ema(x: number[], n: number): number[] {
  const a = 2 / (n + 1), o = new Array<number>(x.length).fill(NaN); let prev = NaN;
  for (let i = 0; i < x.length; i++) {
    if (fin(x[i])) prev = fin(prev) ? a * x[i] + (1 - a) * prev : x[i];
    o[i] = prev;
  }
  return o;
}
/** rolling(n).apply(dot(x, 1..n)·2/(n(n+1))) — penceredeki tüm değerler sonlu olmalı */
function wma(x: number[], n: number): number[] {
  const o = new Array<number>(x.length).fill(NaN), k = 2 / (n * (n + 1));
  for (let i = n - 1; i < x.length; i++) { let s = 0, ok = true; for (let j = 0; j < n; j++) { const v = x[i - n + 1 + j]; if (!fin(v)) { ok = false; break; } s += v * (j + 1); } if (ok) o[i] = s * k; }
  return o;
}
function hma(x: number[], n: number): number[] {
  const a = wma(x, Math.floor(n / 2)), b = wma(x, n), d = x.map((_, i) => 2 * a[i] - b[i]);
  return wma(d, Math.floor(Math.sqrt(n)));
}
/** kullanıcı betiğindeki yima(q, slow, lb): uyarlanabilir (verimlilik oranı × şok) EMA */
function yimaLine(c: number[], step: number[], q: number, slow: number, lb: number): number[] {
  const n = c.length, abs = step.map(Math.abs), vol = ema(abs, 30), o = new Array<number>(n).fill(NaN);
  const aS = 2 / (slow + 1), aQ = 2 / (q + 1);
  o[0] = c[0];
  let run = 0;
  for (let i = 0; i < n; i++) { run += abs[i]; if (i >= lb) run -= abs[i - lb]; if (i === 0) continue;
    let er = 0;
    if (i >= lb) { const path = run; if (path !== 0) er = Math.min(1, Math.max(0, Math.abs(c[i] - c[i - lb]) / path)); }
    let shock = 0;
    if (vol[i] !== 0 && fin(vol[i])) shock = Math.min(3, Math.max(0, abs[i] / vol[i]));
    const w = Math.min(1, Math.max(0, Math.pow(er, 1.4) * (0.8 + 0.2 * shock / 3)));
    o[i] = o[i - 1] + (aS + (aQ - aS) * w) * (c[i] - o[i - 1]);
  }
  return o;
}
export interface YimaEv { i: number; side: 1 | -1; macd: number; hist: number; ema200: number }
export function yimaProEval(b: YBars): { ev: YimaEv[]; n: number } {
  const n = b.c.length, c = b.c, h = b.h, l = b.l;
  if (n < YIMA.need + 8) return { ev: [], n };
  const tr = c.map((_, i) => (i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
  const atr = new Array<number>(n); atr[0] = tr[0];
  for (let i = 1; i < n; i++) atr[i] = YIMA.atrAlpha * tr[i] + (1 - YIMA.atrAlpha) * atr[i - 1];
  const fu = new Array<number>(n), fl = new Array<number>(n), stl = new Array<number>(n).fill(NaN), trend = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i++) { const hl = (h[i] + l[i]) / 2; fu[i] = hl + YIMA.st * atr[i]; fl[i] = hl - YIMA.st * atr[i]; }
  for (let i = 1; i < n; i++) {
    const bu = (h[i] + l[i]) / 2 + YIMA.st * atr[i], bl = (h[i] + l[i]) / 2 - YIMA.st * atr[i];
    if (bu >= fu[i - 1] && c[i - 1] <= fu[i - 1]) fu[i] = fu[i - 1]; else fu[i] = bu;
    if (bl <= fl[i - 1] && c[i - 1] >= fl[i - 1]) fl[i] = fl[i - 1]; else fl[i] = bl;
    trend[i] = c[i] > fu[i] ? 1 : c[i] < fl[i] ? -1 : trend[i - 1];
    stl[i] = trend[i] === 1 ? fl[i] : fu[i];
  }
  const osc = hma(c.map((x, i) => x - stl[i]), 25).map((v, i) => v / (YIMA.st * atr[i]));
  const e8 = ema(osc, 8), e21 = ema(osc, 21), macd = e8.map((v, i) => v - e21[i]);
  const step = c.map((x, i) => (i === 0 ? 0 : x - c[i - 1]));
  const fast = yimaLine(c, step, 5, 55, 12), slow = yimaLine(c, step, 25, 240, 24);
  const spread = c.map((x, i) => 100 * (fast[i] - slow[i]) / x), hist = ema(spread, 9).map((v, i) => spread[i] - v);
  const e200 = ema(c, 200);
  const ev: YimaEv[] = [], last: Record<number, number> = { 1: -100, [-1]: -100 };
  for (let t = YIMA.need; t < n; t++) {
    if (![macd[t], macd[t - 1], e200[t], hist[t]].every(fin)) continue;
    const up = macd[t] > 0 && macd[t - 1] <= 0 && c[t] < c[t - 3] && c[t] > e200[t] && hist[t] > 0;
    const dn = macd[t] < 0 && macd[t - 1] >= 0 && c[t] > c[t - 3] && c[t] < e200[t] && hist[t] < 0;
    if (!up && !dn) continue;
    const side: 1 | -1 = up ? 1 : -1;
    if (t - last[side] < YIMA.cool) continue;
    last[side] = t; ev.push({ i: t, side, macd: macd[t], hist: hist[t], ema200: e200[t] });
  }
  return { ev, n };
}
