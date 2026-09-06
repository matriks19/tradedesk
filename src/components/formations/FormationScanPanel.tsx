"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { Candle, Exchange, Timeframe, TickerQuote } from "@/lib/types";
import {
  detectAdvanced,
  type AdvancedPatternFamily,
  type AdvancedPatternHit,
  type PatternStage,
  toPatternHit,
  isActiveStage,
} from "@/lib/patterns/advanced";
import { detectPatterns } from "@/lib/patterns/detect";
import { passesShtFilter } from "@/lib/patterns/shtFlagTriangle";
import { passesThreeDrivesFilter } from "@/lib/patterns/threeDrives";
import { passesBreakoutFvgRetestFilter } from "@/lib/patterns/breakoutFvgRetest";
import { passesInversionFvgFilter } from "@/lib/patterns/inversionFvg";
import type { PatternHit } from "@/lib/patterns/types";
import { mapPool } from "@/lib/scanner/engine";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";

const FAMILY_OPTS: { id: AdvancedPatternFamily; label: string }[] = [
  { id: "harmonic", label: "Harmonik" },
  { id: "candle", label: "Mum" },
  { id: "liquidity", label: "Likidite" },
  { id: "structure", label: "Yapı BOS/CHOCH" },
];

const STAGE_TR: Record<PatternStage, string> = {
  forming: "oluşuyor",
  prz: "PRZ",
  retest: "retest",
  active: "aktif",
  target_hit: "hedef✓",
  invalid: "geçersiz",
};

type Row = {
  id: string;
  symbol: string;
  exchange: Exchange;
  label: string;
  confidence: number;
  timeframe?: string;
  direction?: string;
  entry?: number;
  prz?: { low: number; high: number };
  tp1?: number;
  sl?: number;
  /** underlying hit for overlay */
  _hit: AdvancedPatternHit | PatternHit;
  sht?: boolean;
  threeDrives?: boolean;
  bfr?: boolean;
  ifvg?: boolean;
  barsAgo?: number;
  stage?: PatternStage | string;
};

/** Prefer retest / pre-target; drop triggers already past TP1 when activeOnly */
function keepClassicFresh(
  h: PatternHit,
  candles: Candle[],
  activeOnly: boolean
): boolean {
  if (!activeOnly) return true;
  const st = h.meta?.status;
  const tp1 = h.meta?.tp1 ?? h.meta?.targetPrice;
  const last = candles[candles.length - 1];
  if (!last) return true;
  if (st === "al_tetiklendi" || st === "sat_tetiklendi") {
    if (tp1 != null) {
      if (h.bias === "bull" && last.high >= tp1) return false;
      if (h.bias === "bear" && last.low <= tp1) return false;
    }
    // still pre-TP1 — keep as active-ish
    return true;
  }
  // Prefer retest / choch / fvg / confirmation / inversion / konsolidasyon
  if (
    st === "retest" ||
    st === "choch" ||
    st === "fvg" ||
    st === "confirmation" ||
    st === "inversion" ||
    st === "konsolidasyon" ||
    st === "olusum" ||
    st === "kirilim" ||
    st === "breakout"
  ) {
    return true;
  }
  return true;
}

export function FormationScanPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const setActivePane = useDeskStore((s) => s.setActivePane);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);
  const setPatternFocus = useDeskStore((s) => s.setPatternFocus);
  const setSidebarTab = useDeskStore((s) => s.setSidebarTab);
  const patternSettings = useDeskStore((s) => s.patternSettings);

  const [exchange, setExchange] = useState<Exchange>("binance");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [families, setFamilies] = useState<AdvancedPatternFamily[]>([
    "harmonic",
    "candle",
    "liquidity",
  ]);
  const [shtFocus, setShtFocus] = useState(false);
  const [tdFocus, setTdFocus] = useState(false);
  const [bfrFocus, setBfrFocus] = useState(false);
  const [ifvgFocus, setIfvgFocus] = useState(false);
  /** Default ON: only forming/prz/retest/active — drop target_hit */
  const [activeOnly, setActiveOnly] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");

  const toggleFamily = (id: AdvancedPatternFamily) => {
    setFamilies((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const run = useCallback(async () => {
    if (!families.length && !shtFocus && !tdFocus && !bfrFocus && !ifvgFocus) {
      setStatus(
        "En az bir formasyon ailesi, SHT Flama/Üçgen, Üç İtiş, Breakout·FVG·Retest veya IFVG seçin"
      );
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

      const jobs = quotes.map((q) => ({
        quote: q,
        tf: timeframe,
        swing: patternSettings.swingStrength,
      }));
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
            if (families.length) {
              const hits = detectAdvanced(candles, {
                families,
                swingStrength: job.swing,
                includeCompleted: !activeOnly,
                maxBarsAgo: 55,
              });
              for (const h of hits.slice(0, 3)) {
                if (activeOnly && h.stage && !isActiveStage(h.stage)) continue;
                out.push({
                  id: `${job.tf}_${h.id}`,
                  symbol: job.quote.symbol,
                  exchange,
                  label: h.label,
                  confidence: h.confidence,
                  timeframe: job.tf,
                  direction: h.direction,
                  entry: h.entry,
                  prz: h.prz,
                  tp1: h.tp1,
                  sl: h.sl,
                  stage: h.stage,
                  barsAgo: h.barsAgo,
                  _hit: { ...h, id: `${job.tf}_${h.id}`, timeframe: job.tf },
                });
              }
            }
            if (shtFocus) {
              const classic = detectPatterns(candles, {
                swingStrength: job.swing,
                enable: {
                  flag: true,
                  pennant: true,
                  triangle_asc: true,
                  triangle_desc: true,
                  triangle_sym: true,
                  hh_hl: false,
                  lh_ll: false,
                  double_top: false,
                  double_bottom: false,
                  head_shoulders: false,
                  inv_head_shoulders: false,
                  breakout_box: false,
                  engulfing: false,
                  three_drives: false,
                  breakout_fvg_retest: false,
                  inversion_fvg: false,
                },
              }).filter((h) => passesShtFilter(h, 60));
              for (const h of classic.slice(0, 2)) {
                out.push({
                  id: `${job.tf}_${h.id}`,
                  symbol: job.quote.symbol,
                  exchange,
                  label: h.label,
                  confidence: h.meta?.score != null ? h.meta.score / 100 : h.confidence,
                  timeframe: job.tf,
                  direction: h.bias,
                  entry: h.meta?.breakoutPrice,
                  tp1: h.meta?.targetPrice,
                  sl: undefined,
                  stage: h.meta?.status,
                  barsAgo: h.meta?.barsAgo,
                  _hit: { ...h, id: `${job.tf}_${h.id}`, timeframe: job.tf },
                  sht: true,
                });
              }
            }
            if (tdFocus) {
              const tds = detectPatterns(candles, {
                swingStrength: job.swing,
                enable: {
                  three_drives: true,
                  flag: false,
                  pennant: false,
                  triangle_asc: false,
                  triangle_desc: false,
                  triangle_sym: false,
                  hh_hl: false,
                  lh_ll: false,
                  double_top: false,
                  double_bottom: false,
                  head_shoulders: false,
                  inv_head_shoulders: false,
                  breakout_box: false,
                  engulfing: false,
                  breakout_fvg_retest: false,
                  inversion_fvg: false,
                },
              }).filter((h) => passesThreeDrivesFilter(h, 60));
              for (const h of tds.slice(0, 2)) {
                out.push({
                  id: `${job.tf}_${h.id}`,
                  symbol: job.quote.symbol,
                  exchange,
                  label: h.label,
                  confidence:
                    h.meta?.score != null ? h.meta.score / 100 : h.confidence,
                  timeframe: job.tf,
                  direction: h.bias,
                  entry: undefined,
                  prz:
                    h.meta?.przLow != null && h.meta?.przHigh != null
                      ? { low: h.meta.przLow, high: h.meta.przHigh }
                      : undefined,
                  tp1: h.meta?.targetPrice,
                  sl: undefined,
                  stage: h.meta?.status,
                  barsAgo: h.meta?.barsAgo,
                  _hit: { ...h, id: `${job.tf}_${h.id}`, timeframe: job.tf },
                  threeDrives: true,
                });
              }
            }
            if (bfrFocus) {
              const bfrs = detectPatterns(candles, {
                swingStrength: job.swing,
                enable: {
                  breakout_fvg_retest: true,
                  inversion_fvg: false,
                  three_drives: false,
                  flag: false,
                  pennant: false,
                  triangle_asc: false,
                  triangle_desc: false,
                  triangle_sym: false,
                  hh_hl: false,
                  lh_ll: false,
                  double_top: false,
                  double_bottom: false,
                  head_shoulders: false,
                  inv_head_shoulders: false,
                  breakout_box: false,
                  engulfing: false,
                },
              })
                .filter((h) => passesBreakoutFvgRetestFilter(h, 60))
                .filter((h) => keepClassicFresh(h, candles, activeOnly));
              for (const h of bfrs.slice(0, 2)) {
                out.push({
                  id: `${job.tf}_${h.id}`,
                  symbol: job.quote.symbol,
                  exchange,
                  label: h.label,
                  confidence:
                    h.meta?.score != null ? h.meta.score / 100 : h.confidence,
                  timeframe: job.tf,
                  direction: h.bias,
                  entry: h.meta?.entry,
                  tp1: h.meta?.tp1,
                  sl: h.meta?.stop,
                  stage: h.meta?.status,
                  barsAgo: h.meta?.barsAgo,
                  _hit: { ...h, id: `${job.tf}_${h.id}`, timeframe: job.tf },
                  bfr: true,
                });
              }
            }
            if (ifvgFocus) {
              const ifvgs = detectPatterns(candles, {
                swingStrength: job.swing,
                enable: {
                  inversion_fvg: true,
                  breakout_fvg_retest: false,
                  three_drives: false,
                  flag: false,
                  pennant: false,
                  triangle_asc: false,
                  triangle_desc: false,
                  triangle_sym: false,
                  hh_hl: false,
                  lh_ll: false,
                  double_top: false,
                  double_bottom: false,
                  head_shoulders: false,
                  inv_head_shoulders: false,
                  breakout_box: false,
                  engulfing: false,
                },
              })
                .filter((h) => passesInversionFvgFilter(h, 55))
                .filter((h) => keepClassicFresh(h, candles, activeOnly));
              for (const h of ifvgs.slice(0, 2)) {
                const tag = h.meta?.sweep ? "IFVG·Süp" : "IFVG";
                out.push({
                  id: `${job.tf}_${h.id}`,
                  symbol: job.quote.symbol,
                  exchange,
                  label: h.label.includes("IFVG") ? h.label : `${tag} · ${h.label}`,
                  confidence:
                    h.meta?.score != null ? h.meta.score / 100 : h.confidence,
                  timeframe: job.tf,
                  direction: h.bias,
                  entry: h.meta?.entry,
                  tp1: h.meta?.tp1,
                  sl: h.meta?.stop,
                  barsAgo: h.meta?.barsAgo,
                  stage: h.meta?.status,
                  _hit: { ...h, id: `${job.tf}_${h.id}`, timeframe: job.tf },
                  ifvg: true,
                });
              }
            }
          } catch {
            /* skip */
          }
          return null;
        },
        (done, total) => setProgress({ done, total })
      );
      out.sort(
        (a, b) =>
          (a.barsAgo ?? 999) - (b.barsAgo ?? 999) || b.confidence - a.confidence
      );
      setRows(out.slice(0, 100));
      setStatus(
        `${out.length} formasyon · ${quotes.length} sembol · TF: ${timeframe}${
          activeOnly ? " · sadece aktif" : ""
        }`
      );
    } finally {
      setRunning(false);
    }
  }, [
    exchange,
    timeframe,
    families,
    shtFocus,
    tdFocus,
    bfrFocus,
    ifvgFocus,
    activeOnly,
    patternSettings.swingStrength,
  ]);

  const openHit = (h: Row) => {
    setActivePane(activePaneId);
    const tf = h.timeframe || timeframe;
    openSymbolInActive(h.symbol, h.exchange, tf);
    const raw = h._hit;
    const ph: PatternHit =
      "drawings" in raw && Array.isArray((raw as PatternHit).drawings)
        ? (raw as PatternHit)
        : toPatternHit(raw as AdvancedPatternHit);
    setOverlayPattern(tf && !ph.timeframe ? { ...ph, timeframe: tf } : ph);
    setPatternFocus(ph.id);
    setSidebarTab("patterns");
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Formasyon Tarama</div>
      <p className="text-2xs text-desk-muted">
        Retest/PRZ aşamasındaki formasyonlar — hedefi dolmuşlar elenir. Tıklayınca
        XABCD bacakları + PRZ + TP/SL.
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
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
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
        <button
          type="button"
          className={clsx("btn text-2xs", activeOnly && "btn-accent")}
          onClick={() => setActiveOnly((v) => !v)}
          title="forming / PRZ / retest / aktif — hedefi dolmuşları gizle"
        >
          Sadece aktif (retest/PRZ)
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", shtFocus && "btn-accent")}
          onClick={() => setShtFocus((v) => !v)}
          title="Flama/bayrak/üçgen · UYGUN veya skor≥60"
        >
          SHT Flama/Üçgen
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", tdFocus && "btn-accent")}
          onClick={() => setTdFocus((v) => !v)}
          title="Three Drives / Üç İtiş · UYGUN veya skor≥60"
        >
          Three Drives / Üç İtiş
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", bfrFocus && "btn-accent")}
          onClick={() => setBfrFocus((v) => !v)}
          title="Breakout · FVG · Retest · onay · skor≥60"
        >
          Breakout·FVG·Retest
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", ifvgFocus && "btn-accent")}
          onClick={() => setIfvgFocus((v) => !v)}
          title="Inversion FVG · süpürme · CHoCH · retest · skor≥55 — İndikatörler: IFVG Bölgeler + IFVG×RSI ile birlikte kullanılabilir"
        >
          Inversion FVG (IFVG)
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
                {r.stage ? (
                  <span className="ml-1 text-2xs px-1 rounded bg-desk-border/50">
                    {STAGE_TR[r.stage as PatternStage] ?? r.stage}
                  </span>
                ) : null}
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
              {r.sht ? "SHT · " : ""}
              {r.threeDrives ? "Üç İtiş · " : ""}
              {r.bfr ? "BFR · " : ""}
              {r.ifvg ? (r.label.includes("Süp") ? "IFVG·Süp · " : "IFVG · ") : ""}
              {r.entry != null ? `E ${fmt(r.entry)}` : ""}
              {r.sl != null ? ` · SL ${fmt(r.sl)}` : ""}
              {r.tp1 != null
                ? ` · ${
                    r.sht || r.threeDrives || r.bfr || r.ifvg
                      ? r.bfr || r.ifvg
                        ? "TP1"
                        : "Hedef"
                      : "TP1"
                  } ${fmt(r.tp1)}`
                : ""}
              {r.prz ? ` · PRZ ${fmt(r.prz.low)}-${fmt(r.prz.high)}` : ""}
              {r.barsAgo != null
                ? ` · ${r.barsAgo} mum önce${
                    r.ifvg ? (r.direction === "bear" ? " SAT" : " AL") : ""
                  }`
                : ""}
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            Aile seçip Tara — retest/PRZ aşamasındaki formasyonlar listelenir.
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
