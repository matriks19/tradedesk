/**
 * Smoke: PDO (Stoch hibrit) port'u — referans JS (kripto-tarayici
 * pro/screener.html PURE bloğu, scripts/fixtures/pdo-ref.cjs) ile aynı sentetik
 * mumlarda bar-bar eşitlik + her önekte (m) liste koşullarının referans
 * T10/T11/yapı/kesişim fonksiyonlarıyla birebir aynı olduğu.
 * Run: npx --yes tsx scripts/smoke-pdo.ts
 */
import { createRequire } from "module";
import type { Candle, IndicatorInstance } from "../src/lib/types";
import {
  pdoSeries,
  candlesToK,
  pdoScan,
  ALL_PDO_CONDS,
  PDO_MIN_BARS,
  type PdoCond,
} from "../src/lib/indicators/pdo";
import {
  scanSymbol,
  alertScanHits,
  indicatorParamsFromConfig,
  type ListScanConfig,
} from "../src/lib/scanner/listScan";
import { computeBuiltin } from "../src/lib/indicators/registry";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R: any = require("./fixtures/pdo-ref.cjs");

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
const same = (a: number, b: number) => (Number.isNaN(a) && Number.isNaN(b)) || a === b;

type K = { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] };
const toCandles = (k: K): Candle[] =>
  k.c.map((c, i) => ({
    time: Math.floor(k.t[i]! / 1000),
    open: k.o[i]!,
    high: k.h[i]!,
    low: k.l[i]!,
    close: c,
    volume: k.v[i]!,
  }));
const sliceK = (k: K, n: number): K => ({
  t: k.t.slice(0, n),
  o: k.o.slice(0, n),
  h: k.h.slice(0, n),
  l: k.l.slice(0, n),
  c: k.c.slice(0, n),
  v: k.v.slice(0, n),
});

/** Sert V dip/tepe + yatay testler içeren kendi sentetik serimiz (hacim değişken). */
function synth(n: number, seed0: number): K {
  let seed = seed0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  const k: K = { t: [], o: [], h: [], l: [], c: [], v: [] };
  let px = 100;
  for (let i = 0; i < n; i++) {
    const drift = 0.9 * Math.sin(i / 17) + 0.5 * Math.sin(i / 5.3);
    const o = px;
    px = Math.max(5, px + drift + rnd() * 1.6);
    const c = px;
    k.t.push(1_700_000_000_000 + i * 3_600_000);
    k.o.push(o);
    k.c.push(c);
    k.h.push(Math.max(o, c) + Math.abs(rnd()) * 0.9);
    k.l.push(Math.min(o, c) - Math.abs(rnd()) * 0.9);
    k.v.push(1000 + 800 * Math.abs(Math.sin(i / 9)) + 300 * rnd());
  }
  return k;
}

const PB = {
  moveEventPct: 3, moveHorizon: 8, movePre: 12, moveCooldown: 8, moveVolMin: 1.3, moveCompress: 0.85,
  moveVolOn: true, moveSqueezeOn: true, movePressureOn: true, moveTrendOn: true, moveMomentumOn: true,
  pdoStochK: 14, pdoStochSk: 3, pdoStochD: 3, pdoStochWeight: 70, oscSignal: 5,
};
const Z = { low: 30, high: 70, look: 5 };
const PAT = { bars: 20, pivot: 2, tol: 2, rise: 2, live: true, divMin: 2, touch: 0.5 };

function main() {
  const sets: [string, K][] = [
    ["demo-BTC", R.makeDemoKlines("BTC", 520, 36e5)],
    ["demo-ETH", R.makeDemoKlines("ETH", 520, 36e5)],
    ["demo-SOL", R.makeDemoKlines("SOL", 520, 9e5)],
    ["demo-PEPE", R.makeDemoKlines("1000PEPE", 520, 36e5)],
    ["synth-1", synth(520, 11)],
    ["synth-2", synth(520, 29)],
  ];
  const counts: Record<string, number> = {};
  for (const c of ALL_PDO_CONDS) counts[c] = 0;
  let prefixChecks = 0;

  for (const [name, k] of sets) {
    const candles = toCandles(k);
    const N = candles.length;
    const myK = candlesToK(candles);

    // 1) Seri eşitliği (yeni kd modu, eski ema modu, yumuşatma varyantları)
    const variants: [string, Record<string, unknown>, Record<string, unknown>][] = [
      ["kd", { ...PB, pdoSmooth: 2, pdoCrossMode: "kd" }, { smooth: 2, crossMode: "kd" }],
      ["kd-s1", { ...PB, pdoSmooth: 1, pdoCrossMode: "kd" }, { smooth: 1, crossMode: "kd" }],
      ["ema", { ...PB, pdoSmooth: 5, pdoCrossMode: "ema" }, { smooth: 5, crossMode: "ema", signal: 5 }],
      ["kd-w85", { ...PB, pdoSmooth: 3, pdoStochWeight: 85 }, { smooth: 3, stochWeight: 85 }],
    ];
    for (const [vn, rp, mp] of variants) {
      const ref = R.moveOscSeries(k, rp, N);
      const mine = pdoSeries(myK, mp);
      for (let i = 0; i < N; i++) {
        assert(same(ref.raw[i], mine.raw[i]!), `${name}/${vn} raw@${i} ref=${ref.raw[i]} mine=${mine.raw[i]}`);
        assert(same(ref.signal[i], mine.signal[i]!), `${name}/${vn} signal@${i}`);
        assert(same(ref.structure[i], mine.structure[i]!), `${name}/${vn} structure@${i}`);
        assert(same(ref.pump[i], mine.pump[i]!), `${name}/${vn} pump@${i} ref=${ref.pump[i]} mine=${mine.pump[i]}`);
        assert(same(ref.dump[i], mine.dump[i]!), `${name}/${vn} dump@${i}`);
      }
      assert(mine.raw.filter(Number.isFinite).length > N - 40, `${name}/${vn} finite coverage`);
    }

    // 2) Her önekte liste koşulları = referans fonksiyonları
    const refState = new Map<string, boolean>();
    for (let m = PDO_MIN_BARS; m < N; m++) {
      const kS = sliceK(k, m + 1);
      const ser = R.moveOscSeries(kS, { ...PB, pdoSmooth: 2, pdoCrossMode: "kd" }, m + 1);
      const a = ser.raw;
      const b = ser.signal;
      const pat = R.pdoPatternScan(kS, ser, PAT);
      const w = PAT.pivot;
      const has = (list: { to: number }[]) => list.some((e) => e.to === m - w);
      const t11 = (dir: string) =>
        !!R.latestDivergence(kS, a, { bars: 20, pivot: 2, recent: 4, dir, tol: 2, rise: 2, divMin: 2, live: true }).sig;
      const old = R.moveOscSeries(kS, { ...PB, pdoSmooth: 5, oscSignal: 5, pdoCrossMode: "ema" }, m + 1);
      const ref: Record<PdoCond, boolean> = {
        trend_up: !!R.pdoCrossSignal(ser.pump, ser.dump, "up", 0),
        trend_dn: !!R.pdoCrossSignal(ser.pump, ser.dump, "down", 0),
        old_up: !!R.pdoCrossSignal(old.raw, old.signal, "up", 0),
        old_dn: !!R.pdoCrossSignal(old.raw, old.signal, "down", 0),
        al: !!R.pdoCrossSignal(a, b, "up", 0, Z),
        sat: !!R.pdoCrossSignal(a, b, "down", 0, Z),
        x_up: !!R.pdoCrossSignal(a, b, "up", 0),
        x_dn: !!R.pdoCrossSignal(a, b, "down", 0),
        exit30: !!R.levelExitSignal(a, "up", 0, 30, 70),
        exit70: !!R.levelExitSignal(a, "down", 0, 30, 70),
        t10_al: !!R.pdoSeparatedBandSignal(kS, a, b, "up", 8, 20, 20, 2, 2, "either", Z),
        t10_sat: !!R.pdoSeparatedBandSignal(kS, a, b, "down", 8, 20, 20, 2, 2, "either", Z),
        ua: t11("up"),
        us: t11("down"),
        d2: has(pat.doubleBottom),
        d3: has(pat.tripleBottom),
        t2: has(pat.doubleTop),
        t3: has(pat.tripleTop),
        touch_dip: !!pat.touchBottom,
        touch_top: !!pat.touchTop,
        zone_low: Number.isFinite(a[m]) && a[m] <= 30,
        zone_high: Number.isFinite(a[m]) && a[m] >= 70,
      };
      const hits = pdoScan(candles.slice(0, m + 1), ALL_PDO_CONDS, 0);
      const got = new Map(hits.map((h) => [h.cond, h] as const));
      for (const c of ALL_PDO_CONDS) {
        const h = got.get(c);
        let expect: boolean;
        if (c === "t10_al" || c === "t10_sat" || c === "ua" || c === "us") {
          expect = ref[c];
          if (h && expect) {
            // barsAgo = durumun açık kaldığı önceki mum sayısı
            let run = 0;
            for (let q = m - 1; q >= PDO_MIN_BARS && refState.get(`${c}@${q}`); q--) run++;
            if (refState.has(`${c}@${m - 1}`))
              assert(h.barsAgo === Math.min(run, 40), `${name} ${c}@${m} barsAgo ${h.barsAgo} vs run ${run}`);
          }
        } else if (c === "touch_dip" || c === "touch_top") {
          expect = ref[c] && !refState.get(`${c}@${m - 1}`) && refState.has(`${c}@${m - 1}`);
          if (!refState.has(`${c}@${m - 1}`)) {
            refState.set(`${c}@${m}`, ref[c]);
            continue; // ilk önek: önceki durum bilinmiyor
          }
        } else {
          expect = ref[c];
        }
        refState.set(`${c}@${m}`, ref[c]);
        assert(!!h === expect, `${name} ${c}@${m}: mine=${!!h} ref=${expect} ${h?.note ?? ""}`);
        if (h && c !== "t10_al" && c !== "t10_sat" && c !== "ua" && c !== "us")
          assert(h.barsAgo === 0, `${name} ${c}@${m} barsAgo 0`);
        if (expect) counts[c]!++;
      }
      prefixChecks++;
    }

    // 3) maxBarsAgo penceresi: son 10 mumda olay → barsAgo doğru
    const full = pdoScan(candles, ALL_PDO_CONDS, 10);
    for (const h of full) {
      if (["t10_al", "t10_sat", "ua", "us", "zone_low", "zone_high", "touch_dip", "touch_top"].includes(h.cond)) continue;
      const m = N - 1 - h.barsAgo;
      assert(refState.get(`${h.cond}@${m}`) === true, `${name} window ${h.cond} barsAgo ${h.barsAgo}`);
    }
  }

  for (const c of ["trend_up", "trend_dn", "old_up", "old_dn", "al", "sat", "x_up", "x_dn", "t10_al", "ua", "us", "d2", "t2", "exit30", "exit70", "zone_low", "zone_high"])
    assert(counts[c]! > 0, `no ${c} events in synthetic sets (vacuous test)`);

  // 4) Liste/alarm/grafik entegrasyonu
  const cs = toCandles(sets[0]![1]);
  const cfg: ListScanConfig = { matchMode: "any", pdo: { enabled: true, conds: [...ALL_PDO_CONDS] } };
  const hs = scanSymbol(cs, cfg, 400);
  assert(hs.every((h) => h.kind === "pdo"), "kind pdo");
  assert(
    hs.filter((h) => ["sat", "us", "trend_dn", "old_dn"].includes(h.cond)).every((h) => h.bias === "bear"),
    "bias bear"
  );
  const al = alertScanHits(cs, cfg, 1);
  assert(!al.some((h) => h.cond === "zone_low" || h.cond === "zone_high"), "zone = state → no alarm");
  // alarm: son AL kesişiminde kes → alarmlanabilir
  const ser = pdoSeries(candlesToK(cs));
  let lastAl = -1;
  for (let i = 200; i < cs.length; i++) {
    const x = R.pdoCrossSignal(ser.raw.slice(0, i + 1), ser.signal.slice(0, i + 1), "up", 0, Z);
    if (x) lastAl = i;
  }
  assert(lastAl > 0, "an AL after 200");
  const cut = cs.slice(0, lastAl + 1);
  const cAl: ListScanConfig = { pdo: { enabled: true, conds: ["al"] } };
  assert(alertScanHits(cut, cAl, 1).some((h) => h.cond === "al"), "alert al");
  assert(scanSymbol(cs.slice(0, 60), cfg, 10).length === 0, "min bars");
  const def = scanSymbol(cs, { pdo: { enabled: true, conds: [] } }, 400);
  assert(def.every((h) => ["trend_up", "trend_dn", "al", "sat"].includes(h.cond)), "defaults");
  // trend alarmı: son P×D yukarı kesişim mumunda kes → alarm
  let lastTu = -1;
  for (let i = 200; i < cs.length; i++) if (ser.pump[i - 1]! <= ser.dump[i - 1]! && ser.pump[i]! > ser.dump[i]!) lastTu = i;
  assert(lastTu > 0, "a trend_up after 200");
  const cTu: ListScanConfig = { pdo: { enabled: true, conds: ["trend_up"] } };
  const tuHits = alertScanHits(cs.slice(0, lastTu + 1), cTu, 1);
  assert(tuHits.some((h) => h.cond === "trend_up" && h.note.includes("trend↑")), `alert trend_up ${JSON.stringify(tuHits)}`);

  const inst = { id: "p", type: "pdo", params: indicatorParamsFromConfig("pdo", cfg) } as unknown as IndicatorInstance;
  const plots = computeBuiltin(inst, cs);
  const keys = plots.map((p) => p.seriesKey);
  assert(["pdo", "signal", "lvlLow", "lvl50", "lvlHigh", "pump", "dump", "pumpBar", "dumpBar"].every((x) => keys.includes(x)), `plots ${keys}`);
  const pumpPlot = plots.find((p) => p.seriesKey === "pump")!;
  const dumpPlot = plots.find((p) => p.seriesKey === "dump")!;
  assert(pumpPlot.color === "#16a34a" && dumpPlot.color === "#dc2626", "P green / D red");
  assert(plots.find((p) => p.seriesKey === "pumpBar")!.base === 50, "bars from 50");
  const pdoPlot = plots.find((p) => p.seriesKey === "pdo")!;
  assert(pdoPlot.pane === "sub" && (pdoPlot.markers?.length ?? 0) > 0, "sub pane + markers");
  assert(pdoPlot.markers!.some((mk) => mk.text.startsWith("AL")) && pdoPlot.markers!.some((mk) => mk.text === "T10"), "AL + T10 markers");
  const tu = pdoPlot.markers!.filter((mk) => mk.text === "T↑").length;
  const td = pdoPlot.markers!.filter((mk) => mk.text === "T↓").length;
  let xu = 0, xd = 0;
  for (let i = 1; i < cs.length; i++) {
    if (R.pdoCrossSignal(ser.pump.slice(0, i + 1), ser.dump.slice(0, i + 1), "up", 0)) xu++;
    if (R.pdoCrossSignal(ser.pump.slice(0, i + 1), ser.dump.slice(0, i + 1), "down", 0)) xd++;
  }
  assert(tu === xu && td === xd && tu > 0, `trend markers ${tu}/${td} vs ${xu}/${xd}`);
  const colored = computeBuiltin(
    { id: "c", type: "pdo", params: { ...inst.params, trendColor: 1, showOld: 1 } } as unknown as IndicatorInstance,
    cs
  );
  const cp = colored.find((p) => p.seriesKey === "pdo")!;
  const cols = new Set((cp.data as { color?: string }[]).map((d) => d.color).filter(Boolean));
  assert(cols.has("#16a34a") && cols.has("#dc2626"), "trend-colored PDO line");
  assert(cp.markers!.some((mk) => mk.text === "E↑"), "old cross markers");
  const legacy = computeBuiltin(
    { id: "q", type: "pdo", params: { ...inst.params, crossMode: "ema", smooth: 5 } } as unknown as IndicatorInstance,
    cs
  );
  const refOld = R.moveOscSeries(sets[0]![1], { ...PB, pdoSmooth: 5, pdoCrossMode: "ema" }, cs.length);
  const lp = legacy.find((p) => p.seriesKey === "pdo")!.data as { value?: number }[];
  assert(same(lp[cs.length - 1]!.value ?? NaN, refOld.raw[cs.length - 1]), "legacy chart = ref ema mode");

  const t0 = Date.now();
  for (let r = 0; r < 50; r++) pdoScan(cs.slice(-240), ALL_PDO_CONDS, 2);
  const perSym = (Date.now() - t0) / 50;

  console.log("OK smoke-pdo", { sets: sets.length, prefixChecks, counts, perSymbolMs: perSym.toFixed(2), plots: keys.length });
}

main();
