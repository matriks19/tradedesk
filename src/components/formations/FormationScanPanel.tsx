"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { Candle, Exchange, Timeframe, TickerQuote } from "@/lib/types";
import {
  detectAdvanced,
  type AdvancedPatternFamily,
  type AdvancedPatternHit,
  toPatternHit,
} from "@/lib/patterns/advanced";
import { mapPool } from "@/lib/scanner/engine";
import { useDeskStore } from "@/store/desk";

const FAMILY_OPTS: { id: AdvancedPatternFamily; label: string }[] = [
  { id: "harmonic", label: "Harmonik" },
  { id: "candle", label: "Mum" },
  { id: "liquidity", label: "Likidite" },
  { id: "structure", label: "Yapı BOS/CHOCH" },
];

export function FormationScanPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);
  const setPatternFocus = useDeskStore((s) => s.setPatternFocus);
  const setSidebarTab = useDeskStore((s) => s.setSidebarTab);

  const [exchange, setExchange] = useState<Exchange>("binance");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [families, setFamilies] = useState<AdvancedPatternFamily[]>([
    "harmonic",
    "candle",
    "liquidity",
  ]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<(AdvancedPatternHit & { symbol: string; exchange: Exchange })[]>([]);
  const [status, setStatus] = useState("");

  const toggleFamily = (id: AdvancedPatternFamily) => {
    setFamilies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const run = useCallback(async () => {
    if (!families.length) {
      setStatus("En az bir formasyon ailesi seçin");
      return;
    }
    setRunning(true);
    setRows([]);
    setStatus("");
    try {
      const tickerRes = await fetch(
        `/api/ticker?exchange=${exchange}${exchange === "bist" ? "&limit=160" : ""}`
      );
      const tickerJson = await tickerRes.json();
      let quotes: TickerQuote[] = tickerJson.quotes ?? [];
      if (exchange === "bist" && quotes.length === 0) {
        setStatus(
          tickerJson.note ||
            "BIST kotasyonları boş — Yahoo rate-limit. Formasyon taraması için kotasyon gerekli."
        );
        return;
      }
      if (exchange === "binance") {
        quotes = quotes
          .filter((q) => q.symbol.endsWith("USDT"))
          .sort((a, b) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
          .slice(0, 120);
      } else {
        quotes = [...quotes]
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, 100);
      }
      setProgress({ done: 0, total: quotes.length });
      const out: (AdvancedPatternHit & { symbol: string; exchange: Exchange })[] = [];
      await mapPool(
        quotes,
        8,
        async (q) => {
          try {
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${exchange}&timeframe=${timeframe}&limit=220`
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < 40) return null;
            const hits = detectAdvanced(candles, { families });
            for (const h of hits.slice(0, 3)) {
              out.push({ ...h, symbol: q.symbol, exchange });
            }
          } catch {
            /* skip */
          }
          return null;
        },
        (done, total) => setProgress({ done, total })
      );
      out.sort((a, b) => b.confidence - a.confidence);
      setRows(out.slice(0, 80));
      setStatus(`${out.length} formasyon · ${quotes.length} sembol`);
    } finally {
      setRunning(false);
    }
  }, [exchange, timeframe, families]);

  const openHit = (h: AdvancedPatternHit & { symbol: string; exchange: Exchange }) => {
    openSymbolInActive(h.symbol, h.exchange);
    const ph = toPatternHit(h);
    setOverlayPattern(ph);
    setPatternFocus(ph.id);
    setSidebarTab("patterns");
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Formasyon Tarama</div>
      <p className="text-2xs text-desk-muted">
        Harmonik (Gartley/Bat/…), mum formasyonları, likidite grab / BOS. Sonuç tıklanınca
        grafikte XABCD + PRZ + TP/SL çizilir.
      </p>
      <div className="flex gap-1 flex-wrap">
        <select
          className="input w-auto"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as Exchange)}
        >
          <option value="binance">Binance top ~120</option>
          <option value="bist">BIST likit ~100</option>
        </select>
        <select
          className="input w-auto"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
        >
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
          <option value="1d">1d</option>
        </select>
        <button type="button" className="btn-accent" disabled={running} onClick={run}>
          {running ? `${progress.done}/${progress.total}` : "Tara"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {FAMILY_OPTS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={clsx("btn text-2xs", families.includes(f.id) && "btn-accent")}
            onClick={() => toggleFamily(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {status && <p className="text-2xs text-desk-muted">{status}</p>}
      {running && (
        <div className="h-1 bg-desk-border rounded overflow-hidden">
          <div
            className="h-full bg-desk-accent transition-all"
            style={{
              width: `${progress.total ? (100 * progress.done) / progress.total : 0}%`,
            }}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 px-2 py-1 text-2xs text-desk-muted border-b border-desk-border/40 sticky top-0 bg-desk-bg">
          <span>Sembol / Formasyon</span>
          <span>Yön</span>
          <span>Conf</span>
        </div>
        {rows.map((r) => (
          <button
            key={`${r.symbol}_${r.id}`}
            type="button"
            className="w-full text-left px-2 py-1.5 border-b border-desk-border/40 hover:bg-desk-elevated"
            onClick={() => openHit(r)}
          >
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-xs items-center">
              <span className="truncate">
                <span className="font-medium">{r.symbol}</span>{" "}
                <span className="text-desk-muted">{r.label}</span>
              </span>
              <span
                className={clsx(
                  "text-2xs",
                  r.direction === "bull" && "text-desk-up",
                  r.direction === "bear" && "text-desk-down"
                )}
              >
                {r.direction}
              </span>
              <span className="font-mono text-2xs">{(r.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="text-2xs text-desk-muted font-mono truncate">
              {r.entry != null ? `E ${fmt(r.entry)}` : ""}
              {r.prz ? ` · PRZ ${fmt(r.prz.low)}-${fmt(r.prz.high)}` : ""}
              {r.tp1 != null ? ` · TP1 ${fmt(r.tp1)}` : ""}
              {r.sl != null ? ` · SL ${fmt(r.sl)}` : ""}
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            Aile seçip Tara — paralel mum + offline dedektör.
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}
