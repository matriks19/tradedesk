/**
 * KAL Hibrit — 0.7·corr(log fiyat, zaman, 14) + 0.3·corr(getiri, getiri[1], 14) → 0-100, EMA3.
 * Sinyal = EMA9, Histogram = KAL − sinyal, Bant = 50 mum ort ± 1.5σ.
 * Uyumsuzluk: fiyat daha düşük dip + KAL daha yüksek dip (pivot 3/3, ≤50 mum).
 */
import type { Candle } from "@/lib/types";

export type KalHibritCond =
  | "kal_long" | "kal_band_carry" | "kal_short" | "kal_ema_up" | "kal_ema_dn" | "kal_hist_div"
  | "kal_above_ema" | "kal_below_ema" | "kal_in_band" | "kal_above_band" | "kal_below_band";
export const ALL_KAL_HIBRIT_CONDS: KalHibritCond[] = ["kal_long", "kal_band_carry", "kal_short", "kal_ema_up", "kal_ema_dn", "kal_hist_div", "kal_above_ema", "kal_below_ema", "kal_in_band", "kal_above_band", "kal_below_band"];
export const DEFAULT_KAL_HIBRIT_CONDS: KalHibritCond[] = ["kal_long", "kal_short", "kal_ema_up", "kal_ema_dn"];
export const KAL_HIBRIT_BEAR_CONDS = new Set<KalHibritCond>(["kal_short", "kal_ema_dn", "kal_below_ema", "kal_above_band"]);
export const KAL_HIBRIT_STATE_CONDS = new Set<KalHibritCond>(["kal_above_ema", "kal_below_ema", "kal_in_band", "kal_above_band", "kal_below_band"]);
export const KAL_HIBRIT_COND_LABEL: Record<KalHibritCond, string> = {
  kal_long: "KAL LONG (alt bant ↑)", kal_band_carry: "Bant Taşıma AL", kal_short: "KAL SHORT (üst bant ↓)", kal_ema_up: "EMA9 Kesiş AL", kal_ema_dn: "KAL × EMA9 ↓",
  kal_hist_div: "Hist+ & Uyumsuzluk AL", kal_above_ema: "KAL > EMA9", kal_below_ema: "KAL < EMA9",
  kal_in_band: "KAL bant içinde", kal_above_band: "KAL üst bant üstü", kal_below_band: "KAL alt bant altı",
};
export const KAL_HIBRIT_MIN_BARS = 80;
export const KAL_HIBRIT_FETCH_LIMIT = 500;

function rollCorr(a: number[], b: number[], w: number): number[] {
  const n = a.length, o = new Array<number>(n).fill(NaN);
  for (let i = w - 1; i < n; i++) {
    let sa = 0, sb = 0, ok = true;
    for (let j = i - w + 1; j <= i; j++) { if (!Number.isFinite(a[j]!) || !Number.isFinite(b[j]!)) { ok = false; break; } sa += a[j]!; sb += b[j]!; }
    if (!ok) continue;
    const ma = sa / w, mb = sb / w; let c = 0, va = 0, vb = 0;
    for (let j = i - w + 1; j <= i; j++) { const x = a[j]! - ma, y = b[j]! - mb; c += x * y; va += x * x; vb += y * y; }
    o[i] = va > 0 && vb > 0 ? c / Math.sqrt(va * vb) : 0;
  }
  return o;
}
function ewm(a: number[], span: number): number[] {
  const al = 2 / (span + 1), o = new Array<number>(a.length).fill(NaN); let p = NaN;
  for (let i = 0; i < a.length; i++) { const v = a[i]!; if (!Number.isFinite(v)) continue; p = Number.isFinite(p) ? al * v + (1 - al) * p : v; o[i] = p; }
  return o;
}

export type KalHibritResult = { k: number[]; sig: number[]; hist: number[]; up: number[]; lo: number[]; mid: number[]; ev: Record<KalHibritCond, boolean[]> };

export function computeKalHibrit(cs: Candle[], W = 14, B = 50, mult = 1.5, piv = 3, maxLb = 50): KalHibritResult {
  const n = cs.length, lc = cs.map((c) => Math.log(c.close)), t = cs.map((_, i) => i);
  const r = lc.map((v, i) => (i ? v - lc[i - 1]! : NaN)), r1 = r.map((_, i) => (i ? r[i - 1]! : NaN));
  const rt = rollCorr(lc, t, W), ra = rollCorr(r, r1, W);
  const raw = rt.map((v, i) => (Number.isFinite(v) ? 50 + 50 * Math.max(-1, Math.min(1, 0.7 * v + 0.3 * (Number.isFinite(ra[i]!) ? ra[i]! : 0))) : NaN));
  const k = ewm(raw, 3), sig = ewm(k, 9), hist = k.map((v, i) => v - sig[i]!);
  const mid = new Array<number>(n).fill(NaN), sd = new Array<number>(n).fill(NaN);
  for (let i = B - 1; i < n; i++) { let s = 0, c = 0; for (let j = i - B + 1; j <= i; j++) if (Number.isFinite(k[j]!)) { s += k[j]!; c++; } if (c < B) continue; const m = s / B; let q = 0; for (let j = i - B + 1; j <= i; j++) q += (k[j]! - m) ** 2; mid[i] = m; sd[i] = Math.sqrt(q / (B - 1)); }
  const up = mid.map((m, i) => m + mult * sd[i]!), lo = mid.map((m, i) => m - mult * sd[i]!);
  const ev = Object.fromEntries(ALL_KAL_HIBRIT_CONDS.map((c) => [c, new Array<boolean>(n).fill(false)])) as KalHibritResult["ev"];
  const f = (x: number) => Number.isFinite(x);
  // pivot dipleri (onay piv mum sonra)
  const lows: { bar: number; p: number; k: number }[] = []; let lastDiv = -Infinity;
  for (let i = 1; i < n; i++) {
    const c = i - piv;
    if (c - piv >= 0 && f(k[c]!)) {
      let isPiv = true; for (let j = c - piv; j <= c + piv; j++) if (j !== c && cs[j]!.low <= cs[c]!.low && (j > c || cs[j]!.low < cs[c]!.low)) { isPiv = false; break; }
      if (isPiv) {
        const prev = lows[lows.length - 1];
        if (prev && c - prev.bar <= maxLb && cs[c]!.low < prev.p && k[c]! > prev.k) lastDiv = i;
        lows.push({ bar: c, p: cs[c]!.low, k: k[c]! });
      }
    }
    if (!f(k[i]!) || !f(k[i - 1]!)) continue;
    const bandOk = f(up[i]!) && f(up[i - 1]!);
    ev.kal_long[i] = bandOk && k[i - 1]! < lo[i - 1]! && k[i]! >= lo[i]!;
    ev.kal_short[i] = bandOk && k[i - 1]! > up[i - 1]! && k[i]! <= up[i]!;
    ev.kal_ema_up[i] = f(sig[i - 1]!) && hist[i - 1]! <= 0 && hist[i]! > 0;
    ev.kal_ema_dn[i] = f(sig[i - 1]!) && hist[i - 1]! >= 0 && hist[i]! < 0;
    ev.kal_hist_div[i] = ev.kal_ema_up[i] && i - lastDiv <= maxLb;
    ev.kal_above_ema[i] = hist[i]! > 0;
    ev.kal_below_ema[i] = hist[i]! < 0;
    if (f(up[i]!)) { ev.kal_above_band[i] = k[i]! > up[i]!; ev.kal_below_band[i] = k[i]! < lo[i]!; ev.kal_in_band[i] = !ev.kal_above_band[i] && !ev.kal_below_band[i]; }
  }
  return { k, sig, hist, up, lo, mid, ev };
}

export function kalHibritScan(cs: Candle[], conds: KalHibritCond[], maxBarsAgo: number) {
  if (cs.length < KAL_HIBRIT_MIN_BARS) return [];
  const R = computeKalHibrit(cs), last = cs.length - 1, out: { cond: KalHibritCond; barsAgo: number; note: string }[] = [];
  for (const cond of conds) {
    if (cond === "kal_band_carry") continue;
    const lim = KAL_HIBRIT_STATE_CONDS.has(cond) ? 0 : maxBarsAgo;
    for (let ago = 0; ago <= lim; ago++) {
      const i = last - ago; if (i < 1) break;
      if (R.ev[cond][i]) {
        out.push({ cond, barsAgo: ago, note: `${KAL_HIBRIT_COND_LABEL[cond]} · KAL ${R.k[i]!.toFixed(1)} / EMA9 ${R.sig[i]!.toFixed(1)} / bant ${R.lo[i]!.toFixed(1)}–${R.up[i]!.toFixed(1)} (−${ago})` });
        break;
      }
    }
  }
  if (conds.includes("kal_band_carry")) {
    // Alt banttan giriş, üst banda henüz ulaşmamış aktif pozisyon (≤50 mum)
    for (let i = last; i >= Math.max(1, last - 50); i--) {
      if (Number.isFinite(R.up[i]!) && R.k[i]! >= R.up[i]!) break;
      if (R.ev.kal_long[i]) { const ago = last - i; out.push({ cond: "kal_band_carry", barsAgo: ago, note: `Bant Taşıma AL aktif · giriş −${ago} · KAL ${R.k[last]!.toFixed(1)} → üst ${R.up[last]!.toFixed(1)}` }); break; }
    }
  }
  return out;
}
