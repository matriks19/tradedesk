import type { Candle } from "@/lib/types";
import type { AdvancedPatternHit, AdvancedPatternFamily } from "./types";
import { detectHarmonics } from "./harmonics";
import { detectCandleFormations } from "./candles";
import { detectLiquidity } from "./liquidity";
import { toPatternHit } from "./types";

export * from "./types";
export { detectHarmonics } from "./harmonics";
export { detectCandleFormations } from "./candles";
export { detectLiquidity } from "./liquidity";

export interface AdvancedDetectOptions {
  families?: AdvancedPatternFamily[];
  names?: string[];
  swingStrength?: number;
  candleLookback?: number;
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
  const hits: AdvancedPatternHit[] = [];
  if (families.has("harmonic")) {
    hits.push(...detectHarmonics(candles, opts.swingStrength ?? 2));
  }
  if (families.has("candle")) {
    hits.push(...detectCandleFormations(candles, opts.candleLookback ?? 10));
  }
  if (families.has("liquidity") || families.has("structure")) {
    for (const h of detectLiquidity(candles, opts.swingStrength ?? 2)) {
      if (families.has(h.family)) hits.push(h);
      else if (h.family === "structure" && families.has("liquidity")) hits.push(h);
      else if (h.family === "liquidity" && families.has("structure")) hits.push(h);
    }
  }
  let out = hits;
  if (opts.names?.length) {
    const allow = new Set(opts.names);
    out = out.filter((h) => allow.has(h.name) || allow.has(h.family));
  }
  return out
    .sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd)
    .slice(0, 24);
}

export function detectAdvancedAsPatternHits(
  candles: Candle[],
  opts: AdvancedDetectOptions = {}
) {
  return detectAdvanced(candles, opts).map(toPatternHit);
}
