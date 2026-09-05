import type { Candle, TickerQuote } from "@/lib/types";
import type {
  CompareMode,
  FilterCondition,
  TechnicalFieldId,
} from "./fields";
import { fieldById } from "./fields";
import {
  computeFieldSeries,
  constValueSeries,
  priceSeriesFromCandles,
} from "./series";

export interface AdvancedFilter {
  id: string;
  field: TechnicalFieldId;
  condition: FilterCondition;
  compare: CompareMode;
  /** Primary numeric (or lower bound for Between) */
  value: number;
  /** Upper bound for Between */
  value2?: number;
  /** When compare === "series" */
  seriesField?: TechnicalFieldId;
}

export function createAdvancedFilter(
  field: TechnicalFieldId,
  partial?: Partial<Omit<AdvancedFilter, "id" | "field">>
): AdvancedFilter {
  const def = fieldById(field);
  return {
    id: `af_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    field,
    condition: partial?.condition ?? "above",
    compare: partial?.compare ?? def?.defaultCompare ?? "value",
    value: partial?.value ?? def?.defaultValue ?? 0,
    value2: partial?.value2 ?? def?.defaultValue2 ?? 100,
    seriesField: partial?.seriesField,
  };
}

export function describeAdvancedFilter(f: AdvancedFilter): string {
  const label = fieldById(f.field)?.label ?? f.field;
  const cond = f.condition.replace(/_/g, " ");
  if (f.condition === "between") {
    return `${label} ${cond} ${f.value}–${f.value2 ?? ""}`;
  }
  if (f.compare === "price") return `${label} ${cond} Price`;
  if (f.compare === "series") {
    const s = fieldById(f.seriesField ?? "sma20")?.label ?? f.seriesField;
    return `${label} ${cond} ${s}`;
  }
  return `${label} ${cond} ${f.value}`;
}

function nearEqual(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= scale * 1e-6 + 1e-9;
}

function evalAt(
  left: (number | null)[],
  right: (number | null)[],
  condition: FilterCondition,
  value2: number | undefined,
  i: number
): boolean {
  const l = left[i];
  const r = right[i];
  if (l == null) return false;

  if (condition === "between") {
    const lo = Math.min(r ?? 0, value2 ?? 0);
    const hi = Math.max(r ?? 0, value2 ?? 0);
    // For between, right series holds lower bound value constant
    return l >= lo && l <= hi;
  }

  if (r == null) return false;

  if (condition === "above") return l > r;
  if (condition === "below") return l < r;
  if (condition === "equals") return nearEqual(l, r);

  if (i < 1) return false;
  const lp = left[i - 1];
  const rp = right[i - 1];
  if (lp == null || rp == null) return false;

  if (condition === "crosses_above") return lp <= rp && l > r;
  if (condition === "crosses_below") return lp >= rp && l < r;
  return false;
}

function resolveRight(
  candles: Candle[],
  f: AdvancedFilter
): (number | null)[] {
  const n = candles.length;
  if (f.condition === "between") {
    return constValueSeries(n, f.value);
  }
  if (f.compare === "price") return priceSeriesFromCandles(candles);
  if (f.compare === "series" && f.seriesField) {
    return computeFieldSeries(candles, f.seriesField);
  }
  return constValueSeries(n, f.value);
}

export function matchAdvancedFilters(
  candles: Candle[] | null,
  filters: AdvancedFilter[],
  quote?: TickerQuote
): { ok: boolean; note: string; rsi?: number; atrPct?: number } {
  if (!filters.length) return { ok: true, note: "" };
  if (!candles || candles.length < 5) return { ok: false, note: "" };

  const notes: string[] = [];
  let lastRsi: number | undefined;
  let lastAtrPct: number | undefined;
  const i = candles.length - 1;

  for (const f of filters) {
    // change_pct can use ticker when available for last bar approx
    let left = computeFieldSeries(candles, f.field);
    if (f.field === "change_pct" && quote && Number.isFinite(quote.changePct)) {
      left = [...left];
      left[i] = quote.changePct;
    }
    const right = resolveRight(candles, f);
    const upper =
      f.condition === "between" ? f.value2 : undefined;
    // For between, right is lower (value), value2 is upper
    const ok = evalAt(left, right, f.condition, upper, i);
    if (!ok) return { ok: false, note: "" };

    const lv = left[i];
    if (f.field === "rsi" && lv != null) lastRsi = lv;
    if (f.field === "atr_pct" && lv != null) lastAtrPct = lv;
    notes.push(describeAdvancedFilter(f));
  }

  // Only fields required by active filters are computed above (no full 55-field sweep).
  // Do not enrich RSI/ATR unless a filter already requested those series.

  return {
    ok: true,
    note: notes.join(" · "),
    rsi: lastRsi,
    atrPct: lastAtrPct,
  };
}

export function advancedNeedsCandles(filters: AdvancedFilter[]): boolean {
  return filters.length > 0;
}
