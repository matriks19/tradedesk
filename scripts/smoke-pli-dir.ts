/**
 * Unit smoke: PLI Yönlü Oran (pliDir) — direct Pine reference parity, list scan,
 * alarms, chart indicator toggles; pliChannel unchanged.
 * Run: npx --yes tsx scripts/smoke-pli-dir.ts
 */
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { pliDir, pliChannel, PLI_DIR_COND_LABEL } from "../src/lib/indicators/median";
import {
  scanSymbol,
  alertScanHits,
  indicatorParamsFromConfig,
  KIND_TO_INDICATOR,
  type ListScanConfig,
  type PliDirCond,
} from "../src/lib/scanner/listScan";
import { computeBuiltin, BUILTIN_META } from "../src/lib/indicators/registry";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
const close9 = (a: number | null, b: number | null) =>
  a == null ? b == null : b != null && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));

/** Independent Hyndman–Fan type 7 (TV percentile_linear_interpolation) at bar i. */
function pli(src: number[], i: number, len: number, pct: number): number | null {
  if (i < len - 1) return null;
  const w = src.slice(i - len + 1, i + 1).sort((a, b) => a - b);
  const r = (pct / 100) * (len - 1);
  const j = Math.floor(r);
  const g = r - j;
  return j + 1 < len ? w[j]! + g * (w[j + 1]! - w[j]!) : w[j]!;
}

/** Bar-by-bar Pine transcription (na comparisons are false). */
function reference(src: number[], len: number, x: number, k: number) {
  const n = src.length;
  const upper = src.map((_, i) => pli(src, i, len, 100 - x));
  const lower = src.map((_, i) => pli(src, i, len, x));
  const med = src.map((_, i) => pli(src, i, len, 50));
  const oran: (number | null)[] = [];
  const yonlu: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const u = upper[i], l = lower[i], m = med[i];
    if (u == null || l == null) {
      oran.push(null);
      yonlu.push(null);
      continue;
    }
    const o = u / l - 1;
    const uk = i >= k ? upper[i - k] : null;
    const lk = i >= k ? lower[i - k] : null;
    const upMove = uk == null ? null : u / uk - 1;
    const dnMove = lk == null ? null : lk / l - 1;
    const d = upMove == null || dnMove == null ? null : upMove - dnMove;
    const dir = d != null && d > 0 ? 1 : d != null && d < 0 ? -1 : m != null && src[i]! >= m ? 1 : -1;
    oran.push(o);
    yonlu.push(o * dir);
  }
  // squeeze: oran <= percentile(oran, 50, 25) over a full non-na window; recent = any in last 5 bars
  const sq: number[] = oran.map((o, i) => {
    if (o == null || i < 49) return 0;
    const w = oran.slice(i - 49, i + 1);
    if (w.some((v) => v == null)) return 0;
    return o <= pli(w as number[], 49, 50, 25)! ? 1 : 0;
  });
  const sqRecent = sq.map((_, i) => (sq.slice(Math.max(0, i - 4), i + 1).some((v) => v === 1) ? 1 : 0));
  const up: number[] = [], dn: number[] = [];
  for (let i = 1; i < n; i++) {
    const a = yonlu[i - 1], b = yonlu[i];
    if (a == null || b == null) continue;
    if (a <= 0 && b > 0) up.push(i);
    if (a >= 0 && b < 0) dn.push(i);
  }
  return { upper, lower, med, oran, yonlu, sqRecent, up, dn };
}

function synth(n = 700, seed0 = 5): Candle[] {
  const out: Candle[] = [];
  let seed = seed0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  let px = 100;
  for (let i = 0; i < n; i++) {
    // regimes: range (squeeze) → rally → range → selloff …
    const phase = Math.floor(i / 90) % 4;
    const drift = phase === 1 ? 0.5 : phase === 3 ? -0.5 : 0;
    const vol = phase === 0 || phase === 2 ? 0.25 : 1.1;
    const open = px;
    px = Math.max(5, px + drift + rnd() * vol * 2);
    out.push({ time: 1_700_000_000 + i * 3600, open, high: Math.max(open, px) + 0.2, low: Math.min(open, px) - 0.2, close: px, volume: 1000 });
  }
  return out;
}

function main() {
  // 1) Reference parity
  let compared = 0;
  for (const seed of [5, 17, 41]) {
    const src = synth(700, seed).map((c) => c.close);
    for (const [len, x, k] of [[50, 5, 5], [20, 10, 3], [50, 5, 0], [30, 2.5, 12]] as const) {
      const a = pliDir(src, { length: len, x, k });
      const b = reference(src, len, x, k);
      for (let i = 0; i < src.length; i++) {
        for (const key of ["upper", "lower", "med", "oran", "yonlu"] as const) {
          assert(close9(a[key][i]!, b[key][i]!), `${key} seed ${seed} (${len},${x},${k}) i ${i}: ${a[key][i]} vs ${b[key][i]}`);
        }
        if (a.yonlu[i] != null) compared++;
      }
      assert(a.yonlu[len - 2] == null && a.yonlu[len - 1] != null, "first value at len−1");
      if (len === 50 && x === 5) {
        for (let i = 0; i < src.length; i++) assert(a.squeezeRecent[i] === b.sqRecent[i], `squeeze seed ${seed} i ${i}`);
      }
      const ups = a.crossUp.flatMap((v, i) => (v ? [i] : []));
      const dns = a.crossDn.flatMap((v, i) => (v ? [i] : []));
      assert(ups.join() === b.up.join() && dns.join() === b.dn.join(), `crosses seed ${seed} (${len},${x},${k})`);
    }
  }
  // Direction semantics: sustained rally → +, sustained selloff → −
  const up = Array.from({ length: 120 }, (_, i) => 100 + i);
  const dn = Array.from({ length: 120 }, (_, i) => 300 - i);
  assert((pliDir(up).yonlu[119] as number) > 0, "rally → yonlu > 0");
  assert((pliDir(dn).yonlu[119] as number) < 0, "selloff → yonlu < 0");
  const flat = pliDir(new Array(80).fill(10));
  assert(flat.oran[79] === 0 && flat.yonlu[79] === 0, "flat → oran 0, yonlu 0 (src ≥ med → +0)");

  // 2) pliChannel unchanged (same upper/lower/oran as before; oran always ≥ 0)
  const src = synth(700, 5).map((c) => c.close);
  const ch = pliChannel(src, 50, 5);
  const ref = reference(src, 50, 5, 5);
  for (let i = 0; i < src.length; i++) {
    assert(close9(ch.upper[i]!, ref.upper[i]!) && close9(ch.lower[i]!, ref.lower[i]!) && close9(ch.oran[i]!, ref.oran[i]!), `pliChannel i ${i}`);
    if (ch.oran[i] != null) assert(ch.oran[i]! >= 0, "pliChannel oran ≥ 0");
  }
  assert(BUILTIN_META.pliChannel.inputs.map((i) => i.key).join() === "length,x,source", "pliChannel meta untouched");

  // 3) List scan
  const cs = synth(700, 5);
  const upIdx = new Set(ref.up), dnIdx = new Set(ref.dn);
  assert(ref.up.length >= 3 && ref.dn.length >= 3, `need crosses (${ref.up.length}/${ref.dn.length})`);
  const sqUp = ref.up.filter((i) => ref.sqRecent[i] === 1);
  const sqDn = ref.dn.filter((i) => ref.sqRecent[i] === 1);
  assert(sqUp.length + sqDn.length >= 1, "need a squeeze-release cross");
  assert(sqUp.length < ref.up.length || sqDn.length < ref.dn.length, "squeeze filter must reject some crosses");
  const cfgFor = (conds: PliDirCond[], extra: Partial<NonNullable<ListScanConfig["pliDir"]>> = {}): ListScanConfig => ({
    pliDir: { enabled: true, conds, ...extra },
  });
  const expected: Record<PliDirCond, Set<number>> = {
    pli_up: upIdx,
    pli_dn: dnIdx,
    pli_up_sq: new Set(sqUp),
    pli_dn_sq: new Set(sqDn),
  };
  let edgeChecks = 0;
  for (const cond of Object.keys(expected) as PliDirCond[]) {
    for (let end = 60; end < cs.length; end++) {
      const cut = cs.slice(0, end + 1);
      const hits = scanSymbol(cut, cfgFor([cond]), 0);
      assert(hits.length === (expected[cond].has(end) ? 1 : 0), `${cond} edge at ${end}: ${hits.length}`);
      if (hits.length) {
        const h = hits[0]!;
        assert(h.kind === "pliDir" && h.barsAgo === 0, "hit shape");
        assert(h.bias === (cond.startsWith("pli_dn") ? "bear" : "bull"), `bias ${cond}`);
        assert(h.note.startsWith(PLI_DIR_COND_LABEL[cond]), `note ${h.note}`);
        assert(alertScanHits(cut, cfgFor([cond]), 1).some((x) => x.cond === cond), `alarm ${cond}`);
        edgeChecks++;
      }
    }
  }
  const lastUp = ref.up[ref.up.length - 1]!;
  const w = scanSymbol(cs.slice(0, lastUp + 3), cfgFor(["pli_up"]), 2);
  assert(w.length === 1 && w[0]!.barsAgo === 2, "barsAgo window");
  assert(alertScanHits(cs.slice(0, lastUp + 3), cfgFor(["pli_up"]), 2).length === 0, "alarm only ≤1 bar ago");
  const def = scanSymbol(cs, cfgFor([]), 700);
  assert(def.length >= 1 && def.every((h) => h.cond === "pli_up" || h.cond === "pli_dn"), "defaults");
  // Editable params reach the scan
  const r2 = reference(cs.map((c) => c.close), 20, 10, 3);
  const e = r2.up[r2.up.length - 1]!;
  assert(scanSymbol(cs.slice(0, e + 1), cfgFor(["pli_up"], { length: 20, x: 10, k: 3 }), 0).length === 1, "editable len/x/k");
  assert(scanSymbol(cs.slice(0, 40), cfgFor(["pli_up", "pli_dn"]), 10).length === 0, "too few bars");

  // 4) Chart indicator
  assert(KIND_TO_INDICATOR.pliDir === "pliDir", "kind → indicator");
  const meta = BUILTIN_META.pliDir;
  const inp = (key: string) => meta.inputs.find((i) => i.key === key);
  assert(inp("length")?.default === 50 && inp("x")?.default === 5 && inp("k")?.default === 5 && inp("source")?.default === "close", "defaults");
  assert(inp("sigUp")?.group === "Sinyaller" && inp("sigSq")?.default === 0 && inp("lineMedian")?.group === "Çizgiler", "toggles");
  const params = indicatorParamsFromConfig("pliDir", cfgFor(["pli_up", "pli_dn"]));
  assert(params.length === 50 && params.x === 5 && params.k === 5 && params.sigSq === 0, "params");
  assert(indicatorParamsFromConfig("pliDir", cfgFor(["pli_up_sq"])).sigSq === 1, "sq chips → sigSq");
  const run = (p: Record<string, number | string>) =>
    computeBuiltin({ id: "t-pli", type: "pliDir", name: "pli", params: p, visible: true } as unknown as IndicatorInstance, cs);
  const plots = run(params);
  const by = (key: string, pl = plots) => pl.find((x) => x.seriesKey === key);
  assert(by("upper")?.pane === "main" && by("upper")?.color === "#ef5350", "upper red main");
  assert(by("lower")?.pane === "main" && by("lower")?.color === "#26a69a", "lower teal main");
  assert(by("med")?.pane === "main", "median main");
  const hp = by("yonlu")!;
  assert(hp.pane === "sub" && hp.type === "histogram", "yonlu histogram sub");
  let colored = 0;
  for (const pt of hp.data) {
    if (!("value" in pt)) continue;
    assert(pt.color === (pt.value >= 0 ? "#26a69a" : "#ef5350"), "hist color by sign");
    colored++;
  }
  assert(colored === ref.yonlu.filter((v) => v != null).length, "hist points");
  assert(by("zero")?.pane === "sub", "zero line");
  const mk = hp.markers ?? [];
  assert(mk.filter((m) => m.text === "PLI↑").length === ref.up.length && mk.filter((m) => m.text === "PLI↓").length === ref.dn.length, "markers = reference");
  const mkSq = by("yonlu", run({ ...params, sigSq: 1 }))!.markers ?? [];
  assert(mkSq.filter((m) => m.text === "PLI↑ S").length === sqUp.length && mkSq.filter((m) => m.text === "PLI↓ S").length === sqDn.length, "squeeze markers");
  const noLines = run({ ...params, lineUpper: 0, lineLower: 0, lineMedian: 0, lineZero: 0 });
  assert(noLines.length === 1 && noLines[0]!.seriesKey === "yonlu", "line toggles");
  assert(!(by("yonlu", run({ ...params, sigUp: 0 }))!.markers ?? []).some((m) => m.text === "PLI↑"), "sigUp off");
  assert(!(by("yonlu", run({ ...params, showMarkers: 0 }))!.markers ?? []).length, "master off");

  console.log(
    `pliDir: ${compared} yonlu values = reference · crosses up ${ref.up.length} dn ${ref.dn.length} · squeeze-release up ${sqUp.length} dn ${sqDn.length} · ${edgeChecks} scan+alarm edge checks`
  );
  console.log("OK");
}

main();
