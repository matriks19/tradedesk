"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScannerFilter, ScannerRow } from "@/lib/scanner/engine";
import {
  SCANNER_PRESETS,
  filtersNeedCandles,
  mapPool,
  matchFilters,
} from "@/lib/scanner/engine";
import type { AdvancedFilter } from "@/lib/scanner/advanced";
import {
  createAdvancedFilter,
  describeAdvancedFilter,
  matchAdvancedFilters,
} from "@/lib/scanner/advanced";
import type {
  CompareMode,
  FilterCondition,
  TechnicalFieldId,
} from "@/lib/scanner/fields";
import {
  COMPARE_MODES,
  FILTER_CONDITIONS,
  RATING_DOC,
  SCAN_TIMEFRAMES,
  TECHNICAL_FIELDS,
  fieldById,
  searchFields,
} from "@/lib/scanner/fields";
import { useDeskStore } from "@/store/desk";
import type { Candle, ChartTimeframe, TickerQuote } from "@/lib/types";
import { timeframeToMinutes } from "@/lib/data/timeframes";
import clsx from "clsx";

type SortKey = "rsi" | "changePct" | "volume" | "symbol";
type OpenSection = "advanced" | "presets" | "extra" | null;

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
  {
    id: "stoch_x_up",
    label: "Stoch↑ 15–25",
    filter: { type: "stochCross", direction: "bull", zoneLo: 15, zoneHi: 25 },
  },
  {
    id: "jkase_os",
    label: "JKase↑ 15–20",
    filter: {
      type: "jurikStochCross",
      direction: "bull",
      variant: "kase",
      zoneLo: 15,
      zoneHi: 20,
    },
  },
  {
    id: "jstoch_os",
    label: "JStoch↑ 15–20",
    filter: {
      type: "jurikStochCross",
      direction: "bull",
      variant: "jurik",
      zoneLo: 15,
      zoneHi: 20,
    },
  },
  { id: "di_bull", label: "DI+↑DI−", filter: { type: "diCross", direction: "bull" } },
  { id: "di_bear", label: "DI−↑DI+", filter: { type: "diCross", direction: "bear" } },
  { id: "adx25", label: "ADX>25", filter: { type: "adxAbove", value: 25 } },
  {
    id: "elizi_fire_l",
    label: "Elizi Fire L",
    filter: { type: "eliziFire", direction: "bull", minTemp: 55, minCoherence: 0.55 },
  },
  {
    id: "elizi_fire_s",
    label: "Elizi Fire S",
    filter: { type: "eliziFire", direction: "bear", minTemp: 55, minCoherence: 0.55 },
  },
  {
    id: "elizi_exh",
    label: "Elizi Exhaust",
    filter: { type: "eliziExhaust", direction: "any", minSurprise: 0.7 },
  },
  { id: "aroon_x", label: "Aroon↑", filter: { type: "aroonCross", direction: "bull" } },
  {
    id: "aroon_zone",
    label: "Aroon 70/30",
    filter: { type: "aroonLong", upMin: 70, downMax: 30 },
  },
  { id: "hod", label: "Near HOD", filter: { type: "nearHod", pct: 1 } },
  { id: "sma50a", label: "SMA50↑", filter: { type: "priceVsSma", period: 50, side: "above" } },
  { id: "atr2", label: "ATR%>2", filter: { type: "atrPctHigh", minPct: 2 } },
];

const KLINE_TIMEOUT_MS = 10_000;

function defaultUniverse(tf: string): number {
  // Smaller universe on very fast / HTF scans to avoid stalls
  if (tf === "1m" || tf === "3m") return 40;
  if (tf === "4h" || tf === "1d") return 40;
  if (tf === "3d" || tf === "1w") return 30;
  return 60;
}

function isHtfScan(tf: string): boolean {
  const m = timeframeToMinutes(tf);
  return m != null && m >= 240;
}

export function ScannerPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const pendingScannerPresets = useDeskStore((s) => s.pendingScannerPresets);
  const pendingScannerChips = useDeskStore((s) => s.pendingScannerChips);
  const clearPendingScanner = useDeskStore((s) => s.clearPendingScanner);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ScannerRow[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [extraFilters, setExtraFilters] = useState<string[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilter[]>([]);
  /** Filter editors collapsed by default so scan results stay visible. */
  const [openSection, setOpenSection] = useState<OpenSection>(null);
  const [exchange, setExchange] = useState<"binance" | "bist">("binance");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("15m");
  const [universeN, setUniverseN] = useState(60);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [sortKey, setSortKey] = useState<SortKey>("changePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [saveName, setSaveName] = useState("");
  const [status, setStatus] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Strategy pack → preselect scanner presets/chips once
  useEffect(() => {
    if (!pendingScannerPresets && !pendingScannerChips) return;
    if (pendingScannerPresets?.length) {
      setSelectedPresets(pendingScannerPresets);
      setOpenSection("presets");
    }
    if (pendingScannerChips?.length) {
      setExtraFilters(pendingScannerChips);
      if (!pendingScannerPresets?.length) setOpenSection("extra");
    }
    clearPendingScanner();
  }, [pendingScannerPresets, pendingScannerChips, clearPendingScanner]);

  // Draft row for adding a filter
  const [draftField, setDraftField] = useState<TechnicalFieldId>("rsi");
  const [draftCond, setDraftCond] = useState<FilterCondition>("below");
  const [draftCompare, setDraftCompare] = useState<CompareMode>("value");
  const [draftValue, setDraftValue] = useState(30);
  const [draftValue2, setDraftValue2] = useState(70);
  const [draftSeries, setDraftSeries] = useState<TechnicalFieldId>("sma20");

  useEffect(() => {
    setUniverseN(defaultUniverse(timeframe));
  }, [timeframe]);

  const legacyFilters = useMemo(() => {
    const map = new Map<string, ScannerFilter>();
    for (const pid of selectedPresets) {
      const p = SCANNER_PRESETS[pid];
      if (!p) continue;
      for (const f of p.filters) map.set(JSON.stringify(f), f);
    }
    for (const cid of extraFilters) {
      const chip = FILTER_CHIPS.find((c) => c.id === cid);
      if (chip) map.set(JSON.stringify(chip.filter), chip.filter);
    }
    return [...map.values()];
  }, [selectedPresets, extraFilters]);

  const activeFilterCount = legacyFilters.length + advancedFilters.length;

  const filteredFieldList = useMemo(
    () => searchFields(fieldSearch),
    [fieldSearch]
  );

  const pickField = (id: TechnicalFieldId) => {
    const def = fieldById(id);
    setDraftField(id);
    setDraftCompare(def?.defaultCompare ?? "value");
    setDraftValue(def?.defaultValue ?? 0);
    setDraftValue2(def?.defaultValue2 ?? 100);
    if (def?.defaultCompare === "price") {
      setDraftCond("above");
    } else if (id === "rsi" || id.startsWith("stoch") || id === "mfi") {
      setDraftCond("below");
    } else {
      setDraftCond("above");
    }
  };

  const addAdvanced = () => {
    setAdvancedFilters((prev) => [
      ...prev,
      createAdvancedFilter(draftField, {
        condition: draftCond,
        compare: draftCompare,
        value: draftValue,
        value2: draftValue2,
        seriesField: draftSeries,
      }),
    ]);
  };

  const removeAdvanced = (id: string) => {
    setAdvancedFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const resetAllFilters = () => {
    setSelectedPresets([]);
    setExtraFilters([]);
    setAdvancedFilters([]);
  };

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
    const header =
      "symbol,exchange,last,changePct,rsi,volume,quoteVolume,atrPct,note\n";
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
    if (!name || !activeFilterCount) {
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
        filters: legacyFilters,
        advancedFilters,
        exchange,
        timeframe,
        universeN,
        updatedAt: Date.now(),
      };
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanPresets: [
            ...scanPresets.filter((x: { name: string }) => x.name !== name),
            entry,
          ],
        }),
      });
      setStatus(`"${name}" kaydedildi`);
      setSaveName("");
    } catch {
      setStatus("Kayıt başarısız");
    }
  };

  const run = useCallback(async () => {
    if (!activeFilterCount) {
      setStatus("En az bir preset veya advanced filtre seçin");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRunning(true);
    setRows([]);
    setProgress({ done: 0, total: 0 });
    setStatus("");

    const nCap = Math.min(120, Math.max(20, universeN));

    try {
      const tickerRes = await fetch(
        `/api/ticker?exchange=${exchange}${exchange === "bist" ? "&limit=180" : ""}`,
        { signal: ac.signal }
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
          .slice(0, nCap);
      } else {
        quotes = [...quotes]
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, Math.min(nCap, 180));
      }

      const needsCandles =
        filtersNeedCandles(legacyFilters) || advancedFilters.length > 0;
      setProgress({ done: 0, total: quotes.length });

      const out: ScannerRow[] = [];
      const htf = isHtfScan(String(timeframe));
      const concurrency = needsCandles ? (htf ? 3 : 6) : 1;
      let lastProgressDone = 0;

      await mapPool(
        quotes,
        concurrency,
        async (q) => {
          if (ac.signal.aborted) return null;
          let candles: Candle[] | null = null;
          if (needsCandles) {
            try {
              const fetchSignal =
                typeof AbortSignal !== "undefined" &&
                typeof AbortSignal.any === "function" &&
                typeof AbortSignal.timeout === "function"
                  ? AbortSignal.any([
                      ac.signal,
                      AbortSignal.timeout(KLINE_TIMEOUT_MS),
                    ])
                  : ac.signal;
              const kr = await fetch(
                `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${exchange}&timeframe=${timeframe}&limit=220`,
                { signal: fetchSignal }
              );
              const kj = await kr.json();
              candles = kj.candles ?? null;
            } catch (e) {
              if (ac.signal.aborted) return null;
              // Timeout / network — skip symbol rather than hang the pool
              candles = null;
            }
          }

          let noteParts: string[] = [];
          let rsi: number | undefined;
          let atrPct: number | undefined;

          if (legacyFilters.length) {
            const m = matchFilters(q, candles, legacyFilters);
            if (!m.ok) return null;
            noteParts.push(m.note);
            rsi = m.rsi;
            atrPct = m.atrPct;
          }

          if (advancedFilters.length) {
            const m = matchAdvancedFilters(candles, advancedFilters, q);
            if (!m.ok) return null;
            noteParts.push(m.note);
            rsi = m.rsi ?? rsi;
            atrPct = m.atrPct ?? atrPct;
          }

          out.push({
            symbol: q.symbol,
            exchange,
            last: q.last,
            changePct: q.changePct,
            rsi,
            volume: q.volume,
            quoteVolume: q.quoteVolume,
            atrPct,
            note: noteParts.filter(Boolean).join(" · "),
          });
          return null;
        },
        (done, total) => {
          if (ac.signal.aborted) return;
          // Throttle React progress updates (every 3 symbols or finish)
          if (done === total || done - lastProgressDone >= 3) {
            lastProgressDone = done;
            setProgress({ done, total });
          }
        },
        ac.signal
      );

      if (ac.signal.aborted) return;
      setRows(out);
      setStatus(`${out.length} eşleşme / ${quotes.length} tarandı · TF ${timeframe}`);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setStatus("Tarama iptal edildi");
        return;
      }
      setStatus("Tarama hatası");
    } finally {
      if (abortRef.current === ac) {
        setRunning(false);
      }
    }
  }, [
    activeFilterCount,
    advancedFilters,
    exchange,
    legacyFilters,
    timeframe,
    universeN,
  ]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  };

  const openRow = (r: ScannerRow) => {
    openSymbolInActive(r.symbol, r.exchange, timeframe);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Tarayıcı (Scanner)</div>
      <div className="flex gap-1 flex-wrap items-center">
        <select
          className="input w-auto"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as "binance" | "bist")}
        >
          <option value="binance">Binance USDT (top N)</option>
          <option value="bist">BIST (best-effort)</option>
        </select>
        <select
          className="input w-auto"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as ChartTimeframe)}
          title="Scan timeframe (1m–1w, 25m agg)"
        >
          {SCAN_TIMEFRAMES.map((tf) => (
            <option key={tf.value} value={tf.value}>
              {tf.label}
            </option>
          ))}
        </select>
        <label className="text-2xs text-desk-muted flex items-center gap-1">
          N
          <input
            type="number"
            min={20}
            max={120}
            className="input w-14"
            value={universeN}
            onChange={(e) =>
              setUniverseN(
                Math.min(120, Math.max(20, Number(e.target.value) || 20))
              )
            }
          />
        </label>
        <button
          type="button"
          className="btn-accent"
          disabled={running}
          onClick={run}
        >
          {running
            ? `${progress.done}/${progress.total} tarandı`
            : "Tara"}
        </button>
        {running && (
          <button
            type="button"
            className="btn text-2xs"
            onClick={() => abortRef.current?.abort()}
          >
            İptal
          </button>
        )}
        <button
          type="button"
          className="btn text-2xs"
          disabled={!rows.length}
          onClick={exportCsv}
        >
          CSV
        </button>
      </div>

      <div className="flex gap-1 text-2xs flex-wrap items-center">
        <button
          type="button"
          className={clsx("btn text-2xs", openSection === "advanced" && "btn-accent")}
          onClick={() =>
            setOpenSection((s) => (s === "advanced" ? null : "advanced"))
          }
        >
          Advanced {openSection === "advanced" ? "▾" : "▸"}
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", openSection === "presets" && "btn-accent")}
          onClick={() =>
            setOpenSection((s) => (s === "presets" ? null : "presets"))
          }
        >
          Presets{selectedPresets.length ? ` (${selectedPresets.length})` : ""}{" "}
          {openSection === "presets" ? "▾" : "▸"}
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", openSection === "extra" && "btn-accent")}
          onClick={() =>
            setOpenSection((s) => (s === "extra" ? null : "extra"))
          }
        >
          Ek filtre{extraFilters.length ? ` (${extraFilters.length})` : ""}{" "}
          {openSection === "extra" ? "▾" : "▸"}
        </button>
        <span className="text-desk-muted self-center">
          Aktif: {activeFilterCount}
        </span>
        <button
          type="button"
          className="btn text-2xs ml-auto"
          onClick={resetAllFilters}
          disabled={!activeFilterCount}
        >
          Reset all
        </button>
      </div>

      {/* Active filter chips */}
      {(advancedFilters.length > 0 || legacyFilters.length > 0) && (
        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
          {advancedFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              className="btn text-2xs btn-accent"
              title="Kaldır"
              onClick={() => removeAdvanced(f.id)}
            >
              {describeAdvancedFilter(f)} ×
            </button>
          ))}
          {selectedPresets.map((id) => (
            <button
              key={`p-${id}`}
              type="button"
              className="btn text-2xs"
              onClick={() => togglePreset(id)}
            >
              {SCANNER_PRESETS[id]?.label ?? id} ×
            </button>
          ))}
          {extraFilters.map((id) => (
            <button
              key={`c-${id}`}
              type="button"
              className="btn text-2xs"
              onClick={() => toggleChip(id)}
            >
              {FILTER_CHIPS.find((c) => c.id === id)?.label ?? id} ×
            </button>
          ))}
        </div>
      )}

      {openSection === "advanced" && (
        <div className="flex flex-col gap-1 border border-desk-border/40 rounded p-1.5 max-h-56 overflow-y-auto shrink-0">
          <input
            className="input text-2xs w-full"
            placeholder="Teknik alan ara… (RSI, MACD, Bollinger…)"
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
          />
          <div className="max-h-20 overflow-y-auto flex flex-col gap-0.5">
            {filteredFieldList.map((f) => (
              <button
                key={f.id}
                type="button"
                className={clsx(
                  "text-left text-2xs px-1.5 py-0.5 rounded hover:bg-desk-elevated",
                  draftField === f.id && "bg-desk-elevated text-desk-accent"
                )}
                onClick={() => pickField(f.id)}
              >
                <span className="text-desk-muted">{f.group}</span> · {f.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
              Indicator
              <select
                className="input text-2xs"
                value={draftField}
                onChange={(e) => pickField(e.target.value as TechnicalFieldId)}
              >
                {TECHNICAL_FIELDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
              Condition
              <select
                className="input text-2xs"
                value={draftCond}
                onChange={(e) =>
                  setDraftCond(e.target.value as FilterCondition)
                }
              >
                {FILTER_CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
              Compare
              <select
                className="input text-2xs"
                value={draftCompare}
                disabled={draftCond === "between"}
                onChange={(e) =>
                  setDraftCompare(e.target.value as CompareMode)
                }
              >
                {COMPARE_MODES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {draftCompare === "series" && draftCond !== "between" ? (
              <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
                Series
                <select
                  className="input text-2xs"
                  value={draftSeries}
                  onChange={(e) =>
                    setDraftSeries(e.target.value as TechnicalFieldId)
                  }
                >
                  {TECHNICAL_FIELDS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : draftCond === "between" ? (
              <div className="flex gap-1 items-end">
                <label className="text-2xs text-desk-muted flex flex-col gap-0.5 flex-1">
                  From
                  <input
                    type="number"
                    className="input text-2xs"
                    value={draftValue}
                    onChange={(e) => setDraftValue(Number(e.target.value))}
                  />
                </label>
                <label className="text-2xs text-desk-muted flex flex-col gap-0.5 flex-1">
                  To
                  <input
                    type="number"
                    className="input text-2xs"
                    value={draftValue2}
                    onChange={(e) => setDraftValue2(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : draftCompare === "value" ? (
              <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
                Value
                <input
                  type="number"
                  className="input text-2xs"
                  value={draftValue}
                  onChange={(e) => setDraftValue(Number(e.target.value))}
                />
              </label>
            ) : (
              <div className="text-2xs text-desk-muted self-end pb-1">
                vs Price (close)
              </div>
            )}
          </div>

          <div className="flex gap-1 items-center">
            <button type="button" className="btn-accent text-2xs" onClick={addAdvanced}>
              + Filtre ekle
            </button>
            <span className="text-2xs text-desk-muted truncate" title={RATING_DOC}>
              Filtreler AND · {TECHNICAL_FIELDS.length} alan
            </span>
          </div>
        </div>
      )}

      {openSection === "presets" && (
        <div className="flex flex-col gap-1 border border-desk-border/40 rounded p-1.5 max-h-40 overflow-y-auto shrink-0">
          <div className="text-2xs text-desk-muted">
            Preset galerisi (çoklu; advanced ile AND)
          </div>
          <div className="flex flex-wrap gap-1">
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
          <div className="flex gap-1 items-center pt-1 border-t border-desk-border/30">
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
        </div>
      )}

      {openSection === "extra" && (
        <div className="flex flex-col gap-1 border border-desk-border/40 rounded p-1.5 max-h-32 overflow-y-auto shrink-0">
          <div className="text-2xs text-desk-muted">Ek filtreler</div>
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
        </div>
      )}



      {exchange === "bist" && (
        <p className="text-2xs text-desk-warn">
          BIST: küçük TF (1m) Yahoo&apos;da sınırlı — 5m+ önerilir; sonuçlar
          gecikmeli best-effort.
        </p>
      )}
      {status && (
        <p
          className={
            status.includes("alınamadı") ||
            status.includes("boş") ||
            status.includes("iptal") ||
            status.includes("hata")
              ? "text-2xs text-desk-down"
              : "text-2xs text-desk-muted"
          }
        >
          {status}
        </p>
      )}

      <div className="flex gap-1 text-2xs text-desk-muted">
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => setSort("symbol")}
        >
          Sembol{sortKey === "symbol" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => setSort("changePct")}
        >
          %Δ{sortKey === "changePct" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => setSort("rsi")}
        >
          RSI{sortKey === "rsi" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => setSort("volume")}
        >
          Hacim{sortKey === "volume" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
      </div>

      <div className="flex-1 min-h-[10rem] overflow-y-auto">
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
            onClick={() => openRow(r)}
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
              {r.last}{" "}
              {r.atrPct != null ? `· ATR% ${r.atrPct.toFixed(2)}` : ""} · {timeframe}
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            Advanced Filters ile MCC tarzı teknik tarama — TF 1m–1w (25m agg,
            1d/3d/1w dahil), Binance top N quoteVolume. Sonuç satırına
            tıklayınca aynı TF açılır.
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
