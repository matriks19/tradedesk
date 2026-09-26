/**
 * Smoke: göstergelerin şema tabanlı sinyal/çizgi anahtarları.
 * - Her bool input şemada; varsayılanlarla hesap = param'sız hesap
 * - "Sinyaller" anahtarı kapalı → işaret sayısı azalır / artmaz; hepsi kapalı → 0
 * - "Tüm işaretler" (showMarkers) kapalı → 0 işaret
 * - "Çizgiler" anahtarı kapalı → o toggle'lı çizgi yok; işaretler korunur
 * Run: npx --yes tsx scripts/smoke-ind-toggles.ts
 */
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { computeBuiltin, BUILTIN_META } from "../src/lib/indicators/registry";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

function synth(n: number, seed0: number): Candle[] {
  let seed = seed0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  const out: Candle[] = [];
  let px = 100;
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 37) * 0.6 + Math.sin(i / 11) * 0.4;
    const o = px;
    px = Math.max(5, px * (1 + (drift + rnd() * 3) / 100));
    const h = Math.max(o, px) * (1 + Math.abs(rnd()) / 60);
    // her 23. mumda hacimli uzun alt fitil (LG / dip testleri için)
    const l = Math.min(o, px) * (1 - (i % 23 === 0 ? 0.06 : Math.abs(rnd()) / 60));
    out.push({ time: 1_700_000_000 + i * 3600, open: o, high: h, low: l, close: px, volume: 1000 + Math.abs(rnd()) * 4000 + (i % 29 === 0 || i % 23 === 0 ? 9000 : 0) });
  }
  return out;
}

const IDS = [
  "pdo", "hamJurikTpo", "hamAoJrmaZ", "aohamJrmaEngine", "goldKeko", "kijunBb", "multiDipBb",
  "maSimple", "bbDivLg", "orderBlocks", "doktorHull", "macd", "eliziEdge", "macdEliziHybrid",
  "descendingBreak", "descendingBreakV2", "diagonalSr",
] as const;

/** İşaret sayısı (+ MACD'nin kesişim histogram noktaları) */
const count = (pl: ReturnType<typeof computeBuiltin>) =>
  pl.reduce(
    (a, p) =>
      a +
      (p.markers?.length ?? 0) +
      (p.seriesKey === "crossUp" || p.seriesKey === "crossDn" ? p.data.filter((d) => "value" in d).length : 0),
    0
  );

function run(id: string, candles: Candle[], params: Record<string, number | string>) {
  const inst = { id: `t-${id}`, type: id, name: id, params, visible: true } as unknown as IndicatorInstance;
  return computeBuiltin(inst, candles);
}

function main() {
  const candles = synth(700, 7);
  const report: Record<string, { sig: number; line: number; markers: number }> = {};
  for (const id of IDS) {
    const meta = BUILTIN_META[id];
    assert(!!meta, `meta ${id}`);
    const defs: Record<string, number | string> = {};
    for (const i of meta.inputs) defs[i.key] = i.default;
    const sigs = meta.inputs.filter((i) => i.type === "bool" && i.group === "Sinyaller");
    const lines = meta.inputs.filter((i) => i.type === "bool" && i.group === "Çizgiler");
    // diagonalSr: işaretler varsayılan kapalı → test için aç
    const extra: Record<string, number> = id === "bbDivLg" ? { useTrend: 0, useADX: 0, rsiOS: 45 } : {};
    const base = { ...defs, showMarkers: 1, ...extra };
    const b0 = run(id, candles, base);
    const n0 = count(b0);
    const bare = run(id, candles, id === "diagonalSr" ? { showMarkers: 1 } : { ...extra });
    assert(count(bare) === n0 || id === "diagonalSr", `${id}: defaults == no params (${count(bare)} vs ${n0})`);
    // master
    if (meta.inputs.some((i) => i.key === "showMarkers")) {
      const off = run(id, candles, { ...base, showMarkers: 0 });
      assert(count(off) === 0, `${id}: master off → 0 markers (got ${count(off)})`);
    }
    // each signal off
    for (const s of sigs) {
      const all1 = { ...base, [s.key]: 1 };
      const nOn = count(run(id, candles, all1));
      const nOff = count(run(id, candles, { ...base, [s.key]: 0 }));
      assert(nOff <= nOn, `${id}/${s.key}: off ${nOff} > on ${nOn}`);
    }
    if (sigs.length) {
      const allOff: Record<string, number | string> = { ...base };
      for (const s of sigs) allOff[s.key] = 0;
      const nAllOff = count(run(id, candles, allOff));
      assert(nAllOff === 0, `${id}: all signal flags off → 0 markers (got ${nAllOff})`);
      const allOn: Record<string, number | string> = { ...base };
      for (const s of sigs) allOn[s.key] = 1;
      assert(count(run(id, candles, allOn)) > 0 || id === "diagonalSr", `${id}: no markers with all signals on (vacuous)`);
    }
    // each line off
    for (const l of lines) {
      const onPl = run(id, candles, { ...base, [l.key]: 1 });
      const offPl = run(id, candles, { ...base, [l.key]: 0 });
      assert(!offPl.some((p) => p.toggle === l.key), `${id}/${l.key}: plot still present`);
      assert(offPl.length <= onPl.length, `${id}/${l.key}: plots grew`);
      if (l.key !== "trendColor")
        assert(offPl.length < onPl.length || onPl.every((p) => p.toggle !== l.key), `${id}/${l.key}: nothing hidden`);
      if (l.key !== "showEma10") assert(count(offPl) === count(onPl), `${id}/${l.key}: markers lost when line hidden (${count(offPl)} vs ${count(onPl)})`);
    }
    report[id] = { sig: sigs.length, line: lines.length, markers: n0 };
  }
  // PDO spesifik: trend kapalı → T↑/T↓ yok, diğerleri kalır
  const pdoBase: Record<string, number | string> = {};
  const pdoP = run("pdo", candles, { ...pdoBase, showTrend: 0 });
  const mk = pdoP.flatMap((p) => p.markers ?? []);
  assert(!mk.some((m) => m.text === "T↑" || m.text === "T↓") && mk.some((m) => m.text.startsWith("AL")), "pdo trend off");
  // HAM: AL/SAT kapalı → AL/SAT yok, H×Y kalır
  const ham = run("hamJurikTpo", candles, { sigFlip: 0 }).flatMap((p) => p.markers ?? []);
  assert(!ham.some((m) => m.text === "AL" || m.text === "SAT") && ham.some((m) => m.text === "H×Y"), "ham flip off");
  // multiDipBb: S/R varsayılan açık
  const md = run("multiDipBb", candles, {});
  assert(md.some((p) => p.seriesKey === "support" || p.seriesKey?.startsWith("flatSup") || p.seriesKey?.startsWith("sup")), "multiDip S/R default on");
  // Kijun: çizgi kapalı → işaretler başka çizgiye taşınır
  const kj = run("kijunBb", candles, { lineKijun: 0 });
  assert(!kj.some((p) => p.seriesKey === "kijun") && count(kj) === count(run("kijunBb", candles, {})), "kijun marker transfer");
  // hafiflik: PDO sinyaller kapalı daha hızlı
  const t0 = performance.now();
  for (let r = 0; r < 5; r++) run("pdo", candles, {});
  const tOn = (performance.now() - t0) / 5;
  const t1 = performance.now();
  for (let r = 0; r < 5; r++) run("pdo", candles, { showMarkers: 0, showPatterns: 0 });
  const tOff = (performance.now() - t1) / 5;
  console.log("OK smoke-ind-toggles", report, { pdoMsOn: tOn.toFixed(1), pdoMsOff: tOff.toFixed(1) });
}
main();
