"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle, Exchange, Timeframe } from "@/lib/types";
import { BinanceProvider } from "@/lib/data/binance";

export function useKlines(
  symbol: string,
  exchange: Exchange,
  timeframe: Timeframe
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delayed, setDelayed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/klines?symbol=${encodeURIComponent(symbol)}&exchange=${exchange}&timeframe=${timeframe}&limit=500`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kline hatası");
      setCandles(json.candles ?? []);
      setDelayed(!!json.delayed);
      setNote(json.note ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [symbol, exchange, timeframe]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (exchange !== "binance") return;
    wsRef.current?.close();
    const url = BinanceProvider.wsKlineUrl(symbol, timeframe);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const candle = BinanceProvider.parseKlineMessage(msg);
        if (!candle) return;
        setCandles((prev) => {
          if (!prev.length) return [candle];
          const last = prev[prev.length - 1];
          if (last.time === candle.time) {
            const next = prev.slice(0, -1);
            next.push(candle);
            return next;
          }
          if (candle.time > last.time) return [...prev, candle];
          return prev;
        });
      } catch {
        /* ignore */
      }
    };
    return () => {
      ws.close();
    };
  }, [symbol, exchange, timeframe]);

  return { candles, loading, error, delayed, note, reload: load };
}
