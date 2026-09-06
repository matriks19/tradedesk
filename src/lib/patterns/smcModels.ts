/**
 * SMC Trading Models — checklist from teaching sheets.
 *
 * Four bullish models (bear mirror):
 * 1. HTF POI + sweep + MSS + FVG retest
 * 2. + IDM (inducement sweep before FVG entry)
 * 3. + OTE (Fib 0.62–0.79 of impulse overlaps FVG)
 * 4. BOX (consolidation → fake break to POI → reclaim → retest box edge)
 *
 * Single-TF approximation: recent swing/OB zone stands in for HTF POI.
 * Prefer early/retest stages; drop target_hit by default in scan.
 */
import type { Candle } from "@/lib/types";
import type { PatternDrawing, PatternHit, SwingPoint } from "./types";
import { findSwings } from "./swings";
import { findClassicFvgs } from "./inversionFvg";
import { drawTargets } from "./advanced/draw";

export type SmcModelId = 1 | 2 | 3 | 4;
export type SmcStage = "forming" | "retest" | "active" | "target_hit";

const MIN_FVG_PCT = 0.0008;
const MAX_BARS_AFTER_MSS = 40;
const MAX_RETEST_LOOKFORWARD = 28;
const MIN_SCORE = 55;

export type SmcOpts = {
  swingStrength?: number;
  maxHits?: number;
  /** Prefer models that reached FVG retest */
  preferRetest?: boolean;
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function box(
  id: string,
  t1: number,
  t2: number,
  lo: number,
  hi: number,
  color: string,
  label?: string
): PatternDrawing {
  return { id, kind: "box", t1, price1: lo, t2, price2: hi, color, label };
}

function hline(
  id: string,
  t1: number,
  t2: number,
  price: number,
  color: string,
  label?: string,
  dashed = true
): PatternDrawing {
  return {
    id,
    kind: "hline",
    t1,
    price1: price,
    t2,
    price2: price,
    color,
    label,
    dashed,
    lineWidth: 1,
  };
}

function labelDraw(
  id: string,
  t: number,
  price: number,
  text: string,
  color: string
): PatternDrawing {
  return { id, kind: "label", t1: t, price1: price, label: text, color };
}

function marker(
  id: string,
  t: number,
  price: number,
  bias: "bull" | "bear",
  text: string
): PatternDrawing {
  return {
    id,
    kind: "marker",
    t1: t,
    price1: price,
    label: text,
    color: bias === "bull" ? "#26a69a" : "#ef5350",
    position: bias === "bull" ? "belowBar" : "aboveBar",
    shape: bias === "bull" ? "arrowUp" : "arrowDown",
  };
}

type Poi = {
  top: number;
  bot: number;
  index: number;
  time: number;
};

type Gap = { index: number; top: number; bot: number; bull: boolean };

type Seq = {
  bull: boolean;
  model: SmcModelId;
  poi: Poi;
  sweepIdx: number;
  sweepPrice: number;
  mssIdx: number;
  mssPrice: number;
  fvg: Gap;
  idmIdx?: number;
  idmPrice?: number;
  oteLow?: number;
  oteHigh?: number;
  boxHigh?: number;
  boxLow?: number;
  retestIdx?: number;
  triggerIdx?: number;
  extreme: number;
  structureTp: number;
};

function stageOf(s: Seq, candles: Candle[]): SmcStage {
  const last = candles[candles.length - 1];
  const entry =
    s.retestIdx != null
      ? (s.fvg.top + s.fvg.bot) / 2
      : candles[s.mssIdx].close;
  const risk =
    Math.abs(entry - s.extreme) || Math.abs(entry) * 0.01;
  const tp1 =
    s.bull === (s.structureTp > entry)
      ? s.structureTp
      : s.bull
        ? entry + risk
        : entry - risk;
  if (s.triggerIdx != null) {
    if (s.bull && last.high >= tp1) return "target_hit";
    if (!s.bull && last.low <= tp1) return "target_hit";
    return "active";
  }
  if (s.retestIdx != null) return "retest";
  return "forming";
}

function scoreSeq(s: Seq, stage: SmcStage): number {
  let score = 30;
  score += 10; // POI present
  score += 12; // sweep
  score += 12; // MSS
  const mid = (s.fvg.top + s.fvg.bot) / 2 || 1;
  const gapPct = (s.fvg.top - s.fvg.bot) / mid;
  score += clamp(gapPct * 3500, 4, 12);
  if (s.retestIdx != null) score += 14;
  if (s.triggerIdx != null) score += 8;
  if (s.model === 2 && s.idmIdx != null) score += 8;
  if (s.model === 3 && s.oteLow != null) score += 10;
  if (s.model === 4 && s.boxHigh != null) score += 8;
  if (stage === "retest") score += 4;
  if (stage === "active") score += 2;
  return Math.round(clamp(score, 0, 100));
}

function modelLabel(model: SmcModelId, bull: boolean): string {
  const side = bull ? "Boğa" : "Ayı";
  switch (model) {
    case 1:
      return `SMC1 · POI+Süp+MSS+FVG (${side})`;
    case 2:
      return `SMC2 · +IDM (${side})`;
    case 3:
      return `SMC3 · +OTE (${side})`;
    case 4:
      return `SMC4 · BOX (${side})`;
  }
}

function findDemandPois(
  candles: Candle[],
  lows: SwingPoint[],
  lookEnd: number
): Poi[] {
  const out: Poi[] = [];
  for (const lo of lows) {
    if (lo.index < 8 || lo.index > lookEnd - 5) continue;
    const c = candles[lo.index];
    const top = Math.max(c.open, c.close);
    const bot = c.low;
    if (top <= bot) continue;
    // Prefer zones that held at least briefly
    out.push({ top, bot, index: lo.index, time: c.time });
  }
  return out.slice(-14);
}

function findSupplyPois(
  candles: Candle[],
  highs: SwingPoint[],
  lookEnd: number
): Poi[] {
  const out: Poi[] = [];
  for (const hi of highs) {
    if (hi.index < 8 || hi.index > lookEnd - 5) continue;
    const c = candles[hi.index];
    const top = c.high;
    const bot = Math.min(c.open, c.close);
    if (top <= bot) continue;
    out.push({ top, bot, index: hi.index, time: c.time });
  }
  return out.slice(-14);
}

function findSweepIntoPoi(
  candles: Candle[],
  poi: Poi,
  highs: SwingPoint[],
  lows: SwingPoint[],
  bull: boolean,
  from: number,
  to: number
): { idx: number; price: number } | null {
  // Liquidity reference: most recent swing opposite of POI before sweep window
  if (bull) {
    const refLows = lows.filter(
      (l) => l.index > poi.index && l.index < to
    );
    const ref =
      refLows.length > 0
        ? refLows[refLows.length - 1]
        : { index: poi.index, price: poi.bot };
    for (let i = Math.max(from, ref.index + 1); i <= to; i++) {
      const c = candles[i];
      // Sweep below ref / into POI, close back above
      const intoPoi = c.low <= poi.top && c.low >= poi.bot * 0.995;
      const swept = c.low < ref.price * 0.9995;
      if ((intoPoi || swept) && c.close > Math.min(ref.price, poi.top)) {
        const rng = c.high - c.low || 1;
        const wick = (Math.min(c.open, c.close) - c.low) / rng;
        if (wick > 0.25 || intoPoi) {
          return { idx: i, price: c.low };
        }
      }
    }
  } else {
    const refHighs = highs.filter(
      (h) => h.index > poi.index && h.index < to
    );
    const ref =
      refHighs.length > 0
        ? refHighs[refHighs.length - 1]
        : { index: poi.index, price: poi.top };
    for (let i = Math.max(from, ref.index + 1); i <= to; i++) {
      const c = candles[i];
      const intoPoi = c.high >= poi.bot && c.high <= poi.top * 1.005;
      const swept = c.high > ref.price * 1.0005;
      if ((intoPoi || swept) && c.close < Math.max(ref.price, poi.bot)) {
        const rng = c.high - c.low || 1;
        const wick = (c.high - Math.max(c.open, c.close)) / rng;
        if (wick > 0.25 || intoPoi) {
          return { idx: i, price: c.high };
        }
      }
    }
  }
  return null;
}

function findMss(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  bull: boolean,
  afterIdx: number,
  maxBars: number
): { idx: number; price: number } | null {
  const end = Math.min(candles.length - 1, afterIdx + maxBars);
  if (bull) {
    const sh = highs.filter(
      (h) => h.index < afterIdx && h.index > afterIdx - 30
    );
    if (!sh.length) return null;
    const level = sh[sh.length - 1].price;
    for (let i = afterIdx + 1; i <= end; i++) {
      if (candles[i].close > level) {
        return { idx: i, price: level };
      }
    }
  } else {
    const sl = lows.filter(
      (l) => l.index < afterIdx && l.index > afterIdx - 30
    );
    if (!sl.length) return null;
    const level = sl[sl.length - 1].price;
    for (let i = afterIdx + 1; i <= end; i++) {
      if (candles[i].close < level) {
        return { idx: i, price: level };
      }
    }
  }
  return null;
}

function pickFvgAfterImpulse(
  gaps: Gap[],
  bull: boolean,
  afterIdx: number,
  beforeIdx: number
): Gap | null {
  const cands = gaps.filter(
    (g) =>
      g.bull === bull &&
      g.index > afterIdx &&
      g.index <= beforeIdx &&
      (g.top - g.bot) / ((g.top + g.bot) / 2 || 1) >= MIN_FVG_PCT
  );
  return cands.length ? cands[cands.length - 1] : null;
}

function findRetest(
  candles: Candle[],
  fvg: Gap,
  from: number,
  maxBars: number
): { retestIdx: number; triggerIdx?: number } | null {
  const end = Math.min(candles.length - 1, from + maxBars);
  let retestIdx: number | undefined;
  for (let i = from + 1; i <= end; i++) {
    const c = candles[i];
    const touch =
      c.low <= fvg.top && c.high >= fvg.bot;
    if (!touch) continue;
    if (retestIdx == null) retestIdx = i;
    // Trigger: close reclaim in trade direction after touch
    if (fvg.bull && c.close > fvg.top) {
      return { retestIdx, triggerIdx: i };
    }
    if (!fvg.bull && c.close < fvg.bot) {
      return { retestIdx, triggerIdx: i };
    }
  }
  if (retestIdx != null) return { retestIdx };
  return null;
}

function findIdm(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  bull: boolean,
  poiIdx: number,
  sweepIdx: number
): { idx: number; price: number } | null {
  // Inducement: minor swing against bias between POI and final sweep
  if (bull) {
    const minors = highs.filter(
      (h) => h.index > poiIdx && h.index < sweepIdx
    );
    if (!minors.length) return null;
    const idm = minors[minors.length - 1];
    // Price should have swept that inducement (went above then reversed) OR
    // there is a wick above idm before the low sweep
    for (let i = idm.index + 1; i < sweepIdx; i++) {
      if (candles[i].high > idm.price && candles[i].close < idm.price) {
        return { idx: i, price: candles[i].high };
      }
    }
    // Soft: inducement exists and sweep is deeper than prior low after IDM
    return { idx: idm.index, price: idm.price };
  }
  const minors = lows.filter(
    (l) => l.index > poiIdx && l.index < sweepIdx
  );
  if (!minors.length) return null;
  const idm = minors[minors.length - 1];
  for (let i = idm.index + 1; i < sweepIdx; i++) {
    if (candles[i].low < idm.price && candles[i].close > idm.price) {
      return { idx: i, price: candles[i].low };
    }
  }
  return { idx: idm.index, price: idm.price };
}

function oteBand(
  impulseStart: number,
  impulseEnd: number,
  bull: boolean
): { low: number; high: number } {
  // Fib 0.62–0.79 retrace of impulse
  if (bull) {
    const range = impulseEnd - impulseStart;
    return {
      high: impulseEnd - range * 0.62,
      low: impulseEnd - range * 0.79,
    };
  }
  const range = impulseStart - impulseEnd;
  return {
    low: impulseEnd + range * 0.62,
    high: impulseEnd + range * 0.79,
  };
}

function overlaps(
  aLo: number,
  aHi: number,
  bLo: number,
  bHi: number
): boolean {
  return aLo <= bHi && aHi >= bLo;
}

function detectBoxModel(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  bull: boolean
): Seq | null {
  const n = candles.length;
  if (n < 50) return null;
  // Look for consolidation 12–28 bars, then fake break, reclaim, retest edge
  for (const boxLen of [12, 16, 20, 24]) {
    for (let end = n - 8; end >= Math.max(30, n - 80); end -= 2) {
      const start = end - boxLen;
      if (start < 10) continue;
      const slice = candles.slice(start, end);
      const boxHigh = Math.max(...slice.map((c) => c.high));
      const boxLow = Math.min(...slice.map((c) => c.low));
      const mid = (boxHigh + boxLow) / 2 || 1;
      const width = (boxHigh - boxLow) / mid;
      if (width < 0.008 || width > 0.06) continue;

      // POI just below/above the box
      const pois = bull
        ? findDemandPois(candles, lows, start)
        : findSupplyPois(candles, highs, start);
      const poi = pois[pois.length - 1];
      if (!poi) continue;

      // Fake break
      let fakeIdx = -1;
      let reclaimIdx = -1;
      for (let i = end; i < Math.min(n - 1, end + 12); i++) {
        const c = candles[i];
        if (bull) {
          if (fakeIdx < 0 && c.low < boxLow && c.low <= poi.top) {
            fakeIdx = i;
          }
          if (fakeIdx >= 0 && c.close > boxLow) {
            reclaimIdx = i;
            break;
          }
        } else {
          if (fakeIdx < 0 && c.high > boxHigh && c.high >= poi.bot) {
            fakeIdx = i;
          }
          if (fakeIdx >= 0 && c.close < boxHigh) {
            reclaimIdx = i;
            break;
          }
        }
      }
      if (fakeIdx < 0 || reclaimIdx < 0) continue;

      // FVG after reclaim preferred; else use box edge as zone
      const gaps = findClassicFvgs(candles, reclaimIdx, Math.min(n - 1, reclaimIdx + 16));
      let fvg = pickFvgAfterImpulse(gaps, bull, reclaimIdx - 1, Math.min(n - 1, reclaimIdx + 16));
      if (!fvg) {
        fvg = bull
          ? {
              index: reclaimIdx,
              top: boxLow + (boxHigh - boxLow) * 0.15,
              bot: boxLow,
              bull: true,
            }
          : {
              index: reclaimIdx,
              top: boxHigh,
              bot: boxHigh - (boxHigh - boxLow) * 0.15,
              bull: false,
            };
      }

      const edge = bull ? boxLow : boxHigh;
      let retestIdx: number | undefined;
      let triggerIdx: number | undefined;
      for (let i = reclaimIdx + 1; i < Math.min(n, reclaimIdx + MAX_RETEST_LOOKFORWARD); i++) {
        const c = candles[i];
        const touchEdge = bull
          ? c.low <= edge * 1.002 && c.high >= edge
          : c.high >= edge * 0.998 && c.low <= edge;
        const touchFvg = c.low <= fvg.top && c.high >= fvg.bot;
        if (touchEdge || touchFvg) {
          if (retestIdx == null) retestIdx = i;
          if (bull && c.close > edge) {
            triggerIdx = i;
            break;
          }
          if (!bull && c.close < edge) {
            triggerIdx = i;
            break;
          }
        }
      }

      const extreme = bull
        ? Math.min(...candles.slice(fakeIdx, reclaimIdx + 1).map((c) => c.low))
        : Math.max(...candles.slice(fakeIdx, reclaimIdx + 1).map((c) => c.high));
      const structureTp = bull ? boxHigh : boxLow;

      return {
        bull,
        model: 4,
        poi,
        sweepIdx: fakeIdx,
        sweepPrice: bull ? candles[fakeIdx].low : candles[fakeIdx].high,
        mssIdx: reclaimIdx,
        mssPrice: edge,
        fvg,
        boxHigh,
        boxLow,
        retestIdx,
        triggerIdx,
        extreme,
        structureTp,
      };
    }
  }
  return null;
}

function buildSeqs(
  candles: Candle[],
  swingStrength: number
): Seq[] {
  const swings = findSwings(candles, swingStrength);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const n = candles.length;
  const out: Seq[] = [];
  const lookEnd = n - 3;

  for (const bull of [true, false]) {
    const pois = bull
      ? findDemandPois(candles, lows, lookEnd)
      : findSupplyPois(candles, highs, lookEnd);

    for (const poi of pois.slice(-8)) {
      const sweep = findSweepIntoPoi(
        candles,
        poi,
        highs,
        lows,
        bull,
        poi.index + 2,
        lookEnd
      );
      if (!sweep) continue;
      // Freshness: sweep not too old
      if (n - 1 - sweep.idx > 55) continue;

      const mss = findMss(
        candles,
        highs,
        lows,
        bull,
        sweep.idx,
        MAX_BARS_AFTER_MSS
      );
      if (!mss) continue;

      const impulseEndIdx = Math.min(n - 1, mss.idx + 12);
      const gaps = findClassicFvgs(candles, sweep.idx, impulseEndIdx);
      const fvg = pickFvgAfterImpulse(gaps, bull, sweep.idx, impulseEndIdx);
      if (!fvg) continue;

      const re = findRetest(
        candles,
        fvg,
        Math.max(fvg.index, mss.idx),
        MAX_RETEST_LOOKFORWARD
      );

      const extreme = bull
        ? Math.min(
            sweep.price,
            ...candles.slice(sweep.idx, mss.idx + 1).map((c) => c.low)
          )
        : Math.max(
            sweep.price,
            ...candles.slice(sweep.idx, mss.idx + 1).map((c) => c.high)
          );

      // Structure TP: recent opposing swing
      let structureTp: number;
      if (bull) {
        const prior = highs.filter((h) => h.index < sweep.idx).slice(-2);
        structureTp =
          prior.length > 0
            ? Math.max(...prior.map((p) => p.price))
            : candles[mss.idx].high;
      } else {
        const prior = lows.filter((l) => l.index < sweep.idx).slice(-2);
        structureTp =
          prior.length > 0
            ? Math.min(...prior.map((p) => p.price))
            : candles[mss.idx].low;
      }

      const base: Seq = {
        bull,
        model: 1,
        poi,
        sweepIdx: sweep.idx,
        sweepPrice: sweep.price,
        mssIdx: mss.idx,
        mssPrice: mss.price,
        fvg,
        retestIdx: re?.retestIdx,
        triggerIdx: re?.triggerIdx,
        extreme,
        structureTp,
      };
      out.push(base);

      // Model 2: IDM
      const idm = findIdm(
        candles,
        highs,
        lows,
        bull,
        poi.index,
        sweep.idx
      );
      if (idm) {
        out.push({
          ...base,
          model: 2,
          idmIdx: idm.idx,
          idmPrice: idm.price,
        });
      }

      // Model 3: OTE overlap
      const impulseStart = sweep.price;
      const impulseEnd = bull
        ? Math.max(...candles.slice(sweep.idx, mss.idx + 1).map((c) => c.high))
        : Math.min(...candles.slice(sweep.idx, mss.idx + 1).map((c) => c.low));
      const ote = oteBand(impulseStart, impulseEnd, bull);
      if (overlaps(fvg.bot, fvg.top, ote.low, ote.high)) {
        out.push({
          ...base,
          model: 3,
          oteLow: Math.min(ote.low, ote.high),
          oteHigh: Math.max(ote.low, ote.high),
        });
      }
    }

    const boxSeq = detectBoxModel(candles, highs, lows, bull);
    if (boxSeq) out.push(boxSeq);
  }

  return out;
}

function buildHit(candles: Candle[], s: Seq): PatternHit {
  const last = candles[candles.length - 1];
  const stage = stageOf(s, candles);
  const score = scoreSeq(s, stage);
  const bull = s.bull;
  const fvgMid = (s.fvg.top + s.fvg.bot) / 2;
  const entry =
    s.retestIdx != null
      ? fvgMid
      : s.model === 4 && s.boxLow != null
        ? bull
          ? s.boxLow
          : (s.boxHigh as number)
        : candles[s.mssIdx].close;
  const stopBuf =
    Math.max((s.fvg.top - s.fvg.bot) * 0.2, Math.abs(entry) * 0.0008);
  const stop = bull ? s.extreme - stopBuf : s.extreme + stopBuf;
  const risk = Math.abs(entry - stop) || Math.abs(entry) * 0.01;
  const tp1Ok = bull ? s.structureTp > entry : s.structureTp < entry;
  const tp1 = tp1Ok
    ? s.structureTp
    : bull
      ? entry + risk
      : entry - risk;
  const tp2 = bull ? entry + risk * 1.5 : entry - risk * 1.5;
  const tp3 = bull ? entry + risk * 2.5 : entry - risk * 2.5;
  const signalIdx =
    s.triggerIdx ?? s.retestIdx ?? s.mssIdx;
  const barsAgo = Math.max(0, candles.length - 1 - signalIdx);
  const id = uid(`smc${s.model}`);
  const tStart = s.poi.time;
  const tEnd = last.time;
  const color = bull ? "#26a69a" : "#ef5350";

  const drawings: PatternDrawing[] = [
    box(
      `${id}_poi`,
      s.poi.time,
      tEnd,
      s.poi.bot,
      s.poi.top,
      bull ? "rgba(38,166,154,0.18)" : "rgba(239,83,80,0.18)",
      "POI"
    ),
    marker(
      `${id}_sw`,
      candles[s.sweepIdx].time,
      s.sweepPrice,
      bull ? "bull" : "bear",
      "SÜP"
    ),
    hline(
      `${id}_mss`,
      candles[s.mssIdx].time,
      tEnd,
      s.mssPrice,
      "#ab47bc",
      "MSS",
      false
    ),
    box(
      `${id}_fvg`,
      candles[s.fvg.index].time,
      tEnd,
      s.fvg.bot,
      s.fvg.top,
      bull ? "rgba(66,165,245,0.22)" : "rgba(255,183,77,0.22)",
      "FVG"
    ),
    ...drawTargets({
      t1: candles[signalIdx].time,
      t2: tEnd,
      entry,
      entryTime: candles[signalIdx].time,
      tp1,
      tp2,
      tp3,
      sl: stop,
      bull,
    }),
    labelDraw(
      `${id}_lb`,
      candles[s.mssIdx].time,
      s.mssPrice,
      modelLabel(s.model, bull),
      color
    ),
  ];

  if (s.model === 2 && s.idmIdx != null && s.idmPrice != null) {
    drawings.push(
      marker(
        `${id}_idm`,
        candles[s.idmIdx].time,
        s.idmPrice,
        bull ? "bear" : "bull",
        "IDM"
      )
    );
  }
  if (s.model === 3 && s.oteLow != null && s.oteHigh != null) {
    drawings.push(
      box(
        `${id}_ote`,
        candles[s.sweepIdx].time,
        tEnd,
        s.oteLow,
        s.oteHigh,
        "rgba(171,71,188,0.18)",
        "OTE"
      )
    );
  }
  if (s.model === 4 && s.boxHigh != null && s.boxLow != null) {
    drawings.push(
      box(
        `${id}_box`,
        candles[Math.max(0, s.mssIdx - 20)].time,
        tEnd,
        s.boxLow,
        s.boxHigh,
        "rgba(41,98,255,0.12)",
        "BOX"
      )
    );
  }

  const status: NonNullable<PatternHit["meta"]>["status"] =
    stage === "forming"
      ? "forming"
      : stage === "retest"
        ? "retest"
        : stage === "target_hit"
          ? "target_hit"
          : s.triggerIdx != null
            ? bull
              ? "al_tetiklendi"
              : "sat_tetiklendi"
            : "active";

  return {
    id,
    type: "smc_model",
    label: modelLabel(s.model, bull),
    detail: `${stage} · skor ${score}${s.model === 3 ? " · OTE∩FVG" : ""}${
      s.model === 2 ? " · IDM" : ""
    }`,
    bias: bull ? "bull" : "bear",
    confidence: score / 100,
    tStart,
    tEnd,
    drawings,
    meta: {
      status,
      score,
      kind: "smc_model",
      model: `SMC${s.model}`,
      modelId: s.model,
      stage,
      entry,
      stop,
      tp1,
      tp2,
      tp3,
      fvgTop: s.fvg.top,
      fvgBot: s.fvg.bot,
      barsAgo,
      sweep: true,
      chochPrice: s.mssPrice,
      poiTop: s.poi.top,
      poiBot: s.poi.bot,
      oteLow: s.oteLow,
      oteHigh: s.oteHigh,
      boxHigh: s.boxHigh,
      boxLow: s.boxLow,
      filterOk: score >= MIN_SCORE && (stage === "retest" || stage === "active" || stage === "forming"),
      riskR: risk > 0 ? Math.abs(tp1 - entry) / risk : undefined,
    },
  };
}

export function detectSmcModels(
  candles: Candle[],
  opts: SmcOpts = {}
): PatternHit[] {
  if (candles.length < 50) return [];
  const swingStrength = opts.swingStrength ?? 2;
  const maxHits = opts.maxHits ?? 8;
  const seqs = buildSeqs(candles, swingStrength);
  const hits = seqs.map((s) => buildHit(candles, s));

  // Prefer retest, then forming; demote target_hit
  hits.sort((a, b) => {
    const rank = (h: PatternHit) => {
      const st = h.meta?.stage ?? h.meta?.status;
      if (st === "retest") return 0;
      if (st === "forming" || st === "mss") return 1;
      if (st === "active" || st === "al_tetiklendi" || st === "sat_tetiklendi")
        return 2;
      return 3;
    };
    return (
      rank(a) - rank(b) ||
      (a.meta?.barsAgo ?? 999) - (b.meta?.barsAgo ?? 999) ||
      (b.meta?.score ?? 0) - (a.meta?.score ?? 0)
    );
  });

  // Dedupe similar models on same bias near same FVG
  const kept: PatternHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.bias}_${h.meta?.modelId}_${Math.round(
      ((h.meta?.fvgTop ?? 0) + (h.meta?.fvgBot ?? 0)) * 500
    )}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(h);
    if (kept.length >= maxHits) break;
  }
  return kept;
}

export function passesSmcFilter(h: PatternHit, minScore = MIN_SCORE): boolean {
  if (h.type !== "smc_model") return false;
  const score = h.meta?.score ?? h.confidence * 100;
  if (score < minScore) return false;
  const st = h.meta?.stage ?? h.meta?.status;
  if (st === "target_hit") return false;
  return true;
}
