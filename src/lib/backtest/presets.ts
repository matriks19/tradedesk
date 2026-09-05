import type { Candle } from "@/lib/types";
import {
  bollinger,
  ema,
  macd,
  rsi,
  supertrend,
} from "@/lib/indicators/math";
import { jurikKaseStoch } from "@/lib/indicators/jurik";
import type { BacktestParams, SignalFn } from "./types";

function crossedAbove(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null)
    return false;
  return (a[i - 1] as number) <= (b[i - 1] as number) && (a[i] as number) > (b[i] as number);
}

function crossedBelow(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null)
    return false;
  return (a[i - 1] as number) >= (b[i - 1] as number) && (a[i] as number) < (b[i] as number);
}

export const PRESET_LABELS: Record<BacktestParams["preset"], string> = {
  emaCross: "EMA Cross",
  rsiOsOb: "RSI OS/OB",
  macdCross: "MACD Cross",
  supertrendFlip: "Supertrend Flip",
  jurikKasePermission: "JurikKase Stoch Permission",
  bbBreak: "Bollinger Break",
  emaRsiConfirm: "EMA + RSI Dual Confirm",
  custom: "Custom Rules",
};

export function buildSignalContext(
  candles: Candle[],
  params: BacktestParams
): Record<string, unknown> {
  const closes = candles.map((c) => c.close);
  const fast = params.fast ?? 9;
  const slow = params.slow ?? 21;
  const ctx: Record<string, unknown> = {
    emaFast: ema(closes, fast),
    emaSlow: ema(closes, slow),
    rsi: rsi(closes, params.rsiPeriod ?? 14),
    macd: macd(closes, 12, 26, 9),
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
  };
  return ctx;
}

export function getSignalFn(preset: BacktestParams["preset"], params: BacktestParams): SignalFn {
  const rsiOs = params.rsiOs ?? 30;
  const rsiOb = params.rsiOb ?? 70;

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
        const long = crossedAbove(j.k, j.d, i) && (j.k[i] as number) < 45 && permBull;
        const short = crossedBelow(j.k, j.d, i) && (j.k[i] as number) > 55 && permBear;
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
