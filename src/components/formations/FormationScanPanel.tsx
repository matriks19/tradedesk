"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { Candle, Exchange, FormationScaleMode, Timeframe, TickerQuote } from "@/lib/types";
import {
  detectAdvanced,
  type AdvancedPatternFamily,
  type AdvancedPatternHit,
  toPatternHit,
} from "@/lib/patterns/advanced";
import { mapPool } from "@/lib/scanner/engine";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";
import {
  MAJOR_TIMEFRAMES,
  majorSwingStrength,
} from "@/lib/data/timeframes";

const FAMILY_OPTS: { id: AdvancedPatternFamily; label: string }[] = [
  { id: "harmonic", label: "Harmonik" },
  { id: "candle", label: "Mum" },
  { id: "liquidity", label: "Likidite" },
  { id: "structure", label: "Yapı BOS/CHOCH" },
];

const SCALE_CHIPS: { id: FormationScaleMode; label: string }[] = [
  { id: "minor", label: "Minör" },
  { id: "major", label: "Majör" },
  { id: "both", label: "İkisi" },
];

type Row = AdvancedPatternHit & {
  symbol: string;
  exchange: Exchange;
};

export function FormationScanPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const setActivePane = useDeskStore((s) => s.setActivePane);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);
  const setPatternFocus = useDeskStore((s) => s.setPatternFocus);
  const setSidebarTab = useDeskStore((s) => s.setSidebarTab);
  const patternSettings = useDeskStore((s) => s.patternSettings);
  const setPatternSettings = useDeskStore((s) => s.setPatternSettings);

  const [exchange, setExchange] = useState<Exchange>("binance");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [families, setFamilies] = useState<AdvancedPatternFamily[]>([
    "harmonic",
    "candle",
    "liquidity",
  ]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");

  const scale = patternSettings.formationScale ?? "both";

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

      const tfs: { tf: string; scale: "minor" | "major"; swing: number }[] = [];
      if (scale !== "major") {
        tfs.push({
          tf: timeframe,
          scale: "minor",
          swing: patternSettings.swingStrength,
        });
      }
      if (scale !== "minor") {
        const majSwing = majorSwingStrength(patternSettings.swingStrength);
        for (const tf of MAJOR_TIMEFRAMES) {
          tfs.push({ tf, scale: "major", swing: majSwing });
        }
      }

      const jobs = quotes.flatMap((q) =>
        tfs.map((t) => ({ quote: q, ...t }))
      );
      setProgress({ done: 0, total: jobs.length });
      const out: Row[] = [];
      await mapPool(
        jobs,
        8,
        async (job) => {
          try {
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(job.quote.symbol)}&exchange=${exchange}&timeframe=${job.tf}&limit=220`
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < 40) return null;
            const hits = detectAdvanced(candles, {
              families,
              swingStrength: job.swing,
            });
            for (const h of hits.slice(0, 2)) {
              out.push({
                ...h,
                id: `${job.scale}_${job.tf}_${h.id}`,
                symbol: job.quote.symbol,
                exchange,
                scale: job.scale,
                timeframe: job.tf,
                label:
                  job.scale === "major"
                    ? `${h.label} · ${job.tf}`
                    : h.label,
                detail:
                  job.scale === "major"
                    ? `[Majör ${job.tf}] ${h.detail}`
                    : h.detail,
              });
            }
          } catch {
            /* skip */
          }
          return null;
        },
        (done, total) => setProgress({ done, total })
      );
      out.sort((a, b) => b.confidence - a.confidence);
      setRows(out.slice(0, 100));
      setStatus(
        `${out.length} formasyon · ${quotes.length} sembol · TF: ${tfs.map((t) => t.tf).join(",")}`
      );
    } finally {
      setRunning(false);
    }
  }, [
    exchange,
    timeframe,
    families,
    scale,
    patternSettings.swingStrength,
  ]);

  const openHit = (h: Row) => {
    setActivePane(activePaneId);
    // Switch TF before drawing — majör 1D/3D/1W and minör scan TF alike.
    const tf = h.timeframe || (h.scale === "major" ? undefined : timeframe);
    openSymbolInActive(h.symbol, h.exchange, tf);
    const ph = toPatternHit(h);
    // Prefer pattern TF on the hit so ChartPane can wait for matching candles.
    setOverlayPattern(tf && !ph.timeframe ? { ...ph, timeframe: tf } : ph);
    setPatternFocus(ph.id);
    setSidebarTab("patterns");
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Formasyon Tarama</div>
      <p className="text-2xs text-desk-muted">
        Minör: seçili TF. Majör: 1D + 3D + 1W (yüksek swing). Sonuç tıklanınca
        grafikte XABCD + PRZ + TP/SL; majörde TF o periyoda geçer.
      </p>
      <div className="flex gap-1 flex-wrap">
        {SCALE_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={clsx("btn text-2xs", scale === c.id && "btn-accent")}
            onClick={() => setPatternSettings({ formationScale: c.id })}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 flex-wrap">
        <select
          className="input w-auto"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as Exchange)}
        >
          <option value="binance">Binance top ~120</option>
          <option value="bist">BIST likit ~100</option>
        </select>
        {scale !== "major" && (
          <select
            className="input w-auto"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        )}
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
                {r.scale === "major" && (
                  <span className="ml-1 text-2xs text-desk-accent">Majör</span>
                )}
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
              {r.timeframe ? `${r.timeframe} · ` : ""}
              {r.entry != null ? `E ${fmt(r.entry)}` : ""}
              {r.prz ? ` · PRZ ${fmt(r.prz.low)}-${fmt(r.prz.high)}` : ""}
              {r.tp1 != null ? ` · TP1 ${fmt(r.tp1)}` : ""}
              {r.sl != null ? ` · SL ${fmt(r.sl)}` : ""}
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            Ölçek + aile seçip Tara — majör 1D/3D/1W paralel tarar.
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
