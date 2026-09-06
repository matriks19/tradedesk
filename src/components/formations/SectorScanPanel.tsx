"use client";

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import type { Candle, Exchange, Timeframe, TickerQuote } from "@/lib/types";
import {
  BIST_SECTORS,
  sectorCodes,
  symbolsForSector,
} from "@/lib/data/bistSectors";
import { fetchScanQuotes } from "@/lib/data/scanUniverse";
import { mapPool } from "@/lib/scanner/engine";
import { detectMacdCross } from "@/lib/scanner/macdScan";
import { detectRsiBreakFreshest } from "@/lib/scanner/rsiScan";
import { detectPatterns } from "@/lib/patterns/detect";
import { passesInversionFvgFilter } from "@/lib/patterns/inversionFvg";
import { passesSmcFilter } from "@/lib/patterns/smcModels";
import { passesQuasimodoFilter } from "@/lib/patterns/quasimodo";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";

type MomentumRow = {
  code: string;
  name: string;
  count: number;
  avgChange: number;
  pctUp: number;
  leaders: { symbol: string; changePct: number }[];
};

type ScanKind = "macd" | "rsi" | "ifvg" | "smc" | "qm";

type HitRow = {
  id: string;
  symbol: string;
  label: string;
  detail: string;
  bias?: string;
};

export function SectorScanPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const watchlists = useDeskStore((s) => s.watchlists);
  const createWatchlist = useDeskStore((s) => s.createWatchlist);
  const importWatchlistSymbols = useDeskStore((s) => s.importWatchlistSymbols);
  const seedSectorWatchlists = useDeskStore((s) => s.seedSectorWatchlists);
  const addAlertsBulk = useDeskStore((s) => s.addAlertsBulk);
  const setActiveWatchlist = useDeskStore((s) => s.setActiveWatchlist);

  const [sub, setSub] = useState<"momentum" | "scan">("momentum");
  const [momRows, setMomRows] = useState<MomentumRow[]>([]);
  const [momStatus, setMomStatus] = useState("");
  const [momRunning, setMomRunning] = useState(false);

  const [sector, setSector] = useState("XBANK");
  const [listId, setListId] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [scanKind, setScanKind] = useState<ScanKind>("macd");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [hits, setHits] = useState<HitRow[]>([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [seedMsg, setSeedMsg] = useState("");
  const [alertPct, setAlertPct] = useState(3);

  const codes = useMemo(() => sectorCodes(), []);

  const runMomentum = useCallback(async () => {
    setMomRunning(true);
    setMomStatus("");
    setMomRows([]);
    try {
      const { quotes, note, requested } = await fetchScanQuotes({
        exchange: "bist",
        source: "all",
      });
      if (!quotes.length) {
        setMomStatus(note || "Kotasyon alınamadı");
        return;
      }
      const bySym = new Map(quotes.map((q) => [q.symbol, q]));
      const rows: MomentumRow[] = [];
      for (const code of codes) {
        const syms = symbolsForSector(code);
        const qs = syms
          .map((s) => bySym.get(s))
          .filter((q): q is TickerQuote => !!q && Number.isFinite(q.changePct));
        if (!qs.length) {
          rows.push({
            code,
            name: BIST_SECTORS[code]?.name ?? code,
            count: 0,
            avgChange: 0,
            pctUp: 0,
            leaders: [],
          });
          continue;
        }
        const avg =
          qs.reduce((a, q) => a + q.changePct, 0) / Math.max(1, qs.length);
        const up = qs.filter((q) => q.changePct > 0).length;
        const leaders = [...qs]
          .sort((a, b) => b.changePct - a.changePct)
          .slice(0, 3)
          .map((q) => ({ symbol: q.symbol, changePct: q.changePct }));
        rows.push({
          code,
          name: BIST_SECTORS[code]?.name ?? code,
          count: qs.length,
          avgChange: avg,
          pctUp: (100 * up) / qs.length,
          leaders,
        });
      }
      rows.sort((a, b) => b.avgChange - a.avgChange);
      setMomRows(rows);
      setMomStatus(
        `${rows.length} sektör · ${quotes.length}/${requested} kotasyon`
      );
    } finally {
      setMomRunning(false);
    }
  }, [codes]);

  const resolveSymbols = useCallback((): string[] => {
    if (listId) {
      const wl = watchlists.find((w) => w.id === listId);
      return (wl?.symbols ?? [])
        .filter((s) => s.exchange === "bist")
        .map((s) => s.symbol);
    }
    return symbolsForSector(sector);
  }, [listId, watchlists, sector]);

  const runSectorScan = useCallback(async () => {
    const syms = resolveSymbols();
    if (!syms.length) {
      setStatus("Sembol yok — sektör veya izleme listesi seçin");
      return;
    }
    setRunning(true);
    setHits([]);
    setSelected({});
    setStatus("");
    try {
      const { quotes, note } = await fetchScanQuotes({
        exchange: "bist",
        symbols: syms,
      });
      if (!quotes.length) {
        setStatus(note || "Kotasyon boş");
        return;
      }
      const out: HitRow[] = [];
      setProgress({ done: 0, total: quotes.length });
      await mapPool(
        quotes,
        8,
        async (q) => {
          try {
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=bist&timeframe=${timeframe}&limit=180`
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < 50) return null;
            if (scanKind === "macd") {
              const hit = detectMacdCross(candles, { maxBarsAgo: 5 });
              if (!hit) return null;
              out.push({
                id: `${q.symbol}_macd`,
                symbol: q.symbol,
                label: hit.bias === "bull" ? "MACD AL" : "MACD SAT",
                detail: `${hit.barsAgo} mum · hist ${hit.hist.toFixed(4)}`,
                bias: hit.bias,
              });
            } else if (scanKind === "rsi") {
              const hit = detectRsiBreakFreshest(candles, {
                maxBarsAgo: 5,
                levels: [30, 50, 70],
              });
              if (!hit) return null;
              out.push({
                id: `${q.symbol}_rsi`,
                symbol: q.symbol,
                label: `RSI ${hit.level} ${hit.direction === "up" ? "↑" : "↓"}`,
                detail: `RSI ${hit.rsi.toFixed(1)} · ${hit.barsAgo} mum`,
                bias: hit.direction === "up" ? "bull" : "bear",
              });
            } else {
              const enable = {
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
                three_drives: false,
                breakout_fvg_retest: false,
                inversion_fvg: scanKind === "ifvg",
                smc_model: scanKind === "smc",
                quasimodo: scanKind === "qm",
                mavk_cluster: false,
                bist_cycle: false,
                cloud_touch: false,
              };
              const classic = detectPatterns(candles, {
                swingStrength: 2,
                enable,
              });
              const filtered =
                scanKind === "ifvg"
                  ? classic.filter((h) => passesInversionFvgFilter(h, 55))
                  : scanKind === "smc"
                    ? classic.filter((h) => passesSmcFilter(h, 55))
                    : classic.filter((h) => passesQuasimodoFilter(h, 55));
              for (const h of filtered.slice(0, 1)) {
                out.push({
                  id: `${q.symbol}_${h.id}`,
                  symbol: q.symbol,
                  label: h.label,
                  detail: h.detail,
                  bias: h.bias,
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
      out.sort((a, b) => a.symbol.localeCompare(b.symbol));
      setHits(out);
      const sel: Record<string, boolean> = {};
      for (const h of out) sel[h.symbol] = true;
      setSelected(sel);
      setStatus(
        `${out.length} sonuç · ${quotes.length} sembol · ${timeframe} · ${scanKind}`
      );
    } finally {
      setRunning(false);
    }
  }, [resolveSymbols, timeframe, scanKind]);

  const selectedSyms = useMemo(
    () => Object.keys(selected).filter((s) => selected[s]),
    [selected]
  );

  const saveToList = () => {
    if (!selectedSyms.length) {
      setStatus("Önce sonuç seçin");
      return;
    }
    const name = `${sector} tarama ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
    const id = createWatchlist(name);
    const n = importWatchlistSymbols(id, selectedSyms.join("\n"), "bist");
    setActiveWatchlist(id);
    setStatus(`${n} sembol listeye kaydedildi: ${name}`);
  };

  const bulkAlerts = async () => {
    if (!selectedSyms.length) {
      setStatus("Önce sonuç seçin");
      return;
    }
    const { quotes } = await fetchScanQuotes({
      exchange: "bist",
      symbols: selectedSyms,
    });
    const by = new Map(quotes.map((q) => [q.symbol, q]));
    const pct = Math.max(0.5, Math.min(20, alertPct));
    const items = selectedSyms
      .map((sym) => {
        const q = by.get(sym);
        if (!q?.last) return null;
        const target = q.last * (1 + pct / 100);
        return {
          symbol: sym,
          exchange: "bist" as Exchange,
          condition: "cross_above" as const,
          price: Number(target.toFixed(4)),
          note: `sektör +%${pct}`,
          lastPrice: q.last,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const n = addAlertsBulk(items);
    setStatus(`${n} alarm oluşturuldu (+%${pct})`);
  };

  const onSeed = () => {
    const r = seedSectorWatchlists();
    setSeedMsg(
      `Sektör listeleri: ${r.created} oluşturuldu, ${r.skipped} zaten vardı`
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Sektör Tarama</div>
      <p className="text-2xs text-desk-muted">
        Sektör momentumu ve sektör/liste bazlı toplu tarama. Listeler best-effort
        (güncellenebilir).
      </p>

      <div className="flex gap-1 flex-wrap">
        <button
          type="button"
          className={clsx("btn text-2xs", sub === "momentum" && "btn-accent")}
          onClick={() => setSub("momentum")}
        >
          Sektör momentum
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", sub === "scan" && "btn-accent")}
          onClick={() => setSub("scan")}
        >
          Sektör hisse taraması
        </button>
        <button type="button" className="btn text-2xs" onClick={onSeed}>
          Sektör listelerini oluştur
        </button>
      </div>
      {seedMsg && <p className="text-2xs text-desk-muted">{seedMsg}</p>}

      {sub === "momentum" ? (
        <>
          <button
            type="button"
            className="btn-accent text-2xs w-fit"
            disabled={momRunning}
            onClick={runMomentum}
          >
            {momRunning ? "Hesaplanıyor…" : "Momentum hesapla"}
          </button>
          {momStatus && (
            <p className="text-2xs text-desk-muted">{momStatus}</p>
          )}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 px-1 py-1 text-2xs text-desk-muted border-b border-desk-border/40 sticky top-0 bg-desk-bg">
              <span>Kod</span>
              <span>Sektör</span>
              <span>Ort%</span>
              <span>↑%</span>
              <span>Liderler</span>
            </div>
            {momRows.map((r) => (
              <button
                key={r.code}
                type="button"
                className="w-full text-left px-1 py-1 border-b border-desk-border/40 hover:bg-desk-elevated"
                onClick={() => {
                  setSector(r.code);
                  setSub("scan");
                }}
                title="Taramaya geç"
              >
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 text-xs items-center">
                  <span className="font-mono font-medium">{r.code}</span>
                  <span className="truncate text-2xs text-desk-muted">
                    {r.name} · {r.count}
                  </span>
                  <span
                    className={clsx(
                      "font-mono text-2xs",
                      r.avgChange > 0 && "text-desk-up",
                      r.avgChange < 0 && "text-desk-down"
                    )}
                  >
                    {r.avgChange >= 0 ? "+" : ""}
                    {r.avgChange.toFixed(2)}%
                  </span>
                  <span className="font-mono text-2xs">
                    {r.pctUp.toFixed(0)}%
                  </span>
                  <span className="text-2xs font-mono truncate max-w-[9rem]">
                    {r.leaders
                      .map(
                        (l) =>
                          `${l.symbol} ${l.changePct >= 0 ? "+" : ""}${l.changePct.toFixed(1)}`
                      )
                      .join(" · ")}
                  </span>
                </div>
              </button>
            ))}
            {!momRows.length && !momRunning && (
              <div className="text-2xs text-desk-muted p-2">
                Momentum hesapla — sektör ort. % değişim, yükselen oranı, liderler.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-1 flex-wrap items-center">
            <select
              className="input w-auto"
              value={listId ? `wl:${listId}` : `sec:${sector}`}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith("wl:")) {
                  setListId(v.slice(3));
                } else {
                  setListId("");
                  setSector(v.slice(4));
                }
              }}
            >
              <optgroup label="Sektör">
                {codes.map((c) => (
                  <option key={c} value={`sec:${c}`}>
                    {c} · {BIST_SECTORS[c]?.name} (
                    {BIST_SECTORS[c]?.symbols.length ?? 0})
                  </option>
                ))}
              </optgroup>
              {watchlists.length > 0 && (
                <optgroup label="İzleme listesi">
                  {watchlists.map((w) => (
                    <option key={w.id} value={`wl:${w.id}`}>
                      {w.name} ({w.symbols.length})
                    </option>
                  ))}
                </optgroup>
              )}
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
            <select
              className="input w-auto"
              value={scanKind}
              onChange={(e) => setScanKind(e.target.value as ScanKind)}
            >
              <option value="macd">MACD cross</option>
              <option value="rsi">RSI 30/50/70</option>
              <option value="ifvg">IFVG</option>
              <option value="smc">SMC</option>
              <option value="qm">QM</option>
            </select>
            <button
              type="button"
              className="btn-accent text-2xs"
              disabled={running}
              onClick={runSectorScan}
            >
              {running ? `${progress.done}/${progress.total}` : "Tara"}
            </button>
          </div>

          {hits.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center">
              <button
                type="button"
                className="btn text-2xs"
                onClick={saveToList}
              >
                Listeye kaydet
              </button>
              <label className="text-2xs text-desk-muted flex items-center gap-1">
                Alarm %+
                <input
                  className="input w-12"
                  type="number"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={alertPct}
                  onChange={(e) => setAlertPct(Number(e.target.value) || 3)}
                />
              </label>
              <button
                type="button"
                className="btn text-2xs"
                onClick={bulkAlerts}
              >
                Toplu alarm ({selectedSyms.length})
              </button>
              <button
                type="button"
                className="btn text-2xs"
                onClick={() => {
                  const all = Object.fromEntries(
                    hits.map((h) => [h.symbol, true])
                  );
                  setSelected(all);
                }}
              >
                Tümünü seç
              </button>
            </div>
          )}

          {status && <p className="text-2xs text-desk-muted">{status}</p>}
          {running && (
            <div className="h-1 bg-desk-border rounded overflow-hidden">
              <div
                className="h-full bg-desk-accent transition-all"
                style={{
                  width: `${
                    progress.total
                      ? (100 * progress.done) / progress.total
                      : 0
                  }%`,
                }}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0">
            {hits.map((h) => (
              <div
                key={h.id}
                className="flex items-start gap-2 px-1 py-1 border-b border-desk-border/40 hover:bg-desk-elevated"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!selected[h.symbol]}
                  onChange={(e) =>
                    setSelected((s) => ({
                      ...s,
                      [h.symbol]: e.target.checked,
                    }))
                  }
                />
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => openSymbolInActive(h.symbol, "bist", timeframe)}
                >
                  <div className="text-xs">
                    <span className="font-medium">{h.symbol}</span>{" "}
                    <span
                      className={clsx(
                        "text-2xs",
                        h.bias === "bull" && "text-desk-up",
                        h.bias === "bear" && "text-desk-down"
                      )}
                    >
                      {h.label}
                    </span>
                  </div>
                  <div className="text-2xs text-desk-muted truncate">
                    {h.detail}
                  </div>
                </button>
              </div>
            ))}
            {!hits.length && !running && (
              <div className="text-2xs text-desk-muted p-2">
                Sektör + TF + tarama tipi seçip Tara.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
