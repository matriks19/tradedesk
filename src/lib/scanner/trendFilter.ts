/**
 * Liste trend filtresi (4s EMA200 eşdeğeri) — yalnız kripto (Binance USDT perp; BIST ve
 * Binance TradFi perp hariç).
 *  - AL (bull) sinyal: sinyal mumunun kapanışı > trend EMA ise kalır
 *  - SAT (bear) sinyal: yalnız `bear` açıksa filtrelenir (kapanış < trend EMA) — test edilmedi
 *  - yönsüz (neutral) sinyaller ve yetersiz mum (< periyot) → filtrelenmez
 */
import type { Candle } from "@/lib/types";
import { ema } from "@/lib/indicators/math";
import { TRADFI_USDT_PERPS } from "@/lib/data/binanceTradfiSnapshot";

export { tfMinutes, trendEmaPeriod, trendFilterFetchLimit, TREND_MAX_FETCH } from "./trendFilterLimits";

export type TrendFilterCfg = {
  enabled: boolean;
  /** SAT sinyallerini de filtrele (varsayılan kapalı, test edilmedi) */
  bear?: boolean;
  /** Etkin EMA periyodu (trendEmaPeriod(tf)) */
  period: number;
};

const norm = (s: string) => s.toUpperCase().replace(/\.P$/, "");
const TRADFI = new Set(TRADFI_USDT_PERPS.map(norm));

/** Trend filtresi bu sembole uygulanır mı? (Binance kripto; BIST ve TradFi perp hariç) */
export function trendFilterApplies(symbol: string, exchange: string, extraTradfi?: Iterable<string>): boolean {
  if (exchange !== "binance") return false;
  const s = norm(symbol);
  if (TRADFI.has(s)) return false;
  if (extraTradfi) for (const t of extraTradfi) if (norm(t) === s) return false;
  return true;
}

/** EMA serisini bir kez hesaplar; yetersiz mumda null döner (filtre yok). */
export function trendEmaSeries(candles: Candle[], period: number): (number | null)[] | null {
  const p = Math.max(1, Math.floor(period));
  if (candles.length < p) return null;
  return ema(candles.map((c) => c.close), p);
}

/** Tek bir sinyal (barsAgo) filtreden geçer mi? */
export function passesTrend(
  candles: Candle[],
  emaSeries: (number | null)[] | null,
  bias: "bull" | "bear" | "neutral",
  barsAgo: number,
  bear: boolean
): boolean {
  if (!emaSeries || bias === "neutral") return true;
  if (bias === "bear" && !bear) return true;
  const i = candles.length - 1 - barsAgo;
  if (i < 0) return true;
  const e = emaSeries[i];
  if (e == null) return true;
  const c = candles[i]!.close;
  return bias === "bull" ? c > e : c < e;
}
