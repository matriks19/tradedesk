/**
 * PLI± mum sayısı (bağımlılıksız — AlertWatcher ilk yükleme paketine hafif girer).
 * PLI penceresi + squeeze lookback (50) ya da Hull ısınması (n − 1 + ⌊√n⌋ − 1) + kesişim için
 * önceki mum; üstüne 120 pay. En az 220, en çok 1000.
 */
export function pliDirFetchLimit(hullLen = 55, length = 50): number {
  const h = Math.max(1, Math.floor(Number(hullLen) || 55));
  const len = Math.max(2, Math.floor(Number(length) || 50));
  const warm = Math.max(h + Math.floor(Math.sqrt(h)), len + 50);
  return Math.min(1000, Math.max(220, warm + 120));
}
