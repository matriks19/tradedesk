/**
 * Smoke: synthetic bullish IFVG (+ optional sweep) → AL with entry/stop/tp.
 * Also runs detector on a cached BIST series if present (any TF).
 * Run: npx --yes tsx scripts/smoke-inversion-fvg.ts
 */
import fs from "fs";
import path from "path";
import {
  detectInversionFvg,
  passesInversionFvgFilter,
} from "../src/lib/patterns/inversionFvg";
import { detectPatterns } from "../src/lib/patterns/detect";
import type { Candle } from "../src/lib/types";

function c(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000
): Candle {
  return {
    time: 1_700_000_000 + i * 3600,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Bullish IFVG path:
 * - Warmup downtrend + bearish FVG (resistance)
 * - Optional liquidity sweep below swing low
 * - Inversion close above FVG top
 * - Retest into IFVG zone → AL
 */
function buildBullIfvg(withSweep: boolean): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 25; i++) {
    const px = 112 - i * 0.3;
    out.push(c(i, px + 0.1, px + 0.5, px - 0.4, px - 0.05, 900));
  }
  out.push(c(25, 104.5, 104.8, 103.5, 103.8, 1100));
  out.push(c(26, 103.8, 105.2, 103.7, 104.9, 1000));
  out.push(c(27, 104.9, 105.0, 104.2, 104.4, 950));
  out.push(c(28, 104.4, 104.6, 103.9, 104.0, 950));
  out.push(c(29, 104.0, 104.2, 102.8, 103.0, 1000));
  for (let i = 30; i < 40; i++) {
    const px = 102.8 - (i - 30) * 0.28;
    out.push(c(i, px + 0.1, px + 0.35, px - 0.25, px - 0.05, 950));
  }
  // Bearish FVG at i=42: top=99.2 bot=97.7
  out[40] = c(40, 99.5, 99.8, 99.2, 99.3, 1000);
  out.push(c(41, 99.0, 99.1, 97.5, 97.8, 1200));
  out.push(c(42, 97.6, 97.7, 96.9, 97.0, 1300));

  let i = 43;
  if (withSweep) {
    // Prior swing low at 36 (before FVG), then sweep wick (close still below FVG top)
    out[36] = c(36, 100.5, 100.8, 99.5, 99.7, 1000);
    out[37] = c(37, 99.7, 100.4, 99.6, 100.2, 950);
    out[38] = c(38, 100.2, 100.3, 99.7, 99.8, 950);
    out[39] = c(39, 99.8, 100.0, 99.4, 99.5, 950);
    // Sweep only: low < 99.5, close > 99.5, but close <= FVG top 99.2? Impossible.
    // So: close back above swing (99.5) OR use localMin path with close above localMin but below FVG top.
    // Use swing at 38-area via localMin: plant swing low 98.2 at bar 35, FVG stays, sweep wick 97.9 close 98.5 (<99.2)
    out[35] = c(35, 101.2, 101.4, 100.8, 101.0, 950);
    out[36] = c(36, 101.0, 101.1, 98.2, 98.5, 1100); // swing low 98.2
    out[37] = c(37, 98.5, 99.2, 98.4, 99.0, 1000);
    out[38] = c(38, 99.0, 99.3, 98.8, 99.1, 950);
    out[39] = c(39, 99.1, 99.5, 99.0, 99.3, 950);
    // Rebuild FVG after plant (c40-42)
    out[40] = c(40, 99.5, 99.8, 99.2, 99.3, 1000);
    out[41] = c(41, 99.0, 99.1, 97.5, 97.8, 1200);
    out[42] = c(42, 97.6, 97.7, 96.9, 97.0, 1300);
    // Sweep bar: wick below 98.2, close back above 98.2 but still under FVG top 99.2
    out.push(c(i, 97.2, 98.8, 97.5, 98.5, 1400)); // low 97.5 < 98.2, close 98.5 > 98.2, close < 99.2
    i++;
  } else {
    out.push(c(i, 97.1, 97.8, 97.05, 97.5, 1100));
    i++;
  }

  out.push(c(i, 97.5, 98.6, 97.4, 98.4, 1500));
  i++;
  out.push(c(i, 98.4, 99.1, 98.3, 98.9, 1600));
  i++;
  // Inversion: close fully above FVG top 99.2
  out.push(c(i, 98.9, 100.8, 98.8, 100.5, 2200));
  i++;

  out.push(c(i, 100.5, 101.2, 100.2, 100.8, 1800));
  i++;
  out.push(c(i, 100.2, 100.4, 98.3, 99.1, 1700));
  i++;
  out.push(c(i, 99.1, 100.5, 99.0, 100.2, 1600));
  i++;
  out.push(c(i, 100.2, 101.0, 99.9, 100.6, 1500));
  return out;
}

function assertBull(label: string, candles: Candle[], expectSweep: boolean) {
  const hits = detectInversionFvg(candles);
  const al =
    hits.find(
      (h) =>
        h.bias === "bull" &&
        h.meta?.fvgBot != null &&
        h.meta.fvgBot >= 97 &&
        h.meta.fvgBot <= 98.5 &&
        (h.meta?.status === "al_tetiklendi" ||
          h.meta?.status === "retest" ||
          h.meta?.status === "inversion")
    ) ??
    hits.find(
      (h) =>
        h.bias === "bull" &&
        (h.meta?.status === "al_tetiklendi" ||
          h.meta?.status === "retest" ||
          h.meta?.status === "inversion")
    );
  if (!al) {
    console.error(
      `FAIL [${label}]: no bull IFVG hit`,
      hits.map((h) => ({
        bias: h.bias,
        status: h.meta?.status,
        score: h.meta?.score,
        sweep: h.meta?.sweep,
        detail: h.detail,
      }))
    );
    process.exit(1);
  }
  if (al.meta?.entry == null || al.meta?.stop == null || al.meta?.tp1 == null) {
    console.error(`FAIL [${label}]: missing entry/stop/tp`, al.meta);
    process.exit(1);
  }
  if (al.meta.stop >= al.meta.entry) {
    console.error(`FAIL [${label}]: stop must be below entry for bull`, al.meta);
    process.exit(1);
  }
  if (expectSweep && !al.meta.sweep) {
    console.error(`FAIL [${label}]: expected sweep=true`, al.meta);
    process.exit(1);
  }
  if (!expectSweep && al.meta.sweep) {
    console.error(`FAIL [${label}]: expected sweep=false`, al.meta);
    process.exit(1);
  }
  const wired = detectPatterns(candles, {
    enable: {
      inversion_fvg: true,
      breakout_fvg_retest: false,
      three_drives: false,
      flag: false,
      pennant: false,
      triangle_asc: false,
      triangle_desc: false,
      triangle_sym: false,
      hh_hl: false,
      lh_ll: false,
      double_top: false,
      double_bottom: false,
      head_shoulders: false,
      inv_head_shoulders: false,
      breakout_box: false,
      engulfing: false,
    },
  }).filter((h) => h.type === "inversion_fvg");
  if (!wired.length) {
    console.error(`FAIL [${label}]: not wired into detectPatterns`);
    process.exit(1);
  }
  console.log(`OK [${label}]`, {
    status: al.meta?.status,
    score: al.meta?.score,
    filterOk: al.meta?.filterOk,
    sweep: al.meta?.sweep,
    fvg: [al.meta?.fvgBot, al.meta?.fvgTop],
    entry: al.meta?.entry,
    stop: al.meta?.stop,
    tp: [al.meta?.tp1, al.meta?.tp2, al.meta?.tp3],
    barsAgo: al.meta?.barsAgo,
    riskR: al.meta?.riskR,
    chochPrice: al.meta?.chochPrice,
    drawings: al.drawings.length,
    wired: wired.length,
    passesFilter: passesInversionFvgFilter(al, 55),
  });
}

assertBull("bull-basic", buildBullIfvg(false), false);
assertBull("bull-sweep", buildBullIfvg(true), true);

const cacheDir = path.join(__dirname, "../data/cache/bist");
const samples = ["THYAO_1h.json", "THYAO_15m.json", "THYAO_1d.json", "GARAN_1d.json"];
for (const name of samples) {
  const fp = path.join(cacheDir, name);
  if (!fs.existsSync(fp)) continue;
  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  const candles: Candle[] = (raw.candles ?? raw) as Candle[];
  if (!Array.isArray(candles) || candles.length < 40) continue;
  const hits = detectInversionFvg(candles);
  const filtered = hits.filter((h) => passesInversionFvgFilter(h, 55));
  console.log(`OK [cache ${name}]`, {
    bars: candles.length,
    hits: hits.length,
    filtered: filtered.length,
    top: filtered[0]
      ? {
          bias: filtered[0].bias,
          status: filtered[0].meta?.status,
          score: filtered[0].meta?.score,
          sweep: filtered[0].meta?.sweep,
          barsAgo: filtered[0].meta?.barsAgo,
        }
      : hits[0]
        ? {
            bias: hits[0].bias,
            status: hits[0].meta?.status,
            score: hits[0].meta?.score,
          }
        : null,
  });
}

console.log("ALL SMOKE PASSED");
