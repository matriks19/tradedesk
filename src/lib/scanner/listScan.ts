import type { Candle } from "@/lib/types";
import { hamJurikTpo } from "@/lib/indicators/hamJurikTpo";
import { recentDiagonalSr } from "@/lib/indicators/diagonalSr";
import {
  adx,
  closes,
  macd,
  stochastic,
  rsi,
  mfi,
  cci,
  cmf,
  roc,
  obv,
} from "@/lib/indicators/math";
import {
  doktorHull,
  DOKTOR_HULL_MIN_BARS,
  type HullMode,
} from "@/lib/indicators/doktorHull";
import {
  hamAoJrmaZ,
  HAM_AO_JRMA_Z_MIN_BARS,
} from "@/lib/indicators/hamAoJrmaZ";
import {
  aohamJrmaEngine,
  AOHAM_JRMA_MIN_BARS,
} from "@/lib/indicators/aohamJrmaEngine";
import {
  goldKeko,
  GOLD_KEKO_MIN_BARS,
  GOLD_KEKO_FETCH_LIMIT,
} from "@/lib/indicators/goldKeko";
import {
  computeOscDivergence,
  pickOscSeries,
  LIST_SCAN_DIV_OPTS,
  type OscDivergenceOpts,
} from "@/lib/indicators/oscDivergence";
import type { ScannerFilter } from "@/lib/scanner/engine";
import { runCustomScript } from "@/lib/scripts/sandbox";
import { convertAny } from "@/lib/scripts/pine/translate";

export type HamCond =
  | "raw_up"
  | "raw_dn"
  | "hist_zero_up"
  | "hist_zero_dn"
  | "hist_pos"
  | "hist_neg"
  | "hist_turn"
  | "raw_x_hist_up"
  | "raw_x_hist_dn"
  | "raw_x_osc_up"
  | "raw_x_osc_dn"
  | "dual_up"
  | "dual_dn"
  | "raw_dual_up"
  | "raw_dual_dn"
  | "raw_slow_up"
  | "raw_slow_dn"
  | "raw_slow_x_osc_up"
  | "raw_slow_x_osc_dn"
  | "osc_fast_up"
  | "osc_fast_dn"
  | "osc_slow_up"
  | "osc_slow_dn"
  | "osc_fast_zero_up"
  | "osc_fast_zero_dn"
  | "osc_slow_zero_up"
  | "osc_slow_zero_dn"
  | "setup"
  | "confirm"
  | "al";

export type MacdCond =
  | "cross_up"
  | "cross_dn"
  | "hist_zero_up"
  | "hist_zero_dn"
  | "hist_pos"
  | "hist_neg";

export type StochCond = "os" | "ob" | "kx_up" | "kx_dn" | "kx_up_os" | "kx_dn_ob";

export type DiagCond =
  | "bounce"
  | "break"
  | "twin_bull"
  | "twin_bear"
  | "triple_bull"
  | "triple_bear";

export type DiCond =
  | "plus_x_minus"
  | "minus_x_plus"
  | "plus_above"
  | "minus_above"
  | "adx_above";

export type HullCond =
  | "al"
  | "sat"
  | "c50_100"
  | "c50_200"
  | "c100_200"
  | "c21_50"
  | "c21_100"
  | "chart_al"
  | "chart_sat";

export type HamAoCond =
  | "rma_up_pt"
  | "ao_up_pt"
  | "ao_up_nt"
  | "pt_x_nt"
  | "nt_x_pt";

export type GoldCond =
  | "ao_x_score_al"
  | "ao_x_rma_al"
  | "ao_x_score_sat"
  | "ao_x_rma_sat"
  | "pt_x_nt"
  | "nt_x_pt"
  | "div_bull"
  | "div_bear"
  | "div_hid_bull"
  | "div_hid_bear";

/** All Gold chip ids — used when enabled with empty conds / on enable reset. */
export const ALL_GOLD_CONDS: GoldCond[] = [
  "ao_x_score_al",
  "ao_x_rma_al",
  "ao_x_score_sat",
  "ao_x_rma_sat",
  "pt_x_nt",
  "nt_x_pt",
  "div_bull",
  "div_bear",
  "div_hid_bull",
  "div_hid_bear",
];

export type Gold2Cond =
  | "raw_x_rma_al"
  | "raw_x_rma_sat"
  | "core_x_rma_al"
  | "core_x_rma_sat"
  | "disp_x_rma_al"
  | "disp_x_rma_sat"
  | "breakout_up_aligned"
  | "breakout_down_aligned"
  | "breakout_up_counter"
  | "breakout_down_counter"
  | "charge_full_bull"
  | "charge_full_bear"
  | "polarity_flip_up"
  | "polarity_flip_down"
  | "div_bull"
  | "div_bear"
  | "div_hid_bull"
  | "div_hid_bear";

/** All Gold2 chip ids — used when enabled with empty conds / on enable reset. */
export const ALL_GOLD2_CONDS: Gold2Cond[] = [
  "raw_x_rma_al",
  "raw_x_rma_sat",
  "core_x_rma_al",
  "core_x_rma_sat",
  "disp_x_rma_al",
  "disp_x_rma_sat",
  "breakout_up_aligned",
  "breakout_down_aligned",
  "breakout_up_counter",
  "breakout_down_counter",
  "charge_full_bull",
  "charge_full_bear",
  "polarity_flip_up",
  "polarity_flip_down",
  "div_bull",
  "div_bear",
  "div_hid_bull",
  "div_hid_bear",
];


export type DivOscId =
  | "rsi"
  | "mfi"
  | "cci"
  | "cmf"
  | "roc"
  | "macd_hist"
  | "stoch"
  | "obv";

export type DivTypeId =
  | "reg_bull"
  | "reg_bear"
  | "hid_bull"
  | "hid_bear";

/** Cond id for hits/alarms: `rsi|reg_bull`, `mfi|hid_bear`, … */
export type DivScanCond = `${DivOscId}|${DivTypeId}`;

export const ALL_DIV_OSC: DivOscId[] = [
  "rsi",
  "mfi",
  "cci",
  "cmf",
  "roc",
  "macd_hist",
  "stoch",
  "obv",
];

/** Research shortlist — default oscillators ON. */
export const DEFAULT_DIV_OSC: DivOscId[] = ["rsi", "mfi", "cci", "roc"];

export const ALL_DIV_TYPES: DivTypeId[] = [
  "reg_bull",
  "reg_bear",
  "hid_bull",
  "hid_bear",
];

/** Default types: all four ON (“ne varsa çıksın”). */
export const DEFAULT_DIV_TYPES: DivTypeId[] = [...ALL_DIV_TYPES];

export const DIV_OSC_LABEL: Record<DivOscId, string> = {
  rsi: "RSI",
  mfi: "MFI",
  cci: "CCI",
  cmf: "CMF",
  roc: "ROC",
  macd_hist: "MACD hist",
  stoch: "Stoch %K",
  obv: "OBV",
};

export const DIV_TYPE_LABEL: Record<DivTypeId, string> = {
  reg_bull: "Reg AL",
  reg_bear: "Reg SAT",
  hid_bull: "Gizli AL",
  hid_bear: "Gizli SAT",
};

/** Chart indicator to drop for a given oscillator. */
export const DIV_OSC_TO_INDICATOR: Record<DivOscId, string> = {
  rsi: "rsiPuNu",
  mfi: "mfi",
  cci: "cci",
  cmf: "cmf",
  roc: "roc",
  macd_hist: "macd",
  stoch: "stochastic",
  obv: "obv",
};

/** Fetch ≥ max(150, rangeUpper+50) ≈ 220 — do not pull 500. */
export const DIV_SCAN_FETCH_LIMIT = 220;
export const DIV_SCAN_MIN_BARS = 150;

/** UI default chip lists — used when enabled with empty conds (never silent []). */
export const DEFAULT_HAM_CONDS: HamCond[] = ["raw_dual_up"];
export const DEFAULT_DIAG_CONDS: DiagCond[] = ["bounce"];
export const DEFAULT_MACD_CONDS: MacdCond[] = ["cross_up"];
export const DEFAULT_STOCH_CONDS: StochCond[] = ["kx_up_os"];
export const DEFAULT_DI_CONDS: DiCond[] = ["plus_x_minus"];
export const DEFAULT_HULL_CONDS: HullCond[] = ["al"];
export const DEFAULT_HAM_AO_CONDS: HamAoCond[] = [
  "rma_up_pt",
  "ao_up_pt",
  "pt_x_nt",
];

export type ListScanKind =
  | "ham"
  | "macd"
  | "stoch"
  | "diag"
  | "di"
  | "hull"
  | "hamAo"
  | "gold"
  | "gold2"
  | "divScan"
  | "pine";

export type PineCond =
  | "zero_up"
  | "zero_dn"
  | "cross_up"
  | "cross_dn"
  | "up"
  | "dn";

export type PineScriptScan = {
  id: string;
  name: string;
  code: string;
  language: "td" | "pine" | "js";
  conds: PineCond[];
};

export type ListScanHit = {
  kind: ListScanKind;
  cond: string;
  bias: "bull" | "bear" | "neutral";
  barsAgo: number;
  note: string;
};

export type ListScanConfig = {
  matchMode?: "any" | "all";
  ham?: {
    enabled: boolean;
    conds: HamCond[];
    hamLen?: number;
    hamLenSlow?: number;
    rawLen?: number;
    rawLenSlow?: number;
    momSpan?: number;
    normLen?: number;
    jLen?: number;
    jPhase?: number;
    postSmooth?: number;
    colorOsc?: string;
    colorRaw?: string;
    colorHistUp?: string;
    colorHistDn?: string;
    colorSlow?: string;
    colorRawSlow?: string;
  };
  diag?: {
    enabled: boolean;
    conds: DiagCond[];
    pivotWindow?: number;
    historyBars?: number;
    left?: number;
    right?: number;
    colorSup?: string;
    colorRes?: string;
  };
  macd?: {
    enabled: boolean;
    conds: MacdCond[];
    fast?: number;
    slow?: number;
    signal?: number;
    colorMacd?: string;
    colorSignal?: string;
    colorHist?: string;
    colorHistUp?: string;
    colorHistDn?: string;
    colorSlow?: string;
    colorRawSlow?: string;
  };
  stoch?: {
    enabled: boolean;
    conds: StochCond[];
    kPeriod?: number;
    dPeriod?: number;
    os?: number;
    ob?: number;
    colorK?: string;
    colorD?: string;
  };
  di?: {
    enabled: boolean;
    conds: DiCond[];
    period?: number;
    adxMin?: number;
  };
  hull?: {
    enabled: boolean;
    conds: HullCond[];
    /** Hull type — matches Pine Doktor Hull */
    mode?: HullMode;
    /**
     * Preferred scan TF (Pine tfScan default 240 → 4h).
     * When set, Liste fetch uses this TF instead of the panel TF.
     */
    tf?: string;
    color8?: string;
    color13?: string;
    color21?: string;
    color50?: string;
    color100?: string;
    color200?: string;
  };
  hamAo?: {
    enabled: boolean;
    conds: HamAoCond[];
    hamMomLen?: number;
    volBaseLen?: number;
    hamPower?: number;
    aoFast?: number;
    aoSlow?: number;
    hamWeight?: number;
    aoWeight?: number;
    trendLen?: number;
    trendBoost?: number;
    preSmoothLen?: number;
    jurikLen?: number;
    rmaLen?: number;
    postSmoothLen?: number;
    zLen?: number;
  };
  gold?: {
    enabled: boolean;
    conds: GoldCond[];
    hamMomLen?: number;
    volBaseLen?: number;
    hamPower?: number;
    aoFast?: number;
    aoSlow?: number;
    wHam?: number;
    wAo?: number;
    trendLen?: number;
    trendBoost?: number;
    jrmaRmaLen?: number;
    jrmaLen?: number;
    jrmaPhase?: number;
    jrmaPower?: number;
    preSmooth?: number;
    postSmooth?: number;
    normLen?: number;
    zLen?: number;
    /** Divergence pivot-to-pivot min bars (default LIST_SCAN_DIV_OPTS.rangeLower=5) */
    divRangeLower?: number;
    divRangeUpper?: number;
    divLbL?: number;
    divLbR?: number;
  };
  gold2?: {
    enabled: boolean;
    conds: Gold2Cond[];
    hamMomLen?: number;
    volBaseLen?: number;
    hamPower?: number;
    aoFast?: number;
    aoSlow?: number;
    hamWeight?: number;
    aoWeight?: number;
    bbLen?: number;
    bbMult?: number;
    kcLen?: number;
    kcMult?: number;
    peLen?: number;
    compressionThresh?: number;
    cmfLen?: number;
    polarWeightCMF?: number;
    polarWeightHam?: number;
    preSmoothLen?: number;
    jurikLen?: number;
    rmaLen?: number;
    postSmoothLen?: number;
    kineticQuietThresh?: number;
    chargeRate?: number;
    idleDischarge?: number;
    breakoutDischarge?: number;
    minChargeForSignal?: number;
    zLen?: number;
    displaySignalLen?: number;
    histScale?: number;
    useTrendFilter?: boolean;
    requireRelease?: boolean;
    flagCounterBreakouts?: boolean;
    /** Divergence pivot-to-pivot min bars (default LIST_SCAN_DIV_OPTS.rangeLower=5) */
    divRangeLower?: number;
    divRangeUpper?: number;
    divLbL?: number;
    divLbR?: number;
  };
  /** Multi-oscillator divergence — Uyumsuzluk kartı (off by default). */
  divScan?: {
    enabled: boolean;
    oscillators: DivOscId[];
    types: DivTypeId[];
    rsiPeriod?: number;
    mfiPeriod?: number;
    cciPeriod?: number;
    cmfPeriod?: number;
    rocPeriod?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    stochK?: number;
    stochD?: number;
    divRangeLower?: number;
    divRangeUpper?: number;
    divLbL?: number;
    divLbR?: number;
  };
  pine?: {
    enabled: boolean;
    scripts: PineScriptScan[];
  };
  /** Extra AND filters (engine ScannerFilter) applied after main hit. */
  extraFilters?: ScannerFilter[];
};

function crossedAboveAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

function crossedBelowAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 >= b0 && a1 < b1;
}

function lineZeroCrossUp(line: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const v0 = line[i - 1];
  const v1 = line[i];
  if (v0 == null || v1 == null) return false;
  return v0 <= 0 && v1 > 0;
}

function lineZeroCrossDn(line: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const v0 = line[i - 1];
  const v1 = line[i];
  if (v0 == null || v1 == null) return false;
  return v0 >= 0 && v1 < 0;
}

function scanHam(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["ham"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_HAM_CONDS;
  if (candles.length < 80) return [];
  const h = hamJurikTpo(candles, {
    hamLen: cfg.hamLen,
    hamLenSlow: cfg.hamLenSlow,
    rawLen: cfg.rawLen,
    rawLenSlow: cfg.rawLenSlow,
    momSpan: cfg.momSpan,
    normLen: cfg.normLen,
    jLen: cfg.jLen,
    jPhase: cfg.jPhase,
    postSmooth: cfg.postSmooth,
  });
  const n = candles.length;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = n - 1 - ago;
    if (i < 1) break;
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "raw_up":
          ok = h.rawUp[i];
          bias = "bull";
          note = `HAM raw↑ (−${ago})`;
          break;
        case "raw_dn":
          ok = h.rawDown[i];
          bias = "bear";
          note = `HAM raw↓ (−${ago})`;
          break;
        case "hist_zero_up":
          ok = h.histCross[i];
          bias = "bull";
          note = `hist 0↑ (−${ago})`;
          break;
        case "hist_zero_dn":
          ok = h.histCrossDown[i];
          bias = "bear";
          note = `hist 0↓ (−${ago})`;
          break;
        case "hist_pos":
          ok = h.histPos[i];
          bias = "bull";
          note = `hist+ (−${ago})`;
          break;
        case "hist_neg":
          ok = h.histNeg[i];
          bias = "bear";
          note = `hist− (−${ago})`;
          break;
        case "hist_turn":
          ok = h.histTurning[i];
          bias = "bull";
          note = `hist→0 (−${ago})`;
          break;
        case "raw_x_hist_up":
          ok = h.rawCrossHist[i];
          bias = "bull";
          note = `raw×hist↑ (−${ago})`;
          break;
        case "raw_x_hist_dn":
          ok = h.rawCrossHistDown[i];
          bias = "bear";
          note = `raw×hist↓ (−${ago})`;
          break;
        case "raw_x_osc_up":
          ok = h.rawCrossOsc[i];
          bias = "bull";
          note = `raw×osc↑ (−${ago})`;
          break;
        case "raw_x_osc_dn":
          ok = h.rawCrossOscDown[i];
          bias = "bear";
          note = `raw×osc↓ (−${ago})`;
          break;
        case "dual_up":
          ok = h.dualCrossUp[i];
          bias = "bull";
          note = `HAM hızlı×yavaş↑ (−${ago})`;
          break;
        case "dual_dn":
          ok = h.dualCrossDown[i];
          bias = "bear";
          note = `HAM hızlı×yavaş↓ (−${ago})`;
          break;
        case "raw_dual_up":
          ok = h.rawDualUp[i];
          bias = "bull";
          note = `raw hızlı×yavaş↑ (−${ago})`;
          break;
        case "raw_dual_dn":
          ok = h.rawDualDown[i];
          bias = "bear";
          note = `raw hızlı×yavaş↓ (−${ago})`;
          break;
        case "raw_slow_up":
          ok = h.rawSlowUp[i];
          bias = "bull";
          note = `raw yavaş↑ (−${ago})`;
          break;
        case "raw_slow_dn":
          ok = h.rawSlowDown[i];
          bias = "bear";
          note = `raw yavaş↓ (−${ago})`;
          break;
        case "raw_slow_x_osc_up":
          ok = h.rawSlowXOsc[i];
          bias = "bull";
          note = `rawY×osc↑ (−${ago})`;
          break;
        case "raw_slow_x_osc_dn":
          ok = h.rawSlowXOscDown[i];
          bias = "bear";
          note = `rawY×osc↓ (−${ago})`;
          break;
        case "osc_fast_up":
          ok = h.oscFastUp[i];
          bias = "bull";
          note = `osc hızlı↑ (−${ago})`;
          break;
        case "osc_fast_dn":
          ok = h.oscFastDown[i];
          bias = "bear";
          note = `osc hızlı↓ (−${ago})`;
          break;
        case "osc_slow_up":
          ok = h.oscSlowUp[i];
          bias = "bull";
          note = `osc yavaş↑ (−${ago})`;
          break;
        case "osc_slow_dn":
          ok = h.oscSlowDown[i];
          bias = "bear";
          note = `osc yavaş↓ (−${ago})`;
          break;
        case "osc_fast_zero_up":
          ok = h.oscFastZeroUp[i];
          bias = "bull";
          note = `osc H 0↑ (−${ago})`;
          break;
        case "osc_fast_zero_dn":
          ok = h.oscFastZeroDown[i];
          bias = "bear";
          note = `osc H 0↓ (−${ago})`;
          break;
        case "osc_slow_zero_up":
          ok = h.oscSlowZeroUp[i];
          bias = "bull";
          note = `osc Y 0↑ (−${ago})`;
          break;
        case "osc_slow_zero_dn":
          ok = h.oscSlowZeroDown[i];
          bias = "bear";
          note = `osc Y 0↓ (−${ago})`;
          break;
        case "setup":
          ok = h.rawUp[i] && h.histTurning[i];
          bias = "bull";
          note = `HAM setup (−${ago})`;
          break;
        case "confirm":
          ok = h.histCross[i] || h.rawCrossHist[i];
          bias = "bull";
          note = h.rawCrossHist[i]
            ? `HAM onay raw×hist (−${ago})`
            : `HAM onay hist+ (−${ago})`;
          break;
        case "al":
          ok =
            h.rawUp[i] &&
            (h.histPos[i] || h.histCross[i] || h.rawCrossHist[i]);
          bias = "bull";
          note = `HAM AL (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "ham", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}

function scanMacd(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["macd"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_MACD_CONDS;
  const fast = cfg.fast ?? 12;
  const slow = cfg.slow ?? 26;
  const signalPeriod = cfg.signal ?? 9;
  if (candles.length < slow + signalPeriod + 2) return [];
  const m = macd(closes(candles), fast, slow, signalPeriod);
  const last = m.macd.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "cross_up":
          ok = crossedAboveAt(m.macd, m.signal, i);
          bias = "bull";
          note = `MACD×sig↑ (−${ago})`;
          break;
        case "cross_dn":
          ok = crossedBelowAt(m.macd, m.signal, i);
          bias = "bear";
          note = `MACD×sig↓ (−${ago})`;
          break;
        case "hist_zero_up":
          ok = lineZeroCrossUp(m.hist, i);
          bias = "bull";
          note = `MACD hist 0↑ (−${ago})`;
          break;
        case "hist_zero_dn":
          ok = lineZeroCrossDn(m.hist, i);
          bias = "bear";
          note = `MACD hist 0↓ (−${ago})`;
          break;
        case "hist_pos":
          ok = m.hist[i] != null && (m.hist[i] as number) >= 0;
          bias = "bull";
          note = `MACD hist+ (−${ago})`;
          break;
        case "hist_neg":
          ok = m.hist[i] != null && (m.hist[i] as number) < 0;
          bias = "bear";
          note = `MACD hist− (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "macd", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}

function scanStoch(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["stoch"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_STOCH_CONDS;
  const kPeriod = cfg.kPeriod ?? 14;
  const dPeriod = cfg.dPeriod ?? 3;
  const os = cfg.os ?? 20;
  const ob = cfg.ob ?? 80;
  if (candles.length < kPeriod + dPeriod + 2) return [];
  const s = stochastic(candles, kPeriod, dPeriod);
  const last = s.k.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    const kv = s.k[i];
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "os":
          ok = kv != null && kv < os;
          bias = "bull";
          note = `Stoch OS (−${ago})`;
          break;
        case "ob":
          ok = kv != null && kv > ob;
          bias = "bear";
          note = `Stoch OB (−${ago})`;
          break;
        case "kx_up":
          ok = crossedAboveAt(s.k, s.d, i);
          bias = "bull";
          note = `Stoch K×D↑ (−${ago})`;
          break;
        case "kx_dn":
          ok = crossedBelowAt(s.k, s.d, i);
          bias = "bear";
          note = `Stoch K×D↓ (−${ago})`;
          break;
        case "kx_up_os":
          ok =
            crossedAboveAt(s.k, s.d, i) &&
            kv != null &&
            kv >= 15 &&
            kv <= 25;
          bias = "bull";
          note = `Stoch K×D↑ OS (−${ago})`;
          break;
        case "kx_dn_ob":
          ok =
            crossedBelowAt(s.k, s.d, i) &&
            kv != null &&
            kv >= 75 &&
            kv <= 85;
          bias = "bear";
          note = `Stoch K×D↓ OB (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "stoch", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}

function scanDiag(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["diag"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_DIAG_CONDS;
  const hits: ListScanHit[] = [];
  const seen = new Set<string>();
  for (const cond of conds) {
    let event: "bounce" | "break" | "twin" | "triple" = "bounce";
    let direction: "bull" | "bear" | "any" = "any";
    switch (cond) {
      case "bounce":
        event = "bounce";
        direction = "any";
        break;
      case "break":
        event = "break";
        direction = "any";
        break;
      case "twin_bull":
        event = "twin";
        direction = "bull";
        break;
      case "twin_bear":
        event = "twin";
        direction = "bear";
        break;
      case "triple_bull":
        event = "triple";
        direction = "bull";
        break;
      case "triple_bear":
        event = "triple";
        direction = "bear";
        break;
    }
    const r = recentDiagonalSr(candles, {
      event,
      direction,
      maxBarsAgo,
      pivotWindow: cfg.pivotWindow,
      historyBars: cfg.historyBars,
      left: cfg.left,
      right: cfg.right,
    });
    if (!r.ok) continue;
    if (seen.has(cond)) continue;
    seen.add(cond);
    const bias: ListScanHit["bias"] =
      direction === "bull"
        ? "bull"
        : direction === "bear"
          ? "bear"
          : r.kind.endsWith("L") || r.kind === "db" || r.kind === "tb"
            ? "bull"
            : "bear";
    hits.push({
      kind: "diag",
      cond,
      bias,
      barsAgo: r.barsAgo,
      note: r.note || `Diag ${cond} (−${r.barsAgo})`,
    });
  }
  return hits;
}



function scanDi(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["di"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_DI_CONDS;
  const period = cfg.period ?? 14;
  const adxMin = cfg.adxMin ?? 25;
  if (candles.length < period * 3 + 2) return [];
  const d = adx(candles, period);
  const last = d.plusDI.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    const p = d.plusDI[i];
    const m = d.minusDI[i];
    const ax = d.adx[i];
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "plus_x_minus":
          ok = crossedAboveAt(d.plusDI, d.minusDI, i);
          bias = "bull";
          note = `+DI×−DI↑ (−${ago})`;
          break;
        case "minus_x_plus":
          ok = crossedAboveAt(d.minusDI, d.plusDI, i);
          bias = "bear";
          note = `−DI×+DI↑ (−${ago})`;
          break;
        case "plus_above":
          ok = p != null && m != null && p > m;
          bias = "bull";
          note = `+DI>−DI (−${ago})`;
          break;
        case "minus_above":
          ok = p != null && m != null && m > p;
          bias = "bear";
          note = `−DI>+DI (−${ago})`;
          break;
        case "adx_above":
          ok = ax != null && ax > adxMin;
          bias = "neutral";
          note = `ADX>${adxMin} (${ax != null ? ax.toFixed(0) : "—"}) (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "di", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}


function scanHull(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["hull"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_HULL_CONDS;
  if (candles.length < DOKTOR_HULL_MIN_BARS) return [];
  const mode = cfg.mode ?? "Hma";
  const d = doktorHull(candles, { mode });
  const last = candles.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "al":
          ok = d.scanBuy[i] === 1;
          bias = "bull";
          note = `Hull AL 100×200↑ (−${ago})`;
          break;
        case "sat":
          ok = d.scanSell[i] === 1;
          bias = "bear";
          note = `Hull SAT 21×100↓ (−${ago})`;
          break;
        case "c50_100":
          ok = d.c50_100[i] === 1;
          bias = "bull";
          note = `Hull 50×100↑ (−${ago})`;
          break;
        case "c50_200":
          ok = d.c50_200[i] === 1;
          bias = "bull";
          note = `Hull 50×200↑ (−${ago})`;
          break;
        case "c100_200":
          ok = d.c100_200[i] === 1;
          bias = "bull";
          note = `Hull 100×200↑ (−${ago})`;
          break;
        case "c21_50":
          ok = d.c21_50[i] === 1;
          bias = "bull";
          note = `Hull 21×50↑ (−${ago})`;
          break;
        case "c21_100":
          ok = d.c21_100[i] === 1;
          bias = "bull";
          note = `Hull 21×100↑ (−${ago})`;
          break;
        case "chart_al":
          ok = d.chartBuy[i] === 1;
          bias = "bull";
          note = `Hull grafik AL 13×50↑ (−${ago})`;
          break;
        case "chart_sat":
          ok = d.chartSell[i] === 1;
          bias = "bear";
          note = `Hull grafik SAT 21×50↓ (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "hull", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}

function runnablePineCode(sc: PineScriptScan): { code: string; language: "td" | "js" } {
  if (sc.language === "js") return { code: sc.code, language: "js" };
  if (sc.language === "td") return { code: sc.code, language: "td" };
  const conv = convertAny(sc.code, "td");
  return { code: conv.code, language: "td" };
}

function scanPine(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["pine"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled || !cfg.scripts.length) return [];
  if (candles.length < 30) return [];
  const hits: ListScanHit[] = [];
  const n = candles.length;
  for (const sc of cfg.scripts) {
    const conds = sc.conds.length ? sc.conds : (["zero_up", "cross_up"] as PineCond[]);
    const run = runnablePineCode(sc);
    const r = runCustomScript(run.code, candles, run.language);
    if (r.error || !r.plots.length) continue;
    const plots = r.plots.map((p) => p.values);
    const a = plots[0]!;
    const b = plots[1];
    const zeros = candles.map(() => 0);
    for (let ago = 0; ago <= maxBarsAgo; ago++) {
      const i = n - 1 - ago;
      if (i < 1) break;
      const tryHit = (ok: boolean, cond: PineCond, bias: ListScanHit["bias"], note: string) => {
        if (!ok) return;
        hits.push({
          kind: "pine",
          cond: `${sc.id}:${cond}`,
          bias,
          barsAgo: ago,
          note: `${sc.name} ${note} (−${ago})`,
        });
      };
      for (const c of conds) {
        if (c === "zero_up")
          tryHit(lineZeroCrossUp(a, i), c, "bull", "0↑");
        else if (c === "zero_dn")
          tryHit(lineZeroCrossDn(a, i), c, "bear", "0↓");
        else if (c === "cross_up" && b)
          tryHit(crossedAboveAt(a, b, i), c, "bull", "H×Y↑");
        else if (c === "cross_dn" && b)
          tryHit(crossedBelowAt(a, b, i), c, "bear", "H×Y↓");
        else if (c === "cross_up" && !b)
          tryHit(crossedAboveAt(a, zeros, i), c, "bull", "0↑");
        else if (c === "cross_dn" && !b)
          tryHit(crossedBelowAt(a, zeros, i), c, "bear", "0↓");
        else if (c === "up") {
          const v0 = a[i - 1];
          const v1 = a[i];
          tryHit(v0 != null && v1 != null && v1 > v0, c, "bull", "↑");
        } else if (c === "dn") {
          const v0 = a[i - 1];
          const v1 = a[i];
          tryHit(v0 != null && v1 != null && v1 < v0, c, "bear", "↓");
        }
      }
      if (hits.some((h) => h.cond.startsWith(`${sc.id}:`) && h.barsAgo === ago))
        break;
    }
  }
  return hits;
}

/**
 * Scan one symbol for enabled list-scan indicators.
 * Per enabled indicator: OR among selected conditions.
 * matchMode "all": only return hits if every enabled indicator produced ≥1 hit.
 */

function scanHamAo(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["hamAo"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const conds = cfg.conds.length ? cfg.conds : DEFAULT_HAM_AO_CONDS;
  if (candles.length < HAM_AO_JRMA_Z_MIN_BARS) return [];
  const s = hamAoJrmaZ(candles, {
    hamMomLen: cfg.hamMomLen,
    volBaseLen: cfg.volBaseLen,
    hamPower: cfg.hamPower,
    aoFast: cfg.aoFast,
    aoSlow: cfg.aoSlow,
    hamWeight: cfg.hamWeight,
    aoWeight: cfg.aoWeight,
    trendLen: cfg.trendLen,
    trendBoost: cfg.trendBoost,
    preSmoothLen: cfg.preSmoothLen,
    jurikLen: cfg.jurikLen,
    rmaLen: cfg.rmaLen,
    postSmoothLen: cfg.postSmoothLen,
    zLen: cfg.zLen,
  });
  const last = candles.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "rma_up_pt":
          ok = s.rmaUp[i] && s.pt[i];
          bias = "bull";
          note = `RMA↑ PT (−${ago})`;
          break;
        case "ao_up_pt":
          ok = s.aoUp[i] && s.pt[i];
          bias = "bull";
          note = `AO↑ PT (−${ago})`;
          break;
        case "ao_up_nt":
          ok = s.aoUp[i] && s.nt[i];
          bias = "bear";
          note = `AO↑ NT (−${ago})`;
          break;
        case "pt_x_nt":
          ok = s.ptXNt[i];
          bias = "bull";
          note = `PT↑ NT (−${ago})`;
          break;
        case "nt_x_pt":
          ok = s.ntXPt[i];
          bias = "bear";
          note = `NT↑ PT (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "hamAo", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}


function scanGold(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["gold"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  // Empty conds while enabled → all defaults (never silent [])
  const conds = cfg.conds.length ? cfg.conds : ALL_GOLD_CONDS;
  if (candles.length < AOHAM_JRMA_MIN_BARS) return [];
  const s = aohamJrmaEngine(candles, {
    hamMomLen: cfg.hamMomLen,
    volBaseLen: cfg.volBaseLen,
    hamPower: cfg.hamPower,
    aoFast: cfg.aoFast,
    aoSlow: cfg.aoSlow,
    wHam: cfg.wHam,
    wAo: cfg.wAo,
    trendLen: cfg.trendLen,
    trendBoost: cfg.trendBoost,
    jrmaRmaLen: cfg.jrmaRmaLen,
    jrmaLen: cfg.jrmaLen,
    jrmaPhase: cfg.jrmaPhase,
    jrmaPower: cfg.jrmaPower,
    preSmooth: cfg.preSmooth,
    postSmooth: cfg.postSmooth,
    normLen: cfg.normLen,
    zLen: cfg.zLen,
  });
  const wantDiv =
    conds.includes("div_bull") ||
    conds.includes("div_bear") ||
    conds.includes("div_hid_bull") ||
    conds.includes("div_hid_bear");
  const divOpts: OscDivergenceOpts = {
    lbL: cfg.divLbL ?? LIST_SCAN_DIV_OPTS.lbL,
    lbR: cfg.divLbR ?? LIST_SCAN_DIV_OPTS.lbR,
    rangeLower: cfg.divRangeLower ?? LIST_SCAN_DIV_OPTS.rangeLower,
    rangeUpper: cfg.divRangeUpper ?? LIST_SCAN_DIV_OPTS.rangeUpper,
  };
  // Prefer aoPlot (main signal); fall back to displayPlot if ao sparse
  const divOsc = wantDiv
    ? pickOscSeries(s.aoPlot, s.displayPlot ?? s.rawSigPlot)
    : null;
  const div = wantDiv && divOsc
    ? computeOscDivergence(candles, divOsc, divOpts)
    : null;

  const last = candles.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "ao_x_score_al":
          ok = s.aoXScoreAl[i];
          bias = "bull";
          note = `AO↑ Score (−${ago})`;
          break;
        case "ao_x_rma_al":
          ok = s.aoXRmaAl[i];
          bias = "bull";
          note = `AO↑ RMA (−${ago})`;
          break;
        case "ao_x_score_sat":
          ok = s.aoXScoreSat[i];
          bias = "bear";
          note = `AO↓ Score (−${ago})`;
          break;
        case "ao_x_rma_sat":
          ok = s.aoXRmaSat[i];
          bias = "bear";
          note = `AO↓ RMA (−${ago})`;
          break;
        case "pt_x_nt":
          ok = s.ptXNt[i];
          bias = "bull";
          note = `PT↑ NT (−${ago})`;
          break;
        case "nt_x_pt":
          ok = s.ntXPt[i];
          bias = "bear";
          note = `NT↑ PT (−${ago})`;
          break;
        case "div_bull":
          ok = div != null && div.bull[i] != null;
          bias = "bull";
          note = `Uyumsuzluk AL (−${ago})`;
          break;
        case "div_bear":
          ok = div != null && div.bear[i] != null;
          bias = "bear";
          note = `Uyumsuzluk SAT (−${ago})`;
          break;
        case "div_hid_bull":
          ok = div != null && div.hiddenBull[i] != null;
          bias = "bull";
          note = `Gizli AL (−${ago})`;
          break;
        case "div_hid_bear":
          ok = div != null && div.hiddenBear[i] != null;
          bias = "bear";
          note = `Gizli SAT (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "gold", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}


function scanGold2(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["gold2"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  // Empty conds while enabled → all defaults (never silent [])
  const conds = cfg.conds.length ? cfg.conds : ALL_GOLD2_CONDS;
  if (candles.length < GOLD_KEKO_MIN_BARS) return [];
  const s = goldKeko(candles, {
    hamMomLen: cfg.hamMomLen,
    volBaseLen: cfg.volBaseLen,
    hamPower: cfg.hamPower,
    aoFast: cfg.aoFast,
    aoSlow: cfg.aoSlow,
    hamWeight: cfg.hamWeight,
    aoWeight: cfg.aoWeight,
    bbLen: cfg.bbLen,
    bbMult: cfg.bbMult,
    kcLen: cfg.kcLen,
    kcMult: cfg.kcMult,
    peLen: cfg.peLen,
    compressionThresh: cfg.compressionThresh,
    cmfLen: cfg.cmfLen,
    polarWeightCMF: cfg.polarWeightCMF,
    polarWeightHam: cfg.polarWeightHam,
    preSmoothLen: cfg.preSmoothLen,
    jurikLen: cfg.jurikLen,
    rmaLen: cfg.rmaLen,
    postSmoothLen: cfg.postSmoothLen,
    kineticQuietThresh: cfg.kineticQuietThresh,
    chargeRate: cfg.chargeRate,
    idleDischarge: cfg.idleDischarge,
    breakoutDischarge: cfg.breakoutDischarge,
    minChargeForSignal: cfg.minChargeForSignal,
    zLen: cfg.zLen,
    displaySignalLen: cfg.displaySignalLen,
    histScale: cfg.histScale,
    useTrendFilter: cfg.useTrendFilter,
    requireRelease: cfg.requireRelease,
    flagCounterBreakouts: cfg.flagCounterBreakouts,
  });
  const wantDiv =
    conds.includes("div_bull") ||
    conds.includes("div_bear") ||
    conds.includes("div_hid_bull") ||
    conds.includes("div_hid_bear");
  const divOpts: OscDivergenceOpts = {
    lbL: cfg.divLbL ?? LIST_SCAN_DIV_OPTS.lbL,
    lbR: cfg.divLbR ?? LIST_SCAN_DIV_OPTS.lbR,
    rangeLower: cfg.divRangeLower ?? LIST_SCAN_DIV_OPTS.rangeLower,
    rangeUpper: cfg.divRangeUpper ?? LIST_SCAN_DIV_OPTS.rangeUpper,
  };
  // Prefer oscDisplay; fall back to oscMain if display is sparse
  const divOsc = wantDiv
    ? pickOscSeries(s.oscDisplay, s.oscMain)
    : null;
  const div = wantDiv && divOsc
    ? computeOscDivergence(candles, divOsc, divOpts)
    : null;

  const last = candles.length - 1;
  const best = new Map<string, ListScanHit>();

  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = last - ago;
    if (i < 1) break;
    for (const cond of conds) {
      let ok = false;
      let bias: ListScanHit["bias"] = "neutral";
      let note = "";
      switch (cond) {
        case "raw_x_rma_al":
          ok = s.rawXRmaAl[i];
          bias = "bull";
          note = `Raw↑ RMA (−${ago})`;
          break;
        case "raw_x_rma_sat":
          ok = s.rawXRmaSat[i];
          bias = "bear";
          note = `Raw↓ RMA (−${ago})`;
          break;
        case "core_x_rma_al":
          ok = s.coreXRmaAl[i];
          bias = "bull";
          note = `Core↑ RMA (−${ago})`;
          break;
        case "core_x_rma_sat":
          ok = s.coreXRmaSat[i];
          bias = "bear";
          note = `Core↓ RMA (−${ago})`;
          break;
        case "disp_x_rma_al":
          ok = s.dispXRmaAl[i];
          bias = "bull";
          note = `Disp↑ RMA (−${ago})`;
          break;
        case "disp_x_rma_sat":
          ok = s.dispXRmaSat[i];
          bias = "bear";
          note = `Disp↓ RMA (−${ago})`;
          break;
        case "breakout_up_aligned":
          ok = s.breakoutUpAligned[i];
          bias = "bull";
          note = `Kırılım↑ onay (−${ago})`;
          break;
        case "breakout_down_aligned":
          ok = s.breakoutDownAligned[i];
          bias = "bear";
          note = `Kırılım↓ onay (−${ago})`;
          break;
        case "breakout_up_counter":
          ok = s.breakoutUpCounter[i];
          bias = "bull";
          note = `Kırılım↑ şüphe (−${ago})`;
          break;
        case "breakout_down_counter":
          ok = s.breakoutDownCounter[i];
          bias = "bear";
          note = `Kırılım↓ şüphe (−${ago})`;
          break;
        case "charge_full_bull":
          ok = s.chargeFullBull[i];
          bias = "bull";
          note = `Şarj+ doldu (−${ago})`;
          break;
        case "charge_full_bear":
          ok = s.chargeFullBear[i];
          bias = "bear";
          note = `Şarj− doldu (−${ago})`;
          break;
        case "polarity_flip_up":
          ok = s.polarityFlipUp[i];
          bias = "bull";
          note = `Kutup↑ (−${ago})`;
          break;
        case "polarity_flip_down":
          ok = s.polarityFlipDown[i];
          bias = "bear";
          note = `Kutup↓ (−${ago})`;
          break;
        case "div_bull":
          ok = div != null && div.bull[i] != null;
          bias = "bull";
          note = `Uyumsuzluk AL (−${ago})`;
          break;
        case "div_bear":
          ok = div != null && div.bear[i] != null;
          bias = "bear";
          note = `Uyumsuzluk SAT (−${ago})`;
          break;
        case "div_hid_bull":
          ok = div != null && div.hiddenBull[i] != null;
          bias = "bull";
          note = `Gizli AL (−${ago})`;
          break;
        case "div_hid_bear":
          ok = div != null && div.hiddenBear[i] != null;
          bias = "bear";
          note = `Gizli SAT (−${ago})`;
          break;
      }
      if (!ok) continue;
      const prev = best.get(cond);
      if (!prev || ago < prev.barsAgo) {
        best.set(cond, { kind: "gold2", cond, bias, barsAgo: ago, note });
      }
    }
  }
  return [...best.values()];
}


function buildDivOscSeries(
  candles: Candle[],
  oscId: DivOscId,
  cfg: NonNullable<ListScanConfig["divScan"]>
): (number | null)[] {
  const c = closes(candles);
  switch (oscId) {
    case "rsi":
      return rsi(c, cfg.rsiPeriod ?? 14);
    case "mfi":
      return mfi(candles, cfg.mfiPeriod ?? 14);
    case "cci":
      return cci(candles, cfg.cciPeriod ?? 20);
    case "cmf":
      return cmf(candles, cfg.cmfPeriod ?? 20);
    case "roc":
      return roc(c, cfg.rocPeriod ?? 12);
    case "macd_hist":
      return macd(
        c,
        cfg.macdFast ?? 12,
        cfg.macdSlow ?? 26,
        cfg.macdSignal ?? 9
      ).hist;
    case "stoch":
      return stochastic(candles, cfg.stochK ?? 14, cfg.stochD ?? 3).k;
    case "obv":
      return obv(candles);
  }
}

function scanDivScan(
  candles: Candle[],
  cfg: NonNullable<ListScanConfig["divScan"]>,
  maxBarsAgo: number
): ListScanHit[] {
  if (!cfg.enabled) return [];
  const oscillators = cfg.oscillators.length
    ? cfg.oscillators
    : DEFAULT_DIV_OSC;
  const types = cfg.types.length ? cfg.types : DEFAULT_DIV_TYPES;
  if (!oscillators.length || !types.length) return [];
  if (candles.length < DIV_SCAN_MIN_BARS) return [];

  const divOpts: OscDivergenceOpts = {
    lbL: cfg.divLbL ?? LIST_SCAN_DIV_OPTS.lbL,
    lbR: cfg.divLbR ?? LIST_SCAN_DIV_OPTS.lbR,
    rangeLower: cfg.divRangeLower ?? LIST_SCAN_DIV_OPTS.rangeLower,
    rangeUpper: cfg.divRangeUpper ?? LIST_SCAN_DIV_OPTS.rangeUpper,
  };

  const last = candles.length - 1;
  const best = new Map<string, ListScanHit>();

  // Only compute selected oscillators; one computeOscDivergence per series.
  for (const oscId of oscillators) {
    const series = buildDivOscSeries(candles, oscId, cfg);
    const div = computeOscDivergence(candles, series, divOpts);
    const oscLabel = DIV_OSC_LABEL[oscId];

    for (const divType of types) {
      const cond: DivScanCond = `${oscId}|${divType}`;
      const bias: ListScanHit["bias"] =
        divType === "reg_bull" || divType === "hid_bull" ? "bull" : "bear";
      const typeLabel = DIV_TYPE_LABEL[divType];

      for (let ago = 0; ago <= maxBarsAgo; ago++) {
        const i = last - ago;
        if (i < 1) break;
        let ok = false;
        switch (divType) {
          case "reg_bull":
            ok = div.bull[i] != null;
            break;
          case "reg_bear":
            ok = div.bear[i] != null;
            break;
          case "hid_bull":
            ok = div.hiddenBull[i] != null;
            break;
          case "hid_bear":
            ok = div.hiddenBear[i] != null;
            break;
        }
        if (!ok) continue;
        const prev = best.get(cond);
        if (!prev || ago < prev.barsAgo) {
          best.set(cond, {
            kind: "divScan",
            cond,
            bias,
            barsAgo: ago,
            note: `${oscLabel} ${typeLabel} (−${ago})`,
          });
        }
      }
    }
  }

  return [...best.values()];
}

export function scanSymbol(
  candles: Candle[],
  cfg: ListScanConfig,
  maxBarsAgo = 2
): ListScanHit[] {
  const enabledKinds: ListScanKind[] = [];
  if (cfg.ham?.enabled) enabledKinds.push("ham");
  if (cfg.diag?.enabled) enabledKinds.push("diag");
  if (cfg.macd?.enabled) enabledKinds.push("macd");
  if (cfg.stoch?.enabled) enabledKinds.push("stoch");
  if (cfg.di?.enabled) enabledKinds.push("di");
  if (cfg.hull?.enabled) enabledKinds.push("hull");
  if (cfg.hamAo?.enabled) enabledKinds.push("hamAo");
  if (cfg.gold?.enabled) enabledKinds.push("gold");
  if (cfg.gold2?.enabled) enabledKinds.push("gold2");
  if (cfg.divScan?.enabled) enabledKinds.push("divScan");
  if (cfg.pine?.enabled && cfg.pine.scripts.length) enabledKinds.push("pine");
  if (!enabledKinds.length) return [];

  const byKind: Record<ListScanKind, ListScanHit[]> = {
    ham: cfg.ham ? scanHam(candles, cfg.ham, maxBarsAgo) : [],
    diag: cfg.diag ? scanDiag(candles, cfg.diag, maxBarsAgo) : [],
    macd: cfg.macd ? scanMacd(candles, cfg.macd, maxBarsAgo) : [],
    stoch: cfg.stoch ? scanStoch(candles, cfg.stoch, maxBarsAgo) : [],
    di: cfg.di ? scanDi(candles, cfg.di, maxBarsAgo) : [],
    hull: cfg.hull ? scanHull(candles, cfg.hull, maxBarsAgo) : [],
    hamAo: cfg.hamAo ? scanHamAo(candles, cfg.hamAo, maxBarsAgo) : [],
    gold: cfg.gold ? scanGold(candles, cfg.gold, maxBarsAgo) : [],
    gold2: cfg.gold2 ? scanGold2(candles, cfg.gold2, maxBarsAgo) : [],
    divScan: cfg.divScan ? scanDivScan(candles, cfg.divScan, maxBarsAgo) : [],
    pine: cfg.pine ? scanPine(candles, cfg.pine, maxBarsAgo) : [],
  };

  const matchMode = cfg.matchMode ?? "any";
  if (matchMode === "all") {
    for (const k of enabledKinds) {
      if (!byKind[k].length) return [];
    }
  }

  const out: ListScanHit[] = [];
  for (const k of enabledKinds) out.push(...byKind[k]);
  out.sort((a, b) => a.barsAgo - b.barsAgo || a.kind.localeCompare(b.kind));
  return out;
}

/** State/zone flags — true for many bars; do not fire phone alerts. */
const STATE_CONDS = new Set([
  "hist_pos",
  "hist_neg",
  "raw_up",
  "raw_dn",
  "raw_slow_up",
  "raw_slow_dn",
  "osc_fast_up",
  "osc_fast_dn",
  "osc_slow_up",
  "osc_slow_dn",
  "os",
  "ob",
  "up",
  "dn",
  "plus_above",
  "minus_above",
  "adx_above",
]);

export function alertScanHits(
  candles: Candle[],
  cfg: ListScanConfig,
  maxBarsAgo = 1
): ListScanHit[] {
  const hits = scanSymbol(candles, cfg, maxBarsAgo);
  return hits.filter((h) => {
    if (h.barsAgo > 1) return false;
    const cond = h.cond.includes(":") ? h.cond.split(":").slice(1).join(":") : h.cond;
    if (STATE_CONDS.has(cond)) return false;
    return true;
  });
}

export function alertScanSig(candles: Candle[], hits: ListScanHit[]): string {
  const last = candles[candles.length - 1];
  const t0 = last && typeof last.time === "number" ? last.time : 0;
  return hits
    .map((h) => `${h.kind}:${h.cond}:${t0 - h.barsAgo}`)
    .sort()
    .join("|");
}

/** Build indicator params (incl. color*) to upsert onto a pane. */
export function indicatorParamsFromConfig(
  kind: ListScanKind,
  cfg: ListScanConfig
): Record<string, number | string> {
  if (kind === "ham" && cfg.ham) {
    const h = cfg.ham;
    const p: Record<string, number | string> = {
      hamLen: h.hamLen ?? 21,
      hamLenSlow: h.hamLenSlow ?? 34,
      rawLen: h.rawLen ?? 10,
      rawLenSlow: h.rawLenSlow ?? 21,
      momSpan: h.momSpan ?? 10,
      normLen: h.normLen ?? 80,
      jLen: h.jLen ?? 20,
      jPhase: h.jPhase ?? 0,
      postSmooth: h.postSmooth ?? 5,
      showRawHam: 1,
      showHistogram: 1,
      showMarkers: 1,
    };
    if (h.colorOsc) p.colorOsc = h.colorOsc;
    if (h.colorRaw) p.colorRaw = h.colorRaw;
    if (h.colorHistUp) p.colorHistUp = h.colorHistUp;
    if (h.colorHistDn) p.colorHistDn = h.colorHistDn;
    if (h.colorSlow) p.colorSlow = h.colorSlow;
    if (h.colorRawSlow) p.colorRawSlow = h.colorRawSlow;
    return p;
  }
  if (kind === "diag" && cfg.diag) {
    const d = cfg.diag;
    const p: Record<string, number | string> = {
      pivotWindow: d.pivotWindow ?? 6,
      historyBars: d.historyBars ?? 300,
      left: d.left ?? 30,
      right: d.right ?? 30,
      showMarkers: 1,
    };
    if (d.colorSup) p.colorSup = d.colorSup;
    if (d.colorRes) p.colorRes = d.colorRes;
    return p;
  }
  if (kind === "macd" && cfg.macd) {
    const m = cfg.macd;
    const p: Record<string, number | string> = {
      fast: m.fast ?? 12,
      slow: m.slow ?? 26,
      signal: m.signal ?? 9,
      showMarkers: 1,
    };
    if (m.colorMacd) p.colorMacd = m.colorMacd;
    if (m.colorSignal) p.colorSignal = m.colorSignal;
    if (m.colorHist) p.colorHist = m.colorHist;
    if (m.colorHistUp) p.colorHistUp = m.colorHistUp;
    if (m.colorHistDn) p.colorHistDn = m.colorHistDn;
    return p;
  }
  if (kind === "stoch" && cfg.stoch) {
    const s = cfg.stoch;
    const p: Record<string, number | string> = {
      kPeriod: s.kPeriod ?? 14,
      dPeriod: s.dPeriod ?? 3,
    };
    if (s.colorK) p.colorK = s.colorK;
    if (s.colorD) p.colorD = s.colorD;
    return p;
  }
  if (kind === "di" && cfg.di) {
    return { period: cfg.di.period ?? 14 };
  }
  if (kind === "hamAo" && cfg.hamAo) {
    const h = cfg.hamAo;
    return {
      hamMomLen: h.hamMomLen ?? 21,
      volBaseLen: h.volBaseLen ?? 34,
      hamPower: h.hamPower ?? 1.2,
      aoFast: h.aoFast ?? 5,
      aoSlow: h.aoSlow ?? 34,
      hamWeight: h.hamWeight ?? 0.6,
      aoWeight: h.aoWeight ?? 0.4,
      trendLen: h.trendLen ?? 34,
      trendBoost: h.trendBoost ?? 1.3,
      preSmoothLen: h.preSmoothLen ?? 3,
      jurikLen: h.jurikLen ?? 8,
      rmaLen: h.rmaLen ?? 13,
      postSmoothLen: h.postSmoothLen ?? 2,
      zLen: h.zLen ?? 89,
    };
  }
  if (kind === "gold" && cfg.gold) {
    const g = cfg.gold;
    return {
      hamMomLen: g.hamMomLen ?? 21,
      volBaseLen: g.volBaseLen ?? 34,
      hamPower: g.hamPower ?? 1.2,
      aoFast: g.aoFast ?? 5,
      aoSlow: g.aoSlow ?? 34,
      wHam: g.wHam ?? 0.6,
      wAo: g.wAo ?? 0.4,
      trendLen: g.trendLen ?? 34,
      trendBoost: g.trendBoost ?? 1.3,
      jrmaRmaLen: g.jrmaRmaLen ?? 13,
      jrmaLen: g.jrmaLen ?? 8,
      jrmaPhase: g.jrmaPhase ?? 0,
      jrmaPower: g.jrmaPower ?? 2,
      preSmooth: g.preSmooth ?? 3,
      postSmooth: g.postSmooth ?? 2,
      normLen: g.normLen ?? 40,
      zLen: g.zLen ?? 89,
    };
  }
  if (kind === "gold2" && cfg.gold2) {
    const g = cfg.gold2;
    return {
      hamMomLen: g.hamMomLen ?? 21,
      volBaseLen: g.volBaseLen ?? 34,
      hamPower: g.hamPower ?? 1.2,
      aoFast: g.aoFast ?? 5,
      aoSlow: g.aoSlow ?? 34,
      hamWeight: g.hamWeight ?? 0.6,
      aoWeight: g.aoWeight ?? 0.4,
      bbLen: g.bbLen ?? 20,
      bbMult: g.bbMult ?? 2,
      kcLen: g.kcLen ?? 20,
      kcMult: g.kcMult ?? 1.5,
      peLen: g.peLen ?? 100,
      compressionThresh: g.compressionThresh ?? 0.5,
      cmfLen: g.cmfLen ?? 21,
      polarWeightCMF: g.polarWeightCMF ?? 0.6,
      polarWeightHam: g.polarWeightHam ?? 0.4,
      preSmoothLen: g.preSmoothLen ?? 3,
      jurikLen: g.jurikLen ?? 8,
      rmaLen: g.rmaLen ?? 13,
      postSmoothLen: g.postSmoothLen ?? 2,
      kineticQuietThresh: g.kineticQuietThresh ?? 0.35,
      chargeRate: g.chargeRate ?? 1.4,
      idleDischarge: g.idleDischarge ?? 0.15,
      breakoutDischarge: g.breakoutDischarge ?? 35,
      minChargeForSignal: g.minChargeForSignal ?? 30,
      zLen: g.zLen ?? 89,
      displaySignalLen: g.displaySignalLen ?? 5,
      histScale: g.histScale ?? 18,
    };
  }
  if (kind === "hull" && cfg.hull) {
    const h = cfg.hull;
    const p: Record<string, number | string> = {
      mode: h.mode ?? "Hma",
      showRibbon: 1,
      showMarkers: 1,
    };
    if (h.color8) p.color8 = h.color8;
    if (h.color13) p.color13 = h.color13;
    if (h.color21) p.color21 = h.color21;
    if (h.color50) p.color50 = h.color50;
    if (h.color100) p.color100 = h.color100;
    if (h.color200) p.color200 = h.color200;
    return p;
  }
  if (kind === "divScan" && cfg.divScan) {
    const d = cfg.divScan;
    return {
      rsiLen: d.rsiPeriod ?? 14,
      lbL: d.divLbL ?? LIST_SCAN_DIV_OPTS.lbL,
      lbR: d.divLbR ?? LIST_SCAN_DIV_OPTS.lbR,
      rangeLower: d.divRangeLower ?? LIST_SCAN_DIV_OPTS.rangeLower,
      rangeUpper: d.divRangeUpper ?? LIST_SCAN_DIV_OPTS.rangeUpper,
      showMarkers: 1,
    };
  }
  return {};
}

export const KIND_TO_INDICATOR: Record<
  Exclude<ListScanKind, "pine">,
  | "hamJurikTpo"
  | "diagonalSr"
  | "macd"
  | "stochastic"
  | "adx"
  | "doktorHull"
  | "hamAoJrmaZ"
  | "aohamJrmaEngine"
  | "goldKeko"
  | "rsiPuNu"
> = {
  ham: "hamJurikTpo",
  diag: "diagonalSr",
  macd: "macd",
  stoch: "stochastic",
  di: "adx",
  hull: "doktorHull",
  hamAo: "hamAoJrmaZ",
  gold: "aohamJrmaEngine",
  gold2: "goldKeko",
  divScan: "rsiPuNu",
};

export { DOKTOR_HULL_MIN_BARS, DOKTOR_HULL_FETCH_LIMIT } from "@/lib/indicators/doktorHull";
export { HAM_AO_JRMA_Z_MIN_BARS } from "@/lib/indicators/hamAoJrmaZ";
export { AOHAM_JRMA_MIN_BARS } from "@/lib/indicators/aohamJrmaEngine";
export { GOLD_KEKO_MIN_BARS, GOLD_KEKO_FETCH_LIMIT } from "@/lib/indicators/goldKeko";
// DIV_SCAN_FETCH_LIMIT / DIV_SCAN_MIN_BARS exported above with DivScan types
