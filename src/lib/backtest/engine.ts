import type { Candle } from "@/lib/types";
import { atr } from "@/lib/indicators/math";
import { classifyRegimes } from "./regime";
import { buildSignalContext, getSignalFn } from "./presets";
import type {
  BacktestParams,
  BacktestResult,
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
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
      avgPnl: list.length ? list.reduce((s, t) => s + t.pnl, 0) / list.length : 0,
      netPnl: list.reduce((s, t) => s + t.pnl, 0),
    };
  });
}

function summarize(trades: BacktestTrade[], equity: { equity: number }[]): BacktestSummary {
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
  // Sharpe-ish on trade returns
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
  return {
    netPnl,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
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
  };
}

export function runBacktest(
  candles: Candle[],
  params: BacktestParams
): BacktestResult {
  const warmup = Math.max(1, params.warmup ?? 50);
  const regimes = classifyRegimes(candles);
  const atrLine = atr(candles, params.atrPeriod ?? 14);
  const ctx = buildSignalContext(candles, params);
  const signalFn = getSignalFn(params.preset, params);

  const commission = (params.commissionBps ?? 0) / 10000;
  let cash = params.positionSize * 10; // virtual account buffer
  const startEquity = cash;
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
  const equity: { time: number; equity: number }[] = [];

  const markEquity = (i: number) => {
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

  const closePos = (i: number, price: number, reason: string) => {
    if (!position) return;
    const pnlGross =
      position.side === "long"
        ? (price - position.entry) * position.qty
        : (position.entry - price) * position.qty;
    const fee = (position.entry + price) * position.qty * commission;
    const pnl = pnlGross - fee;
    cash +=
      position.side === "long"
        ? position.qty * price - fee
        : position.qty * position.entry + pnlGross - fee;
    // For short we tracked cash differently — normalize:
    // Simpler: rebuild cash from start + closed pnls
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

  // Recompute cash simply from startEquity + sum of closed trade pnls each bar
  const rebuildCash = () => startEquity + trades.reduce((s, t) => s + t.pnl, 0);

  for (let i = 0; i < candles.length; i++) {
    cash = rebuildCash();
    const c = candles[i];
    const a = atrLine[i];

    // Manage open position
    if (position && a != null) {
      if (position.side === "long") {
        if (c.low <= position.sl) {
          closePos(i, position.sl, "SL");
        } else if (c.high >= position.tp) {
          closePos(i, position.tp, "TP");
        }
      } else {
        if (c.high >= position.sl) {
          closePos(i, position.sl, "SL");
        } else if (c.low <= position.tp) {
          closePos(i, position.tp, "TP");
        }
      }
    }

    if (i < warmup) {
      markEquity(i);
      continue;
    }

    if (!position && a != null && a > 0) {
      const sig = signalFn(candles, i, ctx);
      const notional = params.positionSize;
      const qty = notional / c.close;
      const risk = params.slAtrMult * a;
      const reward = params.tpAtrMult * a;

      if (sig.long) {
        cash = rebuildCash();
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
        cash = rebuildCash();
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

    cash = rebuildCash();
    markEquity(i);
  }

  // Force close at end
  if (position) {
    const last = candles.length - 1;
    closePos(last, candles[last].close, "EOD");
    cash = rebuildCash();
    if (equity.length) equity[equity.length - 1].equity = cash;
  }

  // Rebuild equity curve cleanly from trades for consistency
  let eq = startEquity;
  let ti = 0;
  const equityClean: { time: number; equity: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    while (ti < trades.length && trades[ti].exitTime === candles[i].time) {
      eq += trades[ti].pnl;
      ti++;
    }
    // also attribute if exitTime matches (multiple)
    while (ti < trades.length && trades[ti].exitTime <= candles[i].time) {
      // already handled equal; for safety
      if (trades[ti].exitTime < candles[i].time) {
        eq += trades[ti].pnl;
        ti++;
      } else break;
    }
    equityClean.push({ time: candles[i].time, equity: eq });
  }

  const byHourMap = new Map<number, BacktestTrade[]>();
  const byDayMap = new Map<number, BacktestTrade[]>();
  for (const t of trades) {
    const d = new Date(t.entryTime * 1000);
    const h = d.getUTCHours();
    const day = d.getUTCDay();
    if (!byHourMap.has(h)) byHourMap.set(h, []);
    if (!byDayMap.has(day)) byDayMap.set(day, []);
    byHourMap.get(h)!.push(t);
    byDayMap.get(day)!.push(t);
  }

  const pack = (map: Map<number, BacktestTrade[]>, keyName: "hour" | "day") =>
    Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([k, list]) => ({
        [keyName]: k,
        trades: list.length,
        netPnl: list.reduce((s, t) => s + t.pnl, 0),
        winRate: list.length
          ? list.filter((t) => t.pnl > 0).length / list.length
          : 0,
      })) as { hour: number; trades: number; netPnl: number; winRate: number }[] &
      { day: number; trades: number; netPnl: number; winRate: number }[];

  return {
    params,
    summary: summarize(trades, equityClean),
    byRegime: regimeStats(trades),
    byHour: pack(byHourMap, "hour") as {
      hour: number;
      trades: number;
      netPnl: number;
      winRate: number;
    }[],
    byDay: pack(byDayMap, "day") as {
      day: number;
      trades: number;
      netPnl: number;
      winRate: number;
    }[],
    equity: equityClean,
    trades,
    regimes,
    ranAt: Date.now(),
    candleCount: candles.length,
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
