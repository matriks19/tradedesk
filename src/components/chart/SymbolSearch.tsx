"use client";

import { useEffect, useState, useRef } from "react";
import type { Exchange, SymbolInfo } from "@/lib/types";
import clsx from "clsx";

interface Props {
  symbol: string;
  exchange: Exchange;
  onSelect: (symbol: string, exchange: Exchange) => void;
}

export function SymbolSearch({ symbol, exchange, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SymbolInfo[]>([]);
  const [exFilter, setExFilter] = useState<Exchange | "all">("all");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (exFilter !== "all") params.set("exchange", exFilter);
      const res = await fetch(`/api/symbols?${params}`);
      const json = await res.json();
      setResults(json.symbols ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, exFilter]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        className="btn font-semibold tracking-wide"
        onClick={() => {
          setOpen(true);
          setQ("");
        }}
      >
        <span
          className={clsx(
            "text-2xs mr-1",
            exchange === "binance" ? "text-yellow-400" : "text-red-400"
          )}
        >
          {exchange === "binance" ? "BN" : "BIST"}
        </span>
        {symbol}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 panel shadow-xl p-2">
          <div className="flex gap-1 mb-2">
            {(["all", "binance", "bist"] as const).map((x) => (
              <button
                key={x}
                type="button"
                className={clsx(
                  "btn text-2xs",
                  exFilter === x && "btn-accent"
                )}
                onClick={() => setExFilter(x)}
              >
                {x === "all" ? "Tümü" : x === "binance" ? "Binance" : "BIST"}
              </button>
            ))}
          </div>
          <input
            autoFocus
            className="input mb-2"
            placeholder="Sembol ara… (BTC, THYAO)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto">
            {results.map((s) => (
              <button
                key={`${s.exchange}-${s.symbol}`}
                type="button"
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-desk-elevated rounded flex justify-between"
                onClick={() => {
                  onSelect(s.symbol, s.exchange);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{s.symbol}</span>
                <span className="text-desk-muted text-2xs">
                  {s.exchange === "bist" ? s.name ?? "BIST" : s.exchange}
                </span>
              </button>
            ))}
            {!results.length && (
              <div className="text-2xs text-desk-muted px-2 py-3">Sonuç yok</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
