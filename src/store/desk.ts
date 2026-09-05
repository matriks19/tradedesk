"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BuiltinIndicatorId,
  CustomScript,
  Exchange,
  IndicatorInstance,
  IndicatorSource,
  LayoutMode,
  PaneConfig,
  ChartTimeframe,
  PatternSettings,
  RiskSettings,
  Timeframe,
  Watchlist,
} from "@/lib/types";
import { NATIVE_TIMEFRAMES, normalizeTimeframe } from "@/lib/data/timeframes";
import type { PatternHit } from "@/lib/patterns/types";
import type { BacktestParams, BacktestResult } from "@/lib/backtest";
import { BUILTIN_META, defaultsFor, formatIndicatorLabel } from "@/lib/indicators/registry";

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function makePane(
  symbol = "BTCUSDT",
  exchange: Exchange = "binance",
  timeframe: ChartTimeframe = "15m"
): PaneConfig {
  return {
    id: uid("pane"),
    symbol,
    exchange,
    timeframe,
    indicators: [],
  };
}

function panesForMode(mode: LayoutMode, existing: PaneConfig[]): PaneConfig[] {
  const next = [...existing];
  while (next.length < mode) next.push(makePane());
  return next.slice(0, mode);
}

interface DeskState {
  layoutMode: LayoutMode;
  panes: PaneConfig[];
  activePaneId: string;
  sidebarTab:
    | "watchlist"
    | "scanner"
    | "heatmap"
    | "patterns"
    | "risk"
    | "scripts"
    | "indicators"
    | "backtest";
  lastBacktest: BacktestResult | null;
  backtestParams: Partial<BacktestParams>;
  watchlists: Watchlist[];
  activeWatchlistId: string;
  scripts: CustomScript[];
  risk: RiskSettings;
  showRiskLines: boolean;
  bistBannerDismissed: boolean;
  patternSettings: PatternSettings;
  overlayPattern: PatternHit | null;
  recentCustomTimeframes: string[];
  favoriteIndicators: BuiltinIndicatorId[];
  indicatorMenuOpen: boolean;
  setLayoutMode: (mode: LayoutMode) => void;
  setActivePane: (id: string) => void;
  updatePane: (id: string, patch: Partial<PaneConfig>) => void;
  setSidebarTab: (tab: DeskState["sidebarTab"]) => void;
  setWatchlists: (w: Watchlist[]) => void;
  setActiveWatchlist: (id: string) => void;
  addWatchlistSymbol: (
    listId: string,
    symbol: string,
    exchange: Exchange
  ) => void;
  removeWatchlistSymbol: (listId: string, symbol: string) => void;
  openSymbolInActive: (
    symbol: string,
    exchange: Exchange,
    timeframe?: ChartTimeframe
  ) => void;
  addRecentCustomTimeframe: (tf: string) => void;
  addIndicator: (
    paneId: string,
    type: BuiltinIndicatorId,
    source?: IndicatorSource,
    parentId?: string
  ) => void;
  removeIndicator: (paneId: string, indicatorId: string) => void;
  updateIndicatorParams: (
    paneId: string,
    indId: string,
    params: Record<string, number | string>
  ) => void;
  toggleIndicatorVisible: (paneId: string, indId: string) => void;
  setIndicatorColor: (paneId: string, indId: string, color: string) => void;
  toggleFavoriteIndicator: (type: BuiltinIndicatorId) => void;
  setIndicatorMenuOpen: (open: boolean) => void;
  setScripts: (s: CustomScript[]) => void;
  upsertScript: (s: CustomScript) => void;
  applyScriptToActive: (scriptId: string) => void;
  setRisk: (r: Partial<RiskSettings>) => void;
  setShowRiskLines: (v: boolean) => void;
  setPatternSettings: (p: Partial<PatternSettings>) => void;
  setPatternFocus: (id: string | null) => void;
  setOverlayPattern: (hit: PatternHit | null) => void;
  hydrateFromServer: (data: {
    watchlists: Watchlist[];
    scripts: CustomScript[];
  }) => void;
  setLastBacktest: (r: BacktestResult | null) => void;
  setBacktestParams: (p: Partial<BacktestParams>) => void;
}

export const useDeskStore = create<DeskState>()(
  persist(
    (set, get) => {
      const first = makePane();
      return {
        layoutMode: 1,
        panes: [first],
        activePaneId: first.id,
        sidebarTab: "watchlist",
        watchlists: [],
        activeWatchlistId: "crypto-majors",
        scripts: [],
        risk: {
          entry: 0,
          stopLoss: 0,
          takeProfit: 0,
          riskAmount: 100,
          accountSize: 10000,
          rMultiple: 2,
        },
        showRiskLines: true,
        bistBannerDismissed: false,
        patternSettings: {
          swingStrength: 2,
          twinTol: 0.015,
          boxLookback: 30,
          focusId: null,
        },
        overlayPattern: null,
        recentCustomTimeframes: [],
        favoriteIndicators: ["sma", "ema", "rsi", "macd", "bollinger"],
        indicatorMenuOpen: false,
        lastBacktest: null,
        backtestParams: {
          symbol: "BTCUSDT",
          exchange: "binance",
          timeframe: "15m",
          preset: "emaCross",
          allowShort: true,
          slAtrMult: 1.5,
          tpAtrMult: 2.5,
          positionSize: 1000,
          commissionBps: 4,
          warmup: 60,
        },
        setLayoutMode: (mode) =>
          set((s) => {
            const panes = panesForMode(mode, s.panes);
            const active =
              panes.find((p) => p.id === s.activePaneId)?.id ?? panes[0].id;
            return { layoutMode: mode, panes, activePaneId: active };
          }),
        setActivePane: (id) => set({ activePaneId: id }),
        updatePane: (id, patch) =>
          set((s) => ({
            panes: s.panes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          })),
        setSidebarTab: (tab) => set({ sidebarTab: tab }),
        setWatchlists: (w) => set({ watchlists: w }),
        setActiveWatchlist: (id) => set({ activeWatchlistId: id }),
        addWatchlistSymbol: (listId, symbol, exchange) =>
          set((s) => ({
            watchlists: s.watchlists.map((w) =>
              w.id === listId
                ? {
                    ...w,
                    symbols: w.symbols.some((x) => x.symbol === symbol)
                      ? w.symbols
                      : [...w.symbols, { symbol, exchange }],
                  }
                : w
            ),
          })),
        removeWatchlistSymbol: (listId, symbol) =>
          set((s) => ({
            watchlists: s.watchlists.map((w) =>
              w.id === listId
                ? {
                    ...w,
                    symbols: w.symbols.filter((x) => x.symbol !== symbol),
                  }
                : w
            ),
          })),
        openSymbolInActive: (symbol, exchange, timeframe) => {
          const { activePaneId, updatePane, setActivePane } = get();
          // Keep focus on the pane we are opening into so overlay draws (active-only).
          setActivePane(activePaneId);
          updatePane(activePaneId, {
            symbol,
            exchange,
            ...(timeframe ? { timeframe } : {}),
          });
        },
        addRecentCustomTimeframe: (tf) => {
          const n = normalizeTimeframe(tf);
          if (!n) return;
          if ((NATIVE_TIMEFRAMES as readonly string[]).includes(n)) return;
          set((s) => {
            const next = [n, ...s.recentCustomTimeframes.filter((x) => x !== n)].slice(0, 8);
            return { recentCustomTimeframes: next };
          });
        },
        addIndicator: (paneId, type, source, parentId) =>
          set((s) => ({
            panes: s.panes.map((p) => {
              if (p.id !== paneId) return p;
              const meta = BUILTIN_META[type];
              if (!meta) return p;
              // Nesting depth limit
              let depth = 0;
              if (source?.type === "indicator") {
                let cur = p.indicators.find((i) => i.id === source.indicatorId);
                while (cur?.source?.type === "indicator" && depth < 5) {
                  depth++;
                  const pid = cur.source.indicatorId;
                  cur = p.indicators.find((i) => i.id === pid);
                }
                if (depth >= 2) return p; // max nested depth 2 (parent + child, or child of child blocked)
              }
              const params = defaultsFor(type);
              const inst: IndicatorInstance = {
                id: uid("ind"),
                type,
                name: meta.label,
                params,
                visible: true,
                source: source ?? { type: "price", field: "close" },
                parentId,
              };
              // Pretty name for nested
              if (source?.type === "indicator") {
                inst.name = formatIndicatorLabel(inst, [...p.indicators, inst]);
              }
              return { ...p, indicators: [...p.indicators, inst] };
            }),
          })),
        removeIndicator: (paneId, indicatorId) =>
          set((s) => ({
            panes: s.panes.map((p) => {
              if (p.id !== paneId) return p;
              // also remove children that source from this indicator
              const removeIds = new Set<string>([indicatorId]);
              let changed = true;
              while (changed) {
                changed = false;
                for (const ind of p.indicators) {
                  if (
                    ind.source?.type === "indicator" &&
                    removeIds.has(ind.source.indicatorId) &&
                    !removeIds.has(ind.id)
                  ) {
                    removeIds.add(ind.id);
                    changed = true;
                  }
                }
              }
              return {
                ...p,
                indicators: p.indicators.filter((i) => !removeIds.has(i.id)),
              };
            }),
          })),
        updateIndicatorParams: (paneId, indId, params) =>
          set((s) => ({
            panes: s.panes.map((p) => {
              if (p.id !== paneId) return p;
              return {
                ...p,
                indicators: p.indicators.map((ind) => {
                  if (ind.id !== indId) return ind;
                  const next = {
                    ...ind,
                    params: { ...ind.params, ...params },
                  };
                  // sync price source field if params.source changed
                  if (typeof params.source === "string" && (!ind.source || ind.source.type === "price")) {
                    next.source = {
                      type: "price",
                      field: params.source as import("@/lib/types").PriceField,
                    };
                  }
                  next.name = formatIndicatorLabel(next, p.indicators);
                  return next;
                }),
              };
            }),
          })),
        toggleIndicatorVisible: (paneId, indId) =>
          set((s) => ({
            panes: s.panes.map((p) =>
              p.id !== paneId
                ? p
                : {
                    ...p,
                    indicators: p.indicators.map((i) =>
                      i.id === indId ? { ...i, visible: !i.visible } : i
                    ),
                  }
            ),
          })),
        setIndicatorColor: (paneId, indId, color) =>
          set((s) => ({
            panes: s.panes.map((p) =>
              p.id !== paneId
                ? p
                : {
                    ...p,
                    indicators: p.indicators.map((i) =>
                      i.id === indId ? { ...i, color } : i
                    ),
                  }
            ),
          })),
        toggleFavoriteIndicator: (type) =>
          set((s) => ({
            favoriteIndicators: s.favoriteIndicators.includes(type)
              ? s.favoriteIndicators.filter((x) => x !== type)
              : [...s.favoriteIndicators, type],
          })),
        setIndicatorMenuOpen: (open) => set({ indicatorMenuOpen: open }),
        setScripts: (scripts) => set({ scripts }),
        upsertScript: (script) =>
          set((s) => {
            const idx = s.scripts.findIndex((x) => x.id === script.id);
            const scripts =
              idx >= 0
                ? s.scripts.map((x, i) => (i === idx ? script : x))
                : [...s.scripts, script];
            return { scripts };
          }),
        applyScriptToActive: (scriptId) => {
          const { activePaneId, scripts } = get();
          const sc = scripts.find((x) => x.id === scriptId);
          if (!sc) return;
          set((s) => ({
            panes: s.panes.map((p) => {
              if (p.id !== activePaneId) return p;
              const inst: IndicatorInstance = {
                id: uid("ind"),
                type: "custom",
                name: sc.name,
                params: {},
                visible: true,
                scriptId: sc.id,
              };
              return { ...p, indicators: [...p.indicators, inst] };
            }),
          }));
        },
        setRisk: (r) => set((s) => ({ risk: { ...s.risk, ...r } })),
        setShowRiskLines: (v) => set({ showRiskLines: v }),
        setPatternSettings: (p) =>
          set((s) => ({ patternSettings: { ...s.patternSettings, ...p } })),
        setPatternFocus: (id) =>
          set((s) => ({
            patternSettings: { ...s.patternSettings, focusId: id },
          })),
        setOverlayPattern: (hit) => set({ overlayPattern: hit }),
        setLastBacktest: (r) => set({ lastBacktest: r }),
        setBacktestParams: (p) =>
          set((s) => ({ backtestParams: { ...s.backtestParams, ...p } })),
        hydrateFromServer: ({ watchlists, scripts }) =>
          set((s) => ({
            watchlists: watchlists.length ? watchlists : s.watchlists,
            scripts: scripts.length
              ? scripts.map((sc) => ({
                  ...sc,
                  language: sc.language ?? "td",
                }))
              : s.scripts,
            activeWatchlistId:
              watchlists[0]?.id ?? s.activeWatchlistId ?? "crypto-majors",
          })),
      };
    },
    {
      name: "tradedesk-v1",
      partialize: (s) => ({
        layoutMode: s.layoutMode,
        panes: s.panes,
        activePaneId: s.activePaneId,
        risk: s.risk,
        showRiskLines: s.showRiskLines,
        activeWatchlistId: s.activeWatchlistId,
        sidebarTab: s.sidebarTab,
        favoriteIndicators: s.favoriteIndicators,
        patternSettings: {
          ...s.patternSettings,
          focusId: null,
        },
        recentCustomTimeframes: s.recentCustomTimeframes,
        backtestParams: s.backtestParams,
        lastBacktest: s.lastBacktest,
      }),
    }
  )
);

export const TIMEFRAMES: Timeframe[] = [...NATIVE_TIMEFRAMES];

export const LAYOUT_OPTIONS: LayoutMode[] = [1, 2, 4, 6, 9];
