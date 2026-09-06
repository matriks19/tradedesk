"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import { useDeskStore } from "@/store/desk";
import type { Candle, ChartDrawing, DrawTool } from "@/lib/types";

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const DEFAULT_COLOR = "#f5a623";
const MARKER_COLOR = "#00e5ff";

interface Props {
  paneId: string;
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  container: HTMLDivElement | null;
  ready: number;
  /** Pane candles — used to magnet-snap draw points to wick tips (high/low). */
  candles: Candle[];
}

function timeToNumber(t: Time | null | undefined): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t;
  if (typeof t === "object" && "year" in t) {
    return Math.floor(Date.UTC(t.year, t.month - 1, t.day) / 1000);
  }
  return null;
}

/** Binary search: candle with time closest to `time`. */
function findNearestCandle(candles: Candle[], time: number): Candle | null {
  if (!candles.length) return null;
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  let best = candles[lo];
  if (lo > 0) {
    const prev = candles[lo - 1];
    if (Math.abs(prev.time - time) < Math.abs(best.time - time)) best = prev;
  }
  // Also check lo+1 if we landed on first >= and next might be closer (edge)
  if (lo + 1 < candles.length) {
    const next = candles[lo + 1];
    if (Math.abs(next.time - time) < Math.abs(best.time - time)) best = next;
  }
  return best;
}

/**
 * Snap raw price to candle wick tips (high/low = "uçlar").
 * Fib always magnets to H/L. Other tools prefer H/L; if click is far from both
 * tips (>~30% of range), allow open/close as fallback.
 */
function snapToCandleWick(
  candle: Candle,
  rawPrice: number,
  tool: DrawTool
): number {
  const { high, low, open, close } = candle;
  const distH = Math.abs(rawPrice - high);
  const distL = Math.abs(rawPrice - low);
  const nearestTip = distH <= distL ? high : low;
  const tipDist = Math.min(distH, distL);

  // Fib (and hline for consistency): always wick tips
  if (tool === "fib" || tool === "hline") {
    return nearestTip;
  }

  const range = high - low;
  if (range <= 0) return nearestTip;

  // Prefer uçlar when within ~30% of candle range of a tip
  if (tipDist <= range * 0.3) {
    return nearestTip;
  }

  // Otherwise closest of OHLC (still often a tip if click is extreme)
  let best = high;
  let bestDist = distH;
  for (const p of [low, open, close]) {
    const d = Math.abs(rawPrice - p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Fib: snap to the extreme high/low of a local swing window around the click.
 * Prefer the intended swing wick rather than a neighboring bar's tip.
 * Window: ±3 bars from nearest candle; choose high if click is in upper half
 * of the local range, else low (stable swing high/low).
 */
function snapFibToSwing(
  candles: Candle[],
  time: number,
  rawPrice: number
): { time: number; price: number } {
  if (!candles.length) return { time, price: rawPrice };
  let idx = 0;
  let bestDist = Math.abs(candles[0]!.time - time);
  for (let i = 1; i < candles.length; i++) {
    const d = Math.abs(candles[i]!.time - time);
    if (d < bestDist) {
      bestDist = d;
      idx = i;
    }
  }
  const WIN = 3;
  const lo = Math.max(0, idx - WIN);
  const hi = Math.min(candles.length - 1, idx + WIN);
  let swingHigh = candles[lo]!;
  let swingLow = candles[lo]!;
  for (let i = lo; i <= hi; i++) {
    const c = candles[i]!;
    if (c.high >= swingHigh.high) swingHigh = c;
    if (c.low <= swingLow.low) swingLow = c;
  }
  const mid = (swingHigh.high + swingLow.low) / 2;
  // Prefer extreme matching click side; ties → closer tip by price
  if (rawPrice >= mid) {
    return { time: swingHigh.time, price: swingHigh.high };
  }
  return { time: swingLow.time, price: swingLow.low };
}

/** Resolve click/crosshair to snapped {time, price} on nearest candle wicks. */
function snapDrawPoint(
  candles: Candle[],
  time: number,
  rawPrice: number,
  tool: DrawTool
): { time: number; price: number } {
  if (tool === "fib") {
    return snapFibToSwing(candles, time, rawPrice);
  }
  const candle = findNearestCandle(candles, time);
  if (!candle) return { time, price: rawPrice };
  return {
    time: candle.time,
    price: snapToCandleWick(candle, rawPrice, tool),
  };
}

export function DrawingOverlay({ paneId, chart, series, container, ready, candles }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<HTMLCanvasElement | null>(null);
  const pendingRef = useRef<{ time: number; price: number } | null>(null);
  const [draft, setDraft] = useState<{ time: number; price: number } | null>(null);
  const [statusFlash, setStatusFlash] = useState<string | null>(null);
  const hoverRef = useRef<{ time: number; price: number } | null>(null);
  /** Live ticks must not re-bind subscribeClick — read latest candles via ref. */
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const lastClickAtRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);

  const drawings = useDeskStore((s) =>
    s.drawings.filter((d) => d.paneId === paneId)
  );
  const activeDrawTool = useDeskStore((s) => s.activeDrawTool);
  const addDrawing = useDeskStore((s) => s.addDrawing);
  const setActiveDrawTool = useDeskStore((s) => s.setActiveDrawTool);

  const flashStatus = useCallback((msg: string) => {
    setStatusFlash(msg);
    if (statusTimerRef.current != null) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => {
      setStatusFlash(null);
      statusTimerRef.current = null;
    }, 1600);
  }, []);

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

    const ts = chart.timeScale();
    const MIN_FIB_SPAN_PX = 72;

    /** Map time → x; extrapolate / clamp when off-screen so drawings stay fixed. */
    const timeToX = (time: number): number | null => {
      const direct = ts.timeToCoordinate(time as Time);
      if (direct != null) return direct as number;

      const visible = ts.getVisibleRange();
      if (visible && typeof visible.from === "number" && typeof visible.to === "number") {
        if (time < (visible.from as number)) return 0;
        if (time > (visible.to as number)) return w;
      }

      // Extrapolate via logical indices of nearby visible bars
      const logical = ts.getVisibleLogicalRange();
      if (logical) {
        const fromX = ts.logicalToCoordinate(logical.from as never);
        const toX = ts.logicalToCoordinate(logical.to as never);
        const fromT = ts.coordinateToTime(fromX as number);
        const toT = ts.coordinateToTime(toX as number);
        const t0 = timeToNumber(fromT);
        const t1 = timeToNumber(toT);
        if (
          fromX != null &&
          toX != null &&
          t0 != null &&
          t1 != null &&
          t1 !== t0
        ) {
          const ratio = (time - t0) / (t1 - t0);
          return (fromX as number) + ratio * ((toX as number) - (fromX as number));
        }
      }

      // Last resort: clamp left/right from visible time range if available
      if (visible && typeof visible.from === "number" && typeof visible.to === "number") {
        const mid = ((visible.from as number) + (visible.to as number)) / 2;
        return time < mid ? 0 : w;
      }
      return null;
    };

    const priceToY = (price: number): number | null => {
      const y = series.priceToCoordinate(price);
      return y == null ? null : (y as number);
    };

    const toXY = (time: number, price: number) => {
      const x = ts.timeToCoordinate(time as Time);
      const y = series.priceToCoordinate(price);
      if (x == null || y == null) return null;
      return { x: x as number, y: y as number };
    };

    const paintMarker = (time: number, price: number, color = MARKER_COLOR) => {
      const x = timeToX(time);
      const y = priceToY(price);
      if (x == null || y == null) return;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      // bright circle
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 229, 255, 0.25)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // crosshair
      const arm = 10;
      ctx.beginPath();
      ctx.moveTo(x - arm, y);
      ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm);
      ctx.lineTo(x, y + arm);
      ctx.stroke();
      ctx.restore();
    };

    const paint = (d: ChartDrawing, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);

      if (d.tool === "hline" && d.points[0]) {
        const y = priceToY(d.points[0].price);
        if (y == null) return;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(
          d.label ?? d.points[0].price.toLocaleString(undefined, { maximumFractionDigits: 6 }),
          4,
          y - 3
        );
        return;
      }

      const p0 = d.points[0];
      const p1 = d.points[1];
      if (!p0 || !p1) return;

      // Fib: independent x/y mapping — never drop whole drawing when one anchor is off-screen
      if (d.tool === "fib") {
        const x0 = timeToX(p0.time);
        const x1 = timeToX(p1.time);
        if (x0 == null || x1 == null) return;
        let xLeft = Math.min(x0, x1);
        let xRight = Math.max(x0, x1);
        if (xRight - xLeft < MIN_FIB_SPAN_PX) {
          xRight = xLeft + MIN_FIB_SPAN_PX;
        }
        // TradingView-style: extend levels to the right edge of the chart
        xRight = Math.max(xRight, w - 8);
        xLeft = Math.max(0, Math.min(xLeft, w - MIN_FIB_SPAN_PX));

        ctx.font = "10px ui-monospace, monospace";
        for (const lv of FIB_LEVELS) {
          // Click-order: level 0 = first click, 1 = second click
          const price = p0.price + (p1.price - p0.price) * lv;
          const y = priceToY(price);
          if (y == null) continue;
          ctx.beginPath();
          ctx.setLineDash(lv === 0 || lv === 1 ? [] : [4, 3]);
          ctx.moveTo(xLeft, y);
          ctx.lineTo(xRight, y);
          ctx.stroke();
          ctx.setLineDash([]);
          const labelY = Math.max(10, Math.min(h - 4, y - 2));
          ctx.fillText(`${lv} · ${price.toPrecision(6)}`, xLeft + 4, labelY);
        }
        return;
      }

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
    const pending = pendingRef.current;
    if (tool !== "cursor" && pending && hoverRef.current) {
      const preview: ChartDrawing = {
        id: "draft",
        paneId,
        tool: tool as Exclude<DrawTool, "cursor">,
        points: [pending, hoverRef.current],
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

    // First-point always visible while waiting for second click (even with no hover yet)
    if (tool !== "cursor" && tool !== "hline" && pending) {
      paintMarker(pending.time, pending.price);
      ctx.globalAlpha = 1;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      const banner =
        tool === "fib"
          ? "Fib: 2. nokta için tıkla (Esc iptal)"
          : `${tool}: 2. nokta için tıkla (Esc iptal)`;
      const tw = ctx.measureText(banner).width;
      ctx.fillStyle = "rgba(18, 22, 28, 0.85)";
      ctx.fillRect(6, 6, tw + 14, 22);
      ctx.strokeStyle = MARKER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(6, 6, tw + 14, 22);
      ctx.fillStyle = MARKER_COLOR;
      ctx.fillText(banner, 13, 21);
    }

    if (statusFlash) {
      ctx.globalAlpha = 1;
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      const tw = ctx.measureText(statusFlash).width;
      const y0 = pending && tool !== "cursor" && tool !== "hline" ? 34 : 6;
      ctx.fillStyle = "rgba(18, 22, 28, 0.9)";
      ctx.fillRect(6, y0, tw + 14, 22);
      ctx.strokeStyle = "#7CFC98";
      ctx.lineWidth = 1;
      ctx.strokeRect(6, y0, tw + 14, 22);
      ctx.fillStyle = "#7CFC98";
      ctx.fillText(statusFlash, 13, y0 + 15);
    }

    ctx.globalAlpha = 1;
  }, [chart, series, container, drawings, activeDrawTool, paneId, draft, statusFlash]);

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
      // re-append capture if LWC wiped it
      const cap = captureRef.current;
      if (cap && cap.parentElement !== container && container.contains(canvasRef.current!)) {
        container.appendChild(cap);
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
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(onRange);
    try {
      ts.subscribeVisibleTimeRangeChange(onRange);
    } catch {
      /* older LWC builds */
    }
    window.addEventListener("resize", onRange);
    const id = window.setInterval(drawAll, 500); // cheap sync if price scale changes
    drawAll();
    return () => {
      try {
        ts.unsubscribeVisibleLogicalRangeChange(onRange);
      } catch {
        /* */
      }
      try {
        ts.unsubscribeVisibleTimeRangeChange(onRange);
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

  // Clear pending when switching tools (do NOT depend on drawAll — first click sets draft)
  const prevToolRef = useRef(activeDrawTool);
  useEffect(() => {
    if (prevToolRef.current === activeDrawTool) return;
    prevToolRef.current = activeDrawTool;
    pendingRef.current = null;
    setDraft(null);
    hoverRef.current = null;
    drawAll();
  }, [activeDrawTool, drawAll]);

  const handleDrawPoint = useCallback(
    (rawTime: number, rawPrice: number) => {
      const tool = useDeskStore.getState().activeDrawTool;
      if (tool === "cursor") return;
      if (!chart || !series) return;

      const now = performance.now();
      if (now - lastClickAtRef.current < 50) return; // dedupe LWC + pointer
      lastClickAtRef.current = now;

      const snapped = snapDrawPoint(candlesRef.current, rawTime, rawPrice, tool);
      const { time: snapTime, price } = snapped;

      if (tool === "hline") {
        addDrawing({
          paneId,
          tool: "hline",
          points: [{ time: snapTime, price }],
          color: DEFAULT_COLOR,
          origin: "user",
        });
        setActiveDrawTool("cursor");
        pendingRef.current = null;
        setDraft(null);
        flashStatus("Yatay çizgi eklendi");
        return;
      }

      if (!pendingRef.current) {
        pendingRef.current = { time: snapTime, price };
        setDraft({ time: snapTime, price });
        drawAll();
        return;
      }

      const p0 = pendingRef.current;
      const p1 = { time: snapTime, price };

      // Reject zero-height fib (identical price) — keep pending for another click
      if (tool === "fib") {
        const mid = (Math.abs(p0.price) + Math.abs(p1.price)) / 2 || 1;
        if (Math.abs(p1.price - p0.price) / mid < 1e-6) {
          return;
        }
      }

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
        origin: "user",
      });
      pendingRef.current = null;
      setDraft(null);
      hoverRef.current = null;
      setActiveDrawTool("cursor");
      if (tool === "fib") flashStatus("Fibonacci eklendi (önceki auto Fib temizlendi)");
      else flashStatus("Çizim eklendi");
    },
    [chart, series, paneId, addDrawing, setActiveDrawTool, drawAll, flashStatus]
  );

  // Click handler via LWC subscribeClick — do NOT depend on candles (live ticks)
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
      handleDrawPoint(time, Number(rawPrice));
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
      // Preview also snaps so Fib draft matches final wick tips
      hoverRef.current = snapDrawPoint(candlesRef.current, time, Number(rawPrice), tool);
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
  }, [chart, series, handleDrawPoint, drawAll]);

  // Pointer capture fallback — reliable on mobile / when LWC click is silent
  useEffect(() => {
    if (!container || !chart || !series) return;

    const removeCapture = () => {
      const cap = captureRef.current;
      if (cap) {
        try {
          cap.remove();
        } catch {
          /* */
        }
      }
      captureRef.current = null;
    };

    if (activeDrawTool === "cursor") {
      removeCapture();
      return;
    }

    let cap = captureRef.current;
    if (!cap || cap.parentElement !== container) {
      removeCapture();
      cap = document.createElement("canvas");
      cap.style.position = "absolute";
      cap.style.inset = "0";
      cap.style.width = "100%";
      cap.style.height = "100%";
      cap.style.zIndex = "7";
      cap.style.pointerEvents = "auto";
      cap.style.cursor = "crosshair";
      cap.style.background = "transparent";
      container.style.position = "relative";
      container.appendChild(cap);
      captureRef.current = cap;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const t = chart.timeScale().coordinateToTime(x);
      const time = timeToNumber(t);
      const rawPrice = series.coordinateToPrice(y);
      if (time == null || rawPrice == null) return;
      handleDrawPoint(time, Number(rawPrice));
    };

    const onPointerMove = (e: PointerEvent) => {
      const tool = useDeskStore.getState().activeDrawTool;
      if (tool === "cursor") return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const t = chart.timeScale().coordinateToTime(x);
      const time = timeToNumber(t);
      const rawPrice = series.coordinateToPrice(y);
      if (time == null || rawPrice == null) return;
      hoverRef.current = snapDrawPoint(candlesRef.current, time, Number(rawPrice), tool);
      drawAll();
    };

    cap.addEventListener("pointerdown", onPointerDown);
    cap.addEventListener("pointermove", onPointerMove);
    return () => {
      cap?.removeEventListener("pointerdown", onPointerDown);
      cap?.removeEventListener("pointermove", onPointerMove);
      // keep capture node until tool switches to cursor (cleanup below on tool change)
      if (useDeskStore.getState().activeDrawTool === "cursor") removeCapture();
    };
  }, [container, chart, series, activeDrawTool, ready, handleDrawPoint, drawAll]);

  // cleanup capture + status timer on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current != null) window.clearTimeout(statusTimerRef.current);
      const cap = captureRef.current;
      if (cap) {
        try {
          cap.remove();
        } catch {
          /* */
        }
      }
      captureRef.current = null;
    };
  }, []);

  // pointer cursor hint when tool active
  useEffect(() => {
    if (!container) return;
    container.style.cursor =
      activeDrawTool === "cursor" ? "" : "crosshair";
    return () => {
      if (container) container.style.cursor = "";
    };
  }, [container, activeDrawTool]);

  return null;
}
