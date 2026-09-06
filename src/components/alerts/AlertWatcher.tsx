"use client";

import { useEffect, useRef } from "react";
import { useDeskStore } from "@/store/desk";
import type { AlertCondition, Exchange, TickerQuote } from "@/lib/types";

function conditionMet(
  cond: AlertCondition,
  target: number,
  last: number,
  prev: number | undefined
): boolean {
  switch (cond) {
    case "above":
      return last >= target;
    case "below":
      return last <= target;
    case "cross_above":
      if (prev == null) return last >= target;
      return prev < target && last >= target;
    case "cross_below":
      if (prev == null) return last <= target;
      return prev > target && last <= target;
    default:
      return false;
  }
}

async function fetchQuotes(
  exchange: Exchange,
  symbols: string[]
): Promise<TickerQuote[]> {
  if (!symbols.length) return [];
  // Chunk — watchlists / bulk alarms may include many .P perps
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 80) {
    chunks.push(symbols.slice(i, i + 80));
  }
  const out: TickerQuote[] = [];
  for (const ch of chunks) {
    const res = await fetch(
      `/api/ticker?exchange=${exchange}&symbols=${ch.join(",")}`
    );
    const json = await res.json();
    out.push(...((json.quotes ?? []) as TickerQuote[]));
  }
  return out;
}

function alertText(a: {
  symbol: string;
  exchange: Exchange;
  condition: AlertCondition;
  price: number;
  note?: string;
}, last: number): string {
  const note = a.note ? ` · ${a.note}` : "";
  return `TradeDesk alarm: ${a.symbol} (${a.exchange}) · ${a.condition} ${a.price} · son ${last}${note}`;
}

export function AlertWatcher() {
  const firingRef = useRef<Set<string>>(new Set());
  const notifiedPerm = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const { alerts, botSettings, updateAlert } = useDeskStore.getState();
      const live = alerts.filter((a) => a.active && !a.triggeredAt);
      if (!live.length) return;

      const byEx: Record<Exchange, string[]> = { binance: [], bist: [] };
      for (const a of live) {
        if (!byEx[a.exchange].includes(a.symbol)) {
          byEx[a.exchange].push(a.symbol);
        }
      }

      const quotes: TickerQuote[] = [];
      try {
        const [b, t] = await Promise.all([
          fetchQuotes("binance", byEx.binance),
          fetchQuotes("bist", byEx.bist),
        ]);
        quotes.push(...b, ...t);
      } catch {
        return;
      }
      if (cancelled) return;

      const map = new Map(
        quotes.map((q) => [`${q.exchange}:${q.symbol}`, q] as const)
      );

      for (const a of live) {
        if (firingRef.current.has(a.id)) continue;
        const q = map.get(`${a.exchange}:${a.symbol}`);
        if (!q || !Number.isFinite(q.last)) continue;

        const prev = a.lastPrice;
        const met = conditionMet(a.condition, a.price, q.last, prev);

        // Always refresh lastPrice for cross detection
        if (!met) {
          if (prev !== q.last) {
            updateAlert(a.id, { lastPrice: q.last });
          }
          continue;
        }

        firingRef.current.add(a.id);
        const triggeredAt = Date.now();
        updateAlert(a.id, {
          active: false,
          triggeredAt,
          lastPrice: q.last,
        });

        const text = alertText(a, q.last);

        try {
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(`Alarm: ${a.symbol}`, {
              body: `${a.condition} ${a.price} · son ${q.last}`,
            });
          } else if (
            typeof Notification !== "undefined" &&
            Notification.permission === "default" &&
            !notifiedPerm.current
          ) {
            notifiedPerm.current = true;
            Notification.requestPermission().catch(() => {});
          }
        } catch {
          /* */
        }

        if (botSettings.enabled && botSettings.webhookUrl.trim()) {
          try {
            await fetch("/api/webhook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: botSettings.webhookUrl.trim(),
                telegramChatId: botSettings.telegramChatId?.trim() || undefined,
                payload: {
                  secret: botSettings.secret || undefined,
                  event: "price_alert",
                  symbol: a.symbol,
                  exchange: a.exchange,
                  condition: a.condition,
                  price: a.price,
                  last: q.last,
                  ts: triggeredAt,
                  note: a.note,
                  text,
                  message: text,
                },
              }),
            });
          } catch {
            /* */
          }
        }

        // allow re-fire only after user re-activates (id stays but triggeredAt set)
        firingRef.current.delete(a.id);
      }
    };

    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return null;
}
