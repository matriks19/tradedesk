"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type LogicalRange,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
} from "lightweight-charts";
import type { PaneConfig } from "@/lib/types";
import { useKlines } from "@/lib/hooks/useKlines";
import { computeAllIndicators, BUILTIN_META, type PlotSeries } from "@/lib/indicators/registry";
import { toSyncedLineData } from "@/lib/indicators/math";
import { runCustomScript } from "@/lib/scripts/sandbox";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";
import { SymbolSearch } from "@/components/chart/SymbolSearch";
import { DrawingToolbar } from "@/components/chart/DrawingToolbar";
import { DrawingOverlay } from "@/components/chart/DrawingOverlay";
import { IndicatorMenu } from "@/components/indicators/IndicatorMenu";
import { Badge } from "@/components/ui/Badge";
import { usePatternOverlay, TD_OVERLAY_REDRAW } from "@/components/chart/PatternOverlay";
import { normalizeTimeframe } from "@/lib/data/timeframes";
import { diagonalSr } from "@/lib/indicators/diagonalSr";
import clsx from "clsx";

interface Props {
  pane: PaneConfig;
  compact?: boolean;
}

interface SubPaneGroup {
  id: string;
  title: string;
  plots: PlotSeries[];
}

type ChartWithMeta = IChartApi & {
  __ro?: ResizeObserver;
  __el?: HTMLDivElement;
};

function chartOptions(height: number, width: number, showTime: boolean) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: "#12161c" as const },
      textColor: "#8b95a8",
    },
    grid: {
      vertLines: { color: "#1a1f27" },
      horzLines: { color: "#1a1f27" },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: "#2a3140",
      // Prefer time-scale pan; price axis drag shouldn't fight horizontal sync
      entireTextOnly: true,
    },
    timeScale: {
      borderColor: "#2a3140",
      timeVisible: showTime,
      secondsVisible: false,
      visible: showTime,
      // Comfortable default density; initial range is set after setData.
      barSpacing: 8,
      minBarSpacing: 2,
      rightOffset: 12,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      axisDoubleClickReset: true,
      mouseWheel: true,
      pinch: true,
    },
    width,
    height,
  };
}

function pixelSize(el: HTMLElement): { width: number; height: number } {
  const r = el.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(r.width)),
    height: Math.max(1, Math.floor(r.height)),
  };
}

/** Nearest candle index for a unix-sec time (sorted ascending). */
function nearestCandleIndex(times: number[], t: number): number {
  const n = times.length;
  if (n === 0) return -1;
  let lo = 0;
  let hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = times[mid]!;
    if (v === t) return mid;
    if (v < t) lo = mid + 1;
    else hi = mid - 1;
  }
  if (lo >= n) return n - 1;
  if (lo <= 0) return 0;
  return Math.abs(times[lo]! - t) < Math.abs(times[lo - 1]! - t) ? lo : lo - 1;
}

export function ChartPane({ pane, compact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const mainOverlayRefs = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(
    new Map()
  );
  const subChartsRef = useRef<Map<string, ChartWithMeta>>(new Map());
  const subSeriesRef = useRef<
    Map<string, Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>
  >(new Map());
  const subContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const priceLinesRef = useRef<IPriceLine[]>([]);
  /** First open / symbol·TF change: target last ~80–120 bars (not full history). */
  const INITIAL_VISIBLE_BARS = 80;
  const dataViewKeyRef = useRef("");
  /** Re-apply visible range after first real layout / symbol·TF change. */
  const needsInitialFitRef = useRef(true);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  /** Ignore range events shortly after programmatic setVisibleLogicalRange. */
  const programmaticUntil = useRef(0);
  const lastSyncedRange = useRef<LogicalRange | null>(null);
  const rangeRaf = useRef(0);
  const pendingRange = useRef<LogicalRange | null>(null);
  const pendingSource = useRef<IChartApi | null>(null);
  const subGroupsRef = useRef<SubPaneGroup[]>([]);
  const [chartReady, setChartReady] = useState(0);
  /** Bumped only when sub charts are created/destroyed (series effect). */
  const [subReady, setSubReady] = useState(0);
  const [logScale, setLogScale] = useState(false);

  const {
    activePaneId,
    setActivePane,
    updatePane,
    scripts,
    risk,
    showRiskLines,
    patternSettings,
    overlayPattern,
    setOverlayPattern,
    setPatternFocus,
    recentCustomTimeframes,
    addRecentCustomTimeframe,
  } = useDeskStore();
  const [customTfDraft, setCustomTfDraft] = useState("");
  const [overlayEpoch, setOverlayEpoch] = useState(0);
  const [overlayDrawnMsg, setOverlayDrawnMsg] = useState(false);
  const overlayPatternRef = useRef(overlayPattern);
  overlayPatternRef.current = overlayPattern;

  const pendingDiagPaneId = useDeskStore((s) => s.pendingDiagPaneId);
  const requestPlaceDiag = useDeskStore((s) => s.requestPlaceDiag);
  const placeAutoDiag = useDeskStore((s) => s.placeAutoDiag);


  const { candles, loading, error, delayed, note } = useKlines(
    pane.symbol,
    pane.exchange,
    pane.timeframe
  );

  useEffect(() => {
    if (pendingDiagPaneId !== pane.id) return;
    if (!candles.length) return;
    const d = diagonalSr(candles);
    const segs: {
      t0: number;
      p0: number;
      t1: number;
      p1: number;
      descending?: boolean;
      kind: "sup" | "res";
    }[] = [];
    if (d.lastSup)
      segs.push({ ...d.lastSup, kind: "sup" });
    if (d.lastRes)
      segs.push({ ...d.lastRes, kind: "res" });
    placeAutoDiag(pane.id, segs);
    requestPlaceDiag(null);
  }, [pendingDiagPaneId, candles, pane.id, placeAutoDiag, requestPlaceDiag]);


  const active = activePaneId === pane.id;

  // Overlay only: user-selected pattern from Formasyon / Tarama (no live detect)
  const overlayPatterns = useMemo(
    () => (overlayPattern ? [overlayPattern] : []),
    [overlayPattern]
  );

  const candleTimes = useMemo(
    () => candles.map((c) => c.time),
    [candles]
  );

  usePatternOverlay({
    chart: chartReady ? chartRef.current : null,
    series: chartReady ? candleRef.current : null,
    patterns: active ? overlayPatterns : [],
    focusId: active ? patternSettings.focusId : null,
    container: chartReady ? containerRef.current : null,
    candleTimes: active ? candleTimes : [],
    overlayEpoch,
  });

  // After symbol/TF change, wait for candles then scroll to pattern span and force redraw.
  // Keyed so live WS candle ticks do not keep resetting the visible range.
  const overlaySettleKey = overlayPattern
    ? `${overlayPattern.id}|${pane.symbol}|${pane.timeframe}|${candles.length > 0 ? 1 : 0}`
    : "";
  const lastOverlaySettleRef = useRef("");

  useEffect(() => {
    if (!active || !overlayPattern || !candles.length || !chartRef.current) {
      if (!overlayPattern) {
        lastOverlaySettleRef.current = "";
        setOverlayDrawnMsg(false);
      }
      return;
    }
    // If pattern carries a TF, wait until pane matches (openSymbolInActive already switched).
    if (
      overlayPattern.timeframe &&
      String(pane.timeframe) !== String(overlayPattern.timeframe)
    ) {
      return;
    }
    if (lastOverlaySettleRef.current === overlaySettleKey) return;

    const chart = chartRef.current;
    const t0 = overlayPattern.tStart;
    const t1 = overlayPattern.tEnd;
    const times = candles.map((c) => c.time);
    const n = times.length;
    const i0 = nearestCandleIndex(times, Math.min(t0, t1));
    const i1 = nearestCandleIndex(times, Math.max(t0, t1));

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      lastOverlaySettleRef.current = overlaySettleKey;
      try {
        if (i0 < 0 || i1 < 0 || n < 1) {
          chart.timeScale().fitContent();
          needsInitialFitRef.current = false;
          syncLogicalRangesRef.current(chart);
        } else {
          // Center pattern with ~40 bars context each side; ≥80 bars total.
          let from = Math.max(0, i0 - 40);
          let to = Math.min(n - 1, i1 + 40);
          const minSpan = Math.min(80, Math.max(0, n - 1));
          if (to - from < minSpan) {
            const mid = (i0 + i1) / 2;
            const half = minSpan / 2;
            from = Math.max(0, Math.floor(mid - half));
            to = Math.min(n - 1, Math.ceil(mid + half));
            if (to - from < minSpan) {
              if (from === 0) to = Math.min(n - 1, from + minSpan);
              else if (to === n - 1) from = Math.max(0, to - minSpan);
            }
          }
          // applyInitialView-style right pad so last visible bar isn't edge-glued
          const range = { from, to: to + 4 } as LogicalRange;
          programmaticUntil.current = performance.now() + 120;
          chart.timeScale().setVisibleLogicalRange(range);
          needsInitialFitRef.current = false;
          try {
            chart.priceScale("right").applyOptions({ autoScale: true });
          } catch {
            /* */
          }
          syncLogicalRangesRef.current(chart);
        }
      } catch {
        try {
          chart.timeScale().fitContent();
        } catch {
          /* */
        }
        needsInitialFitRef.current = false;
      }
      setOverlayEpoch((n) => n + 1);
      window.dispatchEvent(new Event(TD_OVERLAY_REDRAW));
      setOverlayDrawnMsg(true);
    };

    // Double rAF + short timeout: allow candle setData to paint first
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(apply);
    });
    const t = window.setTimeout(apply, 150);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(t);
      // If cancelled before apply, allow a later effect to retry the same key.
      if (!applied && lastOverlaySettleRef.current === overlaySettleKey) {
        lastOverlaySettleRef.current = "";
      }
    };
  }, [
    active,
    overlayPattern,
    overlaySettleKey,
    candles.length,
    pane.timeframe,
    pane.symbol,
    chartReady,
  ]);

  const destroySubChart = useCallback((id: string) => {
    const chart = subChartsRef.current.get(id);
    if (!chart) return;
    try {
      chart.__ro?.disconnect();
    } catch {
      /* */
    }
    try {
      chart.remove();
    } catch {
      /* */
    }
    subChartsRef.current.delete(id);
    subSeriesRef.current.delete(id);
  }, []);

  const rangesNearlyEqual = useCallback((a: LogicalRange, b: LogicalRange) => {
    const eps = 0.05;
    return Math.abs(a.from - b.from) < eps && Math.abs(a.to - b.to) < eps;
  }, []);

  /** Push source visible range to every other chart (main + subs). Skip source to avoid thrash. */
  const syncLogicalRanges = useCallback((source?: IChartApi | null) => {
    const main = chartRef.current;
    if (!main) return;

    let range: LogicalRange | null = null;
    const primary = source ?? main;
    try {
      range = primary.timeScale().getVisibleLogicalRange();
    } catch {
      range = null;
    }
    if (!range) {
      try {
        main.timeScale().fitContent();
        range = main.timeScale().getVisibleLogicalRange();
      } catch {
        range = null;
      }
    }
    if (!range) return;
    if (lastSyncedRange.current && rangesNearlyEqual(lastSyncedRange.current, range)) {
      return;
    }

    lastSyncedRange.current = range;
    programmaticUntil.current = performance.now() + 80;
    if (primary !== main) {
      try {
        main.timeScale().setVisibleLogicalRange(range);
      } catch {
        /* */
      }
    }
    for (const c of Array.from(subChartsRef.current.values())) {
      if (c === primary) continue;
      try {
        c.timeScale().setVisibleLogicalRange(range);
      } catch {
        /* */
      }
    }
  }, [rangesNearlyEqual]);

  /** Fit last ~40–120 bars + price autoScale; fallback fitContent. Returns success. */
  const applyInitialView = useCallback((main: IChartApi): boolean => {
    if (overlayPatternRef.current) return false;
    const series = candleRef.current;
    if (!series) return false;
    let n = 0;
    try {
      n = series.data().length;
    } catch {
      return false;
    }
    if (n < 1) return false;

    // Prefer ~80–120 bars of history (not fitContent full series).
    const visible = Math.min(120, Math.max(40, Math.min(n, Math.max(INITIAL_VISIBLE_BARS, 120))));
    const from = Math.max(0, n - visible);
    const to = n + 4; // small right pad so last bar isn't edge-glued

    programmaticUntil.current = performance.now() + 120;
    try {
      const range = { from, to } as LogicalRange;
      main.timeScale().setVisibleLogicalRange(range);
      lastSyncedRange.current = range;
      try {
        main.priceScale("right").applyOptions({ autoScale: true });
      } catch {
        /* */
      }
      return true;
    } catch {
      try {
        main.timeScale().fitContent();
        try {
          main.priceScale("right").applyOptions({ autoScale: true });
        } catch {
          /* */
        }
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const applyInitialViewRef = useRef(applyInitialView);
  applyInitialViewRef.current = applyInitialView;
  const syncLogicalRangesRef = useRef(syncLogicalRanges);
  syncLogicalRangesRef.current = syncLogicalRanges;

  // Main chart init
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = "";
    const { width, height } = pixelSize(el);
    const chart = createChart(el, chartOptions(height || 300, width || 400, true));
    const candlesSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    // Keep candles off the pane edges; volume stays on its own scale.
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.18 },
      autoScale: true,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    chartRef.current = chart;
    candleRef.current = candlesSeries;
    volRef.current = volumeSeries;
    needsInitialFitRef.current = true;
    lastSizeRef.current = { width: width || 0, height: height || 0 };
    setChartReady((n) => n + 1);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const size = pixelSize(containerRef.current);
      const prev = lastSizeRef.current;
      const grewFromTiny =
        (prev.width < 80 || prev.height < 80) &&
        size.width >= 80 &&
        size.height >= 80;
      chartRef.current.applyOptions({
        width: size.width,
        height: size.height,
      });
      lastSizeRef.current = size;

      if (
        (needsInitialFitRef.current || grewFromTiny) &&
        size.width >= 80 &&
        size.height >= 80
      ) {
        const main = chartRef.current;
        requestAnimationFrame(() => {
          if (!chartRef.current || chartRef.current !== main) return;
          if (applyInitialViewRef.current(main)) {
            needsInitialFitRef.current = false;
            syncLogicalRangesRef.current(main);
          }
        });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  const plots = useMemo(() => {
    if (!candles.length) return [] as PlotSeries[];
    const all: PlotSeries[] = [];
    const builtinPlots = computeAllIndicators(pane.indicators, candles);
    for (const s of builtinPlots) {
      all.push({
        ...s,
        data: s.data.map((d) =>
          "value" in d && d.value != null
            ? {
                time: d.time as unknown as import("lightweight-charts").UTCTimestamp,
                value: d.value,
              }
            : {
                time: d.time as unknown as import("lightweight-charts").UTCTimestamp,
              }
        ) as PlotSeries["data"],
      });
    }
    for (const ind of pane.indicators) {
      if (!ind.visible) continue;
      if (ind.type === "custom" && ind.scriptId) {
        const sc = scripts.find((s) => s.id === ind.scriptId);
        if (!sc) continue;
        const result = runCustomScript(sc.code, candles, sc.language);
        for (const p of result.plots) {
          const data = toSyncedLineData(candles, p.values) as PlotSeries["data"];
          const plotPane = (p.pane ?? "main") as "main" | "sub";
          all.push({
            id: `${ind.id}-${p.id}`,
            pane: plotPane,
            paneGroup: plotPane === "sub" ? ind.id : undefined,
            indicatorId: ind.id,
            type: (p.type ?? "line") as "line" | "histogram",
            color: p.color ?? "#2962ff",
            data,
            title: p.title ?? ind.name,
          });
        }
      }
    }
    return all;
  }, [candles, pane.indicators, scripts]);

  const mainPlots = useMemo(
    () => plots.filter((p) => p.pane === "main"),
    [plots]
  );

  const subGroups: SubPaneGroup[] = useMemo(() => {
    const map = new Map<string, SubPaneGroup>();
    for (const p of plots) {
      if (p.pane !== "sub") continue;
      const gid = p.paneGroup || p.indicatorId || "sub";
      if (!map.has(gid)) {
        const ind = pane.indicators.find((i) => i.id === gid);
        const meta =
          ind && ind.type !== "custom"
            ? BUILTIN_META[ind.type]
            : null;
        map.set(gid, {
          id: gid,
          title: ind?.name ?? meta?.label ?? p.title ?? "Osc",
          plots: [],
        });
      }
      map.get(gid)!.plots.push(p);
    }
    // Preserve indicator order
    const order = pane.indicators.map((i) => i.id);
    return Array.from(map.values()).sort(
      (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
    );
  }, [plots, pane.indicators]);

  const subGroupIds = subGroups.map((g) => g.id).join("|");
  const oscCount = subGroups.length;

  // IMPORTANT: never setState on ref attach/detach — Strict Mode loops / thrash.
  // Lifecycle effect reads subContainerRefs after paint; one rAF retry if lagging.
  const setSubContainerRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) {
        subContainerRefs.current.set(id, el);
      } else if (subContainerRefs.current.get(id)) {
        subContainerRefs.current.delete(id);
      }
    },
    []
  );

  subGroupsRef.current = subGroups;

  // Single lifecycle: create / recreate / remove sub charts (refs only — no containersTick)
  useEffect(() => {
    const groups = subGroupsRef.current;
    const ids = new Set(groups.map((g) => g.id));
    let created = false;

    const createMissing = () => {
      let any = false;
      for (const g of groups) {
        const el = subContainerRefs.current.get(g.id);
        if (!el) continue;

        const existing = subChartsRef.current.get(g.id);
        if (existing && existing.__el === el) continue;

        if (existing) destroySubChart(g.id);

        el.innerHTML = "";
        const { width, height } = pixelSize(el);
        const chart = createChart(
          el,
          chartOptions(height || 120, width || 400, false)
        ) as ChartWithMeta;
        chart.__el = el;
        subChartsRef.current.set(g.id, chart);
        subSeriesRef.current.set(g.id, new Map());

        const ro = new ResizeObserver(() => {
          const c = subChartsRef.current.get(g.id);
          const node = subContainerRefs.current.get(g.id);
          if (!c || !node) return;
          const size = pixelSize(node);
          c.applyOptions({ width: size.width, height: size.height });
        });
        ro.observe(el);
        chart.__ro = ro;
        any = true;
      }
      return any;
    };

    for (const id of Array.from(subChartsRef.current.keys())) {
      if (!ids.has(id)) {
        destroySubChart(id);
        created = true;
      }
    }

    created = createMissing() || created;

    let raf = 0;
    if (groups.some((g) => !subChartsRef.current.has(g.id))) {
      raf = requestAnimationFrame(() => {
        if (createMissing()) {
          syncLogicalRanges(chartRef.current);
          setSubReady((n) => n + 1);
        }
      });
    }

    if (created) {
      syncLogicalRanges(chartRef.current);
      setSubReady((n) => n + 1);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subGroupIds, destroySubChart, syncLogicalRanges]);

  // Cleanup all sub charts on unmount
  useEffect(() => {
    return () => {
      if (rangeRaf.current) cancelAnimationFrame(rangeRaf.current);
      for (const id of Array.from(subChartsRef.current.keys())) {
        destroySubChart(id);
      }
    };
  }, [destroySubChart]);

  // Time sync: any pane (main or sub) can be the drag source; flush to all others.
  // programmaticUntil + rangesNearlyEqual prevent A↔B thrash from setVisibleLogicalRange.
  // Crosshair multi-pane sync disabled by default (expensive on every mousemove).
  useEffect(() => {
    const main = chartRef.current;
    if (!main) return;

    const flushRange = () => {
      rangeRaf.current = 0;
      const range = pendingRange.current;
      const source = pendingSource.current ?? main;
      pendingRange.current = null;
      pendingSource.current = null;
      if (!range) return;
      if (performance.now() < programmaticUntil.current) return;
      if (lastSyncedRange.current && rangesNearlyEqual(lastSyncedRange.current, range)) {
        return;
      }
      syncLogicalRanges(source);
    };

    const makeHandler = (chart: IChartApi) => (range: LogicalRange | null) => {
      if (!range) return;
      if (performance.now() < programmaticUntil.current) return;
      if (lastSyncedRange.current && rangesNearlyEqual(lastSyncedRange.current, range)) {
        return;
      }
      pendingRange.current = range;
      pendingSource.current = chart;
      if (rangeRaf.current) return;
      rangeRaf.current = requestAnimationFrame(flushRange);
    };

    const subs: Array<{ chart: IChartApi; handler: (r: LogicalRange | null) => void }> = [];
    const onMain = makeHandler(main);
    main.timeScale().subscribeVisibleLogicalRangeChange(onMain);
    subs.push({ chart: main, handler: onMain });

    for (const c of Array.from(subChartsRef.current.values())) {
      const handler = makeHandler(c);
      c.timeScale().subscribeVisibleLogicalRangeChange(handler);
      subs.push({ chart: c, handler });
    }

    syncLogicalRanges(main);

    return () => {
      for (const { chart, handler } of subs) {
        try {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        } catch {
          /* */
        }
      }
      if (rangeRaf.current) {
        cancelAnimationFrame(rangeRaf.current);
        rangeRaf.current = 0;
      }
    };
  }, [chartReady, subReady, subGroupIds, syncLogicalRanges, rangesNearlyEqual]);

  // When oscillator panes appear/disappear, align once from main.
  useEffect(() => {
    if (!chartReady) return;
    syncLogicalRanges(chartRef.current);
  }, [subReady, subGroupIds, chartReady, syncLogicalRanges]);

  // Update candle + volume (same time base for all series)
  useEffect(() => {
    if (!candleRef.current || !volRef.current || !candles.length) return;
    candleRef.current.setData(
      candles.map((c) => ({
        time: c.time as unknown as import("lightweight-charts").UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volRef.current.setData(
      candles.map((c) => ({
        time: c.time as unknown as import("lightweight-charts").UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open ? "rgba(38,166,154,0.4)" : "rgba(239,83,80,0.4)",
      }))
    );
    // Reset zoom on first load / symbol·TF change (not on every live tick).
    // Skip when a formation overlay is driving its own visible range.
    const viewKey = `${pane.symbol}|${pane.timeframe}|${candles[0]?.time ?? ""}`;
    const shouldResetView = dataViewKeyRef.current !== viewKey;
    if (shouldResetView) {
      dataViewKeyRef.current = viewKey;
      needsInitialFitRef.current = true;
    }

    let raf2 = 0;
    let timeoutId = 0;
    const tryApply = () => {
      const main = chartRef.current;
      if (!main || !shouldResetView || overlayPattern) return;
      const el = containerRef.current;
      if (!el) return;
      const size = pixelSize(el);
      if (size.width < 80 || size.height < 80) return; // wait for ResizeObserver
      if (applyInitialView(main)) {
        needsInitialFitRef.current = false;
      }
    };

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        tryApply();
        syncLogicalRanges(chartRef.current);
        if (overlayPattern) {
          window.dispatchEvent(new Event(TD_OVERLAY_REDRAW));
        }
      });
    });
    // Layout may settle slightly after paint (flex/grid).
    timeoutId = window.setTimeout(() => {
      if (needsInitialFitRef.current && shouldResetView && !overlayPattern) {
        tryApply();
        syncLogicalRanges(chartRef.current);
      }
    }, 80);

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [candles, syncLogicalRanges, applyInitialView, overlayPattern, pane.symbol, pane.timeframe]);

  // Main overlays
  useEffect(() => {
    const main = chartRef.current;
    if (!main) return;
    for (const series of Array.from(mainOverlayRefs.current.values())) {
      try {
        main.removeSeries(series as ISeriesApi<"Line">);
      } catch {
        /* */
      }
    }
    mainOverlayRefs.current.clear();
    for (const p of mainPlots) {
      if (p.type === "histogram") {
        const s = main.addHistogramSeries({
          color: p.color,
          priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(p.data as never);
        if (p.markers?.length) {
          try {
            s.setMarkers(p.markers as never);
          } catch {
            /* */
          }
        }
        mainOverlayRefs.current.set(p.id, s);
      } else {
        const s = main.addLineSeries({
          color: p.color,
          lineWidth: 2,
          title: p.title,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(p.data as never);
        if (p.markers?.length) {
          try {
            s.setMarkers(p.markers as never);
          } catch {
            /* */
          }
        }
        mainOverlayRefs.current.set(p.id, s);
      }
    }
    requestAnimationFrame(() => syncLogicalRanges(main));
  }, [mainPlots, chartReady, syncLogicalRanges]);

  // Sub pane series — data already one-point-per-candle (whitespace for nulls)
  useEffect(() => {
    for (const g of subGroups) {
      const chart = subChartsRef.current.get(g.id);
      if (!chart) continue;
      let seriesMap = subSeriesRef.current.get(g.id);
      if (!seriesMap) {
        seriesMap = new Map();
        subSeriesRef.current.set(g.id, seriesMap);
      }
      for (const series of Array.from(seriesMap.values())) {
        try {
          chart.removeSeries(series as ISeriesApi<"Line">);
        } catch {
          /* */
        }
      }
      seriesMap.clear();
      for (const p of g.plots) {
        if (p.type === "histogram") {
          const s = chart.addHistogramSeries({
            color: p.color,
            priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
            title: p.title,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(p.data as never);
          if (p.markers?.length) {
            try {
              s.setMarkers(p.markers as never);
            } catch {
              /* */
            }
          }
          seriesMap.set(p.id, s);
        } else {
          const s = chart.addLineSeries({
            color: p.color,
            lineWidth: 2,
            title: p.title,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          s.setData(p.data as never);
          if (p.markers?.length) {
            try {
              s.setMarkers(p.markers as never);
            } catch {
              /* */
            }
          }
          seriesMap.set(p.id, s);
        }
      }
    }
    requestAnimationFrame(() => syncLogicalRanges(chartRef.current));
  }, [subGroups, subReady, syncLogicalRanges]);

  // TP/SL lines
  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    for (const pl of priceLinesRef.current) {
      try {
        series.removePriceLine(pl);
      } catch {
        /* */
      }
    }
    priceLinesRef.current = [];
    if (!showRiskLines || !active) return;
    if (risk.entry > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: risk.entry,
          color: "#2962ff",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Giriş",
        })
      );
    }
    if (risk.stopLoss > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: risk.stopLoss,
          color: "#ef5350",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "SL",
        })
      );
    }
    if (risk.takeProfit > 0) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: risk.takeProfit,
          color: "#26a69a",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "TP",
        })
      );
    }
  }, [risk, showRiskLines, active, candles]);

  // Log / normal price scale
  useEffect(() => {
    const main = chartRef.current;
    if (!main) return;
    try {
      main.priceScale("right").applyOptions({
        mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      });
    } catch {
      /* */
    }
  }, [logScale, chartReady]);

  const fitToScreen = useCallback(() => {
    const main = chartRef.current;
    if (!main) return;
    try {
      main.timeScale().fitContent();
      main.priceScale("right").applyOptions({ autoScale: true });
      for (const c of Array.from(subChartsRef.current.values())) {
        try {
          c.timeScale().fitContent();
          c.priceScale("right").applyOptions({ autoScale: true });
        } catch {
          /* */
        }
      }
      syncLogicalRanges(main);
    } catch {
      /* */
    }
  }, [syncLogicalRanges]);

  const last = candles[candles.length - 1];
  // Main chart ~50% viewport of the pane body; remaining shared by sub-panes.
  const bodyGridRows =
    oscCount === 0
      ? "minmax(0, 1fr)"
      : `minmax(50%, 1fr) repeat(${oscCount}, minmax(72px, 1fr))`;

  return (
    <div
      className={clsx(
        "flex flex-col min-h-0 min-w-0 border rounded-md overflow-hidden",
        active ? "border-desk-accent" : "border-desk-border"
      )}
      onClick={() => setActivePane(pane.id)}
    >
      <div className="flex items-center gap-2 px-2 py-1 bg-desk-elevated border-b border-desk-border shrink-0">
        <SymbolSearch
          symbol={pane.symbol}
          exchange={pane.exchange}
          onSelect={(symbol, exchange) =>
            updatePane(pane.id, { symbol, exchange })
          }
        />
        <ChartIndicatorsButton paneId={pane.id} />
        <DrawingToolbar paneId={pane.id} />
        <select
          className="input w-auto py-1"
          value={pane.timeframe}
          onChange={(e) =>
            updatePane(pane.id, {
              timeframe: e.target.value as PaneConfig["timeframe"],
            })
          }
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
          {recentCustomTimeframes
            .filter((tf) => !(TIMEFRAMES as readonly string[]).includes(tf))
            .map((tf) => (
              <option key={`c_${tf}`} value={tf}>
                {tf} *
              </option>
            ))}
          {!(TIMEFRAMES as readonly string[]).includes(String(pane.timeframe)) &&
            !recentCustomTimeframes.includes(String(pane.timeframe)) && (
              <option value={pane.timeframe}>{pane.timeframe} *</option>
            )}
        </select>
        <input
          className="input w-16 py-1 text-2xs"
          placeholder="7m…"
          title="Özel TF: 7m, 90m, 5h"
          value={customTfDraft}
          onChange={(e) => setCustomTfDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const n = normalizeTimeframe(customTfDraft);
            if (!n) return;
            updatePane(pane.id, { timeframe: n });
            addRecentCustomTimeframe(n);
            setCustomTfDraft("");
          }}
        />
        {pane.exchange === "bist" && <Badge tone="warn">Gecikmeli</Badge>}
        {delayed && note && !compact && (
          <span
            className="text-2xs text-desk-warn truncate max-w-[180px]"
            title={note}
          >
            BIST
          </span>
        )}
        {oscCount > 0 && (
          <span className="text-2xs text-desk-muted">{oscCount} osc</span>
        )}
        {active && overlayPattern && (
          <>
            <Badge tone="accent">
              {overlayDrawnMsg ? "Formasyon çizildi" : "Formasyon…"}
            </Badge>
            <button
              type="button"
              className="btn btn-accent px-1.5 text-2xs"
              title="Formasyon overlay kapat"
              onClick={(e) => {
                e.stopPropagation();
                setOverlayPattern(null);
                setPatternFocus(null);
                setOverlayDrawnMsg(false);
              }}
            >
              Formasyon overlay kapat
            </button>
          </>
        )}
        <button
          type="button"
          className="btn px-1.5 text-2xs"
          title="Görünür aralığı otomatik ölçekle / içeriği sığdır"
          onClick={(e) => {
            e.stopPropagation();
            fitToScreen();
          }}
        >
          Ekrana sığdır
        </button>
        <button
          type="button"
          className={clsx("btn px-1.5 text-2xs", logScale && "btn-accent")}
          title="Fiyat ölçeği: Logaritmik / Normal"
          onClick={(e) => {
            e.stopPropagation();
            setLogScale((v) => !v);
          }}
        >
          {logScale ? "Logaritmik" : "Normal"}
        </button>
        {last && (
          <span
            className={clsx(
              "ml-auto font-mono text-xs",
              last.close >= last.open ? "text-desk-up" : "text-desk-down"
            )}
          >
            {last.close.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </span>
        )}
      </div>
      <div
        className="relative flex-1 min-h-0 grid"
        style={{ gridTemplateRows: bodyGridRows }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-desk-panel/60 text-xs text-desk-muted">
            Yükleniyor…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-desk-panel/80 text-xs text-desk-down px-4 text-center">
            {error}
          </div>
        )}
        <div ref={containerRef} className="min-h-0 overflow-hidden relative" />
        <DrawingOverlay
          paneId={pane.id}
          chart={chartReady ? chartRef.current : null}
          series={chartReady ? candleRef.current : null}
          container={chartReady ? containerRef.current : null}
          ready={chartReady}
          candles={candles}
        />
        {subGroups.map((g) => (
          <div
            key={g.id}
            className="min-h-[72px] overflow-hidden relative border-t border-desk-border"
          >
            <div className="absolute top-0 left-2 z-[1] text-2xs text-desk-muted pointer-events-none py-0.5">
              {g.title}
            </div>
            <div
              ref={setSubContainerRef(g.id)}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartIndicatorsButton({ paneId }: { paneId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn px-2 text-2xs"
        title="Göstergeler"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        ☰
      </button>
      <IndicatorMenu
        open={open}
        onClose={() => setOpen(false)}
        paneId={paneId}
      />
    </>
  );
}
