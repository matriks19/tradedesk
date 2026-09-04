"use client";

import { useCallback, useMemo, useState } from "react";
import type { ScannerFilter, ScannerRow } from "@/lib/scanner/engine";
import {
  SCANNER_PRESETS,
  filtersNeedCandles,
  mapPool,
  matchFilters,
} from "@/lib/scanner/engine";
import { useDeskStore } from "@/store/desk";
import type { Candle, Timeframe, TickerQuote } from "@/lib/types";
import clsx from "clsx";

type SortKey = "rsi" | "changePct" | "volume" | "symbol";

const FILTER_CHIPS: { id: string; label: string; filter: ScannerFilter }[] = [
  { id: "rsi30", label: "RSI<30", filter: { type: "rsi", op: "lt", value: 30 } },
  { id: "rsi70", label: "RSI>70", filter: { type: "rsi", op: "gt", value: 70 } },
  { id: "macd_b", label: "MACD↑", filter: { type: "macdCross", direction: "bull" } },
  { id: "ema_b", label: "EMA↑", filter: { type: "emaCross", direction: "bull" } },
  { id: "bb_sq", label: "BB sıkışma", filter: { type: "bbSqueeze" } },
  { id: "bb_up", label: "BB↑", filter: { type: "bbBreak", side: "upper" } },
  { id: "st_b", label: "ST↑", filter: { type: "supertrendFlip", direction: "bull" } },
  { id: "vol2", label: "Vol×2", filter: { type: "volumeSpike", mult: 2 } },
  { id: "stoch_os", label: "Stoch OS", filter: { type: "stoch", zone: "oversold" } },
  { id: "hod", label: "Near HOD", filter: { type: "nearHod", pct: 1 } },
  { id: "sma50a", label: "SMA50↑", filter: { type: "priceVsSma", period: 50, side: "above" } },
  { id: "atr2", label: "ATR%>2", filter: { type: "atrPctHigh", minPct: 2 } },
];

export function ScannerPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ScannerRow[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([
    "asiri_satim",
  ]);
  const [extraFilters, setExtraFilters] = useState<string[]>([]);
  const [exchange, setExchange] = useState<"binance" | "bist">("binance");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [saveName, setSaveName] = useState("");
  const [status, setStatus] = useState("");

  const activeFilters = useMemo(() => {
    const map = new Map<string, ScannerFilter>();
    for (const pid of selectedPresets) {
      const p = SCANNER_PRESETS[pid];
      if (!p) continue;
      for (const f of p.filters) {
        map.set(JSON.stringify(f), f);
      }
    }
    for (const cid of extraFilters) {
      const chip = FILTER_CHIPS.find((c) => c.id === cid);
      if (chip) map.set(JSON.stringify(chip.filter), chip.filter);
    }
    return [...map.values()];
  }, [selectedPresets, extraFilters]);

  const togglePreset = (id: string) => {
    setSelectedPresets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleChip = (id: string) => {
    setExtraFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortKey === "rsi") {
        av = a.rsi ?? -1;
        bv = b.rsi ?? -1;
      } else if (sortKey === "changePct") {
        av = a.changePct;
        bv = b.changePct;
      } else if (sortKey === "volume") {
        av = a.quoteVolume ?? a.volume ?? 0;
        bv = b.quoteVolume ?? b.volume ?? 0;
      } else {
        return sortDir === "asc"
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const exportCsv = () => {
    const header = "symbol,exchange,last,changePct,rsi,volume,quoteVolume,atrPct,note\n";
    const body = sortedRows
      .map(
        (r) =>
          `${r.symbol},${r.exchange},${r.last},${r.changePct},${r.rsi ?? ""},${r.volume ?? ""},${r.quoteVolume ?? ""},${r.atrPct ?? ""},"${(r.note || "").replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan_${exchange}_${timeframe}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveNamedPreset = async () => {
    const name = saveName.trim();
    if (!name || !activeFilters.length) {
      setStatus("İsim ve filtre gerekli");
      return;
    }
    try {
      const res = await fetch("/api/store");
      const db = await res.json();
      const scanPresets = Array.isArray(db.scanPresets) ? db.scanPresets : [];
      const entry = {
        id: `scan_${Date.now().toString(36)}`,
        name,
        filters: activeFilters,
        exchange,
        timeframe,
        updatedAt: Date.now(),
      };
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanPresets: [...scanPresets.filter((x: { name: string }) => x.name !== name), entry],
        }),
      });
      setStatus(`"${name}" kaydedildi`);
      setSaveName("");
    } catch {
      setStatus("Kayıt başarısız");
    }
  };

  const run = useCallback(async () => {
    if (!activeFilters.length) {
      setStatus("En az bir preset veya filtre seçin");
      return;
    }
    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setStatus("");
    try {
      const tickerRes = await fetch(
        `/api/ticker?exchange=${exchange}${exchange === "bist" ? "&limit=180" : ""}`
      );
      const tickerJson = await tickerRes.json();
      let quotes: TickerQuote[] = tickerJson.quotes ?? [];
      if (exchange === "bist" && quotes.length === 0) {
        setStatus(
          tickerJson.note ||
            "BIST kotasyonları alınamadı (Yahoo rate-limit / kaynak hatası). Tarama boş döndü — daha sonra tekrar deneyin."
        );
        setRows([]);
        return;
      }
      if (exchange === "binance") {
        quotes = quotes
          .filter((q) => q.symbol.endsWith("USDT"))
          .sort((a, b) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
          .slice(0, 200);
      } else {
        quotes = [...quotes]
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, 160);
      }

      const needsCandles = filtersNeedCandles(activeFilters);
      setProgress({ done: 0, total: quotes.length });

      const out: ScannerRow[] = [];
      const concurrency = needsCandles ? 10 : 1;

      await mapPool(
        quotes,
        concurrency,
        async (q) => {
          let candles: Candle[] | null = null;
          if (needsCandles) {
            try {
              const kr = await fetch(
                `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${exchange}&timeframe=${timeframe}&limit=220`
              );
              const kj = await kr.json();
              candles = kj.candles ?? null;
            } catch {
              candles = null;
            }
          }
          const m = matchFilters(q, candles, activeFilters);
          if (m.ok) {
            out.push({
              symbol: q.symbol,
              exchange,
              last: q.last,
              changePct: q.changePct,
              rsi: m.rsi,
              volume: q.volume,
              quoteVolume: q.quoteVolume,
              atrPct: m.atrPct,
              note: m.note,
            });
          }
          return null;
        },
        (done, total) => setProgress({ done, total })
      );

      setRows(out);
      setStatus(`${out.length} eşleşme / ${quotes.length} tarandı`);
    } finally {
      setRunning(false);
    }
  }, [activeFilters, exchange, timeframe]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
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
          <option value="binance">Binance USDT (top 200)</option>
          <option value="bist">BIST (BIST30+likit ~180)</option>
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
          {running
            ? `${progress.done}/${progress.total} tarandı`
            : "Tara"}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={!rows.length}
          onClick={exportCsv}
        >
          CSV
        </button>
      </div>

      <div className="text-2xs text-desk-muted">Preset galerisi (çoklu seçim)</div>
      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
        {Object.entries(SCANNER_PRESETS).map(([id, p]) => (
          <button
            key={id}
            type="button"
            title={p.description}
            className={clsx(
              "btn text-2xs",
              selectedPresets.includes(id) && "btn-accent"
            )}
            onClick={() => togglePreset(id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="text-2xs text-desk-muted">Ek filtreler (birleştir)</div>
      <div className="flex flex-wrap gap-1">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={clsx(
              "btn text-2xs",
              extraFilters.includes(c.id) && "btn-accent"
            )}
            onClick={() => toggleChip(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 items-center">
        <input
          className="input flex-1 text-2xs"
          placeholder="İsimli preset kaydet…"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button type="button" className="btn text-2xs" onClick={saveNamedPreset}>
          Kaydet
        </button>
      </div>

      {exchange === "bist" && (
        <p className="text-2xs text-desk-warn">
          BIST taraması gecikmeli Yahoo query2 chart üzerinden; sonuçlar canlı değildir.
        </p>
      )}
      {status && (
        <p
          className={
            status.includes("alınamadı") || status.includes("boş")
              ? "text-2xs text-desk-down"
              : "text-2xs text-desk-muted"
          }
        >
          {status}
        </p>
      )}

      <div className="flex gap-1 text-2xs text-desk-muted">
        <button type="button" className="btn text-2xs" onClick={() => setSort("symbol")}>
          Sembol{sortKey === "symbol" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button type="button" className="btn text-2xs" onClick={() => setSort("changePct")}>
          %Δ{sortKey === "changePct" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button type="button" className="btn text-2xs" onClick={() => setSort("rsi")}>
          RSI{sortKey === "rsi" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button type="button" className="btn text-2xs" onClick={() => setSort("volume")}>
          Hacim{sortKey === "volume" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 px-2 py-1 text-2xs text-desk-muted border-b border-desk-border/40 sticky top-0 bg-desk-bg">
          <span>Sembol</span>
          <span>%Δ</span>
          <span>RSI</span>
          <span>Vol</span>
        </div>
        {sortedRows.map((r) => (
          <button
            key={r.symbol}
            type="button"
            className="w-full text-left px-2 py-1.5 border-b border-desk-border/40 hover:bg-desk-elevated"
            onClick={() => openSymbolInActive(r.symbol, r.exchange)}
          >
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-xs items-center">
              <span className="font-medium truncate">{r.symbol}</span>
              <span
                className={clsx(
                  "font-mono tabular-nums",
                  r.changePct >= 0 ? "text-desk-up" : "text-desk-down"
                )}
              >
                {r.changePct >= 0 ? "+" : ""}
                {r.changePct.toFixed(2)}%
              </span>
              <span className="font-mono text-2xs tabular-nums w-10 text-right">
                {r.rsi != null ? r.rsi.toFixed(0) : "—"}
              </span>
              <span className="font-mono text-2xs text-desk-muted tabular-nums w-14 text-right">
                {formatVol(r.quoteVolume ?? r.volume)}
              </span>
            </div>
            <div className="text-2xs text-desk-muted truncate">{r.note}</div>
            <div className="text-2xs text-desk-muted font-mono">
              {r.last} {r.atrPct != null ? `· ATR% ${r.atrPct.toFixed(2)}` : ""}
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            Preset/filtre seçip Tara — Binance top 200 / BIST 120, paralel kline.
          </div>
        )}
      </div>
    </div>
  );
}

function formatVol(v?: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}
