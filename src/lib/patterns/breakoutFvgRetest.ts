import type { Candle } from "@/lib/types";
import { fairValueGaps } from "@/lib/indicators/beluga";
import { rsi, sma } from "@/lib/indicators/math";
import type { PatternDrawing, PatternHit } from "./types";

export type BfrStatus =
  | "konsolidasyon"
  | "breakout"
  | "fvg"
  | "retest"
  | "confirmation"
  | "al_tetiklendi";

const LOOKBACKS = [15, 20, 25, 30, 35, 40];
/** Max consolidation range as fraction of mid price */
const MAX_RANGE_PCT = 0.08;
const MIN_RANGE_PCT = 0.004;
/** Breakout body must be at least this fraction of candle range */
const MIN_BODY_FRAC = 0.45;
/** Bars after breakout to look for FVG / retest / confirm */
const POST_BO_MAX = 18;
const RETEST_TOL_FRAC = 0.004; // ±0.4% of price or FVG mid touch
const MIN_SCORE_FILTER = 55;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lastFinite(arr: (number | null)[]): number | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return undefined;
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

type GapHit = {
  index: number; // i of candle2 in 3-candle FVG
  top: number;
  bot: number;
  bull: boolean;
};

/** Classic 3-candle FVGs (same rule as beluga.fairValueGaps creation). */
function findClassicFvgs(candles: Candle[], from: number, to: number): GapHit[] {
  const out: GapHit[] = [];
  const start = Math.max(2, from);
  const end = Math.min(candles.length - 1, to);
  for (let i = start; i <= end; i++) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    if (c0.high < c2.low) {
      out.push({ index: i, top: c2.low, bot: c0.high, bull: true });
    }
    if (c0.low > c2.high) {
      out.push({ index: i, top: c0.low, bot: c2.high, bull: false });
    }
  }
  return out;
}

type ConsWin = {
  start: number;
  end: number; // inclusive, last bar of consolidation (before breakout)
  hi: number;
  lo: number;
  widthPct: number;
};

function findConsolidation(
  candles: Candle[],
  endIdx: number,
  lookback: number
): ConsWin | null {
  const start = endIdx - lookback + 1;
  if (start < 0) return null;
  const slice = candles.slice(start, endIdx + 1);
  const hi = Math.max(...slice.map((c) => c.high));
  const lo = Math.min(...slice.map((c) => c.low));
  const mid = (hi + lo) / 2 || 1;
  const widthPct = (hi - lo) / mid;
  if (widthPct > MAX_RANGE_PCT || widthPct < MIN_RANGE_PCT) return null;
  // Require most closes inside the box (sideways)
  let inside = 0;
  for (const c of slice) {
    if (c.close <= hi * 1.002 && c.close >= lo * 0.998) inside++;
  }
  if (inside / slice.length < 0.85) return null;
  return { start, end: endIdx, hi, lo, widthPct };
}

function volOkAt(candles: Candle[], i: number, volSma: (number | null)[]): boolean {
  const v = candles[i].volume;
  const m = volSma[i];
  if (m == null || m <= 0) return false;
  return v > m;
}

function bodyFrac(c: Candle): number {
  const range = Math.max(1e-12, c.high - c.low);
  return Math.abs(c.close - c.open) / range;
}

type Seq = {
  bull: boolean;
  cons: ConsWin;
  boIdx: number;
  fvg?: GapHit;
  retestIdx?: number;
  retestPrice?: number;
  confirmIdx?: number;
  volOk: boolean;
};

function scoreSeq(
  s: Seq,
  status: BfrStatus,
  rsiVal: number | undefined
): { score: number; filterOk: boolean } {
  let score = 20;
  // Consolidation tightness
  const tight = clamp(100 - s.cons.widthPct * 1000, 20, 95);
  score += tight * 0.18;
  // Breakout body
  score += 12;
  if (s.volOk) score += 12;
  if (s.fvg) score += 14;
  if (s.retestIdx != null) score += 14;
  if (s.confirmIdx != null) score += 16;
  if (status === "al_tetiklendi") score += 8;
  if (rsiVal != null) {
    if (s.bull && rsiVal >= 45 && rsiVal <= 72) score += 6;
    if (!s.bull && rsiVal <= 55 && rsiVal >= 28) score += 6;
  }
  score = Math.round(clamp(score, 0, 100));
  const filterOk =
    score >= MIN_SCORE_FILTER &&
    Boolean(s.fvg) &&
    s.retestIdx != null &&
    (s.confirmIdx != null || status === "retest");
  return { score, filterOk: Boolean(filterOk && score >= 60) };
}

function statusOf(s: Seq): BfrStatus {
  if (s.confirmIdx != null) return "al_tetiklendi";
  if (s.retestIdx != null) return "retest";
  if (s.fvg) return "fvg";
  if (s.boIdx >= 0) return "breakout";
  return "konsolidasyon";
}

function buildHit(candles: Candle[], s: Seq, rsiVal: number | undefined): PatternHit {
  const last = candles[candles.length - 1];
  const status = statusOf(s);
  const { score, filterOk } = scoreSeq(s, status, rsiVal);
  const bull = s.bull;
  const rangeH = s.cons.hi;
  const rangeL = s.cons.lo;
  const rh = rangeH - rangeL;
  const fvgTop = s.fvg?.top;
  const fvgBot = s.fvg?.bot;
  const fvgMid =
    fvgTop != null && fvgBot != null ? (fvgTop + fvgBot) / 2 : undefined;

  const retestPrice =
    s.retestPrice ??
    (bull ? rangeH : rangeL) ??
    fvgMid;

  const entry =
    s.confirmIdx != null
      ? candles[s.confirmIdx].close
      : s.retestIdx != null
        ? candles[s.retestIdx].close
        : candles[s.boIdx].close;

  // Stop: below FVG bot / range high zone (bull) — slight buffer
  const stop = bull
    ? Math.min(rangeH, fvgBot ?? rangeH) - rh * 0.15
    : Math.max(rangeL, fvgTop ?? rangeL) + rh * 0.15;

  const tp1 = bull ? entry + rh * 1.0 : entry - rh * 1.0;
  const tp2 = bull ? entry + rh * 1.618 : entry - rh * 1.618;
  const tp3 = bull ? entry + rh * 2.618 : entry - rh * 2.618;

  const signalIdx = s.confirmIdx ?? s.retestIdx ?? s.boIdx;
  const barsAgo = candles.length - 1 - signalIdx;

  const id = uid("bfr");
  const tCons0 = candles[s.cons.start].time;
  const tCons1 = candles[s.cons.end].time;
  const tBo = candles[s.boIdx].time;
  const tEnd = last.time;
  const color = bull ? "#26a69a" : "#ef5350";
  const boxColor = bull ? "rgba(38,166,154,0.12)" : "rgba(239,83,80,0.12)";
  const fvgColor = bull ? "rgba(38,166,154,0.22)" : "rgba(239,83,80,0.22)";

  const drawings: PatternDrawing[] = [
    box(`${id}_cons`, tCons0, tCons1, rangeL, rangeH, boxColor, "Konsolidasyon"),
    hline(`${id}_rh`, tCons0, tEnd, rangeH, "#ffb74d", "RH"),
    hline(`${id}_rl`, tCons0, tEnd, rangeL, "#ffb74d", "RL"),
    marker(
      `${id}_bo`,
      tBo,
      candles[s.boIdx].close,
      bull ? "bull" : "bear",
      "BO"
    ),
    labelDraw(
      `${id}_bol`,
      tBo,
      candles[s.boIdx].close,
      bull ? "BREAKOUT ↑" : "BREAKOUT ↓",
      color
    ),
  ];

  if (s.fvg) {
    const tF0 = candles[Math.max(0, s.fvg.index - 2)].time;
    const tF1 = candles[Math.min(candles.length - 1, s.fvg.index + 4)].time;
    drawings.push(
      box(`${id}_fvg`, tF0, tF1, s.fvg.bot, s.fvg.top, fvgColor, "FVG"),
      labelDraw(`${id}_fvgl`, tF0, s.fvg.top, "FVG", "#7e57c2")
    );
  }

  if (s.retestIdx != null && retestPrice != null) {
    drawings.push(
      labelDraw(
        `${id}_rt`,
        candles[s.retestIdx].time,
        retestPrice,
        "RETEST",
        "#ffb74d"
      ),
      marker(
        `${id}_rtm`,
        candles[s.retestIdx].time,
        retestPrice,
        bull ? "bull" : "bear",
        "RT"
      )
    );
  }

  if (s.confirmIdx != null) {
    drawings.push(
      marker(
        `${id}_al`,
        candles[s.confirmIdx].time,
        candles[s.confirmIdx].close,
        bull ? "bull" : "bear",
        bull ? "AL" : "SAT"
      ),
      labelDraw(
        `${id}_all`,
        candles[s.confirmIdx].time,
        candles[s.confirmIdx].close,
        bull ? "AL ✓" : "SAT ✓",
        color
      )
    );
  }

  drawings.push(
    hline(`${id}_entry`, tBo, tEnd, entry, "#42a5f5", "Entry", false),
    hline(`${id}_sl`, tBo, tEnd, stop, "#ef5350", "SL"),
    hline(`${id}_tp1`, tBo, tEnd, tp1, "#26a69a", "TP1"),
    hline(`${id}_tp2`, tBo, tEnd, tp2, "#66bb6a", "TP2"),
    hline(`${id}_tp3`, tBo, tEnd, tp3, "#9ccc65", "TP3")
  );

  const statusTr: Record<BfrStatus, string> = {
    konsolidasyon: "Konsolidasyon",
    breakout: "Breakout",
    fvg: "FVG",
    retest: "Retest",
    confirmation: "Onay",
    al_tetiklendi: bull ? "AL tetiklendi" : "SAT tetiklendi",
  };

  const label = bull
    ? "Breakout·FVG·Retest AL"
    : "Breakout·FVG·Retest SAT";
  const detail = [
    statusTr[status],
    `skor ${score}`,
    s.volOk ? "hacim OK" : "hacim zayıf",
    barsAgo === 0 ? "şimdi" : `${barsAgo} mum önce`,
  ].join(" · ");

  return {
    id,
    type: "breakout_fvg_retest",
    label,
    detail,
    bias: bull ? "bull" : "bear",
    confidence: clamp(score / 100, 0.35, 0.98),
    tStart: tCons0,
    tEnd,
    drawings,
    meta: {
      status,
      score,
      filterOk,
      kind: "breakout_fvg_retest",
      rangeHigh: rangeH,
      rangeLow: rangeL,
      breakoutPrice: candles[s.boIdx].close,
      fvgTop,
      fvgBot,
      retestPrice,
      entry,
      stop,
      tp1,
      tp2,
      tp3,
      targetPrice: tp1,
      barsAgo,
      rsi: rsiVal != null ? Math.round(rsiVal * 10) / 10 : undefined,
      volOk: s.volOk,
    },
  };
}

/**
 * Breakout → FVG → Retest → Confirmation structure detector.
 * Bull: consolidation → close above RH → bullish FVG → retest RH/FVG → AL.
 * Mirror for SAT.
 */
export function detectBreakoutFvgRetest(candles: Candle[]): PatternHit[] {
  if (candles.length < 50) return [];

  const volumes = candles.map((c) => c.volume);
  const volSma = sma(volumes, 20);
  const closes = candles.map((c) => c.close);
  const rsiArr = rsi(closes, 14);
  // Touch beluga FVG series so reuse is live (gaps also via classic finder)
  void fairValueGaps(candles, 12);

  const hits: PatternHit[] = [];
  const n = candles.length;
  // Scan recent breakout candidates (leave room for post-BO path)
  const boSearchFrom = Math.max(40, n - 80);
  const boSearchTo = n - 2; // need at least 1 bar after for retest path preference

  for (let boIdx = boSearchFrom; boIdx <= boSearchTo; boIdx++) {
    const bo = candles[boIdx];
    for (const lb of LOOKBACKS) {
      const consEnd = boIdx - 1;
      const cons = findConsolidation(candles, consEnd, lb);
      if (!cons) continue;

      const bodyOk = bodyFrac(bo) >= MIN_BODY_FRAC;
      if (!bodyOk) continue;

      const bullBreak = bo.close > cons.hi && bo.close > bo.open;
      const bearBreak = bo.close < cons.lo && bo.close < bo.open;
      if (!bullBreak && !bearBreak) continue;

      const bull = bullBreak;
      const vOk = volOkAt(candles, boIdx, volSma);

      // FVG overlapping breakout impulse (boIdx-1 .. boIdx+3)
      const gaps = findClassicFvgs(
        candles,
        Math.max(2, boIdx - 1),
        Math.min(n - 1, boIdx + 4)
      ).filter((g) => g.bull === bull);

      // Prefer FVG that overlaps breakout zone (near RH/RL)
      const zoneLo = bull ? cons.hi * 0.995 : cons.lo * 0.98;
      const zoneHi = bull ? cons.hi * 1.03 : cons.lo * 1.005;
      let fvg =
        gaps.find((g) => g.bot <= zoneHi && g.top >= zoneLo) ?? gaps[0];

      // Retest window
      const postEnd = Math.min(n - 1, boIdx + POST_BO_MAX);
      let retestIdx: number | undefined;
      let retestPrice: number | undefined;
      const tol = Math.abs(bo.close) * RETEST_TOL_FRAC;

      for (let i = boIdx + 1; i <= postEnd; i++) {
        const c = candles[i];
        if (bull) {
          const touchRh =
            c.low <= cons.hi + tol && c.low >= cons.hi - tol * 3;
          const touchFvg =
            fvg != null &&
            c.low <= fvg.top + tol &&
            c.low >= fvg.bot - tol;
          const touchMid =
            fvg != null &&
            Math.abs(c.low - (fvg.top + fvg.bot) / 2) <= tol * 2;
          // Hold: close back above RH or FVG mid
          const holds =
            c.close >= cons.hi - tol ||
            (fvg != null && c.close >= (fvg.top + fvg.bot) / 2 - tol);
          if ((touchRh || touchFvg || touchMid) && holds) {
            retestIdx = i;
            retestPrice = touchRh
              ? cons.hi
              : fvg
                ? (fvg.top + fvg.bot) / 2
                : cons.hi;
            break;
          }
        } else {
          const touchRl =
            c.high >= cons.lo - tol && c.high <= cons.lo + tol * 3;
          const touchFvg =
            fvg != null &&
            c.high >= fvg.bot - tol &&
            c.high <= fvg.top + tol;
          const touchMid =
            fvg != null &&
            Math.abs(c.high - (fvg.top + fvg.bot) / 2) <= tol * 2;
          const holds =
            c.close <= cons.lo + tol ||
            (fvg != null && c.close <= (fvg.top + fvg.bot) / 2 + tol);
          if ((touchRl || touchFvg || touchMid) && holds) {
            retestIdx = i;
            retestPrice = touchRl
              ? cons.lo
              : fvg
                ? (fvg.top + fvg.bot) / 2
                : cons.lo;
            break;
          }
        }
      }

      // Confirmation after retest
      let confirmIdx: number | undefined;
      if (retestIdx != null) {
        for (let i = retestIdx; i <= Math.min(n - 1, retestIdx + 4); i++) {
          const c = candles[i];
          const prev = candles[i - 1];
          if (bull) {
            const bullish = c.close > c.open;
            const engulfs =
              prev.close < prev.open &&
              c.close > c.open &&
              c.close >= prev.open &&
              c.open <= prev.close;
            const aboveMid =
              retestPrice != null && c.close > retestPrice;
            const rejectWick =
              c.low < (retestPrice ?? cons.hi) &&
              c.close > (retestPrice ?? cons.hi);
            if (bullish && (engulfs || aboveMid || rejectWick)) {
              confirmIdx = i;
              break;
            }
          } else {
            const bearish = c.close < c.open;
            const engulfs =
              prev.close > prev.open &&
              c.close < c.open &&
              c.close <= prev.open &&
              c.open >= prev.close;
            const belowMid =
              retestPrice != null && c.close < retestPrice;
            const rejectWick =
              c.high > (retestPrice ?? cons.lo) &&
              c.close < (retestPrice ?? cons.lo);
            if (bearish && (engulfs || belowMid || rejectWick)) {
              confirmIdx = i;
              break;
            }
          }
        }
      }

      // Require at least breakout + (FVG or retest) to reduce noise;
      // prefer full path for scan filter
      if (!fvg && retestIdx == null) continue;

      const seq: Seq = {
        bull,
        cons,
        boIdx,
        fvg,
        retestIdx,
        retestPrice,
        confirmIdx,
        volOk: vOk,
      };
      const rsiVal = lastFinite(rsiArr.slice(0, boIdx + 1));
      hits.push(buildHit(candles, seq, rsiVal));
    }
  }

  // Also surface pure consolidation near the end (status konsolidasyon)
  for (const lb of LOOKBACKS) {
    const cons = findConsolidation(candles, n - 1, lb);
    if (!cons) continue;
    const id = uid("bfrk");
    const last = candles[n - 1];
    hits.push({
      id,
      type: "breakout_fvg_retest",
      label: "Breakout·FVG·Retest (Konsolidasyon)",
      detail: `${lb} bar kutu · kırılım yok · RH ${cons.hi.toPrecision(6)}`,
      bias: "neutral",
      confidence: 0.4,
      tStart: candles[cons.start].time,
      tEnd: last.time,
      drawings: [
        box(
          `${id}_cons`,
          candles[cons.start].time,
          last.time,
          cons.lo,
          cons.hi,
          "rgba(41,98,255,0.12)",
          "Konsolidasyon"
        ),
        hline(
          `${id}_rh`,
          candles[cons.start].time,
          last.time,
          cons.hi,
          "#2962ff",
          "RH"
        ),
        hline(
          `${id}_rl`,
          candles[cons.start].time,
          last.time,
          cons.lo,
          "#2962ff",
          "RL"
        ),
      ],
      meta: {
        status: "konsolidasyon",
        score: 35,
        filterOk: false,
        kind: "breakout_fvg_retest",
        rangeHigh: cons.hi,
        rangeLow: cons.lo,
      },
    });
    break; // one consolidation box is enough
  }

  hits.sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd);
  const seen = new Set<string>();
  const out: PatternHit[] = [];
  for (const h of hits) {
    const key = `${h.bias}_${h.meta?.status}_${Math.round(
      (h.meta?.rangeHigh ?? 0) * 100
    )}_${Math.round((h.meta?.breakoutPrice ?? 0) * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 10) break;
  }
  return out;
}

export function isBreakoutFvgRetestType(type: PatternHit["type"]): boolean {
  return type === "breakout_fvg_retest";
}

export function passesBreakoutFvgRetestFilter(
  hit: PatternHit,
  minScore = 60
): boolean {
  if (!isBreakoutFvgRetestType(hit.type)) return false;
  const m = hit.meta;
  if (!m) return hit.confidence * 100 >= minScore;
  const phaseOk =
    m.status === "al_tetiklendi" ||
    m.status === "confirmation" ||
    m.status === "retest" ||
    m.status === "fvg";
  return phaseOk && (Boolean(m.filterOk) || m.score >= minScore);
}
