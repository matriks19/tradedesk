/**
 * Unit smoke: PPO-DSI-Z (indicator ppoDsiZ / Liste kind ppoDsiZ).
 *  - independent bar-by-bar Pine transcription with na semantics (NaN): ta.ema (SMA seed),
 *    change(), for-loop sums (na history → na), ta.sma/ta.stdev (population, Pine reference
 *    1e-10 tolerance), zscore `stdev != 0 ? … : 0`, ta.percentile_nearest_rank, `var state`
 *  - every chip fires on synthetic data; scan window + alarm (≤1 bar) + checkScanAlert parity
 *  - causality, candle-count formula parity, chart plots/toggles/settings/candle coloring
 * Run: npx --yes tsx scripts/smoke-ppo-dsi-z.ts
 */
import { readFileSync } from "node:fs";
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { computePpoDsiZ, ALL_PPO_DSI_Z_CONDS, DEFAULT_PPO_DSI_Z_CONDS, PPO_DSI_Z_DEFAULTS, type PpoDsiZCond, type PpoDsiZOpts } from "../src/lib/indicators/ppoDsiZ";
import { ppoDsiZFetchLimit, ppoDsiZMinBars } from "../src/lib/indicators/ppoDsiZLimits";
import { scanSymbol, alertScanHits, indicatorParamsFromConfig, KIND_TO_INDICATOR, type ListScanConfig } from "../src/lib/scanner/listScan";
import { checkScanAlert } from "../src/lib/alerts/scanAlert";
import { computeBuiltin, BUILTIN_META } from "../src/lib/indicators/registry";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}
const close = (a: number, b: number) =>
  (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));

// ── synthetic data with volatility regimes (squeezes + expansions) ─────────
function gen(seed: number, n: number): Candle[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: Candle[] = [];
  let p = 100, drift = 0, vol = 0.02;
  for (let i = 0; i < n; i++) {
    if (i % 30 === 0) { drift = (rnd() - 0.5) * 0.02; vol = rnd() < 0.3 ? 0.003 : 0.01 + rnd() * 0.03; }
    const o = p;
    p = Math.max(1, p * (1 + drift * (vol > 0.005 ? 1 : 0.1) + (rnd() - 0.5) * vol));
    const h = Math.max(o, p) * (1 + rnd() * vol * 0.4);
    const l = Math.min(o, p) * (1 - rnd() * vol * 0.4);
    out.push({ time: 1_700_000_000 + i * 3600, open: o, high: h, low: l, close: p, volume: 1000 });
  }
  return out;
}

// ── independent Pine reference ──────────────────────────────────────────────
type O = Required<PpoDsiZOpts>;
function ref(cs: Candle[], o: O) {
  const n = cs.length;
  const close_ = cs.map((c) => c.close), high = cs.map((c) => c.high), low = cs.map((c) => c.low);
  const hist = (a: number[], i: number, k: number) => (i - k >= 0 ? a[i - k]! : NaN); // a[k] at bar i
  const smaAt = (a: number[], i: number, l: number) => {
    let s = 0;
    for (let k = 0; k < l; k++) s += hist(a, i, k); // NaN propagates
    return s / l;
  };
  const isZero = (v: number) => Math.abs(v) <= 1e-10;
  const stdevAt = (a: number[], i: number, l: number) => {
    const avg = smaAt(a, i, l);
    let ss = 0;
    for (let k = 0; k < l; k++) {
      let d = hist(a, i, k) + -avg;
      if (isZero(d)) d = 0;
      ss += d * d;
    }
    return Math.sqrt(ss / l);
  };
  const neq0 = (v: number) => !Number.isNaN(v) && v !== 0; // `x != 0` with na → false
  const ema = (l: number) => {
    const out: number[] = [];
    const a = 2 / (l + 1);
    for (let i = 0; i < n; i++) {
      const prev = i > 0 ? out[i - 1]! : NaN;
      out.push(Number.isNaN(prev) ? smaAt(close_, i, l) : a * close_[i]! + (1 - a) * prev);
    }
    return out;
  };
  const ef = ema(o.fast), es = ema(o.slow);
  const ppo = es.map((s, i) => (neq0(s) ? ((ef[i]! - s) / s) * 100 : 0));
  const upMove: number[] = [], dnMove: number[] = [];
  for (let i = 0; i < n; i++) {
    const ch = i > 0 ? high[i]! - high[i - 1]! : NaN, cl = i > 0 ? low[i]! - low[i - 1]! : NaN;
    upMove.push(ch > 0 ? ch : 0); // NaN > 0 false → 0
    dnMove.push(cl < 0 ? Math.abs(cl) : 0);
  }
  const dsi: number[] = [];
  for (let i = 0; i < n; i++) {
    let u = 0, d = 0;
    for (let k = 0; k < o.dsiLen; k++) { u += hist(upMove, i, k); d += hist(dnMove, i, k); }
    dsi.push(neq0(u + d) ? ((u - d) / (u + d)) * 100 : 0);
  }
  const combined = ppo.map((p, i) => (p + dsi[i]!) / 2);
  const signal = combined.map((_, i) => smaAt(combined, i, o.smooth));
  const histo = combined.map((c, i) => c - signal[i]!);
  const z = (a: number[]) => a.map((v, i) => { const sd = stdevAt(a, i, o.zlen); return neq0(sd) ? (v - smaAt(a, i, o.zlen)) / sd : 0; });
  const cz = z(combined), sz = z(signal), hz = z(histo);
  const median = close_.map((_, i) => {
    if (i < o.zlen - 1) return NaN;
    const w = close_.slice(i - o.zlen + 1, i + 1).sort((a, b) => a - b);
    return w[Math.ceil(0.5 * o.zlen) - 1]!;
  });
  const mstd = median.map((_, i) => stdevAt(median, i, o.zlen));
  const upper = median.map((m, i) => m + mstd[i]!), lower = median.map((m, i) => m - mstd[i]!);
  const state: number[] = [];
  let st = 0;
  for (let i = 0; i < n; i++) {
    if (cz[i]! > o.thLong && !(cz[i]! < o.thShort)) st = 1;
    else if (cz[i]! < o.thShort) st = -1;
    state.push(st);
  }
  // signals: ta.crossover/crossunder, both bars warmed up (series not na / not warm-up 0)
  const width = median.map((m, i) => (upper[i]! - lower[i]!) / m);
  const sq = width.map((w, i) => {
    let mn = Infinity;
    for (let k = 0; k < o.squeezeLen; k++) mn = Math.min(mn, hist(width, i, k));
    return !Number.isNaN(w) && !Number.isNaN(mn) && w <= mn * (1 + o.sqTol / 100);
  });
  const okZ = (i: number) => !Number.isNaN(stdevAt(combined, i, o.zlen));
  const okS = (i: number) => !Number.isNaN(stdevAt(histo, i, o.zlen)) && !Number.isNaN(stdevAt(signal, i, o.zlen));
  const okB = (i: number) => !Number.isNaN(lower[i]!);
  const okQ = (i: number) => { for (let k = 0; k < o.squeezeLen; k++) if (Number.isNaN(hist(width, i, k))) return false; return true; };
  const co = (a0: number, a1: number, b0: number, b1: number) => a1 > b1 && a0 <= b0;
  const cu = (a0: number, a1: number, b0: number, b1: number) => a1 < b1 && a0 >= b0;
  const sig: Record<PpoDsiZCond, Set<number>> = Object.fromEntries(ALL_PPO_DSI_Z_CONDS.map((c) => [c, new Set<number>()])) as never;
  for (let i = 1; i < n; i++) {
    if (okZ(i) && okZ(i - 1)) {
      if (co(cz[i - 1]!, cz[i]!, o.thLong, o.thLong)) sig.pdz_long_up.add(i);
      if (cu(cz[i - 1]!, cz[i]!, o.thLong, o.thLong)) sig.pdz_long_dn.add(i);
      if (co(cz[i - 1]!, cz[i]!, o.thShort, o.thShort)) sig.pdz_short_up.add(i);
      if (cu(cz[i - 1]!, cz[i]!, o.thShort, o.thShort)) sig.pdz_short_dn.add(i);
    }
    if (okS(i) && okS(i - 1)) {
      if (co(cz[i - 1]!, cz[i]!, sz[i - 1]!, sz[i]!)) sig.pdz_sig_up.add(i);
      if (cu(cz[i - 1]!, cz[i]!, sz[i - 1]!, sz[i]!)) sig.pdz_sig_dn.add(i);
      if (hz[i]! > 0 && hz[i - 1]! <= 0) sig.pdz_hist_pos.add(i);
      if (hz[i]! < 0 && hz[i - 1]! >= 0) sig.pdz_hist_neg.add(i);
    }
    if (okB(i) && okB(i - 1)) {
      if (co(close_[i - 1]!, close_[i]!, lower[i - 1]!, lower[i]!)) sig.pdz_lo_up.add(i);
      if (cu(close_[i - 1]!, close_[i]!, lower[i - 1]!, lower[i]!)) sig.pdz_lo_dn.add(i);
      if (co(close_[i - 1]!, close_[i]!, upper[i - 1]!, upper[i]!)) sig.pdz_hi_up.add(i);
      if (cu(close_[i - 1]!, close_[i]!, upper[i - 1]!, upper[i]!)) sig.pdz_hi_dn.add(i);
    }
    if (okQ(i) && okQ(i - 1) && sq[i] && !sq[i - 1]) sig.pdz_squeeze.add(i);
  }
  return { ppo, dsi, combined, signal, histo, cz, sz, hz, median, upper, lower, state, sig };
}

const DEF: O = { ...PPO_DSI_Z_DEFAULTS };
assert(DEF.fast === 12 && DEF.slow === 26 && DEF.dsiLen === 13 && DEF.smooth === 9 && DEF.thLong === 0.8 && DEF.thShort === -0.8 && DEF.zlen === 50, "Pine defaults");
assert(JSON.stringify(DEFAULT_PPO_DSI_Z_CONDS) === JSON.stringify(["pdz_long_up", "pdz_short_up", "pdz_sig_up", "pdz_lo_up"]), "default chips");

// ── 1) reference parity ────────────────────────────────────────────────────
const PARAMS: O[] = [
  DEF,
  { ...DEF, fast: 5, slow: 35, dsiLen: 7, smooth: 4, thLong: 1, thShort: -1.2, zlen: 30, squeezeLen: 40, sqTol: 10 },
  { ...DEF, zlen: 80, smooth: 14, squeezeLen: 20, sqTol: 0 },
];
const nz = (v: number | null) => (v == null ? NaN : v);
const fired: Record<PpoDsiZCond, { seed: number; p: number; bar: number }[]> = Object.fromEntries(ALL_PPO_DSI_Z_CONDS.map((c) => [c, []])) as never;
for (let pi = 0; pi < PARAMS.length; pi++) {
  const o = PARAMS[pi]!;
  for (let seed = 1; seed <= 12; seed++) {
    const sd = seed * 104729 + pi;
    const cs = gen(sd, 500);
    const r = computePpoDsiZ(cs, o);
    const e = ref(cs, o);
    for (let i = 0; i < cs.length; i++) {
      const tag = `seed ${sd} p${pi} bar ${i}`;
      assert(close(r.ppo[i]!, e.ppo[i]!) && close(r.dsi[i]!, e.dsi[i]!), `ppo/dsi ${tag}`);
      assert(close(r.combined[i]!, e.combined[i]!) && close(nz(r.signal[i]!), e.signal[i]!) && close(nz(r.hist[i]!), e.histo[i]!), `combined/signal/hist ${tag}`);
      assert(close(r.combinedZ[i]!, e.cz[i]!) && close(r.signalZ[i]!, e.sz[i]!) && close(r.histZ[i]!, e.hz[i]!), `z ${tag}: ${r.combinedZ[i]} ${e.cz[i]}`);
      assert(close(nz(r.median[i]!), e.median[i]!) && close(nz(r.upper[i]!), e.upper[i]!) && close(nz(r.lower[i]!), e.lower[i]!), `bands ${tag}`);
      assert(r.state[i] === e.state[i], `state ${tag}`);
    }
    for (const c of ALL_PPO_DSI_Z_CONDS) {
      const got: number[] = [];
      r.sig[c].forEach((v, i) => v && got.push(i));
      assert(got.length === e.sig[c].size && got.every((i) => e.sig[c].has(i)), `sig ${c} seed ${sd} p${pi}: ${got} vs ${[...e.sig[c]]}`);
      for (const i of got) fired[c].push({ seed: sd, p: pi, bar: i });
    }
  }
}
for (const c of ALL_PPO_DSI_Z_CONDS) assert(fired[c].length > 0, `chip ${c} never fired`);
console.log("reference parity OK;", ALL_PPO_DSI_Z_CONDS.map((c) => `${c}=${fired[c].length}`).join(" "));

// warm-up semantics spot checks (Pine na rules)
{
  const cs = gen(99, 200);
  const r = computePpoDsiZ(cs, DEF);
  assert(r.ppo.slice(0, 25).every((v) => v === 0) && r.ppo[25] !== 0, "ppo 0 while slow EMA na");
  assert(r.dsi.slice(0, 12).every((v) => v === 0), "dsi 0 while loop history na");
  assert(r.combinedZ.slice(0, 49).every((v) => v === 0) && r.combinedZ[49] !== 0, "z 0 while stdev na");
  assert(r.upper[97] == null && r.upper[98] != null, "bands from 2·zlen−2");
  // constant series → stdev 0 → z 0
  const flat = cs.map((c) => ({ ...c, open: 50, high: 50, low: 50, close: 50 }));
  assert(computePpoDsiZ(flat, DEF).combinedZ.every((v) => v === 0), "flat → z 0");
  console.log("warm-up semantics OK");
}

// ── 2) causality ───────────────────────────────────────────────────────────
{
  const cs = gen(7, 500);
  const full = computePpoDsiZ(cs, DEF);
  for (const cut of [160, 290, 431]) {
    const pre = computePpoDsiZ(cs.slice(0, cut), DEF);
    for (const c of ALL_PPO_DSI_Z_CONDS) for (let i = 0; i < cut; i++) assert(pre.sig[c][i] === full.sig[c][i], `causal ${c} ${i}`);
  }
  console.log("causality OK");
}

// ── 3) scan window + alarm parity ──────────────────────────────────────────
const cfgFor = (conds: PpoDsiZCond[], o: O): ListScanConfig => ({ matchMode: "any", ppoDsiZ: { enabled: true, conds, ...o } }) as ListScanConfig;
const BEAR = new Set(["pdz_long_dn", "pdz_short_dn", "pdz_sig_dn", "pdz_hist_neg", "pdz_lo_dn", "pdz_hi_dn"]);
(async () => {
  for (const c of ALL_PPO_DSI_Z_CONDS) {
    let tested = 0;
    for (const f of fired[c]) {
      const o = PARAMS[f.p]!;
      const cs = gen(f.seed, 500);
      if (f.bar < ppoDsiZMinBars(o.slow, o.zlen, o.smooth) + 2 || f.bar + 4 > cs.length) continue;
      const r = computePpoDsiZ(cs, o);
      for (let k = 0; k <= 3; k++) {
        const cut = cs.slice(0, f.bar + 1 + k);
        let firstAgo = -1;
        for (let ago = 0; ago <= k; ago++) if (r.sig[c][cut.length - 1 - ago]) { firstAgo = ago; break; }
        const hits = scanSymbol(cut, cfgFor([c], o), k).filter((h) => h.kind === "ppoDsiZ" && h.cond === c);
        assert(hits.length === 1 && hits[0]!.barsAgo === firstAgo, `scan ${c} k=${k}: ${JSON.stringify(hits)}`);
        assert(hits[0]!.bias === (c === "pdz_squeeze" ? "neutral" : BEAR.has(c) ? "bear" : "bull"), `bias ${c}`);
        if (k >= 1 && firstAgo === k) assert(scanSymbol(cut, cfgFor([c], o), k - 1).filter((h) => h.cond === c).length === 0, `window ${c}`);
        const al = alertScanHits(cut, cfgFor([c], o), 1).filter((h) => h.cond === c);
        const sc = scanSymbol(cut, cfgFor([c], o), 1).filter((h) => h.cond === c);
        assert(al.length === sc.length, `alarm/scan parity ${c} k=${k}`);
        const ca = await checkScanAlert(cut, "list_scan", cfgFor([c], o) as unknown as Record<string, unknown>);
        assert(ca.ok === sc.length > 0, `checkScanAlert parity ${c} k=${k}`);
      }
      if (++tested >= 3) break;
    }
    assert(tested > 0, `no testable case ${c}`);
  }
  assert(scanSymbol(gen(1, ppoDsiZMinBars() - 1), cfgFor([...ALL_PPO_DSI_Z_CONDS], DEF), 500).length === 0, "min bars");
  console.log("scan window + alarm parity OK");

  // ── 4) candle-count formula parity ───────────────────────────────────────
  assert(ppoDsiZFetchLimit() === 300 && ppoDsiZFetchLimit(26, 100, 9, 100) === 435 && ppoDsiZFetchLimit(200, 400, 50, 400) === 1000, "fetch formula");
  const aw = readFileSync("src/components/alerts/AlertWatcher.tsx", "utf8");
  const lp = readFileSync("src/components/scanner/ListScanPanel.tsx", "utf8");
  assert(aw.includes("ppoDsiZFetchLimit(payload.ppoDsiZ.slow, payload.ppoDsiZ.zlen, payload.ppoDsiZ.smooth, payload.ppoDsiZ.squeezeLen)"), "AlertWatcher limit");
  assert(lp.includes("ppoDsiZFetchLimit(cfg.ppoDsiZ?.slow, cfg.ppoDsiZ?.zlen, cfg.ppoDsiZ?.smooth, cfg.ppoDsiZ?.squeezeLen)"), "panel limit");
  assert(lp.includes('group: "PPO-DSI-Z"'), "alarm group");
  assert(!/from "@\/lib\/indicators\/ppoDsiZ"/.test(aw), "AlertWatcher imports only the light limits helper");
  console.log("candle-count parity OK");

  // ── 5) chart ─────────────────────────────────────────────────────────────
  assert(KIND_TO_INDICATOR.ppoDsiZ === "ppoDsiZ", "kind→indicator");
  const meta = BUILTIN_META.ppoDsiZ;
  const keys = meta.inputs.map((i) => i.key);
  for (const k of ["fast", "slow", "dsiLen", "smooth", "thLong", "thShort", "zlen", "squeezeLen", "sqTol", "showMarkers", "candleColor", "sigZ", "sigSig", "sigHist", "sigBand", "sigSqueeze", "lineCombZ", "lineSigZ", "lineHistZ", "lineTh", "lineZero", "lineMedian", "lineBands"])
    assert(keys.includes(k), `meta input ${k}`);
  const g = (k: string) => (meta.inputs.find((i) => i.key === k) as { group?: string; default: unknown });
  assert(g("sigZ").group === "Sinyaller" && g("lineBands").group === "Çizgiler" && g("candleColor").group === undefined && g("candleColor").default === 0, "setting groups / candle color default off");
  const params = indicatorParamsFromConfig("ppoDsiZ", cfgFor(["pdz_squeeze", "pdz_hist_pos"], DEF));
  assert(params.sigSqueeze === 1 && params.sigHist === 1 && params.sigZ === 0 && params.zlen === 50, "params from config");
  const cs = gen(fired.pdz_squeeze[0]!.seed, 500);
  const run = (p: Record<string, number>) =>
    computeBuiltin({ id: "t-z", type: "ppoDsiZ", name: "z", params: { ...DEF, ...p }, visible: true } as unknown as IndicatorInstance, cs);
  const def = run({});
  const ids = def.map((x) => x.id.replace("t-z-", ""));
  for (const k of ["median", "upper", "lower", "combinedZ", "signalZ", "histZ", "thLong", "thShort", "zero"]) assert(ids.includes(k), `plot ${k}`);
  assert(!def.some((x) => x.barColor), "candle coloring off by default");
  const byId = (a: typeof def, k: string) => a.find((x) => x.id === `t-z-${k}`)!;
  assert(byId(def, "thLong").lineStyle === 2 && byId(def, "zero").lineStyle === 1, "dashed thresholds, dotted zero");
  assert(byId(def, "histZ").type === "histogram" && byId(def, "combinedZ").pane === "sub" && byId(def, "median").pane === "main", "panes/types");
  const zc = new Set(byId(def, "combinedZ").data.map((d) => ("color" in d ? d.color : "")));
  assert(zc.has("#00bcd4") && zc.has("#ef5350") && zc.has("#9e9e9e"), "combined_z state colors");
  const cc = run({ candleColor: 1, sigSqueeze: 1, sigHist: 1 });
  const bar = cc.find((x) => x.barColor);
  assert(!!bar && bar.pane === "main" && bar.data.every((d) => "color" in d && !!d.color), "candle coloring plot");
  assert(!(bar!.markers?.length), "no markers on candle color carrier");
  for (const pl of cc) if (pl.markers) for (let i = 1; i < pl.markers.length; i++) assert(pl.markers[i]!.time >= pl.markers[i - 1]!.time, `sorted ${pl.id}`);
  const txt = new Set(cc.flatMap((x) => x.markers ?? []).map((m) => m.text));
  for (const t of ["K", "H+", "S↑", "A↑"]) assert(txt.has(t), `marker ${t}`);
  const off = run({ lineMedian: 0, lineHistZ: 0, sigSqueeze: 1 });
  assert(!off.some((x) => x.id === "t-z-median" || x.id === "t-z-histZ"), "line toggles");
  assert(off.flatMap((x) => (x.barColor ? [] : x.markers ?? [])).some((m) => m.text === "K"), "squeeze markers survive hidden median");
  assert(run({ showMarkers: 0 }).every((x) => !x.markers?.length), "master marker switch");
  console.log("chart OK");
  console.log("smoke-ppo-dsi-z: ALL OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
