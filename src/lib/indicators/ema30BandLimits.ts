/**
 * EMA30 Band Kırılım mum sayısı (bağımlılıksız — AlertWatcher ilk yükleme paketine hafif girer).
 * EMA200 ısınması ≈200 mum; ayrıca var lastDir / prevPeak / prevTrough durumu geçmişin başlangıcına bağlı
 * olduğundan liste taraması ve alarm 1000 mum çeker (Binance 500–1000 aynı ağırlık).
 */
export const EMA30_BAND_FETCH_LIMIT = 1000;
export function ema30BandFetchLimit(): number {
  return EMA30_BAND_FETCH_LIMIT;
}
