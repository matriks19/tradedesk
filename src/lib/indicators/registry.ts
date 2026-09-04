import type { Candle, BuiltinIndicatorId, IndicatorInstance } from "@/lib/types";
import {
  atr,
  bollinger,
  closes,
  donchian,
  ema,
  hull,
  macd,
  rsi,
  sma,
  stochastic,
  stochRsi,
  supertrend,
  toLineData,
  volumeOsc,
  vwap,
} from "./math";

export interface PlotSeries {
  id: string;
  pane: "main" | "sub";
  type: "line" | "histogram";
  color: string;
  data: { time: number; value: number }[];
  title?: string;
}

export const BUILTIN_META: Record<
  BuiltinIndicatorId,
  { label: string; defaults: Record<string, number>; pane: "main" | "sub" }
> = {
  sma: { label: "SMA", defaults: { period: 20 }, pane: "main" },
  ema: { label: "EMA", defaults: { period: 21 }, pane: "main" },
  rsi: { label: "RSI", defaults: { period: 14 }, pane: "sub" },
  macd: {
    label: "MACD",
    defaults: { fast: 12, slow: 26, signal: 9 },
    pane: "sub",
  },
  bollinger: {
    label: "Bollinger",
    defaults: { period: 20, mult: 2 },
    pane: "main",
  },
  atr: { label: "ATR", defaults: { period: 14 }, pane: "sub" },
  stochastic: {
    label: "Stochastic",
    defaults: { kPeriod: 14, dPeriod: 3 },
    pane: "sub",
  },
  vwap: { label: "VWAP", defaults: {}, pane: "main" },
  supertrend: {
    label: "Supertrend",
    defaults: { period: 10, mult: 3 },
    pane: "main",
  },
  donchian: {
    label: "Donchian",
    defaults: { period: 20 },
    pane: "main",
  },
  hull: {
    label: "Hull MA",
    defaults: { period: 20 },
    pane: "main",
  },
  volumeOsc: {
    label: "Volume Osc",
    defaults: { shortPeriod: 5, longPeriod: 10 },
    pane: "sub",
  },
  stochRsi: {
    label: "Stoch RSI",
    defaults: { rsiPeriod: 14, stochPeriod: 14, kSmooth: 3, dSmooth: 3 },
    pane: "sub",
  },
};

const COLORS = [
  "#2962ff",
  "#ff6d00",
  "#e040fb",
  "#00bcd4",
  "#ffeb3b",
  "#8bc34a",
  "#f44336",
  "#9c27b0",
];

export function computeBuiltin(
  inst: IndicatorInstance,
  candles: Candle[]
): PlotSeries[] {
  if (inst.type === "custom") return [];
  const c = closes(candles);
  const color = inst.color ?? COLORS[hash(inst.id) % COLORS.length];
  const p = inst.params as Record<string, number>;

  switch (inst.type) {
    case "sma":
      return [
        {
          id: `${inst.id}-sma`,
          pane: "main",
          type: "line",
          color,
          data: toLineData(candles, sma(c, Number(p.period ?? 20))),
          title: `SMA(${p.period ?? 20})`,
        },
      ];
    case "ema":
      return [
        {
          id: `${inst.id}-ema`,
          pane: "main",
          type: "line",
          color,
          data: toLineData(candles, ema(c, Number(p.period ?? 21))),
          title: `EMA(${p.period ?? 21})`,
        },
      ];
    case "rsi":
      return [
        {
          id: `${inst.id}-rsi`,
          pane: "sub",
          type: "line",
          color,
          data: toLineData(candles, rsi(c, Number(p.period ?? 14))),
          title: `RSI(${p.period ?? 14})`,
        },
      ];
    case "macd": {
      const m = macd(
        c,
        Number(p.fast ?? 12),
        Number(p.slow ?? 26),
        Number(p.signal ?? 9)
      );
      return [
        {
          id: `${inst.id}-macd`,
          pane: "sub",
          type: "line",
          color: "#2962ff",
          data: toLineData(candles, m.macd),
          title: "MACD",
        },
        {
          id: `${inst.id}-sig`,
          pane: "sub",
          type: "line",
          color: "#ff6d00",
          data: toLineData(candles, m.signal),
          title: "Signal",
        },
        {
          id: `${inst.id}-hist`,
          pane: "sub",
          type: "histogram",
          color: "#26a69a",
          data: toLineData(candles, m.hist),
          title: "Hist",
        },
      ];
    }
    case "bollinger": {
      const b = bollinger(c, Number(p.period ?? 20), Number(p.mult ?? 2));
      return [
        {
          id: `${inst.id}-mid`,
          pane: "main",
          type: "line",
          color: "#2962ff",
          data: toLineData(candles, b.mid),
          title: "BB Mid",
        },
        {
          id: `${inst.id}-up`,
          pane: "main",
          type: "line",
          color: "#ef5350",
          data: toLineData(candles, b.upper),
          title: "BB Up",
        },
        {
          id: `${inst.id}-lo`,
          pane: "main",
          type: "line",
          color: "#26a69a",
          data: toLineData(candles, b.lower),
          title: "BB Low",
        },
      ];
    }
    case "atr":
      return [
        {
          id: `${inst.id}-atr`,
          pane: "sub",
          type: "line",
          color,
          data: toLineData(candles, atr(candles, Number(p.period ?? 14))),
          title: `ATR(${p.period ?? 14})`,
        },
      ];
    case "stochastic": {
      const s = stochastic(
        candles,
        Number(p.kPeriod ?? 14),
        Number(p.dPeriod ?? 3)
      );
      return [
        {
          id: `${inst.id}-k`,
          pane: "sub",
          type: "line",
          color: "#2962ff",
          data: toLineData(candles, s.k),
          title: "%K",
        },
        {
          id: `${inst.id}-d`,
          pane: "sub",
          type: "line",
          color: "#ff6d00",
          data: toLineData(candles, s.d),
          title: "%D",
        },
      ];
    }
    case "vwap":
      return [
        {
          id: `${inst.id}-vwap`,
          pane: "main",
          type: "line",
          color: "#e040fb",
          data: toLineData(candles, vwap(candles)),
          title: "VWAP",
        },
      ];
    case "supertrend": {
      const st = supertrend(
        candles,
        Number(p.period ?? 10),
        Number(p.mult ?? 3)
      );
      return [
        {
          id: `${inst.id}-st`,
          pane: "main",
          type: "line",
          color: "#00bcd4",
          data: toLineData(candles, st.line),
          title: "Supertrend",
        },
      ];
    }
    case "donchian": {
      const d = donchian(candles, Number(p.period ?? 20));
      return [
        {
          id: `${inst.id}-up`,
          pane: "main",
          type: "line",
          color: "#26a69a",
          data: toLineData(candles, d.upper),
          title: "Donch Up",
        },
        {
          id: `${inst.id}-lo`,
          pane: "main",
          type: "line",
          color: "#ef5350",
          data: toLineData(candles, d.lower),
          title: "Donch Low",
        },
        {
          id: `${inst.id}-mid`,
          pane: "main",
          type: "line",
          color: "#2962ff",
          data: toLineData(candles, d.mid),
          title: "Donch Mid",
        },
      ];
    }
    case "hull":
      return [
        {
          id: `${inst.id}-hull`,
          pane: "main",
          type: "line",
          color: "#00bcd4",
          data: toLineData(candles, hull(c, Number(p.period ?? 20))),
          title: `HMA(${p.period ?? 20})`,
        },
      ];
    case "volumeOsc":
      return [
        {
          id: `${inst.id}-vo`,
          pane: "sub",
          type: "histogram",
          color: "#e040fb",
          data: toLineData(
            candles,
            volumeOsc(
              candles,
              Number(p.shortPeriod ?? 5),
              Number(p.longPeriod ?? 10)
            )
          ),
          title: "Vol Osc",
        },
      ];
    case "stochRsi": {
      const sr = stochRsi(
        c,
        Number(p.rsiPeriod ?? 14),
        Number(p.stochPeriod ?? 14),
        Number(p.kSmooth ?? 3),
        Number(p.dSmooth ?? 3)
      );
      return [
        {
          id: `${inst.id}-k`,
          pane: "sub",
          type: "line",
          color: "#2962ff",
          data: toLineData(candles, sr.k),
          title: "StochRSI %K",
        },
        {
          id: `${inst.id}-d`,
          pane: "sub",
          type: "line",
          color: "#ff6d00",
          data: toLineData(candles, sr.d),
          title: "StochRSI %D",
        },
      ];
    }
    default:
      return [];
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
