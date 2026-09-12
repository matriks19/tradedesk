"use client";

import { useEffect, useRef } from "react";
import { useDeskStore } from "@/store/desk";
import type {
  AlertCondition,
  Candle,
  Exchange,
  PriceAlert,
  TickerQuote,
} from "@/lib/types";
import { buildDeskOpenUrl } from "@/lib/deskLink";
import { checkScanAlert } from "@/lib/alerts/scanAlert";

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

function alertText(a: PriceAlert, last: number, extra = ""): string {
  const note = a.note ? ` · ${a.note}` : "";
  const scan = extra ? ` · ${extra}` : "";
  const priceBit =
    a.kind === "scan"
      ? a.scanKey ?? "scan"
      : `${a.condition} ${a.price}`;
  return `TradeDesk alarm: ${a.symbol} (${a.exchange}) · ${priceBit} · son ${last}${scan}${note}`;
}

export function AlertWatcher() {
  const firingRef = useRef<Set<string>>(new Set());
  const notifiedPerm = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fire = async (a: PriceAlert, last: number, extra = "") => {
      const now = Date.now();
      const repeat = a.repeat === "repeat";
      useDeskStore.getState().updateAlert(a.id, {
        active: repeat ? true : false,
        triggeredAt: now,
        lastFiredAt: now,
        lastPrice: last,
      });
      const pane = useDeskStore
        .getState()
        .panes.find((x) => x.id === useDeskStore.getState().activePaneId);
      const tf = a.timeframe || pane?.timeframe;
      const openUrl = buildDeskOpenUrl({
        origin: window.location.origin,
        symbol: a.symbol,
        exchange: a.exchange,
        timeframe: tf,
      });
      const text = `${alertText(a, last, extra)}\n${openUrl}`;
      try {
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          const ntf = new Notification(`Alarm: ${a.symbol}`, {
            body: extra || `${a.condition} ${a.price} · son ${last}`,
          });
          ntf.onclick = () => {
            window.focus();
            useDeskStore
              .getState()
              .openSymbolInActive(a.symbol, a.exchange, tf);
          };
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
      const bot = useDeskStore.getState().botSettings;
      if (bot.enabled && bot.webhookUrl.trim()) {
        try {
          await fetch("/api/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: bot.webhookUrl.trim(),
              telegramChatId: bot.telegramChatId?.trim() || undefined,
              payload: {
                secret: bot.secret || undefined,
                event: a.kind === "scan" ? "scan_alert" : "price_alert",
                symbol: a.symbol,
                exchange: a.exchange,
                condition: a.condition,
                price: a.price,
                last,
                ts: now,
                note: extra || a.note,
                text,
                message: text,
                openUrl,
                timeframe: tf,
                scanKey: a.scanKey,
                group: a.group,
              },
            }),
          });
        } catch {
          /* */
        }
      }
    };

    const tick = async () => {
      const { alerts, updateAlert } = useDeskStore.getState();
      const now = Date.now();
      for (const a of alerts) {
        if (a.active && a.expiresAt && now > a.expiresAt) {
          updateAlert(a.id, { active: false });
        }
      }
      const live = useDeskStore.getState().alerts.filter((a) => {
        if (!a.active) return false;
        if (a.expiresAt && now > a.expiresAt) return false;
        if (a.repeat === "repeat") {
          const cd = (a.cooldownMin ?? 60) * 60_000;
          if (a.lastFiredAt && now - a.lastFiredAt < cd) return false;
          return true;
        }
        return !a.triggeredAt;
      });
      if (!live.length) return;

      const priceLive = live.filter((a) => a.kind !== "scan");
      const scanLive = live.filter((a) => a.kind === "scan" && a.scanKey);

      if (priceLive.length) {
        const byEx: Record<Exchange, string[]> = { binance: [], bist: [] };
        for (const a of priceLive) {
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
          /* keep going for scan */
        }
        if (cancelled) return;
        const map = new Map(
          quotes.map((q) => [`${q.exchange}:${q.symbol}`, q] as const)
        );
        for (const a of priceLive) {
          if (firingRef.current.has(a.id)) continue;
          const q = map.get(`${a.exchange}:${a.symbol}`);
          if (!q || !Number.isFinite(q.last)) continue;
          const prev = a.lastPrice;
          const met = conditionMet(a.condition, a.price, q.last, prev);
          if (!met) {
            if (prev !== q.last) updateAlert(a.id, { lastPrice: q.last });
            continue;
          }
          firingRef.current.add(a.id);
          await fire(a, q.last);
          firingRef.current.delete(a.id);
        }
      }

      for (const a of scanLive) {
        if (cancelled) break;
        if (firingRef.current.has(a.id)) continue;
        const iv = (a.intervalMin ?? 15) * 60_000;
        if (a.lastCheckedAt && now - a.lastCheckedAt < iv) continue;
        updateAlert(a.id, { lastCheckedAt: Date.now() });
        firingRef.current.add(a.id);
        try {
          const tf = a.timeframe || "15m";
          const res = await fetch(
            `/api/klines?symbol=${encodeURIComponent(a.symbol)}&exchange=${a.exchange}&timeframe=${encodeURIComponent(tf)}&limit=220`
          );
          const json = await res.json();
          const candles = (json.candles ?? []) as Candle[];
          if (candles.length) {
            const hit = checkScanAlert(candles, a.scanKey!);
            const last = candles[candles.length - 1]!.close;
            if (hit.ok) await fire(a, last, hit.note);
          }
        } catch {
          /* */
        }
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
