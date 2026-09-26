/**
 * PLI-DT Uyumsuzluk mum sayısı (bağımlılıksız — AlertWatcher ilk yükleme paketine hafif girer).
 *
 * Isınma = PLI penceresi (len) + pivot sol/sağ (lbL + lbR) + iki pivot arası en fazla mesafe
 * (rangeUpper). T/D durum makinesi ve "önceki onaylı D/T" geçmişe bağlı olduğundan üstüne 200 pay.
 * Liste taraması ve alarm aynı formülü kullanır. En az 300, en çok 1000.
 */
export function pliDtDivFetchLimit(
  length = 50,
  lbL = 5,
  lbR = 3,
  rangeUpper = 60
): number {
  const len = Math.max(2, Math.floor(Number(length) || 50));
  const l = Math.max(1, Math.floor(Number(lbL) || 5));
  const r = Math.max(1, Math.floor(Number(lbR) || 3));
  const ru = Math.max(1, Math.floor(Number(rangeUpper) || 60));
  return Math.min(1000, Math.max(300, len + l + r + ru + 200));
}

/** En az mum: PLI penceresi + pivot sol/sağ + 20 (ilk pivot çifti için). En çok 1000. */
export function pliDtDivMinBars(length = 50, lbL = 5, lbR = 3): number {
  const len = Math.max(2, Math.floor(Number(length) || 50));
  const l = Math.max(1, Math.floor(Number(lbL) || 5));
  const r = Math.max(1, Math.floor(Number(lbR) || 3));
  return Math.min(1000, len + l + r + 20);
}
