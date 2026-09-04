"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { PatternDrawing, PatternHit } from "@/lib/patterns/types";

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  patterns: PatternHit[];
  /** highlighted pattern id from panel click */
  focusId: string | null;
  container: HTMLDivElement | null;
}

/**
 * Canvas overlay synced to lightweight-charts time/price scales.
 * Draws trendlines, boxes, hlines, labels for pattern geometry.
 */
export function usePatternOverlay({
  chart,
  series,
  patterns,
  focusId,
  container,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!container) return;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "5";
      container.style.position = "relative";
      container.appendChild(canvas);
      canvasRef.current = canvas;
    }
    return () => {
      canvas?.remove();
      canvasRef.current = null;
    };
  }, [container]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series || !container) return;

    const draw = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const ts = chart.timeScale();
      const toX = (t: number) => ts.timeToCoordinate(t as Time);
      const toY = (p: number) => series.priceToCoordinate(p);

      const drawings: { d: PatternDrawing; focus: boolean; dim: boolean }[] = [];
      for (const pat of patterns) {
        const focus = focusId != null && pat.id === focusId;
        const dim = focusId != null && pat.id !== focusId;
        for (const d of pat.drawings) {
          if (d.kind === "marker") continue; // markers via series
          drawings.push({ d, focus, dim });
        }
      }

      for (const { d, focus, dim } of drawings) {
        const x1 = toX(d.t1) as number | null;
        const y1 = toY(d.price1) as number | null;
        if (x1 == null || y1 == null) continue;
        const color = d.color ?? "#2962ff";
        ctx.globalAlpha = dim ? 0.2 : focus ? 1 : 0.85;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = (d.lineWidth ?? 1.5) * (focus ? 1.6 : 1);
        if (d.dashed) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);

        if (d.kind === "box" && d.t2 != null && d.price2 != null) {
          const x2 = toX(d.t2) as number | null;
          const y2 = toY(d.price2) as number | null;
          if (x2 == null || y2 == null) continue;
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const bw = Math.abs(x2 - x1);
          const bh = Math.abs(y2 - y1);
          ctx.globalAlpha = dim ? 0.08 : focus ? 0.28 : 0.16;
          // parse rgba or solid
          ctx.fillStyle = color.startsWith("rgba")
            ? color
            : hexAlpha(color, focus ? 0.28 : 0.14);
          ctx.fillRect(left, top, bw, bh);
          ctx.globalAlpha = dim ? 0.25 : 0.9;
          ctx.strokeStyle = color.startsWith("rgba")
            ? color.replace(/[\d.]+\)$/, "0.8)")
            : color;
          ctx.strokeRect(left, top, bw, bh);
          if (d.label) {
            ctx.font = "10px Inter, sans-serif";
            ctx.fillStyle = "#e8edf5";
            ctx.fillText(d.label, left + 4, top + 12);
          }
        } else if (
          (d.kind === "trendline" ||
            d.kind === "segment" ||
            d.kind === "ray" ||
            d.kind === "hline") &&
          d.t2 != null &&
          d.price2 != null
        ) {
          let x2 = toX(d.t2) as number | null;
          let y2 = toY(d.price2) as number | null;
          if (x2 == null || y2 == null) continue;
          if (d.kind === "ray") {
            // extend to right edge
            const dx = x2 - x1 || 1;
            const dy = y2 - y1;
            const targetX = w;
            const k = (targetX - x1) / dx;
            x2 = targetX as number;
            y2 = (y1 as number) + dy * k;
          }
          if (d.kind === "hline") {
            y2 = y1 as number;
          }
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          if (d.label) {
            ctx.setLineDash([]);
            ctx.font = "10px Inter, sans-serif";
            ctx.fillStyle = color;
            ctx.fillText(d.label, Math.min(x1, x2) + 4, Math.min(y1, y2) - 4);
          }
        } else if (d.kind === "label") {
          ctx.font = focus ? "bold 11px Inter, sans-serif" : "10px Inter, sans-serif";
          ctx.fillStyle = color;
          const text = d.label ?? "";
          const tw = ctx.measureText(text).width;
          ctx.globalAlpha = dim ? 0.2 : 0.85;
          ctx.fillStyle = "rgba(18,22,28,0.75)";
          ctx.fillRect(x1 - 2, y1 - 14, tw + 8, 16);
          ctx.fillStyle = color;
          ctx.fillText(text, x1 + 2, y1 - 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
    // also redraw on crosshair / data — poll lightly when focus changes
    const id = window.setInterval(draw, 500);
    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(draw);
      clearInterval(id);
    };
  }, [chart, series, patterns, focusId, container]);

  // Apply markers for focused / all patterns
  useEffect(() => {
    if (!series) return;
    const markers: {
      time: Time;
      position: "aboveBar" | "belowBar";
      color: string;
      shape: "circle" | "square" | "arrowUp" | "arrowDown";
      text: string;
    }[] = [];
    for (const pat of patterns) {
      if (focusId && pat.id !== focusId) continue;
      for (const d of pat.drawings) {
        if (d.kind !== "marker") continue;
        markers.push({
          time: d.t1 as Time,
          position: d.position ?? "aboveBar",
          color: d.color ?? "#2962ff",
          shape: d.shape ?? "circle",
          text: d.label ?? "",
        });
      }
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    try {
      series.setMarkers(markers);
    } catch {
      /* chart disposed */
    }
  }, [series, patterns, focusId]);
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
