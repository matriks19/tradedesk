/**
 * PPO-DSI-Z mum sayısı (bağımlılıksız — AlertWatcher ilk yükleme paketine hafif girer).
 *
 * Isınma: yavaş EMA (slow) + sinyal SMA (smooth) + z-skor penceresi (zlen) ve bantlar için
 * ikinci zlen (medyan → medyan stdev) + sıkışma penceresi (squeezeLen) + 100 pay.
 * Liste taraması ve alarm aynı formülü kullanır. En az 300, en çok 1000.
 */
export function ppoDsiZFetchLimit(slow = 26, zlen = 50, smooth = 9, squeezeLen = 50): number {
  const s = Math.max(1, Math.floor(Number(slow) || 26));
  const z = Math.max(2, Math.floor(Number(zlen) || 50));
  const m = Math.max(1, Math.floor(Number(smooth) || 9));
  const q = Math.max(1, Math.floor(Number(squeezeLen) || 50));
  return Math.min(1000, Math.max(300, s + 2 * z + m + q + 100));
}

/** En az mum: yavaş EMA + zlen + smooth + 5 (z-skor kesişimleri için). En çok 1000. */
export function ppoDsiZMinBars(slow = 26, zlen = 50, smooth = 9): number {
  const s = Math.max(1, Math.floor(Number(slow) || 26));
  const z = Math.max(2, Math.floor(Number(zlen) || 50));
  const m = Math.max(1, Math.floor(Number(smooth) || 9));
  return Math.min(1000, s + z + m + 5);
}
