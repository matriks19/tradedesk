"use client";

import { useEffect, useState } from "react";
import type { TickerQuote } from "@/lib/types";
import { useDeskStore } from "@/store/desk";
import clsx from "clsx";

export function HeatmapPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const [quotes, setQuotes] = useState<TickerQuote[]>([]);
  const [exchange, setExchange] = useState<"binance" | "bist">("binance");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/ticker?exchange=${exchange}`);
      const json = await res.json();
      let q: TickerQuote[] = json.quotes ?? [];
      if (exchange === "binance") {
        q = q
          .filter((x) => x.symbol.endsWith("USDT"))
          .sort((a, b) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
          .slice(0, 64);
      } else {
        q = q.slice(0, 48);
      }
      if (!cancelled) setQuotes(q);
    })();
    return () => {
      cancelled = true;
    };
  }, [exchange]);

  const max = Math.max(5, ...quotes.map((q) => Math.abs(q.changePct)));

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">Isı Haritası (%Δ)</div>
        <select
          className="input w-auto"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as "binance" | "bist")}
        >
          <option value="binance">Binance</option>
          <option value="bist">BIST</option>
        </select>
      </div>
      {exchange === "bist" && (
        <p className="text-2xs text-desk-warn">Gecikmeli / best-effort veriler</p>
      )}
      <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-1 content-start">
        {quotes.map((q) => {
          const intensity = Math.min(1, Math.abs(q.changePct) / max);
          const up = q.changePct >= 0;
          return (
            <button
              key={q.symbol}
              type="button"
              className="rounded p-1.5 text-left min-h-[52px] border border-black/20"
              style={{
                background: up
                  ? `rgba(38,166,154,${0.15 + intensity * 0.7})`
                  : `rgba(239,83,80,${0.15 + intensity * 0.7})`,
              }}
              onClick={() => openSymbolInActive(q.symbol, exchange)}
            >
              <div className="text-2xs font-semibold truncate">
                {q.symbol.replace(/USDT$/, "")}
              </div>
              <div
                className={clsx(
                  "font-mono text-2xs",
                  up ? "text-emerald-100" : "text-red-100"
                )}
              >
                {q.changePct >= 0 ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
