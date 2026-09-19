"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { Candle, Exchange, Timeframe, AlertScanKey, Watchlist, TickerQuote } from "@/lib/types";
import { binancePerpWatchlistMeta } from "@/lib/data/binanceLists";
import { sectorWatchlistMeta } from "@/lib/data/bistSectors";
import {
  mapPool,
  matchFilters,
  type ScannerFilter,
} from "@/lib/scanner/engine";
import { fetchWatchlistQuotes } from "@/lib/scanner/watchlistQuotes";
import {
  scanSymbol,
  indicatorParamsFromConfig,
  KIND_TO_INDICATOR,
  type HamCond,
  type MacdCond,
  type StochCond,
  type DiagCond,
  type DiCond,
  type HullCond,
  type HamAoCond,
  type GoldCond,
  type Gold2Cond,
  type MacdLongCond,
  type BbTrendCond,
  type HamBbCond,
  type HamBbPriceCond,
  type ListScanConfig,
  DOKTOR_HULL_FETCH_LIMIT,
  DOKTOR_HULL_MIN_BARS,
  HAM_AO_JRMA_Z_MIN_BARS,
  AOHAM_JRMA_MIN_BARS,
  GOLD_KEKO_MIN_BARS,
  GOLD_KEKO_FETCH_LIMIT,
  ALL_GOLD_CONDS,
  ALL_GOLD2_CONDS,
  DEFAULT_MACD_LONG_CONDS,
  DEFAULT_BB_TREND_CONDS,
  DEFAULT_HAM_BB_CONDS,
  DEFAULT_HAM_BB_PRICE_CONDS,
  MACD_LONG_MIN_BARS,
  MACD_LONG_FETCH_LIMIT,
  BB_TREND_MIN_BARS,
  BB_TREND_FETCH_LIMIT,
  HAM_BB_MIN_BARS,
  HAM_BB_FETCH_LIMIT,
  HAM_BB_PRICE_MIN_BARS,
  HAM_BB_PRICE_FETCH_LIMIT,
  extraIndicatorsFromConfig,
  type ListScanHit,
  type ListScanKind,
  type PineCond,
} from "@/lib/scanner/listScan";
import { convertAny } from "@/lib/scripts/pine/translate";
import type { CustomScript } from "@/lib/types";
import clsx from "clsx";

const TFS: Timeframe[] = [
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "2d",
  "3d",
];

const HAM_CHIPS: { id: HamCond; label: string }[] = [
  { id: "raw_up", label: "Raw↑" },
  { id: "raw_dn", label: "Raw↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_zero_dn", label: "Hist0↓" },
  { id: "hist_pos", label: "Hist+" },
  { id: "hist_neg", label: "Hist−" },
  { id: "hist_turn", label: "Hist→" },
  { id: "dual_up", label: "Osc H×Y↑" },
  { id: "dual_dn", label: "Osc H×Y↓" },
  { id: "raw_dual_up", label: "Raw H×Y↑" },
  { id: "raw_dual_dn", label: "Raw H×Y↓" },
  { id: "raw_slow_up", label: "RawY↑" },
  { id: "raw_slow_dn", label: "RawY↓" },
  { id: "raw_slow_x_osc_up", label: "RawY×Osc↑" },
  { id: "raw_slow_x_osc_dn", label: "RawY×Osc↓" },
  { id: "osc_fast_up", label: "OscH↑" },
  { id: "osc_fast_dn", label: "OscH↓" },
  { id: "osc_slow_up", label: "OscY↑" },
  { id: "osc_slow_dn", label: "OscY↓" },
  { id: "osc_fast_zero_up", label: "OscH 0↑" },
  { id: "osc_fast_zero_dn", label: "OscH 0↓" },
  { id: "osc_slow_zero_up", label: "OscY 0↑" },
  { id: "osc_slow_zero_dn", label: "OscY 0↓" },
  { id: "raw_x_osc_up", label: "Raw×Osc↑" },
  { id: "raw_x_osc_dn", label: "Raw×Osc↓" },
  { id: "raw_x_hist_up", label: "Raw×H↑" },
  { id: "raw_x_hist_dn", label: "Raw×H↓" },
  { id: "setup", label: "Setup" },
  { id: "confirm", label: "Onay" },
  { id: "al", label: "AL" },
];

const HAM_BB_CHIPS: { id: HamBbCond; label: string }[] = [
  { id: "raw_dual_up", label: "Raw H×Y↑" },
  { id: "raw_dual_dn", label: "Raw H×Y↓" },
  { id: "ham_x_mid_up", label: "HAM×BB orta↑" },
  { id: "ham_x_mid_dn", label: "HAM×BB orta↓" },
  { id: "ham_x_lower_up", label: "HAM×alt↑ (dip)" },
  { id: "ham_x_upper_dn", label: "HAM×üst↓" },
  { id: "raw_xy_lower", label: "Raw+Alt" },
];

const HAM_BB_PRICE_CHIPS: { id: HamBbPriceCond; label: string }[] = [
  { id: "raw_dual_up", label: "Raw H×Y↑" },
  { id: "raw_dual_dn", label: "Raw H×Y↓" },
  { id: "lower_x_up", label: "Fiyat alt↑" },
  { id: "bb_x_mid", label: "Fiyat orta↑" },
  { id: "ham_x_lower", label: "Raw+Alt" },
];

const DIAG_CHIPS: { id: DiagCond; label: string }[] = [
  { id: "bounce", label: "Temas" },
  { id: "break", label: "Kırılım" },
  { id: "twin_bull", label: "İkili↑" },
  { id: "twin_bear", label: "İkili↓" },
  { id: "triple_bull", label: "Üçlü↑" },
  { id: "triple_bear", label: "Üçlü↓" },
];

const MACD_CHIPS: { id: MacdCond; label: string }[] = [
  { id: "cross_up", label: "×Sig↑" },
  { id: "cross_dn", label: "×Sig↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_zero_dn", label: "Hist0↓" },
  { id: "hist_pos", label: "Hist+" },
  { id: "hist_neg", label: "Hist−" },
];

const STOCH_CHIPS: { id: StochCond; label: string }[] = [
  { id: "os", label: "OS" },
  { id: "ob", label: "OB" },
  { id: "kx_up", label: "K×D↑" },
  { id: "kx_dn", label: "K×D↓" },
  { id: "kx_up_os", label: "↑15–25" },
  { id: "kx_dn_ob", label: "↓75–85" },
];

const DI_CHIPS: { id: DiCond; label: string }[] = [
  { id: "plus_x_minus", label: "+DI×−DI↑" },
  { id: "minus_x_plus", label: "−DI×+DI↑" },
  { id: "plus_above", label: "+DI>−DI" },
  { id: "minus_above", label: "−DI>+DI" },
  { id: "adx_above", label: "ADX>25" },
];

const HULL_CHIPS: { id: HullCond; label: string }[] = [
  { id: "al", label: "AL 100↑200" },
  { id: "sat", label: "SAT 21↓100" },
  { id: "c50_100", label: "50↑100" },
  { id: "c50_200", label: "50↑200" },
  { id: "c100_200", label: "100↑200" },
  { id: "c21_50", label: "21↑50" },
  { id: "c21_100", label: "21↑100" },
  { id: "chart_al", label: "Grafik AL 13↑50" },
  { id: "chart_sat", label: "Grafik SAT 21↓50" },
];

const HAM_AO_CHIPS: { id: HamAoCond; label: string }[] = [
  { id: "rma_up_pt", label: "RMA↑ PT" },
  { id: "ao_up_pt", label: "AO↑ PT" },
  { id: "ao_up_nt", label: "AO↑ NT" },
  { id: "pt_x_nt", label: "PT↑ NT" },
  { id: "nt_x_pt", label: "NT↑ PT" },
];

const GOLD_CHIPS: { id: GoldCond; label: string }[] = [
  { id: "ao_x_score_al", label: "AO↑ Score" },
  { id: "ao_x_rma_al", label: "AO↑ RMA" },
  { id: "ao_x_score_sat", label: "AO↓ Score" },
  { id: "ao_x_rma_sat", label: "AO↓ RMA" },
  { id: "pt_x_nt", label: "PT↑ NT" },
  { id: "nt_x_pt", label: "NT↑ PT" },
  { id: "div_bull", label: "Uyumsuzluk AL" },
  { id: "div_bear", label: "Uyumsuzluk SAT" },
];

const GOLD2_CHIPS: { id: Gold2Cond; label: string }[] = [
  { id: "raw_x_rma_al", label: "Raw↑ RMA AL" },
  { id: "raw_x_rma_sat", label: "Raw↓ RMA SAT" },
  { id: "core_x_rma_al", label: "Core↑ RMA AL" },
  { id: "core_x_rma_sat", label: "Core↓ RMA SAT" },
  { id: "disp_x_rma_al", label: "Disp↑ RMA AL" },
  { id: "disp_x_rma_sat", label: "Disp↓ RMA SAT" },
  { id: "breakout_up_aligned", label: "Kırılım↑ onay" },
  { id: "breakout_down_aligned", label: "Kırılım↓ onay" },
  { id: "breakout_up_counter", label: "Kırılım↑ şüphe" },
  { id: "breakout_down_counter", label: "Kırılım↓ şüphe" },
  { id: "charge_full_bull", label: "Şarj+ doldu" },
  { id: "charge_full_bear", label: "Şarj− doldu" },
  { id: "polarity_flip_up", label: "Kutup↑" },
  { id: "polarity_flip_down", label: "Kutup↓" },
  { id: "div_bull", label: "Uyumsuzluk AL" },
  { id: "div_bear", label: "Uyumsuzluk SAT" },
];

const MACD_LONG_CHIPS: { id: MacdLongCond; label: string }[] = [
  { id: "cross_up", label: "×Sig↑" },
  { id: "cross_dn", label: "×Sig↓" },
];

const BB_TREND_CHIPS: { id: BbTrendCond; label: string }[] = [
  { id: "bb_x_ema", label: "BB×EMA↑" },
  { id: "bb_x_ema_dn", label: "BB×EMA↓" },
  { id: "lower_x_up", label: "Alt band↑" },
];

const EXTRA_CHIPS: { id: string; label: string; filter: ScannerFilter }[] = [
  { id: "rsi30", label: "RSI<30", filter: { type: "rsi", op: "lt", value: 30 } },
  { id: "rsi70", label: "RSI>70", filter: { type: "rsi", op: "gt", value: 70 } },
  { id: "vol2", label: "Vol×2", filter: { type: "volumeSpike", mult: 2 } },
  { id: "ema_b", label: "EMA↑", filter: { type: "emaCross", direction: "bull" } },
  {
    id: "rsi_div_bull",
    label: "RSI Uyumsuzluk AL",
    filter: {
      type: "rsiPuNu",
      direction: "bull",
      maxBarsAgo: 2,
      rangeLower: 50,
      rangeUpper: 150,
      lbL: 5,
      lbR: 2,
    },
  },
  {
    id: "rsi_div_bear",
    label: "RSI Uyumsuzluk SAT",
    filter: {
      type: "rsiPuNu",
      direction: "bear",
      maxBarsAgo: 2,
      rangeLower: 50,
      rangeUpper: 150,
      lbL: 5,
      lbR: 2,
    },
  },
];

type UniSrc = "crypto" | "bist" | "sector" | "active";
type UniOpt = { id: string; name: string; symbols: { symbol: string; exchange: Exchange }[] };

function classifyList(w: Watchlist): "crypto" | "bist" {
  if (w.id.startsWith("binance-")) return "crypto";
  if (w.id.startsWith("bist-")) return "bist";
  const bn = w.symbols.filter((s) => s.exchange === "binance").length;
  const bi = w.symbols.filter((s) => s.exchange === "bist").length;
  return bn >= bi ? "crypto" : "bist";
}

function isSectorId(id: string): boolean {
  return id.startsWith("bist-") && id !== "bist-all";
}

function cryptoOptions(watchlists: Watchlist[]): UniOpt[] {
  const byId = new Map<string, UniOpt>();
  for (const m of binancePerpWatchlistMeta()) {
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      symbols: m.symbols.map((symbol) => ({ symbol, exchange: "binance" as const })),
    });
  }
  for (const w of watchlists) {
    if (classifyList(w) !== "crypto") continue;
    const prev = byId.get(w.id);
    if (!prev || w.symbols.length >= prev.symbols.length) {
      byId.set(w.id, { id: w.id, name: w.name, symbols: w.symbols });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function bistOptions(watchlists: Watchlist[]): UniOpt[] {
  const byId = new Map<string, UniOpt>();
  for (const m of sectorWatchlistMeta()) {
    if (m.id !== "bist-all") continue;
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      symbols: m.symbols.map((symbol) => ({ symbol, exchange: "bist" as const })),
    });
  }
  for (const w of watchlists) {
    if (classifyList(w) !== "bist" || isSectorId(w.id)) continue;
    const prev = byId.get(w.id);
    if (!prev || w.symbols.length >= prev.symbols.length) {
      byId.set(w.id, { id: w.id, name: w.name, symbols: w.symbols });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function sectorOptions(): UniOpt[] {
  return sectorWatchlistMeta()
    .filter((m) => m.id !== "bist-all")
    .map((m) => ({
      id: m.id,
      name: m.name,
      symbols: m.symbols.map((symbol) => ({ symbol, exchange: "bist" as const })),
    }));
}

type ResultRow = ListScanHit & {
  symbol: string;
  exchange: Exchange;
};

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Add id if missing — used when turning a scanner card on via chip. */
function ensureCond<T>(arr: T[], id: T): T[] {
  return arr.includes(id) ? arr : [...arr, id];
}

/** Toggle id but never empty the array (last chip stays selected). */
function toggleCondKeepOne<T>(arr: T[], id: T): T[] {
  if (!arr.includes(id)) return [...arr, id];
  if (arr.length <= 1) return arr;
  return arr.filter((x) => x !== id);
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "px-1.5 py-0.5 rounded text-2xs border",
        active
          ? "border-desk-accent bg-desk-accent/20 text-desk-accent"
          : "border-desk-border/50 text-desk-muted hover:border-desk-border"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="text-2xs text-desk-muted flex flex-col gap-0.5 min-w-0">
      <span className="truncate">{label}</span>
      <input
        type="number"
        className="input text-2xs py-0.5"
        value={value}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
      <span>{label}</span>
      <input
        type="color"
        className="h-6 w-full cursor-pointer bg-transparent border border-desk-border/40 rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SectionCard({
  title,
  enabled,
  onToggle,
  open,
  onOpen,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-desk-border/40 rounded">
      <div className="flex items-center gap-2 px-2 py-1 bg-desk-elevated/50">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="accent-desk-accent"
        />
        <button
          type="button"
          className="flex-1 text-left text-xs font-medium"
          onClick={onOpen}
        >
          {title} {open ? "▾" : "▸"}
        </button>
      </div>
      {open && <div className="p-2 space-y-2">{children}</div>}
    </div>
  );
}

function hamCondToScanKey(cond: string): AlertScanKey | null {
  if (cond === "setup") return "ham_setup";
  if (cond === "confirm") return "ham_confirm";
  if (cond === "al") return "ham_al";
  if (cond === "dual_up") return "ham_dual_up";
  if (cond === "dual_dn") return "ham_dual_dn";
  return null;
}

function diagCondToScanKey(cond: string): AlertScanKey | null {
  if (cond === "bounce") return "diag_bounce";
  if (cond === "break") return "diag_break";
  return null;
}

export function ListScanPanel() {
  const watchlists = useDeskStore((s) => s.watchlists);
  const activeWatchlistId = useDeskStore((s) => s.activeWatchlistId);
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const addIndicator = useDeskStore((s) => s.addIndicator);
  const updateIndicatorParams = useDeskStore((s) => s.updateIndicatorParams);
  const addAlertsBulk = useDeskStore((s) => s.addAlertsBulk);
  const scripts = useDeskStore((s) => s.scripts);
  const upsertScript = useDeskStore((s) => s.upsertScript);
  const applyScriptToActive = useDeskStore((s) => s.applyScriptToActive);

  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const activeList =
    watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];

  const [uniSrc, setUniSrc] = useState<UniSrc>("crypto");
  const [uniId, setUniId] = useState("binance-perp-usdt");

  const cryptoOpts = useMemo(() => cryptoOptions(watchlists), [watchlists]);
  const bistOpts = useMemo(() => bistOptions(watchlists), [watchlists]);
  const sectorOpts = useMemo(() => sectorOptions(), []);
  const uniOpts = useMemo(() => {
    if (uniSrc === "crypto") return cryptoOpts;
    if (uniSrc === "bist") return bistOpts;
    if (uniSrc === "sector") return sectorOpts;
    return [];
  }, [uniSrc, cryptoOpts, bistOpts, sectorOpts]);

  const universe = useMemo(() => {
    if (uniSrc === "active") {
      return {
        id: activeList?.id ?? "active",
        name: activeList?.name ?? "Aktif",
        symbols: activeList?.symbols ?? [],
      } satisfies UniOpt;
    }
    return uniOpts.find((o) => o.id === uniId) ?? uniOpts[0] ?? {
      id: "",
      name: "—",
      symbols: [],
    };
  }, [uniSrc, uniId, uniOpts, activeList]);

  const [tf, setTf] = useState<Timeframe>(
    () => (pane?.timeframe as Timeframe) || "15m"
  );
  const [maxBars, setMaxBars] = useState(2);
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");

  const [hamOn, setHamOn] = useState(true);
  const [hamBbOn, setHamBbOn] = useState(false);
  const [hamBbPriceOn, setHamBbPriceOn] = useState(false);
  const [diagOn, setDiagOn] = useState(false);
  const [macdOn, setMacdOn] = useState(false);
  const [stochOn, setStochOn] = useState(false);
  const [diOn, setDiOn] = useState(false);
  const [hullOn, setHullOn] = useState(false);
  const [hamAoOn, setHamAoOn] = useState(false);
  const [goldOn, setGoldOn] = useState(false);
  const [gold2On, setGold2On] = useState(false);
  const [macdLongOn, setMacdLongOn] = useState(false);
  const [bbTrendOn, setBbTrendOn] = useState(false);

  const [hamConds, setHamConds] = useState<HamCond[]>(["raw_dual_up"]);
  const [hamBbConds, setHamBbConds] = useState<HamBbCond[]>([
    ...DEFAULT_HAM_BB_CONDS,
  ]);
  const [hamBbPriceConds, setHamBbPriceConds] = useState<HamBbPriceCond[]>([
    ...DEFAULT_HAM_BB_PRICE_CONDS,
  ]);
  const [diagConds, setDiagConds] = useState<DiagCond[]>(["bounce"]);
  const [macdConds, setMacdConds] = useState<MacdCond[]>(["cross_up"]);
  const [stochConds, setStochConds] = useState<StochCond[]>(["kx_up_os"]);
  const [diConds, setDiConds] = useState<DiCond[]>(["plus_x_minus"]);
  const [hullConds, setHullConds] = useState<HullCond[]>(["al"]);
  const [hamAoConds, setHamAoConds] = useState<HamAoCond[]>([
    "rma_up_pt",
    "ao_up_pt",
    "pt_x_nt",
  ]);
  const [goldConds, setGoldConds] = useState<GoldCond[]>([
    "ao_x_score_al",
    "ao_x_rma_al",
    "ao_x_score_sat",
    "ao_x_rma_sat",
    "pt_x_nt",
    "nt_x_pt",
  ]);
  const [gold2Conds, setGold2Conds] = useState<Gold2Cond[]>([
    "raw_x_rma_al",
    "raw_x_rma_sat",
    "core_x_rma_al",
    "core_x_rma_sat",
    "disp_x_rma_al",
    "disp_x_rma_sat",
  ]);
  const [macdLongConds, setMacdLongConds] = useState<MacdLongCond[]>([
    ...DEFAULT_MACD_LONG_CONDS,
  ]);
  const [bbTrendConds, setBbTrendConds] = useState<BbTrendCond[]>([
    ...DEFAULT_BB_TREND_CONDS,
  ]);

  const [hamLen, setHamLen] = useState(21);
  const [hamLenSlow, setHamLenSlow] = useState(34);
  const [rawLen, setRawLen] = useState(10);
  const [rawLenSlow, setRawLenSlow] = useState(21);
  const [momSpan, setMomSpan] = useState(10);
  const [normLen, setNormLen] = useState(80);
  const [jLen, setJLen] = useState(20);
  const [jPhase, setJPhase] = useState(0);
  const [postSmooth, setPostSmooth] = useState(5);
  const [colorOsc, setColorOsc] = useState("#18d0bd");
  const [colorSlow, setColorSlow] = useState("#ffb74d");
  const [colorRaw, setColorRaw] = useState("#8b95a8");
  const [colorRawSlow, setColorRawSlow] = useState("#ce93d8");
  const [colorHistUp, setColorHistUp] = useState("#00c878");
  const [colorHistDn, setColorHistDn] = useState("#dc283c");

  const [pivotWindow, setPivotWindow] = useState(6);
  const [historyBars, setHistoryBars] = useState(300);
  const [left, setLeft] = useState(30);
  const [right, setRight] = useState(30);
  const [colorSup, setColorSup] = useState("#7BCB8B");
  const [colorRes, setColorRes] = useState("#ff77ad");

  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [colorMacd, setColorMacd] = useState("#2962ff");
  const [colorSignal, setColorSignal] = useState("#ff6d00");
  const [colorHist, setColorHist] = useState("#26a69a");

  const [macdLongFast, setMacdLongFast] = useState(100);
  const [macdLongSlow, setMacdLongSlow] = useState(200);
  const [macdLongSignal, setMacdLongSignal] = useState(50);
  const [bbTrendBbPeriod, setBbTrendBbPeriod] = useState(20);
  const [bbTrendBbMult, setBbTrendBbMult] = useState(2);
  const [bbTrendEmaPeriod, setBbTrendEmaPeriod] = useState(200);
  const [hamBbBbPeriod, setHamBbBbPeriod] = useState(20);
  const [hamBbBbMult, setHamBbBbMult] = useState(2);
  const [hamBbPriceBbPeriod, setHamBbPriceBbPeriod] = useState(20);
  const [hamBbPriceBbMult, setHamBbPriceBbMult] = useState(2);

  const [kPeriod, setKPeriod] = useState(14);
  const [dPeriod, setDPeriod] = useState(3);
  const [stochOs, setStochOs] = useState(20);
  const [stochOb, setStochOb] = useState(80);
  const [colorK, setColorK] = useState("#2962ff");
  const [colorD, setColorD] = useState("#ff6d00");

  const [diPeriod, setDiPeriod] = useState(14);
  const [diAdxMin, setDiAdxMin] = useState(25);

  const [hullMode, setHullMode] = useState<"Hma" | "Ehma" | "Thma">("Hma");
  /** Pine tfScan default 240 → 4h; used when Hull is on */
  const [hullTf, setHullTf] = useState<Timeframe>("4h");
  const [colorH8, setColorH8] = useState("#00ff00");
  const [colorH13, setColorH13] = useState("#7cfc00");
  const [colorH21, setColorH21] = useState("#ffff00");
  const [colorH50, setColorH50] = useState("#ff8c00");
  const [colorH100, setColorH100] = useState("#ff0000");
  const [colorH200, setColorH200] = useState("#8b0000");

  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>("ham");
  const [extraOpen, setExtraOpen] = useState(false);
  const [pineDraft, setPineDraft] = useState(
    '//@version=6\nindicator("Liste Pine", overlay=false)\nplot(ta.rsi(close, 14) - 50, "RSI50")\n'
  );
  const [pineName, setPineName] = useState("Liste Pine");
  const [pineIds, setPineIds] = useState<string[]>([]);

  /**
   * Enable Gold without killing HAM/etc. Only: matchMode=any (so Hepsi can't
   * AND-gate with ham), mutual-exclude Gold2, reset conds to full chip list.
   */
  const enableGold = useCallback(() => {
    setGoldOn(true);
    setGold2On(false);
    setMatchMode("any");
    setGoldConds([...ALL_GOLD_CONDS]);
  }, []);
  const enableGold2 = useCallback(() => {
    setGold2On(true);
    setGoldOn(false);
    setMatchMode("any");
    setGold2Conds([...ALL_GOLD2_CONDS]);
  }, []);
  const enableMacdLong = useCallback(() => {
    setMacdLongOn(true);
    setMatchMode("any");
    setMacdLongConds([...DEFAULT_MACD_LONG_CONDS]);
  }, []);
  const enableBbTrend = useCallback(() => {
    setBbTrendOn(true);
    setMatchMode("any");
    setBbTrendConds([...DEFAULT_BB_TREND_CONDS]);
  }, []);
  const enableHamBb = useCallback(() => {
    setHamBbOn(true);
    setMatchMode("any");
    setHamBbConds([...DEFAULT_HAM_BB_CONDS]);
  }, []);
  const enableHamBbPrice = useCallback(() => {
    setHamBbPriceOn(true);
    setMatchMode("any");
    setHamBbPriceConds([...DEFAULT_HAM_BB_PRICE_CONDS]);
  }, []);

  /** If enabling a kind while another is already on → force Herhangi (any). */
  const bumpMatchModeOnSecondKind = useCallback(
    (alreadyOn: boolean, otherOns: boolean[]) => {
      if (!alreadyOn && otherOns.some(Boolean)) setMatchMode("any");
    },
    []
  );
  const [pineConds, setPineConds] = useState<PineCond[]>(["zero_up", "cross_up"]);
  const [pineStatus, setPineStatus] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("");
  const [hits, setHits] = useState<ResultRow[]>([]);

  const buildConfig = useCallback((): ListScanConfig => {
    return {
      matchMode,
      ham: {
        enabled: hamOn,
        conds: hamConds,
        hamLen,
        hamLenSlow,
        rawLen,
        rawLenSlow,
        momSpan,
        normLen,
        jLen,
        jPhase,
        postSmooth,
        colorOsc,
        colorSlow,
        colorRaw,
        colorRawSlow,
        colorHistUp,
        colorHistDn,
      },
      hamBb: {
        enabled: hamBbOn,
        conds: hamBbConds,
        hamLen,
        hamLenSlow,
        rawLen,
        rawLenSlow,
        momSpan,
        normLen,
        jLen,
        jPhase,
        postSmooth,
        bbPeriod: hamBbBbPeriod,
        bbMult: hamBbBbMult,
      },
      hamBbPrice: {
        enabled: hamBbPriceOn,
        conds: hamBbPriceConds,
        hamLen,
        hamLenSlow,
        rawLen,
        rawLenSlow,
        momSpan,
        normLen,
        jLen,
        jPhase,
        postSmooth,
        bbPeriod: hamBbPriceBbPeriod,
        bbMult: hamBbPriceBbMult,
      },
      diag: {
        enabled: diagOn,
        conds: diagConds,
        pivotWindow,
        historyBars,
        left,
        right,
        colorSup,
        colorRes,
      },
      macd: {
        enabled: macdOn,
        conds: macdConds,
        fast: macdFast,
        slow: macdSlow,
        signal: macdSignal,
        colorMacd,
        colorSignal,
        colorHist,
      },
      stoch: {
        enabled: stochOn,
        conds: stochConds,
        kPeriod,
        dPeriod,
        os: stochOs,
        ob: stochOb,
        colorK,
        colorD,
      },
      di: {
        enabled: diOn,
        conds: diConds,
        period: diPeriod,
        adxMin: diAdxMin,
      },
      hull: {
        enabled: hullOn,
        conds: hullConds,
        mode: hullMode,
        tf: hullTf,
        color8: colorH8,
        color13: colorH13,
        color21: colorH21,
        color50: colorH50,
        color100: colorH100,
        color200: colorH200,
      },
      hamAo: {
        enabled: hamAoOn,
        conds: hamAoConds,
      },
      gold: {
        enabled: goldOn,
        conds: goldConds,
      },
      gold2: {
        enabled: gold2On,
        conds: gold2Conds,
      },
      macdLong: {
        enabled: macdLongOn,
        conds: macdLongConds,
        fast: macdLongFast,
        slow: macdLongSlow,
        signal: macdLongSignal,
      },
      bbTrend: {
        enabled: bbTrendOn,
        conds: bbTrendConds,
        bbPeriod: bbTrendBbPeriod,
        bbMult: bbTrendBbMult,
        emaPeriod: bbTrendEmaPeriod,
      },
      extraFilters: EXTRA_CHIPS.filter((c) => extraIds.includes(c.id)).map(
        (c) => c.filter
      ),
      pine: {
        enabled: pineIds.length > 0,
        scripts: scripts
          .filter((s) => pineIds.includes(s.id))
          .map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            language: s.language,
            conds: pineConds,
          })),
      },
    };
  }, [
    matchMode,
    hamOn,
    hamBbOn,
    hamBbConds,
    hamBbBbPeriod,
    hamBbBbMult,
    hamBbPriceOn,
    hamBbPriceConds,
    hamBbPriceBbPeriod,
    hamBbPriceBbMult,
    hamConds,
    hamLen,
    hamLenSlow,
    rawLen,
    rawLenSlow,
    momSpan,
    normLen,
    jLen,
    jPhase,
    postSmooth,
    colorOsc,
    colorSlow,
    colorRaw,
    colorRawSlow,
    colorHistUp,
    colorHistDn,
    diagOn,
    diagConds,
    pivotWindow,
    historyBars,
    left,
    right,
    colorSup,
    colorRes,
    macdOn,
    macdConds,
    macdFast,
    macdSlow,
    macdSignal,
    colorMacd,
    colorSignal,
    colorHist,
    stochOn,
    stochConds,
    kPeriod,
    dPeriod,
    stochOs,
    stochOb,
    colorK,
    colorD,
    diOn,
    diConds,
    diPeriod,
    diAdxMin,
    hullOn,
    hullConds,
    hullMode,
    hullTf,
    hamAoOn,
    hamAoConds,
    goldOn,
    goldConds,
    gold2On,
    gold2Conds,
    macdLongOn,
    macdLongConds,
    macdLongFast,
    macdLongSlow,
    macdLongSignal,
    bbTrendOn,
    bbTrendConds,
    bbTrendBbPeriod,
    bbTrendBbMult,
    bbTrendEmaPeriod,
    colorH8,
    colorH13,
    colorH21,
    colorH50,
    colorH100,
    colorH200,
    extraIds,
    pineIds,
    pineConds,
    scripts,
  ]);

  const abortRef = useRef<AbortController | null>(null);

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runScan = useCallback(async () => {
    if (!universe.symbols.length) {
      setStatus("Liste boş — kripto / BIST / sektör seç");
      return;
    }
    const cfg = buildConfig();
    if (!cfg.ham?.enabled && !cfg.diag?.enabled && !cfg.macd?.enabled && !cfg.stoch?.enabled && !cfg.di?.enabled && !cfg.hull?.enabled && !cfg.hamAo?.enabled && !cfg.gold?.enabled && !cfg.gold2?.enabled && !cfg.macdLong?.enabled && !cfg.bbTrend?.enabled && !cfg.hamBb?.enabled && !cfg.hamBbPrice?.enabled && !cfg.pine?.enabled) {
      setStatus("En az bir gösterge seçin");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRunning(true);
    setHits([]);
    setStatus("");
    const total = universe.symbols.length;
    setProgress(`0/${total}`);

    const extrasNeedTicker = (cfg.extraFilters ?? []).some(
      (f) => f.type === "volumeSpike" || f.type === "changePct"
    );

    try {
      let quotes: TickerQuote[] = universe.symbols.map((s) => ({
        symbol: s.symbol,
        exchange: s.exchange,
        last: 0,
        changePct: 0,
      }));
      if (extrasNeedTicker) {
        setProgress(`kotasyon 0/${total}`);
        try {
          const ticked = await fetchWatchlistQuotes(universe.symbols);
          if (ticked.length) quotes = ticked;
        } catch {
          /* kline taramasına devam */
        }
        if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
      }

      const out: ResultRow[] = [];
      let done = 0;
      let lastProgressAt = 0;
      const isBist = universe.symbols[0]?.exchange === "bist";
      const concurrency = isBist ? 3 : total > 200 ? 6 : 8;
      const klineMs = isBist ? 6000 : 10000;
      await mapPool(
        quotes,
        concurrency,
        async (q) => {
          if (ac.signal.aborted) return null;
          try {
            const fetchSignal =
              typeof AbortSignal !== "undefined" &&
              typeof AbortSignal.any === "function" &&
              typeof AbortSignal.timeout === "function"
                ? AbortSignal.any([ac.signal, AbortSignal.timeout(klineMs)])
                : ac.signal;
            const useHull = !!cfg.hull?.enabled;
            const useGold = !!cfg.gold?.enabled;
            const useGold2 = !!cfg.gold2?.enabled;
            const useHamAo = !!cfg.hamAo?.enabled;
            const useMacdLong = !!cfg.macdLong?.enabled;
            const useBbTrend = !!cfg.bbTrend?.enabled;
            const useHamBb = !!cfg.hamBb?.enabled;
            const useHamBbPrice = !!cfg.hamBbPrice?.enabled;
            const scanTf = useHull && cfg.hull?.tf ? String(cfg.hull.tf) : tf;
            // Warmup via klineLimit/minBars; edge lookback stays UI maxBars (default 2)
            // hamBb/hamBbPrice alone: 220 (+ historyBars if raised); bbTrend keeps 300 floor
            const hamBbFetchNeed = Math.max(
              useHamBb ? HAM_BB_FETCH_LIMIT : 0,
              useHamBbPrice ? HAM_BB_PRICE_FETCH_LIMIT : 0
            );
            const klineLimit = useHull
              ? DOKTOR_HULL_FETCH_LIMIT
              : useGold2
                ? GOLD_KEKO_FETCH_LIMIT
                : useMacdLong
                  ? Math.max(MACD_LONG_FETCH_LIMIT, historyBars, 500)
                  : useBbTrend
                    ? Math.max(
                        BB_TREND_FETCH_LIMIT,
                        hamBbFetchNeed,
                        historyBars,
                        300
                      )
                    : hamBbFetchNeed
                      ? Math.max(hamBbFetchNeed, historyBars)
                      : useGold || useHamAo
                        ? 260
                        : 220;
            const minBars = useHull
              ? DOKTOR_HULL_MIN_BARS
              : useGold2
                ? GOLD_KEKO_MIN_BARS
                : useGold
                  ? AOHAM_JRMA_MIN_BARS
                  : useHamAo
                    ? HAM_AO_JRMA_Z_MIN_BARS
                    : useMacdLong
                      ? MACD_LONG_MIN_BARS
                      : useBbTrend
                        ? BB_TREND_MIN_BARS
                        : useHamBb
                          ? HAM_BB_MIN_BARS
                          : useHamBbPrice
                            ? HAM_BB_PRICE_MIN_BARS
                            : 50;
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${q.exchange}&timeframe=${encodeURIComponent(scanTf)}&limit=${klineLimit}`,
              { signal: fetchSignal }
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < minBars) return null;
            let found = scanSymbol(candles, cfg, maxBars);
            if (found.length && cfg.extraFilters?.length) {
              const m = matchFilters(q, candles, cfg.extraFilters);
              if (!m.ok) found = [];
              else {
                found = found.map((h) => ({
                  ...h,
                  note: m.note ? `${h.note} · ${m.note}` : h.note,
                }));
              }
            }
            for (const h of found) {
              out.push({ ...h, symbol: q.symbol, exchange: q.exchange });
            }
          } catch (e) {
            if (ac.signal.aborted) return null;
            /* skip timeout / 502 */
          } finally {
            done += 1;
            const now = performance.now();
            if (
              done === total ||
              done % 20 === 0 ||
              now - lastProgressAt >= 150
            ) {
              lastProgressAt = now;
              setProgress(`${done}/${total} ${q.symbol}`);
            }
            if (done % 30 === 0 || done === total) {
              setHits(
                [...out].sort(
                  (a, b) =>
                    a.barsAgo - b.barsAgo ||
                    a.symbol.localeCompare(b.symbol) ||
                    a.kind.localeCompare(b.kind)
                )
              );
            }
          }
          return null;
        },
        undefined,
        ac.signal
      );
      out.sort(
        (a, b) =>
          a.barsAgo - b.barsAgo ||
          a.symbol.localeCompare(b.symbol) ||
          a.kind.localeCompare(b.kind)
      );
      setHits(out);
      const cfgDone = buildConfig();
      const byKind: string[] = [];
      if (cfgDone.gold?.enabled) {
        const n = out.filter((h) => h.kind === "gold").length;
        byKind.push(`gold ${n}`);
      }
      if (cfgDone.gold2?.enabled) {
        const n = out.filter((h) => h.kind === "gold2").length;
        byKind.push(`gold2 ${n}`);
      }

      if (cfgDone.macdLong?.enabled) {
        const n = out.filter((h) => h.kind === "macdLong").length;
        byKind.push(`macdLong ${n}`);
      }
      if (cfgDone.bbTrend?.enabled) {
        const n = out.filter((h) => h.kind === "bbTrend").length;
        byKind.push(`bbTrend ${n}`);
      }
      if (cfgDone.hamBb?.enabled) {
        const n = out.filter((h) => h.kind === "hamBb").length;
        byKind.push(`hamBb ${n}`);
      }
      if (cfgDone.hamBbPrice?.enabled) {
        const n = out.filter((h) => h.kind === "hamBbPrice").length;
        byKind.push(`hamBbPrice ${n}`);
      }
      if (cfgDone.ham?.enabled) {
        const n = out.filter((h) => h.kind === "ham").length;
        byKind.push(`ham ${n}`);
      }
      const kindBit = byKind.length ? ` · ${byKind.join(" · ")}` : "";
      const enabledKindsCount = [
        cfgDone.ham?.enabled,
        cfgDone.diag?.enabled,
        cfgDone.macd?.enabled,
        cfgDone.stoch?.enabled,
        cfgDone.di?.enabled,
        cfgDone.hull?.enabled,
        cfgDone.hamAo?.enabled,
        cfgDone.gold?.enabled,
        cfgDone.gold2?.enabled,
        cfgDone.macdLong?.enabled,
        cfgDone.bbTrend?.enabled,
        cfgDone.hamBb?.enabled,
        cfgDone.hamBbPrice?.enabled,
        cfgDone.pine?.enabled,
      ].filter(Boolean).length;
      const hepsiWarn =
        matchMode === "all" && enabledKindsCount > 1
          ? " · Uyarı: Hepsi = aynı sembolde tüm göstergeler"
          : "";
      setStatus(
        ac.signal.aborted
          ? `Durdu · ${out.length} hit${kindBit} · ${done}/${total}${hepsiWarn}`
          : `${out.length} hit${kindBit} · ${universe.name} · ${total} · ${tf} · ≤${maxBars} bar · ${matchMode === "all" ? "Hepsi" : "Herhangi"}${hepsiWarn}`
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("Durduruldu");
      } else {
        setStatus(e instanceof Error ? e.message : "tarama hatası");
      }
    } finally {
      setRunning(false);
    }
  }, [universe, buildConfig, tf, maxBars, matchMode, historyBars]);

  const upsertIndicators = useCallback(
    (cfg: ListScanConfig) => {
      if (!pane) return;
      const kinds: Exclude<ListScanKind, "pine">[] = [];
      if (cfg.ham?.enabled) kinds.push("ham");
      if (cfg.hamBb?.enabled) kinds.push("hamBb");
      if (cfg.hamBbPrice?.enabled) kinds.push("hamBbPrice");
      if (cfg.diag?.enabled) kinds.push("diag");
      if (cfg.macd?.enabled) kinds.push("macd");
      if (cfg.stoch?.enabled) kinds.push("stoch");
      if (cfg.di?.enabled) kinds.push("di");
      if (cfg.hull?.enabled) kinds.push("hull");
      if (cfg.hamAo?.enabled) kinds.push("hamAo");
      if (cfg.gold?.enabled) kinds.push("gold");
      if (cfg.gold2?.enabled) kinds.push("gold2");
      if (cfg.macdLong?.enabled) kinds.push("macdLong");
      if (cfg.bbTrend?.enabled) kinds.push("bbTrend");
      for (const kind of kinds) {
        const type = KIND_TO_INDICATOR[kind];
        const params = indicatorParamsFromConfig(kind, cfg);
        const existing = pane.indicators.find((i) => i.type === type);
        if (existing) {
          updateIndicatorParams(pane.id, existing.id, params);
        } else {
          addIndicator(pane.id, type);
          // params applied after add — re-read from store
          const fresh = useDeskStore
            .getState()
            .panes.find((p) => p.id === pane.id);
          const added = fresh?.indicators
            .slice()
            .reverse()
            .find((i) => i.type === type);
          if (added) updateIndicatorParams(pane.id, added.id, params);
        }
      }
      for (const kind of kinds) {
        for (const extra of extraIndicatorsFromConfig(kind, cfg)) {
          const existing = pane.indicators.find((i) => i.type === extra.type);
          if (existing) {
            updateIndicatorParams(pane.id, existing.id, extra.params);
          } else {
            addIndicator(pane.id, extra.type as any);
            const fresh = useDeskStore
              .getState()
              .panes.find((p) => p.id === pane.id);
            const added = fresh?.indicators
              .slice()
              .reverse()
              .find((i) => i.type === extra.type);
            if (added) updateIndicatorParams(pane.id, added.id, extra.params);
          }
        }
      }
      for (const sc of cfg.pine?.scripts ?? []) {
        const has = pane.indicators.some((i) => i.scriptId === sc.id);
        if (!has) applyScriptToActive(sc.id);
      }
    },
    [pane, addIndicator, updateIndicatorParams, applyScriptToActive]
  );

  useEffect(() => {
    if (!hamOn && !diagOn && !macdOn && !stochOn && !diOn && !hullOn && !hamAoOn && !goldOn && !gold2On && !macdLongOn && !bbTrendOn && !hamBbOn && !hamBbPriceOn && !pineIds.length) return;
    upsertIndicators(buildConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn, pineIds.join("|"), pane?.id]);

  const onHitClick = useCallback(
    (row: ResultRow) => {
      const cfg = buildConfig();
      const openTf =
        row.kind === "hull" && cfg.hull?.tf
          ? (cfg.hull.tf as Timeframe)
          : tf;
      openSymbolInActive(row.symbol, row.exchange, openTf);
      // slight delay so pane symbol updates first
      setTimeout(() => upsertIndicators(cfg), 0);
    },
    [buildConfig, openSymbolInActive, tf, upsertIndicators]
  );

  const armListAlerts = useCallback(() => {
    if (!universe.symbols.length) {
      setStatus("Liste boş");
      return;
    }
    const cfg = buildConfig();
    if (!cfg.ham?.enabled && !cfg.diag?.enabled && !cfg.macd?.enabled && !cfg.stoch?.enabled && !cfg.di?.enabled && !cfg.hull?.enabled && !cfg.hamAo?.enabled && !cfg.gold?.enabled && !cfg.gold2?.enabled && !cfg.macdLong?.enabled && !cfg.bbTrend?.enabled && !cfg.hamBb?.enabled && !cfg.hamBbPrice?.enabled && !cfg.pine?.enabled) {
      setStatus("En az bir gösterge seçin");
      return;
    }
    const botReady = !!useDeskStore.getState().botSettings.enabled;
    const alertTf = cfg.hull?.enabled && cfg.hull.tf ? (cfg.hull.tf as Timeframe) : tf;
    const items = universe.symbols.map((s) => ({
      symbol: s.symbol,
      exchange: s.exchange,
      condition: "cross_above" as const,
      price: 0,
      kind: "scan" as const,
      scanKey: "list_scan" as const,
      scanPayload: cfg as unknown as Record<string, unknown>,
      group: "Liste",
      note: `${universe.name} · liste koşulu`,
      timeframe: alertTf,
      repeat: "repeat" as const,
      cooldownMin: 60,
      intervalMin: 15,
      expiresAt: Date.now() + 24 * 3600_000,
      botReady,
      scanPrimed: false,
    }));
    const n = addAlertsBulk(items);
    setStatus(
      `${n} izleme · mevcut sinyal çalmaz · ${universe.name} · bot ${botReady ? "açık" : "kapalı"}`
    );
  }, [universe, buildConfig, addAlertsBulk, tf]);

  const bulkAlerts = useCallback(async () => {
    if (!hits.length) {
      setStatus("Önce Listeyi tara");
      return;
    }
    const cfg = buildConfig();
    const items: Parameters<typeof addAlertsBulk>[0] = [];
    const byEx = new Map<Exchange, string[]>();
    const scanCandidates: ResultRow[] = [];

    for (const h of hits) {
      let scanKey: AlertScanKey | null = null;
      if (h.kind === "ham") scanKey = hamCondToScanKey(h.cond);
      if (h.kind === "diag") scanKey = diagCondToScanKey(h.cond);
      if (h.kind === "di") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "DI",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            di: {
              enabled: true,
              conds: [h.cond],
              period: cfg.di?.period ?? 14,
              adxMin: cfg.di?.adxMin ?? 25,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "hull") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Hull",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            hull: {
              enabled: true,
              conds: [h.cond],
              mode: cfg.hull?.mode ?? "Hma",
              tf: cfg.hull?.tf ?? hullTf,
            },
          },
          timeframe: (cfg.hull?.tf as Timeframe) || hullTf || tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "hamAo") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "HAM+AO",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            hamAo: {
              enabled: true,
              conds: [h.cond as HamAoCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "gold") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Gold",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            gold: {
              enabled: true,
              conds: [h.cond as GoldCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "gold2") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Gold2",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            gold2: {
              enabled: true,
              conds: [h.cond as Gold2Cond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "macdLong") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "MACD Uzun",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            macdLong: {
              enabled: true,
              conds: [h.cond as MacdLongCond],
              fast: cfg.macdLong?.fast ?? 100,
              slow: cfg.macdLong?.slow ?? 200,
              signal: cfg.macdLong?.signal ?? 50,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "bbTrend") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "BB Trend",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            bbTrend: {
              enabled: true,
              conds: [h.cond as BbTrendCond],
              bbPeriod: cfg.bbTrend?.bbPeriod ?? 20,
              bbMult: cfg.bbTrend?.bbMult ?? 2,
              emaPeriod: cfg.bbTrend?.emaPeriod ?? 200,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "hamBb") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "HAM BB",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            hamBb: {
              enabled: true,
              conds: [h.cond as HamBbCond],
              hamLen: cfg.hamBb?.hamLen ?? 21,
              hamLenSlow: cfg.hamBb?.hamLenSlow ?? 34,
              rawLen: cfg.hamBb?.rawLen ?? 10,
              rawLenSlow: cfg.hamBb?.rawLenSlow ?? 21,
              momSpan: cfg.hamBb?.momSpan ?? 10,
              normLen: cfg.hamBb?.normLen ?? 80,
              jLen: cfg.hamBb?.jLen ?? 20,
              jPhase: cfg.hamBb?.jPhase ?? 0,
              postSmooth: cfg.hamBb?.postSmooth ?? 5,
              bbPeriod: cfg.hamBb?.bbPeriod ?? 20,
              bbMult: cfg.hamBb?.bbMult ?? 2,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "hamBbPrice") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "HAM BB Mum",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            hamBbPrice: {
              enabled: true,
              conds: [h.cond as HamBbPriceCond],
              hamLen: cfg.hamBbPrice?.hamLen ?? 21,
              hamLenSlow: cfg.hamBbPrice?.hamLenSlow ?? 34,
              rawLen: cfg.hamBbPrice?.rawLen ?? 10,
              rawLenSlow: cfg.hamBbPrice?.rawLenSlow ?? 21,
              momSpan: cfg.hamBbPrice?.momSpan ?? 10,
              normLen: cfg.hamBbPrice?.normLen ?? 80,
              jLen: cfg.hamBbPrice?.jLen ?? 20,
              jPhase: cfg.hamBbPrice?.jPhase ?? 0,
              postSmooth: cfg.hamBbPrice?.postSmooth ?? 5,
              bbPeriod: cfg.hamBbPrice?.bbPeriod ?? 20,
              bbMult: cfg.hamBbPrice?.bbMult ?? 2,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (scanKey) {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: h.kind === "ham" ? "HAM" : "Diag",
          scanKey,
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
        });
      } else {
        scanCandidates.push(h);
        const arr = byEx.get(h.exchange) ?? [];
        if (!arr.includes(h.symbol)) arr.push(h.symbol);
        byEx.set(h.exchange, arr);
      }
    }

    for (const [ex, syms] of byEx) {
      try {
        const res = await fetch(
          `/api/ticker?exchange=${ex}&symbols=${syms.join(",")}`
        );
        const json = await res.json();
        const by = new Map<string, number>();
        for (const q of json.quotes ?? []) {
          if (q?.symbol && Number.isFinite(q.last))
            by.set(q.symbol, Number(q.last));
        }
        for (const sym of syms) {
          const last = by.get(sym);
          if (last == null) continue;
          const hit = scanCandidates.find((h) => h.symbol === sym);
          items.push({
            symbol: sym,
            exchange: ex,
            condition: "cross_above",
            price: Number((last * 1.03).toFixed(4)),
            note: hit?.note ? `${hit.note} +%3` : "liste tarama +%3",
            lastPrice: last,
            kind: "price",
            group: "Liste",
            repeat: "once",
            expiresAt: Date.now() + 24 * 3600_000,
          });
        }
      } catch {
        /* skip */
      }
    }

    const n = addAlertsBulk(items);
    setStatus(`${n} alarm eklendi`);
  }, [hits, buildConfig, addAlertsBulk, tf, hullTf]);

  const enabledIndicatorSummary = useMemo(() => {
    const names: string[] = [];
    if (hamOn) names.push("HAM");
    if (hamBbOn) names.push("HAM BB");
    if (hamBbPriceOn) names.push("HAM BB Mum");
    if (diagOn) names.push("Diag");
    if (macdOn) names.push("MACD");
    if (stochOn) names.push("Stoch");
    if (diOn) names.push("DI");
    if (hullOn) names.push("Hull");
    if (hamAoOn) names.push("HamAo");
    if (goldOn) names.push("Gold");
    if (gold2On) names.push("Gold2");
    if (macdLongOn) names.push("MACD Uzun");
    if (bbTrendOn) names.push("BB Trend");
    if (extraIds.length) names.push("Özel");
    if (pineIds.length) names.push("Pine");
    return names.length ? names.join(" · ") : "—";
  }, [hamOn, hamBbOn, hamBbPriceOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, extraIds.length, pineIds.length]);

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <div className="flex flex-col gap-2 shrink-0">
        <div className="font-medium">Liste Tarama</div>
      <p className="text-2xs text-desk-muted">
        Evren: kripto listesi, BIST listesi veya sektör. Şartlar aynı.
      </p>

      <div className="flex flex-wrap gap-1">
        {([
          ["crypto", "Kripto"],
          ["bist", "BIST"],
          ["sector", "Sektör"],
          ["active", "Aktif"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={clsx("btn text-2xs px-1.5", uniSrc === id && "btn-accent")}
            onClick={() => {
              setUniSrc(id);
              if (id === "crypto") setUniId("binance-perp-usdt");
              else if (id === "bist") setUniId("bist-all");
              else if (id === "sector") setUniId("bist-xbank");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {uniSrc !== "active" && (
        <label className="text-2xs text-desk-muted">
          {uniSrc === "sector" ? "Sektör" : "Liste"}
          <select
            className="input mt-0.5"
            value={uniOpts.some((o) => o.id === uniId) ? uniId : uniOpts[0]?.id ?? ""}
            onChange={(e) => setUniId(e.target.value)}
          >
            {uniOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.symbols.length})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="text-2xs text-desk-muted">
        {universe.name} · {universe.symbols.length} sembol
      </div>

      <div className="flex flex-wrap gap-1 items-end">
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          TF
          <select
            className="input text-2xs py-0.5"
            value={tf}
            onChange={(e) => setTf(e.target.value as Timeframe)}
          >
            {TFS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <NumInput label="Max bar" value={maxBars} onChange={setMaxBars} />
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          Eşleşme
          <select
            className="input text-2xs py-0.5"
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value as "any" | "all")}
          >
            <option value="any">Herhangi</option>
            <option value="all">Hepsi</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 border border-desk-border/40 rounded px-2 py-1 bg-desk-elevated/30">
        <button
          type="button"
          className="text-left text-xs font-medium"
          aria-expanded={indicatorsOpen}
          onClick={() => setIndicatorsOpen((open) => !open)}
        >
          Göstergeler {indicatorsOpen ? "▾" : "▸"}
        </button>
        {!indicatorsOpen && (
          <span className="text-2xs text-desk-muted truncate">
            {enabledIndicatorSummary}
          </span>
        )}
      </div>

      {indicatorsOpen && (
        <div className="space-y-2">
      <SectionCard
        title="HAM"
        enabled={hamOn}
        onToggle={() => {
          if (!hamOn) {
            bumpMatchModeOnSecondKind(false, [
              diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setHamOn(true);
          } else {
            setHamOn(false);
          }
        }}
        open={openCard === "ham"}
        onOpen={() => setOpenCard((c) => (c === "ham" ? null : "ham"))}
      >
        <div className="flex flex-wrap gap-1">
          {HAM_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hamOn) {
                  bumpMatchModeOnSecondKind(false, [
              diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setHamOn(true);
                  setHamConds((a) => ensureCond(a, c.id));
                } else {
                  setHamConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="Osc hızlı" value={hamLen} onChange={setHamLen} />
          <NumInput label="Osc yavaş" value={hamLenSlow} onChange={setHamLenSlow} />
          <NumInput label="Raw hızlı" value={rawLen} onChange={setRawLen} />
          <NumInput label="Raw yavaş" value={rawLenSlow} onChange={setRawLenSlow} />
          <NumInput label="momSpan" value={momSpan} onChange={setMomSpan} />
          <NumInput label="normLen" value={normLen} onChange={setNormLen} />
          <NumInput label="jLen" value={jLen} onChange={setJLen} />
          <NumInput label="jPhase" value={jPhase} onChange={setJPhase} />
          <NumInput label="postSm" value={postSmooth} onChange={setPostSmooth} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          <ColorInput label="Osc H" value={colorOsc} onChange={setColorOsc} />
          <ColorInput label="Osc Y" value={colorSlow} onChange={setColorSlow} />
          <ColorInput label="Raw H" value={colorRaw} onChange={setColorRaw} />
          <ColorInput label="Raw Y" value={colorRawSlow} onChange={setColorRawSlow} />
          <ColorInput label="Hist+" value={colorHistUp} onChange={setColorHistUp} />
          <ColorInput label="Hist−" value={colorHistDn} onChange={setColorHistDn} />
        </div>
      </SectionCard>

      <SectionCard
        title="HAM BB"
        enabled={hamBbOn}
        onToggle={() => {
          if (!hamBbOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbPriceOn]);
            enableHamBb();
          } else {
            setHamBbOn(false);
          }
        }}
        open={openCard === "hamBb"}
        onOpen={() => setOpenCard((c) => (c === "hamBb" ? null : "hamBb"))}
      >
        <p className="text-2xs text-desk-muted">
          Alt pane: HAM osilatörü + BB (HAM×alt↑ varsayılan) · ≥
          {HAM_BB_MIN_BARS} mum · fetch {HAM_BB_FETCH_LIMIT}+
        </p>
        <div className="flex flex-wrap gap-1">
          {HAM_BB_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamBbConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hamBbOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbPriceOn]);
                  setHamBbOn(true);
                  setMatchMode("any");
                  setHamBbConds((a) => ensureCond(a, c.id));
                } else {
                  setHamBbConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="BB period" value={hamBbBbPeriod} onChange={setHamBbBbPeriod} />
          <NumInput label="BB mult" value={hamBbBbMult} onChange={setHamBbBbMult} step={0.1} />
        </div>
      </SectionCard>

      <SectionCard
        title="HAM BB Mum"
        enabled={hamBbPriceOn}
        onToggle={() => {
          if (!hamBbPriceOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn
            ]);
            enableHamBbPrice();
          } else {
            setHamBbPriceOn(false);
          }
        }}
        open={openCard === "hamBbPrice"}
        onOpen={() => setOpenCard((c) => (c === "hamBbPrice" ? null : "hamBbPrice"))}
      >
        <p className="text-2xs text-desk-muted">
          Ana grafik: fiyat Bollinger + HAM işaretleri · alt band↑ varsayılan · ≥
          {HAM_BB_PRICE_MIN_BARS} mum · fetch {HAM_BB_PRICE_FETCH_LIMIT}+
        </p>
        <div className="flex flex-wrap gap-1">
          {HAM_BB_PRICE_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamBbPriceConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hamBbPriceOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn
                  ]);
                  setHamBbPriceOn(true);
                  setMatchMode("any");
                  setHamBbPriceConds((a) => ensureCond(a, c.id));
                } else {
                  setHamBbPriceConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="BB period" value={hamBbPriceBbPeriod} onChange={setHamBbPriceBbPeriod} />
          <NumInput label="BB mult" value={hamBbPriceBbMult} onChange={setHamBbPriceBbMult} step={0.1} />
        </div>
      </SectionCard>

      <SectionCard
        title="Diag"
        enabled={diagOn}
        onToggle={() => {
          if (!diagOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setDiagOn(true);
          } else {
            setDiagOn(false);
          }
        }}
        open={openCard === "diag"}
        onOpen={() => setOpenCard((c) => (c === "diag" ? null : "diag"))}
      >
        <div className="flex flex-wrap gap-1">
          {DIAG_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={diagConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!diagOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setDiagOn(true);
                  setDiagConds((a) => ensureCond(a, c.id));
                } else {
                  setDiagConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="pivot" value={pivotWindow} onChange={setPivotWindow} />
          <NumInput label="history" value={historyBars} onChange={setHistoryBars} />
          <NumInput label="left" value={left} onChange={setLeft} />
          <NumInput label="right" value={right} onChange={setRight} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ColorInput label="Destek" value={colorSup} onChange={setColorSup} />
          <ColorInput label="Direnç" value={colorRes} onChange={setColorRes} />
        </div>
      </SectionCard>

      <SectionCard
        title="MACD"
        enabled={macdOn}
        onToggle={() => {
          if (!macdOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setMacdOn(true);
          } else {
            setMacdOn(false);
          }
        }}
        open={openCard === "macd"}
        onOpen={() => setOpenCard((c) => (c === "macd" ? null : "macd"))}
      >
        <div className="flex flex-wrap gap-1">
          {MACD_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={macdConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!macdOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setMacdOn(true);
                  setMacdConds((a) => ensureCond(a, c.id));
                } else {
                  setMacdConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="fast" value={macdFast} onChange={setMacdFast} />
          <NumInput label="slow" value={macdSlow} onChange={setMacdSlow} />
          <NumInput label="signal" value={macdSignal} onChange={setMacdSignal} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <ColorInput label="MACD" value={colorMacd} onChange={setColorMacd} />
          <ColorInput label="Signal" value={colorSignal} onChange={setColorSignal} />
          <ColorInput label="Hist" value={colorHist} onChange={setColorHist} />
        </div>
      </SectionCard>

      <SectionCard
        title="Stoch"
        enabled={stochOn}
        onToggle={() => {
          if (!stochOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setStochOn(true);
          } else {
            setStochOn(false);
          }
        }}
        open={openCard === "stoch"}
        onOpen={() => setOpenCard((c) => (c === "stoch" ? null : "stoch"))}
      >
        <div className="flex flex-wrap gap-1">
          {STOCH_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={stochConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!stochOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setStochOn(true);
                  setStochConds((a) => ensureCond(a, c.id));
                } else {
                  setStochConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          <NumInput label="%K" value={kPeriod} onChange={setKPeriod} />
          <NumInput label="%D" value={dPeriod} onChange={setDPeriod} />
          <NumInput label="OS" value={stochOs} onChange={setStochOs} />
          <NumInput label="OB" value={stochOb} onChange={setStochOb} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ColorInput label="%K" value={colorK} onChange={setColorK} />
          <ColorInput label="%D" value={colorD} onChange={setColorD} />
        </div>
      </SectionCard>

      <SectionCard
        title="DI"
        enabled={diOn}
        onToggle={() => {
          if (!diOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setDiOn(true);
          } else {
            setDiOn(false);
          }
        }}
        open={openCard === "di"}
        onOpen={() => setOpenCard((c) => (c === "di" ? null : "di"))}
      >
        <div className="flex flex-wrap gap-1">
          {DI_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={diConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!diOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setDiOn(true);
                  setDiConds((a) => ensureCond(a, c.id));
                } else {
                  setDiConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="Period" value={diPeriod} onChange={setDiPeriod} />
          <NumInput label="ADX min" value={diAdxMin} onChange={setDiAdxMin} />
        </div>
      </SectionCard>

      <SectionCard
        title="Doktor Hull"
        enabled={hullOn}
        onToggle={() => {
          if (!hullOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setHullOn(true);
          } else {
            setHullOn(false);
          }
        }}
        open={openCard === "hull"}
        onOpen={() => setOpenCard((c) => (c === "hull" ? null : "hull"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine Doktor Hull · ribbon 8/13/21/50/100/200 · tarama TF varsayılan 4h · ≥{DOKTOR_HULL_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {HULL_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hullConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hullOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hamAoOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setHullOn(true);
                  setHullConds((a) => ensureCond(a, c.id));
                } else {
                  setHullConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
            Hull type
            <select
              className="input text-2xs py-0.5"
              value={hullMode}
              onChange={(e) =>
                setHullMode(e.target.value as "Hma" | "Ehma" | "Thma")
              }
            >
              <option value="Hma">Hma</option>
              <option value="Ehma">Ehma</option>
              <option value="Thma">Thma</option>
            </select>
          </label>
          <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
            Scanner TF
            <select
              className="input text-2xs py-0.5"
              value={hullTf}
              onChange={(e) => setHullTf(e.target.value as Timeframe)}
            >
              {TFS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <ColorInput label="H8" value={colorH8} onChange={setColorH8} />
          <ColorInput label="H13" value={colorH13} onChange={setColorH13} />
          <ColorInput label="H21" value={colorH21} onChange={setColorH21} />
          <ColorInput label="H50" value={colorH50} onChange={setColorH50} />
          <ColorInput label="H100" value={colorH100} onChange={setColorH100} />
          <ColorInput label="H200" value={colorH200} onChange={setColorH200} />
        </div>
      </SectionCard>

      <SectionCard
        title="HAM+AO JRMA Z"
        enabled={hamAoOn}
        onToggle={() => {
          if (!hamAoOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
            setHamAoOn(true);
          } else {
            setHamAoOn(false);
          }
        }}
        open={openCard === "hamAo"}
        onOpen={() => setOpenCard((c) => (c === "hamAo" ? null : "hamAo"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine HAM_AO_JRMA_Z · AO debug = aoSmooth×0↑ · RMA debug = rmaSignal×jurikCore↑
          (TV Long tersi olabilir) · PT/NT = posTrend vs negTrend · kenar-only · ≥{HAM_AO_JRMA_Z_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {HAM_AO_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamAoConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hamAoOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, goldOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setHamAoOn(true);
                  setHamAoConds((a) => ensureCond(a, c.id));
                } else {
                  setHamAoConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Gold"
        enabled={goldOn}
        onToggle={() => (goldOn ? setGoldOn(false) : enableGold())}
        open={openCard === "gold"}
        onOpen={() => setOpenCard((c) => (c === "gold" ? null : "gold"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine AOHAM_JRMA_ENGINE · gerçek Jurik · AO×Score / AO×RMA (0–100) AL/SAT ·
          PT↔NT · kenar-only · ≥{AOHAM_JRMA_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {GOLD_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={goldConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!goldOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, gold2On, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setGoldOn(true);
                  setGold2On(false);
                  setMatchMode("any");
                  setGoldConds((a) => ensureCond(a, c.id));
                } else {
                  setGoldConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Gold2"
        enabled={gold2On}
        onToggle={() => (gold2On ? setGold2On(false) : enableGold2())}
        open={openCard === "gold2"}
        onOpen={() => setOpenCard((c) => (c === "gold2" ? null : "gold2"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine GOLD / KEKO · Raw/Core/Disp × RMA AL/SAT · kırılım · şarj · kutup ·
          kenar-only · ≥{GOLD_KEKO_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {GOLD2_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={gold2Conds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!gold2On) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, macdLongOn, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setGold2On(true);
                  setGoldOn(false);
                  setMatchMode("any");
                  setGold2Conds((a) => ensureCond(a, c.id));
                } else {
                  setGold2Conds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="MACD Uzun"
        enabled={macdLongOn}
        onToggle={() => {
          if (!macdLongOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, bbTrendOn, hamBbOn, hamBbPriceOn]);
            enableMacdLong();
          } else {
            setMacdLongOn(false);
          }
        }}
        open={openCard === "macdLong"}
        onOpen={() => setOpenCard((c) => (c === "macdLong" ? null : "macdLong"))}
      >
        <p className="text-2xs text-desk-muted">
          MACD çizgisi × sinyal kenarı · varsayılan 100/200/50 · ≥{MACD_LONG_MIN_BARS}{" "}
          mum · fetch {MACD_LONG_FETCH_LIMIT}+
        </p>
        <div className="flex flex-wrap gap-1">
          {MACD_LONG_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={macdLongConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!macdLongOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, bbTrendOn, hamBbOn, hamBbPriceOn]);
                  setMacdLongOn(true);
                  setMatchMode("any");
                  setMacdLongConds((a) => ensureCond(a, c.id));
                } else {
                  setMacdLongConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="fast" value={macdLongFast} onChange={setMacdLongFast} />
          <NumInput label="slow" value={macdLongSlow} onChange={setMacdLongSlow} />
          <NumInput label="signal" value={macdLongSignal} onChange={setMacdLongSignal} />
        </div>
      </SectionCard>

      <SectionCard
        title="BB Trend"
        enabled={bbTrendOn}
        onToggle={() => {
          if (!bbTrendOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, hamBbOn, hamBbPriceOn]);
            enableBbTrend();
          } else {
            setBbTrendOn(false);
          }
        }}
        open={openCard === "bbTrend"}
        onOpen={() => setOpenCard((c) => (c === "bbTrend" ? null : "bbTrend"))}
      >
        <p className="text-2xs text-desk-muted">
          BB orta × EMA kenarı · varsayılan BB 20×2 · EMA 200 · ≥{BB_TREND_MIN_BARS}{" "}
          mum · fetch {BB_TREND_FETCH_LIMIT}+
        </p>
        <div className="flex flex-wrap gap-1">
          {BB_TREND_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={bbTrendConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!bbTrendOn) {
                  bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, macdLongOn, hamBbOn, hamBbPriceOn]);
                  setBbTrendOn(true);
                  setMatchMode("any");
                  setBbTrendConds((a) => ensureCond(a, c.id));
                } else {
                  setBbTrendConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="BB period" value={bbTrendBbPeriod} onChange={setBbTrendBbPeriod} />
          <NumInput label="BB mult" value={bbTrendBbMult} onChange={setBbTrendBbMult} step={0.1} />
          <NumInput label="EMA" value={bbTrendEmaPeriod} onChange={setBbTrendEmaPeriod} />
        </div>
      </SectionCard>

      <div className="border border-desk-border/40 rounded">
        <button
          type="button"
          className="w-full text-left px-2 py-1 text-xs bg-desk-elevated/50"
          onClick={() => setExtraOpen((v) => !v)}
        >
          Özel şart {extraOpen ? "▾" : "▸"}
        </button>
        {extraOpen && (
          <div className="p-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {EXTRA_CHIPS.map((c) => (
                <Chip
                  key={c.id}
                  active={extraIds.includes(c.id)}
                  label={c.label}
                  onClick={() => setExtraIds((a) => toggleIn(a, c.id))}
                />
              ))}
            </div>
            <div className="text-2xs font-medium">Pine v6 ekle</div>
            <input
              className="input text-2xs"
              value={pineName}
              onChange={(e) => setPineName(e.target.value)}
              placeholder="script adı"
            />
            <textarea
              className="input text-2xs font-mono min-h-[120px] w-full"
              value={pineDraft}
              onChange={(e) => setPineDraft(e.target.value)}
              placeholder={'//@version=6\nindicator("...")\nplot(close)'}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["zero_up", "0↑"],
                  ["zero_dn", "0↓"],
                  ["cross_up", "H×Y↑"],
                  ["cross_dn", "H×Y↓"],
                  ["up", "↑"],
                  ["dn", "↓"],
                ] as [PineCond, string][]
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={pineConds.includes(id)}
                  label={label}
                  onClick={() => setPineConds((a) => toggleIn(a, id))}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-accent text-2xs"
              onClick={() => {
                const raw = pineDraft.trim();
                if (!raw) {
                  setPineStatus("Pine yapıştır");
                  return;
                }
                const conv = convertAny(raw, "td");
                const sc: CustomScript = {
                  id: `pine_${Math.random().toString(36).slice(2, 9)}`,
                  name: pineName.trim() || "Liste Pine",
                  code: conv.code,
                  language: "td",
                  originalCode: raw,
                  originalLanguage: "pine",
                  warnings: conv.warnings,
                  updatedAt: Date.now(),
                };
                upsertScript(sc);
                setPineIds((a) => (a.includes(sc.id) ? a : [...a, sc.id]));
                applyScriptToActive(sc.id);
                void fetch("/api/store", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    scripts: useDeskStore.getState().scripts,
                  }),
                }).catch(() => {});
                setPineStatus(
                  conv.warnings.length
                    ? `eklendi · ${conv.warnings[0]}`
                    : "eklendi · TD’ye çevrildi · grafikte"
                );
              }}
            >
              Ekle ve tara
            </button>
            {scripts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {scripts.map((s) => (
                  <Chip
                    key={s.id}
                    active={pineIds.includes(s.id)}
                    label={s.name}
                    onClick={() => {
                      setPineIds((a) => toggleIn(a, s.id));
                      if (!pineIds.includes(s.id)) applyScriptToActive(s.id);
                    }}
                  />
                ))}
              </div>
            )}
            {pineStatus && (
              <div className="text-2xs text-desk-muted">{pineStatus}</div>
            )}
          </div>
        )}
      </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="btn-accent text-2xs"
          disabled={running}
          onClick={() => void runScan()}
        >
          {running ? "Taranıyor…" : "Listeyi tara"}
        </button>
        {running && (
          <button type="button" className="btn text-2xs" onClick={stopScan}>
            Durdur
          </button>
        )}
        <button
          type="button"
          className="btn text-2xs"
          disabled={running || !universe.symbols.length}
          onClick={armListAlerts}
        >
          Listeye alarm
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={!hits.length || running}
          onClick={() => void bulkAlerts()}
        >
          Hitlere alarm
        </button>
      </div>

      {(progress || status) && (
        <div className="text-2xs text-desk-muted">
          {progress && <span className="mr-2">{progress}</span>}
          {status}
        </div>
      )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-desk-border/40 rounded">
        {hits.length ? hits.map((h, i) => (
            <button
              key={`${h.symbol}_${h.kind}_${h.cond}_${h.barsAgo}_${i}`}
              type="button"
              className="w-full text-left px-2 py-1 text-2xs border-b border-desk-border/30 hover:bg-desk-elevated flex gap-1.5 items-center"
              onClick={() => onHitClick(h)}
            >
              <span className="font-medium shrink-0">{h.symbol}</span>
              <span
                className={clsx(
                  "shrink-0",
                  h.bias === "bull"
                    ? "text-desk-up"
                    : h.bias === "bear"
                      ? "text-desk-down"
                      : "text-desk-muted"
                )}
              >
                {h.kind.toUpperCase()}
              </span>
              <span className="text-desk-muted flex-1 truncate">{h.note}</span>
              <span className="font-mono shrink-0">−{h.barsAgo}</span>
            </button>
          )) : (
            <div className="p-2 text-2xs text-desk-muted">Henüz hit yok</div>
          )}
      </div>
    </div>
  );
}
