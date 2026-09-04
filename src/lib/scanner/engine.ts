import type { Candle, Exchange, TickerQuote } from "@/lib/types";
import { closes, ema, rsi } from "@/lib/indicators/math";

export type ScannerFilter =
  | { type: "rsi"; op: "lt" | "gt"; value: number; period?: number }
  | { type: "changePct"; op: "lt" | "gt"; value: number }
  | { type: "volumeSpike"; mult: number }
  | { type: "emaCross"; direction: "bull" | "bear"; fast?: number; slow?: number };

export interface ScannerRow {
  symbol: string;
  exchange: Exchange;
  last: number;
  changePct: number;
  rsi?: number;
  note: string;
}

export function matchFilters(
  quote: TickerQuote,
  candles: Candle[] | null,
  filters: ScannerFilter[]
): { ok: boolean; note: string; rsi?: number } {
  const notes: string[] = [];
  let lastRsi: number | undefined;

  for (const f of filters) {
    if (f.type === "changePct") {
      const ok =
        f.op === "gt" ? quote.changePct > f.value : quote.changePct < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`%Δ ${quote.changePct.toFixed(2)}`);
    } else if (f.type === "rsi") {
      if (!candles || candles.length < 30) return { ok: false, note: "" };
      const r = rsi(closes(candles), f.period ?? 14);
      const v = r[r.length - 1];
      if (v == null) return { ok: false, note: "" };
      lastRsi = v;
      const ok = f.op === "gt" ? v > f.value : v < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`RSI ${v.toFixed(1)}`);
    } else if (f.type === "volumeSpike") {
      if (!candles || candles.length < 25) return { ok: false, note: "" };
      const vols = candles.map((c) => c.volume);
      const last = vols[vols.length - 1];
      const avg =
        vols.slice(-21, -1).reduce((a, b) => a + b, 0) / Math.min(20, vols.length - 1);
      if (!(last > avg * f.mult)) return { ok: false, note: "" };
      notes.push(`Vol x${(last / avg).toFixed(1)}`);
    } else if (f.type === "emaCross") {
      if (!candles || candles.length < 60) return { ok: false, note: "" };
      const fast = ema(closes(candles), f.fast ?? 9);
      const slow = ema(closes(candles), f.slow ?? 21);
      const i = candles.length - 1;
      const j = i - 1;
      if (
        fast[i] == null ||
        slow[i] == null ||
        fast[j] == null ||
        slow[j] == null
      )
        return { ok: false, note: "" };
      const bull =
        (fast[j] as number) <= (slow[j] as number) &&
        (fast[i] as number) > (slow[i] as number);
      const bear =
        (fast[j] as number) >= (slow[j] as number) &&
        (fast[i] as number) < (slow[i] as number);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "EMA↑ cross" : "EMA↓ cross");
    }
  }
  return { ok: true, note: notes.join(" · "), rsi: lastRsi };
}
