/**
 * ElifScan — kullanıcının Pine kodunun birebir portu (osc-lab/elifscan-20261102/eliflib.py ile aynı).
 * stoch(p) = SMA3( 100·(close − lowest(low,p)) / (highest(high,p) − lowest(low,p) + 0.0001) )
 * FRAMA(src,len): N1=(hh−ll)/len; half=max(floor(len/2),1); N2=N3=(hh(half)−ll(half))/half (orijinal koddaki N2=N3 aynen korunur)
 *   D=clamp((ln(N1+N2+N3)−ln N)/ln2,1,2); alpha=clamp(exp(−4.6(D−1)),0.01,1); ilk değer SMA(src,len), sonra alpha·src+(1−alpha)·önceki.
 *   N1+N2+N3=0 (Pine'da ln(0) → na): o mum na, sonraki geçerli mumda SMA ile yeniden başlar.
 * main = (FRAMA(stoch(15),10) + FRAMA(stoch(30),10)) / 2
 * Bantlar: wma1=WMA(main,20); wma2=WMA(wma1,20); upper=wma1+(wma1−wma2); lower=wma1−(wma1−wma2) (=wma2)
 * DİPTEN KESİM (kapanmış mum): crossover(main, lower) VEYA crossover(upper, lower), ve main < 40 (kesişim mumunda ya da bir önceki mumda).
 */
export const ELIF = { ss: 15, sl: 30, fp: 10, dsl: 20, zone: 40 };
export interface EBar { high: number; low: number; close: number }
const fin = (x: number) => typeof x === "number" && Number.isFinite(x);

function sma(x: number[], n: number): number[] {
  const o = new Array(x.length).fill(NaN);
  for (let i = n - 1; i < x.length; i++) { let s = 0, ok = true; for (let j = i - n + 1; j <= i; j++) { if (!fin(x[j])) { ok = false; break; } s += x[j]; } if (ok) o[i] = s / n; }
  return o;
}
export function stoch(b: EBar[], p: number): number[] {
  const raw = new Array(b.length).fill(NaN);
  for (let i = p - 1; i < b.length; i++) { let hh = -Infinity, ll = Infinity; for (let j = i - p + 1; j <= i; j++) { if (b[j].high > hh) hh = b[j].high; if (b[j].low < ll) ll = b[j].low; } raw[i] = (100 * (b[i].close - ll)) / (hh - ll + 0.0001); }
  return sma(raw, 3);
}
export function frama(src: number[], ln: number): number[] {
  const n = src.length, o = new Array(n).fill(NaN), half = Math.max(Math.floor(ln / 2), 1); let prev = NaN;
  for (let i = ln - 1; i < n; i++) {
    let ok = true; for (let j = i - ln + 1; j <= i; j++) if (!fin(src[j])) { ok = false; break; }
    if (!ok) { prev = NaN; continue; }
    let hh = -Infinity, ll = Infinity, s = 0; for (let j = i - ln + 1; j <= i; j++) { hh = Math.max(hh, src[j]); ll = Math.min(ll, src[j]); s += src[j]; }
    let h2 = -Infinity, l2 = Infinity; for (let j = i - half + 1; j <= i; j++) { h2 = Math.max(h2, src[j]); l2 = Math.min(l2, src[j]); }
    const N1 = (hh - ll) / ln, N2 = (h2 - l2) / half, N3 = N2, tot = N1 + N2 + N3;
    if (!(tot > 0)) { prev = NaN; continue; }
    const N = tot / 3; let D = (Math.log(tot) - Math.log(N)) / Math.log(2); D = Math.min(2, Math.max(1, D));
    const al = Math.min(1, Math.max(0.01, Math.exp(-4.6 * (D - 1))));
    prev = fin(prev) ? al * src[i] + (1 - al) * prev : s / ln; o[i] = prev;
  }
  return o;
}
export function wma(x: number[], n: number): number[] {
  const o = new Array(x.length).fill(NaN), ws = (n * (n + 1)) / 2;
  for (let i = n - 1; i < x.length; i++) { let s = 0, ok = true; for (let k = 0; k < n; k++) { const v = x[i - n + 1 + k]; if (!fin(v)) { ok = false; break; } s += v * (k + 1); } if (ok) o[i] = s / ws; }
  return o;
}
export function elifCalc(b: EBar[], P = ELIF) {
  const f1 = frama(stoch(b, P.ss), P.fp), f2 = frama(stoch(b, P.sl), P.fp);
  const main = f1.map((v, i) => (v + f2[i]) / 2), w1 = wma(main, P.dsl), w2 = wma(w1, P.dsl);
  const upper = w1.map((v, i) => v + (v - w2[i])), lower = w1.map((v, i) => v - (v - w2[i]));
  return { main, upper, lower };
}
const xup = (a: number[], b: number[], i: number) => i > 0 && fin(a[i]) && fin(b[i]) && fin(a[i - 1]) && fin(b[i - 1]) && a[i] > b[i] && a[i - 1] <= b[i - 1];
export interface DipHit { i: number; main: number; upper: number; lower: number; via: "main↑alt" | "üst↑alt" | "ikisi" }
/** Dipten kesim sinyalleri (tüm mumlar kapanmış varsayılır) */
export function dipSignals(b: EBar[], P = ELIF): DipHit[] {
  const { main, upper, lower } = elifCalc(b, P), out: DipHit[] = [];
  for (let i = 1; i < b.length; i++) {
    const a = xup(main, lower, i), c = xup(upper, lower, i); if (!a && !c) continue;
    if (!(main[i] < P.zone || main[i - 1] < P.zone)) continue;
    out.push({ i, main: main[i], upper: upper[i], lower: lower[i], via: a && c ? "ikisi" : a ? "main↑alt" : "üst↑alt" });
  }
  return out;
}
/** dip4 — bant kesişimi: üst bant (wma1 + (wma1 − wma2)) alt bandı (wma2) yukarı keser = crossover(upper, lower), kapanmış mumda;
 *  main < 40 (kesişim mumunda ya da bir önceki mumda). main↑alt koşulu YOK. */
export function dipBandSignals(b: EBar[], P = ELIF): DipHit[] {
  const { main, upper, lower } = elifCalc(b, P), out: DipHit[] = [];
  for (let i = 1; i < b.length; i++) {
    if (!xup(upper, lower, i)) continue;
    if (!(main[i] < P.zone || main[i - 1] < P.zone)) continue;
    out.push({ i, main: main[i], upper: upper[i], lower: lower[i], via: "üst↑alt" });
  }
  return out;
}
