/**
 * PLI± DMI Hibrit Dip/Tepe — TradeDesk port of /workspace/pine-inbox/pli_dmi_hybrid.pine.
 *
 * Layers:
 *  - PLI channel: upper = PLI(src, len, 100−x), lower = PLI(src, len, x), med = PLI(src, len, 50)
 *    (TV ta.percentile_linear_interpolation = Hyndman–Fan type 7).
 *  - PLI± direction (pliDir): d = (upper/upper[k] − 1) − (lower[k]/lower − 1),
 *    dir = d>0 ? 1 : d<0 ? −1 : (src ≥ med ? 1 : −1), yonlu = oran·dir.
 *  - DMI on price (or on the PLI bands: DM = Δbands, TR = max(|Δupper|, |Δlower|)),
 *    Wilder RMA exactly like Pine ta.rma (SMA seed); ADX turn-down = ADX peak.
 *  - Pivot state machine (alternating T/D) with running extreme trackers (no backward loops):
 *      core  T/D : ADX peak (≥ adxMin) + dominant DI + position in the extreme zone (user's PLI-DMI)
 *      early T?/D?: dir flips 1→−1 (−1→1) while the leg is not yet a top (bottom) and the swing
 *                   from the tracked high (low) ≥ earlySw %; cancelled by a new extreme
 *      comb  T!!/D!!: early and same-direction core within combWin bars (either order)
 *      weak  t/d : DI cross (optional, no alert) · pos fallback: pos crosses back through
 *                  posHi / posLo (optional, off by default, no alert)
 *  Signals fire on the confirmation bar (no lookahead); labels sit on the pivot bar.
 */
import type { Candle } from "@/lib/types";
import { percentileLinearInterpolation, pliDir } from "./median";

export interface PliDmiOpts {
  length?: number;
  x?: number;
  zone?: number;
  dmSrc?: "price" | "band";
  diLen?: number;
  adxLen?: number;
  adxMin?: number;
  look?: number;
  k?: number;
  earlySw?: number;
  combWin?: number;
  useWk?: boolean;
  usePos?: boolean;
  posLo?: number;
  posHi?: number;
  /** Extreme-tracker depth per side (Pine uses 4: candidate + 3 running trackers). */
  depth?: number;
}

export const PLI_DMI_DEFAULTS = {
  length: 50,
  x: 5,
  zone: 0.75,
  dmSrc: "price" as "price" | "band",
  diLen: 14,
  adxLen: 14,
  adxMin: 20,
  look: 3,
  k: 5,
  earlySw: 1.5,
  combWin: 5,
  useWk: true,
  usePos: false,
  posLo: 0.3,
  posHi: 0.7,
  depth: 4,
};

export type PliDmiLabel = "T!!" | "T" | "t" | "T?" | "D!!" | "D" | "d" | "D?";
export interface PliDmiPivot {
  /** Pivot (label) bar */
  bar: number;
  price: number;
  label: PliDmiLabel;
  /** Bar on which the label was created / last changed */
  confirmBar: number;
  top: boolean;
}

export type PliDmiCond = "early_top" | "early_bot" | "core_top" | "core_bot" | "comb_top" | "comb_bot";
export const ALL_PLI_DMI_CONDS: PliDmiCond[] = ["comb_top", "comb_bot", "core_top", "core_bot", "early_top", "early_bot"];
export const DEFAULT_PLI_DMI_CONDS: PliDmiCond[] = ["comb_top", "comb_bot", "core_top", "core_bot"];
export const PLI_DMI_BEAR_CONDS = new Set<PliDmiCond>(["early_top", "core_top", "comb_top"]);
export const PLI_DMI_COND_LABEL: Record<PliDmiCond, string> = {
  early_top: "Erken T?",
  early_bot: "Erken D?",
  core_top: "ADX T",
  core_bot: "ADX D",
  comb_top: "Kombine T!!",
  comb_bot: "Kombine D!!",
};
export const PLI_DMI_MIN_BARS = 80;
export const PLI_DMI_FETCH_LIMIT = 300;

export interface PliDmiResult {
  upper: (number | null)[];
  lower: (number | null)[];
  med: (number | null)[];
  oran: (number | null)[];
  dir: (number | null)[];
  yonlu: (number | null)[];
  pos: number[];
  diP: number[];
  diM: number[];
  adx: (number | null)[];
  adxTurnDn: (0 | 1)[];
  topCore: (0 | 1)[];
  botCore: (0 | 1)[];
  sig: Record<PliDmiCond, (0 | 1)[]>;
  /** One entry per fired signal: confirmation bar + pivot bar/price it refers to */
  events: { cond: PliDmiCond; at: number; pivotBar: number; price: number }[];
  pivots: PliDmiPivot[];
}

/** Pine ta.rma: SMA seed over the first `len` values, then Wilder smoothing. */
export function pineRma(src: number[], len: number): (number | null)[] {
  const out: (number | null)[] = new Array(src.length).fill(null);
  const L = Math.max(1, Math.floor(len));
  let sum: number | null = null;
  for (let i = 0; i < src.length; i++) {
    if (sum == null) {
      if (i >= L - 1) {
        let s = 0;
        for (let j = i - L + 1; j <= i; j++) s += src[j]!;
        sum = s / L;
      }
    } else {
      sum = (1 / L) * src[i]! + (1 - 1 / L) * sum;
    }
    out[i] = sum;
  }
  return out;
}

type Ext = { v: number; b: number };

export function computePliDmi(candles: Candle[], opts: PliDmiOpts = {}, source?: number[]): PliDmiResult {
  const o = { ...PLI_DMI_DEFAULTS, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)) } as typeof PLI_DMI_DEFAULTS;
  const n = candles.length;
  const len = Math.max(2, Math.floor(o.length));
  const x = Math.max(0.5, Math.min(49.5, o.x));
  const k = Math.max(0, Math.floor(o.k));
  const diLen = Math.max(1, Math.floor(o.diLen));
  const adxLen = Math.max(1, Math.floor(o.adxLen));
  const look = Math.max(1, Math.floor(o.look));
  const combWin = Math.max(0, Math.floor(o.combWin));
  const D = Math.max(2, Math.floor(o.depth));
  const H = candles.map((c) => c.high);
  const Lw = candles.map((c) => c.low);
  const C = candles.map((c) => c.close);
  const src = source ?? C;

  // PLI± (upper/lower/med/oran/dir/yonlu) — same code as the pliDir indicator
  const pd = pliDir(src, { length: len, x, k });
  const upper = pd.upper;
  const lower = pd.lower;
  const med = percentileLinearInterpolation(src, len, 50);
  const pos = src.map((s, i) => {
    const u = upper[i], l = lower[i];
    if (u == null || l == null) return 0.5;
    const r = u - l;
    return r > 0 ? (s - l) / r : 0.5;
  });

  // DMI
  const band = o.dmSrc === "band";
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  const tr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let upM: number | null = null;
    let dnM: number | null = null;
    if (i > 0) {
      if (band) {
        const u0 = upper[i], u1 = upper[i - 1], l0 = lower[i], l1 = lower[i - 1];
        if (u0 != null && u1 != null) upM = u0 - u1;
        if (l0 != null && l1 != null) dnM = l1 - l0;
      } else {
        upM = H[i]! - H[i - 1]!;
        dnM = Lw[i - 1]! - Lw[i]!;
      }
    }
    if (upM != null && dnM != null) {
      plusDM[i] = upM > dnM && upM > 0 ? upM : 0;
      minusDM[i] = dnM > upM && dnM > 0 ? dnM : 0;
    }
    if (band) {
      const u0 = upper[i], u1 = i > 0 ? upper[i - 1] : null, l0 = lower[i], l1 = i > 0 ? lower[i - 1] : null;
      tr[i] = u0 != null && u1 != null && l0 != null && l1 != null ? Math.max(Math.abs(u0 - u1), Math.abs(l0 - l1)) : 0;
    } else {
      tr[i] = i === 0 ? H[i]! - Lw[i]! : Math.max(H[i]! - Lw[i]!, Math.abs(H[i]! - C[i - 1]!), Math.abs(Lw[i]! - C[i - 1]!));
    }
  }
  const trR = pineRma(tr, diLen);
  const rP = pineRma(plusDM, diLen);
  const rM = pineRma(minusDM, diLen);
  const diP = trR.map((t, i) => (t != null && t > 0 ? (100 * rP[i]!) / t : 0));
  const diM = trR.map((t, i) => (t != null && t > 0 ? (100 * rM[i]!) / t : 0));
  const dx = diP.map((p, i) => {
    const s = p + diM[i]!;
    return s === 0 ? 0 : (100 * Math.abs(p - diM[i]!)) / s;
  });
  const adx = pineRma(dx, adxLen);

  const z = (): (0 | 1)[] => new Array(n).fill(0);
  const adxTurnDn = z(), topCore = z(), botCore = z();
  const topWk = z(), botWk = z(), posTop = z(), posBot = z(), flipDn = z(), flipUp = z();
  for (let i = 0; i < n; i++) {
    const a0 = adx[i], a1 = i >= 1 ? adx[i - 1] : null, a2 = i >= 2 ? adx[i - 2] : null;
    if (a0 != null && a1 != null && a2 != null && a0 < a1 && a1 >= a2 && a1 >= o.adxMin) adxTurnDn[i] = 1;
    if (i >= look - 1) {
      let hi = -Infinity, lo = Infinity;
      for (let j = i - look + 1; j <= i; j++) {
        hi = Math.max(hi, pos[j]!);
        lo = Math.min(lo, pos[j]!);
      }
      if (adxTurnDn[i] && diP[i]! > diM[i]! && hi >= o.zone) topCore[i] = 1;
      if (adxTurnDn[i] && diM[i]! > diP[i]! && lo <= 1 - o.zone) botCore[i] = 1;
    }
    if (i >= 1) {
      if (diP[i]! < diM[i]! && diP[i - 1]! >= diM[i - 1]!) topWk[i] = 1;
      if (diP[i]! > diM[i]! && diP[i - 1]! <= diM[i - 1]!) botWk[i] = 1;
      if (pos[i]! < o.posHi && pos[i - 1]! >= o.posHi) posTop[i] = 1;
      if (pos[i]! > o.posLo && pos[i - 1]! <= o.posLo) posBot[i] = 1;
      if (pd.dir[i - 1] === 1 && pd.dir[i] === -1) flipDn[i] = 1;
      if (pd.dir[i - 1] === -1 && pd.dir[i] === 1) flipUp[i] = 1;
    }
  }

  // ── Pivot state machine ────────────────────────────────────────────────
  const sig: Record<PliDmiCond, (0 | 1)[]> = {
    early_top: z(), early_bot: z(), core_top: z(), core_bot: z(), comb_top: z(), comb_bot: z(),
  };
  const pivots: PliDmiPivot[] = [];
  const events: PliDmiResult["events"] = [];
  const fire = (cond: PliDmiCond, i: number, pv: PliDmiPivot) => {
    sig[cond][i] = 1;
    events.push({ cond, at: i, pivotBar: pv.bar, price: pv.price });
  };
  let lastPv = 0;
  let hiP: number | null = null, hiB = -1;
  let loP: number | null = null, loB = -1;
  // hc[j]: j even = lowest low, j odd = highest high (each since the previous level's bar; level 0 since hiB)
  // lc[j]: j even = highest high, j odd = lowest low (level 0 since loB)
  const hc: Ext[] = new Array(D - 1).fill(null).map(() => ({ v: NaN, b: -1 }));
  const lc: Ext[] = new Array(D - 1).fill(null).map(() => ({ v: NaN, b: -1 }));
  let lastP: number | null = null, lastB = -1;
  let eTop: PliDmiPivot | null = null, eTopBar = -1;
  let eBot: PliDmiPivot | null = null, eBotBar = -1;
  let pendTop: PliDmiPivot | null = null;
  let pendBot: PliDmiPivot | null = null;
  const removePivot = (p: PliDmiPivot) => {
    const idx = pivots.lastIndexOf(p);
    if (idx >= 0) pivots.splice(idx, 1);
  };

  for (let i = 0; i < n; i++) {
    const hi = H[i]!, lo = Lw[i]!;
    // 1) candidates + running trackers
    if (lastPv !== 1) {
      if (hiP == null || hi > hiP) {
        hiP = hi;
        hiB = i;
        for (let j = 0; j < D - 1; j++) hc[j] = { v: j % 2 === 0 ? lo : hi, b: i };
        if (eTop) {
          removePivot(eTop);
          eTop = null;
        }
      } else {
        for (let j = 0; j < D - 1; j++) {
          const isLo = j % 2 === 0;
          if (isLo ? lo <= hc[j]!.v : hi >= hc[j]!.v) {
            for (let jj = j; jj < D - 1; jj++) hc[jj] = { v: jj % 2 === 0 ? lo : hi, b: i };
            break;
          }
        }
      }
    }
    if (lastPv !== -1) {
      if (loP == null || lo < loP) {
        loP = lo;
        loB = i;
        for (let j = 0; j < D - 1; j++) lc[j] = { v: j % 2 === 0 ? hi : lo, b: i };
        if (eBot) {
          removePivot(eBot);
          eBot = null;
        }
      } else {
        for (let j = 0; j < D - 1; j++) {
          const isHi = j % 2 === 0;
          if (isHi ? hi >= lc[j]!.v : lo <= lc[j]!.v) {
            for (let jj = j; jj < D - 1; jj++) lc[jj] = { v: jj % 2 === 0 ? hi : lo, b: i };
            break;
          }
        }
      }
    }
    const s = src[i]!;
    // 2) early warnings
    if (lastPv !== 1 && hiP != null && !eTop && flipDn[i] && ((hiP - s) / hiP) * 100 >= o.earlySw) {
      eTop = { bar: hiB, price: hiP, label: "T?", confirmBar: i, top: true };
      eTopBar = i;
      pivots.push(eTop);
      fire("early_top", i, eTop);
    }
    if (lastPv !== -1 && loP != null && !eBot && flipUp[i] && ((s - loP) / loP) * 100 >= o.earlySw) {
      eBot = { bar: loB, price: loP, label: "D?", confirmBar: i, top: false };
      eBotBar = i;
      pivots.push(eBot);
      fire("early_bot", i, eBot);
    }
    // 3) late combination: core pivot first, early flip within combWin afterwards
    if (pendTop && (lastPv !== 1 || i - pendTop.confirmBar > combWin)) pendTop = null;
    if (pendBot && (lastPv !== -1 || i - pendBot.confirmBar > combWin)) pendBot = null;
    if (pendTop && i > pendTop.confirmBar && flipDn[i] && ((pendTop.price - s) / pendTop.price) * 100 >= o.earlySw) {
      pendTop.label = "T!!";
      pendTop.confirmBar = i;
      fire("comb_top", i, pendTop);
      pendTop = null;
    }
    if (pendBot && i > pendBot.confirmBar && flipUp[i] && ((s - pendBot.price) / pendBot.price) * 100 >= o.earlySw) {
      pendBot.label = "D!!";
      pendBot.confirmBar = i;
      fire("comb_bot", i, pendBot);
      pendBot = null;
    }
    // 4) confirmations
    const topOk = lastPv !== 1 && hiP != null && (topCore[i] || (o.useWk && topWk[i]) || (o.usePos && posTop[i]));
    const botOk = !topOk && lastPv !== -1 && loP != null && (botCore[i] || (o.useWk && botWk[i]) || (o.usePos && posBot[i]));
    if (topOk) {
      const comb = !!topCore[i] && !!eTop && i - eTopBar <= combWin;
      const label: PliDmiLabel = comb ? "T!!" : topCore[i] ? "T" : "t";
      if (eTop) removePivot(eTop);
      eTop = null;
      const pv: PliDmiPivot = { bar: hiB, price: hiP!, label, confirmBar: i, top: true };
      pivots.push(pv);
      if (topCore[i]) fire("core_top", i, pv);
      if (comb) fire("comb_top", i, pv);
      pendTop = topCore[i] && !comb ? pv : null;
      pendBot = null;
      if (eBot) {
        removePivot(eBot);
        eBot = null;
      }
      lastB = hiB;
      lastP = hiP;
      lastPv = 1;
      loP = hc[0]!.v;
      loB = hc[0]!.b;
      for (let j = 0; j < D - 2; j++) lc[j] = { ...hc[j + 1]! };
      // deepest tracker: window starts at this bar (documented approximation)
      lc[D - 2] = { v: (D - 2) % 2 === 0 ? hi : lo, b: i };
      hiP = null;
    } else if (botOk) {
      const comb = !!botCore[i] && !!eBot && i - eBotBar <= combWin;
      const label: PliDmiLabel = comb ? "D!!" : botCore[i] ? "D" : "d";
      if (eBot) removePivot(eBot);
      eBot = null;
      const pv: PliDmiPivot = { bar: loB, price: loP!, label, confirmBar: i, top: false };
      pivots.push(pv);
      if (botCore[i]) fire("core_bot", i, pv);
      if (comb) fire("comb_bot", i, pv);
      pendBot = botCore[i] && !comb ? pv : null;
      pendTop = null;
      if (eTop) {
        removePivot(eTop);
        eTop = null;
      }
      lastB = loB;
      lastP = loP;
      lastPv = -1;
      hiP = lc[0]!.v;
      hiB = lc[0]!.b;
      for (let j = 0; j < D - 2; j++) hc[j] = { ...lc[j + 1]! };
      hc[D - 2] = { v: (D - 2) % 2 === 0 ? lo : hi, b: i };
      loP = null;
    }
  }
  void lastP;
  void lastB;
  pivots.sort((a, b) => a.bar - b.bar || a.confirmBar - b.confirmBar);

  return {
    upper, lower, med, oran: pd.oran, dir: pd.dir, yonlu: pd.yonlu, pos, diP, diM, adx,
    adxTurnDn, topCore, botCore, sig, events, pivots,
  };
}

export type PliDmiHit = { cond: PliDmiCond; barsAgo: number; note: string };

export function pliDmiScan(candles: Candle[], conds: PliDmiCond[], maxBarsAgo: number, opts: PliDmiOpts = {}): PliDmiHit[] {
  if (!conds.length || candles.length < PLI_DMI_MIN_BARS) return [];
  const r = computePliDmi(candles, opts);
  const last = candles.length - 1;
  const out: PliDmiHit[] = [];
  for (const cond of conds) {
    const arr = r.sig[cond];
    for (let ago = 0; ago <= maxBarsAgo; ago++) {
      const i = last - ago;
      if (i < 0) break;
      if (!arr[i]) continue;
      const ev = r.events.find((e) => e.cond === cond && e.at === i);
      const pvBit = ev ? ` @${ev.price.toPrecision(6)} (pivot −${last - ev.pivotBar})` : "";
      out.push({ cond, barsAgo: ago, note: `${PLI_DMI_COND_LABEL[cond]}${pvBit} (−${ago})` });
      break;
    }
  }
  return out;
}
