import type { BuiltinIndicatorId, ChartTimeframe } from "@/lib/types";
import type { StrategyPresetId } from "@/lib/backtest";

export type StrategyCategory =
  | "high_edge"
  | "elizi"
  | "momentum"
  | "mean_reversion"
  | "trend"
  | "smc_ict"
  | "session"
  | "swing"
  | "niche";

/** Intentional UI / filter chip order — do not rely on Object.keys alone. */
export const STRATEGY_CATEGORY_ORDER: StrategyCategory[] = [
  "high_edge",
  "elizi",
  "momentum",
  "trend",
  "mean_reversion",
  "smc_ict",
  "session",
  "swing",
  "niche",
];

export interface StrategyIndicatorSpec {
  type: BuiltinIndicatorId;
  params?: Record<string, number | string>;
  color?: string;
}

/** Literature / community estimates — NEVER presented as measured TradeDesk WR. */
export interface LiteratureEstimate {
  /** e.g. "~60–65%" */
  winRateHint?: string;
  /** e.g. "küçük avg R / yüksek WR tradeoff" */
  expectancyHint?: string;
  /** Short disclaimer shown next to hints */
  disclaimer?: string;
}

export interface StrategyPack {
  id: string;
  name: string;
  shortName: string;
  category: StrategyCategory;
  /** Inspiration / market source (YouTube / community) — not affiliation */
  inspiredBy: string;
  summary: string;
  howTo: string[];
  /** Chart TF to apply */
  timeframe: ChartTimeframe;
  allowShort: boolean;
  indicators: StrategyIndicatorSpec[];
  /** Replace pane indicators when applying */
  replaceIndicators?: boolean;
  risk: {
    rMultiple: number;
    /** Soft guidance shown in UI */
    tip: string;
  };
  backtestPreset?: StrategyPresetId;
  backtestExtras?: Record<string, number | boolean | string>;
  /** Scanner preset ids from SCANNER_PRESETS */
  scannerPresets?: string[];
  /** Extra scanner chip ids */
  scannerChips?: string[];
  tags: string[];
  /**
   * Optional literature / community claim + caveat for high_edge packs.
   * Shown in StrategiesPanel when present — not a measured win rate.
   */
  researchNote?: string;
  /** Optional literature WR / expectancy hints (disclaimer required in UI). */
  literatureEstimate?: LiteratureEstimate;
  /**
   * Soft rank within category for "all" / high_edge sort (higher = first).
   * Literature-inspired priority, not a measured edge score.
   */
  edgeScore?: number;
}

/** Insertion order = filter chip order (high_edge first). Prefer STRATEGY_CATEGORY_ORDER. */
export const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  high_edge: "Yüksek başarı",
  elizi: "Elizi Lab",
  momentum: "Momentum / ORB",
  mean_reversion: "Mean reversion",
  trend: "Trend",
  smc_ict: "SMC / ICT",
  session: "Seans / Killzone",
  swing: "Swing",
  niche: "Az bilinen",
};
