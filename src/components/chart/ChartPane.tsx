"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type { PaneConfig } from "@/lib/types";
import { useKlines } from "@/lib/hooks/useKlines";
import { computeBuiltin } from "@/lib/indicators/registry";
import { runCustomScript } from "@/lib/scripts/sandbox";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";
import { SymbolSearch } from "@/components/chart/SymbolSearch";
import { Badge } from "@/components/ui/Badge";
import { usePatternOverlay } from "@/components/chart/PatternOverlay";
import { detectPatterns } from "@/lib/patterns/detect";
import type { PatternHit } from "@/lib/patterns/types";
import clsx from "clsx";

interface Props {
  pane: PaneConfig;
  compact?: boolean;
}

export function ChartPane({ pane, compact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlayRefs = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(
    new Map()
  );
  const subChartRef = useRef<IChartApi | null>(null);
  const subContainerRef = useRef<HTMLDivElement>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const [chartReady, setChartReady] = useState(0);

  const {
    activePaneId,
    setActivePane,
    updatePane,
    scripts,
    risk,
    showRiskLines,
    patternSettings,
  } = useDeskStore();

  const { candles, loading, error, delayed, note } = useKlines(
    pane.symbol,
    pane.exchange,
    pane.timeframe
  );

  const active = activePaneId === pane.id;

  const patterns: PatternHit[] = useMemo(() => {
    if (!candles.length) return [];
    return detectPatterns(candles, {
      swingStrength: patternSettings.swingStrength,
      twinTol: patternSettings.twinTol,
      boxLookback: patternSettings.boxLookback,
    });
  }, [candles, patternSettings.swingStrength, patternSettings.twinTol, patternSettings.boxLookback]);

  // expose patterns for panel via custom event when active
  useEffect(() => {
    if (!active) return;
    window.dispatchEvent(
      new CustomEvent("td-patterns", { detail: { paneId: pane.id, patterns, symbol: pane.symbol } })
    );
  }, [patterns, active, pane.id, pane.symbol]);

  usePatternOverlay({
    chart: chartReady ? chartRef.current : null,
    series: chartReady ? candleRef.current : null,
    patterns: active ? patterns : [],
    focusId: active ? patternSettings.focusId : null,
    container: chartReady ? containerRef.current : null,
  });


  // Main chart init
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#12161c" },
        textColor: "#8b95a8",
      },
      grid: {
        vertLines: { color: "#1a1f27" },
        horzLines: { color: "#1a1f27" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2a3140" },
      timeScale: { borderColor: "#2a3140", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
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
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  // Sub chart for oscillators
  useEffect(() => {
    if (!subContainerRef.current) return;
    const chart = createChart(subContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#12161c" },
        textColor: "#8b95a8",
      },
      grid: {
        vertLines: { color: "#1a1f27" },
        horzLines: { color: "#1a1f27" },
      },
      rightPriceScale: { borderColor: "#2a3140" },
      timeScale: { borderColor: "#2a3140", visible: false },
      width: subContainerRef.current.clientWidth,
      height: subContainerRef.current.clientHeight,
    });
    subChartRef.current = chart;
    const ro = new ResizeObserver(() => {
      if (!subContainerRef.current || !subChartRef.current) return;
      subChartRef.current.applyOptions({
        width: subContainerRef.current.clientWidth,
        height: subContainerRef.current.clientHeight,
      });
    });
    ro.observe(subContainerRef.current);
    return () => {
      ro.disconnect();
      chart.remove();
      subChartRef.current = null;
    };
  }, []);

  const plots = useMemo(() => {
    if (!candles.length) return [];
    const all = [];
    for (const ind of pane.indicators) {
      if (!ind.visible) continue;
      if (ind.type === "custom" && ind.scriptId) {
        const sc = scripts.find((s) => s.id === ind.scriptId);
        if (!sc) continue;
        const result = runCustomScript(sc.code, candles, sc.language);
        for (const p of result.plots) {
          const data = candles
            .map((c, i) => {
              const v = p.values[i];
              if (v == null || !Number.isFinite(v)) return null;
              return { time: c.time as unknown as import("lightweight-charts").UTCTimestamp, value: v };
            })
            .filter(Boolean) as { time: import("lightweight-charts").UTCTimestamp; value: number }[];
          all.push({
            id: `${ind.id}-${p.id}`,
            pane: (p.pane ?? "main") as "main" | "sub",
            type: (p.type ?? "line") as "line" | "histogram",
            color: p.color ?? "#2962ff",
            data,
            title: p.title ?? ind.name,
          });
        }
      } else {
        all.push(
          ...computeBuiltin(ind, candles).map((s) => ({
            ...s,
            data: s.data.map((d) => ({
              time: d.time as unknown as import("lightweight-charts").UTCTimestamp,
              value: d.value,
            })),
          }))
        );
      }
    }
    return all;
  }, [candles, pane.indicators, scripts]);

  // Update candle + volume data
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
  }, [candles]);

  // Overlay / sub indicators
  useEffect(() => {
    const main = chartRef.current;
    const sub = subChartRef.current;
    if (!main || !sub) return;

    // clear previous overlay series
    for (const series of Array.from(overlayRefs.current.values())) {
      try {
        main.removeSeries(series as ISeriesApi<"Line">);
      } catch {
        try {
          sub.removeSeries(series as ISeriesApi<"Line">);
        } catch {
          /* */
        }
      }
    }
    overlayRefs.current.clear();

    for (const p of plots) {
      const target = p.pane === "sub" ? sub : main;
      if (p.type === "histogram") {
        const s = target.addHistogramSeries({
          color: p.color,
          priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
        });
        s.setData(p.data);
        overlayRefs.current.set(p.id, s);
      } else {
        const s = target.addLineSeries({
          color: p.color,
          lineWidth: 2,
          title: p.title,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        s.setData(p.data);
        overlayRefs.current.set(p.id, s);
      }
    }
  }, [plots]);

  // TP/SL lines on active pane
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
        </select>
        {pane.exchange === "bist" && <Badge tone="warn">Gecikmeli</Badge>}
        {delayed && note && !compact && (
          <span className="text-2xs text-desk-warn truncate max-w-[180px]" title={note}>
            BIST
          </span>
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
      <div className="relative flex-1 min-h-0 flex flex-col">
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
        <div ref={containerRef} className="flex-[3] min-h-[120px]" />
        <div ref={subContainerRef} className="flex-1 min-h-[60px] border-t border-desk-border" />
      </div>
    </div>
  );
}
