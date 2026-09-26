/**
 * Unit smoke: PLI Yönlü Oran (pliDir) — direct Pine reference parity, list scan,
 * alarms, chart indicator toggles; pliChannel unchanged.
 * Run: npx --yes tsx scripts/smoke-pli-dir.ts
 */
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { pliDir, pliChannel, hmaTv, PLI_DIR_COND_LABEL, DEFAULT_PLI_DIR_CONDS, pliDirFetchLimit } from "../src/lib/indicators/median";
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

/** Direct TV reference: ta.wma / ta.hma = wma(2·wma(src, n/2) − wma(src, n), floor(sqrt(n))), na-propagating. */
function refWma(src: (number | null)[], len: number): (number | null)[] {
  return src.map((_, i) => {
    if (i < len - 1) return null;
    let num = 0, den = 0;
    for (let j = 0; j < len; j++) {
      const v = src[i - j];
      if (v == null) return null;
      num += v * (len - j);
      den += len - j;
    }
    return num / den;
  });
}
function refHma(src: number[], n: number): (number | null)[] {
  const a = refWma(src, Math.floor(n / 2)), b = refWma(src, n);
  return refWma(a.map((v, i) => (v == null || b[i] == null ? null : 2 * v - b[i]!)), Math.floor(Math.sqrt(n)));
}
function refCross(x: (number | null)[], y: (number | null)[], dir: "up" | "down"): number[] {
  const out: number[] = [];
  for (let i = 1; i < x.length; i++) {
    const x0 = x[i - 1], x1 = x[i], y0 = y[i - 1], y1 = y[i];
    if (x0 == null || x1 == null || y0 == null || y1 == null) continue;
    if (dir === "up" ? x1 > y1 && x0 <= y0 : x1 < y1 && x0 >= y0) out.push(i);
  }
  return out;
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
  const closes = cs.map((c) => c.close);
  const hRef = refHma(closes, 55);
  const bandRef = {
    pli_lo_up: refCross(hRef, ref.lower, "up"),
    pli_hi_up: refCross(hRef, ref.upper, "up"),
    pli_mid_up: refCross(hRef, ref.med, "up"),
    pli_mid_dn: refCross(hRef, ref.med, "down"),
  };
  for (const [c, v] of Object.entries(bandRef)) assert(v.length >= 1, `need ${c} crosses in test data`);
  const expected: Record<PliDirCond, Set<number>> = {
    pli_up: upIdx,
    pli_dn: dnIdx,
    pli_up_sq: new Set(sqUp),
    pli_dn_sq: new Set(sqDn),
    pli_lo_up: new Set(bandRef.pli_lo_up),
    pli_hi_up: new Set(bandRef.pli_hi_up),
    pli_mid_up: new Set(bandRef.pli_mid_up),
    pli_mid_dn: new Set(bandRef.pli_mid_dn),
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
        assert(h.bias === (cond.startsWith("pli_dn") || cond === "pli_mid_dn" ? "bear" : "bull"), `bias ${cond}`);
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
  const noLines = run({ ...params, lineUpper: 0, lineLower: 0, lineMedian: 0, lineZero: 0, lineHull: 0 });
  const visLines = noLines.filter((pl) => pl.color !== "rgba(0,0,0,0)");
  assert(visLines.length === 1 && visLines[0]!.seriesKey === "yonlu", "line toggles");
  assert(noLines.filter((pl) => pl.color === "rgba(0,0,0,0)").every((pl) => pl.pane === "main" && (pl.markers ?? []).length > 0), "band-cross markers kept on a transparent carrier");
  assert(run({ ...params, lineUpper: 0, lineLower: 0, lineMedian: 0, lineZero: 0 }).map((pl) => pl.seriesKey).sort().join() === "hull,yonlu", "hull stays when bands off");
  assert(!(by("yonlu", run({ ...params, sigUp: 0 }))!.markers ?? []).some((m) => m.text === "PLI↑"), "sigUp off");
  assert(!(by("yonlu", run({ ...params, showMarkers: 0 }))!.markers ?? []).length, "master off");

  // 5) Hull MA (TV) parity + band crosses (Hull / Fiyat)
  let hmaCompared = 0;
  for (const seed of [5, 17, 41]) {
    const c2 = synth(700, seed).map((c) => c.close);
    for (const hl of [4, 9, 20, 55, 100]) {
      const a = hmaTv(c2, hl), b = refHma(c2, hl);
      const first = hl - 1 + Math.floor(Math.sqrt(hl)) - 1;
      assert(a[first - 1] == null && a[first] != null, `hma first value at ${first} (len ${hl})`);
      for (let i = 0; i < c2.length; i++) {
        assert(close9(a[i]!, b[i]!), `hma len ${hl} seed ${seed} i ${i}: ${a[i]} vs ${b[i]}`);
        if (a[i] != null) hmaCompared++;
      }
    }
    for (const [hl, xs] of [[55, "hull"], [21, "hull"], [55, "price"]] as const) {
      const r = pliDir(c2, { hullLen: hl, crossSrc: xs });
      const rf = reference(c2, 50, 5, 5);
      const line = xs === "price" ? c2 : refHma(c2, hl);
      const idx = (a: (0 | 1)[]) => a.flatMap((v, i) => (v ? [i] : [])).join();
      assert(idx(r.loUp) === refCross(line, rf.lower, "up").join(), `loUp ${hl}/${xs}`);
      assert(idx(r.hiUp) === refCross(line, rf.upper, "up").join(), `hiUp ${hl}/${xs}`);
      assert(idx(r.midUp) === refCross(line, rf.med, "up").join(), `midUp ${hl}/${xs}`);
      assert(idx(r.midDn) === refCross(line, rf.med, "down").join(), `midDn ${hl}/${xs}`);
    }
  }
  // crossSrc "price" reaches the scan, note names the source
  const pxMid = refCross(closes, ref.med, "up");
  const pm = pxMid[pxMid.length - 1]!;
  const hPx = scanSymbol(cs.slice(0, pm + 1), cfgFor(["pli_mid_up"], { crossSrc: "price" }), 0);
  assert(hPx.length === 1 && hPx[0]!.note.includes("(Fiyat)"), "crossSrc price in scan");
  const hh = scanSymbol(cs.slice(0, bandRef.pli_mid_up.at(-1)! + 1), cfgFor(["pli_mid_up"]), 0);
  assert(hh.length === 1 && hh[0]!.note.includes("(Hull 55)"), "crossSrc hull note");
  // editable Hull length
  const h21 = refCross(refHma(closes, 21), ref.lower, "up");
  const e21 = h21[h21.length - 1]!;
  assert(scanSymbol(cs.slice(0, e21 + 1), cfgFor(["pli_lo_up"], { hullLen: 21 }), 0).length === 1, "hullLen editable");
  // existing defaults unchanged; band chips off by default
  assert(DEFAULT_PLI_DIR_CONDS.join() === "pli_up,pli_dn", "default chips unchanged");
  assert(scanSymbol(cs, cfgFor([]), 700).every((h) => h.cond === "pli_up" || h.cond === "pli_dn"), "band chips not in defaults");
  // alarm candle count covers PLI window + Hull warmup
  for (const hl of [55, 100, 200, 300, 500]) {
    const lim = pliDirFetchLimit(hl, 50);
    assert(lim >= hl + Math.floor(Math.sqrt(hl)) + 2 && lim >= 50 + 50 + 2, `fetch limit ${hl}: ${lim}`);
  }
  assert(pliDirFetchLimit() === 220, "default fetch limit stays 220");
  // chart: Hull line + cross markers + toggles
  const hullPlot = by("hull")!;
  assert(hullPlot.pane === "main" && hullPlot.toggle === "lineHull", "hull on main");
  const hv = hullPlot.data.filter((d) => "value" in d) as { value: number; color?: string }[];
  assert(hv.length === hRef.filter((v) => v != null).length, "hull points");
  assert(hv.slice(1).every((d, q) => d.color === (d.value > hv[q]!.value ? "#26a69a" : d.value < hv[q]!.value ? "#ef5350" : "#ab47bc")), "hull slope colors");
  const hm = hullPlot.markers ?? [];
  assert(hm.filter((m) => m.text === "A↑").length === bandRef.pli_lo_up.length, "A↑ markers");
  assert(hm.filter((m) => m.text === "Ü↑").length === bandRef.pli_hi_up.length, "Ü↑ markers");
  assert(!hm.some((m) => m.text === "O↑" || m.text === "O↓"), "mid markers off by default");
  const midOn = by("hull", run({ ...params, sigMidUp: 1, sigMidDn: 1 }))!.markers ?? [];
  assert(midOn.filter((m) => m.text === "O↑").length === bandRef.pli_mid_up.length && midOn.filter((m) => m.text === "O↓").length === bandRef.pli_mid_dn.length, "mid markers");
  const pMid = indicatorParamsFromConfig("pliDir", cfgFor(["pli_mid_dn"]));
  assert(pMid.sigMidDn === 1 && pMid.sigMidUp === 0 && pMid.hullLen === 55 && pMid.crossSrc === "hull", "params from band chips");
  const noHull = run({ ...params, lineHull: 0 });
  assert(!by("hull", noHull), "lineHull off");
  const hostMk = noHull.filter((pl) => pl.pane === "main").flatMap((pl) => pl.markers ?? []);
  assert(hostMk.filter((m) => m.text === "A↑").length === bandRef.pli_lo_up.length, "cross markers move to a visible main line");
  const plain = by("hull", run({ ...params, hullSlopeColor: 0 }))!;
  assert(plain.data.every((d) => !("color" in d) || d.color == null), "slope color off → plain purple");
  assert(!(by("hull", run({ ...params, sigLoUp: 0 }))!.markers ?? []).some((m) => m.text === "A↑"), "sigLoUp off");

  console.log(
    `pliDir: hma ${hmaCompared} values = reference · band crosses lo↑ ${bandRef.pli_lo_up.length} hi↑ ${bandRef.pli_hi_up.length} mid↑ ${bandRef.pli_mid_up.length} mid↓ ${bandRef.pli_mid_dn.length} · ${compared} yonlu values = reference · crosses up ${ref.up.length} dn ${ref.dn.length} · squeeze-release up ${sqUp.length} dn ${sqDn.length} · ${edgeChecks} scan+alarm edge checks`
  );
  console.log("OK");
}

main();
