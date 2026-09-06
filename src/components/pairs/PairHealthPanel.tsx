"use client";

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { BIST30 } from "@/lib/data/bistLists";
import type { Candle } from "@/lib/types";
import {
  computePairHealth,
  syntheticIndexFromCloses,
  toScanRow,
  pairCombinations,
  type ClosePoint,
  type PairScanRow,
  type PairHealthResult,
} from "@/lib/pairs";
import { mapPool } from "@/lib/scanner/engine";
import { useDeskStore } from "@/store/desk";

type Mode = "vs_index" | "pairs";

function toCloses(candles: Candle[]): ClosePoint[] {
  return candles
    .filter((c) => c.close > 0 && Number.isFinite(c.close))
    .map((c) => ({ time: c.time, close: c.close }));
}

function fmt(n: number | undefined | null, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function fmtHl(n: number): string {
  if (!Number.isFinite(n) || n === Infinity) return "∞";
  return n < 10 ? n.toFixed(1) : n.toFixed(0);
}

export function PairHealthPanel() {
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);

  const [mode, setMode] = useState<Mode>("vs_index");
  const [indexSym, setIndexSym] = useState("XU100");
  const [timeframe, setTimeframe] = useState<"1d" | "4h">("1d");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [rows, setRows] = useState<PairScanRow[]>([]);
  const [selected, setSelected] = useState<PairScanRow | null>(null);

  const teaching = useMemo(
    () =>
      "Cointegration ≠ correlation. Pair Health: ilişki BUGÜN hâlâ tradeable mi? (corr60/stab, beta stab, ADF, half-life 5–40).",
    []
  );

  const run = useCallback(async () => {
    setRunning(true);
    setRows([]);
    setSelected(null);
    setNotes([]);
    setStatus("Kline çekiliyor…");
    const localNotes: string[] = [];

    try {
      const symbols = [...BIST30];
      const limit = timeframe === "1d" ? 250 : 300;

      // Fetch all BIST30 klines
      setProgress({ done: 0, total: symbols.length });
      const seriesMap = new Map<string, ClosePoint[]>();
      await mapPool(
        symbols,
        3,
        async (sym) => {
          try {
            const res = await fetch(
              `/api/klines?symbol=${encodeURIComponent(sym)}&exchange=bist&timeframe=${timeframe}&limit=${limit}`
            );
            const json = await res.json();
            const closes = toCloses(json.candles ?? []);
            if (closes.length >= 40) seriesMap.set(sym, closes);
          } catch {
            /* skip */
          }
          return null;
        },
        (done, total) => setProgress({ done, total })
      );

      if (seriesMap.size < 3) {
        setStatus(
          `Yetersiz veri (${seriesMap.size}/${symbols.length}). Yahoo rate-limit olabilir — tekrar deneyin.`
        );
        return;
      }

      let indexLabel = indexSym.toUpperCase();
      let indexCloses: ClosePoint[] = [];

      if (mode === "vs_index") {
        setStatus(`Endeks ${indexLabel} çekiliyor…`);
        const tryIndex = async (sym: string) => {
          const res = await fetch(
            `/api/klines?symbol=${encodeURIComponent(sym)}&exchange=bist&timeframe=${timeframe}&limit=${limit}`
          );
          const json = await res.json();
          return toCloses(json.candles ?? []);
        };

        indexCloses = await tryIndex(indexLabel);
        if (indexCloses.length < 40 && indexLabel !== "XU030") {
          const alt = await tryIndex("XU030");
          if (alt.length >= 40) {
            indexCloses = alt;
            indexLabel = "XU030";
            localNotes.push("XU100 başarısız → XU030 kullanıldı");
          }
        }
        if (indexCloses.length < 40) {
          indexCloses = syntheticIndexFromCloses([...seriesMap.values()]);
          indexLabel = "SYN_BIST30";
          localNotes.push(
            "Endeks kline yok → BIST30 eşit ağırlıklı sentetik endeks (SYN_BIST30)"
          );
        }
      }

      setStatus("Pair Health hesaplanıyor…");
      const out: PairScanRow[] = [];

      if (mode === "vs_index") {
        const note = localNotes[0];
        for (const [sym, closes] of seriesMap) {
          const r = computePairHealth(
            sym,
            indexLabel,
            closes,
            indexCloses,
            {},
            note
          );
          if (r) out.push(toScanRow(r));
        }
      } else {
        const syms = [...seriesMap.keys()];
        const combos = pairCombinations(syms);
        setProgress({ done: 0, total: combos.length });
        const scored: { row: PairScanRow; absCorr: number }[] = [];
        let done = 0;
        for (const [a, b] of combos) {
          const r = computePairHealth(
            a,
            b,
            seriesMap.get(a)!,
            seriesMap.get(b)!
          );
          done++;
          if (done % 20 === 0) setProgress({ done, total: combos.length });
          if (!r) continue;
          scored.push({ row: toScanRow(r), absCorr: Math.abs(r.corr60) || 0 });
        }
        scored.sort((x, y) => y.absCorr - x.absCorr);
        // Prefer healthy + correlated
        const top = scored
          .slice(0, 80)
          .sort((x, y) => y.row.healthScore - x.row.healthScore)
          .slice(0, 40);
        out.push(...top.map((t) => t.row));
      }

      out.sort((a, b) => b.healthScore - a.healthScore);
      setRows(out);
      setNotes(localNotes);
      setStatus(
        `${out.length} çift · ${seriesMap.size} hisse yüklendi` +
          (mode === "vs_index" ? ` · endeks ${indexLabel}` : "")
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [mode, indexSym, timeframe]);

  const detail: PairHealthResult | null = selected?.result ?? null;

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-1.5 text-xs">
      <div className="font-medium">Pair Health</div>
      <p className="text-2xs text-desk-muted leading-snug">{teaching}</p>

      <div className="flex flex-wrap gap-1 items-center">
        <select
          className="input w-auto text-2xs"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          <option value="vs_index">Hisse–Endeks</option>
          <option value="pairs">Hisse–Hisse</option>
        </select>
        {mode === "vs_index" && (
          <input
            className="input w-[72px] text-2xs"
            value={indexSym}
            onChange={(e) => setIndexSym(e.target.value.toUpperCase())}
            title="Endeks sembolü"
          />
        )}
        <select
          className="input w-auto text-2xs"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as "1d" | "4h")}
        >
          <option value="1d">1d</option>
          <option value="4h">4h</option>
        </select>
        <span className="text-2xs text-desk-muted">BIST30</span>
        <button
          type="button"
          className="btn text-2xs ml-auto"
          disabled={running}
          onClick={run}
        >
          {running ? "Taranıyor…" : "Tara"}
        </button>
      </div>

      {running && (
        <div className="text-2xs text-desk-muted">
          {progress.done}/{progress.total} · {status}
        </div>
      )}
      {!running && status && (
        <div className="text-2xs text-desk-muted truncate" title={status}>
          {status}
        </div>
      )}
      {notes.map((n) => (
        <div key={n} className="text-2xs text-desk-warn">
          {n}
        </div>
      ))}

      <div className="flex-1 min-h-0 overflow-auto border border-desk-border rounded">
        <table className="w-full text-2xs border-collapse">
          <thead className="sticky top-0 bg-desk-panel">
            <tr className="text-desk-muted text-left">
              <th className="p-1">Çift</th>
              <th className="p-1">Skor</th>
              <th className="p-1">C60</th>
              <th className="p-1">Δ</th>
              <th className="p-1">β</th>
              <th className="p-1">HL</th>
              <th className="p-1">Coint</th>
              <th className="p-1">Z</th>
              <th className="p-1">Sinyal</th>
              <th className="p-1">Hedef</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sig = r.lastSignal;
              const active = selected?.pair === r.pair;
              return (
                <tr
                  key={r.pair}
                  className={clsx(
                    "border-t border-desk-border/60 cursor-pointer hover:bg-white/5",
                    active && "bg-white/10"
                  )}
                  onClick={() => setSelected(r)}
                >
                  <td className="p-1 font-mono whitespace-nowrap">{r.pair}</td>
                  <td
                    className={clsx(
                      "p-1 font-mono",
                      r.healthScore >= 70
                        ? "text-emerald-400"
                        : r.healthScore >= 45
                          ? "text-amber-300"
                          : "text-desk-muted"
                    )}
                  >
                    {r.healthScore}
                  </td>
                  <td className="p-1 font-mono">{fmt(r.corr60, 2)}</td>
                  <td
                    className={clsx(
                      "p-1 font-mono",
                      (r.corrDelta ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {fmt(r.corrDelta, 2)}
                  </td>
                  <td className="p-1 font-mono" title={`βstab=${fmt(r.betaStab, 2)}`}>
                    {fmt(r.beta, 2)}
                    <span className="text-desk-muted">/{fmt(r.betaStab, 2)}</span>
                  </td>
                  <td className="p-1 font-mono">{fmtHl(r.halfLife)}</td>
                  <td
                    className={clsx(
                      "p-1",
                      r.cointLabel === "OK"
                        ? "text-emerald-400"
                        : r.cointLabel === "Zayıf"
                          ? "text-amber-300"
                          : "text-desk-muted"
                    )}
                  >
                    {r.cointLabel}
                  </td>
                  <td
                    className={clsx(
                      "p-1 font-mono",
                      (r.zNow ?? 0) <= -1.5
                        ? "text-emerald-400"
                        : (r.zNow ?? 0) >= 1.5
                          ? "text-red-400"
                          : ""
                    )}
                  >
                    {fmt(r.zNow, 2)}
                  </td>
                  <td className="p-1 whitespace-nowrap">
                    {sig ? (
                      <span
                        className={clsx(
                          sig.side === "AL"
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {sig.side} {sig.barsAgo}m
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-1 font-mono truncate max-w-[72px]" title={r.targetLabel}>
                    {r.targetLabel}
                  </td>
                </tr>
              );
            })}
            {!rows.length && !running && (
              <tr>
                <td colSpan={10} className="p-2 text-desk-muted">
                  BIST30 tara — Hisse–Endeks veya Hisse–Hisse.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="shrink-0 max-h-[42%] overflow-auto border border-desk-border rounded p-1.5 space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium font-mono">{detail.symbolA}</span>
            <span className="text-desk-muted">vs</span>
            <span className="font-mono">{detail.symbolB}</span>
            <span className="text-2xs text-desk-muted ml-auto">
              n={detail.n} · βstab={fmt(detail.betaStab, 2)} · ADF=
              {fmt(detail.adfStat, 2)}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn text-2xs"
              onClick={() => openSymbolInActive(detail.symbolA, "bist", timeframe)}
            >
              Aç {detail.symbolA}
            </button>
            {!detail.symbolB.startsWith("SYN_") && (
              <button
                type="button"
                className="btn text-2xs"
                onClick={() =>
                  openSymbolInActive(detail.symbolB, "bist", timeframe)
                }
              >
                Aç {detail.symbolB}
              </button>
            )}
          </div>

          <div className="text-2xs text-desk-muted">
            Corr 30/60/90: {fmt(detail.corr30)} / {fmt(detail.corr60)} /{" "}
            {fmt(detail.corr90)} · Z={fmt(detail.zNow)} · HL=
            {fmtHl(detail.halfLife)}
          </div>

          <div className="text-2xs font-medium">Al/Sat geçmişi</div>
          <table className="w-full text-2xs">
            <thead>
              <tr className="text-desk-muted text-left">
                <th className="pr-1">Yan</th>
                <th className="pr-1">Mum önce</th>
                <th className="pr-1">Z</th>
                <th className="pr-1">Fiyat A</th>
                <th>Hedef A</th>
              </tr>
            </thead>
            <tbody>
              {detail.signals
                .filter((s) => s.side !== "EXIT")
                .slice(-12)
                .reverse()
                .map((s, i) => (
                  <tr key={`${s.time}-${i}`} className="border-t border-desk-border/40">
                    <td
                      className={clsx(
                        "pr-1",
                        s.side === "AL" ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {s.side}
                    </td>
                    <td className="pr-1 font-mono">{s.barsAgo}</td>
                    <td className="pr-1 font-mono">{fmt(s.z)}</td>
                    <td className="pr-1 font-mono">{fmt(s.priceA)}</td>
                    <td className="font-mono">{fmt(s.targetA)}</td>
                  </tr>
                ))}
              {!detail.signals.some((s) => s.side !== "EXIT") && (
                <tr>
                  <td colSpan={5} className="text-desk-muted py-1">
                    Eşik sinyali yok (|z|&lt;2)
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="text-2xs font-medium">Fib / mean seviyeleri</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-2xs font-mono">
            {detail.fibLevels
              .filter((f) =>
                ["mean", "Fib 0.382", "Fib 0.5", "Fib 0.618", "mean+0.382", "mean-0.382"].includes(
                  f.label
                )
              )
              .map((f) => (
                <div key={f.label} className="flex justify-between gap-1">
                  <span className="text-desk-muted">{f.label}</span>
                  <span>
                    s={fmt(f.spread, 3)}
                    {f.priceA != null ? ` · A≈${fmt(f.priceA)}` : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
