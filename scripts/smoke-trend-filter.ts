/**
 * Unit smoke: Liste "Trend filtresi (4s EMA200)" (synthetic data).
 *  - effective period per TF (200·240/tfMin below 4h), fetch limits, crypto-only applicability
 *  - scanSymbol: bull hits need close > EMA, bear hits only with `bear`, neutral untouched,
 *    < period bars → no filtering, filter applied before "Hepsi" (all) check
 *  - alarm path (alertScanHits / checkScanAlert) uses the same payload → same result
 * Run: npx --yes tsx scripts/smoke-trend-filter.ts
 */
import { readFileSync } from "node:fs";
import type { Candle } from "../src/lib/types";
import { tfMinutes, trendEmaPeriod, trendFilterFetchLimit, trendFilterApplies, passesTrend, lastClosedHtfIndex, needsHtfTrend, HTF_SEC } from "../src/lib/scanner/trendFilter";
import { scanSymbol, alertScanHits, ALL_PPO_DSI_Z_CONDS, ALL_PLI_DT_DIV_CONDS, type ListScanConfig, type ListScanHit } from "../src/lib/scanner/listScan";
import { checkScanAlert } from "../src/lib/alerts/scanAlert";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

// ── 1) periods / limits / applicability ────────────────────────────────────
const P: Record<string, number> = { "15m": 3200, "30m": 1600, "1h": 800, "2h": 400, "3h": 267, "4h": 200, "6h": 200, "1d": 200, "1w": 200, "90m": 533 };
for (const [tf, p] of Object.entries(P)) assert(trendEmaPeriod(tf) === p, `period ${tf} → ${trendEmaPeriod(tf)}`);
assert(tfMinutes("2h") === 120 && tfMinutes("1d") === 1440 && tfMinutes("garbage") === 240, "tfMinutes");
assert(trendFilterFetchLimit(200) === 300 && trendFilterFetchLimit(400) === 500 && trendFilterFetchLimit(800) === 1000 && trendFilterFetchLimit(1600) === 0 && trendFilterFetchLimit(3200) === 0, "fetch limits");
assert(trendFilterApplies("BTCUSDT", "binance") && trendFilterApplies("ETHUSDT.P", "binance"), "crypto applies");
assert(!trendFilterApplies("THYAO", "bist") && !trendFilterApplies("BTCUSDT", "bist"), "BIST excluded");
assert(!trendFilterApplies("AAPLUSDT.P", "binance") && !trendFilterApplies("AAPLUSDT", "binance"), "TradFi snapshot excluded");
assert(!trendFilterApplies("NEWSTOCKUSDT", "binance", ["NEWSTOCKUSDT.P"]), "live TradFi list excluded");
console.log("periods/limits/applicability OK");

// ── synthetic data: long up-trend, then down-trend, then chop ───────────────
function gen(seed: number, n: number): Candle[] {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: Candle[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    const drift = i < n * 0.4 ? 0.004 : i < n * 0.75 ? -0.005 : 0;
    const o = p;
    p = Math.max(1, p * (1 + drift + (rnd() - 0.5) * 0.04));
    out.push({ time: 1_700_000_000 + i * 14400, open: o, high: Math.max(o, p) * (1 + rnd() * 0.01), low: Math.min(o, p) * (1 - rnd() * 0.01), close: p, volume: 1 });
  }
  return out;
}
/** independent Pine ta.ema (SMA seed) */
function refEma(v: number[], len: number): number[] {
  const out: number[] = [];
  const a = 2 / (len + 1);
  for (let i = 0; i < v.length; i++) {
    if (i < len - 1) { out.push(NaN); continue; }
    if (i === len - 1) { out.push(v.slice(0, len).reduce((x, y) => x + y, 0) / len); continue; }
    out.push(a * v[i]! + (1 - a) * out[i - 1]!);
  }
  return out;
}
const key = (h: ListScanHit) => `${h.kind}|${h.cond}|${h.barsAgo}`;
const expectFiltered = (cs: Candle[], hits: ListScanHit[], period: number, bear: boolean) => {
  if (cs.length < period) return hits;
  const e = refEma(cs.map((c) => c.close), period);
  return hits.filter((h) => {
    if (h.bias === "neutral" || (h.bias === "bear" && !bear)) return true;
    const i = cs.length - 1 - h.barsAgo;
    const c = cs[i]!.close;
    if (Number.isNaN(e[i]!)) return true;
    return h.bias === "bull" ? c > e[i]! : c < e[i]!;
  });
};

// Hit-rich config: every PPO-DSI-Z chip (bull/bear/neutral) + PLI-DT chips; per-cond latest edge
// → scan each cut bar with maxBars 0 so every signal is examined on its own bar.
const base: ListScanConfig = {
  matchMode: "any",
  ppoDsiZ: { enabled: true, conds: [...ALL_PPO_DSI_Z_CONDS] },
  pliDtDiv: { enabled: true, conds: [...ALL_PLI_DT_DIV_CONDS] },
} as ListScanConfig;

(async () => {
  let removedBull = 0, keptBull = 0, removedBear = 0, keptNeutral = 0, total = 0;
  for (const seed of [11, 22, 33]) {
    const cs = gen(seed, 900);
    for (let end = 260; end <= cs.length; end += 2) {
      const cut = cs.slice(0, end);
      const raw = scanSymbol(cut, base, 0);
      if (!raw.length) continue;
      total += raw.length;
      for (const bear of [false, true]) {
        const cfg = { ...base, trendFilter: { enabled: true, bear, period: 200 } } as ListScanConfig;
        const got = scanSymbol(cut, cfg, 0).map(key).sort();
        const exp = expectFiltered(cut, raw, 200, bear).map(key).sort();
        assert(JSON.stringify(got) === JSON.stringify(exp), `filter seed ${seed} end ${end} bear ${bear}: ${got} vs ${exp}`);
        // alarm path: same payload → same (≤1 bar) hits
        const al = alertScanHits(cut, cfg, 1).map(key).sort();
        const sc = scanSymbol(cut, cfg, 1).filter((h) => h.barsAgo <= 1);
        const alExp = alertScanHits(cut, base, 1).filter((h) => sc.some((x) => key(x) === key(h))).map(key).sort();
        assert(JSON.stringify(al) === JSON.stringify(alExp), `alarm parity seed ${seed} end ${end}`);
        const ca = await checkScanAlert(cut, "list_scan", cfg as unknown as Record<string, unknown>);
        assert(ca.ok === al.length > 0, `checkScanAlert parity seed ${seed} end ${end}`);
        if (!bear) {
          const gs = new Set(got);
          for (const h of raw) {
            if (h.bias === "bull") gs.has(key(h)) ? keptBull++ : removedBull++;
            if (h.bias === "bear") assert(gs.has(key(h)), "bear kept when SAT filter off");
            if (h.bias === "neutral") { assert(gs.has(key(h)), "neutral never filtered"); keptNeutral++; }
          }
        } else {
          const gs = new Set(got);
          for (const h of raw) if (h.bias === "bear" && !gs.has(key(h))) removedBear++;
        }
      }
    }
  }
  assert(removedBull > 0 && keptBull > 0 && removedBear > 0 && keptNeutral > 0, `coverage bull −${removedBull}/+${keptBull} bear −${removedBear} neutral ${keptNeutral}`);
  console.log(`scan filter OK (hits ${total}; bull removed ${removedBull} kept ${keptBull}; bear removed ${removedBear} with SAT on; neutral kept ${keptNeutral})`);

  // < period bars → no filtering (EMA800 on 700 bars)
  {
    const cs = gen(5, 700);
    const raw = scanSymbol(cs, base, 400).map(key).sort();
    const f = scanSymbol(cs, { ...base, trendFilter: { enabled: true, bear: true, period: 800 } } as ListScanConfig, 400).map(key).sort();
    assert(raw.length > 0 && JSON.stringify(raw) === JSON.stringify(f), "< period → unfiltered");
    const off = scanSymbol(cs, { ...base, trendFilter: { enabled: false, bear: true, period: 200 } } as ListScanConfig, 400).map(key).sort();
    assert(JSON.stringify(raw) === JSON.stringify(off), "disabled → unchanged");
    console.log("insufficient bars / disabled OK");
  }

  // "Hepsi": a kind whose only hits are filtered out must fail the all-check
  {
    const cs = gen(22, 900);
    let checked = 0;
    for (let end = 400; end <= cs.length && checked < 50; end++) {
      const cut = cs.slice(0, end);
      const cfgAll = { ...base, matchMode: "all" } as ListScanConfig;
      const f = { ...cfgAll, trendFilter: { enabled: true, bear: true, period: 200 } } as ListScanConfig;
      const perKind = (k: "ppoDsiZ" | "pliDtDiv") =>
        scanSymbol(cut, { ...base, trendFilter: f.trendFilter, [k === "ppoDsiZ" ? "pliDtDiv" : "ppoDsiZ"]: undefined } as ListScanConfig, 3).length;
      const expectAny = perKind("ppoDsiZ") > 0 && perKind("pliDtDiv") > 0;
      assert((scanSymbol(cut, f, 3).length > 0) === expectAny, `all-mode after filter end ${end}`);
      checked++;
    }
    console.log("Hepsi (all) after filter OK");
  }

  // passesTrend edge cases
  {
    const cs = gen(1, 10);
    assert(passesTrend(cs, null, "bull", 0, true), "null ema → keep");
    const es = cs.map(() => null as number | null);
    assert(passesTrend(cs, es, "bull", 0, true), "null point → keep");
  }

  // ── 4s EMA200 fallback (15m: EMA3200 > fetched bars) + no-lookahead ─────────
  {
    const H = HTF_SEC, M15 = 900;
    assert(needsHtfTrend(15, 3200, 1000) && needsHtfTrend(60, 800, 700) && !needsHtfTrend(60, 800, 1000) && !needsHtfTrend(240, 200, 50), "needsHtfTrend");
    // boundary: 4h bar [T, T+4h) is closed for a signal bar closing exactly at T+4h, not before
    const T0 = 1_699_999_200 - (1_699_999_200 % H);
    const mk = (t: number, c: number): Candle => ({ time: t, open: c, high: c, low: c, close: c, volume: 1 });
    const h3 = [mk(T0, 1), mk(T0 + H, 2), mk(T0 + 2 * H, 3)];
    assert(lastClosedHtfIndex(h3, T0 + H) === 0 && lastClosedHtfIndex(h3, T0 + H - 1) === -1 && lastClosedHtfIndex(h3, T0 + 2 * H + 899) === 1 && lastClosedHtfIndex(h3, T0 + 3 * H) === 2, "lastClosedHtfIndex boundaries");

    let s2 = 777;
    const rnd = () => ((s2 = (s2 * 1664525 + 1013904223) >>> 0) / 4294967296);
    let checkedSig = 0, removed = 0, kept = 0;
    for (const seed of [3, 4]) {
      const htf: Candle[] = [];
      let p4 = 100;
      for (let k = 0; k < 300; k++) {
        const o = p4;
        p4 = Math.max(1, p4 * (1 + (k < 150 ? 0.003 : -0.003) * (seed === 3 ? 1 : -1) + (rnd() - 0.5) * 0.03));
        htf.push({ time: T0 + k * H, open: o, high: Math.max(o, p4), low: Math.min(o, p4), close: p4, volume: 1 });
      }
      const m15 = gen(seed, 600).map((c, i) => ({ ...c, time: T0 + 262 * H + i * M15 }));
      // last 15m bar lies inside the (forming) last 4h bar
      assert(m15[m15.length - 1]!.time < htf[299]!.time + H, "setup");
      const e4 = refEma(htf.map((c) => c.close), 200);
      const refAt = (sigClose: number) => {
        let j = -1;
        for (let k = 0; k < htf.length; k++) if (htf[k]!.time + H <= sigClose) j = k;
        return j >= 0 ? e4[j]! : NaN;
      };
      for (let end = 260; end <= m15.length; end += 3) {
        const cut = m15.slice(0, end);
        const raw = scanSymbol(cut, base, 0);
        if (!raw.length) continue;
        const tfc = { enabled: true, bear: true, period: 3200, tfMin: 15, htf };
        const got = scanSymbol(cut, { ...base, trendFilter: tfc } as ListScanConfig, 0).map(key).sort();
        const exp = raw.filter((h) => {
          if (h.bias === "neutral") return true;
          const i = cut.length - 1 - h.barsAgo;
          const e = refAt(cut[i]!.time + M15);
          if (Number.isNaN(e)) return true;
          return h.bias === "bull" ? cut[i]!.close > e : cut[i]!.close < e;
        });
        assert(JSON.stringify(got) === JSON.stringify(exp.map(key).sort()), `4h fallback seed ${seed} end ${end}`);
        checkedSig += raw.length;
        removed += raw.length - exp.length;
        kept += exp.length;
        // no lookahead: rewrite every 4h bar not yet closed at the scan's last bar close → same result
        const lastClose = cut[cut.length - 1]!.time + M15;
        const future = htf.map((c) => (c.time + H > lastClose ? { ...c, close: c.close * (rnd() < 0.5 ? 0.2 : 5) } : c));
        const got2 = scanSymbol(cut, { ...base, trendFilter: { ...tfc, htf: future } } as ListScanConfig, 0).map(key).sort();
        assert(JSON.stringify(got2) === JSON.stringify(got), `no lookahead seed ${seed} end ${end}`);
        // alarm path parity with runtime-injected htf
        const cfgA = { ...base, trendFilter: tfc } as ListScanConfig;
        const ca = await checkScanAlert(cut, "list_scan", cfgA as unknown as Record<string, unknown>);
        assert(ca.ok === alertScanHits(cut, cfgA, 1).length > 0, `alarm parity 4h seed ${seed} end ${end}`);
      }
      // too few 4h bars → no filtering; no htf → no filtering
      const cut = m15.slice(0, 500);
      const raw = scanSymbol(cut, base, 300).map(key).sort();
      assert(JSON.stringify(scanSymbol(cut, { ...base, trendFilter: { enabled: true, bear: true, period: 3200, tfMin: 15, htf: htf.slice(0, 150) } } as ListScanConfig, 300).map(key).sort()) === JSON.stringify(raw), "htf < 200 → unfiltered");
      assert(JSON.stringify(scanSymbol(cut, { ...base, trendFilter: { enabled: true, bear: true, period: 3200, tfMin: 15 } } as ListScanConfig, 300).map(key).sort()) === JSON.stringify(raw), "no htf → unfiltered");
    }
    assert(checkedSig > 0 && removed > 0 && kept > 0, `4h coverage ${checkedSig}/${removed}/${kept}`);
    console.log(`4h EMA200 fallback + no-lookahead OK (signals ${checkedSig}, removed ${removed}, kept ${kept})`);
  }

  // wiring: default off + persisted, panel + alarms use the same helpers, BIST excluded in UI note
  {
    const lp = readFileSync("src/components/scanner/ListScanPanel.tsx", "utf8");
    const aw = readFileSync("src/components/alerts/AlertWatcher.tsx", "utf8");
    assert(/useState\(false\);\s*const \[trendBear, setTrendBearState\] = useState\(false\)/.test(lp), "defaults off");
    assert(lp.includes('"td.listScan.trendFilter"') && lp.includes('"td.listScan.trendFilterBear"'), "persisted keys");
    assert(lp.includes("Trend filtresi (4s EMA200)") && lp.includes("SAT sinyallerini de filtrele (test edilmedi)"), "labels");
    assert(lp.includes("trendFilterApplies(q.symbol, q.exchange") && lp.includes("trendFilterFetchLimit(trendPeriod)"), "scan wiring");
    assert(lp.includes("withTrend(it.scanPayload") && lp.includes("withTrend(cfg as unknown"), "alarm payload wiring");
    assert(aw.includes("trendFilterFetchLimit(payload.trendFilter.period") && !/from "@\/lib\/scanner\/trendFilter"/.test(aw), "AlertWatcher light helper");
    assert(aw.includes("needsHtfTrend(tfMin") && aw.includes("timeframe=${HTF_TF}&limit=${HTF_FETCH}"), "AlertWatcher 4h fallback");
    assert(lp.includes("needsHtfTrend(scanTfMin, trendPeriod, candles.length)") && lp.includes("htfCache"), "panel 4h fallback + per-scan cache");
    console.log("wiring OK");
  }
  console.log("smoke-trend-filter: ALL OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
