/**
 * Unit smoke: Kijun + BB list scan + MA Basit EMA10↑SMA20 chip.
 * Run: npx --yes tsx scripts/smoke-kijun-bb.ts
 */
import type { Candle } from "../src/lib/types";
import { kijunBb } from "../src/lib/indicators/kijunBb";
import { maSimple } from "../src/lib/indicators/maSimple";
import {
  scanSymbol,
  alertScanHits,
  indicatorParamsFromConfig,
  type ListScanConfig,
  type KijunBbCond,
} from "../src/lib/scanner/listScan";
import { computeBuiltin } from "../src/lib/indicators/registry";
import type { IndicatorInstance } from "../src/lib/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Deterministic wavy path with trend changes → band + mid crosses. */
function synth(n = 400): Candle[] {
  const out: Candle[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  for (let i = 0; i < n; i++) {
    const base =
      100 + 12 * Math.sin(i / 23) + 5 * Math.sin(i / 7) + (i > 250 ? (i - 250) * 0.2 : 0);
    const close = base + rnd() * 2;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: Math.max(base, close) + 0.6 + Math.abs(rnd()),
      low: Math.min(base, close) - 0.6 - Math.abs(rnd()),
      close,
      volume: 1000,
    });
  }
  return out;
}

/** Naive reference straight from the Pine formula. */
function reference(cs: Candle[], base = 26, len = 24, mult = 2) {
  const n = cs.length;
  const kijun: (number | null)[] = new Array(n).fill(null);
  for (let i = base - 1; i < n; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - base + 1; j <= i; j++) {
      hi = Math.max(hi, cs[j]!.high);
      lo = Math.min(lo, cs[j]!.low);
    }
    kijun[i] = (hi + lo) / 2;
  }
  const basis: (number | null)[] = new Array(n).fill(null);
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = base - 1 + len - 1; i < n; i++) {
    const w = kijun.slice(i - len + 1, i + 1) as number[];
    const m = w.reduce((a, b) => a + b, 0) / len;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / len);
    basis[i] = m;
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { kijun, basis, upper, lower };
}

function close(a: number | null, b: number | null) {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) < 1e-9;
}

function main() {
  const cs = synth();
  const k = kijunBb(cs);
  const ref = reference(cs);
  for (let i = 0; i < cs.length; i++) {
    assert(close(k.kijun[i]!, ref.kijun[i]!), `kijun@${i}`);
    assert(close(k.basis[i]!, ref.basis[i]!), `basis@${i}`);
    assert(close(k.upper[i]!, ref.upper[i]!), `upper@${i}`);
    assert(close(k.lower[i]!, ref.lower[i]!), `lower@${i}`);
  }
  assert(k.kijun[24] == null && k.kijun[25] != null, "kijun warmup 26");
  assert(k.basis[47] == null && k.basis[48] != null, "basis warmup 26+24-1");

  // Edge semantics: fire only on the crossing bar
  const counts: Record<KijunBbCond, number> = {
    px_lower_up: 0,
    px_lower_dn: 0,
    px_upper_up: 0,
    kijun_mid_up: 0,
    kijun_mid_dn: 0,
  };
  const cl = cs.map((c) => c.close);
  for (let i = 1; i < cs.length; i++) {
    for (const c of Object.keys(counts) as KijunBbCond[]) {
      if (k[c][i] !== 1) continue;
      counts[c]++;
    }
    if (k.px_lower_up[i] === 1)
      assert(cl[i - 1]! <= k.lower[i - 1]! && cl[i]! > k.lower[i]!, `px_lower_up@${i}`);
    if (k.px_lower_dn[i] === 1)
      assert(cl[i - 1]! >= k.lower[i - 1]! && cl[i]! < k.lower[i]!, `px_lower_dn@${i}`);
    if (k.px_upper_up[i] === 1)
      assert(cl[i - 1]! <= k.upper[i - 1]! && cl[i]! > k.upper[i]!, `px_upper_up@${i}`);
    if (k.kijun_mid_up[i] === 1)
      assert(k.kijun[i - 1]! <= k.basis[i - 1]! && k.kijun[i]! > k.basis[i]!, `kijun_mid_up@${i}`);
    if (k.kijun_mid_dn[i] === 1)
      assert(k.kijun[i - 1]! >= k.basis[i - 1]! && k.kijun[i]! < k.basis[i]!, `kijun_mid_dn@${i}`);
  }
  for (const [c, v] of Object.entries(counts)) assert(v > 0, `expected ${c} events, got 0`);

  // Scan: find the last event bar for each cond, truncate there → barsAgo 0
  const cfgAll: ListScanConfig = {
    matchMode: "any",
    kijunBb: {
      enabled: true,
      conds: ["px_lower_up", "px_lower_dn", "px_upper_up", "kijun_mid_up", "kijun_mid_dn"],
    },
  };
  for (const c of Object.keys(counts) as KijunBbCond[]) {
    let last = -1;
    for (let i = 0; i < cs.length; i++) if (k[c][i] === 1) last = i;
    const cut = cs.slice(0, last + 1);
    if (cut.length < 60) continue;
    const hits = scanSymbol(cut, { kijunBb: { enabled: true, conds: [c] } }, 2);
    assert(hits.some((h) => h.kind === "kijunBb" && h.cond === c && h.barsAgo === 0), `scan ${c}`);
    const al = alertScanHits(cut, { kijunBb: { enabled: true, conds: [c] } }, 1);
    assert(al.some((h) => h.cond === c), `alert ${c} (edge → alarmable)`);
    const bias = hits.find((h) => h.cond === c)!.bias;
    assert(bias === (c.endsWith("_dn") ? "bear" : "bull"), `bias ${c}`);
  }
  // Default conds when empty
  const def = scanSymbol(cs, { kijunBb: { enabled: true, conds: [] } }, 400);
  assert(def.every((h) => h.cond === "px_lower_up" || h.cond === "kijun_mid_up"), "defaults");
  // Too few bars → no hits
  assert(scanSymbol(cs.slice(0, 50), cfgAll, 10).length === 0, "min bars");

  // Chart plots
  const inst = { id: "t", type: "kijunBb", params: indicatorParamsFromConfig("kijunBb", cfgAll) } as unknown as IndicatorInstance;
  const plots = computeBuiltin(inst, cs);
  const keys = plots.map((p) => p.seriesKey);
  assert(["kijun", "basis", "upper", "lower"].every((x) => keys.includes(x)), `plots ${keys}`);
  assert(plots.every((p) => p.pane === "main"), "main pane");

  // ---- MA Basit EMA10↑SMA20 ----
  const ms = maSimple(cs);
  let eUp = 0;
  let eDn = 0;
  for (let i = 1; i < cs.length; i++) {
    if (ms.ema10_x_sma20[i] === 1) {
      eUp++;
      assert(ms.ema10[i - 1]! <= ms.sma20[i - 1]! && ms.ema10[i]! > ms.sma20[i]!, `ema up@${i}`);
    }
    if (ms.ema10_x_sma20_dn[i] === 1) {
      eDn++;
      assert(ms.ema10[i - 1]! >= ms.sma20[i - 1]! && ms.ema10[i]! < ms.sma20[i]!, `ema dn@${i}`);
    }
  }
  assert(eUp > 0 && eDn > 0, `ema10 crosses up=${eUp} dn=${eDn}`);
  let lastUp = -1;
  for (let i = 0; i < cs.length; i++) if (ms.ema10_x_sma20[i] === 1 && i >= 210) lastUp = i;
  assert(lastUp > 0, "ema up after warmup");
  const cutMa = cs.slice(0, lastUp + 1);
  const cfgMa: ListScanConfig = { maSimple: { enabled: true, conds: ["ema10_x_sma20"] } };
  const mh = scanSymbol(cutMa, cfgMa, 2);
  assert(mh.some((h) => h.kind === "maSimple" && h.cond === "ema10_x_sma20" && h.barsAgo === 0), "ma scan ema10");
  assert(alertScanHits(cutMa, cfgMa, 1).some((h) => h.cond === "ema10_x_sma20"), "ma alert ema10");
  // Existing chips still work
  const old = scanSymbol(cs, { maSimple: { enabled: true, conds: ["x_20_50", "price_x_20", "stack_bull"] } }, 400);
  assert(old.length > 0, "existing MA chips");
  // Chart: EMA10 only when chip selected
  const pOn = indicatorParamsFromConfig("maSimple", cfgMa);
  const pOff = indicatorParamsFromConfig("maSimple", { maSimple: { enabled: true, conds: ["x_20_50"] } });
  assert(pOn.showEma10 === 1 && pOff.showEma10 === 0, "showEma10 param");
  const on = computeBuiltin({ id: "m", type: "maSimple", params: pOn } as unknown as IndicatorInstance, cs);
  const off = computeBuiltin({ id: "m", type: "maSimple", params: pOff } as unknown as IndicatorInstance, cs);
  assert(on.some((p) => p.seriesKey === "ema10"), "ema10 plotted");
  assert(!off.some((p) => p.seriesKey === "ema10"), "ema10 hidden");
  assert(off.length === 4, "4 SMA unchanged");

  console.log("OK smoke-kijun-bb", { counts, eUp, eDn, plots: keys });
}

main();
