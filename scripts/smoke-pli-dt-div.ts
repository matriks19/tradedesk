/**
 * Unit smoke: PLI-DT Uyumsuzluk (indicator pliDtDiv / Liste kind pliDtDiv).
 *  - independent bar-by-bar transcription of "PLI Trend Dip/Tepe" (own percentile, na semantics,
 *    scalar `var` state exactly like the Pine) + independent pivot/divergence reference
 *  - every chip fires on synthetic series; scan window (Max mum) + alarm (≤1 mum) parity
 *  - rangeLower 5 (no 50-bar pivot-distance bug), causality, chart plots/toggles/settings
 * Run: npx --yes tsx scripts/smoke-pli-dt-div.ts
 */
import { readFileSync } from "node:fs";
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { computePliDtDiv, ALL_PLI_DT_DIV_CONDS, DEFAULT_PLI_DT_DIV_CONDS, PLI_DT_DIV_DEFAULTS, type PliDtDivCond, type PliDtDivOpts } from "../src/lib/indicators/pliDtDiv";
import { pliDtDivFetchLimit, pliDtDivMinBars } from "../src/lib/indicators/pliDtDivLimits";
import { scanSymbol, alertScanHits, indicatorParamsFromConfig, KIND_TO_INDICATOR, type ListScanConfig } from "../src/lib/scanner/listScan";
import { checkScanAlert } from "../src/lib/alerts/scanAlert";
import { computeBuiltin, BUILTIN_META } from "../src/lib/indicators/registry";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));

// ── synthetic data ─────────────────────────────────────────────────────────
function gen(seed: number, n: number): Candle[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: Candle[] = [];
  let p = 100, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 25 === 0) drift = (rnd() - 0.5) * 0.02;
    const o = p;
    p = Math.max(1, p * (1 + drift + (rnd() - 0.5) * 0.03));
    const h = Math.max(o, p) * (1 + rnd() * 0.01);
    const l = Math.min(o, p) * (1 - rnd() * 0.01);
    out.push({ time: 1_700_000_000 + i * 3600, open: o, high: h, low: l, close: p, volume: 1000 });
  }
  return out;
}

// ── independent reference ──────────────────────────────────────────────────
type O = Required<PliDtDivOpts>;
function ref(cs: Candle[], o: O) {
  const n = cs.length;
  const src = cs.map((c) => c.close);
  const pctl = (i: number, p: number) => {
    if (i < o.length - 1) return NaN; // na
    const w = src.slice(i - o.length + 1, i + 1).sort((a, b) => a - b);
    const r = (p / 100) * (o.length - 1), j = Math.floor(r);
    return j + 1 < o.length ? w[j]! + (r - j) * (w[j + 1]! - w[j]!) : w[j]!;
  };
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const upper = pctl(i, 100 - o.x), lower = pctl(i, o.x);
    const rng = upper - lower; // NaN if na
    pos.push(rng > 0 ? (src[i]! - lower) / rng : 0.5); // na > 0 is false → 0.5
  }
  // Pine state machine (var)
  let trend = 0, hiP = NaN, hiB = NaN, loP = NaN, loB = NaN;
  const trendA: number[] = [];
  const T: { bar: number; price: number; at: number }[] = [];
  const D: { bar: number; price: number; at: number }[] = [];
  const sig: Record<PliDtDivCond, Set<number>> = Object.fromEntries(ALL_PLI_DT_DIV_CONDS.map((c) => [c, new Set<number>()])) as never;
  for (let bar = 0; bar < n; bar++) {
    const high = cs[bar]!.high, low = cs[bar]!.low;
    if (trend !== -1 && (Number.isNaN(hiP) || high > hiP)) { hiP = high; hiB = bar; }
    if (trend !== 1 && (Number.isNaN(loP) || low < loP)) { loP = low; loB = bar; }
    if (trend !== -1 && pos[bar]! <= o.topTh && !Number.isNaN(hiP) && (hiP / low - 1) * 100 >= o.minSwing) {
      const prev = T[T.length - 1];
      if (prev && hiP > prev.price && pos[hiB]! < pos[prev.bar]!) sig.pdt_t_div.add(bar);
      T.push({ bar: hiB, price: hiP, at: bar });
      trend = -1; loP = low; loB = bar; hiP = NaN;
    } else if (trend !== 1 && pos[bar]! >= o.botTh && !Number.isNaN(loP) && (high / loP - 1) * 100 >= o.minSwing) {
      const prev = D[D.length - 1];
      if (prev && loP < prev.price && pos[loB]! > pos[prev.bar]!) sig.pdt_d_div.add(bar);
      D.push({ bar: loB, price: loP, at: bar });
      trend = 1; hiP = high; hiB = bar; loP = NaN;
    }
    trendA.push(trend);
  }
  // pivots on pos (strict both sides), confirm at pivot + lbR
  const isLow = (i: number) => { for (let j = i - o.lbL; j <= i + o.lbR; j++) if (j !== i && (j < 0 || j >= n || pos[j]! <= pos[i]!)) return false; return true; };
  const isHigh = (i: number) => { for (let j = i - o.lbL; j <= i + o.lbR; j++) if (j !== i && (j < 0 || j >= n || pos[j]! >= pos[i]!)) return false; return true; };
  let pl: number | null = null, ph: number | null = null;
  for (let i = 0; i < n; i++) {
    const pi = i - o.lbR;
    if (pi < o.lbL) continue;
    if (isLow(pi)) {
      if (pl != null && pi - pl >= o.rangeLower && pi - pl <= o.rangeUpper) {
        if (pos[pi]! > pos[pl]! && cs[pi]!.low < cs[pl]!.low) sig.pdt_bull.add(i);
        if (pos[pi]! < pos[pl]! && cs[pi]!.low > cs[pl]!.low) sig.pdt_hbull.add(i);
      }
      pl = pi;
    }
    if (isHigh(pi)) {
      if (ph != null && pi - ph >= o.rangeLower && pi - ph <= o.rangeUpper) {
        if (pos[pi]! < pos[ph]! && cs[pi]!.high > cs[ph]!.high) sig.pdt_bear.add(i);
        if (pos[pi]! > pos[ph]! && cs[pi]!.high < cs[ph]!.high) sig.pdt_hbear.add(i);
      }
      ph = pi;
    }
  }
  return { pos, trend: trendA, T, D, sig };
}

const DEF: O = { ...PLI_DT_DIV_DEFAULTS };
assert(DEF.rangeLower === 5 && DEF.lbL === 5 && DEF.lbR === 3 && DEF.rangeUpper === 60, "divergence defaults 5/3/5–60");
assert(DEF.length === 50 && DEF.x === 5 && DEF.topTh === 0.3 && DEF.botTh === 0.7 && DEF.minSwing === 3, "PLI-DT defaults");
assert(JSON.stringify(DEFAULT_PLI_DT_DIV_CONDS) === JSON.stringify(["pdt_bull", "pdt_bear"]), "default chips");

// ── 1) reference parity over seeds × param sets ─────────────────────────────
const PARAMS: O[] = [
  DEF,
  { ...DEF, length: 20, x: 10, topTh: 0.25, botTh: 0.75, minSwing: 2, lbL: 3, lbR: 2, rangeLower: 3, rangeUpper: 40 },
  { ...DEF, length: 100, x: 2.5, minSwing: 5, lbL: 8, lbR: 4, rangeLower: 10, rangeUpper: 120 },
];
const fired: Record<PliDtDivCond, { seed: number; p: number; bar: number }[]> = Object.fromEntries(ALL_PLI_DT_DIV_CONDS.map((c) => [c, []])) as never;
let shortDist = 0;
for (let pi = 0; pi < PARAMS.length; pi++) {
  const o = PARAMS[pi]!;
  for (let seed = 1; seed <= 40; seed++) {
    const cs = gen(seed * 7919 + pi, 600);
    const r = computePliDtDiv(cs, o);
    const e = ref(cs, o);
    for (let i = 0; i < cs.length; i++) {
      assert(close(r.pos[i]!, e.pos[i]!), `pos seed ${seed} p${pi} bar ${i}: ${r.pos[i]} vs ${e.pos[i]}`);
      assert(r.trend[i] === e.trend[i], `trend seed ${seed} p${pi} bar ${i}`);
    }
    const tops = r.pivots.filter((x) => x.top), bots = r.pivots.filter((x) => !x.top);
    assert(tops.length === e.T.length && bots.length === e.D.length, `pivot count seed ${seed} p${pi}`);
    tops.forEach((t, k) => assert(t.bar === e.T[k]!.bar && t.at === e.T[k]!.at && t.price === e.T[k]!.price, `T ${k} seed ${seed}`));
    bots.forEach((d, k) => assert(d.bar === e.D[k]!.bar && d.at === e.D[k]!.at && d.price === e.D[k]!.price, `D ${k} seed ${seed}`));
    // alternating T/D
    for (let k = 1; k < r.pivots.length; k++) assert(r.pivots[k]!.top !== r.pivots[k - 1]!.top, "T/D alternate");
    for (const c of ALL_PLI_DT_DIV_CONDS) {
      const got = new Set<number>();
      r.sig[c].forEach((v, i) => v && got.add(i));
      assert(got.size === e.sig[c].size && [...got].every((i) => e.sig[c].has(i)), `sig ${c} seed ${seed} p${pi}: ${[...got]} vs ${[...e.sig[c]]}`);
      for (const i of got) fired[c].push({ seed: seed * 7919 + pi, p: pi, bar: i });
    }
    for (const lk of r.links) if (lk.cond.startsWith("pdt_") && !lk.cond.endsWith("_div") && lk.to - lk.from < 50) shortDist++;
  }
}
for (const c of ALL_PLI_DT_DIV_CONDS) assert(fired[c].length > 0, `chip ${c} never fired`);
assert(shortDist > 0, "divergences with pivot distance < 50 must exist (rangeLower 5)");
console.log("reference parity OK;", ALL_PLI_DT_DIV_CONDS.map((c) => `${c}=${fired[c].length}`).join(" "), `· <50-bar links ${shortDist}`);

// ── 2) causality: prefix compute == full compute ────────────────────────────
{
  const cs = gen(4242, 600);
  const full = computePliDtDiv(cs, DEF);
  for (const cut of [150, 333, 480]) {
    const pre = computePliDtDiv(cs.slice(0, cut), DEF);
    for (const c of ALL_PLI_DT_DIV_CONDS) for (let i = 0; i < cut; i++) assert(pre.sig[c][i] === full.sig[c][i], `causal ${c} ${i}`);
    for (let i = 0; i < cut; i++) assert(pre.trend[i] === full.trend[i], "causal trend");
  }
  console.log("causality OK");
}

// ── 3) list scan window + alarm parity per chip ─────────────────────────────
const cfgFor = (conds: PliDtDivCond[], o: O): ListScanConfig =>
  ({ matchMode: "any", pliDtDiv: { enabled: true, conds, ...o } }) as ListScanConfig;
(async () => {
  for (const c of ALL_PLI_DT_DIV_CONDS) {
    let tested = 0;
    for (const f of fired[c]) {
      const o = PARAMS[f.p]!;
      const cs = gen(f.seed, 600);
      if (f.bar < pliDtDivMinBars(o.length, o.lbL, o.lbR) + 2 || f.bar + 4 > cs.length) continue;
      const r = computePliDtDiv(cs, o);
      for (let k = 0; k <= 3; k++) {
        const cut = cs.slice(0, f.bar + 1 + k);
        // nearest same-cond signal at or after f.bar within cut
        let firstAgo = -1;
        for (let ago = 0; ago <= k; ago++) if (r.sig[c][cut.length - 1 - ago]) { firstAgo = ago; break; }
        const hits = scanSymbol(cut, cfgFor([c], o), k).filter((h) => h.kind === "pliDtDiv" && h.cond === c);
        assert(hits.length === 1 && hits[0]!.barsAgo === firstAgo, `scan ${c} k=${k} ago=${firstAgo} got ${JSON.stringify(hits)}`);
        assert(hits[0]!.bias === (["pdt_bear", "pdt_hbear", "pdt_t_div"].includes(c) ? "bear" : "bull"), `bias ${c}`);
        // outside window → no hit (Max mum = k−1)
        if (k >= 1 && firstAgo === k) assert(scanSymbol(cut, cfgFor([c], o), k - 1).filter((h) => h.cond === c).length === 0, `window ${c}`);
        // alarm parity: payload is the same object the panel builds; alarm = scan with barsAgo ≤ 1
        const al = alertScanHits(cut, cfgFor([c], o), 1).filter((h) => h.cond === c);
        const sc = scanSymbol(cut, cfgFor([c], o), 1).filter((h) => h.cond === c);
        assert(al.length === sc.length, `alarm/scan parity ${c} k=${k}`);
        const ca = await checkScanAlert(cut, "list_scan", cfgFor([c], o) as unknown as Record<string, unknown>);
        assert(ca.ok === sc.length > 0, `checkScanAlert parity ${c} k=${k}`);
      }
      if (++tested >= 3) break;
    }
    assert(tested > 0, `no testable scan case for ${c}`);
  }
  // other chips must not leak
  {
    const f = fired.pdt_bull[0]!;
    const cs = gen(f.seed, 600).slice(0, f.bar + 1);
    const o = PARAMS[f.p]!;
    const r = computePliDtDiv(cs, o);
    const hits = scanSymbol(cs, cfgFor(["pdt_bear"], o), 0);
    assert(hits.length === (r.sig.pdt_bear[cs.length - 1] ? 1 : 0), "cond isolation");
  }
  // too few candles → no hits
  assert(scanSymbol(gen(1, pliDtDivMinBars() - 1), cfgFor([...ALL_PLI_DT_DIV_CONDS], DEF), 500).length === 0, "min bars");
  console.log("scan window + alarm parity OK");

  // ── 4) candle-count formula parity (panel + AlertWatcher use the same helper) ─
  assert(pliDtDivFetchLimit() === 318 && pliDtDivFetchLimit(500, 50, 50, 500) === 1000 && pliDtDivFetchLimit(10, 2, 2, 10) === 300, "fetch limit formula");
  const aw = readFileSync("src/components/alerts/AlertWatcher.tsx", "utf8");
  const lp = readFileSync("src/components/scanner/ListScanPanel.tsx", "utf8");
  assert(/pliDtDivFetchLimit\(payload\.pliDtDiv\.length, payload\.pliDtDiv\.lbL, payload\.pliDtDiv\.lbR, payload\.pliDtDiv\.rangeUpper\)/.test(aw), "AlertWatcher limit");
  assert(/pliDtDivFetchLimit\(cfg\.pliDtDiv\?\.length, cfg\.pliDtDiv\?\.lbL, cfg\.pliDtDiv\?\.lbR, cfg\.pliDtDiv\?\.rangeUpper\)/.test(lp), "panel limit");
  assert(lp.includes('group: "PLI-DT Uyumsuz"'), "alarm group");
  assert(!/from "@\/lib\/indicators\/pliDtDiv"/.test(aw), "AlertWatcher imports only the light limits helper");
  console.log("candle-count parity OK");

  // ── 5) chart indicator ─────────────────────────────────────────────────────
  assert(KIND_TO_INDICATOR.pliDtDiv === "pliDtDiv", "kind→indicator");
  const meta = BUILTIN_META.pliDtDiv;
  assert(!!meta, "meta");
  const keys = meta.inputs.map((i) => i.key);
  for (const k of ["length", "x", "topTh", "botTh", "minSwing", "lbL", "lbR", "rangeLower", "rangeUpper", "showMarkers", "showDivLines", "sigTD", "sigBull", "sigBear", "sigHBull", "sigHBear", "sigDDiv", "sigTDiv", "lineUpper", "lineLower", "lineZigzag", "linePos", "lineTh", "lineMid"])
    assert(keys.includes(k), `meta input ${k}`);
  const grp = (k: string) => (meta.inputs.find((i) => i.key === k) as { group?: string }).group;
  assert(grp("sigBull") === "Sinyaller" && grp("lineZigzag") === "Çizgiler" && grp("showMarkers") === undefined, "setting groups");
  const params = indicatorParamsFromConfig("pliDtDiv", cfgFor(["pdt_bull", "pdt_d_div"], DEF));
  assert(params.sigBull === 1 && params.sigBear === 0 && params.sigDDiv === 1 && params.rangeLower === 5, "params from config");
  const cs = gen(fired.pdt_d_div[0]!.seed, 600);
  const o = PARAMS[fired.pdt_d_div[0]!.p]!;
  const run = (p: Record<string, number | string>) =>
    computeBuiltin({ id: "t-pdt", type: "pliDtDiv", name: "pdt", params: { ...o, ...p }, visible: true } as unknown as IndicatorInstance, cs);
  const all = run({ sigHBull: 1, sigHBear: 1, sigDDiv: 1, sigTDiv: 1 });
  const ids = all.map((x) => x.id.replace("t-pdt-", ""));
  for (const k of ["upper", "lower", "zigzag", "pos", "topTh", "botTh", "mid"]) assert(ids.includes(k), `plot ${k}`);
  assert(ids.includes("div_pdt_d_div_pos") && ids.includes("div_pdt_d_div_px"), "D-div lines on pos + price");
  const byId = (k: string) => all.find((x) => x.id === `t-pdt-${k}`)!;
  assert(byId("topTh").lineStyle === 2 && byId("mid").lineStyle === 1, "dashed/dotted levels");
  assert(byId("pos").pane === "sub" && byId("upper").pane === "main", "panes");
  const cols = new Set(byId("pos").data.map((d) => ("color" in d ? d.color : "")));
  assert(cols.has("#26a69a") && cols.has("#ef5350"), "pos trend colors");
  const hid = all.filter((x) => x.id.includes("hbull") || x.id.includes("hbear"));
  assert(hid.every((x) => x.lineStyle === 2), "hidden divergences dashed");
  for (const pl of all) if (pl.markers) for (let i = 1; i < pl.markers.length; i++) assert(pl.markers[i]!.time >= pl.markers[i - 1]!.time, `markers sorted ${pl.id}`);
  const tdText = new Set([...(byId("upper").markers ?? []), ...(byId("lower").markers ?? [])].map((m) => m.text));
  assert(tdText.has("T") && tdText.has("D"), "T/D labels");
  assert((byId("pos").markers ?? []).some((m) => m.text === "D uy"), "D uy marker");
  const off = run({ lineUpper: 0, lineZigzag: 0, showDivLines: 0, sigDDiv: 0 });
  assert(!off.some((x) => x.id === "t-pdt-zigzag") && !off.some((x) => x.id.startsWith("t-pdt-div_")), "toggles hide");
  const tdHost = off.flatMap((x) => x.markers ?? []).filter((m) => m.text === "T");
  assert(tdHost.length > 0, "T markers survive hidden upper line");
  assert(!off.flatMap((x) => x.markers ?? []).some((m) => m.text === "D uy"), "sig toggle hides marker");
  const none = run({ showMarkers: 0 });
  assert(none.every((x) => !x.markers?.length), "master marker switch");
  console.log("chart OK");
  console.log("smoke-pli-dt-div: ALL OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
