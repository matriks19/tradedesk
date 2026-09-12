"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDeskStore } from "@/store/desk";
import type { Exchange, SymbolInfo, TickerQuote } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import clsx from "clsx";

export function WatchlistPanel() {
  const {
    watchlists,
    activeWatchlistId,
    setActiveWatchlist,
    openSymbolInActive,
    removeWatchlistSymbol,
    addWatchlistSymbol,
    createWatchlist,
    importWatchlistSymbols,
    deleteWatchlist,
    seedSectorWatchlists,
    seedBinanceWatchlists,
    ensureWatchlist,
    replaceWatchlistSymbols,
  } = useDeskStore();
  const list = watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];
  const [quotes, setQuotes] = useState<Record<string, TickerQuote>>({});
  const [browse, setBrowse] = useState<"off" | "binance" | "bist">("off");
  const [browseQ, setBrowseQ] = useState("");
  const [universe, setUniverse] = useState<SymbolInfo[]>([]);
  const [univTotal, setUnivTotal] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkEx, setBulkEx] = useState<Exchange>("binance");
  const [newListName, setNewListName] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [seedMsg, setSeedMsg] = useState("");
  const [perpMsg, setPerpMsg] = useState("");
  const [perpBusy, setPerpBusy] = useState(false);
  type WlSortKey = "symbol" | "last" | "changePct";
  const [sortKey, setSortKey] = useState<WlSortKey>("changePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = useCallback((key: WlSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "symbol" ? "asc" : "desc");
      return key;
    });
  }, []);
  const sortedSymbols = useMemo(() => {
    if (!list) return [];
    const copy = [...list.symbols];
    copy.sort((a, b) => {
      const qa = quotes[`${a.exchange}:${a.symbol}`];
      const qb = quotes[`${b.exchange}:${b.symbol}`];
      let cmp = 0;
      if (sortKey === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol);
      } else if (sortKey === "last") {
        cmp = (qa?.last ?? -Infinity) - (qb?.last ?? -Infinity);
      } else {
        cmp = (qa?.changePct ?? -Infinity) - (qb?.changePct ?? -Infinity);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [list, quotes, sortKey, sortDir]);

  useEffect(() => {
    if (!list) return;
    let cancelled = false;
    const load = async () => {
      const byEx = {
        binance: list.symbols.filter((s) => s.exchange === "binance").map((s) => s.symbol),
        bist: list.symbols.filter((s) => s.exchange === "bist").map((s) => s.symbol),
      };
      const map: Record<string, TickerQuote> = {};
      if (byEx.binance.length) {
        for (let i = 0; i < byEx.binance.length; i += 80) {
          const ch = byEx.binance.slice(i, i + 80);
          const res = await fetch(
            `/api/ticker?exchange=binance&symbols=${ch.join(",")}`
          );
          const json = await res.json();
          for (const q of json.quotes ?? []) map[`${q.exchange}:${q.symbol}`] = q;
        }
      }
      if (byEx.bist.length) {
        const res = await fetch(
          `/api/ticker?exchange=bist&symbols=${byEx.bist.join(",")}`
        );
        const json = await res.json();
        for (const q of json.quotes ?? []) map[`${q.exchange}:${q.symbol}`] = q;
      }
      if (!cancelled) setQuotes(map);
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [list]);

  useEffect(() => {
    if (browse === "off") return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ exchange: browse, limit: "5000" });
      if (browseQ) params.set("q", browseQ);
      const res = await fetch(`/api/symbols?${params}`);
      const json = await res.json();
      if (!cancelled) {
        setUniverse(json.symbols ?? []);
        setUnivTotal(Number(json.total ?? 0));
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [browse, browseQ]);

  if (!list) {
    return <div className="p-3 text-xs text-desk-muted">İzleme listesi yok</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 p-2 border-b border-desk-border overflow-x-auto">
        {watchlists.map((w) => (
          <button
            key={w.id}
            type="button"
            className={clsx(
              "btn whitespace-nowrap text-2xs",
              w.id === list.id && "btn-accent"
            )}
            onClick={() => setActiveWatchlist(w.id)}
          >
            {w.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1 px-2 py-1 border-b border-desk-border flex-wrap">
        <button
          type="button"
          className={clsx("btn text-2xs", browse === "binance" && "btn-accent")}
          onClick={() => setBrowse(browse === "binance" ? "off" : "binance")}
        >
          Tüm USDT
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", browse === "bist" && "btn-accent")}
          onClick={() => setBrowse(browse === "bist" ? "off" : "bist")}
        >
          Tüm BIST
        </button>
        <button
          type="button"
          className="btn text-2xs"
          title="XBANK, XGIDA, … ve BIST Tümü izleme listelerini oluştur"
          onClick={() => {
            const r = seedSectorWatchlists();
            setSeedMsg(
              `Sektör: ${r.created} yeni, ${r.skipped} mevcut`
            );
          }}
        >
          Sektör listelerini oluştur
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={perpBusy}
          title="Tüm USDT-M perpetual (.P) + AI listesi — AIO/AIOT önce"
          onClick={async () => {
            setPerpBusy(true);
            setPerpMsg("");
            try {
              const { sortPerpsAiFirst, isAiPerp, toPerpDisplay } =
                await import("@/lib/data/binanceLists");
              const snap = seedBinanceWatchlists();
              setActiveWatchlist("binance-ai-usdt");
              setPerpMsg(
                `Snapshot: ${snap.created} yeni, ${snap.updated} güncellendi`
              );
              let live: string[] = [];
              try {
                const res = await fetch(
                  "/api/ticker?exchange=binance&market=perp"
                );
                const json = await res.json();
                live = (json.quotes ?? [])
                  .map((q: { symbol?: string }) =>
                    toPerpDisplay(String(q.symbol ?? ""))
                  )
                  .filter((s: string) => /\.P$/i.test(s) && s.length > 3);
              } catch {
                /* ticker may 418 */
              }
              if (!live.length) {
                try {
                  const res = await fetch(
                    "/api/symbols?exchange=binance&limit=5000"
                  );
                  const json = await res.json();
                  live = (json.symbols ?? [])
                    .map((s: { symbol?: string }) =>
                      toPerpDisplay(String(s.symbol ?? ""))
                    )
                    .filter((s: string) => /\.P$/i.test(s) && s.length > 3);
                } catch {
                  /* keep snapshot */
                }
              }
              if (live.length) {
                const all = sortPerpsAiFirst(Array.from(new Set(live)));
                const ai = all.filter(isAiPerp);
                ensureWatchlist("binance-perp-usdt", "BN Perp · USDT.P");
                ensureWatchlist("binance-ai-usdt", "BN AI · USDT.P");
                replaceWatchlistSymbols(
                  "binance-perp-usdt",
                  all.join("\n"),
                  "binance"
                );
                replaceWatchlistSymbols(
                  "binance-ai-usdt",
                  ai.join("\n"),
                  "binance"
                );
                setPerpMsg(`BN Perp ${all.length} · AI ${ai.length} (AIO/AIOT önce)`);
              }
              setActiveWatchlist("binance-ai-usdt");
              try {
                await fetch("/api/store", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    watchlists: useDeskStore.getState().watchlists,
                  }),
                });
              } catch {
                /* in-memory lists still usable */
              }
            } catch (e) {
              setPerpMsg(e instanceof Error ? e.message : "hata");
            } finally {
              setPerpBusy(false);
            }
          }}
        >
          {perpBusy ? "Perp…" : "BN Perp + AI (hepsi)"}
        </button>
        {seedMsg ? (
          <span className="text-2xs text-desk-muted">{seedMsg}</span>
        ) : null}
        {perpMsg ? (
          <span className="text-2xs text-desk-muted">{perpMsg}</span>
        ) : null}
        <button
          type="button"
          className={clsx("btn text-2xs", bulkOpen && "btn-accent")}
          onClick={() => {
            setBulkOpen((v) => !v);
            setBrowse("off");
          }}
        >
          Toplu
        </button>
        {watchlists.length > 1 && (
          <button
            type="button"
            className="btn text-2xs text-desk-down"
            title="Listeyi sil"
            onClick={() => {
              if (confirm(`"${list.name}" silinsin mi?`)) deleteWatchlist(list.id);
            }}
          >
            Sil
          </button>
        )}
      </div>
      {bulkOpen && (
        <div className="p-2 border-b border-desk-border space-y-1.5">
          <div className="text-2xs text-desk-muted">
            Satır veya virgülle yapıştır · BINANCE:BTCUSDT / BIST:THYAO destekli
          </div>
          <textarea
            className="input min-h-[72px] font-mono text-2xs"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"BTCUSDT, ETHUSDT\nSOLUSDT"}
          />
          <div className="flex gap-1 items-center flex-wrap">
            <select
              className="input w-auto py-1 text-2xs"
              value={bulkEx}
              onChange={(e) => setBulkEx(e.target.value as Exchange)}
            >
              <option value="binance">Binance</option>
              <option value="bist">BIST</option>
            </select>
            <button
              type="button"
              className="btn btn-accent text-2xs"
              onClick={() => {
                const n = importWatchlistSymbols(list.id, bulkText, bulkEx);
                setBulkMsg(`${n} sembol işlendi`);
                setBulkText("");
              }}
            >
              İçe aktar
            </button>
          </div>
          <div className="flex gap-1 items-center flex-wrap">
            <input
              className="input flex-1 text-2xs"
              placeholder="Yeni liste adı"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <button
              type="button"
              className="btn text-2xs"
              onClick={() => {
                const id = createWatchlist(newListName || "Yeni liste");
                if (bulkText.trim()) {
                  const n = importWatchlistSymbols(id, bulkText, bulkEx);
                  setBulkMsg(`Liste + ${n} sembol`);
                } else {
                  setBulkMsg("Liste oluşturuldu");
                }
                setNewListName("");
                setBulkText("");
              }}
            >
              Yeni liste
            </button>
          </div>
          {bulkMsg && (
            <div className="text-2xs text-desk-muted">{bulkMsg}</div>
          )}
        </div>
      )}
      {browse !== "off" ? (
        <UniverseBrowser
          exchange={browse}
          q={browseQ}
          setQ={setBrowseQ}
          symbols={universe}
          total={univTotal}
          onOpen={(sym, ex) => openSymbolInActive(sym, ex)}
          onAdd={(sym, ex) => addWatchlistSymbol(list.id, sym, ex)}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-desk-panel text-desk-muted text-2xs">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">
                  <button type="button" className="hover:text-desk-accent" onClick={() => toggleSort("symbol")}>
                    Sembol{sortKey === "symbol" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
                <th className="text-right px-2 py-1.5 font-medium">
                  <button type="button" className="hover:text-desk-accent" onClick={() => toggleSort("last")}>
                    Fiyat{sortKey === "last" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
                <th className="text-right px-2 py-1.5 font-medium">
                  <button type="button" className="hover:text-desk-accent" onClick={() => toggleSort("changePct")}>
                    Değişim{sortKey === "changePct" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {sortedSymbols.map((s) => {
                const q = quotes[`${s.exchange}:${s.symbol}`];
                return (
                  <tr
                    key={`${s.exchange}-${s.symbol}`}
                    className="border-t border-desk-border/60 hover:bg-desk-elevated cursor-pointer"
                    onClick={() => openSymbolInActive(s.symbol, s.exchange)}
                  >
                    <td className="px-2 py-1.5">
                      <span className="font-medium">{s.symbol}</span>
                      {s.exchange === "bist" && (
                        <span className="ml-1"><Badge tone="warn">BIST</Badge></span>
                      )}
                      {s.exchange === "binance" && /\.P$/i.test(s.symbol) && (
                        <span className="ml-1"><Badge tone="accent">P</Badge></span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {q ? q.last.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—"}
                    </td>
                    <td
                      className={clsx(
                        "px-2 py-1.5 text-right font-mono",
                        q && q.changePct >= 0 ? "text-desk-up" : "text-desk-down"
                      )}
                    >
                      {q ? `${q.changePct.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-1">
                      <button
                        type="button"
                        className="text-desk-muted hover:text-desk-down text-2xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWatchlistSymbol(list.id, s.symbol);
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UniverseBrowser({
  exchange,
  q,
  setQ,
  symbols,
  total,
  onOpen,
  onAdd,
}: {
  exchange: Exchange;
  q: string;
  setQ: (v: string) => void;
  symbols: SymbolInfo[];
  total: number;
  onOpen: (s: string, e: Exchange) => void;
  onAdd: (s: string, e: Exchange) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rowH = 28;
  const filtered = useMemo(() => symbols, [symbols]);
  const visible = 18;
  const start = Math.max(0, Math.floor(scrollTop / rowH) - 2);
  const end = Math.min(filtered.length, start + visible + 4);
  const slice = filtered.slice(start, end);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-2 border-b border-desk-border">
        <input
          className="input"
          placeholder={exchange === "binance" ? "USDT ara (aio, btc…)" : "BIST ara…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="text-2xs text-desk-muted mt-1">
          {total} sembol · {exchange === "binance" ? "Binance USDT spot+perp" : "BIST"}
        </div>
      </div>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: filtered.length * rowH, position: "relative" }}>
          {slice.map((s, i) => {
            const idx = start + i;
            return (
              <div
                key={s.symbol}
                className="absolute left-0 right-0 flex items-center px-2 text-xs hover:bg-desk-elevated"
                style={{ top: idx * rowH, height: rowH }}
              >
                <button
                  type="button"
                  className="flex-1 text-left font-medium truncate"
                  onClick={() => onOpen(s.symbol, exchange)}
                >
                  {s.symbol}
                  <span className="text-desk-muted text-2xs ml-2">
                    {s.name || s.base || ""}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn text-2xs"
                  onClick={() => onAdd(s.symbol, exchange)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
        {!filtered.length && (
          <div className="text-2xs text-desk-muted p-3">
            Sonuç yok — sembol listede olmayabilir.
          </div>
        )}
      </div>
    </div>
  );
}
