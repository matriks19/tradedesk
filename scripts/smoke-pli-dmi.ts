/**
 * Unit smoke: PLI± DMI Hibrit (pliDmiHybrid / Liste kind pliDmi).
 *  - independent bar-by-bar transcription of /workspace/pine-inbox/pli_dmi_hybrid.pine
 *    (own percentile, own ta.rma, scalar state variables exactly like the Pine)
 *  - loop-free trackers == the user's original backward-loop pivots (early off)
 *  - causality (no lookahead), list scan + alarms, chart toggles
 * Run: npx --yes tsx scripts/smoke-pli-dmi.ts
 */
import type { Candle, IndicatorInstance } from "../src/lib/types";
import { computePliDmi, type PliDmiCond, type PliDmiOpts } from "../src/lib/indicators/pliDmi";
import {
  scanSymbol,
  alertScanHits,
  indicatorParamsFromConfig,
  KIND_TO_INDICATOR,
  PLI_DMI_COND_LABEL,
  type ListScanConfig,
} from "../src/lib/scanner/listScan";
import { computeBuiltin, BUILTIN_META } from "../src/lib/indicators/registry";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}
const eq = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || Number.isNaN(a) ? b == null || Number.isNaN(b) : b != null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));

// ── Independent reference (Pine transcription) ─────────────────────────────
type Opt = Required<Omit<PliDmiOpts, "depth">>;
const DEF: Opt = { length: 50, x: 5, zone: 0.75, dmSrc: "price", diLen: 14, adxLen: 14, adxMin: 20, look: 3, k: 5, earlySw: 1.5, combWin: 5, useWk: true, usePos: false, posLo: 0.3, posHi: 0.7 };
function ref(cs: Candle[], o: Opt) {
  const n = cs.length;
  const high = cs.map((c) => c.high), low = cs.map((c) => c.low), src = cs.map((c) => c.close);
  const pctl = (i: number, p: number) => {
    if (i < o.length - 1) return NaN;
    const w = src.slice(i - o.length + 1, i + 1).sort((a, b) => a - b);
    const r = (p / 100) * (o.length - 1), j = Math.floor(r);
    return j + 1 < o.length ? w[j]! + (r - j) * (w[j + 1]! - w[j]!) : w[j]!;
  };
  const upper = src.map((_, i) => pctl(i, 100 - o.x)), lower = src.map((_, i) => pctl(i, o.x)), med = src.map((_, i) => pctl(i, 50));
  const at = (a: number[], i: number) => (i >= 0 ? a[i]! : NaN);
  const rma = (s: number[], L: number) => {
    const out: number[] = []; let sum = NaN;
    for (let i = 0; i < s.length; i++) {
      if (Number.isNaN(sum)) { if (i >= L - 1) { let t = 0; for (let j = i - L + 1; j <= i; j++) t += s[j]!; sum = t / L; } }
      else sum = (1 / L) * s[i]! + (1 - 1 / L) * sum;
      out.push(sum);
    }
    return out;
  };
  const gt = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a > b; // Pine: na comparisons false
  const band = o.dmSrc === "band";
  const pos: number[] = [], oran: number[] = [], dir: number[] = [], plusDM: number[] = [], minusDM: number[] = [], trS: number[] = [];
  for (let i = 0; i < n; i++) {
    const rng = upper[i]! - lower[i]!;
    pos.push(gt(rng, 0) ? (src[i]! - lower[i]!) / rng : 0.5);
    const or = Number.isNaN(upper[i]!) || Number.isNaN(lower[i]!) || lower[i] === 0 ? NaN : upper[i]! / lower[i]! - 1;
    oran.push(or);
    const d = (upper[i]! / at(upper, i - o.k) - 1) - (at(lower, i - o.k) / lower[i]! - 1);
    dir.push(Number.isNaN(or) ? NaN : gt(d, 0) ? 1 : gt(0, d) ? -1 : !Number.isNaN(med[i]!) && src[i]! >= med[i]! ? 1 : -1);
    const upM = band ? upper[i]! - at(upper, i - 1) : high[i]! - at(high, i - 1);
    const dnM = band ? at(lower, i - 1) - lower[i]! : at(low, i - 1) - low[i]!;
    plusDM.push(gt(upM, dnM) && gt(upM, 0) ? upM : 0);
    minusDM.push(gt(dnM, upM) && gt(dnM, 0) ? dnM : 0);
    const trBand = Math.max(Math.abs(upper[i]! - at(upper, i - 1)), Math.abs(lower[i]! - at(lower, i - 1)));
    const trPrice = i === 0 ? high[i]! - low[i]! : Math.max(high[i]! - low[i]!, Math.abs(high[i]! - src[i - 1]!), Math.abs(low[i]! - src[i - 1]!));
    trS.push(band ? (Number.isNaN(trBand) ? 0 : trBand) : trPrice);
  }
  const trR = rma(trS, o.diLen), rP = rma(plusDM, o.diLen), rM = rma(minusDM, o.diLen);
  const diP = trR.map((t, i) => (gt(t, 0) ? (100 * rP[i]!) / t : 0));
  const diM = trR.map((t, i) => (gt(t, 0) ? (100 * rM[i]!) / t : 0));
  const adx = rma(diP.map((p, i) => (p + diM[i]! === 0 ? 0 : (100 * Math.abs(p - diM[i]!)) / (p + diM[i]!))), o.adxLen);
  const sig: Record<PliDmiCond, number[]> = { early_top: [], early_bot: [], core_top: [], core_bot: [], comb_top: [], comb_bot: [] };
  type Lbl = { bar: number; price: number; text: string; alive: boolean };
  const labels: Lbl[] = [];
  let lastPv = 0, hiP = NaN, hiB = NaN, loP = NaN, loB = NaN, lastB = NaN;
  let hLo1 = NaN, hLo1B = NaN, hHi2 = NaN, hHi2B = NaN, hLo3 = NaN, hLo3B = NaN;
  let lHi1 = NaN, lHi1B = NaN, lLo2 = NaN, lLo2B = NaN, lHi3 = NaN, lHi3B = NaN;
  let eTopOn = false, eTopBar = NaN, eTopLbl: Lbl | null = null, eBotOn = false, eBotBar = NaN, eBotLbl: Lbl | null = null;
  let pendTopLbl: Lbl | null = null, pendTopBar = NaN, pendTopP = NaN, pendBotLbl: Lbl | null = null, pendBotBar = NaN, pendBotP = NaN;
  const newLabel = (bar: number, price: number, text: string) => { const l = { bar, price, text, alive: true }; labels.push(l); return l; };
  for (let b = 0; b < n; b++) {
    const adxTurnDn = b >= 2 && adx[b]! < adx[b - 1]! && adx[b - 1]! >= adx[b - 2]! && adx[b - 1]! >= o.adxMin;
    const hiPos = b >= o.look - 1 ? Math.max(...pos.slice(b - o.look + 1, b + 1)) : NaN;
    const loPos = b >= o.look - 1 ? Math.min(...pos.slice(b - o.look + 1, b + 1)) : NaN;
    const topCore = adxTurnDn && diP[b]! > diM[b]! && hiPos >= o.zone;
    const botCore = adxTurnDn && diM[b]! > diP[b]! && loPos <= 1 - o.zone;
    const topWk = b > 0 && diP[b]! < diM[b]! && diP[b - 1]! >= diM[b - 1]!;
    const botWk = b > 0 && diP[b]! > diM[b]! && diP[b - 1]! <= diM[b - 1]!;
    const posTop = b > 0 && pos[b]! < o.posHi && pos[b - 1]! >= o.posHi;
    const posBot = b > 0 && pos[b]! > o.posLo && pos[b - 1]! <= o.posLo;
    const topFb = (o.useWk && topWk) || (o.usePos && posTop);
    const botFb = (o.useWk && botWk) || (o.usePos && posBot);
    const flipDn = b > 0 && dir[b - 1] === 1 && dir[b] === -1;
    const flipUp = b > 0 && dir[b - 1] === -1 && dir[b] === 1;
    const s = src[b]!, h = high[b]!, l = low[b]!;
    // 1)
    if (lastPv !== 1) {
      if (Number.isNaN(hiP) || h > hiP) {
        hiP = h; hiB = b; hLo1 = l; hLo1B = b; hHi2 = h; hHi2B = b; hLo3 = l; hLo3B = b;
        if (eTopOn) { eTopLbl!.alive = false; eTopOn = false; }
      } else if (l <= hLo1) { hLo1 = l; hLo1B = b; hHi2 = h; hHi2B = b; hLo3 = l; hLo3B = b; }
      else if (h >= hHi2) { hHi2 = h; hHi2B = b; hLo3 = l; hLo3B = b; }
      else if (l <= hLo3) { hLo3 = l; hLo3B = b; }
    }
    if (lastPv !== -1) {
      if (Number.isNaN(loP) || l < loP) {
        loP = l; loB = b; lHi1 = h; lHi1B = b; lLo2 = l; lLo2B = b; lHi3 = h; lHi3B = b;
        if (eBotOn) { eBotLbl!.alive = false; eBotOn = false; }
      } else if (h >= lHi1) { lHi1 = h; lHi1B = b; lLo2 = l; lLo2B = b; lHi3 = h; lHi3B = b; }
      else if (l <= lLo2) { lLo2 = l; lLo2B = b; lHi3 = h; lHi3B = b; }
      else if (h >= lHi3) { lHi3 = h; lHi3B = b; }
    }
    // 2)
    let earlyTop = false, earlyBot = false;
    if (lastPv !== 1 && !Number.isNaN(hiP) && !eTopOn && flipDn && ((hiP - s) / hiP) * 100 >= o.earlySw) {
      earlyTop = true; eTopOn = true; eTopBar = b; eTopLbl = newLabel(hiB, hiP, "T?");
    }
    if (lastPv !== -1 && !Number.isNaN(loP) && !eBotOn && flipUp && ((s - loP) / loP) * 100 >= o.earlySw) {
      earlyBot = true; eBotOn = true; eBotBar = b; eBotLbl = newLabel(loB, loP, "D?");
    }
    // 3)
    let combTop = false, combBot = false;
    if (!Number.isNaN(pendTopBar) && (lastPv !== 1 || b - pendTopBar > o.combWin)) pendTopBar = NaN;
    if (!Number.isNaN(pendBotBar) && (lastPv !== -1 || b - pendBotBar > o.combWin)) pendBotBar = NaN;
    if (!Number.isNaN(pendTopBar) && b > pendTopBar && flipDn && ((pendTopP - s) / pendTopP) * 100 >= o.earlySw) {
      pendTopLbl!.text = "T!!"; combTop = true; pendTopBar = NaN;
    }
    if (!Number.isNaN(pendBotBar) && b > pendBotBar && flipUp && ((s - pendBotP) / pendBotP) * 100 >= o.earlySw) {
      pendBotLbl!.text = "D!!"; combBot = true; pendBotBar = NaN;
    }
    // 4)
    let coreTop = false, coreBot = false;
    if (lastPv !== 1 && !Number.isNaN(hiP) && (topCore || topFb)) {
      const isComb = eTopOn ? topCore && b - eTopBar <= o.combWin : false;
      if (eTopOn) { eTopLbl!.alive = false; eTopOn = false; }
      const lbl = newLabel(hiB, hiP, isComb ? "T!!" : topCore ? "T" : "t");
      coreTop = topCore; combTop = combTop || isComb;
      if (topCore && !isComb) { pendTopLbl = lbl; pendTopBar = b; pendTopP = hiP; } else pendTopBar = NaN;
      pendBotBar = NaN;
      if (eBotOn) { eBotLbl!.alive = false; eBotOn = false; }
      lastB = hiB; lastPv = 1;
      loP = hLo1; loB = hLo1B; lHi1 = hHi2; lHi1B = hHi2B; lLo2 = hLo3; lLo2B = hLo3B; lHi3 = h; lHi3B = b;
      hiP = NaN;
    } else if (lastPv !== -1 && !Number.isNaN(loP) && (botCore || botFb)) {
      const isComb = eBotOn ? botCore && b - eBotBar <= o.combWin : false;
      if (eBotOn) { eBotLbl!.alive = false; eBotOn = false; }
      const lbl = newLabel(loB, loP, isComb ? "D!!" : botCore ? "D" : "d");
      coreBot = botCore; combBot = combBot || isComb;
      if (botCore && !isComb) { pendBotLbl = lbl; pendBotBar = b; pendBotP = loP; } else pendBotBar = NaN;
      pendTopBar = NaN;
      if (eTopOn) { eTopLbl!.alive = false; eTopOn = false; }
      lastB = loB; lastPv = -1;
      hiP = lHi1; hiB = lHi1B; hLo1 = lLo2; hLo1B = lLo2B; hHi2 = lHi3; hHi2B = lHi3B; hLo3 = l; hLo3B = b;
      loP = NaN;
    }
    void lastB;
    if (earlyTop) sig.early_top.push(b);
    if (earlyBot) sig.early_bot.push(b);
    if (coreTop) sig.core_top.push(b);
    if (coreBot) sig.core_bot.push(b);
    if (combTop) sig.comb_top.push(b);
    if (combBot) sig.comb_bot.push(b);
  }
  const alive = labels.filter((x) => x.alive).map((x) => `${x.text}@${x.bar}:${x.price}`).sort();
  return { upper, lower, med, diP, diM, adx, oran, dir, sig, labels: alive };
}

/** User's original PLI-DMI pivots with backward for-loops (no early/comb layer). */
function loopPivots(cs: Candle[], topCore: (0 | 1)[], botCore: (0 | 1)[], diP: number[], diM: number[]) {
  let lastPv = 0, hiP: number | null = null, hiB = -1, loP: number | null = null, loB = -1;
  const piv: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const h = cs[i]!.high, l = cs[i]!.low;
    if (lastPv !== 1 && (hiP == null || h > hiP)) { hiP = h; hiB = i; }
    if (lastPv !== -1 && (loP == null || l < loP)) { loP = l; loB = i; }
    const topWk = i > 0 && diP[i]! < diM[i]! && diP[i - 1]! >= diM[i - 1]!;
    const botWk = i > 0 && diP[i]! > diM[i]! && diP[i - 1]! <= diM[i - 1]!;
    if (lastPv !== 1 && hiP != null && (topCore[i] || topWk)) {
      piv.push(`${topCore[i] ? "T" : "t"}@${hiB}:${hiP}`); lastPv = 1;
      loP = l; loB = i; for (let j = 0; j <= i - hiB; j++) if (cs[i - j]!.low < loP) { loP = cs[i - j]!.low; loB = i - j; }
      hiP = null;
    } else if (lastPv !== -1 && loP != null && (botCore[i] || botWk)) {
      piv.push(`${botCore[i] ? "D" : "d"}@${loB}:${loP}`); lastPv = -1;
      hiP = h; hiB = i; for (let j = 0; j <= i - loB; j++) if (cs[i - j]!.high > hiP) { hiP = cs[i - j]!.high; hiB = i - j; }
      loP = null;
    }
  }
  return piv;
}

function synth(n: number, seed0: number, mode: number): Candle[] {
  const out: Candle[] = []; let seed = seed0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  let px = 100;
  for (let i = 0; i < n; i++) {
    const drift = mode === 0 ? 0.9 * Math.sin(i / 35) : mode === 1 ? 0.35 * Math.sin(i / 9) : 0.6 * Math.sin(i / 22) + 0.3 * Math.sin(i / 7);
    const o = px; px = Math.max(5, px + drift + rnd() * 2);
    out.push({ time: 1_700_000_000 + i * 3600, open: o, high: Math.max(o, px) + Math.abs(rnd()), low: Math.min(o, px) - Math.abs(rnd()), close: px, volume: 1 });
  }
  return out;
}

function main() {
  const CONDS: PliDmiCond[] = ["early_top", "early_bot", "core_top", "core_bot", "comb_top", "comb_bot"];
  const tally: Record<string, number> = { early_top: 0, early_bot: 0, core_top: 0, core_bot: 0, comb_top: 0, comb_bot: 0, lateComb: 0, weak: 0, pivots: 0 };
  const variants: Partial<Opt>[] = [{}, { dmSrc: "band" }, { usePos: true, useWk: false }, { earlySw: 0.5, combWin: 8, k: 3, adxMin: 15 }, { useWk: false, x: 10, length: 30, zone: 0.7 }];
  let runs = 0;
  // 1) reference parity
  for (const v of variants) {
    for (let sd = 1; sd <= 8; sd++) {
      const cs = synth(900, sd * 31 + 7, sd % 3);
      const o = { ...DEF, ...v } as Opt;
      const a = computePliDmi(cs, o);
      const b = ref(cs, o);
      for (let i = 0; i < cs.length; i++) {
        assert(eq(a.upper[i], b.upper[i]) && eq(a.lower[i], b.lower[i]) && eq(a.med[i], b.med[i]), `bands i ${i}`);
        assert(eq(a.diP[i], b.diP[i]) && eq(a.diM[i], b.diM[i]) && eq(a.adx[i], b.adx[i]), `dmi ${JSON.stringify(v)} i ${i}: ${a.adx[i]} vs ${b.adx[i]}`);
        assert((a.dir[i] ?? NaN) === b.dir[i] || (a.dir[i] == null && Number.isNaN(b.dir[i]!)), `dir i ${i}`);
      }
      for (const c of CONDS) {
        const got = a.sig[c].flatMap((x, i) => (x ? [i] : []));
        assert(got.join() === b.sig[c].join(), `sig ${c} ${JSON.stringify(v)} seed ${sd}: ${got.join()} vs ${b.sig[c].join()}`);
        tally[c] += got.length;
      }
      const lbl = a.pivots.map((p) => `${p.label}@${p.bar}:${p.price}`).sort();
      assert(lbl.join("|") === b.labels.join("|"), `labels ${JSON.stringify(v)} seed ${sd}`);
      tally.lateComb += a.events.filter((e) => e.cond.startsWith("comb") && !a.sig[e.cond === "comb_top" ? "core_top" : "core_bot"][e.at]).length;
      tally.weak += a.pivots.filter((p) => p.label === "t" || p.label === "d").length;
      tally.pivots += a.pivots.length;
      runs++;
    }
  }
  for (const c of CONDS) assert(tally[c]! > 0, `no ${c} events in test data`);
  assert(tally.lateComb > 0, "late (core-first) combination never exercised");

  // 2) loop-free trackers reproduce the user's backward-loop pivots
  let loopPiv = 0;
  for (let sd = 1; sd <= 60; sd++) {
    const cs = synth(1200, sd * 17 + 3, sd % 3);
    const a = computePliDmi(cs, { earlySw: 1e9 });
    const want = loopPivots(cs, a.topCore, a.botCore, a.diP, a.diM);
    const got = a.pivots.map((p) => `${p.label}@${p.bar}:${p.price}`);
    assert(got.join("|") === want.join("|"), `loop equivalence seed ${sd}`);
    loopPiv += want.length;
  }

  // 3) causality: signals from truncated history == full run (no lookahead)
  const cs = synth(900, 7 * 31 + 7, 1);
  const full = computePliDmi(cs);
  for (let end = 100; end < cs.length; end += 7) {
    const part = computePliDmi(cs.slice(0, end + 1));
    for (const c of CONDS) assert(part.sig[c][end] === full.sig[c][end], `lookahead ${c} @${end}`);
  }

  // 4) list scan + alarms
  const cfgFor = (conds: PliDmiCond[], extra: Partial<NonNullable<ListScanConfig["pliDmi"]>> = {}): ListScanConfig => ({ pliDmi: { enabled: true, conds, ...extra } });
  let edges = 0;
  for (const c of CONDS) {
    const idx = full.sig[c].flatMap((x, i) => (x && i >= 100 ? [i] : []));
    for (const i of idx.slice(0, 4)) {
      const cut = cs.slice(0, i + 1);
      const hits = scanSymbol(cut, cfgFor([c]), 0);
      assert(hits.length === 1 && hits[0]!.kind === "pliDmi" && hits[0]!.barsAgo === 0, `scan ${c} @${i}`);
      assert(hits[0]!.bias === (c.endsWith("_top") ? "bear" : "bull"), `bias ${c}`);
      assert(hits[0]!.note.startsWith(PLI_DMI_COND_LABEL[c]) && hits[0]!.note.includes("pivot −"), `note ${hits[0]!.note}`);
      assert(alertScanHits(cut, cfgFor([c]), 1).some((h) => h.cond === c), `alarm ${c}`);
      const w = scanSymbol(cs.slice(0, i + 3), cfgFor([c]), 2);
      assert(w.some((h) => h.cond === c && h.barsAgo <= 2), `window ${c}`);
      edges++;
    }
  }
  const def = scanSymbol(cs, cfgFor([]), 900);
  assert(def.length > 0 && def.every((h) => h.cond.startsWith("comb_") || h.cond.startsWith("core_")), "default conds");
  assert(scanSymbol(cs.slice(0, 60), cfgFor(CONDS), 10).length === 0, "min bars");
  const alt = computePliDmi(cs, { earlySw: 0.5, combWin: 8, k: 3, adxMin: 15, dmSrc: "band", useWk: false });
  const altI = alt.sig.core_top.lastIndexOf(1);
  if (altI > 100) assert(scanSymbol(cs.slice(0, altI + 1), cfgFor(["core_top"], { earlySw: 0.5, combWin: 8, k: 3, adxMin: 15, dmSrc: "band", useWk: false }), 0).length === 1, "editable params reach scan");

  // 5) chart indicator
  assert(KIND_TO_INDICATOR.pliDmi === "pliDmiHybrid", "kind → indicator");
  const meta = BUILTIN_META.pliDmiHybrid;
  const inp = (key: string) => meta.inputs.find((i) => i.key === key);
  assert(inp("length")?.default === 50 && inp("k")?.default === 5 && inp("earlySw")?.default === 1.5 && inp("combWin")?.default === 5 && inp("adxMin")?.default === 20, "input defaults");
  assert(inp("sigComb")?.group === "Sinyaller" && inp("lineZigzag")?.group === "Çizgiler" && inp("lineMedian")?.default === 0, "toggles");
  const params = indicatorParamsFromConfig("pliDmi", cfgFor(DEFAULT_CONDS()));
  const run = (p: Record<string, number | string>) => computeBuiltin({ id: "t-pd", type: "pliDmiHybrid", name: "pd", params: p, visible: true } as unknown as IndicatorInstance, cs);
  const plots = run(params);
  const by = (k: string, pl = plots) => pl.find((x) => x.seriesKey === k);
  for (const k of ["upper", "lower", "zigzag"]) assert(by(k)?.pane === "main", `${k} main`);
  for (const k of ["diP", "diM", "adx", "yonlu", "adxMin"]) assert(by(k)?.pane === "sub", `${k} sub`);
  assert(!by("med"), "median off by default");
  assert(by("yonlu")!.type === "histogram", "yonlu columns");
  const topTexts = (by("upper")!.markers ?? []).map((m) => m.text);
  const botTexts = (by("lower")!.markers ?? []).map((m) => m.text);
  const alive = full.pivots;
  assert(topTexts.length === alive.filter((p) => p.top).length && botTexts.length === alive.filter((p) => !p.top).length, "pivot markers = labels");
  assert(topTexts.every((t) => t.startsWith("T") || t === "t") && botTexts.every((t) => t.startsWith("D") || t === "d"), "marker sides");
  assert((by("adx")!.markers ?? []).length === full.adxTurnDn.filter(Boolean).length, "ADX peak dots");
  const onlyComb = run({ ...params, sigCore: 0, sigEarly: 0, sigWeak: 0 });
  assert([...(by("upper", onlyComb)!.markers ?? []), ...(by("lower", onlyComb)!.markers ?? [])].every((m) => m.text.endsWith("!!")), "signal toggles");
  const bare = run({ ...params, lineUpper: 0, lineLower: 0, lineZigzag: 0, lineDiP: 0, lineDiM: 0, lineYonlu: 0, lineAdxMin: 0 });
  const visible = bare.filter((x) => x.color !== "rgba(0,0,0,0)");
  assert(visible.map((x) => x.seriesKey).join() === "adx", `line toggles: ${visible.map((x) => x.seriesKey).join()}`);
  const carrier = bare.filter((x) => x.color === "rgba(0,0,0,0)");
  assert(carrier.length === 1 && carrier[0]!.pane === "main" && (carrier[0]!.markers ?? []).length === alive.length, "pivot markers kept on transparent carrier");
  const yv = by("yonlu")!.data.find((d) => "value" in d) as { value: number };
  const firstY = full.yonlu.find((v) => v != null)!;
  assert(Math.abs(yv.value - firstY * 100) < 1e-9, "yonlu scaled ×100");

  console.log(
    `pliDmi: ${runs} reference runs ok · events ${JSON.stringify(tally)} · loop-equivalence ${loopPiv} pivots/60 series · ${edges} scan+alarm edges`
  );
  console.log("OK");
}
function DEFAULT_CONDS(): PliDmiCond[] {
  return ["comb_top", "comb_bot", "core_top", "core_bot"];
}

main();
