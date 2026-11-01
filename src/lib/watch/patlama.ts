/**
 * PATLAMA GÜCÜ (PG) 0–100 — saf fonksiyon, yalnız kapanmış mumlar, ileriye bakmaz. 02.11.2026.
 * Araştırma: osc-lab/patlama-gucu-20261102/pglib.py (birebir port; public/patlama.js aynı hesap).
 * Her bileşen 200 mumluk geçmiş-dahil yüzdelik (rpct): i ≥ 199 ve penceredeki geçerli değer ≥ 100.
 *  VPA   = ort( pct(Σ6(CLV·qv)/Σ6 qv), pct(Σ6(gövde/aralık)/6) )
 *  SQZ   = ort( 100 − pct(önceki 10 mumda min BBW20), pct(2 mum aralığı / ATR20) ), BBW = std20(örneklem)/sma20
 *  RS    = ort( pct(Δ6 ln(c/BTC)), pct(Δ20 ln(c/BTC)) )
 *  TAKER = pct(Σ6 takerBuyQuote / Σ6 quoteVol)
 *  FUND  = 100 − pct(mum kapanışında bilinen son funding)
 * PG5 = ort(VPA, SQZ, RS, TAKER, FUND). Vadeli verisi (taker/funding) yoksa PG3 = ort(VPA, SQZ, RS) — "PG3" olarak işaretlenir.
 * Kullanım (Umut+PG): Umut sinyal mumunda PG ≥ 50 → geçer. Test (80 coin 4s, 2022–2026): OOS 924 işlem, işlem başı +%0.58 (Umut +%0.48), DD 252 vs 413.
 */
export interface PGBar { t: number; open: number; high: number; low: number; close: number; volume: number; qv?: number; tbq?: number }
export type PGComp = "VPA" | "SQZ" | "RS" | "TAKER" | "FUND";
export const PG = { W: 200, pass: 50, H4: 144e5 };
const fin = (x: number) => typeof x === "number" && Number.isFinite(x);

export function rpct(x: number[], w = PG.W): number[] {
  const n = x.length, o = new Array<number>(n).fill(NaN);
  for (let i = w - 1; i < n; i++) {
    const v = x[i]; if (!fin(v)) continue;
    let cnt = 0, tot = 0;
    for (let j = i - w + 1; j <= i; j++) { const y = x[j]; if (fin(y)) { tot++; if (y <= v) cnt++; } }
    if (tot >= Math.floor(w / 2)) o[i] = (100 * cnt) / tot;
  }
  return o;
}
/** Σn (NaN → 0), ilk n−1 NaN */
function rsum(a: number[], n: number): number[] {
  const o = new Array<number>(a.length).fill(NaN); let s = 0; const q: number[] = [];
  for (let i = 0; i < a.length; i++) { const v = fin(a[i]) ? a[i] : 0; s += v; q.push(v); if (q.length > n) s -= q.shift()!; if (i >= n - 1) o[i] = s; }
  return o;
}
function atrN(b: PGBar[], n: number): number[] {
  const L = b.length, o = new Array<number>(L).fill(NaN); if (L < n) return o;
  const tr = b.map((x, i) => { const pc = i ? b[i - 1].close : b[0].close; return Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); });
  let a = 0; for (let i = 0; i < n; i++) a += tr[i]; a /= n; o[n - 1] = a;
  for (let i = n; i < L; i++) { a = (a * (n - 1) + tr[i]) / n; o[i] = a; }
  return o;
}
/** BBW = std(örneklem, ddof=1)/ortalama, 20 */
function bbw20(c: number[]): number[] {
  const n = c.length, o = new Array<number>(n).fill(NaN);
  for (let i = 19; i < n; i++) { let s = 0; for (let j = i - 19; j <= i; j++) s += c[j]; const m = s / 20; let q = 0; for (let j = i - 19; j <= i; j++) q += (c[j] - m) ** 2; o[i] = Math.sqrt(q / 19) / m; }
  return o;
}
/** a[i−n..i−1] minimumu (hepsi geçerli olmalı) */
function minPrev(a: number[], n: number): number[] {
  const o = new Array<number>(a.length).fill(NaN);
  for (let i = n; i < a.length; i++) { let m = Infinity, ok = true; for (let j = i - n; j < i; j++) { if (!fin(a[j])) { ok = false; break; } if (a[j] < m) m = a[j]; } if (ok) o[i] = m; }
  return o;
}
const avg2 = (a: number[], b: number[]) => a.map((v, i) => (v + b[i]) / 2);

/** Bileşenler. btc: BTC kapanışları zamana göre (t → close); fund: [zaman, oran] artan. Eksik veri → o bileşen yok. */
export function pgComponents(b: PGBar[], opt: { btc?: Map<number, number> | null; fund?: [number, number][] | null; tfMs?: number } = {}): Partial<Record<PGComp, number[]>> {
  const n = b.length, H = opt.tfMs || PG.H4, C: Partial<Record<PGComp, number[]>> = {};
  const c = b.map((x) => x.close), h = b.map((x) => x.high), l = b.map((x) => x.low);
  const qv = b.map((x) => (fin(x.qv as number) ? (x.qv as number) : NaN));
  const hasQv = qv.filter(fin).length > 0.9 * n;
  const rng = b.map((x) => (x.high - x.low > 0 ? x.high - x.low : NaN));
  const clv = b.map((x, i) => ((x.close - x.low) - (x.high - x.close)) / rng[i]), body = b.map((x, i) => (x.close - x.open) / rng[i]);
  // qv yoksa (spot/yedek) hacim × kapanış yaklaşığı
  const qvx = hasQv ? qv : b.map((x) => x.volume * x.close);
  const num = rsum(clv.map((v, i) => (fin(v) ? v : 0) * qvx[i]), 6), den = rsum(qvx, 6);
  const V1 = rpct(num.map((v, i) => v / den[i])), V2 = rpct(rsum(body, 6).map((v) => v / 6));
  C.VPA = avg2(V1, V2);
  const A20 = atrN(b, 20), bw = minPrev(bbw20(c), 10);
  const r2 = b.map((x, i) => (Math.max(h[i], i ? h[i - 1] : h[0]) - Math.min(l[i], i ? l[i - 1] : l[0])) / A20[i]);
  C.SQZ = avg2(rpct(bw).map((v) => 100 - v), rpct(r2));
  if (opt.btc && opt.btc.size) {
    const rs = b.map((x) => { const bc = opt.btc!.get(x.t); return bc ? Math.log(x.close) - Math.log(bc) : NaN; });
    if (rs.filter(fin).length > 0.5 * n) {
      const d = (k: number) => rs.map((v, i) => (i >= k ? v - rs[i - k] : NaN));
      C.RS = avg2(rpct(d(6)), rpct(d(20)));
    }
  }
  const tbq = b.map((x) => (fin(x.tbq as number) ? (x.tbq as number) : NaN));
  if (hasQv && tbq.filter(fin).length > 0.9 * n) { const a = rsum(tbq, 6); C.TAKER = rpct(a.map((v, i) => v / den[i])); }
  if (opt.fund && opt.fund.length) {
    const F = opt.fund; let k = -1;
    const fv = b.map((x) => { const tc = x.t + H; while (k + 1 < F.length && F[k + 1][0] <= tc) k++; return k >= 0 ? F[k][1] : NaN; });
    C.FUND = rpct(fv).map((v) => 100 - v);
  }
  return C;
}
export interface PGAt { score: number; mode: "PG5" | "PG3" | "PG-eksik"; comps: Partial<Record<PGComp, number>>; missing: PGComp[] }
const K5: PGComp[] = ["VPA", "SQZ", "RS", "TAKER", "FUND"], K3: PGComp[] = ["VPA", "SQZ", "RS"];
/** i mumundaki skor: PG5 mümkünse, değilse PG3 (bayraklı), o da yoksa mevcut fiyat bileşenleri ("PG-eksik") */
export function pgAt(C: Partial<Record<PGComp, number[]>>, i: number): PGAt {
  const v = (k: PGComp) => (C[k] ? C[k]![i] : NaN), comps: Partial<Record<PGComp, number>> = {};
  for (const k of K5) if (fin(v(k))) comps[k] = +v(k).toFixed(1);
  const missing = K5.filter((k) => !fin(v(k)));
  const mean = (ks: PGComp[]) => ks.reduce((a, k) => a + v(k), 0) / ks.length;
  if (K5.every((k) => fin(v(k)))) return { score: mean(K5), mode: "PG5", comps, missing };
  if (K3.every((k) => fin(v(k)))) return { score: mean(K3), mode: "PG3", comps, missing };
  const av = (["VPA", "SQZ"] as PGComp[]).filter((k) => fin(v(k)));
  return { score: av.length ? mean(av) : NaN, mode: "PG-eksik", comps, missing };
}
/** Tüm seri (grafik için): PG5, yoksa PG3 */
export function pgSeries(C: Partial<Record<PGComp, number[]>>, n: number): number[] {
  return Array.from({ length: n }, (_, i) => pgAt(C, i)).map((p) => (p.mode === "PG-eksik" ? NaN : p.score));
}
