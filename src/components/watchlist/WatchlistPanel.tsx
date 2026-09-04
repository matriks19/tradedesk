"use client";

import { useEffect, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { TickerQuote } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import clsx from "clsx";

export function WatchlistPanel() {
  const {
    watchlists,
    activeWatchlistId,
    setActiveWatchlist,
    openSymbolInActive,
    removeWatchlistSymbol,
  } = useDeskStore();
  const list = watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
  const [quotes, setQuotes] = useState<Record<string, TickerQuote>>({});

  useEffect(() => {
    if (!list) return;
    let cancelled = false;
    const load = async () => {
      const byEx = {
        binance: list.symbols.filter((s) => s.exchange === "binance").map((s) => s.symbol),
        bist: list.symbols.filter((s) => s.exchange === "bist").map((s) => s.symbol),
      };
      const map: Record<string, TickerQuote> = {};
      if (byEx.binance.length) {
        const res = await fetch(
          `/api/ticker?exchange=binance&symbols=${byEx.binance.join(",")}`
        );
        const json = await res.json();
        for (const q of json.quotes ?? []) map[`${q.exchange}:${q.symbol}`] = q;
      }
      if (byEx.bist.length) {
        const res = await fetch(
          `/api/ticker?exchange=bist&symbols=${byEx.bist.join(",")}`
        );
        const json = await res.json();
        for (const q of json.quotes ?? []) map[`${q.exchange}:${q.symbol}`] = q;
      }
      if (!cancelled) setQuotes(map);
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [list]);

  if (!list) {
    return <div className="p-3 text-xs text-desk-muted">İzleme listesi yok</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 p-2 border-b border-desk-border overflow-x-auto">
        {watchlists.map((w) => (
          <button
            key={w.id}
            type="button"
            className={clsx(
              "btn whitespace-nowrap text-2xs",
              w.id === list.id && "btn-accent"
            )}
            onClick={() => setActiveWatchlist(w.id)}
          >
            {w.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-desk-panel text-desk-muted text-2xs">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium">Sembol</th>
              <th className="text-right px-2 py-1.5 font-medium">Fiyat</th>
              <th className="text-right px-2 py-1.5 font-medium">%Δ</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {list.symbols.map((s) => {
              const q = quotes[`${s.exchange}:${s.symbol}`];
              return (
                <tr
                  key={`${s.exchange}-${s.symbol}`}
                  className="hover:bg-desk-elevated cursor-pointer border-t border-desk-border/50"
                  onClick={() => openSymbolInActive(s.symbol, s.exchange)}
                >
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{s.symbol}</div>
                    <div className="text-2xs text-desk-muted">
                      {s.exchange}
                      {q?.delayed && (
                        <Badge tone="warn"> gecikmeli</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {q ? q.last.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-1.5 text-right font-mono",
                      (q?.changePct ?? 0) >= 0 ? "text-desk-up" : "text-desk-down"
                    )}
                  >
                    {q ? `${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="pr-1">
                    <button
                      type="button"
                      className="text-desk-muted hover:text-desk-down text-2xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWatchlistSymbol(list.id, s.symbol);
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
