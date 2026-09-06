/** Shared scan freshness — intersection/cross only within last N bars. */
export const FRESHNESS_OPTIONS = [1, 2, 3] as const;
export type FreshnessBars = (typeof FRESHNESS_OPTIONS)[number];

/** Default max bars ago for oscillator / formation signal freshness. */
export const DEFAULT_MAX_BARS_AGO: FreshnessBars = 2;

export function clampMaxBarsAgo(n: number, hardMax = 20): number {
  if (!Number.isFinite(n)) return DEFAULT_MAX_BARS_AGO;
  return Math.min(hardMax, Math.max(0, Math.floor(n)));
}
