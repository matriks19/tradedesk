/**
 * Unit smoke: CMO (Chande Momentum Oscillator) — reference parity, list scan,
 * alarms, chart indicator toggles.
 * Run: npx --yes tsx scripts/smoke-cmo.ts
 */
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { computeCmo, cmoCondLabel } from "../src/lib/indicators/cmo";
import {
  scanSymbol,
  alertScanHits,
  indicatorParamsFromConfig,
  KIND_TO_INDICATOR,
  type ListScanConfig,
  type CmoCond,
} from "../src/lib/scanner/listScan";
import { computeBuiltin, BUILTIN_META } from "../src/lib/indicators/registry";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/**
 * Direct TradingView transcription (ta.cmo):
 *   mom = change(src); sm1 = math.sum(mom >= 0 ? mom : 0, len)
 *   sm2 = math.sum(mom >= 0 ? 0 : -mom, len); 100 * (sm1 - sm2) / (sm1 + sm2)
 * na while the window has an na mom (i < len). Zero denominator → 0 (our convention; TV = na).
 */
function refCmo(src: number[], len: number): (number | null)[] {
  const mom: (number | null)[] = src.map((v, i) => (i === 0 ? null : v - src[i - 1]!));
  return src.map((_, i) => {
    if (i < len) return null;
    let sm1 = 0;
    let sm2 = 0;
    for (let k = 0; k < len; k++) {
      const m = mom[i - k];
      if (m == null) return null;
      sm1 += m >= 0 ? m : 0;
      sm2 += m >= 0 ? 0 : -m;
    }
    const d = sm1 + sm2;
    return d === 0 ? 0 : (100 * (sm1 - sm2)) / d;
  });
}
function refCrosses(v: (number | null)[], level: number, dir: "up" | "down"): number[] {
  const out: number[] = [];
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1], b = v[i];
    if (a == null || b == null) continue;
    if (dir === "up" ? a <= level && b > level : a >= level && b < level) out.push(i);
  }
  return out;
}

function synth(n = 600, seed0 = 11): Candle[] {
  const out: Candle[] = [];
  let seed = seed0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  let px = 50;
  for (let i = 0; i < n; i++) {
    const drift = 0.6 * Math.sin(i / 17) + 0.3 * Math.sin(i / 5);
    const open = px;
    px = Math.max(1, px + drift + rnd() * 1.2);
    // a flat stretch → zero denominator handling
    if (i >= 300 && i < 315) px = open;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open,
      high: Math.max(open, px) + 0.3,
      low: Math.min(open, px) - 0.3,
      close: px,
      volume: 1000,
    });
  }
  return out;
}

function main() {
  // 1) Hand-computed values (len 3)
  const hand = computeCmo([10, 11, 12, 11, 11, 13, 12], 3);
  // i=3: moms +1,+1,-1 → (2-1)/3·100 = 33.33; i=4: +1,-1,0 → 0; i=5: -1,0,+2 → 33.33; i=6: 0,+2,-1 → 33.33
  const exp = [null, null, null, 100 / 3, 0, 100 / 3, 100 / 3];
  hand.forEach((v, i) => {
    const e = exp[i];
    assert(e == null ? v == null : v != null && Math.abs(v - e) < 1e-9, `hand[${i}] ${v} ≠ ${e}`);
  });
  assert(computeCmo([5, 5, 5, 5, 5], 3)[4] === 0, "flat window → 0 (zero denominator)");
  assert(computeCmo([1, 2, 3, 4, 5], 3)[4] === 100, "all up → 100");
  assert(computeCmo([5, 4, 3, 2, 1], 3)[4] === -100, "all down → −100");

  // 2) Reference parity over several series / lengths
  let compared = 0;
  for (const seed of [3, 11, 29, 101]) {
    const cs = synth(600, seed);
    const close = cs.map((c) => c.close);
    for (const len of [1, 2, 9, 14, 30]) {
      const a = computeCmo(close, len);
      const b = refCmo(close, len);
      for (let i = 0; i < close.length; i++) {
        const x = a[i], y = b[i];
        assert((x == null) === (y == null), `na mismatch seed ${seed} len ${len} i ${i}`);
        if (x != null && y != null) {
          assert(Math.abs(x - y) < 1e-9, `value mismatch seed ${seed} len ${len} i ${i}: ${x} vs ${y}`);
          assert(x >= -100 - 1e-9 && x <= 100 + 1e-9, "range");
          compared++;
        }
      }
      assert(a[len - 1] == null && a[len] != null, `first value at index len (${len})`);
    }
  }
  const flat = computeCmo(synth(600, 11).map((c) => c.close), 9);
  assert(flat[314] === 0, "flat stretch → 0");

  // 3) List scan: every reference cross is found as an edge on its bar
  const cs = synth(600, 11);
  const close = cs.map((c) => c.close);
  const v9 = refCmo(close, 9);
  const upIdx = refCrosses(v9, -50, "up");
  const dnIdx = refCrosses(v9, 75, "down");
  const z0u = refCrosses(v9, 0, "up");
  const z0d = refCrosses(v9, 0, "down");
  assert(upIdx.length >= 3 && dnIdx.length >= 3, `need crosses (up ${upIdx.length}, dn ${dnIdx.length})`);
  const cfgFor = (conds: CmoCond[], extra: Partial<NonNullable<ListScanConfig["cmo"]>> = {}): ListScanConfig => ({
    cmo: { enabled: true, conds, ...extra },
  });
  let edgeChecks = 0;
  for (const [cond, idxs] of [
    ["cmo_up_lo", upIdx],
    ["cmo_dn_hi", dnIdx],
    ["cmo_zero_up", z0u],
    ["cmo_zero_dn", z0d],
  ] as [CmoCond, number[]][]) {
    const set = new Set(idxs);
    for (let end = 40; end < cs.length; end++) {
      const cut = cs.slice(0, end + 1);
      const hits = scanSymbol(cut, cfgFor([cond]), 0);
      assert(hits.length === (set.has(end) ? 1 : 0), `${cond} edge at ${end}: got ${hits.length}`);
      if (hits.length) {
        const h = hits[0]!;
        assert(h.kind === "cmo" && h.barsAgo === 0, "hit shape");
        assert(h.bias === (cond === "cmo_dn_hi" || cond === "cmo_zero_dn" ? "bear" : "bull"), `bias ${cond}`);
        assert(h.note.startsWith(cmoCondLabel(cond)), `note ${h.note}`);
        const al = alertScanHits(cut, cfgFor([cond]), 1);
        assert(al.some((x) => x.cond === cond), `alarm ${cond}`);
        edgeChecks++;
      }
    }
  }
  // barsAgo window
  const lastUp = upIdx[upIdx.length - 1]!;
  const cutW = cs.slice(0, lastUp + 3);
  const w = scanSymbol(cutW, cfgFor(["cmo_up_lo"]), 2);
  assert(w.length === 1 && w[0]!.barsAgo === 2, "barsAgo = 2 within window");
  assert(scanSymbol(cutW, cfgFor(["cmo_up_lo"]), 1).length === 0 || upIdx.includes(lastUp + 1), "outside window");
  assert(alertScanHits(cutW, cfgFor(["cmo_up_lo"]), 2).length === 0, "alarm only ≤1 bar ago");
  // Defaults when conds empty → only up_lo / dn_hi
  const def = scanSymbol(cs, cfgFor([]), 600);
  assert(def.length >= 1 && def.every((h) => h.cond === "cmo_up_lo" || h.cond === "cmo_dn_hi"), "defaults");
  // Editable levels + length change results (reference with lower −30, upper 60, len 14)
  const v14 = refCmo(close, 14);
  const up30 = refCrosses(v14, -30, "up");
  const last30 = up30[up30.length - 1]!;
  const hEd = scanSymbol(cs.slice(0, last30 + 1), cfgFor(["cmo_up_lo"], { length: 14, lower: -30, upper: 60 }), 0);
  assert(hEd.length === 1 && hEd[0]!.note.includes("CMO −30↑") && hEd[0]!.note.includes("len 14"), "editable levels/length");
  // Too few bars
  assert(scanSymbol(cs.slice(0, 8), cfgFor(["cmo_up_lo", "cmo_dn_hi"]), 10).length === 0, "min bars");

  // 4) Chart indicator
  assert(KIND_TO_INDICATOR.cmo === "cmoChande", "kind → indicator");
  const meta = BUILTIN_META.cmoChande;
  assert(meta.pane === "sub", "sub pane");
  const inp = (k: string) => meta.inputs.find((i) => i.key === k);
  assert(inp("length")?.default === 9 && inp("lower")?.default === -50 && inp("upper")?.default === 75, "input defaults");
  assert(inp("sigUpLo")?.group === "Sinyaller" && inp("sigZero")?.default === 0, "signal toggles");
  assert(inp("lineLevels")?.group === "Çizgiler", "line toggle");
  assert(BUILTIN_META.cmo.inputs.some((i) => i.key === "period"), "generic CMO(14) untouched");
  const params = indicatorParamsFromConfig("cmo", cfgFor(["cmo_up_lo", "cmo_dn_hi"]));
  assert(params.length === 9 && params.lower === -50 && params.upper === 75 && params.sigZero === 0, "params from cfg");
  const run = (p: Record<string, number | string>) =>
    computeBuiltin({ id: "t-cmo", type: "cmoChande", name: "cmo", params: p, visible: true } as unknown as IndicatorInstance, cs);
  const plots = run(params);
  const main = plots.find((pl) => pl.seriesKey === "cmo")!;
  assert(!!main && main.pane === "sub", "cmo line");
  assert(plots.filter((pl) => pl.seriesKey?.startsWith("lvl")).length === 3, "3 level lines");
  const lvVals = plots.filter((pl) => pl.seriesKey?.startsWith("lvl")).map((pl) => (pl.data[0] as { value: number }).value).sort((a, b) => a - b);
  assert(lvVals.join(",") === "-50,0,75", `levels ${lvVals}`);
  const mk = main.markers ?? [];
  assert(mk.filter((m) => m.text === "-50↑").length === upIdx.length, "markers −50↑ = reference");
  assert(mk.filter((m) => m.text === "75↓").length === dnIdx.length, "markers 75↓ = reference");
  assert(!mk.some((m) => m.text.startsWith("0")), "zero markers off by default");
  const withZero = run({ ...params, sigZero: 1 });
  const mkZ = withZero.find((pl) => pl.seriesKey === "cmo")!.markers ?? [];
  assert(mkZ.filter((m) => m.text === "0↑").length === z0u.length && mkZ.filter((m) => m.text === "0↓").length === z0d.length, "zero markers");
  const noLv = run({ ...params, lineLevels: 0 });
  assert(noLv.filter((pl) => pl.seriesKey?.startsWith("lvl")).length === 0 && noLv.some((pl) => pl.seriesKey === "cmo"), "lineLevels off");
  const noUp = run({ ...params, sigUpLo: 0 });
  assert(!(noUp.find((pl) => pl.seriesKey === "cmo")!.markers ?? []).some((m) => m.text === "-50↑"), "sigUpLo off");
  const noMk = run({ ...params, showMarkers: 0 });
  assert(!(noMk.find((pl) => pl.seriesKey === "cmo")!.markers ?? []).length, "master marker off");
  const vals = main.data.filter((d) => "value" in d).map((d) => (d as { value: number }).value);
  const refVals = v9.filter((x): x is number => x != null);
  assert(vals.length === refVals.length && vals.every((x, i) => Math.abs(x - refVals[i]!) < 1e-9), "plot = reference");

  console.log(
    `cmo: ${compared} values = reference · edges up ${upIdx.length} dn ${dnIdx.length} zero ${z0u.length}/${z0d.length} · ${edgeChecks} scan+alarm edge checks`
  );
  console.log("OK");
}

main();
