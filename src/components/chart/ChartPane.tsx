"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type LogicalRange,
  type MouseEventParams,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type { PaneConfig } from "@/lib/types";
import { useKlines } from "@/lib/hooks/useKlines";
import { computeAllIndicators, BUILTIN_META, type PlotSeries } from "@/lib/indicators/registry";
import { toSyncedLineData } from "@/lib/indicators/math";
import { runCustomScript } from "@/lib/scripts/sandbox";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";
import { SymbolSearch } from "@/components/chart/SymbolSearch";
import { IndicatorMenu } from "@/components/indicators/IndicatorMenu";
import { Badge } from "@/components/ui/Badge";
import { usePatternOverlay, TD_OVERLAY_REDRAW } from "@/components/chart/PatternOverlay";
import { normalizeTimeframe } from "@/lib/data/timeframes";
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
  const syncingRange = useRef(false);
  const syncingCross = useRef(false);
  const rangeRaf = useRef(0);
  const pendingRange = useRef<LogicalRange | null>(null);
  const [chartReady, setChartReady] = useState(0);
  const [subReady, setSubReady] = useState(0);
  const [containersTick, setContainersTick] = useState(0);

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

  const { candles, loading, error, delayed, note } = useKlines(
    pane.symbol,
    pane.exchange,
    pane.timeframe
  );

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
    const span = Math.abs(t1 - t0);
    const pad = Math.max(span * 0.15, 60 * 60); // ≥1h pad
    const from = (Math.min(t0, t1) - pad) as import("lightweight-charts").Time;
    const to = (Math.max(t0, t1) + pad) as import("lightweight-charts").Time;

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      lastOverlaySettleRef.current = overlaySettleKey;
      try {
        chart.timeScale().setVisibleRange({ from, to });
      } catch {
        try {
          chart.timeScale().fitContent();
        } catch {
          /* */
        }
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

  const syncLogicalRanges = useCallback((source?: IChartApi | null) => {
    const main = chartRef.current;
    if (!main) return;
    const charts: IChartApi[] = [main, ...Array.from(subChartsRef.current.values())];
    if (charts.length < 2) return;

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

    syncingRange.current = true;
    try {
      for (const c of charts) {
        if (c === primary) continue;
        try {
          c.timeScale().setVisibleLogicalRange(range);
        } catch {
          /* */
        }
      }
    } finally {
      syncingRange.current = false;
    }
  }, []);

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
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    chartRef.current = chart;
    candleRef.current = candlesSeries;
    volRef.current = volumeSeries;
    setChartReady((n) => n + 1);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const size = pixelSize(containerRef.current);
      chartRef.current.applyOptions({
        width: size.width,
        height: size.height,
      });
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

  // IMPORTANT: never setState on ref detach — React Strict Mode attach/detach
  // loops would infinite-update (Maximum update depth exceeded).
  const setSubContainerRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) {
        const prev = subContainerRefs.current.get(id);
        subContainerRefs.current.set(id, el);
        if (prev !== el) {
          // Defer tick so we don't setState during commit phase storms
          void Promise.resolve().then(() => {
            setContainersTick((n) => n + 1);
          });
        }
      } else {
        // Only clear the ref map; chart teardown belongs in the lifecycle effect
        // when group ids change or on unmount — not here.
        if (subContainerRefs.current.get(id)) {
          subContainerRefs.current.delete(id);
        }
      }
    },
    []
  );

  // Single lifecycle: create / recreate / remove sub charts (no second-pass race)
  useEffect(() => {
    const ids = new Set(subGroups.map((g) => g.id));
    let created = false;

    for (const id of Array.from(subChartsRef.current.keys())) {
      if (!ids.has(id)) {
        destroySubChart(id);
        created = true;
      }
    }

    for (const g of subGroups) {
      const el = subContainerRefs.current.get(g.id);
      if (!el) continue;

      const existing = subChartsRef.current.get(g.id);
      if (existing && existing.__el === el) continue;

      if (existing) destroySubChart(g.id);

      // Dedicated empty node — clear LWC leftovers before createChart
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

      syncLogicalRanges(chartRef.current);
      created = true;
    }

    if (created) setSubReady((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subGroupIds, containersTick]);

  // Cleanup all sub charts on unmount
  useEffect(() => {
    return () => {
      if (rangeRaf.current) cancelAnimationFrame(rangeRaf.current);
      for (const id of Array.from(subChartsRef.current.keys())) {
        destroySubChart(id);
      }
    };
  }, [destroySubChart]);

  // Time + crosshair sync across main + all sub charts
  useEffect(() => {
    const main = chartRef.current;
    if (!main) return;
    const charts: IChartApi[] = [main, ...Array.from(subChartsRef.current.values())];
    const unsubs: (() => void)[] = [];

    const flushRange = () => {
      rangeRaf.current = 0;
      const range = pendingRange.current;
      pendingRange.current = null;
      if (!range || syncingRange.current) return;
      syncingRange.current = true;
      try {
        for (const other of charts) {
          try {
            other.timeScale().setVisibleLogicalRange(range);
          } catch {
            /* */
          }
        }
      } finally {
        syncingRange.current = false;
      }
    };

    const sharedRangeHandler = (range: LogicalRange | null) => {
      if (syncingRange.current || !range) return;
      pendingRange.current = range;
      if (rangeRaf.current) return;
      rangeRaf.current = requestAnimationFrame(flushRange);
    };

    for (const chart of charts) {
      chart.timeScale().subscribeVisibleLogicalRangeChange(sharedRangeHandler);
      unsubs.push(() => {
        try {
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(sharedRangeHandler);
        } catch {
          /* */
        }
      });
    }

    const seriesFor = (chart: IChartApi) => {
      if (chart === main && candleRef.current) return candleRef.current;
      for (const [gid, c] of Array.from(subChartsRef.current.entries())) {
        if (c !== chart) continue;
        const smap = subSeriesRef.current.get(gid);
        return smap?.values().next().value ?? null;
      }
      return null;
    };

    for (const chart of charts) {
      const onMove = (param: MouseEventParams) => {
        if (syncingCross.current) return;
        syncingCross.current = true;
        try {
          if (param.time == null) {
            for (const other of charts) {
              if (other !== chart) other.clearCrosshairPosition();
            }
            return;
          }
          for (const other of charts) {
            if (other === chart) continue;
            const series = seriesFor(other);
            if (!series) continue;
            try {
              const data = series.dataByIndex(
                other.timeScale().coordinateToLogical(
                  chart.timeScale().timeToCoordinate(param.time as never) ?? 0
                ) ?? 0,
                -1
              ) as { value?: number; close?: number } | null;
              const price = data?.value ?? data?.close;
              if (price == null || !Number.isFinite(price)) continue;
              other.setCrosshairPosition(price, param.time, series);
            } catch {
              /* ignore sync failures */
            }
          }
        } finally {
          syncingCross.current = false;
        }
      };
      chart.subscribeCrosshairMove(onMove);
      unsubs.push(() => {
        try {
          chart.unsubscribeCrosshairMove(onMove);
        } catch {
          /* */
        }
      });
    }

    // Align once when charts join / remount
    syncLogicalRanges(main);

    return () => {
      for (const u of unsubs) u();
      if (rangeRaf.current) {
        cancelAnimationFrame(rangeRaf.current);
        rangeRaf.current = 0;
      }
    };
  }, [chartReady, subReady, subGroupIds, syncLogicalRanges]);

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
    // Keep oscillator panes locked after candle reload
    requestAnimationFrame(() => {
      syncLogicalRanges(chartRef.current);
      if (overlayPattern) {
        window.dispatchEvent(new Event(TD_OVERLAY_REDRAW));
      }
    });
  }, [candles, syncLogicalRanges, overlayPattern]);

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
        });
        s.setData(p.data as never);
        mainOverlayRefs.current.set(p.id, s);
      } else {
        const s = main.addLineSeries({
          color: p.color,
          lineWidth: 2,
          title: p.title,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        s.setData(p.data as never);
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
          });
          s.setData(p.data as never);
          seriesMap.set(p.id, s);
        } else {
          const s = chart.addLineSeries({
            color: p.color,
            lineWidth: 2,
            title: p.title,
            priceLineVisible: false,
            lastValueVisible: true,
          });
          s.setData(p.data as never);
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

  const last = candles[candles.length - 1];
  const bodyGridRows =
    oscCount === 0
      ? "minmax(0, 1fr)"
      : `minmax(0, 1fr) repeat(${oscCount}, minmax(110px, 140px))`;

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
              className="btn px-1.5 text-2xs"
              title="Formasyon overlay temizle"
              onClick={(e) => {
                e.stopPropagation();
                setOverlayPattern(null);
                setPatternFocus(null);
                setOverlayDrawnMsg(false);
              }}
            >
              ✕
            </button>
          </>
        )}
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
        <div ref={containerRef} className="min-h-0 overflow-hidden" />
        {subGroups.map((g) => (
          <div
            key={g.id}
            className="min-h-[110px] h-[120px] overflow-hidden relative border-t border-desk-border"
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
