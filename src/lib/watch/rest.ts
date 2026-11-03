/**
 * REST — "MultiTime Stochastics Pro" (Pine) kullanıcı uyarlaması. İşlem/emir YOK (yalnız izleme + sanal/paper).
 *  Stoch1 = 15dk, Stoch2 = 30dk; ikisi de K uzunluk 140, smoothK 30, D 30 (K = SMA(stoch(close,high,low,140),30), D = SMA(K,30)).
 *  Sinyal: K1 (kırmızı, 15dk) K2'yi (yeşil, 30dk) yukarı keser → LONG; aşağı keser → SHORT. Kapanmış 15dk mumlarda;
 *  K2 = o 15dk mumu kapandığında KAPANMIŞ son 30dk mumunun K'si (ileriye bakmaz). Highest/lowest (MTF uç) mantığı yok.
 *  Ekleme kuralı: açık pozisyon yönünde fiyat–K1 uyumsuzluğu (LONG: fiyat LL + K1 HL; SHORT: fiyat HH + K1 LH), pivot 5/5, 5–60 mum → ilk büyüklükte ekleme, en çok 2.
 *  TP %10 (ortalama girişe göre). Ters kesişim = pozisyon kapanır ve ters yöne açılır.
 */
export const REST = { len: 140, sk: 30, sd: 30, tp: 0.1, maxAdds: 2, L: 5, R: 5, lbMin: 5, lbMax: 60, tf1: 9e5, tf2: 18e5 } as const;
export interface RBars { t: number[]; h: number[]; l: number[]; c: number[] }

const sma = (x: number[], n: number) => {
  const o = new Array<number>(x.length).fill(NaN); let s = 0, k = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]; if (!Number.isFinite(v)) { s = 0; k = 0; continue; }
    s += v; k++; if (k > n) { s -= x[i - n]; k = n; } if (k === n) o[i] = s / n;
  }
  return o;
};
export function stochKD(b: RBars, len: number = REST.len, sk: number = REST.sk, sd: number = REST.sd) {
  const n = b.c.length, raw = new Array<number>(n).fill(NaN);
  for (let i = len - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity; for (let j = i - len + 1; j <= i; j++) { if (b.h[j] > hh) hh = b.h[j]; if (b.l[j] < ll) ll = b.l[j]; }
    raw[i] = hh > ll ? (100 * (b.c[i] - ll)) / (hh - ll) : 50;
  }
  const K = sma(raw, sk); return { K, D: sma(K, sd) };
}
export interface RestEv { i: number; side: "LONG" | "SHORT"; k1: number; k2: number }
export interface RestDiv { i: number; p: number; p0: number; side: "LONG" | "SHORT"; px: number; px0: number; k: number; k0: number }
/** b1 = 15dk, b2 = 30dk kapanmış mumlar (t = açılış ms). */
export function restEval(b1: RBars, b2: RBars) {
  const n = b1.c.length, S1 = stochKD(b1), S2 = stochKD(b2), k2 = new Array<number>(n).fill(NaN);
  let j = -1;
  for (let i = 0; i < n; i++) { const close1 = b1.t[i] + REST.tf1; while (j + 1 < b2.t.length && b2.t[j + 1] + REST.tf2 <= close1) j++; if (j >= 0) k2[i] = S2.K[j]; }
  const k1 = S1.K, ev: RestEv[] = [];
  for (let i = 1; i < n; i++) {
    const a0 = k1[i - 1], a1 = k1[i], b0 = k2[i - 1], c1 = k2[i];
    if (![a0, a1, b0, c1].every(Number.isFinite)) continue;
    if (a0 <= b0 && a1 > c1) ev.push({ i, side: "LONG", k1: a1, k2: c1 });
    else if (a0 >= b0 && a1 < c1) ev.push({ i, side: "SHORT", k1: a1, k2: c1 });
  }
  const div: RestDiv[] = [];
  for (const bull of [true, false]) {
    const px = bull ? b1.l : b1.h; let pb = -1, pp = 0, po = 0;
    for (let i = REST.L + REST.R; i < n; i++) {
      const p = i - REST.R, v = px[p]; if (!Number.isFinite(k1[p])) continue;
      let isp = true;
      for (let q = p - REST.L; q <= p + REST.R; q++) { if (q === p) continue; if (bull ? px[q] < v || (q < p && px[q] === v) : px[q] > v || (q < p && px[q] === v)) { isp = false; break; } }
      if (!isp) continue;
      if (pb >= 0 && p - pb >= REST.lbMin && p - pb <= REST.lbMax && (bull ? v < pp && k1[p] > po : v > pp && k1[p] < po)) div.push({ i, p, p0: pb, side: bull ? "LONG" : "SHORT", px: v, px0: pp, k: k1[p], k0: po });
      pb = p; pp = v; po = k1[p];
    }
  }
  div.sort((a, b) => a.i - b.i);
  return { k1, k2, ev, div, need: REST.len + REST.sk + REST.sd };
}
