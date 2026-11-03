/**
 * CCI20 boğa uyumsuzluğu (günlük) — osc-lab patlama-gucu-20261102/run_mmdiv.py "CCI_55" birebir TS karşılığı. İşlem/emir YOK, yalnız izleme.
 *  CCI = (close − SMA20) / (0.015 × ortalama mutlak sapma 20).
 *  Pivot dip (low) sol 5 / sağ 5; önceki pivot dip 5–60 mum geride; fiyat daha düşük dip, CCI daha yüksek dip.
 *  Sinyal = onay mumu (pivot + 5) kapanışında; yalnız ≤ i barlar kullanılır (ileriye bakmaz).
 *  Test (long80 1g, 66 coin): N 455, ort +%1.56/işlem, PF 1.32, IS +%2.00 / OOS +%1.44, p 0.002 (stop 2 ATR, TP +%10, 100 mum).
 */
import type { WBar } from "./watchInd";

export const CCIDIV = { n: 20, L: 5, R: 5, lbMin: 5, lbMax: 60, atrK: 2, tp: 0.1 } as const;

export function cci(c: number[], n = 20): number[] {
  const out = new Array<number>(c.length).fill(NaN);
  for (let i = n - 1; i < c.length; i++) {
    let s = 0; for (let j = i - n + 1; j <= i; j++) s += c[j];
    const m = s / n; let md = 0; for (let j = i - n + 1; j <= i; j++) md += Math.abs(c[j] - m); md /= n;
    out[i] = md > 0 ? (c[i] - m) / (0.015 * md) : NaN;
  }
  return out;
}

export interface CciDivHit { i: number; p: number; p0: number; low: number; low0: number; cci: number; cci0: number }

/** Boğa uyumsuzluk olayları (i = onay mumu = p + R). */
export function cciBullDiv(bars: WBar[], o: Partial<typeof CCIDIV> = {}): { hits: CciDivHit[]; cci: number[] } {
  const P = { ...CCIDIV, ...o }, n = bars.length, lo = bars.map((b) => b.low), x = cci(bars.map((b) => b.close), P.n), hits: CciDivHit[] = [];
  let pb = -1, pp = 0, po = 0;
  for (let i = P.L + P.R; i < n; i++) {
    const p = i - P.R, v = lo[p]; if (!Number.isFinite(x[p])) continue;
    let isp = true;
    for (let j = p - P.L; j <= p + P.R; j++) { if (j === p) continue; if (lo[j] < v || (j < p && lo[j] === v)) { isp = false; break; } }
    if (!isp) continue;
    if (pb >= 0 && p - pb >= P.lbMin && p - pb <= P.lbMax && v < pp && x[p] > po) hits.push({ i, p, p0: pb, low: v, low0: pp, cci: x[p], cci0: po });
    pb = p; pp = v; po = x[p];
  }
  return { hits, cci: x };
}
