"use client";

import { useCallback, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { Candle, Exchange, Timeframe } from "@/lib/types";
import { detectMacdCross } from "@/lib/scanner/macdScan";
import { detectRsiBreakFreshest } from "@/lib/scanner/rsiScan";
import { detectEliziEdgeCross } from "@/lib/scanner/eliziScan";
import { DEFAULT_MAX_BARS_AGO } from "@/lib/scanner/freshness";
import { fetchWatchlistQuotes } from "@/lib/scanner/watchlistQuotes";
import { mapPool } from "@/lib/scanner/engine";
import clsx from "clsx";

type Hit = {
  symbol: string;
  exchange: Exchange;
  kind: "macd" | "rsi" | "elizi";
  bias: "bull" | "bear";
  barsAgo: number;
  label: string;
};

/**
 * One-click active-watchlist oscillator scan + bulk alerts.
 * Used from Göstergeler menu and çizim/ölçü toolbar.
 */
export function ListScanActions({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const watchlists = useDeskStore((s) => s.watchlists);
  const activeWatchlistId = useDeskStore((s) => s.activeWatchlistId);
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const addAlertsBulk = useDeskStore((s) => s.addAlertsBulk);
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const setSidebarTab = useDeskStore((s) => s.setSidebarTab);

  const [running, setRunning] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState("");

  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const tf = (pane?.timeframe ?? "1h") as Timeframe;

  const runListScan = useCallback(async () => {
    const list =
      watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
    if (!list?.symbols.length) {
      setStatus("Aktif izleme listesi boş");
      return;
    }
    setRunning(true);
    setHits([]);
    setStatus("");
    try {
      const quotes = await fetchWatchlistQuotes(list.symbols);
      const out: Hit[] = [];
      await mapPool(quotes, 8, async (q) => {
        try {
          const kr = await fetch(
            `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${q.exchange}&timeframe=${tf}&limit=180`
          );
          const kj = await kr.json();
          const candles: Candle[] = kj.candles ?? [];
          if (candles.length < 50) return null;
          const macd = detectMacdCross(candles, {
            maxBarsAgo: DEFAULT_MAX_BARS_AGO,
          });
          if (macd) {
            out.push({
              symbol: q.symbol,
              exchange: q.exchange,
              kind: "macd",
              bias: macd.bias,
              barsAgo: macd.barsAgo,
              label: `MACD ${macd.bias === "bull" ? "AL" : "SAT"}`,
            });
          }
          const rsi = detectRsiBreakFreshest(candles, {
            maxBarsAgo: DEFAULT_MAX_BARS_AGO,
          });
          if (rsi) {
            out.push({
              symbol: q.symbol,
              exchange: q.exchange,
              kind: "rsi",
              bias: rsi.direction === "up" ? "bull" : "bear",
              barsAgo: rsi.barsAgo,
              label: `RSI ${rsi.labelTr}`,
            });
          }
          const elizi = detectEliziEdgeCross(candles, {
            maxBarsAgo: DEFAULT_MAX_BARS_AGO,
          });
          if (elizi) {
            out.push({
              symbol: q.symbol,
              exchange: q.exchange,
              kind: "elizi",
              bias: elizi.bias,
              barsAgo: elizi.barsAgo,
              label: `Elizi ${elizi.kind === "edge_cross" ? "±E" : "Ateş"} ${elizi.bias === "bull" ? "AL" : "SAT"}`,
            });
          }
        } catch {
          /* skip */
        }
        return null;
      });
      out.sort((a, b) => a.barsAgo - b.barsAgo || a.symbol.localeCompare(b.symbol));
      setHits(out);
      setStatus(
        `${out.length} sinyal · ${list.symbols.length} sembol · ${tf} · ≤${DEFAULT_MAX_BARS_AGO} bar`
      );
      setSidebarTab("patterns");
    } finally {
      setRunning(false);
    }
  }, [watchlists, activeWatchlistId, tf, setSidebarTab]);

  const bulkAlerts = useCallback(async () => {
    if (!hits.length) {
      setStatus("Önce Listeyi tara");
      return;
    }
    const byEx = new Map<Exchange, string[]>();
    for (const h of hits) {
      const arr = byEx.get(h.exchange) ?? [];
      if (!arr.includes(h.symbol)) arr.push(h.symbol);
      byEx.set(h.exchange, arr);
    }
    const items: Parameters<typeof addAlertsBulk>[0] = [];
    for (const [ex, syms] of byEx) {
      const res = await fetch(
        `/api/ticker?exchange=${ex}&symbols=${syms.join(",")}`
      );
      const json = await res.json();
      const by = new Map<string, number>();
      for (const q of json.quotes ?? []) {
        if (q?.symbol && Number.isFinite(q.last)) by.set(q.symbol, Number(q.last));
      }
      for (const sym of syms) {
        const last = by.get(sym);
        if (last == null) continue;
        items.push({
          symbol: sym,
          exchange: ex,
          condition: "cross_above",
          price: Number((last * 1.03).toFixed(4)),
          note: "liste tarama +%3",
          lastPrice: last,
        });
      }
    }
    const n = addAlertsBulk(items);
    setStatus(`${n} alarm eklendi (+%3)`);
  }, [hits, addAlertsBulk]);

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <div className="flex flex-wrap gap-1 items-center">
        <button
          type="button"
          className="btn-accent text-2xs"
          disabled={running}
          title={`Aktif izleme listesini tara (MACD/RSI/Elizi · ${tf} · ≤${DEFAULT_MAX_BARS_AGO} bar)`}
          onClick={() => void runListScan()}
        >
          {running ? "Taranıyor…" : "Listeyi tara"}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={!hits.length}
          title="Tarama sonuçlarına toplu +%3 alarm"
          onClick={() => void bulkAlerts()}
        >
          Toplu alarm
        </button>
        {status && (
          <span className="text-2xs text-desk-muted truncate">{status}</span>
        )}
      </div>
      {!compact && hits.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-desk-border/40 rounded">
          {hits.slice(0, 40).map((h, i) => (
            <button
              key={`${h.symbol}_${h.kind}_${h.barsAgo}_${i}`}
              type="button"
              className="w-full text-left px-2 py-1 text-2xs border-b border-desk-border/30 hover:bg-desk-elevated flex gap-2"
              onClick={() => openSymbolInActive(h.symbol, h.exchange, tf)}
            >
              <span className="font-medium">{h.symbol}</span>
              <span
                className={
                  h.bias === "bull" ? "text-desk-up" : "text-desk-down"
                }
              >
                {h.bias === "bull" ? "Bull" : "Bear"}
              </span>
              <span className="text-desk-muted flex-1 truncate">{h.label}</span>
              <span className="font-mono">{h.barsAgo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
