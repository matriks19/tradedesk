"use client";

import { useState } from "react";
import type { ScannerFilter, ScannerRow } from "@/lib/scanner/engine";
import { matchFilters } from "@/lib/scanner/engine";
import { useDeskStore } from "@/store/desk";
import type { Candle, TickerQuote } from "@/lib/types";
import clsx from "clsx";

export function ScannerPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ScannerRow[]>([]);
  const [preset, setPreset] = useState<string>("rsi_oversold");
  const [exchange, setExchange] = useState<"binance" | "bist">("binance");

  const presets: Record<string, { label: string; filters: ScannerFilter[] }> = {
    rsi_oversold: {
      label: "RSI < 30",
      filters: [{ type: "rsi", op: "lt", value: 30 }],
    },
    rsi_overbought: {
      label: "RSI > 70",
      filters: [{ type: "rsi", op: "gt", value: 70 }],
    },
    gainers: {
      label: "%Δ > 5",
      filters: [{ type: "changePct", op: "gt", value: 5 }],
    },
    losers: {
      label: "%Δ < -5",
      filters: [{ type: "changePct", op: "lt", value: -5 }],
    },
    vol_spike: {
      label: "Hacim x2",
      filters: [{ type: "volumeSpike", mult: 2 }],
    },
    ema_bull: {
      label: "EMA↑ kesişim",
      filters: [{ type: "emaCross", direction: "bull" }],
    },
  };

  const run = async () => {
    setRunning(true);
    setRows([]);
    try {
      const filters = presets[preset].filters;
      const tickerRes = await fetch(`/api/ticker?exchange=${exchange}`);
      const tickerJson = await tickerRes.json();
      let quotes: TickerQuote[] = tickerJson.quotes ?? [];
      // Limit scan universe for performance
      if (exchange === "binance") {
        quotes = quotes
          .filter((q) => q.symbol.endsWith("USDT"))
          .sort((a, b) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
          .slice(0, 80);
      } else {
        quotes = quotes.slice(0, 40);
      }

      const needsCandles = filters.some(
        (f) => f.type === "rsi" || f.type === "volumeSpike" || f.type === "emaCross"
      );

      const out: ScannerRow[] = [];
      const batch = quotes.slice(0, needsCandles ? 40 : quotes.length);

      for (const q of batch) {
        let candles: Candle[] | null = null;
        if (needsCandles) {
          try {
            const kr = await fetch(
              `/api/klines?symbol=${q.symbol}&exchange=${exchange}&timeframe=1h&limit=120`
            );
            const kj = await kr.json();
            candles = kj.candles ?? null;
          } catch {
            candles = null;
          }
        }
        const m = matchFilters(q, candles, filters);
        if (m.ok) {
          out.push({
            symbol: q.symbol,
            exchange,
            last: q.last,
            changePct: q.changePct,
            rsi: m.rsi,
            note: m.note,
          });
        }
      }
      setRows(out.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Tarayıcı (Scanner)</div>
      <div className="flex gap-1 flex-wrap">
        <select
          className="input w-auto"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as "binance" | "bist")}
        >
          <option value="binance">Binance USDT</option>
          <option value="bist">BIST (best-effort)</option>
        </select>
        <select
          className="input flex-1"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        >
          {Object.entries(presets).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn-accent" disabled={running} onClick={run}>
          {running ? "Taranıyor…" : "Tara"}
        </button>
      </div>
      {exchange === "bist" && (
        <p className="text-2xs text-desk-warn">
          BIST taraması gecikmeli public kaynaktan; sonuçlar canlı değildir.
        </p>
      )}
      <div className="flex-1 overflow-y-auto">
        {rows.map((r) => (
          <button
            key={r.symbol}
            type="button"
            className="w-full text-left px-2 py-1.5 border-b border-desk-border/40 hover:bg-desk-elevated"
            onClick={() => openSymbolInActive(r.symbol, r.exchange)}
          >
            <div className="flex justify-between text-xs">
              <span className="font-medium">{r.symbol}</span>
              <span
                className={clsx(
                  "font-mono",
                  r.changePct >= 0 ? "text-desk-up" : "text-desk-down"
                )}
              >
                {r.changePct >= 0 ? "+" : ""}
                {r.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="text-2xs text-desk-muted">{r.note}</div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            Filtre seçip Tara — sonuçlar grafikte açılır.
          </div>
        )}
      </div>
    </div>
  );
}
