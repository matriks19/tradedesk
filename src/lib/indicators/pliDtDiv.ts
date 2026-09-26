/**
 * PLI-DT Uyumsuzluk — "PLI Trend Dip/Tepe" (Pine) + osilatör uyumsuzluğu.
 *
 *   upper = PLI(src, len, 100 − x), lower = PLI(src, len, x)   (TV type-7, median.ts)
 *   pos   = rng > 0 ? (src − lower) / rng : 0.5                (rng = upper − lower; na → 0.5)
 *
 * T/D durum makinesi (Pine `var`, bar bar, geriye döngü yok):
 *   1. trend ≠ −1 ve (na(hiP) veya high > hiP) → hiP = high, hiB = bar
 *   2. trend ≠  1 ve (na(loP) veya low  < loP) → loP = low,  loB = bar
 *   3. trend ≠ −1 ve pos ≤ topTh ve hiP var ve (hiP/low − 1)·100 ≥ minSwing
 *        → T (hiB, hiP); trend = −1; loP = low, loB = bar; hiP = na
 *   4. aksi halde trend ≠ 1 ve pos ≥ botTh ve loP var ve (high/loP − 1)·100 ≥ minSwing
 *        → D (loB, loP); trend = 1;  hiP = high, hiB = bar; loP = na
 *
 * Uyumsuzluk:
 *   - Klasik/gizli: ortak osilatör motoru (computeOscDivergence) — osilatör = pos, pivotlar pos
 *     üzerinde, fiyat = low (dip) / high (tepe); pivot sol/sağ + range (varsayılan 5/3/5–60,
 *     rangeLower 5 — eski "50 mum" hatası yok).
 *   - Onaylı D uyumsuz: D onayında loP < önceki onaylı D fiyatı ve pos[loB] > pos[önceki D mumu].
 *   - Onaylı T uyumsuz: T onayında hiP > önceki onaylı T fiyatı ve pos[hiB] < pos[önceki T mumu].
 * Sinyaller onay mumunda (klasik: pivot + lbR, D/T: botSig/topSig mumu).
 */
import type { Candle } from "@/lib/types";
import { percentileLinearInterpolation } from "./median";
import { computeOscDivergence, LIST_SCAN_DIV_OPTS } from "./oscDivergence";
import { pliDtDivMinBars, pliDtDivFetchLimit } from "./pliDtDivLimits";

export { pliDtDivMinBars, pliDtDivFetchLimit };

export interface PliDtDivOpts {
  length?: number;
  x?: number;
  topTh?: number;
  botTh?: number;
  minSwing?: number;
  lbL?: number;
  lbR?: number;
  rangeLower?: number;
  rangeUpper?: number;
}

export const PLI_DT_DIV_DEFAULTS = {
  length: 50,
  x: 5,
  topTh: 0.3,
  botTh: 0.7,
  minSwing: 3,
  lbL: LIST_SCAN_DIV_OPTS.lbL,
  lbR: LIST_SCAN_DIV_OPTS.lbR,
  rangeLower: LIST_SCAN_DIV_OPTS.rangeLower,
  rangeUpper: LIST_SCAN_DIV_OPTS.rangeUpper,
};

export type PliDtDivCond = "pdt_bull" | "pdt_bear" | "pdt_hbull" | "pdt_hbear" | "pdt_d_div" | "pdt_t_div";
export const ALL_PLI_DT_DIV_CONDS: PliDtDivCond[] = ["pdt_bull", "pdt_bear", "pdt_hbull", "pdt_hbear", "pdt_d_div", "pdt_t_div"];
export const DEFAULT_PLI_DT_DIV_CONDS: PliDtDivCond[] = ["pdt_bull", "pdt_bear"];
export const PLI_DT_DIV_BEAR_CONDS = new Set<PliDtDivCond>(["pdt_bear", "pdt_hbear", "pdt_t_div"]);
export const PLI_DT_DIV_COND_LABEL: Record<PliDtDivCond, string> = {
  pdt_bull: "Klasik AL",
  pdt_bear: "Klasik SAT",
  pdt_hbull: "Gizli AL",
  pdt_hbear: "Gizli SAT",
  pdt_d_div: "Onaylı D uyumsuz",
  pdt_t_div: "Onaylı T uyumsuz",
};
/** Varsayılan parametrelerle (kart sabit gösterimi için) */
export const PLI_DT_DIV_MIN_BARS = pliDtDivMinBars();
export const PLI_DT_DIV_FETCH_LIMIT = pliDtDivFetchLimit();

export interface PliDtPivot {
  top: boolean;
  /** Pivot (label) bar */
  bar: number;
  price: number;
  /** Confirm bar (topSig/botSig) */
  at: number;
}

export interface PliDtLink {
  cond: PliDtDivCond;
  at: number;
  from: number;
  to: number;
  fromPrice: number;
  toPrice: number;
  fromPos: number;
  toPos: number;
}

export interface PliDtDivResult {
  upper: (number | null)[];
  lower: (number | null)[];
  pos: number[];
  /** Trend after the bar's state update (1 / −1 / 0) */
  trend: number[];
  topSig: boolean[];
  botSig: boolean[];
  pivots: PliDtPivot[];
  sig: Record<PliDtDivCond, boolean[]>;
  links: PliDtLink[];
}

export function resolvePliDtDivOpts(opts: PliDtDivOpts = {}): Required<PliDtDivOpts> {
  const o = { ...PLI_DT_DIV_DEFAULTS };
  for (const [k, v] of Object.entries(opts)) {
    if (v !== undefined && v !== null && Number.isFinite(Number(v))) (o as Record<string, number>)[k] = Number(v);
  }
  return {
    length: Math.max(2, Math.floor(o.length)),
    x: Math.max(0, Math.min(50, o.x)),
    topTh: o.topTh,
    botTh: o.botTh,
    minSwing: Math.max(0, o.minSwing),
    lbL: Math.max(1, Math.floor(o.lbL)),
    lbR: Math.max(1, Math.floor(o.lbR)),
    rangeLower: Math.max(0, Math.floor(o.rangeLower)),
    rangeUpper: Math.max(1, Math.floor(o.rangeUpper)),
  };
}

export function computePliDtDiv(candles: Candle[], opts: PliDtDivOpts = {}, source?: number[]): PliDtDivResult {
  const o = resolvePliDtDivOpts(opts);
  const n = candles.length;
  const src = source ?? candles.map((c) => c.close);
  const upper = percentileLinearInterpolation(src, o.length, 100 - o.x);
  const lower = percentileLinearInterpolation(src, o.length, o.x);
  const pos: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = upper[i], l = lower[i];
    const rng = u != null && l != null ? u - l : null;
    pos[i] = rng != null && rng > 0 ? (src[i]! - (l as number)) / rng : 0.5;
  }

  const sig = Object.fromEntries(ALL_PLI_DT_DIV_CONDS.map((c) => [c, new Array<boolean>(n).fill(false)])) as Record<PliDtDivCond, boolean[]>;
  const trendArr: number[] = new Array(n).fill(0);
  const topSig: boolean[] = new Array(n).fill(false);
  const botSig: boolean[] = new Array(n).fill(false);
  const pivots: PliDtPivot[] = [];
  const links: PliDtLink[] = [];

  let trend = 0;
  let hiP: number | null = null, hiB = -1;
  let loP: number | null = null, loB = -1;
  let prevD: { bar: number; price: number } | null = null;
  let prevT: { bar: number; price: number } | null = null;
  for (let i = 0; i < n; i++) {
    const h = candles[i]!.high, l = candles[i]!.low;
    if (trend !== -1 && (hiP == null || h > hiP)) { hiP = h; hiB = i; }
    if (trend !== 1 && (loP == null || l < loP)) { loP = l; loB = i; }
    const p = pos[i]!;
    if (trend !== -1 && p <= o.topTh && hiP != null && (hiP / l - 1) * 100 >= o.minSwing) {
      topSig[i] = true;
      pivots.push({ top: true, bar: hiB, price: hiP, at: i });
      if (prevT && hiP > prevT.price && pos[hiB]! < pos[prevT.bar]!) {
        sig.pdt_t_div[i] = true;
        links.push({ cond: "pdt_t_div", at: i, from: prevT.bar, to: hiB, fromPrice: prevT.price, toPrice: hiP, fromPos: pos[prevT.bar]!, toPos: pos[hiB]! });
      }
      prevT = { bar: hiB, price: hiP };
      trend = -1;
      loP = l; loB = i;
      hiP = null;
    } else if (trend !== 1 && p >= o.botTh && loP != null && (h / loP - 1) * 100 >= o.minSwing) {
      botSig[i] = true;
      pivots.push({ top: false, bar: loB, price: loP, at: i });
      if (prevD && loP < prevD.price && pos[loB]! > pos[prevD.bar]!) {
        sig.pdt_d_div[i] = true;
        links.push({ cond: "pdt_d_div", at: i, from: prevD.bar, to: loB, fromPrice: prevD.price, toPrice: loP, fromPos: pos[prevD.bar]!, toPos: pos[loB]! });
      }
      prevD = { bar: loB, price: loP };
      trend = 1;
      hiP = h; hiB = i;
      loP = null;
    }
    trendArr[i] = trend;
  }

  // Klasik / gizli — ortak motor (osilatör = pos)
  const div = computeOscDivergence(candles, pos, {
    lbL: o.lbL,
    lbR: o.lbR,
    rangeLower: o.rangeLower,
    rangeUpper: o.rangeUpper,
  });
  const KIND_COND = { bull: "pdt_bull", bear: "pdt_bear", hiddenBull: "pdt_hbull", hiddenBear: "pdt_hbear" } as const;
  for (const lk of div.links) {
    const cond = KIND_COND[lk.kind];
    sig[cond][lk.at] = true;
    const low = lk.kind === "bull" || lk.kind === "hiddenBull";
    const pf = low ? candles[lk.from]!.low : candles[lk.from]!.high;
    const pt = low ? candles[lk.to]!.low : candles[lk.to]!.high;
    links.push({ cond, at: lk.at, from: lk.from, to: lk.to, fromPrice: pf, toPrice: pt, fromPos: pos[lk.from]!, toPos: pos[lk.to]! });
  }
  links.sort((a, b) => a.at - b.at);

  return { upper, lower, pos, trend: trendArr, topSig, botSig, pivots, sig, links };
}

export type PliDtDivHit = { cond: PliDtDivCond; barsAgo: number; note: string };

/** Son `maxBarsAgo` mum içindeki en yeni sinyal (koşul başına bir). */
export function pliDtDivScan(
  candles: Candle[],
  conds: PliDtDivCond[],
  maxBarsAgo: number,
  opts: PliDtDivOpts = {}
): PliDtDivHit[] {
  const o = resolvePliDtDivOpts(opts);
  if (!conds.length || candles.length < pliDtDivMinBars(o.length, o.lbL, o.lbR)) return [];
  const r = computePliDtDiv(candles, o);
  const last = candles.length - 1;
  const out: PliDtDivHit[] = [];
  for (const cond of conds) {
    const arr = r.sig[cond];
    if (!arr) continue;
    for (let ago = 0; ago <= maxBarsAgo; ago++) {
      const i = last - ago;
      if (i < 0) break;
      if (!arr[i]) continue;
      const lk = r.links.find((x) => x.cond === cond && x.at === i);
      const bit = lk
        ? ` pos ${lk.fromPos.toFixed(2)}→${lk.toPos.toFixed(2)} (pivot −${last - lk.to})`
        : "";
      out.push({ cond, barsAgo: ago, note: `PLI-DT ${PLI_DT_DIV_COND_LABEL[cond]}${bit} (−${ago})` });
      break;
    }
  }
  return out;
}
