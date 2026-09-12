"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import type { Candle, Exchange, Timeframe, TickerQuote } from "@/lib/types";
import { mapPool } from "@/lib/scanner/engine";
import {
  detectEliziEdgeCross,
  type EliziBias,
} from "@/lib/scanner/eliziScan";
import {
  DEFAULT_MAX_BARS_AGO,
  FRESHNESS_OPTIONS,
  clampMaxBarsAgo,
} from "@/lib/scanner/freshness";
import { useDeskStore } from "@/store/desk";
import {
  fetchScanQuotes,
  type BistScanSource,
  type BinanceMarket,
} from "@/lib/data/scanUniverse";
import { sectorCodes, BIST_SECTORS } from "@/lib/data/bistSectors";
import { fetchWatchlistQuotes } from "@/lib/scanner/watchlistQuotes";

const TF_CHIPS: { value: Timeframe; label: string }[] = [
  { value: "15m", label: "15" },
  { value: "30m", label: "30" },
  { value: "1h", label: "60" },
  { value: "2h", label: "120" },
  { value: "4h", label: "240" },
];

const ALL_TFS = TF_CHIPS.map((t) => t.value);

type DirectionFilter = "all" | "al" | "sat";
type UniverseMode = "market" | "watchlist";

type Row = {
  id: string;
  symbol: string;
  exchange: Exchange;
  timeframe: Timeframe;
  bias: EliziBias;
  barsAgo: number;
  kind: "edge_cross" | "phase_fire";
  edgeTemp: number;
  coherence: number;
  volume: number;
};

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function EliziScanPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const addAlertsBulk = useDeskStore((s) => s.addAlertsBulk);
  const addIndicator = useDeskStore((s) => s.addIndicator);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);
  const watchlists = useDeskStore((s) => s.watchlists);
  const activeWatchlistId = useDeskStore((s) => s.activeWatchlistId);

  const [exchange, setExchange] = useState<Exchange>("binance");
  const [bistSource, setBistSource] = useState<BistScanSource>("all");
  const [binanceMarket, setBinanceMarket] =
    useState<"spot_top" | "perp_top" | "perp_all">("spot_top");
  const [sectorCode, setSectorCode] = useState("XBANK");
  const [tfs, setTfs] = useState<Timeframe[]>([...ALL_TFS]);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [maxBarsAgo, setMaxBarsAgo] = useState(DEFAULT_MAX_BARS_AGO);
  const [freshOnly, setFreshOnly] = useState(true);
  const [universe, setUniverse] = useState<UniverseMode>("market");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");

  const toggleTf = (tf: Timeframe) => {
    setTfs((prev) =>
      prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]
    );
  };

  const run = useCallback(async (universeOverride?: UniverseMode) => {
    const uni = universeOverride ?? universe;
    if (!tfs.length) {
      setStatus("En az bir zaman dilimi seçin (15–240)");
      return;
    }
    const lookback = freshOnly
      ? clampMaxBarsAgo(maxBarsAgo)
      : clampMaxBarsAgo(Math.max(maxBarsAgo, 20));
    setRunning(true);
    setRows([]);
    setStatus("");
    try {
      let quotes: TickerQuote[] = [];
      let note = "";
      if (uni === "watchlist") {
        const list =
          watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
        if (!list?.symbols.length) {
          setStatus("Aktif izleme listesi boş");
          return;
        }
        quotes = await fetchWatchlistQuotes(list.symbols);
        note = `liste: ${list.name}`;
      } else {
        const fetched = await fetchScanQuotes({
          exchange,
          source: bistSource,
          sectorCode: bistSource === "sector" ? sectorCode : undefined,
          binanceTop:
            binanceMarket === "perp_all"
              ? 700
              : binanceMarket === "perp_top"
                ? 80
                : 80,
          binanceMarket:
            binanceMarket === "spot_top" ? "spot" : ("perp" as BinanceMarket),
        });
        quotes = fetched.quotes;
        note = fetched.note || "";
        if (exchange === "bist" && quotes.length === 0) {
          setStatus(
            note ||
              "BIST kotasyonları boş — Yahoo rate-limit. Elizi taraması için kotasyon gerekli."
          );
          return;
        }
        if (exchange === "bist") {
          quotes = [...quotes].sort(
            (a, b) => (b.volume ?? 0) - (a.volume ?? 0)
          );
          if (bistSource === "all" && tfs.length > 2) {
            quotes = quotes.slice(0, 320);
          }
        }
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
            const ex = job.quote.exchange ?? exchange;
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(job.quote.symbol)}&exchange=${ex}&timeframe=${job.tf}&limit=180`
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < 50) return null;
            const hit = detectEliziEdgeCross(candles, {
              maxBarsAgo: lookback,
            });
            if (!hit) return null;
            if (freshOnly && hit.barsAgo > maxBarsAgo) return null;
            if (direction === "al" && hit.bias !== "bull") return null;
            if (direction === "sat" && hit.bias !== "bear") return null;
            out.push({
              id: `${job.quote.symbol}_${job.tf}_${hit.bias}_${hit.kind}_${hit.barsAgo}`,
              symbol: job.quote.symbol,
              exchange: ex,
              timeframe: job.tf,
              bias: hit.bias,
              barsAgo: hit.barsAgo,
              kind: hit.kind,
              edgeTemp: hit.edgeTemp,
              coherence: hit.coherence,
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
          b.edgeTemp - a.edgeTemp ||
          a.symbol.localeCompare(b.symbol)
      );
      setRows(out.slice(0, 150));
      const tfLabel = tfs
        .map((t) => TF_CHIPS.find((c) => c.value === t)?.label ?? t)
        .join("/");
      setStatus(
        `${out.length} sinyal · ${quotes.length} sembol · TF ${tfLabel} · ≤${freshOnly ? maxBarsAgo : lookback} mum${note ? ` · ${note}` : ""}`
      );
    } finally {
      setRunning(false);
    }
  }, [
    exchange,
    bistSource,
    sectorCode,
    binanceMarket,
    tfs,
    direction,
    maxBarsAgo,
    freshOnly,
    universe,
    watchlists,
    activeWatchlistId,
  ]);

  const openHit = (r: Row) => {
    setOverlayPattern(null);
    openSymbolInActive(r.symbol, r.exchange, r.timeframe);
    const s = useDeskStore.getState();
    const pane = s.panes.find((p) => p.id === s.activePaneId) ?? s.panes[0];
    if (pane && !pane.indicators.some((i) => i.type === "eliziEdge")) {
      addIndicator(pane.id, "eliziEdge");
    }
  };

  const bulkAlerts = async () => {
    if (!rows.length) return;
    const byEx = new Map<Exchange, string[]>();
    for (const r of rows) {
      const arr = byEx.get(r.exchange) ?? [];
      if (!arr.includes(r.symbol)) arr.push(r.symbol);
      byEx.set(r.exchange, arr);
    }
    const items: Parameters<typeof addAlertsBulk>[0] = [];
    for (const [ex, syms] of byEx) {
      const res = await fetch(
        `/api/ticker?exchange=${ex}&symbols=${syms.join(",")}`
      );
      const json = await res.json();
      const by = new Map<string, number>();
      for (const q of json.quotes ?? []) {
        if (q?.symbol && Number.isFinite(q.last)) by.set(q.symbol, Number(q.last));
      }
      for (const sym of syms) {
        const last = by.get(sym);
        if (last == null || !Number.isFinite(last)) continue;
        items.push({
          symbol: sym,
          exchange: ex,
          condition: "cross_above",
          price: Number((last * 1.03).toFixed(4)),
          note: "Elizi tarama +%3",
          lastPrice: last,
        });
      }
    }
    const n = addAlertsBulk(items);
    setStatus(`${n} alarm eklendi (+%3)`);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Elizi Edge Tarama</div>
      <p className="text-2xs text-desk-muted">
        ±E kesişimi (edgeUp×edgeDown) veya faz→ateş. MACD ile karışmaz. Varsayılan
        tazelik ≤{DEFAULT_MAX_BARS_AGO} bar.
      </p>

      <div className="flex gap-1 flex-wrap items-center">
        <select
          className="input w-auto"
          value={universe}
          onChange={(e) => setUniverse(e.target.value as UniverseMode)}
          title="Evren"
        >
          <option value="market">Piyasa</option>
          <option value="watchlist">Aktif liste</option>
        </select>
        {universe === "market" && (
          <>
            <select
              className="input w-auto"
              value={exchange}
              onChange={(e) => setExchange(e.target.value as Exchange)}
            >
              <option value="binance">Binance</option>
              <option value="bist">BIST</option>
            </select>
            {exchange === "bist" && (
              <>
                <select
                  className="input w-auto"
                  value={bistSource}
                  onChange={(e) =>
                    setBistSource(e.target.value as BistScanSource)
                  }
                >
                  <option value="bist30">Kaynak: BIST30</option>
                  <option value="liquid">Kaynak: Likit</option>
                  <option value="all">Kaynak: Tümü (~650)</option>
                  <option value="sector">Kaynak: Sektör</option>
                </select>
                {bistSource === "sector" && (
                  <select
                    className="input w-auto"
                    value={sectorCode}
                    onChange={(e) => setSectorCode(e.target.value)}
                  >
                    {sectorCodes().map((c) => (
                      <option key={c} value={c}>
                        {c} · {BIST_SECTORS[c]?.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            {exchange === "binance" && (
              <select
                className="input w-auto"
                value={binanceMarket}
                onChange={(e) =>
                  setBinanceMarket(
                    e.target.value as "spot_top" | "perp_top" | "perp_all"
                  )
                }
              >
                <option value="spot_top">Kaynak: Spot top</option>
                <option value="perp_top">Kaynak: Perp top</option>
                <option value="perp_all">Kaynak: Perp tümü</option>
              </select>
            )}
          </>
        )}
        <select
          className="input w-auto"
          value={direction}
          onChange={(e) => setDirection(e.target.value as DirectionFilter)}
        >
          <option value="all">Hepsi</option>
          <option value="al">Sadece AL</option>
          <option value="sat">Sadece SAT</option>
        </select>
        <span className="text-2xs text-desk-muted">Max bar</span>
        {FRESHNESS_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            className={clsx("btn text-2xs", maxBarsAgo === n && "btn-accent")}
            onClick={() => setMaxBarsAgo(n)}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className={clsx("btn text-2xs", freshOnly && "btn-accent")}
          onClick={() => setFreshOnly((v) => !v)}
          title="Eski sinyalleri gizle"
        >
          Sadece ≤{maxBarsAgo} bar
        </button>
        <button
          type="button"
          className="btn-accent"
          disabled={running}
          onClick={() => void run()}
        >
          {running ? `${progress.done}/${progress.total}` : "Tara"}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={running}
          title="Aktif izleme listesini tara"
          onClick={() => {
            setUniverse("watchlist");
            void run("watchlist");
          }}
        >
          Listeyi tara
        </button>
      </div>

      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-2xs text-desk-muted mr-0.5">TF:</span>
        {TF_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={clsx("btn text-2xs", tfs.includes(c.value) && "btn-accent")}
            onClick={() => toggleTf(c.value)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => setTfs([...ALL_TFS])}
        >
          Hepsi
        </button>
      </div>

      {rows.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <button type="button" className="btn text-2xs" onClick={bulkAlerts}>
            Toplu alarm (+%3)
          </button>
        </div>
      )}
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
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-1.5 px-1 py-1 text-2xs text-desk-muted border-b border-desk-border/40 sticky top-0 bg-desk-bg">
          <span>Sembol</span>
          <span>TF</span>
          <span>Yön</span>
          <span title="N mum önce">N</span>
          <span>Temp</span>
          <span>Tür</span>
        </div>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            className="w-full text-left px-1 py-1 border-b border-desk-border/40 hover:bg-desk-elevated"
            onClick={() => openHit(r)}
          >
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-1.5 text-xs items-center font-mono">
              <span className="font-sans font-medium truncate">{r.symbol}</span>
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
              <span className="text-2xs">{fmtNum(r.edgeTemp)}</span>
              <span className="text-2xs text-desk-muted">
                {r.kind === "edge_cross" ? "±E" : "Ateş"}
              </span>
            </div>
          </button>
        ))}
        {!rows.length && !running && (
          <div className="text-2xs text-desk-muted p-2">
            TF seçip Tara — taze Elizi Edge AL/SAT (≤ max bar).
          </div>
        )}
      </div>
    </div>
  );
}
