/**
 * LS Dip Uyumsuzluğu (near-bottom L/S POSITION bullish divergence) — /workspace/ls-dip/bottom.py + scanner.py --mode bottom30 ile birebir.
 * Kurallar (BOT_RULES): DBL-atr2-200, DBL-lowest200, TRI-lowest336 (multi_div + dibe yakınlık filtresi),
 * DBL-bdiv96, TRI-bdiv96 (son pivot 96 mumun en düşüğü; önceki dip = [j-96, j-6] aralığındaki en düşük pivot;
 * fiyat DAHA DÜŞÜK dip, L/S POSITION DAHA YÜKSEK dip). Pivot L2/R2, onay = son pivot + 2 (kapanmış mum, repaint yok).
 */
import { multiDiv, pivotsLow } from "./lsDivMacd";

export type LsBotBar = { time: number; high: number; low: number; close: number }; // time = açılış (sn)
export type LsBotRule = { name: string; k: 2 | 3; filt: "atr2" | "lowest" | "bdiv"; N: number };
export const LS_BOT_RULES: LsBotRule[] = [
  { name: "DBL-atr2-200", k: 2, filt: "atr2", N: 200 },
  { name: "DBL-lowest200", k: 2, filt: "lowest", N: 200 },
  { name: "TRI-lowest336", k: 3, filt: "lowest", N: 336 },
  { name: "DBL-bdiv96", k: 2, filt: "bdiv", N: 96 },
  { name: "TRI-bdiv96", k: 3, filt: "bdiv", N: 96 },
];
export type LsBotCond = "lsb_2h" | "lsb_4h";
export const ALL_LS_BOT_CONDS: LsBotCond[] = ["lsb_2h", "lsb_4h"];
export const DEFAULT_LS_BOT_CONDS: LsBotCond[] = ["lsb_2h", "lsb_4h"];
export const LS_BOT_COND_LABEL: Record<LsBotCond, string> = { lsb_2h: "LS Dip Uyumsuzluk 2s", lsb_4h: "LS Dip Uyumsuzluk 4s" };
export const LS_BOT_COND_TF: Record<LsBotCond, "2h" | "4h"> = { lsb_2h: "2h", lsb_4h: "4h" };

export type LsBotHit = {
  conf: number; confOpen: number; barsAgo: number; rules: string[]; k: number;
  pivots: number[]; pivotTimes: number[]; priceLows: number[]; ratioLows: number[];
};

function atr(b: LsBotBar[], n = 14): number[] {
  const o: number[] = new Array(b.length), a = 1 / n;
  for (let i = 0; i < b.length; i++) {
    const tr = i === 0 ? b[i].high - b[i].low : Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close));
    o[i] = i === 0 ? tr : a * tr + (1 - a) * o[i - 1];
  }
  return o;
}
function minL(b: LsBotBar[], s: number, e: number) { let m = Infinity; for (let i = s; i <= e; i++) m = Math.min(m, b[i].low); return m; }

/** b: kapanmış mumlar (eski→yeni), ratio: timestamp(ms)→L/S POSITION. lookback: son kaç kapanmış mumda onaylananlar. */
export function lsBottomEval(b: LsBotBar[], ratio: Map<number, number>, lookback = 2, rules = LS_BOT_RULES): LsBotHit[] {
  const n = b.length; if (n < 30) return [];
  const r = b.map((x) => ratio.get(x.time * 1000) ?? NaN);
  const dIdx: number[] = []; for (let i = 0; i < n; i++) if (!Number.isNaN(r[i])) dIdx.push(i);
  if (dIdx.length < 20) return [];
  const A = atr(b);
  const out: LsBotHit[] = [];
  const add = (c: number, P: number[], name: string, k: number) => {
    if (c < n - lookback) return;
    const h = out.find((x) => x.conf === c && x.pivots.join() === P.join());
    if (h) { h.rules.push(name); return; }
    out.push({ conf: c, confOpen: b[c].time, barsAgo: n - 1 - c, rules: [name], k, pivots: P, pivotTimes: P.map((p) => b[p].time), priceLows: P.map((p) => b[p].low), ratioLows: P.map((p) => r[p]) });
  };
  // multi_div + dibe yakınlık (setups)
  const dl = dIdx.map((i) => b[i].low), dr = dIdx.map((i) => r[i]);
  const md: Record<number, { conf: number; P: number[] }[]> = { 2: multiDiv(dl, dr, 2), 3: multiDiv(dl, dr, 3) };
  // bottom_div (bdiv): pivotlar tam seride
  const lo = b.map((x) => x.low), piv = pivotsLow(lo, 2, 2);
  const prior = (j: number, N: number, gmin = 6) => {
    let best = -1;
    for (const p of piv) if (p >= j - N && p <= j - gmin && !Number.isNaN(r[p]) && (best < 0 || lo[p] < lo[best])) best = p;
    return best < 0 ? null : best;
  };
  for (const ru of rules) {
    if (ru.filt === "bdiv") {
      for (const j of piv) {
        const c = j + 2;
        if (c >= n || j - ru.N < 0 || Number.isNaN(r[j])) continue;
        if (lo[j] > minL(b, j - ru.N + 1, j) + 1e-12) continue;
        const i = prior(j, ru.N); if (i === null || !(lo[j] < lo[i] && r[j] > r[i])) continue;
        let P = [i, j];
        if (ru.k === 3) { const h = prior(i, ru.N); if (h === null || !(lo[i] < lo[h] && r[i] > r[h])) continue; P = [h, i, j]; }
        add(c, P, ru.name, ru.k);
      }
      continue;
    }
    for (const e of md[ru.k]) {
      const c = dIdx[e.conf], P = e.P.map((p) => dIdx[p]), j = P[P.length - 1], N = ru.N;
      if (j - N + 1 < 0) continue;
      if (ru.filt === "lowest") { if (!(lo[j] <= minL(b, j - N + 1, j) + 1e-12)) continue; }
      else { if (c - N + 1 < 0) continue; if (!(b[c].close - minL(b, c - N + 1, c) <= 2 * A[c])) continue; }
      add(c, P, ru.name, ru.k);
    }
  }
  return out.sort((x, y) => y.conf - x.conf || y.k - x.k);
}
