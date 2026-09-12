"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BuiltinIndicatorId,
  BotSettings,
  ChartDrawing,
  CustomScript,
  DrawTool,
  Exchange,
  IndicatorInstance,
  IndicatorSource,
  LayoutMode,
  PaneConfig,
  ChartTimeframe,
  PatternSettings,
  PriceAlert,
  RiskSettings,
  Timeframe,
  Watchlist,
} from "@/lib/types";
import { NATIVE_TIMEFRAMES, normalizeTimeframe } from "@/lib/data/timeframes";
import type { PatternHit } from "@/lib/patterns/types";
import type { BacktestParams, BacktestResult } from "@/lib/backtest"
import { normalizeBacktestResult } from "@/lib/backtest";
import { BUILTIN_META, defaultsFor, formatIndicatorLabel } from "@/lib/indicators/registry";
import { strategyById } from "@/lib/strategies";
import { sectorWatchlistMeta } from "@/lib/data/bistSectors";
import { binancePerpWatchlistMeta, mergeBinanceWatchlists } from "@/lib/data/binanceLists";

const WATCHLIST_CAP = 2000;

function parseWatchlistText(
  text: string,
  defaultExchange: Exchange
): { symbol: string; exchange: Exchange }[] {
  const raw = text
    .split(/[\n,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const parsed: { symbol: string; exchange: Exchange }[] = [];
  for (const tok of raw) {
    let exchange: Exchange = defaultExchange;
    let symbol = tok;
    if (tok.includes(":")) {
      const [ex, sym] = tok.split(":");
      if (ex === "BINANCE" || ex === "BIST") {
        exchange = ex.toLowerCase() as Exchange;
        symbol = (sym || "").toUpperCase();
      }
    }
    if (!symbol) continue;
    if (/\.P$/i.test(symbol) || /USDT$/i.test(symbol)) {
      exchange = "binance";
    }
    if (!parsed.some((p) => p.symbol === symbol && p.exchange === exchange)) {
      parsed.push({ symbol, exchange });
    }
  }
  return parsed;
}

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
    | "list"
    | "scanner"
    | "heatmap"
    | "patterns"
    | "risk"
    | "pairs"
    | "alerts"
    | "scripts"
    | "indicators"
    | "backtest"
    | "strategies";
  activeStrategyId: string | null;
  pendingScannerPresets: string[] | null;
  pendingScannerChips: string[] | null;
  lastBacktest: BacktestResult | null;
  backtestParams: Partial<BacktestParams>;
  watchlists: Watchlist[];
  activeWatchlistId: string;
  alerts: PriceAlert[];
  botSettings: BotSettings;
  drawings: ChartDrawing[];
  activeDrawTool: DrawTool;
  pendingDiagPaneId: string | null;
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
  clearPaneIndicators: (paneId: string) => void;
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
  applyStrategyPack: (strategyId: string) => void;
  clearPendingScanner: () => void;
  setBacktestParams: (p: Partial<BacktestParams>) => void;
  addAlert: (a: Omit<PriceAlert, "id" | "createdAt" | "active"> & { active?: boolean }) => void;
  removeAlert: (id: string) => void;
  updateAlert: (id: string, patch: Partial<PriceAlert>) => void;
  setBotSettings: (p: Partial<BotSettings>) => void;
  addDrawing: (d: Omit<ChartDrawing, "id"> & { id?: string }) => void;
  removeDrawing: (id: string) => void;
  clearAutoFibs: (paneId: string) => void;
  placeAutoFib: (
    paneId: string,
    points: { time: number; price: number }[],
    label?: string
  ) => void;
  requestPlaceDiag: (paneId: string | null) => void;
  clearAutoDiag: (paneId: string) => void;
  placeAutoDiag: (
    paneId: string,
    segs: {
      t0: number;
      p0: number;
      t1: number;
      p1: number;
      descending?: boolean;
      kind: "sup" | "res";
    }[]
  ) => void;
  clearPaneDrawings: (paneId: string) => void;
  setActiveDrawTool: (t: DrawTool) => void;
  createWatchlist: (name: string) => string;
  ensureWatchlist: (id: string, name: string) => string;
  importWatchlistSymbols: (
    listId: string,
    text: string,
    defaultExchange: Exchange
  ) => number;
  replaceWatchlistSymbols: (
    listId: string,
    text: string,
    defaultExchange: Exchange
  ) => number;
  seedBinanceWatchlists: () => { created: number; updated: number };
  deleteWatchlist: (id: string) => void;
  addAlertsBulk: (
    items: Array<
      Omit<PriceAlert, "id" | "createdAt" | "active"> & { active?: boolean }
    >
  ) => number;
  seedSectorWatchlists: () => { created: number; skipped: number };
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
        activeStrategyId: null,
        pendingScannerPresets: null,
        pendingScannerChips: null,
        watchlists: [],
        activeWatchlistId: "crypto-majors",
        alerts: [],
        botSettings: { webhookUrl: "", enabled: false, secret: "", telegramChatId: "" },
        drawings: [],
        activeDrawTool: "cursor",
        pendingDiagPaneId: null,
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
        clearPaneIndicators: (paneId) =>
          set((s) => ({
            panes: s.panes.map((p) =>
              p.id === paneId ? { ...p, indicators: [] } : p
            ),
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
        setLastBacktest: (r) =>
          set({ lastBacktest: r ? normalizeBacktestResult(r) : null }),

        applyStrategyPack: (strategyId) => {
          const pack = strategyById(strategyId);
          if (!pack) return;
          set((s) => {
            const paneId = s.activePaneId;
            const indicators: IndicatorInstance[] = [];
            for (const spec of pack.indicators) {
              const meta = BUILTIN_META[spec.type];
              if (!meta) continue; // skip unknown ids — validatePacks catches these
              const base = defaultsFor(spec.type);
              indicators.push({
                id: uid("ind"),
                type: spec.type,
                name: meta.label,
                params: { ...base, ...(spec.params ?? {}) },
                visible: true,
                color: spec.color,
                source: { type: "price", field: "close" },
              });
            }
            // Reset preset knobs so prior pack extras (e.g. rsiPeriod:2) do not leak
            const nextBacktest = {
              symbol: s.backtestParams.symbol,
              exchange: s.backtestParams.exchange,
              timeframe: pack.timeframe as never,
              preset: (pack.backtestPreset ??
                s.backtestParams.preset) as never,
              allowShort: pack.allowShort,
              slAtrMult: 1.5,
              tpAtrMult: 2.5,
              positionSize: s.backtestParams.positionSize,
              commissionBps: s.backtestParams.commissionBps,
              warmup: 60,
              useAtrStops: true,
              useSignalExits: true,
              strategyCode: s.backtestParams.strategyCode,
              ...(pack.backtestExtras ?? {}),
            };
            return {
              activeStrategyId: pack.id,
              showRiskLines: true,
              risk: {
                ...s.risk,
                rMultiple: pack.risk.rMultiple,
              },
              pendingScannerPresets: pack.scannerPresets ?? null,
              pendingScannerChips: pack.scannerChips ?? null,
              backtestParams: nextBacktest,
              panes: s.panes.map((p) => {
                if (p.id !== paneId) return p;
                return {
                  ...p,
                  timeframe: pack.timeframe,
                  indicators: pack.replaceIndicators === false
                    ? [...p.indicators, ...indicators]
                    : indicators,
                };
              }),
            };
          });
        },
        clearPendingScanner: () =>
          set({ pendingScannerPresets: null, pendingScannerChips: null }),
        setBacktestParams: (p) =>
          set((s) => ({ backtestParams: { ...s.backtestParams, ...p } })),
        addAlert: (a) =>
          set((s) => ({
            alerts: [
              {
                ...a,
                id: uid("alert"),
                createdAt: Date.now(),
                active: a.active ?? true,
              },
              ...s.alerts,
            ],
          })),
        addAlertsBulk: (items) => {
          if (!items.length) return 0;
          const now = Date.now();
          const mapped = items.map((a, i) => ({
            ...a,
            id: uid("alert"),
            createdAt: now + i,
            active: a.active ?? true,
          }));
          set((s) => ({ alerts: [...mapped, ...s.alerts] }));
          return mapped.length;
        },
        removeAlert: (id) =>
          set((s) => ({ alerts: s.alerts.filter((x) => x.id !== id) })),
        updateAlert: (id, patch) =>
          set((s) => ({
            alerts: s.alerts.map((x) => (x.id === id ? { ...x, ...patch } : x)),
          })),
        setBotSettings: (p) =>
          set((s) => ({ botSettings: { ...s.botSettings, ...p } })),
        addDrawing: (d) =>
          set((s) => {
            const origin = d.origin ?? "user";
            let drawings = s.drawings;
            // New fib replaces prior auto fibs on same pane (user fibs kept)
            if (d.tool === "fib") {
              drawings = drawings.filter(
                (x) =>
                  !(
                    x.paneId === d.paneId &&
                    x.tool === "fib" &&
                    (x.origin ?? "user") === "auto"
                  )
              );
            }
            return {
              drawings: [
                ...drawings,
                {
                  id: d.id ?? uid("draw"),
                  paneId: d.paneId,
                  tool: d.tool,
                  points: d.points,
                  color: d.color,
                  label: d.label,
                  origin,
                },
              ],
            };
          }),
        removeDrawing: (id) =>
          set((s) => ({ drawings: s.drawings.filter((x) => x.id !== id) })),
        clearAutoFibs: (paneId) =>
          set((s) => ({
            drawings: s.drawings.filter(
              (x) =>
                !(
                  x.paneId === paneId &&
                  x.tool === "fib" &&
                  (x.origin ?? "user") === "auto"
                )
            ),
          })),
        placeAutoFib: (paneId, points, label) => {
          if (points.length < 2) return;
          get().clearAutoFibs(paneId);
          get().addDrawing({
            paneId,
            tool: "fib",
            points: points.slice(0, 2),
            color: "#f5a623",
            label: label ?? "Auto Fib",
            origin: "auto",
          });
        },
        requestPlaceDiag: (paneId) => set({ pendingDiagPaneId: paneId }),
        clearAutoDiag: (paneId) =>
          set((s) => ({
            drawings: s.drawings.filter(
              (x) =>
                !(
                  x.paneId === paneId &&
                  x.tool === "trend" &&
                  (x.origin ?? "user") === "auto" &&
                  (x.label ?? "").startsWith("Diag")
                )
            ),
          })),
        placeAutoDiag: (paneId, segs) => {
          get().clearAutoDiag(paneId);
          for (const seg of segs) {
            const isSup = seg.kind === "sup";
            const down = Boolean(seg.descending);
            get().addDrawing({
              paneId,
              tool: "trend",
              points: [
                { time: seg.t0, price: seg.p0 },
                { time: seg.t1, price: seg.p1 },
              ],
              color: isSup ? "#26a69a" : "#ef5350",
              label: isSup
                ? down
                  ? "Diag Destek ↓"
                  : "Diag Destek"
                : down
                  ? "Diag Direnç ↓"
                  : "Diag Direnç",
              origin: "auto",
            });
          }
        },
        clearPaneDrawings: (paneId) =>
          set((s) => ({
            drawings: s.drawings.filter((x) => x.paneId !== paneId),
          })),
        setActiveDrawTool: (t) => set({ activeDrawTool: t }),
        createWatchlist: (name) => {
          const id = uid("wl");
          const trimmed = name.trim() || "Liste";
          set((s) => ({
            watchlists: [...s.watchlists, { id, name: trimmed, symbols: [] }],
            activeWatchlistId: id,
          }));
          return id;
        },
        ensureWatchlist: (id, name) => {
          const existing = get().watchlists.find((w) => w.id === id);
          if (existing) return id;
          const trimmed = name.trim() || "Liste";
          set((s) => ({
            watchlists: [...s.watchlists, { id, name: trimmed, symbols: [] }],
          }));
          return id;
        },
        seedSectorWatchlists: () => {
          let created = 0;
          let skipped = 0;
          const metas = sectorWatchlistMeta();
          for (const m of metas) {
            const exists = get().watchlists.some((w) => w.id === m.id);
            if (exists) {
              skipped++;
              continue;
            }
            get().ensureWatchlist(m.id, m.name);
            get().importWatchlistSymbols(m.id, m.symbols.join("\n"), "bist");
            created++;
          }
          return { created, skipped };
        },
        seedBinanceWatchlists: () => {
          let created = 0;
          let updated = 0;
          for (const m of binancePerpWatchlistMeta()) {
            const exists = get().watchlists.some((w) => w.id === m.id);
            get().ensureWatchlist(m.id, m.name);
            get().replaceWatchlistSymbols(m.id, m.symbols.join("\n"), "binance");
            if (exists) updated++;
            else created++;
          }
          return { created, updated };
        },
        importWatchlistSymbols: (listId, text, defaultExchange) => {
          const parsed = parseWatchlistText(text, defaultExchange);
          if (!parsed.length) return 0;
          let added = 0;
          set((s) => ({
            watchlists: s.watchlists.map((w) => {
              if (w.id !== listId) return w;
              const existing = new Set(w.symbols.map((x) => `${x.exchange}:${x.symbol}`));
              const next = [...w.symbols];
              for (const p of parsed) {
                const key = `${p.exchange}:${p.symbol}`;
                if (existing.has(key)) continue;
                if (next.length >= WATCHLIST_CAP) break;
                existing.add(key);
                next.push(p);
                added++;
              }
              return { ...w, symbols: next };
            }),
          }));
          return added;
        },
        replaceWatchlistSymbols: (listId, text, defaultExchange) => {
          const parsed = parseWatchlistText(text, defaultExchange).slice(
            0,
            WATCHLIST_CAP
          );
          set((s) => ({
            watchlists: s.watchlists.map((w) =>
              w.id === listId ? { ...w, symbols: parsed } : w
            ),
          }));
          return parsed.length;
        },
        deleteWatchlist: (id) =>
          set((s) => {
            const watchlists = s.watchlists.filter((w) => w.id !== id);
            const activeWatchlistId =
              s.activeWatchlistId === id
                ? watchlists[0]?.id ?? ""
                : s.activeWatchlistId;
            return { watchlists, activeWatchlistId };
          }),
        hydrateFromServer: ({ watchlists, scripts }) =>
          set((s) => {
            const merged = mergeBinanceWatchlists(
              watchlists.length ? watchlists : s.watchlists
            );
            const prefer =
              merged.find((w) => w.id === "binance-ai-usdt")?.id ??
              merged[0]?.id ??
              s.activeWatchlistId ??
              "crypto-majors";
            return {
              watchlists: merged,
              scripts: scripts.length
                ? scripts.map((sc) => ({
                    ...sc,
                    language: sc.language ?? "td",
                  }))
                : s.scripts,
              activeWatchlistId: prefer,
            };
          }),
      };
    },
    {
      name: "tradedesk-v1",
      onRehydrateStorage: () => (state) => {
        if (state?.lastBacktest) {
          state.lastBacktest = normalizeBacktestResult(state.lastBacktest);
        }
      },
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
        activeStrategyId: s.activeStrategyId,
        alerts: s.alerts,
        botSettings: s.botSettings,
        drawings: s.drawings,
      }),
    }
  )
);

export const TIMEFRAMES: Timeframe[] = [...NATIVE_TIMEFRAMES];

export const LAYOUT_OPTIONS: LayoutMode[] = [1, 2, 4, 6, 9];
