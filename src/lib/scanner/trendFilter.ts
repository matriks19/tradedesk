/**
 * Liste trend filtresi (4s EMA200 eşdeğeri) — yalnız kripto (Binance USDT perp; BIST ve
 * Binance TradFi perp hariç).
 *  - AL (bull) sinyal: sinyal mumunun kapanışı > trend EMA ise kalır
 *  - SAT (bear) sinyal: yalnız `bear` açıksa filtrelenir (kapanış < trend EMA) — test edilmedi
 *  - yönsüz (neutral) sinyaller ve yetersiz mum (< periyot) → filtrelenmez
 *  - 4s altı TF'de ölçekli periyot çekilen mumu aşarsa (15dk/30dk, yeni listelenenler) ayrı 4s mumları
 *    (`htf`, 300) ile gerçek 4s EMA200: sinyal mumunun kapanış zamanında ya da öncesinde KAPANMIŞ son 4s
 *    mumu (4s kapanış ≤ sinyal kapanışı; ileriye bakış yok). 4s mum < 200 → filtre yok.
 */
import type { Candle } from "@/lib/types";
import { ema } from "@/lib/indicators/math";
import { TRADFI_USDT_PERPS } from "@/lib/data/binanceTradfiSnapshot";

import { HTF_SEC, HTF_PERIOD } from "./trendFilterLimits";
export {
  tfMinutes,
  trendEmaPeriod,
  trendFilterFetchLimit,
  TREND_MAX_FETCH,
  HTF_TF,
  HTF_SEC,
  HTF_PERIOD,
  HTF_FETCH,
  needsHtfTrend,
} from "./trendFilterLimits";

export type TrendFilterCfg = {
  enabled: boolean;
  /** SAT sinyallerini de filtrele (varsayılan kapalı, test edilmedi) */
  bear?: boolean;
  /** Etkin EMA periyodu (trendEmaPeriod(tf)) */
  period: number;
  /** Tarama TF'si dakika (sinyal mumu kapanış zamanı için; yoksa mum aralığından çıkarılır) */
  tfMin?: number;
  /**
   * Çalışma anında eklenir (kaydedilmez): ayrı çekilen 4s mumları. Yalnız ölçekli periyot mevcut
   * mumları aştığında kullanılır.
   */
  htf?: Candle[];
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

/**
 * Sinyal mumunun kapanışında (openTime + tfSec) ya da öncesinde kapanmış son 4s mumunun indeksi
 * (4s openTime + 4s ≤ sinyal kapanışı). Yoksa −1. `htf` zaman sıralı olmalı.
 */
export function lastClosedHtfIndex(htf: Candle[], signalCloseSec: number): number {
  let lo = 0, hi = htf.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (htf[mid]!.time + HTF_SEC <= signalCloseSec) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Tarama TF'si saniye: cfg.tfMin, yoksa son iki mum aralığı. */
function tfSecOf(candles: Candle[], tfMin?: number): number {
  if (tfMin && tfMin > 0) return tfMin * 60;
  const n = candles.length;
  return n >= 2 ? Math.max(1, candles[n - 1]!.time - candles[n - 2]!.time) : HTF_SEC;
}

/**
 * Sinyal başına trend eşiği döndüren fonksiyon (null → filtre yok):
 *  - mum ≥ periyot → tarama TF'sinde EMA(periyot), sinyal mumunda
 *  - değilse ve htf verilmişse → kapanmış son 4s mumunda 4s EMA200
 */
export function trendRefFor(
  candles: Candle[],
  cfg: TrendFilterCfg
): ((barsAgo: number) => number | null) | null {
  const es = trendEmaSeries(candles, cfg.period);
  if (es) {
    return (ago) => {
      const i = candles.length - 1 - ago;
      return i >= 0 ? es[i] ?? null : null;
    };
  }
  const htf = cfg.htf;
  if (!htf || htf.length < HTF_PERIOD) return null;
  const he = ema(htf.map((c) => c.close), HTF_PERIOD);
  const sec = tfSecOf(candles, cfg.tfMin);
  return (ago) => {
    const i = candles.length - 1 - ago;
    if (i < 0) return null;
    const j = lastClosedHtfIndex(htf, candles[i]!.time + sec);
    return j >= 0 ? he[j] ?? null : null;
  };
}

/** Sinyal (bias, barsAgo) trend referansına göre kalır mı? */
export function passesTrendRef(
  candles: Candle[],
  ref: ((barsAgo: number) => number | null) | null,
  bias: "bull" | "bear" | "neutral",
  barsAgo: number,
  bear: boolean
): boolean {
  if (!ref || bias === "neutral") return true;
  if (bias === "bear" && !bear) return true;
  const e = ref(barsAgo);
  if (e == null) return true;
  const i = candles.length - 1 - barsAgo;
  if (i < 0) return true;
  const c = candles[i]!.close;
  return bias === "bull" ? c > e : c < e;
}
