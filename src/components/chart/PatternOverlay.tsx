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
  /** candle open times (unix sec) for nearest-bar fallback when exact time miss */
  candleTimes?: number[];
  /** bump to force redraw after TF/symbol/candles settle */
  overlayEpoch?: number;
}

export const TD_OVERLAY_REDRAW = "td-overlay-redraw";

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
  candleTimes,
  overlayEpoch = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timesRef = useRef<number[]>([]);
  timesRef.current = candleTimes ?? [];

  // Ensure canvas exists on container; recreate if chart wiped innerHTML / remount.
  // Do not aggressively remove on every dep flicker — only detach when container gone.
  useEffect(() => {
    if (!container) return;

    const ensureCanvas = () => {
      let canvas = canvasRef.current;
      if (canvas && canvas.parentElement === container) return canvas;
      if (canvas && canvas.parentElement !== container) {
        try {
          canvas.remove();
        } catch {
          /* */
        }
        canvasRef.current = null;
        canvas = null;
      }
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
      return canvas;
    };

    ensureCanvas();

    // If LWC recreate clears children, re-attach on next frame when missing
    const mo = new MutationObserver(() => {
      if (!canvasRef.current || canvasRef.current.parentElement !== container) {
        ensureCanvas();
      }
    });
    mo.observe(container, { childList: true });

    return () => {
      mo.disconnect();
      // Only remove if still our node under this container (avoid fighting remount races)
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement === container) {
        canvas.remove();
      }
      if (canvasRef.current === canvas) canvasRef.current = null;
    };
  }, [container]);

  useEffect(() => {
    if (!chart || !series || !container) return;

    const ensureCanvas = (): HTMLCanvasElement | null => {
      let canvas = canvasRef.current;
      if (canvas && canvas.parentElement === container) return canvas;
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
      return canvas;
    };

    const nearestTime = (t: number): number => {
      const times = timesRef.current;
      if (!times.length) return t;
      // exact
      let lo = 0;
      let hi = times.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = times[mid]!;
        if (v === t) return t;
        if (v < t) lo = mid + 1;
        else hi = mid - 1;
      }
      // nearest among hi / lo
      const a = times[Math.max(0, hi)];
      const b = times[Math.min(times.length - 1, lo)];
      if (a == null) return b ?? t;
      if (b == null) return a;
      return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
    };

    const toX = (ts: ReturnType<IChartApi["timeScale"]>, t: number): number | null => {
      let x = ts.timeToCoordinate(t as Time) as number | null;
      if (x != null) return x;
      const nt = nearestTime(t);
      if (nt !== t) {
        x = ts.timeToCoordinate(nt as Time) as number | null;
        if (x != null) return x;
      }
      // logical index fallback via binary search index
      const times = timesRef.current;
      if (!times.length) return null;
      let lo = 0;
      let hi = times.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = times[mid]!;
        best = mid;
        if (v === nt) {
          best = mid;
          break;
        }
        if (v < nt) lo = mid + 1;
        else hi = mid - 1;
      }
      if (Math.abs((times[best] ?? 0) - nt) > Math.abs((times[lo] ?? times[best] ?? 0) - nt)) {
        best = Math.min(times.length - 1, lo);
      }
      try {
        return ts.logicalToCoordinate(best as never) as number | null;
      } catch {
        return null;
      }
    };

    const draw = () => {
      const canvas = ensureCanvas();
      if (!canvas) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (!patterns.length) return;

      const ts = chart.timeScale();
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
        const x1 = toX(ts, d.t1);
        const y1 = toY(d.price1) as number | null;
        // Labels: still try with partial coords; skip only if both axes missing
        if (d.kind === "label") {
          if (x1 == null && y1 == null) continue;
          const lx = x1 ?? 8;
          const ly = y1 ?? 16;
          ctx.font = focus ? "bold 11px Inter, sans-serif" : "10px Inter, sans-serif";
          const color = d.color ?? "#2962ff";
          const text = d.label ?? "";
          const tw = ctx.measureText(text).width;
          ctx.globalAlpha = dim ? 0.2 : 0.85;
          ctx.fillStyle = "rgba(18,22,28,0.75)";
          ctx.fillRect(lx - 2, ly - 14, tw + 8, 16);
          ctx.fillStyle = color;
          ctx.fillText(text, lx + 2, ly - 2);
          continue;
        }

        if (x1 == null || y1 == null) continue;
        const color = d.color ?? "#2962ff";
        ctx.globalAlpha = dim ? 0.2 : focus ? 1 : 0.85;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = (d.lineWidth ?? 1.5) * (focus ? 1.6 : 1);
        if (d.dashed) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);

        if (d.kind === "box" && d.t2 != null && d.price2 != null) {
          const x2 = toX(ts, d.t2);
          const y2 = toY(d.price2) as number | null;
          if (x2 == null || y2 == null) continue;
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const bw = Math.abs(x2 - x1);
          const bh = Math.abs(y2 - y1);
          ctx.globalAlpha = dim ? 0.08 : focus ? 0.28 : 0.16;
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
          let x2 = toX(ts, d.t2);
          let y2 = toY(d.price2) as number | null;
          if (x2 == null || y2 == null) continue;
          if (d.kind === "ray") {
            const dx = x2 - x1 || 1;
            const dy = y2 - y1;
            const targetX = w;
            const k = (targetX - x1) / dx;
            x2 = targetX;
            y2 = y1 + dy * k;
          }
          if (d.kind === "hline") {
            y2 = y1;
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
        }
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(draw);

    const onCustom = () => draw();
    window.addEventListener(TD_OVERLAY_REDRAW, onCustom);

    const id = window.setInterval(draw, 500);
    return () => {
      ro.disconnect();
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(draw);
      } catch {
        /* */
      }
      window.removeEventListener(TD_OVERLAY_REDRAW, onCustom);
      clearInterval(id);
    };
  }, [chart, series, patterns, focusId, container, overlayEpoch, candleTimes]);

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
    const times = timesRef.current;
    const snap = (t: number): number => {
      if (!times.length) return t;
      let lo = 0;
      let hi = times.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = times[mid]!;
        if (v === t) return t;
        if (v < t) lo = mid + 1;
        else hi = mid - 1;
      }
      const a = times[Math.max(0, hi)];
      const b = times[Math.min(times.length - 1, lo)];
      if (a == null) return b ?? t;
      if (b == null) return a;
      return Math.abs(a - t) <= Math.abs(b - t) ? a : b;
    };
    for (const pat of patterns) {
      if (focusId && pat.id !== focusId) continue;
      for (const d of pat.drawings) {
        if (d.kind !== "marker") continue;
        markers.push({
          time: snap(d.t1) as Time,
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
  }, [series, patterns, focusId, overlayEpoch, candleTimes]);
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
