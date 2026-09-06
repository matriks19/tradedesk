import type { Candle } from "@/lib/types";
import { atr } from "@/lib/indicators/math";
import { classifyRegimes } from "./regime";
import {
  buildSignalContext,
  getSignalFn,
  recommendedWarmup,
} from "./presets";
import type {
  BacktestParams,
  BacktestResult,
  BacktestSignalEvent,
  BacktestSummary,
  BacktestTrade,
  Regime,
  RegimeStats,
} from "./types";

function uid(): string {
  return `t_${Math.random().toString(36).slice(2, 9)}`;
}

function regimeStats(trades: BacktestTrade[]): RegimeStats[] {
  const regimes: Regime[] = ["Bull", "Bear", "Range"];
  return regimes.map((regime) => {
    const list = trades.filter((t) => t.entryRegime === regime);
    const wins = list.filter((t) => t.pnl > 0);
    const losses = list.filter((t) => t.pnl <= 0);
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return {
      regime,
      trades: list.length,
      wins: wins.length,
      winRate: list.length ? wins.length / list.length : 0,
      profitFactor:
        grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      avgPnl: list.length ? list.reduce((s, t) => s + t.pnl, 0) / list.length : 0,
      netPnl: list.reduce((s, t) => s + t.pnl, 0),
    };
  });
}

function summarize(
  trades: BacktestTrade[],
  equity: { equity: number }[]
): BacktestSummary {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  let peak = equity[0]?.equity ?? 0;
  let maxDd = 0;
  let maxDdPct = 0;
  for (const e of equity) {
    peak = Math.max(peak, e.equity);
    const dd = peak - e.equity;
    maxDd = Math.max(maxDd, dd);
    if (peak > 0) maxDdPct = Math.max(maxDdPct, dd / peak);
  }
  const rets = trades.map((t) => t.pnlPct);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance =
    rets.length > 1
      ? rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
      : 0;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;
  const avgR = trades.length
    ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length
    : 0;
  const expectancy = trades.length ? netPnl / trades.length : 0;
  const avgBarsHeld = trades.length
    ? trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length
    : 0;
  const longs = trades.filter((t) => t.side === "long");
  const shorts = trades.filter((t) => t.side === "short");
  const pnls = trades.map((t) => t.pnl);
  return {
    netPnl,
    profitFactor:
      grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    winRate: trades.length ? wins.length / trades.length : 0,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
    sharpe,
    avgR,
    expectancy,
    avgBarsHeld,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -grossLoss / losses.length : 0,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longNetPnl: longs.reduce((s, t) => s + t.pnl, 0),
    shortNetPnl: shorts.reduce((s, t) => s + t.pnl, 0),
    bestTrade: pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
  };
}


/** Fill missing summary fields from older persisted results (localStorage). */
export function normalizeBacktestResult(r: BacktestResult): BacktestResult {
  const s = r?.summary ?? ({} as BacktestSummary);
  const n = (v: unknown, d = 0) =>
    typeof v === "number" && Number.isFinite(v) ? v : d;
  const pf = s.profitFactor;
  const profitFactor =
    typeof pf === "number" && !Number.isFinite(pf) && pf > 0
      ? Infinity
      : n(pf);
  return {
    ...r,
    summary: {
      netPnl: n(s.netPnl),
      profitFactor,
      winRate: n(s.winRate),
      trades: n(s.trades),
      wins: n(s.wins),
      losses: n(s.losses),
      maxDrawdown: n(s.maxDrawdown),
      maxDrawdownPct: n(s.maxDrawdownPct),
      sharpe: n(s.sharpe),
      avgR: n(s.avgR),
      expectancy: n(s.expectancy),
      avgBarsHeld: n(s.avgBarsHeld),
      avgWin: n(s.avgWin),
      avgLoss: n(s.avgLoss),
      longTrades: n(s.longTrades),
      shortTrades: n(s.shortTrades),
      longNetPnl: n(s.longNetPnl),
      shortNetPnl: n(s.shortNetPnl),
      bestTrade: n(s.bestTrade),
      worstTrade: n(s.worstTrade),
    },
  };
}

export function runBacktest(
  candles: Candle[],
  params: BacktestParams
): BacktestResult {
  const warmup = Math.max(
    1,
    params.warmup ?? recommendedWarmup(params.preset, params)
  );
  const useAtrStops = params.useAtrStops ?? true;
  const useSignalExits = params.useSignalExits ?? true;
  const regimes = classifyRegimes(candles);
  const atrLine = atr(candles, params.atrPeriod ?? 14);
  const ctx = buildSignalContext(candles, params);
  const signalFn = getSignalFn(params.preset, params);
  const codeWarnings = (ctx.codeWarnings as string[] | undefined) ?? undefined;

  const commission = (params.commissionBps ?? 0) / 10000;
  const startEquity = params.positionSize * 10;
  let cash = startEquity;
  let position: {
    side: "long" | "short";
    entry: number;
    qty: number;
    entryIdx: number;
    sl: number;
    tp: number;
    risk: number;
    reason: string;
    regime: Regime;
  } | null = null;

  const trades: BacktestTrade[] = [];
  const signals: BacktestSignalEvent[] = [];
  const equity: { time: number; equity: number }[] = [];

  const rebuildCash = () => startEquity + trades.reduce((s, t) => s + t.pnl, 0);

  const closePos = (i: number, price: number, reason: string) => {
    if (!position) return;
    const pnlGross =
      position.side === "long"
        ? (price - position.entry) * position.qty
        : (position.entry - price) * position.qty;
    const fee = (position.entry + price) * position.qty * commission;
    const pnl = pnlGross - fee;
    trades.push({
      id: uid(),
      side: position.side,
      entryTime: candles[position.entryIdx].time,
      exitTime: candles[i].time,
      entryPrice: position.entry,
      exitPrice: price,
      qty: position.qty,
      pnl,
      pnlPct: (pnl / (position.entry * position.qty)) * 100,
      rMultiple: position.risk > 0 ? pnl / (position.risk * position.qty) : 0,
      reason: `${position.reason} → ${reason}`,
      entryRegime: position.regime,
      barsHeld: i - position.entryIdx,
    });
    position = null;
  };

  const markEquity = (i: number) => {
    cash = rebuildCash();
    let eq = cash;
    if (position) {
      const px = candles[i].close;
      eq +=
        position.side === "long"
          ? (px - position.entry) * position.qty
          : (position.entry - px) * position.qty;
    }
    equity.push({ time: candles[i].time, equity: eq });
  };

  const pushSig = (
    i: number,
    kind: BacktestSignalEvent["kind"],
    reason: string
  ) => {
    const side: "al" | "sat" =
      kind === "long" || kind === "exitShort" ? "al" : "sat";
    signals.push({
      barIndex: i,
      time: candles[i].time,
      price: candles[i].close,
      side,
      kind,
      reason,
      barsAgo: 0, // filled after loop
    });
  };

  for (let i = 0; i < candles.length; i++) {
    cash = rebuildCash();
    const c = candles[i];
    const a = atrLine[i];

    const sig = i >= warmup ? signalFn(candles, i, ctx) : null;
    if (sig) {
      if (sig.long) pushSig(i, "long", sig.reason ?? "long");
      if (sig.short) pushSig(i, "short", sig.reason ?? "short");
      if (sig.exitLong) pushSig(i, "exitLong", sig.reason ?? "exitLong");
      if (sig.exitShort) pushSig(i, "exitShort", sig.reason ?? "exitShort");
    }

    if (position) {
      let closed = false;
      if (useAtrStops && a != null) {
        if (position.side === "long") {
          if (c.low <= position.sl) {
            closePos(i, position.sl, "SL");
            closed = true;
          } else if (c.high >= position.tp) {
            closePos(i, position.tp, "TP");
            closed = true;
          }
        } else {
          if (c.high >= position.sl) {
            closePos(i, position.sl, "SL");
            closed = true;
          } else if (c.low <= position.tp) {
            closePos(i, position.tp, "TP");
            closed = true;
          }
        }
      }
      if (!closed && useSignalExits && sig) {
        if (position.side === "long" && sig.exitLong) {
          closePos(i, c.close, "signal exit");
        } else if (position.side === "short" && sig.exitShort) {
          closePos(i, c.close, "signal exit");
        }
      }
    }

    if (i < warmup) {
      markEquity(i);
      continue;
    }

    if (!position && sig) {
      const notional = params.positionSize;
      const qty = notional / c.close;
      const risk = (params.slAtrMult || 1.5) * (a && a > 0 ? a : c.close * 0.01);
      const reward = (params.tpAtrMult || 2.5) * (a && a > 0 ? a : c.close * 0.01);

      if (sig.long) {
        position = {
          side: "long",
          entry: c.close,
          qty,
          entryIdx: i,
          sl: c.close - risk,
          tp: c.close + reward,
          risk,
          reason: sig.reason ?? "long",
          regime: regimes[i],
        };
      } else if (sig.short && params.allowShort) {
        position = {
          side: "short",
          entry: c.close,
          qty,
          entryIdx: i,
          sl: c.close + risk,
          tp: c.close - reward,
          risk,
          reason: sig.reason ?? "short",
          regime: regimes[i],
        };
      }
    }

    markEquity(i);
  }

  const lastBar = candles.length - 1;
  for (const s of signals) s.barsAgo = lastBar - s.barIndex;

  if (position) {
    const last = candles.length - 1;
    closePos(last, candles[last].close, "EOD");
    cash = rebuildCash();
    if (equity.length) equity[equity.length - 1].equity = cash;
  }

  let eq = startEquity;
  let ti = 0;
  const equityClean: { time: number; equity: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    while (ti < trades.length && trades[ti].exitTime <= candles[i].time) {
      eq += trades[ti].pnl;
      ti++;
    }
    equityClean.push({ time: candles[i].time, equity: eq });
  }

  const byHourMap = new Map<number, BacktestTrade[]>();
  const byDayMap = new Map<number, BacktestTrade[]>();
  const byMonthMap = new Map<string, BacktestTrade[]>();
  for (const t of trades) {
    const d = new Date(t.entryTime * 1000);
    const h = d.getUTCHours();
    const day = d.getUTCDay();
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!byHourMap.has(h)) byHourMap.set(h, []);
    if (!byDayMap.has(day)) byDayMap.set(day, []);
    if (!byMonthMap.has(key)) byMonthMap.set(key, []);
    byHourMap.get(h)!.push(t);
    byDayMap.get(day)!.push(t);
    byMonthMap.get(key)!.push(t);
  }

  const packHour = Array.from(byHourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([k, list]) => ({
      hour: k,
      trades: list.length,
      netPnl: list.reduce((s, t) => s + t.pnl, 0),
      winRate: list.length
        ? list.filter((t) => t.pnl > 0).length / list.length
        : 0,
    }));

  const packDay = Array.from(byDayMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([k, list]) => ({
      day: k,
      trades: list.length,
      netPnl: list.reduce((s, t) => s + t.pnl, 0),
      winRate: list.length
        ? list.filter((t) => t.pnl > 0).length / list.length
        : 0,
    }));

  const byMonth = Array.from(byMonthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      key,
      trades: list.length,
      netPnl: list.reduce((s, t) => s + t.pnl, 0),
      winRate: list.length
        ? list.filter((t) => t.pnl > 0).length / list.length
        : 0,
    }));

  return {
    params,
    summary: summarize(trades, equityClean),
    byRegime: regimeStats(trades),
    byHour: packHour,
    byDay: packDay,
    byMonth,
    equity: equityClean,
    trades,
    signals,
    regimes,
    ranAt: Date.now(),
    candleCount: candles.length,
    codeWarnings,
  };
}

export function exportTradesCsv(result: BacktestResult): string {
  const header =
    "id,side,entryTime,exitTime,entryPrice,exitPrice,qty,pnl,pnlPct,rMultiple,reason,entryRegime,barsHeld";
  const rows = result.trades.map((t) =>
    [
      t.id,
      t.side,
      t.entryTime,
      t.exitTime,
      t.entryPrice,
      t.exitPrice,
      t.qty,
      t.pnl,
      t.pnlPct,
      t.rMultiple,
      JSON.stringify(t.reason),
      t.entryRegime,
      t.barsHeld,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function exportResultJson(result: BacktestResult): string {
  return JSON.stringify(result, null, 2);
}
