import type { Candle } from "@/lib/types";
import {
  adx,
  aroon,
  atr,
  bollinger,
  donchian,
  ema,
  macd,
  rsi,
  sma,
  stdev,
  supertrend,
  vwap,
} from "@/lib/indicators/math";
import { adxPumpRadar } from "@/lib/indicators/adxPump";
import { eliziEdge } from "@/lib/indicators/eliziEdge";
import { initialBalance } from "@/lib/indicators/proreal";
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

/** Prior-bar Donchian (excludes bar i) — classic Turtle breakout definition. */
function priorDonchian(
  candles: Candle[],
  period: number
): { upper: (number | null)[]; lower: (number | null)[] } {
  const n = candles.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < period) continue;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period; j < i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    upper[i] = hi;
    lower[i] = lo;
  }
  return { upper, lower };
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
  orbVwapFiltered: "ORB + VWAP + EMA Filter",
  vwapBounce: "VWAP Bounce / Rejection",
  rsi2MeanRev: "RSI(2) Mean Reversion",
  donchianTurtle: "Donchian / Turtle Breakout",
  supertrendAdx: "Supertrend + ADX Filter",
  adxPumpStages: "ADX Pump Radar (Saf/CCI/Medyan/Mom)",
  eliziEdgeFire: "Elizi Edge Fire (phase/temp/coherence)",
  eliziEdgeExhaust: "Elizi Exhaust Fade (phase=4 counter)",
  hybridMacdPump: "Hibrit MACD+Pump (seçici short)",
  hybridMacdPumpLong: "Hibrit MACD+Pump Long-only",
  codeStrategy: "Kod stratejisi (yapıştır)",
  custom: "Custom Rules",
};

export function recommendedWarmup(
  preset: BacktestParams["preset"],
  params: BacktestParams
): number {
  if (preset === "zScorePullback") return Math.max(params.regimeSMA ?? 200, 220);
  if (preset === "rsi2MeanRev") {
    return params.requireRegimeAbove
      ? Math.max(params.regimeSMA ?? 200, 220)
      : 40;
  }
  if (preset === "diAdxTrend" || preset === "supertrendAdx" || preset === "adxPumpStages" || preset === "eliziEdgeFire" || preset === "eliziEdgeExhaust" || preset === "hybridMacdPump" || preset === "hybridMacdPumpLong") return 60;
  if (preset === "aroonLongTrend") return 40;
  if (preset === "jurikOsBounce") return 80;
  if (preset === "donchianTurtle")
    return Math.max(params.donchianPeriod ?? 20, params.donchianExitPeriod ?? 10) + 5;
  if (preset === "orbVwapFiltered") return Math.max(params.orbBars ?? 3, 30);
  if (preset === "vwapBounce") return 40;
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

  const orbBars = params.orbBars ?? 3;
  const dcEntry = params.donchianPeriod ?? 20;
  const dcExit = params.donchianExitPeriod ?? 10;

  const ctx: Record<string, unknown> = {
    emaFast: ema(closes, fast),
    emaSlow: ema(closes, slow),
    rsi: rsi(closes, params.rsiPeriod ?? 14),
    macd: macd(
      closes,
      params.macdFast ?? 12,
      params.macdSlow ?? 26,
      params.macdSignal ?? 9
    ),
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
    pumpRadar: adxPumpRadar(candles, {
      adxPeriod: params.adxPeriod ?? 14,
      fastSmooth: params.fastSmooth ?? 3,
      medianLen: params.medianLen ?? 5,
      momPeriod: params.momPeriod ?? 7,
      cciPeriod: params.cciPeriod ?? 10,
      bbPeriod: params.bbPeriod ?? 20,
      bbMult: params.bbMult ?? 2,
      smoothLen: params.smoothLen ?? 3,
      adxConfirm: params.adxConfirm ?? params.adxMin ?? 25,
      adxWake: params.adxWake ?? 15,
    }),

    aroon: aroon(candles, params.aroonPeriod ?? 14),
    vwap: vwap(candles),
    ib: initialBalance(candles, orbBars),
    atr: atr(candles, params.atrPeriod ?? 14),
    donchianEntry: priorDonchian(candles, dcEntry),
    donchianExit: priorDonchian(candles, dcExit),
    donchianLive: donchian(candles, dcEntry),
    closes,
  };

  // Only compute Elizi when the preset actually uses it (avoid scanner/backtest hang tax).
  if (
    params.preset === "eliziEdgeFire" ||
    params.preset === "eliziEdgeExhaust" ||
    params.preset === "hybridMacdPump" ||
    params.preset === "hybridMacdPumpLong"
  ) {
    ctx.elizi = eliziEdge(candles, {
      erLen: params.erLen ?? 10,
      atrLen: params.atrLen ?? params.atrPeriod ?? 14,
      adxPeriod: params.adxPeriod ?? 14,
      bbPeriod: params.bbPeriod ?? 20,
      bbMult: params.bbMult ?? 2,
      volLen: params.volLen ?? 5,
      volLong: params.volLong ?? 10,
      flowSmooth: params.flowSmooth ?? 3,
      tempSmooth: params.tempSmooth ?? 4,
      effHigh: params.effHigh ?? 0.45,
      surpriseHigh: params.surpriseHigh ?? 0.85,
      coherenceArmed: params.coherenceArmed ?? 0.6,
      fireTemp: params.fireTemp ?? 62,
      armedTemp: params.armedTemp ?? 48,
      probeTemp: params.probeTemp ?? 32,
    });
  }

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
  const vwapTouchAtr = params.vwapTouchAtr ?? 0.35;

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
        const st = ctx.st as { direction: (-1 | 1 | null)[] };
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
          crossedBelow(d.plusDI, d.minusDI, i) || (d.adx[i] as number) < 20;
        const exitShort =
          crossedBelow(d.minusDI, d.plusDI, i) || (d.adx[i] as number) < 20;
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

    case "orbVwapFiltered":
      return (candles, i, ctx) => {
        const ib = ctx.ib as {
          ibHigh: (number | null)[];
          ibLow: (number | null)[];
        };
        const vw = ctx.vwap as (number | null)[];
        const e21 = ctx.emaSlow as (number | null)[];
        if (
          ib.ibHigh[i] == null ||
          ib.ibLow[i] == null ||
          vw[i] == null ||
          e21[i] == null ||
          i < 1
        )
          return {};
        const c = candles[i].close;
        const prev = candles[i - 1].close;
        const ibH = ib.ibHigh[i] as number;
        const ibL = ib.ibLow[i] as number;
        const v = vw[i] as number;
        const ema = e21[i] as number;
        // Skip while IB still forming (high==low until enough bars — still valid after lock)
        const long =
          prev <= ibH && c > ibH && c > v && c > ema;
        const short =
          prev >= ibL && c < ibL && c < v && c < ema;
        const exitLong = c < v || c < ema;
        const exitShort = c > v || c > ema;
        return { long, short, exitLong, exitShort, reason: "ORB+VWAP" };
      };

    case "vwapBounce":
      return (candles, i, ctx) => {
        const vw = ctx.vwap as (number | null)[];
        const eFast = ctx.emaFast as (number | null)[];
        const eSlow = ctx.emaSlow as (number | null)[];
        const a = ctx.atr as (number | null)[];
        if (
          vw[i] == null ||
          eFast[i] == null ||
          eSlow[i] == null ||
          a[i] == null ||
          i < 1
        )
          return {};
        const c = candles[i];
        const v = vw[i] as number;
        const atrV = a[i] as number;
        const touchDist = vwapTouchAtr * atrV;
        const touchedVwap =
          c.low <= v + touchDist && c.high >= v - touchDist;
        const bullTrend = (eFast[i] as number) > (eSlow[i] as number);
        const bearTrend = (eFast[i] as number) < (eSlow[i] as number);
        // Rejection: touched VWAP, closed back in trend direction
        const long =
          bullTrend &&
          touchedVwap &&
          c.close > v &&
          candles[i - 1].close <= v + touchDist;
        const short =
          bearTrend &&
          touchedVwap &&
          c.close < v &&
          candles[i - 1].close >= v - touchDist;
        const exitLong = c.close < v || crossedBelow(eFast, eSlow, i);
        const exitShort = c.close > v || crossedAbove(eFast, eSlow, i);
        return { long, short, exitLong, exitShort, reason: "VWAP bounce" };
      };

    case "rsi2MeanRev":
      return (candles, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        const regime = ctx.smaRegime as (number | null)[];
        if (r[i] == null || r[i - 1] == null) return {};
        const needRegime = params.requireRegimeAbove === true;
        if (needRegime && (regime[i] == null || candles[i].close <= (regime[i] as number))) {
          return {
            exitLong: (r[i] as number) > rsiOb,
            reason: "RSI2",
          };
        }
        const long =
          (r[i - 1] as number) < rsiOs && (r[i] as number) >= rsiOs;
        const short =
          !needRegime &&
          (r[i - 1] as number) > rsiOb &&
          (r[i] as number) <= rsiOb;
        const exitLong = (r[i] as number) > rsiOb;
        const exitShort = (r[i] as number) < rsiOs;
        return { long, short, exitLong, exitShort, reason: "RSI2 MR" };
      };

    case "donchianTurtle":
      return (candles, i, ctx) => {
        const ent = ctx.donchianEntry as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const ex = ctx.donchianExit as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        if (ent.upper[i] == null || ent.lower[i] == null) return {};
        const c = candles[i].close;
        const long = c > (ent.upper[i] as number);
        const short = c < (ent.lower[i] as number);
        const exitLong =
          ex.lower[i] != null && c < (ex.lower[i] as number);
        const exitShort =
          ex.upper[i] != null && c > (ex.upper[i] as number);
        return { long, short, exitLong, exitShort, reason: "Turtle DC" };
      };

    case "supertrendAdx":
      return (_c, i, ctx) => {
        const st = ctx.st as { direction: (-1 | 1 | null)[] };
        const d = ctx.dmi as {
          adx: (number | null)[];
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        const dir = st.direction;
        if (
          !dir ||
          dir[i] == null ||
          dir[i - 1] == null ||
          d.adx[i] == null
        )
          return {};
        const strong = (d.adx[i] as number) >= adxMin;
        const flipBull =
          (dir[i - 1] as number) < 0 && (dir[i] as number) > 0;
        const flipBear =
          (dir[i - 1] as number) > 0 && (dir[i] as number) < 0;
        const diBull =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.plusDI[i] as number) > (d.minusDI[i] as number);
        const diBear =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.minusDI[i] as number) > (d.plusDI[i] as number);
        const long = strong && flipBull && diBull;
        const short = strong && flipBear && diBear;
        const exitLong =
          (dir[i] as number) < 0 || (d.adx[i] as number) < 20;
        const exitShort =
          (dir[i] as number) > 0 || (d.adx[i] as number) < 20;
        return { long, short, exitLong, exitShort, reason: "ST+ADX" };
      };

    case "adxPumpStages":
      return (_c, i, ctx) => {
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
          osc: (number | null)[];
          mid: (number | null)[];
          early: (number | null)[];
          confirm: (number | null)[];
          adx: (number | null)[];
          adxEarly: (number | null)[];
          adxMid: (number | null)[];
          adxConfirmSmooth: (number | null)[];
        };
        if (
          r.stage[i] == null ||
          r.bias[i] == null ||
          r.osc[i] == null ||
          i < 1
        )
          return {};
        const st = r.stage[i] as number;
        const stPrev = (r.stage[i - 1] as number) ?? 0;
        const bias = r.bias[i] as number;
        const osc = r.osc[i] as number;
        const oscPrev = (r.osc[i - 1] as number) ?? osc;
        const absSt = Math.abs(st);
        const absPrev = Math.abs(stPrev);
        // Enter on mid→confirm escalation (stage ≥2) with matching bias; prefer rising osc
        const escalated = absSt >= 2 && absSt > absPrev;
        const midRising =
          absSt >= 2 &&
          bias > 0 &&
          osc > oscPrev &&
          (r.mid[i] as number) > 0;
        const midRisingShort =
          absSt >= 2 &&
          bias < 0 &&
          osc < oscPrev &&
          (r.mid[i] as number) < 0;
        const long =
          bias > 0 && (escalated || midRising || absSt === 3);
        const short =
          bias < 0 && (escalated || midRisingShort || absSt === 3);
        // Faster exits: bias flip, stage drop to 0/1, osc zero-cross — don't wait ADX<20
        const midNow = (r.mid[i] as number) ?? 0;
        const midPrev = (r.mid[i - 1] as number) ?? midNow;
        const exitLong =
          bias < 0 ||
          absSt <= 1 ||
          (osc < 0 && oscPrev >= 0) ||
          (osc < midNow && oscPrev >= midPrev && absSt < 3);
        const exitShort =
          bias > 0 ||
          absSt <= 1 ||
          (osc > 0 && oscPrev <= 0) ||
          (osc > midNow && oscPrev <= midPrev && absSt < 3);
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: "ADX Pump",
        };
      };


    case "eliziEdgeFire":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          coherence: (number | null)[];
          bias: (number | null)[];
          pathEfficiency: (number | null)[];
          diAccel: (number | null)[];
          volSurprise: (number | null)[];
        } | undefined;
        if (!r || i < 1) return {};
        if (
          r.phase[i] == null ||
          r.edgeTemp[i] == null ||
          r.coherence[i] == null ||
          r.bias[i] == null
        )
          return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const coh = r.coherence[i] as number;
        const bias = r.bias[i] as number;
        const absPh = Math.abs(ph);
        const absPrev = Math.abs(phPrev);
        const cohArmed = params.coherenceArmed ?? 0.55;
        const fireT = params.fireTemp ?? 62;
        const armedT = params.armedTemp ?? 48;
        // Enter on escalate into armed/fire OR hold fire with real heat
        const escalated =
          absPh >= 2 &&
          absPh > absPrev &&
          coh >= cohArmed &&
          temp > tempPrev;
        const fireHold =
          absPh >= 3 && coh >= cohArmed && temp >= Math.min(55, fireT * 0.9);
        const long = bias > 0 && (escalated || fireHold);
        const short = bias < 0 && (escalated || fireHold);
        const exitLong =
          bias < 0 ||
          absPh === 4 ||
          absPh <= 1 ||
          (temp < tempPrev && temp < armedT * 0.85) ||
          (ph > 0 && absPh < absPrev && absPh <= 2 && temp < armedT);
        const exitShort =
          bias > 0 ||
          absPh === 4 ||
          absPh <= 1 ||
          (temp < tempPrev && temp < armedT * 0.85) ||
          (ph < 0 && absPh < absPrev && absPh <= 2 && temp < armedT);
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: "Elizi Fire",
        };
      };

    case "eliziEdgeExhaust":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          coherence: (number | null)[];
          bias: (number | null)[];
          volSurprise: (number | null)[];
          pathEfficiency: (number | null)[];
          diAccel: (number | null)[];
        } | undefined;
        if (!r || i < 1) return {};
        if (r.phase[i] == null || r.bias[i] == null || r.edgeTemp[i] == null)
          return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const bias = r.bias[i] as number;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const sur = r.volSurprise[i];
        const minSur = params.surpriseHigh ?? 0.7;
        const absPh = Math.abs(ph);
        const absPrev = Math.abs(phPrev);
        // Fade: enter opposite to exhaustion bias when phase newly hits exhaust
        const newlyExhaust = absPh === 4 && absPrev < 4;
        const surOk = sur == null || sur >= minSur * 0.85;
        // +4 exhaust (bull heat dying) → short fade; −4 → long fade
        const long = newlyExhaust && surOk && ph < 0;
        const short = newlyExhaust && surOk && ph > 0;
        // Exit fade when phase leaves exhaust or temp re-accelerates with old bias
        const exitLong =
          absPh !== 4 ||
          (ph > 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        const exitShort =
          absPh !== 4 ||
          (ph < 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: "Elizi Exhaust Fade",
        };
      };


    case "hybridMacdPump":
    case "hybridMacdPumpLong":
      return (_c, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
          hist: (number | null)[];
        };
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
        };
        const d = ctx.dmi as {
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        const j = ctx.jks as {
          k: (number | null)[];
          d: (number | null)[];
          state: (number | null)[];
        };
        const el = ctx.elizi as
          | {
              phase: (number | null)[];
              volSurprise: (number | null)[];
            }
          | undefined;
        if (
          i < 1 ||
          m.macd[i] == null ||
          m.signal[i] == null ||
          r.stage[i] == null ||
          r.bias[i] == null
        )
          return {};
        const macdBull = crossedAbove(m.macd, m.signal, i);
        const macdBear = crossedBelow(m.macd, m.signal, i);
        const macdUp = (m.macd[i] as number) > (m.signal[i] as number);
        const bias = r.bias[i] as number;
        const absSt = Math.abs(r.stage[i] as number);
        const absPrev = Math.abs((r.stage[i - 1] as number) ?? 0);
        const pumpEsc =
          absSt >= 2 && absSt > absPrev && bias > 0;
        const diBull =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.plusDI[i] as number) > (d.minusDI[i] as number);
        // Bakeoff: MACD long was strong; Pump long strong; don't over-filter MACD longs.
        const long =
          macdBull || (pumpEsc && macdUp && diBull);
        // Bakeoff: Jurik/MACD shorts overshot when stacked; only Elizi Exhaust fade shorts.
        let exhaustShort = false;
        if (el && el.phase[i] != null) {
          const ph = el.phase[i] as number;
          const phPrev = (el.phase[i - 1] as number) ?? 0;
          const newly = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
          exhaustShort = newly && ph > 0; // bull exhaust → short fade
        }
        const short =
          params.preset !== "hybridMacdPumpLong" && exhaustShort;
        // Keep MACD-style exits — bakeoff: bias exits cut MACD long runners.
        const exitLong = macdBear;
        const exitShort = macdBull;
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason:
            params.preset === "hybridMacdPumpLong"
              ? "Hybrid L (MACD/Pump)"
              : "Hybrid MACD/Pump/JKS",
        };
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
