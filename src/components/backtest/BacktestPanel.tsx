"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useDeskStore, TIMEFRAMES } from "@/store/desk";
import type { Exchange, Timeframe } from "@/lib/types";
import {
  AROON_LONG_SAMPLE,
  DI_ADX_SAMPLE,
  PRESET_LABELS,
  ZSCORE_PULLBACK_SAMPLE,
  exportResultJson,
  exportTradesCsv,
  recommendedWarmup,
  runBacktest,
  type BacktestParams,
  type BacktestResult,
  type StrategyPresetId,
} from "@/lib/backtest";
import clsx from "clsx";

const PRESETS = Object.keys(PRESET_LABELS) as StrategyPresetId[];

const SIGNAL_EXIT_PRESETS = new Set<StrategyPresetId>([
  "zScorePullback",
  "diAdxTrend",
  "aroonLongTrend",
  "jurikOsBounce",
  "codeStrategy",
]);

export function BacktestPanel() {
  const {
    panes,
    activePaneId,
    lastBacktest,
    setLastBacktest,
    backtestParams,
    setBacktestParams,
  } = useDeskStore();
  const active = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(
    backtestParams.strategyCode || ZSCORE_PULLBACK_SAMPLE
  );
  const equityRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const preset = (backtestParams.preset || "zScorePullback") as StrategyPresetId;

  const params: BacktestParams = {
    symbol: backtestParams.symbol || active?.symbol || "BTCUSDT",
    exchange: (backtestParams.exchange ||
      active?.exchange ||
      "binance") as Exchange,
    timeframe: (backtestParams.timeframe ||
      active?.timeframe ||
      "1d") as Timeframe,
    preset,
    strategyCode: code,
    allowShort: backtestParams.allowShort ?? preset !== "zScorePullback",
    useAtrStops: backtestParams.useAtrStops ?? !SIGNAL_EXIT_PRESETS.has(preset),
    useSignalExits: backtestParams.useSignalExits ?? true,
    slAtrMult: backtestParams.slAtrMult ?? 1.5,
    tpAtrMult: backtestParams.tpAtrMult ?? 2.5,
    positionSize: backtestParams.positionSize ?? 1000,
    commissionBps: backtestParams.commissionBps ?? 4,
    warmup:
      backtestParams.warmup ??
      recommendedWarmup(preset, backtestParams as BacktestParams),
    candleLimit: backtestParams.candleLimit ?? 1000,
    fast: backtestParams.fast ?? (preset === "zScorePullback" ? 5 : 9),
    slow: backtestParams.slow ?? 21,
    rsiPeriod: backtestParams.rsiPeriod ?? 14,
    rsiOs: backtestParams.rsiOs ?? 30,
    rsiOb: backtestParams.rsiOb ?? 70,
    atrPeriod: backtestParams.atrPeriod ?? 14,
    stMult: backtestParams.stMult ?? 3,
    bbPeriod: backtestParams.bbPeriod ?? 20,
    bbMult: backtestParams.bbMult ?? 2,
    zLength: backtestParams.zLength ?? 20,
    regimeSMA: backtestParams.regimeSMA ?? 200,
    entryZ: backtestParams.entryZ ?? -1.5,
    exitZ: backtestParams.exitZ ?? 0,
    adxPeriod: backtestParams.adxPeriod ?? 14,
    adxMin: backtestParams.adxMin ?? 25,
    aroonPeriod: backtestParams.aroonPeriod ?? 14,
  };

  const result = lastBacktest;

  const patch = (p: Partial<BacktestParams>) => setBacktestParams(p);

  const onPresetChange = (id: StrategyPresetId) => {
    const next: Partial<BacktestParams> = {
      preset: id,
      warmup: recommendedWarmup(id, { ...params, preset: id }),
      useAtrStops: !SIGNAL_EXIT_PRESETS.has(id),
      useSignalExits: true,
      allowShort: id !== "zScorePullback" && id !== "aroonLongTrend",
    };
    if (id === "zScorePullback") {
      next.fast = 5;
      next.timeframe = params.timeframe || "1d";
      setCode(ZSCORE_PULLBACK_SAMPLE);
      next.strategyCode = ZSCORE_PULLBACK_SAMPLE;
    }
    if (id === "codeStrategy" && !code.trim()) {
      setCode(ZSCORE_PULLBACK_SAMPLE);
      next.strategyCode = ZSCORE_PULLBACK_SAMPLE;
    }
    patch(next);
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const limit = Math.min(1000, Math.max(200, params.candleLimit ?? 1000));
      const res = await fetch(
        `/api/klines?symbol=${encodeURIComponent(params.symbol)}&exchange=${params.exchange}&timeframe=${params.timeframe}&limit=${limit}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kline hatası");
      const candles = json.candles ?? [];
      const need = Math.max(params.warmup + 10, 50);
      if (candles.length < need) {
        throw new Error(
          `Yetersiz mum (${candles.length}/${need}). TF büyüt veya warmup düşür.`
        );
      }
      const runParams = {
        ...params,
        strategyCode: params.preset === "codeStrategy" ? code : params.strategyCode,
      };
      const out = runBacktest(candles, runParams);
      setLastBacktest(out);
      if (out.codeWarnings?.length) {
        setError(out.codeWarnings.join(" · "));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!equityRef.current) return;
    if (!chartRef.current) {
      const chart = createChart(equityRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "#0e1218" },
          textColor: "#8b95a8",
        },
        grid: {
          vertLines: { color: "#1a1f27" },
          horzLines: { color: "#1a1f27" },
        },
        rightPriceScale: { borderColor: "#2a3140" },
        timeScale: { borderColor: "#2a3140", timeVisible: true },
        width: equityRef.current.clientWidth,
        height: 160,
      });
      const series = chart.addLineSeries({
        color: "#2962ff",
        lineWidth: 2,
        priceLineVisible: false,
      });
      chartRef.current = chart;
      seriesRef.current = series;
      const ro = new ResizeObserver(() => {
        if (!equityRef.current || !chartRef.current) return;
        chartRef.current.applyOptions({
          width: equityRef.current.clientWidth,
        });
      });
      ro.observe(equityRef.current);
      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    }
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !result?.equity?.length) return;
    seriesRef.current.setData(
      result.equity.map((e) => ({
        time: e.time as unknown as import("lightweight-charts").UTCTimestamp,
        value: e.equity,
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [result]);

  const summaryRows = useMemo(() => {
    if (!result) return [];
    const s = result.summary;
    return [
      ["Net PnL", s.netPnl.toFixed(2)],
      ["Profit Factor", Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞"],
      ["Win Rate", `${(s.winRate * 100).toFixed(1)}%`],
      ["Trades", String(s.trades)],
      ["Long / Short", `${s.longTrades} / ${s.shortTrades}`],
      ["Long PnL", s.longNetPnl.toFixed(2)],
      ["Short PnL", s.shortNetPnl.toFixed(2)],
      ["Avg Win / Loss", `${s.avgWin.toFixed(2)} / ${s.avgLoss.toFixed(2)}`],
      ["Best / Worst", `${s.bestTrade.toFixed(2)} / ${s.worstTrade.toFixed(2)}`],
      ["Max DD", `${s.maxDrawdown.toFixed(2)} (${(s.maxDrawdownPct * 100).toFixed(1)}%)`],
      ["Sharpe~", s.sharpe.toFixed(2)],
      ["Avg R", s.avgR.toFixed(2)],
      ["Expectancy", s.expectancy.toFixed(2)],
      ["Avg bars", s.avgBarsHeld.toFixed(1)],
      ["Candles", String(result.candleCount)],
    ];
  }, [result]);

  const download = (kind: "csv" | "json") => {
    if (!result) return;
    const text = kind === "csv" ? exportTradesCsv(result) : exportResultJson(result);
    const blob = new Blob([text], {
      type: kind === "csv" ? "text/csv" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest_${params.symbol}_${params.preset}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showCode = preset === "codeStrategy";

  return (
    <div className="flex flex-col h-full min-h-0 text-xs">
      <div className="p-2 border-b border-desk-border space-y-2 shrink-0 overflow-y-auto max-h-[52%]">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className="text-desk-muted">Sembol</span>
            <input
              className="input"
              value={params.symbol}
              onChange={(e) => patch({ symbol: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-desk-muted">Borsa</span>
            <select
              className="input"
              value={params.exchange}
              onChange={(e) => patch({ exchange: e.target.value as Exchange })}
            >
              <option value="binance">Binance</option>
              <option value="bist">BIST</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-desk-muted">TF</span>
            <select
              className="input"
              value={params.timeframe}
              onChange={(e) =>
                patch({ timeframe: e.target.value as Timeframe })
              }
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-desk-muted">Strateji</span>
            <select
              className="input"
              value={params.preset}
              onChange={(e) =>
                onPresetChange(e.target.value as StrategyPresetId)
              }
            >
              {PRESETS.map((id) => (
                <option key={id} value={id}>
                  {PRESET_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {preset === "zScorePullback" && (
          <div className="grid grid-cols-3 gap-1.5">
            <Num label="Z len" value={params.zLength!} onChange={(v) => patch({ zLength: v })} />
            <Num label="Regime SMA" value={params.regimeSMA!} onChange={(v) => patch({ regimeSMA: v })} />
            <Num label="Fast MA" value={params.fast!} onChange={(v) => patch({ fast: v })} />
            <Num label="Entry Z" value={params.entryZ!} onChange={(v) => patch({ entryZ: v })} step={0.1} />
            <Num label="Exit Z" value={params.exitZ!} onChange={(v) => patch({ exitZ: v })} step={0.1} />
            <Num label="Mum #" value={params.candleLimit!} onChange={(v) => patch({ candleLimit: v })} step={50} />
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          <Num label="SL ATR×" value={params.slAtrMult} onChange={(v) => patch({ slAtrMult: v })} step={0.1} />
          <Num label="TP ATR×" value={params.tpAtrMult} onChange={(v) => patch({ tpAtrMult: v })} step={0.1} />
          <Num label="Size" value={params.positionSize} onChange={(v) => patch({ positionSize: v })} step={100} />
          <Num label="Comm bps" value={params.commissionBps} onChange={(v) => patch({ commissionBps: v })} step={1} />
          <Num label="Warmup" value={params.warmup} onChange={(v) => patch({ warmup: v })} step={1} />
          <Num label="Mum #" value={params.candleLimit ?? 1000} onChange={(v) => patch({ candleLimit: v })} step={50} />
        </div>

        <div className="flex flex-wrap gap-2 text-2xs">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={params.allowShort}
              onChange={(e) => patch({ allowShort: e.target.checked })}
            />
            Short
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!params.useAtrStops}
              onChange={(e) => patch({ useAtrStops: e.target.checked })}
            />
            ATR SL/TP
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!params.useSignalExits}
              onChange={(e) => patch({ useSignalExits: e.target.checked })}
            />
            Sinyal çıkış
          </label>
        </div>

        {showCode && (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="btn text-2xs"
                onClick={() => {
                  setCode(ZSCORE_PULLBACK_SAMPLE);
                  patch({ strategyCode: ZSCORE_PULLBACK_SAMPLE });
                }}
              >
                Z-Score örnek
              </button>
              <button
                type="button"
                className="btn text-2xs"
                onClick={() => {
                  setCode(DI_ADX_SAMPLE);
                  patch({ strategyCode: DI_ADX_SAMPLE });
                }}
              >
                DI/ADX örnek
              </button>
              <button
                type="button"
                className="btn text-2xs"
                onClick={() => {
                  setCode(AROON_LONG_SAMPLE);
                  patch({ strategyCode: AROON_LONG_SAMPLE });
                }}
              >
                Aroon örnek
              </button>
            </div>
            <textarea
              className="input w-full font-mono text-2xs min-h-[140px] leading-snug"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                patch({ strategyCode: e.target.value });
              }}
              spellCheck={false}
              placeholder="enterLong / exitLong tanımlayan strateji kodu yapıştır…"
            />
            <p className="text-2xs text-desk-muted">
              Pine-lite: plot/alert temizlenir. `enterLong` / `exitLong` /
              `enterShort` / `exitShort` üret. `ta.sma`, `ta.stdev`,
              `ta.crossover`, `ta.adx`, `ta.aroon` hazır.
            </p>
          </div>
        )}

        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={running}
            onClick={run}
          >
            {running ? "Çalışıyor…" : "Backtest Çalıştır"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!result}
            onClick={() => download("csv")}
          >
            CSV
          </button>
          <button
            type="button"
            className="btn"
            disabled={!result}
            onClick={() => download("json")}
          >
            JSON
          </button>
        </div>
        {error && <div className="text-desk-down text-2xs">{error}</div>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {!result && (
          <p className="text-desk-muted text-2xs">
            Z-Score Pullback, ADX/DI, Aroon veya kod yapıştırıp 1000 mumla
            regime raporu üret.
          </p>
        )}
        {result && (
          <>
            <section>
              <h3 className="text-2xs uppercase tracking-wide text-desk-muted mb-1">
                Özet
              </h3>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono">
                {summaryRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-desk-muted">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-2xs uppercase tracking-wide text-desk-muted mb-1">
                Regime (Bull / Bear / Range)
              </h3>
              <table className="w-full text-2xs">
                <thead>
                  <tr className="text-desk-muted text-left">
                    <th className="py-0.5">Regime</th>
                    <th>N</th>
                    <th>Win%</th>
                    <th>PF</th>
                    <th>Avg</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {result.byRegime.map((r) => (
                    <tr key={r.regime} className="border-t border-desk-border/60">
                      <td
                        className={clsx(
                          "py-0.5 font-semibold",
                          r.regime === "Bull" && "text-desk-up",
                          r.regime === "Bear" && "text-desk-down"
                        )}
                      >
                        {r.regime}
                      </td>
                      <td>{r.trades}</td>
                      <td>{(r.winRate * 100).toFixed(0)}%</td>
                      <td>
                        {Number.isFinite(r.profitFactor)
                          ? r.profitFactor.toFixed(2)
                          : "∞"}
                      </td>
                      <td>{r.avgPnl.toFixed(1)}</td>
                      <td>{r.netPnl.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {result.byMonth?.length > 0 && (
              <section>
                <h3 className="text-2xs uppercase tracking-wide text-desk-muted mb-1">
                  Aylık
                </h3>
                <div className="max-h-28 overflow-y-auto font-mono text-2xs space-y-0.5">
                  {result.byMonth.map((m) => (
                    <div key={m.key} className="flex justify-between">
                      <span>{m.key}</span>
                      <span
                        className={
                          m.netPnl >= 0 ? "text-desk-up" : "text-desk-down"
                        }
                      >
                        {m.trades}t {m.netPnl.toFixed(0)} (
                        {(m.winRate * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-2xs uppercase tracking-wide text-desk-muted mb-1">
                Equity
              </h3>
              <div
                ref={equityRef}
                className="h-[160px] rounded border border-desk-border"
              />
            </section>

            <section>
              <h3 className="text-2xs uppercase tracking-wide text-desk-muted mb-1">
                Saat / Gün
              </h3>
              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div>
                  <div className="text-desk-muted mb-0.5">UTC Saat</div>
                  {result.byHour.slice(0, 8).map((h) => (
                    <div key={h.hour} className="flex justify-between font-mono">
                      <span>{String(h.hour).padStart(2, "0")}:00</span>
                      <span>
                        {h.trades}t {h.netPnl.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-desk-muted mb-0.5">UTC Gün</div>
                  {result.byDay.map((d) => (
                    <div key={d.day} className="flex justify-between font-mono">
                      <span>
                        {
                          ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][
                            d.day
                          ]
                        }
                      </span>
                      <span>
                        {d.trades}t {d.netPnl.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-2xs uppercase tracking-wide text-desk-muted mb-1">
                Trade Log ({result.trades.length})
              </h3>
              <div className="max-h-[220px] overflow-auto border border-desk-border rounded">
                <table className="w-full text-2xs">
                  <thead className="sticky top-0 bg-desk-panel">
                    <tr className="text-desk-muted text-left">
                      <th className="px-1 py-0.5">Side</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>PnL</th>
                      <th>R</th>
                      <th>Reg</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t) => (
                      <tr key={t.id} className="border-t border-desk-border/50">
                        <td
                          className={clsx(
                            "px-1 py-0.5",
                            t.side === "long"
                              ? "text-desk-up"
                              : "text-desk-down"
                          )}
                        >
                          {t.side}
                        </td>
                        <td className="font-mono">
                          {t.entryPrice.toPrecision(5)}
                        </td>
                        <td className="font-mono">
                          {t.exitPrice.toPrecision(5)}
                        </td>
                        <td
                          className={clsx(
                            "font-mono",
                            t.pnl >= 0 ? "text-desk-up" : "text-desk-down"
                          )}
                        >
                          {t.pnl.toFixed(2)}
                        </td>
                        <td className="font-mono">{t.rMultiple.toFixed(2)}</td>
                        <td>{t.entryRegime[0]}</td>
                        <td className="truncate max-w-[90px]" title={t.reason}>
                          {t.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-desk-muted">{label}</span>
      <input
        className="input"
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
