/**
 * İzleme (watch-only) gösterge yardımcıları — osc-lab Python taramalarının TypeScript karşılıkları. İşlem/emir YOK.
 *  - Dual Band (dual-band-20261029/dualband.py + uptrick-lrb-20261029/lrb.py): BB ve Uptrick LRB bantları, 100/10 çift.
 *  - RSI14 30 yukarı kırılım (matriks-dt-20261030/scan_rsi30_bist.py: mdt.rsi + combo.edge_cd).
 *  - L/S 2s top-trader POSITION oranı dip uyumsuzluğu (ls-div-20261029/scan_ls.py).
 * Hepsi nedensel: bar i yalnız <= i barlarını kullanır; sinyal kapanmış mumda, giriş bir sonraki açılışta.
 */
export interface WBar { t: number; open: number; high: number; low: number; close: number; volume: number }

const fin = (x: number) => Number.isFinite(x);

/** Pine ta.ema / pandas ewm(adjust=False, ignore_na=True): ilk geçerli değerden başlar, NaN girişte önceki değeri taşır. */
export function emaP(x: number[], n: number): number[] {
  const a = 2 / (n + 1), out = new Array<number>(x.length).fill(NaN); let prev = NaN;
  for (let i = 0; i < x.length; i++) { const v = x[i]; if (!fin(v)) { out[i] = prev; continue; } prev = fin(prev) ? a * v + (1 - a) * prev : v; out[i] = prev; }
  return out;
}
/** lrb.rma: ilk n değerin ortalamasıyla tohumlanan Wilder RMA (n-1. bardan itibaren). */
export function rmaSeed(v: number[], n: number): number[] {
  const out = new Array<number>(v.length).fill(NaN);
  if (v.length < n) return out;
  const w = v.slice(0, n).filter(fin); out[n - 1] = w.length ? w.reduce((s, x) => s + x, 0) / w.length : NaN;
  const a = 1 / n; for (let i = n; i < v.length; i++) out[i] = a * v[i] + (1 - a) * out[i - 1];
  return out;
}
export function smaW(x: number[], n: number): number[] {
  const out = new Array<number>(x.length).fill(NaN);
  for (let i = n - 1; i < x.length; i++) { let s = 0, ok = true; for (let j = i - n + 1; j <= i; j++) { if (!fin(x[j])) { ok = false; break; } s += x[j]; } if (ok) out[i] = s / n; }
  return out;
}
/** popülasyon std (ddof=0) — Pine ta.stdev */
export function stdevPop(x: number[], n: number): number[] {
  const out = new Array<number>(x.length).fill(NaN);
  for (let i = n - 1; i < x.length; i++) {
    let s = 0, ok = true; for (let j = i - n + 1; j <= i; j++) { if (!fin(x[j])) { ok = false; break; } s += x[j]; }
    if (!ok) continue; const m = s / n; let q = 0; for (let j = i - n + 1; j <= i; j++) q += (x[j] - m) ** 2; out[i] = Math.sqrt(q / n);
  }
  return out;
}
export function alma(x: number[], n: number, offset = 0.85, sigma = 6): number[] {
  const m = offset * (n - 1), s = n / sigma, w: number[] = []; for (let i = 0; i < n; i++) w.push(Math.exp(-((i - m) ** 2) / (2 * s * s)));
  const ws = w.reduce((a, b) => a + b, 0), out = new Array<number>(x.length).fill(NaN);
  for (let t = n - 1; t < x.length; t++) { let acc = 0; for (let i = 0; i < n; i++) acc += w[i] * x[t - (n - 1) + i]; out[t] = acc / ws; }
  return out;
}
/** True range, tr[0] = h-l (lrb / dualband.atr14) */
export function trueRange(b: WBar[]): number[] {
  return b.map((x, i) => (i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close))));
}
/** dualband.atr14 = lrb.rma(TR,14) */
export const atr14Rma = (b: WBar[]) => rmaSeed(trueRange(b), 14);

/** Uptrick Liquid Reversal Bands (lrb.compute) — yalnız alt/orta/üst bant. */
export function lrbBands(b: WBar[], fairLen: number, zLen: number, smoothLen: number, upperMult = 2.4, lowerMult = 2.4) {
  const c = b.map((x) => x.close), h = b.map((x) => x.high), l = b.map((x) => x.low);
  const e1 = emaP(c, fairLen), a1 = alma(c, fairLen), fairRaw = c.map((_, i) => e1[i] * 0.55 + a1[i] * 0.45);
  const fair = emaP(fairRaw, Math.max(1, Math.floor(smoothLen / 2)));
  const dev = c.map((x, i) => x - fair[i]), devStd = stdevPop(dev, zLen);
  const atr = rmaSeed(trueRange(b), 14), absDev = emaP(dev.map(Math.abs), zLen), rangeE = emaP(h.map((x, i) => x - l[i]), smoothLen);
  const base = c.map((_, i) => devStd[i] * 0.6 + atr[i] * 0.25 + absDev[i] * 0.1 + rangeE[i] * 0.05);
  const width = emaP(base, smoothLen);
  return { lower: fair.map((f, i) => f - width[i] * lowerMult), mid: fair, upper: fair.map((f, i) => f + width[i] * upperMult) };
}
export function bbBands(b: WBar[], n: number) {
  const c = b.map((x) => x.close), m = smaW(c, n), sd = stdevPop(c, n);
  return { lower: m.map((x, i) => x - 2 * sd[i]), mid: m, upper: m.map((x, i) => x + 2 * sd[i]) };
}
function band(b: WBar[], n: number, typ: "BB" | "LRB") {
  return typ === "BB" ? bbBands(b, n) : lrbBands(b, Math.max(2, Math.floor(n / 2)), n, Math.max(2, Math.round(0.18 * n)));
}
/** cooldown: bir sinyalden sonra cd bar içinde yenisi yok (dualband.cooldown) */
export function cooldown(sig: boolean[], cd = 10): boolean[] {
  const out = sig.map(() => false); let last = -1e9;
  sig.forEach((s, i) => { if (s && i - last >= cd) { out[i] = true; last = i; } });
  return out;
}
/** Dual band AL: hızlı alt bandın içine geri giriş + önceki barda yavaş %B <= z, 10 bar cooldown (dualband.base + buy). */
export function dualBandBuy(b: WBar[], slow: number, fast: number, typ: "BB" | "LRB", z: number) {
  const S = band(b, slow, typ), F = band(b, fast, typ), c = b.map((x) => x.close);
  const pb = c.map((x, i) => (x - S.lower[i]) / (S.upper[i] - S.lower[i]));
  const raw = c.map((x, i) => i > 0 && c[i - 1] <= F.lower[i - 1] && x > F.lower[i] && pb[i - 1] <= z);
  return { buy: cooldown(raw, 10), fastLow: F.lower, fastUp: F.upper, pbPrev: pb.map((_, i) => (i ? pb[i - 1] : NaN)) };
}

/** mdt.rsi: RMA (ilk n ortalamasıyla tohum), dl[0] = 0, l == 0 → 100 */
export function rsiMdt(c: number[], n = 14): number[] {
  const dl = c.map((x, i) => (i ? x - c[i - 1] : 0));
  const g = rmaSeed(dl.map((d) => Math.max(d, 0)), n), l = rmaSeed(dl.map((d) => Math.max(-d, 0)), n);
  return c.map((_, i) => (l[i] === 0 ? 100 : 100 - 100 / (1 + g[i] / l[i])));
}
/** combo.edge_cd: yükselen kenar + cooldown */
export function edgeCd(cond: boolean[], cd = 10): boolean[] {
  const e = cond.map((x, i) => (i === 0 ? x : x && !cond[i - 1]));
  return cooldown(e, cd);
}
/** BIST 1d RSI14 30 yukarı kırılım: RSI[i-1] < 30 <= RSI[i], ilk 30 bar yok sayılır, 10 bar cooldown */
export function rsi30Buy(b: WBar[]) {
  const r = rsiMdt(b.map((x) => x.close));
  const x = r.map((v, i) => i >= 30 && r[i - 1] < 30 && v >= 30);
  return { buy: edgeCd(x, 10), rsi: r };
}

/** EK v3 / mm.atr14: pandas ewm(alpha=1/14, adjust=False) TR (ilk barda önceki kapanış = açılış) */
export function atr14Ewm(b: WBar[]): number[] {
  const out: number[] = []; let a = NaN;
  b.forEach((x, i) => { const pc = i ? b[i - 1].close : x.open; const tr = Math.max(x.high - x.low, Math.abs(x.high - pc), Math.abs(x.low - pc)); a = Number.isNaN(a) ? tr : a + (tr - a) / 14; out.push(a); });
  return out;
}

// ---------- L/S 2s dip uyumsuzluğu (scan_ls.py) ----------
export const LS_P = { L: 3, R: 3, MINGAP: 5, MAXGAP: 50, RANGE_N: 50, RANGE_Q: 0.3, MAXAGE: 2 };
export function lsPivotsLow(l: number[]): number[] {
  const p: number[] = [];
  for (let i = LS_P.L; i < l.length - LS_P.R; i++) {
    let mn = Infinity, cnt = 0;
    for (let j = i - LS_P.L; j <= i + LS_P.R; j++) mn = Math.min(mn, l[j]);
    for (let j = i - LS_P.L; j <= i + LS_P.R; j++) if (l[j] === l[i]) cnt++;
    if (l[i] === mn && cnt === 1) p.push(i);
  }
  return p;
}
export function lsPrevPivot(pv: number[], p: number): number | null {
  const prev = pv.filter((x) => x < p).reverse();
  for (const q of prev) { if (p - q < LS_P.MINGAP) continue; if (p - q > LS_P.MAXGAP) return null; return q; }
  return null;
}
export type LsStrength = "GUCLU" | "ORTA" | "ZAYIF";
export const lsStrength = (rr: number, bb: boolean): LsStrength => (rr >= 10 && bb ? "GUCLU" : rr >= 5 || bb ? "ORTA" : "ZAYIF");
export interface LsDiv { p: number; q: number; c: number; age: number; ratio: number; prev: number; rr: number; bb: boolean; strength: LsStrength; stop: number; target: number; rpos: number }
/** Kapanmış 2s mumlar + aynı mum açılışına damgalı oran → onaylı (KESIN) uyumsuzluklar, yaş 0..MAXAGE */
export function lsDivergences(b: WBar[], ratio: (number | null)[], maxAge = LS_P.MAXAGE): LsDiv[] {
  const n = b.length, l = b.map((x) => x.low), h = b.map((x) => x.high), c = b.map((x) => x.close);
  const bb = bbBands(b, 20);
  const rpos = c.map((x, i) => { if (i < LS_P.RANGE_N - 1) return NaN; let hh = -Infinity, ll = Infinity; for (let j = i - LS_P.RANGE_N + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); } return (x - ll) / (hh - ll); });
  const pv = lsPivotsLow(l), out: LsDiv[] = [];
  for (const p of pv) {
    const cc = p + LS_P.R, age = n - 1 - cc; if (age > maxAge) continue;
    const q = lsPrevPivot(pv, p); if (q === null) continue;
    const a = ratio[q], r = ratio[p];
    if (a == null || r == null || !fin(a) || !fin(r) || !(l[p] < l[q] && r > a)) continue;
    if (!(rpos[cc] <= LS_P.RANGE_Q)) continue;
    const isBb = l[p] <= bb.lower[p], rr = 100 * (r / a - 1);
    out.push({ p, q, c: cc, age, ratio: r, prev: a, rr, bb: isBb, strength: lsStrength(rr, isBb), stop: l[p], target: bb.upper[n - 1], rpos: rpos[cc] });
  }
  return out;
}
