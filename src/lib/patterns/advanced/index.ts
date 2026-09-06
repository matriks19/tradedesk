import type { Candle } from "@/lib/types";
import type { AdvancedPatternHit, AdvancedPatternFamily, PatternStage } from "./types";
import { ACTIVE_PATTERN_STAGES, isActiveStage } from "./types";
import { detectHarmonics, type DetectHarmonicsOptions } from "./harmonics";
import { detectCandleFormations } from "./candles";
import { detectLiquidity } from "./liquidity";
import { toPatternHit } from "./types";

export * from "./types";
export { detectHarmonics, annotateStage } from "./harmonics";
export type { DetectHarmonicsOptions } from "./harmonics";
export { detectCandleFormations } from "./candles";
export { detectLiquidity } from "./liquidity";
export { drawXABCD, drawTargets, drawWolfe } from "./draw";

export interface AdvancedDetectOptions {
  families?: AdvancedPatternFamily[];
  names?: string[];
  swingStrength?: number;
  candleLookback?: number;
  /** Keep target_hit / invalid harmonics (default false) */
  includeCompleted?: boolean;
  maxBarsAgo?: number;
}

/** Annotate liquidity / candle hits with a coarse stage from TP1 / entry */
export function annotateLiquidityStage(
  hit: AdvancedPatternHit,
  candles: Candle[]
): AdvancedPatternHit {
  if (hit.stage) return hit;
  const n = candles.length;
  if (!n) return { ...hit, stage: "active" as PatternStage, barsAgo: 0 };
  const last = candles[n - 1];
  const bull = hit.direction === "bull";
  const tp1 = hit.tp1;
  const entry = hit.entry ?? last.close;
  // Find signal bar ≈ tEnd
  let signalBar = n - 1;
  for (let i = n - 1; i >= 0; i--) {
    if (candles[i].time <= hit.tEnd) {
      signalBar = i;
      break;
    }
  }
  let stage: PatternStage = "retest";
  if (tp1 != null) {
    for (let i = signalBar; i < n; i++) {
      const c = candles[i];
      if (bull && c.high >= tp1) {
        stage = "target_hit";
        break;
      }
      if (!bull && c.low <= tp1) {
        stage = "target_hit";
        break;
      }
    }
  }
  if (stage !== "target_hit") {
    const nearEntry =
      Math.abs(last.close - entry) / Math.max(Math.abs(entry), 1e-9) <= 0.012;
    if (nearEntry) stage = "retest";
    else if (bull && last.close > entry) stage = "active";
    else if (!bull && last.close < entry) stage = "active";
    else stage = "prz";
  }
  return {
    ...hit,
    stage,
    barsAgo: Math.max(0, n - 1 - signalBar),
  };
}

export function detectAdvanced(
  candles: Candle[],
  opts: AdvancedDetectOptions = {}
): AdvancedPatternHit[] {
  const families = new Set<AdvancedPatternFamily>(
    opts.families?.length
      ? opts.families
      : ["harmonic", "candle", "liquidity", "structure"]
  );
  const includeCompleted = opts.includeCompleted ?? false;
  const maxBarsAgo = opts.maxBarsAgo ?? 55;
  const hits: AdvancedPatternHit[] = [];

  if (families.has("harmonic")) {
    const hOpts: DetectHarmonicsOptions = {
      swingStrength: opts.swingStrength ?? 2,
      includeCompleted,
      maxBarsAgo,
    };
    hits.push(...detectHarmonics(candles, hOpts));
  }
  if (families.has("candle")) {
    hits.push(...detectCandleFormations(candles, opts.candleLookback ?? 10));
  }
  if (families.has("liquidity") || families.has("structure")) {
    for (const h of detectLiquidity(candles, opts.swingStrength ?? 2)) {
      const annotated = annotateLiquidityStage(h, candles);
      if (!includeCompleted && annotated.stage === "target_hit") continue;
      if ((annotated.barsAgo ?? 0) > maxBarsAgo) continue;
      if (families.has(annotated.family)) hits.push(annotated);
      else if (annotated.family === "structure" && families.has("liquidity"))
        hits.push(annotated);
      else if (annotated.family === "liquidity" && families.has("structure"))
        hits.push(annotated);
    }
  }

  let out = hits;
  if (opts.names?.length) {
    const allow = new Set(opts.names);
    out = out.filter((h) => allow.has(h.name) || allow.has(h.family));
  }

  // Prefer active / fresh
  out.sort(
    (a, b) =>
      (a.barsAgo ?? 999) - (b.barsAgo ?? 999) ||
      b.confidence - a.confidence ||
      b.tEnd - a.tEnd
  );
  return out.slice(0, 24);
}

export function detectAdvancedAsPatternHits(
  candles: Candle[],
  opts: AdvancedDetectOptions = {}
) {
  return detectAdvanced(candles, opts).map(toPatternHit);
}

export { ACTIVE_PATTERN_STAGES, isActiveStage };
