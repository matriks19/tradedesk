"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import { useDeskStore } from "@/store/desk";
import type { ChartDrawing, DrawTool } from "@/lib/types";

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const DEFAULT_COLOR = "#f5a623";

interface Props {
  paneId: string;
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  container: HTMLDivElement | null;
  ready: number;
}

function timeToNumber(t: Time | null | undefined): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t;
  if (typeof t === "object" && "year" in t) {
    return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
  }
  return null;
}

export function DrawingOverlay({ paneId, chart, series, container, ready }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingRef = useRef<{ time: number; price: number } | null>(null);
  const [draft, setDraft] = useState<{ time: number; price: number } | null>(null);
  const hoverRef = useRef<{ time: number; price: number } | null>(null);

  const drawings = useDeskStore((s) =>
    s.drawings.filter((d) => d.paneId === paneId)
  );
  const activeDrawTool = useDeskStore((s) => s.activeDrawTool);
  const addDrawing = useDeskStore((s) => s.addDrawing);
  const setActiveDrawTool = useDeskStore((s) => s.setActiveDrawTool);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !series || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const toXY = (time: number, price: number) => {
      const x = chart.timeScale().timeToCoordinate(time as Time);
      const y = series.priceToCoordinate(price);
      if (x == null || y == null) return null;
      return { x: x as number, y: y as number };
    };

    const paint = (d: ChartDrawing, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);

      if (d.tool === "hline" && d.points[0]) {
        const y = series.priceToCoordinate(d.points[0].price);
        if (y == null) return;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(
          d.label ?? d.points[0].price.toLocaleString(undefined, { maximumFractionDigits: 6 }),
          4,
          (y as number) - 3
        );
        return;
      }

      const p0 = d.points[0];
      const p1 = d.points[1];
      if (!p0 || !p1) return;
      const a = toXY(p0.time, p0.price);
      const b = toXY(p1.time, p1.price);
      if (!a || !b) return;

      if (d.tool === "trend") {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (d.tool === "rect") {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x);
        const rh = Math.abs(b.y - a.y);
        ctx.globalAlpha = alpha * 0.15;
        ctx.fillRect(x, y, rw, rh);
        ctx.globalAlpha = alpha;
        ctx.strokeRect(x, y, rw, rh);
      } else if (d.tool === "fib") {
        const hi = Math.max(p0.price, p1.price);
        const lo = Math.min(p0.price, p1.price);
        const span = hi - lo || 1;
        const x0 = Math.min(a.x, b.x);
        const x1 = Math.max(a.x, b.x);
        ctx.font = "10px ui-monospace, monospace";
        for (const lv of FIB_LEVELS) {
          const price = hi - span * lv;
          const y = series.priceToCoordinate(price);
          if (y == null) continue;
          ctx.beginPath();
          ctx.setLineDash(lv === 0 || lv === 1 ? [] : [4, 3]);
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText(`${lv} · ${price.toPrecision(6)}`, x0 + 2, (y as number) - 2);
        }
      } else if (d.tool === "measure") {
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const dPrice = p1.price - p0.price;
        const pct = p0.price !== 0 ? (dPrice / p0.price) * 100 : 0;
        const bars = Math.max(1, Math.round(Math.abs(p1.time - p0.time) / 60)); // rough minutes→bars proxy
        // better bar estimate via logical if possible
        let barCount = bars;
        try {
          const l0 = chart.timeScale().coordinateToLogical(a.x);
          const l1 = chart.timeScale().coordinateToLogical(b.x);
          if (l0 != null && l1 != null) {
            barCount = Math.max(1, Math.round(Math.abs(l1 - l0)));
          }
        } catch {
          /* */
        }
        const label =
          d.label ??
          `Δ ${dPrice >= 0 ? "+" : ""}${dPrice.toPrecision(5)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%) · ~${barCount} bar`;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.font = "11px ui-monospace, monospace";
        const tw = ctx.measureText(label).width;
        ctx.globalAlpha = alpha * 0.75;
        ctx.fillStyle = "#12161c";
        ctx.fillRect(mx - tw / 2 - 4, my - 14, tw + 8, 16);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = d.color;
        ctx.fillText(label, mx - tw / 2, my - 2);
      }
    };

    for (const d of drawings) paint(d);

    // draft preview
    const tool = activeDrawTool;
    if (tool !== "cursor" && pendingRef.current && hoverRef.current) {
      const preview: ChartDrawing = {
        id: "draft",
        paneId,
        tool: tool as Exclude<DrawTool, "cursor">,
        points: [pendingRef.current, hoverRef.current],
        color: DEFAULT_COLOR,
      };
      if (tool === "hline") {
        preview.points = [hoverRef.current];
      }
      paint(preview, 0.7);
    } else if (tool === "hline" && hoverRef.current) {
      paint(
        {
          id: "draft",
          paneId,
          tool: "hline",
          points: [hoverRef.current],
          color: DEFAULT_COLOR,
        },
        0.5
      );
    }

    ctx.globalAlpha = 1;
  }, [chart, series, container, drawings, activeDrawTool, paneId]);

  // canvas mount (re-attach if LWC wipes children)
  useEffect(() => {
    if (!container) return;

    const ensure = () => {
      let canvas = canvasRef.current;
      if (canvas && canvas.parentElement === container) return canvas;
      if (canvas) {
        try {
          canvas.remove();
        } catch {
          /* */
        }
      }
      canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "6";
      canvas.style.pointerEvents = "none";
      container.style.position = "relative";
      container.appendChild(canvas);
      canvasRef.current = canvas;
      return canvas;
    };

    ensure();
    drawAll();
    const mo = new MutationObserver(() => {
      if (!canvasRef.current || canvasRef.current.parentElement !== container) {
        ensure();
        drawAll();
      }
    });
    mo.observe(container, { childList: true });
    return () => {
      mo.disconnect();
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement === container) {
        try {
          canvas.remove();
        } catch {
          /* */
        }
      }
      if (canvasRef.current === canvas) canvasRef.current = null;
    };
  }, [container, ready, drawAll]);

  // redraw on scale / drawings change
  useEffect(() => {
    if (!chart) return;
    const onRange = () => drawAll();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    window.addEventListener("resize", onRange);
    const id = window.setInterval(drawAll, 500); // cheap sync if price scale changes
    drawAll();
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      } catch {
        /* */
      }
      window.removeEventListener("resize", onRange);
      clearInterval(id);
    };
  }, [chart, drawAll, drawings, ready]);

  // Escape cancels draft
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pendingRef.current = null;
        setDraft(null);
        hoverRef.current = null;
        setActiveDrawTool("cursor");
        drawAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setActiveDrawTool, drawAll]);

  // Click handler via LWC subscribeClick
  useEffect(() => {
    if (!chart || !series) return;

    const onClick = (param: MouseEventParams) => {
      const tool = useDeskStore.getState().activeDrawTool;
      if (tool === "cursor") return;
      if (!param.point) return;

      const rawPrice = series.coordinateToPrice(param.point.y);
      let time = timeToNumber(param.time ?? null);
      if (time == null) {
        const t = chart.timeScale().coordinateToTime(param.point.x);
        time = timeToNumber(t);
      }
      if (rawPrice == null || time == null) return;
      const price = Number(rawPrice);

      if (tool === "hline") {
        addDrawing({
          paneId,
          tool: "hline",
          points: [{ time, price }],
          color: DEFAULT_COLOR,
        });
        setActiveDrawTool("cursor");
        pendingRef.current = null;
        setDraft(null);
        return;
      }

      if (!pendingRef.current) {
        pendingRef.current = { time, price };
        setDraft({ time, price });
        return;
      }

      const p0 = pendingRef.current;
      const p1 = { time, price };
      let label: string | undefined;
      if (tool === "measure") {
        const dPrice = p1.price - p0.price;
        const pct = p0.price !== 0 ? (dPrice / p0.price) * 100 : 0;
        let barCount = 1;
        try {
          const a = chart.timeScale().timeToCoordinate(p0.time as Time);
          const b = chart.timeScale().timeToCoordinate(p1.time as Time);
          if (a != null && b != null) {
            const l0 = chart.timeScale().coordinateToLogical(a);
            const l1 = chart.timeScale().coordinateToLogical(b);
            if (l0 != null && l1 != null) {
              barCount = Math.max(1, Math.round(Math.abs(l1 - l0)));
            }
          }
        } catch {
          /* */
        }
        label = `Δ ${dPrice >= 0 ? "+" : ""}${dPrice.toPrecision(5)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%) · ~${barCount} bar`;
      }

      addDrawing({
        paneId,
        tool: tool as Exclude<DrawTool, "cursor">,
        points: [p0, p1],
        color: DEFAULT_COLOR,
        label,
      });
      pendingRef.current = null;
      setDraft(null);
      hoverRef.current = null;
      setActiveDrawTool("cursor");
    };

    const onMove = (param: MouseEventParams) => {
      const tool = useDeskStore.getState().activeDrawTool;
      if (tool === "cursor") return;
      if (!param.point) return;
      const rawPrice = series.coordinateToPrice(param.point.y);
      let time = timeToNumber(param.time ?? null);
      if (time == null) {
        const t = chart.timeScale().coordinateToTime(param.point.x);
        time = timeToNumber(t);
      }
      if (rawPrice == null || time == null) return;
      hoverRef.current = { time, price: Number(rawPrice) };
      drawAll();
    };

    chart.subscribeClick(onClick);
    chart.subscribeCrosshairMove(onMove);
    return () => {
      try {
        chart.unsubscribeClick(onClick);
        chart.unsubscribeCrosshairMove(onMove);
      } catch {
        /* */
      }
    };
  }, [chart, series, paneId, addDrawing, setActiveDrawTool, drawAll]);

  // pointer cursor hint when tool active
  useEffect(() => {
    if (!container) return;
    container.style.cursor =
      activeDrawTool === "cursor" ? "" : "crosshair";
    return () => {
      if (container) container.style.cursor = "";
    };
  }, [container, activeDrawTool]);

  // silence unused draft warning for future extensions
  void draft;

  return null;
}
