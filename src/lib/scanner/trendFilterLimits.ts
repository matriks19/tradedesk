/**
 * Liste "Trend filtresi (4s EMA200)" — bağımlılıksız yardımcılar (AlertWatcher'a hafif girer).
 *
 * Lab testi 4 saatlik mumlarda EMA200 ile yapıldı. 4s altı zaman dilimlerinde aynı trendi
 * tarama TF'sinde ölçeklenmiş periyotla yaklaşıklarız: periyot = 200 · (240 / tfDakika)
 * (1s → EMA800, 2s → EMA400, 15dk → EMA3200). 4s ve üstü: kendi TF'sinde EMA200.
 */

const UNIT_MIN: Record<string, number> = { m: 1, h: 60, d: 1440, w: 10080 };

/** "15m" / "1h" / "90m" / "1d" / "1w" → dakika (bilinmiyorsa 240). */
export function tfMinutes(tf: string | undefined | null): number {
  const m = /^(\d+)\s*([mhdw])$/i.exec(String(tf ?? "").trim());
  if (!m) return 240;
  const v = Number(m[1]) * (UNIT_MIN[m[2]!.toLowerCase()] ?? 0);
  return v > 0 ? v : 240;
}

/** Etkin EMA periyodu: 4s altı 200·240/tf (yuvarlanır), 4s ve üstü 200. */
export function trendEmaPeriod(tf: string | undefined | null): number {
  const min = tfMinutes(tf);
  if (min >= 240) return 200;
  return Math.round((200 * 240) / min);
}

/** Binance tek istekte en fazla 1500 mum döndürür. */
export const TREND_MAX_FETCH = 1500;

/**
 * Filtre açıkken gereken mum sayısı: periyot + %25 ısınma (en az 100), en çok 1500.
 * Periyot 1500'ü aşıyorsa (≤30dk) EMA hesaplanamaz → 0 (çekim artırılmaz, filtre uygulanmaz).
 */
export function trendFilterFetchLimit(period: number): number {
  const p = Math.max(1, Math.floor(Number(period) || 200));
  if (p > TREND_MAX_FETCH) return 0;
  return Math.min(TREND_MAX_FETCH, p + Math.max(100, Math.round(p * 0.25)));
}
