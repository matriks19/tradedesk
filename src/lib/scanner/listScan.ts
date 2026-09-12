import type { Candle } from "@/lib/types";
import { hamJurikTpo } from "@/lib/indicators/hamJurikTpo";
import { recentDiagonalSr } from "@/lib/indicators/diagonalSr";
import { closes, macd, stochastic } from "@/lib/indicators/math";
import type { ScannerFilter } from "@/lib/scanner/engine";

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

export type ListScanKind = "ham" | "macd" | "stoch" | "diag";

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
  if (!cfg.enabled || !cfg.conds.length) return [];
  if (candles.length < 80) return [];
  const h = hamJurikTpo(candles, {
    hamLen: cfg.hamLen,
    hamLenSlow: cfg.hamLenSlow,
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
    for (const cond of cfg.conds) {
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
  if (!cfg.enabled || !cfg.conds.length) return [];
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
    for (const cond of cfg.conds) {
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
  if (!cfg.enabled || !cfg.conds.length) return [];
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
    for (const cond of cfg.conds) {
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
  if (!cfg.enabled || !cfg.conds.length) return [];
  const hits: ListScanHit[] = [];
  const seen = new Set<string>();
  for (const cond of cfg.conds) {
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

/**
 * Scan one symbol for enabled list-scan indicators.
 * Per enabled indicator: OR among selected conditions.
 * matchMode "all": only return hits if every enabled indicator produced ≥1 hit.
 */
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
  if (!enabledKinds.length) return [];

  const byKind: Record<ListScanKind, ListScanHit[]> = {
    ham: cfg.ham ? scanHam(candles, cfg.ham, maxBarsAgo) : [],
    diag: cfg.diag ? scanDiag(candles, cfg.diag, maxBarsAgo) : [],
    macd: cfg.macd ? scanMacd(candles, cfg.macd, maxBarsAgo) : [],
    stoch: cfg.stoch ? scanStoch(candles, cfg.stoch, maxBarsAgo) : [],
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
  return {};
}

export const KIND_TO_INDICATOR: Record<
  ListScanKind,
  "hamJurikTpo" | "diagonalSr" | "macd" | "stochastic"
> = {
  ham: "hamJurikTpo",
  diag: "diagonalSr",
  macd: "macd",
  stoch: "stochastic",
};
