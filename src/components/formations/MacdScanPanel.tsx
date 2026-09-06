"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { Candle, Exchange, Timeframe, TickerQuote } from "@/lib/types";
import { mapPool } from "@/lib/scanner/engine";
import { detectMacdCross, type MacdBias } from "@/lib/scanner/macdScan";
import { useDeskStore } from "@/store/desk";

/** Fixed TF chips: value (API) + chip label (minutes) */
const MACD_TF_CHIPS: { value: Timeframe; label: string }[] = [
  { value: "15m", label: "15" },
  { value: "30m", label: "30" },
  { value: "1h", label: "60" },
  { value: "2h", label: "120" },
  { value: "4h", label: "240" },
];

const ALL_TFS = MACD_TF_CHIPS.map((t) => t.value);

type DirectionFilter = "all" | "al" | "sat";

type Row = {
  id: string;
  symbol: string;
  exchange: Exchange;
  timeframe: Timeframe;
  bias: MacdBias;
  barsAgo: number;
  macd: number;
  signal: number;
  hist: number;
  macdZeroCross?: boolean;
  volume: number;
};

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(2);
  if (a >= 1) return n.toFixed(4);
  if (a >= 0.01) return n.toFixed(5);
  return n.toPrecision(3);
}

export function MacdScanPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const addIndicator = useDeskStore((s) => s.addIndicator);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);

  const [exchange, setExchange] = useState<Exchange>("binance");
  const [tfs, setTfs] = useState<Timeframe[]>([...ALL_TFS]);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [maxBarsAgo, setMaxBarsAgo] = useState(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");

  const toggleTf = (tf: Timeframe) => {
    setTfs((prev) =>
      prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]
    );
  };

  const run = useCallback(async () => {
    if (!tfs.length) {
      setStatus("En az bir zaman dilimi seçin (15–240)");
      return;
    }
    const lookback = Math.min(20, Math.max(0, Math.floor(maxBarsAgo)));
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
            "BIST kotasyonları boş — Yahoo rate-limit. MACD taraması için kotasyon gerekli."
        );
        return;
      }
      if (exchange === "binance") {
        quotes = quotes
          .filter((q) => q.symbol.endsWith("USDT"))
          .sort((a, b) => (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0))
          .slice(0, 80);
      } else {
        quotes = [...quotes]
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, 80);
      }

      type Job = { quote: TickerQuote; tf: Timeframe };
      const jobs: Job[] = [];
      for (const q of quotes) {
        for (const tf of tfs) jobs.push({ quote: q, tf });
      }
      setProgress({ done: 0, total: jobs.length });
      const out: Row[] = [];

      await mapPool(
        jobs,
        8,
        async (job) => {
          try {
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(job.quote.symbol)}&exchange=${exchange}&timeframe=${job.tf}&limit=180`
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < 50) return null;
            const hit = detectMacdCross(candles, { maxBarsAgo: lookback });
            if (!hit) return null;
            if (direction === "al" && hit.bias !== "bull") return null;
            if (direction === "sat" && hit.bias !== "bear") return null;
            out.push({
              id: `${job.quote.symbol}_${job.tf}_${hit.bias}_${hit.barsAgo}`,
              symbol: job.quote.symbol,
              exchange,
              timeframe: job.tf,
              bias: hit.bias,
              barsAgo: hit.barsAgo,
              macd: hit.macd,
              signal: hit.signal,
              hist: hit.hist,
              macdZeroCross: hit.macdZeroCross,
              volume: job.quote.quoteVolume ?? job.quote.volume ?? 0,
            });
          } catch {
            /* skip */
          }
          return null;
        },
        (done, total) => setProgress({ done, total })
      );

      out.sort(
        (a, b) =>
          a.barsAgo - b.barsAgo ||
          b.volume - a.volume ||
          a.symbol.localeCompare(b.symbol)
      );
      setRows(out.slice(0, 150));
      const tfLabel = tfs
        .map((t) => MACD_TF_CHIPS.find((c) => c.value === t)?.label ?? t)
        .join("/");
      setStatus(
        `${out.length} sinyal · ${quotes.length} sembol · TF ${tfLabel} · ≤${lookback} mum`
      );
    } finally {
      setRunning(false);
    }
  }, [exchange, tfs, direction, maxBarsAgo]);

  const openHit = (r: Row) => {
    setOverlayPattern(null);
    openSymbolInActive(r.symbol, r.exchange, r.timeframe);
    const s = useDeskStore.getState();
    const pane = s.panes.find((p) => p.id === s.activePaneId) ?? s.panes[0];
    if (pane && !pane.indicators.some((i) => i.type === "macd")) {
      addIndicator(pane.id, "macd");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">MACD Tarama (15–240)</div>
      <p className="text-2xs text-desk-muted">
        MACD çizgisi sinyalini kesince AL/SAT. Çoklu TF; tıklayınca grafik + MACD
        açılır.
      </p>

      <div className="flex gap-1 flex-wrap items-center">
        <select
          className="input w-auto"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as Exchange)}
        >
          <option value="binance">Binance top ~80</option>
          <option value="bist">BIST likit ~80</option>
        </select>
        <select
          className="input w-auto"
          value={direction}
          onChange={(e) => setDirection(e.target.value as DirectionFilter)}
          title="Yön filtresi"
        >
          <option value="all">Hepsi</option>
          <option value="al">Sadece AL</option>
          <option value="sat">Sadece SAT</option>
        </select>
        <label className="text-2xs text-desk-muted flex items-center gap-1">
          Max mum
          <input
            className="input w-14"
            type="number"
            min={0}
            max={20}
            value={maxBarsAgo}
            onChange={(e) => setMaxBarsAgo(Number(e.target.value) || 0)}
            title="Maksimum mum önce (0–20, varsayılan 5)"
          />
        </label>
        <button
          type="button"
          className="btn-accent"
          disabled={running}
          onClick={run}
        >
          {running ? `${progress.done}/${progress.total}` : "Tara"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-2xs text-desk-muted mr-0.5">TF:</span>
        {MACD_TF_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={clsx("btn text-2xs", tfs.includes(c.value) && "btn-accent")}
            onClick={() => toggleTf(c.value)}
            title={c.value}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => setTfs([...ALL_TFS])}
          title="Tüm TF"
        >
          Hepsi
        </button>
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

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-1.5 px-1 py-1 text-2xs text-desk-muted border-b border-desk-border/40 sticky top-0 bg-desk-bg">
          <span>Sembol</span>
          <span>TF</span>
          <span>Yön</span>
          <span title="N mum önce">N</span>
          <span>MACD</span>
          <span>Sig</span>
          <span>Hist</span>
        </div>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            className="w-full text-left px-1 py-1 border-b border-desk-border/40 hover:bg-desk-elevated"
            onClick={() => openHit(r)}
          >
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-1.5 text-xs items-center font-mono">
              <span className="font-sans font-medium truncate">
                {r.symbol}
                {r.macdZeroCross ? (
                  <span
                    className="ml-1 text-2xs text-desk-muted font-normal"
                    title="MACD çizgisi sıfır kesişimi"
                  >
                    H0
                  </span>
                ) : null}
              </span>
              <span className="text-2xs text-desk-muted uppercase">
                {r.timeframe}
              </span>
              <span
                className={clsx(
                  "text-2xs font-sans font-medium",
                  r.bias === "bull" && "text-desk-up",
                  r.bias === "bear" && "text-desk-down"
                )}
              >
                {r.bias === "bull" ? "AL" : "SAT"}
              </span>
              <span className="text-2xs">{r.barsAgo}</span>
              <span className="text-2xs">{fmtNum(r.macd)}</span>
              <span className="text-2xs">{fmtNum(r.signal)}</span>
              <span
                className={clsx(
                  "text-2xs",
                  r.hist >= 0 ? "text-desk-up" : "text-desk-down"
                )}
              >
                {fmtNum(r.hist)}
              </span>
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            TF seçip Tara — taze MACD AL/SAT kesişimleri (≤ max mum).
          </div>
        )}
      </div>
    </div>
  );
}
