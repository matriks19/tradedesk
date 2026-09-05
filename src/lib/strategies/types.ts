import type { BuiltinIndicatorId, ChartTimeframe } from "@/lib/types";
import type { StrategyPresetId } from "@/lib/backtest";

export type StrategyCategory =
  | "high_edge"
  | "momentum"
  | "mean_reversion"
  | "trend"
  | "smc_ict"
  | "session"
  | "swing"
  | "niche";

export interface StrategyIndicatorSpec {
  type: BuiltinIndicatorId;
  params?: Record<string, number | string>;
  color?: string;
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
}

/** Insertion order = filter chip order (high_edge first). */
export const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  high_edge: "Yüksek başarı",
  momentum: "Momentum / ORB",
  mean_reversion: "Mean reversion",
  trend: "Trend",
  smc_ict: "SMC / ICT",
  session: "Seans / Killzone",
  swing: "Swing",
  niche: "Az bilinen",
};
