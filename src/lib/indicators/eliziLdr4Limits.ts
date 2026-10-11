/**
 * ELIZI-LDR4 mum sayısı (bağımlılıksız — AlertWatcher ilk yükleme paketine hafif girer).
 * eliziLdr4Core.eld4Need ile aynı formül; liste taraması ve alarm aynı pencereyi kullanır.
 * Çekim: max(500, ısınma + 120), en çok 1000.
 */
type P = Partial<Record<"L" | "pLen" | "zLen" | "pSlow" | "lenVel" | "lenEnt" | "slowLen" | "sigLen", unknown>>;
const D = { L: 20, pLen: 20, zLen: 40, pSlow: 40, lenVel: 14, lenEnt: 20, slowLen: 21, sigLen: 13 };
const iv = (v: unknown, d: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) && x > 0 ? x : d;
};
export function eliziLdr4NeedBars(p?: P | null): number {
  const q = p ?? {};
  const L = iv(q.L, D.L), pLen = iv(q.pLen, D.pLen), zLen = iv(q.zLen, D.zLen), pSlow = iv(q.pSlow, D.pSlow);
  const lenVel = iv(q.lenVel, D.lenVel), lenEnt = iv(q.lenEnt, D.lenEnt), slowLen = iv(q.slowLen, D.slowLen), sigLen = iv(q.sigLen, D.sigLen);
  return Math.max(L * 3 + 2, L * 4 + 2, pLen + zLen, pSlow, lenVel * 3, lenEnt + 1) + slowLen * 4 + sigLen * 2 + 60;
}
export function eliziLdr4FetchLimit(p?: P | null): number {
  return Math.min(1000, Math.max(500, eliziLdr4NeedBars(p) + 120));
}
