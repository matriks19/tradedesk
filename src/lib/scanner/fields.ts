/**
 * Advanced technical filter field catalog (MCC-inspired).
 * Series are computed from klines in series.ts.
 */

export type FilterCondition =
  | "above"
  | "below"
  | "crosses_above"
  | "crosses_below"
  | "between"
  | "equals";

export type CompareMode = "value" | "price" | "series";

export type TechnicalFieldId =
  | "rsi"
  | "stoch_k"
  | "stoch_d"
  | "stochrsi_k"
  | "stochrsi_d"
  | "macd"
  | "macd_signal"
  | "macd_hist"
  | "cci"
  | "roc"
  | "williams_r"
  | "ao"
  | "uo"
  | "bbp"
  | "sma20"
  | "sma50"
  | "sma200"
  | "ema9"
  | "ema21"
  | "ema50"
  | "hma20"
  | "vwma20"
  | "bb_upper"
  | "bb_mid"
  | "bb_lower"
  | "bb_pctb"
  | "bb_width"
  | "keltner_upper"
  | "keltner_lower"
  | "donchian_upper"
  | "donchian_lower"
  | "psar"
  | "supertrend_dir"
  | "atr"
  | "atr_pct"
  | "adr_pct"
  | "vwap"
  | "volume"
  | "volume_sma20"
  | "volume_spike"
  | "mfi"
  | "obv_slope"
  | "ichi_tenkan"
  | "ichi_kijun"
  | "ichi_span_a"
  | "ichi_span_b"
  | "change_pct"
  | "price"
  | "pat_doji"
  | "pat_hammer"
  | "pat_shooting_star"
  | "pat_engulf_bull"
  | "pat_engulf_bear"
  | "ma_rating"
  | "osc_rating"
  | "adx"
  | "plus_di"
  | "minus_di"
  | "aroon_up"
  | "aroon_down"
  | "aroon_osc"
  | "jurik_stoch_k"
  | "jurik_stoch_d"
  | "jurik_kase_k"
  | "jurik_kase_d";

export interface TechnicalFieldDef {
  id: TechnicalFieldId;
  label: string;
  group: string;
  /** Default compare mode when adding a filter */
  defaultCompare: CompareMode;
  /** Suggested numeric value (e.g. RSI 30) */
  defaultValue?: number;
  defaultValue2?: number;
  /** Prefer value compare (oscillators) vs price (MAs) */
  keywords?: string;
}

export const TECHNICAL_FIELDS: TechnicalFieldDef[] = [
  { id: "rsi", label: "RSI (14)", group: "Oscillators", defaultCompare: "value", defaultValue: 30, keywords: "rsi relative strength" },
  { id: "stoch_k", label: "Stochastic %K", group: "Oscillators", defaultCompare: "value", defaultValue: 20, keywords: "stoch" },
  { id: "stoch_d", label: "Stochastic %D", group: "Oscillators", defaultCompare: "value", defaultValue: 20, keywords: "stoch" },
  { id: "stochrsi_k", label: "StochRSI %K", group: "Oscillators", defaultCompare: "value", defaultValue: 20, keywords: "stochrsi" },
  { id: "stochrsi_d", label: "StochRSI %D", group: "Oscillators", defaultCompare: "value", defaultValue: 20, keywords: "stochrsi" },
  { id: "macd", label: "MACD line", group: "Oscillators", defaultCompare: "value", defaultValue: 0, keywords: "macd" },
  { id: "macd_signal", label: "MACD signal", group: "Oscillators", defaultCompare: "value", defaultValue: 0, keywords: "macd" },
  { id: "macd_hist", label: "MACD hist", group: "Oscillators", defaultCompare: "value", defaultValue: 0, keywords: "macd histogram" },
  { id: "cci", label: "CCI (20)", group: "Oscillators", defaultCompare: "value", defaultValue: -100, keywords: "cci" },
  { id: "roc", label: "ROC (12)", group: "Oscillators", defaultCompare: "value", defaultValue: 0, keywords: "roc rate" },
  { id: "williams_r", label: "Williams %R", group: "Oscillators", defaultCompare: "value", defaultValue: -80, keywords: "williams wr" },
  { id: "ao", label: "Awesome Oscillator", group: "Oscillators", defaultCompare: "value", defaultValue: 0, keywords: "ao awesome" },
  { id: "uo", label: "Ultimate Oscillator", group: "Oscillators", defaultCompare: "value", defaultValue: 30, keywords: "uo ultimate" },
  { id: "bbp", label: "Bull Bear Power", group: "Oscillators", defaultCompare: "value", defaultValue: 0, keywords: "bbp elder bull bear" },
  { id: "mfi", label: "MFI (14)", group: "Volume", defaultCompare: "value", defaultValue: 20, keywords: "mfi money flow" },
  { id: "obv_slope", label: "OBV slope (5)", group: "Volume", defaultCompare: "value", defaultValue: 0, keywords: "obv" },
  { id: "volume", label: "Volume", group: "Volume", defaultCompare: "value", defaultValue: 0, keywords: "volume hacim" },
  { id: "volume_sma20", label: "Volume SMA(20)", group: "Volume", defaultCompare: "value", defaultValue: 0, keywords: "volume sma" },
  { id: "volume_spike", label: "Volume / SMA(20)", group: "Volume", defaultCompare: "value", defaultValue: 2, keywords: "volume spike" },
  { id: "sma20", label: "SMA 20", group: "Moving Averages", defaultCompare: "price", keywords: "sma ma" },
  { id: "sma50", label: "SMA 50", group: "Moving Averages", defaultCompare: "price", keywords: "sma ma" },
  { id: "sma200", label: "SMA 200", group: "Moving Averages", defaultCompare: "price", keywords: "sma ma" },
  { id: "ema9", label: "EMA 9", group: "Moving Averages", defaultCompare: "price", keywords: "ema" },
  { id: "ema21", label: "EMA 21", group: "Moving Averages", defaultCompare: "price", keywords: "ema" },
  { id: "ema50", label: "EMA 50", group: "Moving Averages", defaultCompare: "price", keywords: "ema" },
  { id: "hma20", label: "HMA 20", group: "Moving Averages", defaultCompare: "price", keywords: "hma hull" },
  { id: "vwma20", label: "VWMA 20", group: "Moving Averages", defaultCompare: "price", keywords: "vwma" },
  { id: "bb_upper", label: "Bollinger Upper", group: "Bands", defaultCompare: "price", keywords: "bollinger bb" },
  { id: "bb_mid", label: "Bollinger Mid", group: "Bands", defaultCompare: "price", keywords: "bollinger bb" },
  { id: "bb_lower", label: "Bollinger Lower", group: "Bands", defaultCompare: "price", keywords: "bollinger bb" },
  { id: "bb_pctb", label: "Bollinger %B", group: "Bands", defaultCompare: "value", defaultValue: 1, keywords: "percentb %b" },
  { id: "bb_width", label: "Bollinger Width", group: "Bands", defaultCompare: "value", defaultValue: 0.05, keywords: "bb width" },
  { id: "keltner_upper", label: "Keltner Upper", group: "Bands", defaultCompare: "price", keywords: "keltner" },
  { id: "keltner_lower", label: "Keltner Lower", group: "Bands", defaultCompare: "price", keywords: "keltner" },
  { id: "donchian_upper", label: "Donchian Upper", group: "Bands", defaultCompare: "price", keywords: "donchian" },
  { id: "donchian_lower", label: "Donchian Lower", group: "Bands", defaultCompare: "price", keywords: "donchian" },
  { id: "psar", label: "Parabolic SAR", group: "Trend", defaultCompare: "price", keywords: "psar sar parabolic" },
  { id: "supertrend_dir", label: "Supertrend direction", group: "Trend", defaultCompare: "value", defaultValue: 1, keywords: "supertrend st" },
  { id: "atr", label: "ATR (14)", group: "Volatility", defaultCompare: "value", defaultValue: 0, keywords: "atr" },
  { id: "atr_pct", label: "ATR %", group: "Volatility", defaultCompare: "value", defaultValue: 2, keywords: "atr percent" },
  { id: "adr_pct", label: "ADR % (14)", group: "Volatility", defaultCompare: "value", defaultValue: 2, keywords: "adr average daily range" },
  { id: "vwap", label: "VWAP", group: "Volume", defaultCompare: "price", keywords: "vwap" },
  { id: "ichi_tenkan", label: "Ichimoku Conversion", group: "Ichimoku", defaultCompare: "price", keywords: "ichimoku tenkan" },
  { id: "ichi_kijun", label: "Ichimoku Base", group: "Ichimoku", defaultCompare: "price", keywords: "ichimoku kijun" },
  { id: "ichi_span_a", label: "Ichimoku Span A", group: "Ichimoku", defaultCompare: "price", keywords: "ichimoku span cloud" },
  { id: "ichi_span_b", label: "Ichimoku Span B", group: "Ichimoku", defaultCompare: "price", keywords: "ichimoku span cloud" },
  { id: "change_pct", label: "Change %", group: "Price", defaultCompare: "value", defaultValue: 3, keywords: "change pct delta" },
  { id: "price", label: "Price (close)", group: "Price", defaultCompare: "value", defaultValue: 0, keywords: "price close last" },
  { id: "pat_doji", label: "Pattern: Doji", group: "Patterns", defaultCompare: "value", defaultValue: 1, keywords: "pattern doji candle" },
  { id: "pat_hammer", label: "Pattern: Hammer", group: "Patterns", defaultCompare: "value", defaultValue: 1, keywords: "pattern hammer" },
  { id: "pat_shooting_star", label: "Pattern: Shooting star", group: "Patterns", defaultCompare: "value", defaultValue: 1, keywords: "pattern shooting" },
  { id: "pat_engulf_bull", label: "Pattern: Engulf bull", group: "Patterns", defaultCompare: "value", defaultValue: 1, keywords: "pattern engulfing" },
  { id: "pat_engulf_bear", label: "Pattern: Engulf bear", group: "Patterns", defaultCompare: "value", defaultValue: 1, keywords: "pattern engulfing" },
  {
    id: "ma_rating",
    label: "MA rating (−1/0/1)",
    group: "Ratings",
    defaultCompare: "value",
    defaultValue: 1,
    keywords: "ma rating heuristic",
  },
  {
    id: "osc_rating",
    label: "Osc rating (−1/0/1)",
    group: "Ratings",
    defaultCompare: "value",
    defaultValue: 1,
    keywords: "oscillator rating heuristic",
  },
  { id: "adx", label: "ADX (14)", group: "Trend", defaultCompare: "value", defaultValue: 25, keywords: "adx trend strength" },
  { id: "plus_di", label: "+DI (14)", group: "Trend", defaultCompare: "value", defaultValue: 25, keywords: "di+ dmi directional" },
  { id: "minus_di", label: "−DI (14)", group: "Trend", defaultCompare: "value", defaultValue: 25, keywords: "di- dmi directional" },
  { id: "aroon_up", label: "Aroon Up", group: "Trend", defaultCompare: "value", defaultValue: 70, keywords: "aroon aaron up" },
  { id: "aroon_down", label: "Aroon Down", group: "Trend", defaultCompare: "value", defaultValue: 30, keywords: "aroon aaron down" },
  { id: "aroon_osc", label: "Aroon Osc", group: "Trend", defaultCompare: "value", defaultValue: 0, keywords: "aroon oscillator" },
  { id: "jurik_stoch_k", label: "Jurik Stoch %K", group: "Jurik", defaultCompare: "value", defaultValue: 20, keywords: "jurik stoch kase" },
  { id: "jurik_stoch_d", label: "Jurik Stoch %D", group: "Jurik", defaultCompare: "value", defaultValue: 20, keywords: "jurik stoch" },
  { id: "jurik_kase_k", label: "Jurik Kase %K", group: "Jurik", defaultCompare: "value", defaultValue: 20, keywords: "jurik kase stoch" },
  { id: "jurik_kase_d", label: "Jurik Kase %D", group: "Jurik", defaultCompare: "value", defaultValue: 20, keywords: "jurik kase stoch" },
];

export const FILTER_CONDITIONS: { id: FilterCondition; label: string }[] = [
  { id: "above", label: "Above" },
  { id: "below", label: "Below" },
  { id: "crosses_above", label: "Crosses Above" },
  { id: "crosses_below", label: "Crosses Below" },
  { id: "between", label: "Between" },
  { id: "equals", label: "Equals" },
];

export const COMPARE_MODES: { id: CompareMode; label: string }[] = [
  { id: "value", label: "Value" },
  { id: "price", label: "Price" },
  { id: "series", label: "Series" },
];

/** Scan timeframes (small TF set) with dual labels for hour bars. */
export const SCAN_TIMEFRAMES: { value: string; label: string; minutes: number }[] = [
  { value: "1m", label: "1m", minutes: 1 },
  { value: "3m", label: "3m", minutes: 3 },
  { value: "5m", label: "5m", minutes: 5 },
  { value: "10m", label: "10m", minutes: 10 },
  { value: "15m", label: "15m", minutes: 15 },
  { value: "30m", label: "30m", minutes: 30 },
  { value: "1h", label: "1h (60)", minutes: 60 },
  { value: "2h", label: "2h (120)", minutes: 120 },
  { value: "4h", label: "4h (240)", minutes: 240 },
];

export function fieldById(id: TechnicalFieldId): TechnicalFieldDef | undefined {
  return TECHNICAL_FIELDS.find((f) => f.id === id);
}

export function searchFields(query: string): TechnicalFieldDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return TECHNICAL_FIELDS;
  return TECHNICAL_FIELDS.filter(
    (f) =>
      f.label.toLowerCase().includes(q) ||
      f.id.includes(q) ||
      f.group.toLowerCase().includes(q) ||
      (f.keywords ?? "").includes(q)
  );
}

/**
 * MA / Osc ratings are heuristic stubs (−1 bearish, 0 neutral, +1 bullish)
 * from a few simple rules — not a TradingView composite rating clone.
 */
export const RATING_DOC =
  "Heuristic stub: MA rating from price vs SMA20/50/200 majority; Osc rating from RSI/Stoch/CCI zone votes. Values are −1 / 0 / +1 only.";
