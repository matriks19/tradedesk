import type { Candle, Exchange, TickerQuote } from "@/lib/types";
import {
  atr,
  bollinger,
  closes,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
  supertrend,
} from "@/lib/indicators/math";

export type ScannerFilter =
  | { type: "rsi"; op: "lt" | "gt"; value: number; period?: number }
  | { type: "changePct"; op: "lt" | "gt"; value: number }
  | { type: "volumeSpike"; mult: number }
  | { type: "emaCross"; direction: "bull" | "bear"; fast?: number; slow?: number }
  | { type: "macdCross"; direction: "bull" | "bear" }
  | { type: "bbSqueeze"; lookback?: number; pctile?: number }
  | { type: "bbBreak"; side: "upper" | "lower" }
  | { type: "supertrendFlip"; direction: "bull" | "bear"; period?: number; mult?: number }
  | { type: "atrPctHigh"; minPct: number; period?: number }
  | { type: "stoch"; zone: "oversold" | "overbought"; kPeriod?: number; level?: number }
  | { type: "consecBars"; color: "green" | "red"; count: number }
  | { type: "nearHod"; pct?: number }
  | { type: "nearLod"; pct?: number }
  | { type: "priceVsSma"; period: 50 | 200; side: "above" | "below" }
  | { type: "rsiDivergence"; direction: "bull" | "bear"; lookback?: number };

export interface ScannerRow {
  symbol: string;
  exchange: Exchange;
  last: number;
  changePct: number;
  rsi?: number;
  volume?: number;
  quoteVolume?: number;
  atrPct?: number;
  note: string;
}

export interface ScanProgress {
  done: number;
  total: number;
}

export const SCANNER_PRESETS: Record<
  string,
  { label: string; filters: ScannerFilter[]; description?: string }
> = {
  asiri_satim: {
    label: "Aşırı satım kombosu",
    description: "RSI<30 + Stochastic oversold",
    filters: [
      { type: "rsi", op: "lt", value: 30 },
      { type: "stoch", zone: "oversold" },
    ],
  },
  momentum_breakout: {
    label: "Momentum breakout",
    description: "%Δ>3 + hacim x1.8 + BB üst kırılım",
    filters: [
      { type: "changePct", op: "gt", value: 3 },
      { type: "volumeSpike", mult: 1.8 },
      { type: "bbBreak", side: "upper" },
    ],
  },
  hacim_ema: {
    label: "Hacim+EMA",
    description: "Hacim spike + EMA bull cross",
    filters: [
      { type: "volumeSpike", mult: 2 },
      { type: "emaCross", direction: "bull" },
    ],
  },
  macd_bull: {
    label: "MACD bull",
    description: "MACD çizgisi sinyal üstü kesişim",
    filters: [{ type: "macdCross", direction: "bull" }],
  },
  bb_sikisma: {
    label: "BB sıkışma",
    description: "Bollinger band width sıkışması",
    filters: [{ type: "bbSqueeze" }],
  },
  supertrend_long: {
    label: "Supertrend long",
    description: "Supertrend bullish flip",
    filters: [{ type: "supertrendFlip", direction: "bull" }],
  },
  crypto_gainers: {
    label: "Crypto gainers",
    description: "%Δ > 5 (Binance)",
    filters: [{ type: "changePct", op: "gt", value: 5 }],
  },
  crypto_losers: {
    label: "Crypto losers",
    description: "%Δ < -5 (Binance)",
    filters: [{ type: "changePct", op: "lt", value: -5 }],
  },
  bist_gainers: {
    label: "BIST gainers",
    description: "%Δ > 3 (BIST)",
    filters: [{ type: "changePct", op: "gt", value: 3 }],
  },
  bist_losers: {
    label: "BIST losers",
    description: "%Δ < -3 (BIST)",
    filters: [{ type: "changePct", op: "lt", value: -3 }],
  },
  rsi_oversold: {
    label: "RSI < 30",
    filters: [{ type: "rsi", op: "lt", value: 30 }],
  },
  rsi_overbought: {
    label: "RSI > 70",
    filters: [{ type: "rsi", op: "gt", value: 70 }],
  },
  near_hod: {
    label: "Günün zirvesine yakın",
    description: "24s high'a %1 içinde",
    filters: [{ type: "nearHod", pct: 1 }],
  },
  near_lod: {
    label: "Günün dibine yakın",
    description: "24s low'a %1 içinde",
    filters: [{ type: "nearLod", pct: 1 }],
  },
  above_sma200: {
    label: "SMA200 üstü",
    filters: [{ type: "priceVsSma", period: 200, side: "above" }],
  },
  atr_yuksek: {
    label: "ATR% yüksek",
    description: "Volatilite (ATR/fiyat) > %2",
    filters: [{ type: "atrPctHigh", minPct: 2 }],
  },
  yesil_seri: {
    label: "3 yeşil bar",
    filters: [{ type: "consecBars", color: "green", count: 3 }],
  },
  rsi_div_bull: {
    label: "RSI bull diverjans",
    description: "Basit fiyat LL + RSI HL sketch",
    filters: [{ type: "rsiDivergence", direction: "bull" }],
  },
  multi_long: {
    label: "Multi long combo",
    description: "EMA↑ + MACD bull + RSI>50",
    filters: [
      { type: "emaCross", direction: "bull" },
      { type: "macdCross", direction: "bull" },
      { type: "rsi", op: "gt", value: 50 },
    ],
  },
  multi_mean_rev: {
    label: "Mean reversion combo",
    description: "RSI<30 + BB alt + Stoch OS",
    filters: [
      { type: "rsi", op: "lt", value: 30 },
      { type: "bbBreak", side: "lower" },
      { type: "stoch", zone: "oversold" },
    ],
  },
};

const CANDLE_FILTERS = new Set([
  "rsi",
  "volumeSpike",
  "emaCross",
  "macdCross",
  "bbSqueeze",
  "bbBreak",
  "supertrendFlip",
  "atrPctHigh",
  "stoch",
  "consecBars",
  "priceVsSma",
  "rsiDivergence",
]);

export function filtersNeedCandles(filters: ScannerFilter[]): boolean {
  return filters.some((f) => CANDLE_FILTERS.has(f.type));
}

export function matchFilters(
  quote: TickerQuote,
  candles: Candle[] | null,
  filters: ScannerFilter[]
): { ok: boolean; note: string; rsi?: number; atrPct?: number } {
  const notes: string[] = [];
  let lastRsi: number | undefined;
  let lastAtrPct: number | undefined;

  for (const f of filters) {
    if (f.type === "changePct") {
      const ok =
        f.op === "gt" ? quote.changePct > f.value : quote.changePct < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`%Δ ${quote.changePct.toFixed(2)}`);
    } else if (f.type === "nearHod") {
      const hi = quote.high24h;
      if (!hi || hi <= 0) return { ok: false, note: "" };
      const pct = ((hi - quote.last) / hi) * 100;
      if (pct < 0 || pct > (f.pct ?? 1)) return { ok: false, note: "" };
      notes.push(`HOD −${pct.toFixed(2)}%`);
    } else if (f.type === "nearLod") {
      const lo = quote.low24h;
      if (!lo || lo <= 0) return { ok: false, note: "" };
      const pct = ((quote.last - lo) / lo) * 100;
      if (pct < 0 || pct > (f.pct ?? 1)) return { ok: false, note: "" };
      notes.push(`LOD +${pct.toFixed(2)}%`);
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
        vols.slice(-21, -1).reduce((a, b) => a + b, 0) /
        Math.min(20, vols.length - 1);
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
    } else if (f.type === "macdCross") {
      if (!candles || candles.length < 50) return { ok: false, note: "" };
      const m = macd(closes(candles));
      const i = candles.length - 1;
      const j = i - 1;
      if (
        m.macd[i] == null ||
        m.signal[i] == null ||
        m.macd[j] == null ||
        m.signal[j] == null
      )
        return { ok: false, note: "" };
      const bull =
        (m.macd[j] as number) <= (m.signal[j] as number) &&
        (m.macd[i] as number) > (m.signal[i] as number);
      const bear =
        (m.macd[j] as number) >= (m.signal[j] as number) &&
        (m.macd[i] as number) < (m.signal[i] as number);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "MACD↑" : "MACD↓");
    } else if (f.type === "bbSqueeze") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const c = closes(candles);
      const bb = bollinger(c, 20, 2);
      const widths: number[] = [];
      for (let i = 0; i < c.length; i++) {
        if (bb.upper[i] != null && bb.lower[i] != null && bb.mid[i] != null) {
          widths.push(
            (((bb.upper[i] as number) - (bb.lower[i] as number)) /
              (bb.mid[i] as number)) *
              100
          );
        }
      }
      if (widths.length < 20) return { ok: false, note: "" };
      const lookback = Math.min(f.lookback ?? 50, widths.length);
      const window = widths.slice(-lookback);
      const last = window[window.length - 1];
      const sorted = [...window].sort((a, b) => a - b);
      const pctile = f.pctile ?? 20;
      const thresh = sorted[Math.floor((pctile / 100) * (sorted.length - 1))];
      if (!(last <= thresh)) return { ok: false, note: "" };
      notes.push(`BB sq ${last.toFixed(2)}%`);
    } else if (f.type === "bbBreak") {
      if (!candles || candles.length < 25) return { ok: false, note: "" };
      const c = closes(candles);
      const bb = bollinger(c, 20, 2);
      const i = c.length - 1;
      if (bb.upper[i] == null || bb.lower[i] == null)
        return { ok: false, note: "" };
      if (f.side === "upper" && !(c[i] > (bb.upper[i] as number)))
        return { ok: false, note: "" };
      if (f.side === "lower" && !(c[i] < (bb.lower[i] as number)))
        return { ok: false, note: "" };
      notes.push(f.side === "upper" ? "BB↑ break" : "BB↓ break");
    } else if (f.type === "supertrendFlip") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const st = supertrend(candles, f.period ?? 10, f.mult ?? 3);
      const i = candles.length - 1;
      const j = i - 1;
      if (st.direction[i] == null || st.direction[j] == null)
        return { ok: false, note: "" };
      const bull = st.direction[j] === -1 && st.direction[i] === 1;
      const bear = st.direction[j] === 1 && st.direction[i] === -1;
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "ST↑ flip" : "ST↓ flip");
    } else if (f.type === "atrPctHigh") {
      if (!candles || candles.length < 20) return { ok: false, note: "" };
      const a = atr(candles, f.period ?? 14);
      const i = candles.length - 1;
      if (a[i] == null || candles[i].close <= 0) return { ok: false, note: "" };
      const pct = ((a[i] as number) / candles[i].close) * 100;
      lastAtrPct = pct;
      if (!(pct >= f.minPct)) return { ok: false, note: "" };
      notes.push(`ATR% ${pct.toFixed(2)}`);
    } else if (f.type === "stoch") {
      if (!candles || candles.length < 25) return { ok: false, note: "" };
      const s = stochastic(candles, f.kPeriod ?? 14, 3);
      const v = s.k[s.k.length - 1];
      if (v == null) return { ok: false, note: "" };
      const level = f.level ?? (f.zone === "oversold" ? 20 : 80);
      if (f.zone === "oversold" && !(v < level)) return { ok: false, note: "" };
      if (f.zone === "overbought" && !(v > level)) return { ok: false, note: "" };
      notes.push(`Stoch ${v.toFixed(0)}`);
    } else if (f.type === "consecBars") {
      if (!candles || candles.length < f.count) return { ok: false, note: "" };
      for (let i = candles.length - f.count; i < candles.length; i++) {
        const green = candles[i].close >= candles[i].open;
        if (f.color === "green" && !green) return { ok: false, note: "" };
        if (f.color === "red" && green) return { ok: false, note: "" };
      }
      notes.push(`${f.count}×${f.color === "green" ? "yeşil" : "kırmızı"}`);
    } else if (f.type === "priceVsSma") {
      if (!candles || candles.length < f.period + 5)
        return { ok: false, note: "" };
      const s = sma(closes(candles), f.period);
      const v = s[s.length - 1];
      if (v == null) return { ok: false, note: "" };
      const last = candles[candles.length - 1].close;
      if (f.side === "above" && !(last > v)) return { ok: false, note: "" };
      if (f.side === "below" && !(last < v)) return { ok: false, note: "" };
      notes.push(`vs SMA${f.period} ${f.side}`);
    } else if (f.type === "rsiDivergence") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const lookback = f.lookback ?? 20;
      const c = closes(candles);
      const r = rsi(c, 14);
      const end = c.length - 1;
      const start = Math.max(0, end - lookback);
      let priceExt = start;
      let rsiExt = start;
      for (let i = start; i <= end; i++) {
        if (r[i] == null) continue;
        if (f.direction === "bull") {
          if (c[i] <= c[priceExt]) priceExt = i;
          if ((r[i] as number) <= (r[rsiExt] as number)) rsiExt = i;
        } else {
          if (c[i] >= c[priceExt]) priceExt = i;
          if ((r[i] as number) >= (r[rsiExt] as number)) rsiExt = i;
        }
      }
      if (r[end] == null || r[priceExt] == null) return { ok: false, note: "" };
      // bullish: price lower low near end, RSI higher low
      let ok = false;
      if (f.direction === "bull") {
        ok =
          priceExt > start &&
          priceExt >= end - 5 &&
          c[priceExt] < c[start] &&
          (r[priceExt] as number) > (r[rsiExt] as number) * 0.98 &&
          (r[end] as number) > (r[priceExt] as number);
      } else {
        ok =
          priceExt > start &&
          priceExt >= end - 5 &&
          c[priceExt] > c[start] &&
          (r[priceExt] as number) < (r[rsiExt] as number) * 1.02 &&
          (r[end] as number) < (r[priceExt] as number);
      }
      if (!ok) return { ok: false, note: "" };
      lastRsi = r[end] as number;
      notes.push(f.direction === "bull" ? "RSI↑ div" : "RSI↓ div");
    }
  }
  return { ok: true, note: notes.join(" · "), rsi: lastRsi, atrPct: lastAtrPct };
}

/** Run async work over items with limited concurrency. Supports AbortSignal. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    async () => {
      while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const i = next++;
        if (i >= items.length) break;
        results[i] = await fn(items[i], i);
        done++;
        onProgress?.(done, items.length);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
