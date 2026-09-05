import type { Candle } from "@/lib/types";
import {
  adx,
  aroon,
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  stdev,
  supertrend,
} from "@/lib/indicators/math";
import { jurikKaseStoch } from "@/lib/indicators/jurik";
import type { BacktestParams, SignalFn } from "./types";
import { runStrategyCode } from "./strategySandbox";

function crossedAbove(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null)
    return false;
  return (
    (a[i - 1] as number) <= (b[i - 1] as number) &&
    (a[i] as number) > (b[i] as number)
  );
}

function crossedBelow(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null)
    return false;
  return (
    (a[i - 1] as number) >= (b[i - 1] as number) &&
    (a[i] as number) < (b[i] as number)
  );
}

export const PRESET_LABELS: Record<BacktestParams["preset"], string> = {
  emaCross: "EMA Cross",
  rsiOsOb: "RSI OS/OB",
  macdCross: "MACD Cross",
  supertrendFlip: "Supertrend Flip",
  jurikKasePermission: "JurikKase Stoch Permission",
  bbBreak: "Bollinger Break",
  emaRsiConfirm: "EMA + RSI Dual Confirm",
  zScorePullback: "Z-Score Pullback (Trend+Z)",
  diAdxTrend: "ADX + DI± Cross",
  aroonLongTrend: "Aroon Long/Short",
  jurikOsBounce: "Jurik Kase OS Bounce 15–20",
  codeStrategy: "Kod stratejisi (yapıştır)",
  custom: "Custom Rules",
};

export function recommendedWarmup(preset: BacktestParams["preset"], params: BacktestParams): number {
  if (preset === "zScorePullback") return Math.max(params.regimeSMA ?? 200, 220);
  if (preset === "diAdxTrend") return 60;
  if (preset === "aroonLongTrend") return 40;
  if (preset === "jurikOsBounce") return 80;
  return params.warmup ?? 60;
}

export function buildSignalContext(
  candles: Candle[],
  params: BacktestParams
): Record<string, unknown> {
  const closes = candles.map((c) => c.close);
  const fast = params.fast ?? 9;
  const slow = params.slow ?? 21;
  const zLen = params.zLength ?? 20;
  const regimeN = params.regimeSMA ?? 200;
  const fastMa = params.fast ?? 5;
  const sma20 = sma(closes, zLen);
  const sd20 = stdev(closes, zLen);
  const zScore = closes.map((c, i) =>
    sma20[i] == null || sd20[i] == null || (sd20[i] as number) === 0
      ? null
      : (c - (sma20[i] as number)) / (sd20[i] as number)
  );

  const ctx: Record<string, unknown> = {
    emaFast: ema(closes, fast),
    emaSlow: ema(closes, slow),
    rsi: rsi(closes, params.rsiPeriod ?? 14),
    macd: macd(closes, params.macdFast ?? 12, params.macdSlow ?? 26, params.macdSignal ?? 9),
    st: supertrend(candles, params.atrPeriod ?? 10, params.stMult ?? 3),
    bb: bollinger(closes, params.bbPeriod ?? 20, params.bbMult ?? 2),
    jks: jurikKaseStoch(candles, {
      cycle: 5,
      kLen: 8,
      dLen: 3,
      jmaLen: 5,
      phase: 50,
      power: 2,
      levelLo: 10,
      levelLo2: 20,
      levelHi2: 80,
      levelHi: 90,
      smoothMode: "jma",
    }),
    zScore,
    smaRegime: sma(closes, regimeN),
    fastSMA: sma(closes, fastMa),
    dmi: adx(candles, params.adxPeriod ?? 14),
    aroon: aroon(candles, params.aroonPeriod ?? 14),
  };

  if (params.preset === "codeStrategy" && params.strategyCode?.trim()) {
    try {
      const bars = runStrategyCode(params.strategyCode, candles);
      ctx.codeBars = bars;
      ctx.codeWarnings = bars.warnings;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.codeBars = null;
      ctx.codeWarnings = [
        ...(((e as { strategyWarnings?: string[] }).strategyWarnings) ?? []),
        msg,
      ];
      throw e;
    }
  }

  return ctx;
}

export function getSignalFn(
  preset: BacktestParams["preset"],
  params: BacktestParams
): SignalFn {
  const rsiOs = params.rsiOs ?? 30;
  const rsiOb = params.rsiOb ?? 70;
  const entryZ = params.entryZ ?? -1.5;
  const exitZ = params.exitZ ?? 0;
  const adxMin = params.adxMin ?? 25;

  switch (preset) {
    case "emaCross":
      return (_c, i, ctx) => {
        const f = ctx.emaFast as (number | null)[];
        const s = ctx.emaSlow as (number | null)[];
        return {
          long: crossedAbove(f, s, i),
          short: crossedBelow(f, s, i),
          reason: "EMA cross",
        };
      };
    case "rsiOsOb":
      return (_c, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        if (r[i] == null || r[i - 1] == null) return {};
        const long = (r[i - 1] as number) < rsiOs && (r[i] as number) >= rsiOs;
        const short = (r[i - 1] as number) > rsiOb && (r[i] as number) <= rsiOb;
        return { long, short, reason: "RSI OS/OB" };
      };
    case "macdCross":
      return (_c, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
        };
        return {
          long: crossedAbove(m.macd, m.signal, i),
          short: crossedBelow(m.macd, m.signal, i),
          reason: "MACD cross",
        };
      };
    case "supertrendFlip":
      return (_c, i, ctx) => {
        const st = ctx.st as { direction: ((-1 | 1 | null)[]) };
        const dir = st.direction;
        if (!dir || dir[i] == null || dir[i - 1] == null) return {};
        return {
          long: (dir[i - 1] as number) < 0 && (dir[i] as number) > 0,
          short: (dir[i - 1] as number) > 0 && (dir[i] as number) < 0,
          reason: "ST flip",
        };
      };
    case "jurikKasePermission":
      return (_c, i, ctx) => {
        const j = ctx.jks as {
          k: (number | null)[];
          d: (number | null)[];
          state: (number | null)[];
        };
        if (j.k[i] == null || j.d[i] == null) return {};
        const permBull = j.state[i] == null || (j.state[i] as number) >= 0;
        const permBear = j.state[i] == null || (j.state[i] as number) <= 0;
        const long =
          crossedAbove(j.k, j.d, i) && (j.k[i] as number) < 45 && permBull;
        const short =
          crossedBelow(j.k, j.d, i) && (j.k[i] as number) > 55 && permBear;
        return { long, short, reason: "JKS permission" };
      };
    case "bbBreak":
      return (candles, i, ctx) => {
        const bb = ctx.bb as {
          upper: (number | null)[];
          lower: (number | null)[];
          mid: (number | null)[];
        };
        if (bb.upper[i] == null || bb.lower[i] == null) return {};
        const c = candles[i].close;
        const prev = candles[i - 1]?.close;
        const long =
          prev != null &&
          prev <= (bb.upper[i - 1] as number) &&
          c > (bb.upper[i] as number);
        const short =
          prev != null &&
          prev >= (bb.lower[i - 1] as number) &&
          c < (bb.lower[i] as number);
        return { long, short, reason: "BB break" };
      };
    case "emaRsiConfirm":
      return (_c, i, ctx) => {
        const f = ctx.emaFast as (number | null)[];
        const s = ctx.emaSlow as (number | null)[];
        const r = ctx.rsi as (number | null)[];
        if (r[i] == null) return {};
        const long = crossedAbove(f, s, i) && (r[i] as number) > 50;
        const short = crossedBelow(f, s, i) && (r[i] as number) < 50;
        return { long, short, reason: "EMA+RSI" };
      };
    case "zScorePullback":
      return (candles, i, ctx) => {
        const z = ctx.zScore as (number | null)[];
        const regime = ctx.smaRegime as (number | null)[];
        const fastS = ctx.fastSMA as (number | null)[];
        if (z[i] == null || regime[i] == null || fastS[i] == null) return {};
        const closes = candles.map((c) => c.close);
        const bull = closes[i] > (regime[i] as number);
        const long =
          bull &&
          (z[i] as number) < entryZ &&
          crossedAbove(closes, fastS, i);
        const exitLong = (z[i] as number) > exitZ;
        return { long, exitLong, reason: "Z-Score PB" };
      };
    case "diAdxTrend":
      return (_c, i, ctx) => {
        const d = ctx.dmi as {
          adx: (number | null)[];
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        if (d.adx[i] == null) return {};
        const strong = (d.adx[i] as number) > adxMin;
        const long = strong && crossedAbove(d.plusDI, d.minusDI, i);
        const short = strong && crossedAbove(d.minusDI, d.plusDI, i);
        const exitLong =
          crossedBelow(d.plusDI, d.minusDI, i) ||
          (d.adx[i] as number) < 20;
        const exitShort =
          crossedBelow(d.minusDI, d.plusDI, i) ||
          (d.adx[i] as number) < 20;
        return { long, short, exitLong, exitShort, reason: "ADX/DI" };
      };
    case "aroonLongTrend":
      return (_c, i, ctx) => {
        const a = ctx.aroon as {
          up: (number | null)[];
          down: (number | null)[];
        };
        if (a.up[i] == null || a.down[i] == null) return {};
        const zoneLong =
          (a.up[i] as number) > 70 && (a.down[i] as number) < 30;
        const zoneShort =
          (a.down[i] as number) > 70 && (a.up[i] as number) < 30;
        const long = crossedAbove(a.up, a.down, i) || zoneLong;
        const short = crossedAbove(a.down, a.up, i) || zoneShort;
        const exitLong =
          crossedBelow(a.up, a.down, i) || (a.up[i] as number) < 50;
        const exitShort =
          crossedBelow(a.down, a.up, i) || (a.down[i] as number) < 50;
        return { long, short, exitLong, exitShort, reason: "Aroon" };
      };
    case "jurikOsBounce":
      return (_c, i, ctx) => {
        const j = ctx.jks as {
          k: (number | null)[];
          d: (number | null)[];
        };
        if (j.k[i] == null || j.d[i] == null) return {};
        const k = j.k[i] as number;
        const long = crossedAbove(j.k, j.d, i) && k >= 15 && k <= 20;
        const short = crossedBelow(j.k, j.d, i) && k >= 80 && k <= 85;
        const exitLong = k > 50 || crossedBelow(j.k, j.d, i);
        const exitShort = k < 50 || crossedAbove(j.k, j.d, i);
        return { long, short, exitLong, exitShort, reason: "JKS OS" };
      };
    case "codeStrategy":
      return (_c, i, ctx) => {
        const bars = ctx.codeBars as {
          enterLong: boolean[];
          exitLong: boolean[];
          enterShort: boolean[];
          exitShort: boolean[];
        } | null;
        if (!bars) return {};
        return {
          long: bars.enterLong[i],
          short: bars.enterShort[i],
          exitLong: bars.exitLong[i],
          exitShort: bars.exitShort[i],
          reason: "code",
        };
      };
    case "custom":
    default: {
      const rule = params.customRules?.entryLong ?? "emaCross";
      return getSignalFn(
        rule === "emaCross"
          ? "emaCross"
          : rule === "rsiOs"
            ? "rsiOsOb"
            : rule === "macdCross"
              ? "macdCross"
              : "supertrendFlip",
        params
      );
    }
  }
}
