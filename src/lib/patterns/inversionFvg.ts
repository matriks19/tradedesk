/**
 * Inversion FVG (IFVG) — ICT / Pinkman-style.
 *
 * Normal FVG fails → price closes through the gap (inversion) → role flip +
 * optional CHoCH → entry on IFVG zone retest.
 *
 * Logic is **bar-based** (relative lookbacks / fixed bar windows 5–40). Works
 * on any TF that FormationScanPanel already loads — no TF-hardcoded durations.
 *
 * Bullish IFVG:
 *   1. Bearish FVG during down move (c0.low > c2.high; top=c0.low, bot=c2.high)
 *   2. Candle closes fully above FVG top → inversion (zone flips to support)
 *   3. Prefer CHoCH: close above recent swing high of the downtrend
 *   4. ENTRY on pullback into IFVG (low ≤ top && high ≥ bot)
 *   5. STOP below reversal extreme (sweep low if present, else inversion swing low)
 *   6. TP1 prior swing / drop start; TP2 1.5R; TP3 2R
 *
 * Bearish IFVG: mirror.
 * Sweep Inversion: liquidity sweep wick before inversion → score boost.
 */
import type { Candle } from "@/lib/types";
import { fairValueGaps } from "@/lib/indicators/beluga";
import type { PatternDrawing, PatternHit } from "./types";
import { findSwings } from "./swings";

export type IfvgStatus =
  | "fvg"
  | "inversion"
  | "choch"
  | "retest"
  | "al_tetiklendi"
  | "sat_tetiklendi";

/** Relative / TF-agnostic bar windows */
const SWING_STRENGTH = 2;
/** Max bars after FVG to find inversion close */
const MAX_INV_LOOKFORWARD = 40;
/** Max bars after inversion to find retest / trigger */
const MAX_RETEST_LOOKFORWARD = 30;
/** Bars before FVG to search for liquidity sweep / drop-start swing */
const SWEEP_LOOKBACK = 20;
/** Min FVG height as fraction of mid price */
const MIN_FVG_PCT = 0.0008;
const MIN_SCORE_FILTER = 55;

export type InversionFvgOpts = {
  swingStrength?: number;
  maxInvLookforward?: number;
  maxRetestLookforward?: number;
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

type GapHit = {
  index: number; // i of candle2 in 3-candle FVG
  top: number;
  bot: number;
  /** classic gap direction: true = bullish FVG (support), false = bearish FVG (resistance) */
  bull: boolean;
};

/** Classic 3-candle FVGs (same rule as breakoutFvgRetest / beluga). */
export function findClassicFvgs(
  candles: Candle[],
  from: number,
  to: number
): GapHit[] {
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

type Seq = {
  /** Trade bias after inversion (bull IFVG from bearish FVG fail) */
  bull: boolean;
  fvg: GapHit;
  invIdx: number;
  chochIdx?: number;
  chochPrice?: number;
  retestIdx?: number;
  triggerIdx?: number;
  sweep: boolean;
  sweepIdx?: number;
  sweepPrice?: number;
  /** Absolute extreme for stop (reversal low/high) */
  extreme: number;
  /** Prior structure for TP1 (drop-start high / rally-start low) */
  structureTp: number;
};

function statusOf(s: Seq): IfvgStatus {
  if (s.triggerIdx != null) return s.bull ? "al_tetiklendi" : "sat_tetiklendi";
  if (s.retestIdx != null) return "retest";
  if (s.chochIdx != null) return "choch";
  if (s.invIdx >= 0) return "inversion";
  return "fvg";
}

function scoreSeq(s: Seq, status: IfvgStatus): { score: number; filterOk: boolean } {
  let score = 28;
  // FVG size quality (already filtered min)
  const mid = (s.fvg.top + s.fvg.bot) / 2 || 1;
  const gapPct = (s.fvg.top - s.fvg.bot) / mid;
  score += clamp(gapPct * 4000, 4, 14);
  score += 12; // inversion present (required for Seq)
  if (s.chochIdx != null) score += 12;
  if (s.retestIdx != null) score += 14;
  if (s.triggerIdx != null) score += 12;
  if (s.sweep) score += 14; // Sweep Inversion boost
  if (status === "al_tetiklendi" || status === "sat_tetiklendi") score += 6;
  score = Math.round(clamp(score, 0, 100));
  const triggered =
    status === "al_tetiklendi" || status === "sat_tetiklendi";
  const highQuality =
    s.sweep && s.chochIdx != null && (s.retestIdx != null || triggered);
  const filterOk =
    score >= MIN_SCORE_FILTER &&
    (triggered || highQuality || (s.retestIdx != null && score >= 65));
  return { score, filterOk };
}

function buildHit(candles: Candle[], s: Seq): PatternHit {
  const last = candles[candles.length - 1];
  const status = statusOf(s);
  const { score, filterOk } = scoreSeq(s, status);
  const bull = s.bull;
  const fvgTop = s.fvg.top;
  const fvgBot = s.fvg.bot;
  const fvgMid = (fvgTop + fvgBot) / 2;

  const entryIdx = s.triggerIdx ?? s.retestIdx ?? s.invIdx;
  const entry =
    s.retestIdx != null
      ? fvgMid
      : candles[s.invIdx].close;

  const stopBuf = Math.max((fvgTop - fvgBot) * 0.15, Math.abs(entry) * 0.0005);
  const stop = bull ? s.extreme - stopBuf : s.extreme + stopBuf;
  const risk = Math.abs(entry - stop) || Math.abs(entry) * 0.01;
  const riskR = risk;

  const tp1 = s.structureTp;
  const tp2 = bull ? entry + risk * 1.5 : entry - risk * 1.5;
  const tp3 = bull ? entry + risk * 2.0 : entry - risk * 2.0;

  // Prefer structure TP1 if it is in the trade direction and beyond entry
  const tp1Ok = bull ? tp1 > entry : tp1 < entry;
  const tp1Final = tp1Ok ? tp1 : bull ? entry + risk : entry - risk;
  // If structure is closer than 1R, still use it; else keep

  const signalIdx = s.triggerIdx ?? s.retestIdx ?? s.invIdx;
  const barsAgo = candles.length - 1 - signalIdx;

  const id = uid("ifvg");
  const tFvg0 = candles[Math.max(0, s.fvg.index - 2)].time;
  const tInv = candles[s.invIdx].time;
  const tEnd = last.time;
  const color = bull ? "#26a69a" : "#ef5350";
  // Zone flips: original gap color → inverted support/resistance color
  const preColor = bull
    ? "rgba(239,83,80,0.18)" // was bearish FVG (red)
    : "rgba(38,166,154,0.18)";
  const postColor = bull
    ? "rgba(38,166,154,0.28)"
    : "rgba(239,83,80,0.28)";

  const drawings: PatternDrawing[] = [
    box(
      `${id}_fvg`,
      tFvg0,
      tInv,
      fvgBot,
      fvgTop,
      preColor,
      bull ? "Bear FVG→IFVG" : "Bull FVG→IFVG"
    ),
    box(
      `${id}_ifvg`,
      tInv,
      tEnd,
      fvgBot,
      fvgTop,
      postColor,
      "IFVG"
    ),
    labelDraw(
      `${id}_invl`,
      tInv,
      candles[s.invIdx].close,
      "INVERSION",
      "#7e57c2"
    ),
    marker(
      `${id}_invm`,
      tInv,
      candles[s.invIdx].close,
      bull ? "bull" : "bear",
      "INV"
    ),
  ];

  if (s.sweep && s.sweepIdx != null) {
    drawings.push(
      marker(
        `${id}_sw`,
        candles[s.sweepIdx].time,
        s.sweepPrice ?? (bull ? candles[s.sweepIdx].low : candles[s.sweepIdx].high),
        bull ? "bull" : "bear",
        "SÜPÜRME"
      ),
      labelDraw(
        `${id}_swl`,
        candles[s.sweepIdx].time,
        s.sweepPrice ?? (bull ? candles[s.sweepIdx].low : candles[s.sweepIdx].high),
        "LİKİDİTE / SÜPÜRME",
        "#ffb74d"
      )
    );
  }

  if (s.chochIdx != null && s.chochPrice != null) {
    drawings.push(
      hline(
        `${id}_choch`,
        candles[Math.max(0, s.fvg.index - 5)].time,
        tEnd,
        s.chochPrice,
        "#42a5f5",
        "CHoCH",
        true
      ),
      labelDraw(
        `${id}_chochl`,
        candles[s.chochIdx].time,
        s.chochPrice,
        "CHoCH",
        "#42a5f5"
      )
    );
  }

  if (s.retestIdx != null) {
    drawings.push(
      labelDraw(
        `${id}_rt`,
        candles[s.retestIdx].time,
        fvgMid,
        "ENTRY / RETEST",
        "#ffb74d"
      ),
      marker(
        `${id}_rtm`,
        candles[s.retestIdx].time,
        fvgMid,
        bull ? "bull" : "bear",
        "RT"
      )
    );
  }

  if (s.triggerIdx != null) {
    drawings.push(
      marker(
        `${id}_al`,
        candles[s.triggerIdx].time,
        candles[s.triggerIdx].close,
        bull ? "bull" : "bear",
        bull ? "AL" : "SAT"
      ),
      labelDraw(
        `${id}_all`,
        candles[s.triggerIdx].time,
        candles[s.triggerIdx].close,
        bull ? "AL ✓" : "SAT ✓",
        color
      )
    );
  }

  drawings.push(
    hline(`${id}_entry`, tInv, tEnd, entry, "#42a5f5", "ENTRY", false),
    hline(`${id}_sl`, tInv, tEnd, stop, "#ef5350", "STOP"),
    hline(`${id}_tp1`, tInv, tEnd, tp1Final, "#26a69a", "HEDEF1"),
    hline(`${id}_tp2`, tInv, tEnd, tp2, "#66bb6a", "HEDEF2"),
    hline(`${id}_tp3`, tInv, tEnd, tp3, "#9ccc65", "HEDEF3")
  );

  const statusTr: Record<IfvgStatus, string> = {
    fvg: "FVG",
    inversion: "İnversion",
    choch: "CHoCH",
    retest: "Retest",
    al_tetiklendi: "AL tetiklendi",
    sat_tetiklendi: "SAT tetiklendi",
  };

  const label = bull
    ? s.sweep
      ? "IFVG·Süpürme AL"
      : "IFVG AL"
    : s.sweep
      ? "IFVG·Süpürme SAT"
      : "IFVG SAT";

  const detail = [
    statusTr[status],
    `skor ${score}`,
    s.sweep ? "süpürme" : "süpürme yok",
    barsAgo === 0 ? "şimdi" : `${barsAgo} mum önce`,
  ].join(" · ");

  return {
    id,
    type: "inversion_fvg",
    label,
    detail,
    bias: bull ? "bull" : "bear",
    confidence: clamp(score / 100, 0.35, 0.98),
    tStart: tFvg0,
    tEnd,
    drawings,
    meta: {
      status,
      score,
      filterOk,
      kind: "inversion_fvg",
      fvgTop,
      fvgBot,
      retestPrice: s.retestIdx != null ? fvgMid : undefined,
      entry,
      stop,
      tp1: tp1Final,
      tp2,
      tp3,
      targetPrice: tp1Final,
      barsAgo,
      sweep: s.sweep,
      chochPrice: s.chochPrice,
      riskR,
    },
  };
}

/**
 * Detect Inversion FVG setups on a candle series (any TF).
 * Only returns sequences that reached at least inversion.
 */
export function detectInversionFvg(
  candles: Candle[],
  opts: InversionFvgOpts = {}
): PatternHit[] {
  if (candles.length < 40) return [];

  const swingStrength = opts.swingStrength ?? SWING_STRENGTH;
  const maxInv = opts.maxInvLookforward ?? MAX_INV_LOOKFORWARD;
  const maxRetest = opts.maxRetestLookforward ?? MAX_RETEST_LOOKFORWARD;

  // Keep beluga FVG path warm / consistent with BFR
  void fairValueGaps(candles, 12);

  const n = candles.length;
  const swings = findSwings(candles, swingStrength);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");

  // Scan FVG formation in a recent window (leave room for inversion + retest)
  const fvgFrom = Math.max(2, n - 120);
  const fvgTo = Math.max(2, n - 3);
  const gaps = findClassicFvgs(candles, fvgFrom, fvgTo).filter((g) => {
    const mid = (g.top + g.bot) / 2 || 1;
    return (g.top - g.bot) / mid >= MIN_FVG_PCT;
  });

  const hits: PatternHit[] = [];

  for (const fvg of gaps) {
    // Bullish IFVG starts from a *bearish* classic FVG (fails as resistance).
    // Bearish IFVG starts from a *bullish* classic FVG (fails as support).
    const bullIfvg = !fvg.bull;

    const invEnd = Math.min(n - 1, fvg.index + maxInv);
    let invIdx = -1;
    for (let i = fvg.index + 1; i <= invEnd; i++) {
      const c = candles[i];
      if (bullIfvg) {
        // Close fully above FVG top
        if (c.close > fvg.top) {
          invIdx = i;
          break;
        }
      } else {
        if (c.close < fvg.bot) {
          invIdx = i;
          break;
        }
      }
    }
    if (invIdx < 0) continue;

    // Liquidity sweep before inversion: wick beyond recent swing, close back inside
    let sweep = false;
    let sweepIdx: number | undefined;
    let sweepPrice: number | undefined;
    const sweepFrom = Math.max(0, fvg.index - SWEEP_LOOKBACK);
    const recentLows = lows.filter(
      (s) => s.index >= sweepFrom && s.index < invIdx
    );
    const recentHighs = highs.filter(
      (s) => s.index >= sweepFrom && s.index < invIdx
    );

    if (bullIfvg) {
      // Prior liquidity: swing low strictly before the 3-candle FVG
      const priorLows = recentLows.filter((s) => s.index < fvg.index - 2);
      const refLow =
        priorLows.length > 0
          ? priorLows.reduce((m, x) => (x.price < m.price ? x : m))
          : null;
      if (refLow) {
        // Include invIdx: same-bar sweep wick + inversion close is valid
        for (let i = fvg.index - 1; i <= invIdx; i++) {
          if (i < 0) continue;
          const c = candles[i];
          if (c.low < refLow.price && c.close > refLow.price) {
            sweep = true;
            sweepIdx = i;
            sweepPrice = c.low;
            break;
          }
        }
      }
      // Fallback: wick beyond pre-FVG local min (exclude FVG triplet itself)
      if (!sweep) {
        let localMin = Infinity;
        for (let i = sweepFrom; i < fvg.index - 2; i++) {
          localMin = Math.min(localMin, candles[i].low);
        }
        if (Number.isFinite(localMin) && localMin < Infinity) {
          const pen = Math.abs(localMin) * 0.001;
          // Stricter than swing path: need a bar before inversion
          for (let i = fvg.index - 1; i < invIdx; i++) {
            if (i < 0) continue;
            const c = candles[i];
            if (c.low < localMin - pen && c.close > localMin) {
              sweep = true;
              sweepIdx = i;
              sweepPrice = c.low;
              break;
            }
          }
        }
      }
    } else {
      const priorHighs = recentHighs.filter((s) => s.index < fvg.index - 2);
      const refHigh =
        priorHighs.length > 0
          ? priorHighs.reduce((m, x) => (x.price > m.price ? x : m))
          : null;
      if (refHigh) {
        for (let i = fvg.index - 1; i <= invIdx; i++) {
          if (i < 0) continue;
          const c = candles[i];
          if (c.high > refHigh.price && c.close < refHigh.price) {
            sweep = true;
            sweepIdx = i;
            sweepPrice = c.high;
            break;
          }
        }
      }
      if (!sweep) {
        let localMax = -Infinity;
        for (let i = sweepFrom; i < fvg.index - 2; i++) {
          localMax = Math.max(localMax, candles[i].high);
        }
        if (Number.isFinite(localMax) && localMax > -Infinity) {
          const pen = Math.abs(localMax) * 0.001;
          for (let i = fvg.index - 1; i < invIdx; i++) {
            if (i < 0) continue;
            const c = candles[i];
            if (c.high > localMax + pen && c.close < localMax) {
              sweep = true;
              sweepIdx = i;
              sweepPrice = c.high;
              break;
            }
          }
        }
      }
    }

    // CHoCH: close beyond recent swing of the prior trend
    let chochIdx: number | undefined;
    let chochPrice: number | undefined;
    if (bullIfvg) {
      // Local structure: most recent swing high before FVG (not max of whole drop)
      const preHighs = highs.filter(
        (s) => s.index >= Math.max(0, fvg.index - 25) && s.index < fvg.index
      );
      let swingH: number;
      if (preHighs.length > 0) {
        swingH = preHighs[preHighs.length - 1].price;
      } else {
        // Local lower-high zone just before FVG (downtrend structure)
        const winFrom = Math.max(0, fvg.index - 8);
        swingH = Math.max(
          ...candles.slice(winFrom, fvg.index).map((c) => c.high)
        );
      }
      for (let i = fvg.index; i <= invIdx; i++) {
        if (candles[i].close > swingH) {
          chochIdx = i;
          chochPrice = swingH;
          break;
        }
      }
      if (chochIdx == null) {
        for (let i = invIdx; i <= Math.min(n - 1, invIdx + 8); i++) {
          if (candles[i].close > swingH) {
            chochIdx = i;
            chochPrice = swingH;
            break;
          }
        }
      }
    } else {
      const preLows = lows.filter(
        (s) => s.index >= Math.max(0, fvg.index - 25) && s.index < fvg.index
      );
      let swingL: number;
      if (preLows.length > 0) {
        swingL = preLows[preLows.length - 1].price;
      } else {
        const winFrom = Math.max(0, fvg.index - 8);
        swingL = Math.min(
          ...candles.slice(winFrom, fvg.index).map((c) => c.low)
        );
      }
      for (let i = fvg.index; i <= invIdx; i++) {
        if (candles[i].close < swingL) {
          chochIdx = i;
          chochPrice = swingL;
          break;
        }
      }
      if (chochIdx == null) {
        for (let i = invIdx; i <= Math.min(n - 1, invIdx + 8); i++) {
          if (candles[i].close < swingL) {
            chochIdx = i;
            chochPrice = swingL;
            break;
          }
        }
      }
    }

    // Absolute extreme for stop
    const extFrom = sweepIdx ?? Math.max(0, fvg.index - 5);
    let extreme = bullIfvg
      ? Math.min(
          ...candles.slice(extFrom, invIdx + 1).map((c) => c.low)
        )
      : Math.max(
          ...candles.slice(extFrom, invIdx + 1).map((c) => c.high)
        );
    if (sweep && sweepPrice != null) {
      extreme = bullIfvg
        ? Math.min(extreme, sweepPrice)
        : Math.max(extreme, sweepPrice);
    }

    // Structure TP1: start of the drop (prior swing high) / rally (prior swing low)
    let structureTp: number;
    if (bullIfvg) {
      const dropStartHighs = highs.filter(
        (s) => s.index >= Math.max(0, fvg.index - 35) && s.index <= fvg.index
      );
      structureTp =
        dropStartHighs.length > 0
          ? dropStartHighs.reduce((m, x) => (x.price > m.price ? x : m)).price
          : Math.max(
              ...candles
                .slice(Math.max(0, fvg.index - 25), fvg.index + 1)
                .map((c) => c.high)
            );
    } else {
      const rallyStartLows = lows.filter(
        (s) => s.index >= Math.max(0, fvg.index - 35) && s.index <= fvg.index
      );
      structureTp =
        rallyStartLows.length > 0
          ? rallyStartLows.reduce((m, x) => (x.price < m.price ? x : m)).price
          : Math.min(
              ...candles
                .slice(Math.max(0, fvg.index - 25), fvg.index + 1)
                .map((c) => c.low)
            );
    }

    // Retest after inversion: touch/enter IFVG zone
    let retestIdx: number | undefined;
    let triggerIdx: number | undefined;
    const retestEnd = Math.min(n - 1, invIdx + maxRetest);
    for (let i = invIdx + 1; i <= retestEnd; i++) {
      const c = candles[i];
      const touches = c.low <= fvg.top && c.high >= fvg.bot;
      if (!touches) continue;

      if (bullIfvg) {
        // Prefer hold: close back above mid / not closing fully back below bot
        const holds = c.close >= fvg.bot;
        if (!holds) continue;
        retestIdx = i;
        // Trigger = retest bar that holds, or next bullish confirmation
        if (c.close > c.open || c.close >= (fvg.top + fvg.bot) / 2) {
          triggerIdx = i;
        } else if (i + 1 <= retestEnd) {
          const n1 = candles[i + 1];
          if (n1.close > n1.open && n1.close >= fvg.bot) {
            triggerIdx = i + 1;
          } else {
            triggerIdx = i;
          }
        } else {
          triggerIdx = i;
        }
        break;
      } else {
        const holds = c.close <= fvg.top;
        if (!holds) continue;
        retestIdx = i;
        if (c.close < c.open || c.close <= (fvg.top + fvg.bot) / 2) {
          triggerIdx = i;
        } else if (i + 1 <= retestEnd) {
          const n1 = candles[i + 1];
          if (n1.close < n1.open && n1.close <= fvg.top) {
            triggerIdx = i + 1;
          } else {
            triggerIdx = i;
          }
        } else {
          triggerIdx = i;
        }
        break;
      }
    }

    const seq: Seq = {
      bull: bullIfvg,
      fvg,
      invIdx,
      chochIdx,
      chochPrice,
      retestIdx,
      triggerIdx,
      sweep,
      sweepIdx,
      sweepPrice,
      extreme,
      structureTp,
    };
    hits.push(buildHit(candles, seq));
  }

  hits.sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd);
  const seen = new Set<string>();
  const out: PatternHit[] = [];
  for (const h of hits) {
    const key = `${h.bias}_${Math.round((h.meta?.fvgTop ?? 0) * 1e4)}_${Math.round(
      (h.meta?.fvgBot ?? 0) * 1e4
    )}_${h.meta?.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 12) break;
  }
  return out;
}

export function isInversionFvgType(type: PatternHit["type"]): boolean {
  return type === "inversion_fvg";
}

/** Score ≥55 and entry triggered, or high-quality (sweep+CHoCH) setup. */
export function passesInversionFvgFilter(
  hit: PatternHit,
  minScore = MIN_SCORE_FILTER
): boolean {
  if (!isInversionFvgType(hit.type)) return false;
  const m = hit.meta;
  if (!m) return hit.confidence * 100 >= minScore;
  const triggered =
    m.status === "al_tetiklendi" || m.status === "sat_tetiklendi";
  const phaseOk =
    triggered ||
    m.status === "retest" ||
    m.status === "choch" ||
    m.status === "inversion";
  if (!phaseOk) return false;
  if (Boolean(m.filterOk)) return true;
  if (triggered && m.score >= minScore) return true;
  if (m.sweep && m.score >= minScore + 5) return true;
  return m.score >= Math.max(minScore, 65) && m.status === "retest";
}
