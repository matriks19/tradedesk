"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BuiltinIndicatorId,
  CustomScript,
  Exchange,
  IndicatorInstance,
  LayoutMode,
  PaneConfig,
  PatternSettings,
  RiskSettings,
  Timeframe,
  Watchlist,
} from "@/lib/types";
import { BUILTIN_META } from "@/lib/indicators/registry";

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function makePane(
  symbol = "BTCUSDT",
  exchange: Exchange = "binance",
  timeframe: Timeframe = "15m"
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
    | "indicators";
  watchlists: Watchlist[];
  activeWatchlistId: string;
  scripts: CustomScript[];
  risk: RiskSettings;
  showRiskLines: boolean;
  bistBannerDismissed: boolean;
  patternSettings: PatternSettings;
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
  openSymbolInActive: (symbol: string, exchange: Exchange) => void;
  addIndicator: (paneId: string, type: BuiltinIndicatorId) => void;
  removeIndicator: (paneId: string, indicatorId: string) => void;
  setScripts: (s: CustomScript[]) => void;
  upsertScript: (s: CustomScript) => void;
  applyScriptToActive: (scriptId: string) => void;
  setRisk: (r: Partial<RiskSettings>) => void;
  setShowRiskLines: (v: boolean) => void;
  setPatternSettings: (p: Partial<PatternSettings>) => void;
  setPatternFocus: (id: string | null) => void;
  hydrateFromServer: (data: {
    watchlists: Watchlist[];
    scripts: CustomScript[];
  }) => void;
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
        openSymbolInActive: (symbol, exchange) => {
          const { activePaneId, updatePane } = get();
          updatePane(activePaneId, { symbol, exchange });
        },
        addIndicator: (paneId, type) =>
          set((s) => ({
            panes: s.panes.map((p) => {
              if (p.id !== paneId) return p;
              const meta = BUILTIN_META[type];
              const inst: IndicatorInstance = {
                id: uid("ind"),
                type,
                name: meta.label,
                params: { ...meta.defaults },
                visible: true,
              };
              return { ...p, indicators: [...p.indicators, inst] };
            }),
          })),
        removeIndicator: (paneId, indicatorId) =>
          set((s) => ({
            panes: s.panes.map((p) =>
              p.id !== paneId
                ? p
                : {
                    ...p,
                    indicators: p.indicators.filter((i) => i.id !== indicatorId),
                  }
            ),
          })),
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
        patternSettings: {
          ...s.patternSettings,
          focusId: null,
        },
      }),
    }
  )
);

export const TIMEFRAMES: Timeframe[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
];

export const LAYOUT_OPTIONS: LayoutMode[] = [1, 2, 4, 6, 9];
