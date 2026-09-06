import type { Candle } from "@/lib/types";
import { rsi, adx } from "@/lib/indicators/math";
import { fibRetrace } from "@/lib/patterns/advanced/draw";
import type { PatternDrawing, PatternHit } from "./types";

const SHT_TYPES = new Set<PatternHit["type"]>([
  "flag",
  "pennant",
  "triangle_asc",
  "triangle_desc",
  "triangle_sym",
]);

const FIB_RETRACE = [0.236, 0.382, 0.5, 0.618, 0.786];
const FIB_EXT = [1.0, 1.272];

export function isShtFlagTriangleType(type: PatternHit["type"]): boolean {
  return SHT_TYPES.has(type);
}

export function passesShtFilter(hit: PatternHit, minScore = 60): boolean {
  if (!isShtFlagTriangleType(hit.type)) return false;
  const m = hit.meta;
  if (!m) return hit.confidence * 100 >= minScore;
  return Boolean(m.filterOk) || m.score >= minScore;
}

function kindOf(type: PatternHit["type"]): "flag" | "pennant" | "triangle" {
  if (type === "flag") return "flag";
  if (type === "pennant") return "pennant";
  return "triangle";
}

function idxAtTime(candles: Candle[], t: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const d = Math.abs(candles[i].time - t);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

function lastFinite(arr: (number | null)[]): number | undefined {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return undefined;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Open approximation of SHT FLAMA ÜÇGEN quality overlay.
 * Does not copy closed-source Pine — measured-move + fib + RSI/ADX heuristics only.
 */
export function enrichFlagTriangle(
  candles: Candle[],
  hit: PatternHit
): PatternHit {
  if (!isShtFlagTriangleType(hit.type) || candles.length < 20) return hit;

  const last = candles[candles.length - 1];
  const iStart = idxAtTime(candles, hit.tStart);
  const iEnd = Math.max(iStart + 4, idxAtTime(candles, hit.tEnd));
  const span = Math.max(8, iEnd - iStart);

  // Pole ≈ first ~45% of pattern span; consolidation = remainder (causal window)
  const poleLen = Math.max(4, Math.floor(span * 0.45));
  const poleStart = iStart;
  const poleEnd = Math.min(candles.length - 4, poleStart + poleLen);
  const consStart = poleEnd;
  // Exclude last bar from consolidation so breakout close is causal
  const consEnd = Math.min(
    candles.length - 2,
    Math.max(consStart + 3, Math.min(iEnd, candles.length - 2))
  );

  const poleSlice = candles.slice(poleStart, poleEnd + 1);
  const consSlice = candles.slice(consStart, consEnd + 1);
  if (poleSlice.length < 3 || consSlice.length < 2) return hit;

  const poleHigh = Math.max(...poleSlice.map((c) => c.high));
  const poleLow = Math.min(...poleSlice.map((c) => c.low));
  const poleRange = Math.max(1e-12, poleHigh - poleLow);
  const poleMove = poleSlice[poleSlice.length - 1].close - poleSlice[0].close;
  const bullBias =
    hit.bias === "bull" || (hit.bias === "neutral" && poleMove >= 0);

  const consHigh = Math.max(...consSlice.map((c) => c.high));
  const consLow = Math.min(...consSlice.map((c) => c.low));
  const consRange = Math.max(1e-12, consHigh - consLow);
  const firstConsRange = Math.max(
    1e-12,
    consSlice[0].high - consSlice[0].low
  );

  // Contraction: tighter vs pole (and vs first cons bar) → lower %
  const contractionVsPole = (consRange / poleRange) * 100;
  const contractionVsFirst = (consRange / firstConsRange) * 100;
  const contractionPct = clamp(
    Math.min(contractionVsPole, contractionVsFirst * 0.85),
    1,
    200
  );

  const breakoutUp = last.close > consHigh;
  const breakoutDn = last.close < consLow;
  const status: "olusum" | "kirilim" =
    (bullBias && breakoutUp) || (!bullBias && breakoutDn)
      ? "kirilim"
      : "olusum";

  const breakoutPrice =
    status === "kirilim"
      ? bullBias
        ? consHigh
        : consLow
      : undefined;

  const poleHeight = poleRange;
  const targetPrice =
    status === "kirilim" && breakoutPrice != null
      ? bullBias
        ? breakoutPrice + poleHeight
        : breakoutPrice - poleHeight
      : bullBias
        ? consHigh + poleHeight
        : consLow - poleHeight;

  // Fibs: pole start→end range (directional), plus extensions toward target
  const fibOrigin = bullBias ? poleLow : poleHigh;
  const fibDest = bullBias ? poleHigh : poleLow;
  const fibs: { level: number; price: number }[] = [];
  for (const lv of FIB_RETRACE) {
    fibs.push({ level: lv, price: fibRetrace(fibOrigin, fibDest, lv) });
  }
  // Also mark cons range mid fibs for structure reading
  for (const lv of [0.382, 0.5, 0.618]) {
    const p = consLow + (consHigh - consLow) * lv;
    if (!fibs.some((f) => Math.abs(f.price - p) / p < 0.001)) {
      fibs.push({ level: lv, price: p });
    }
  }
  for (const lv of FIB_EXT) {
    // Classic measured move extensions from breakout (or cons edge)
    const measured =
      breakoutPrice != null
        ? bullBias
          ? breakoutPrice + poleHeight * lv
          : breakoutPrice - poleHeight * lv
        : bullBias
          ? consHigh + poleHeight * lv
          : consLow - poleHeight * lv;
    fibs.push({ level: lv, price: measured });
  }

  const closes = candles.map((c) => c.close);
  const rsiArr = rsi(closes, 14);
  const adxPack = adx(candles, 14);
  const rsiVal = lastFinite(rsiArr);
  const adxVal = lastFinite(adxPack.adx);

  // Score 0–100: contraction tightness + pole strength + ADX + breakout + structure
  const tightScore = clamp(100 - contractionPct * 1.2, 0, 100); // lower contraction → higher
  const polePct = (poleRange / Math.max(1e-12, poleSlice[0].close)) * 100;
  const poleScore = clamp(polePct * 12, 0, 100); // ~8% pole → ~96
  const adxScore = adxVal != null ? clamp(((adxVal - 10) / 30) * 100, 0, 100) : 40;
  const breakoutScore = status === "kirilim" ? 90 : 35;
  const structureScore = clamp(hit.confidence * 100, 0, 100);
  const score = Math.round(
    clamp(
      tightScore * 0.28 +
        poleScore * 0.22 +
        adxScore * 0.18 +
        breakoutScore * 0.18 +
        structureScore * 0.14,
      0,
      100
    )
  );

  // filterOk: bull RSI>50 ADX>20 and (kirilim or strong contraction); mirror for bear
  const contractionStrong = contractionPct <= 45;
  let filterOk = false;
  if (rsiVal != null && adxVal != null) {
    if (bullBias) {
      filterOk =
        rsiVal > 50 &&
        adxVal > 20 &&
        (status === "kirilim" || contractionStrong);
    } else {
      filterOk =
        rsiVal < 50 &&
        adxVal > 20 &&
        (status === "kirilim" || contractionStrong);
    }
  } else {
    filterOk = status === "kirilim" || (contractionStrong && score >= 55);
  }

  const t1 = candles[consStart].time;
  const t2 = last.time;
  const color = bullBias ? "#26a69a" : "#ef5350";
  const extra: PatternDrawing[] = [];

  // Fib hlines
  for (const f of fibs) {
    if (!Number.isFinite(f.price)) continue;
    const isExt = f.level >= 1;
    extra.push({
      id: uid("fib"),
      kind: "hline",
      t1,
      t2,
      price1: f.price,
      price2: f.price,
      color: isExt ? "#ab47bc" : "#78909c",
      label: `Fib ${f.level}`,
      dashed: true,
      lineWidth: 1,
    });
  }

  // Target
  if (Number.isFinite(targetPrice)) {
    extra.push({
      id: uid("tgt"),
      kind: "hline",
      t1,
      t2: t2 + Math.max(1, (t2 - t1) || 1),
      price1: targetPrice,
      price2: targetPrice,
      color: "#ffb74d",
      label: `FLAMA HEDEFİ: ${fmtPx(targetPrice)}`,
      dashed: false,
      lineWidth: 2,
    });
    extra.push({
      id: uid("tgtlb"),
      kind: "label",
      t1: t2,
      price1: targetPrice,
      label: `FLAMA HEDEFİ: ${fmtPx(targetPrice)}`,
      color: "#ffb74d",
    });
  }

  if (breakoutPrice != null) {
    extra.push({
      id: uid("bo"),
      kind: "hline",
      t1,
      t2,
      price1: breakoutPrice,
      price2: breakoutPrice,
      color,
      label: "Kırılım",
      dashed: true,
      lineWidth: 1,
    });
  }

  // Status marker
  extra.push({
    id: uid("st"),
    kind: "label",
    t1: t2,
    price1: last.close,
    label:
      status === "kirilim"
        ? `KIRILIM · Skor ${score}`
        : `Oluşum · Skor ${score}`,
    color,
  });

  const meta: NonNullable<PatternHit["meta"]> = {
    status,
    score,
    contractionPct: Math.round(contractionPct * 10) / 10,
    breakoutPrice,
    targetPrice,
    rsi: rsiVal != null ? Math.round(rsiVal * 10) / 10 : undefined,
    adx: adxVal != null ? Math.round(adxVal * 10) / 10 : undefined,
    filterOk,
    fibs,
    kind: kindOf(hit.type),
  };

  return {
    ...hit,
    confidence: Math.max(hit.confidence, score / 100),
    detail:
      status === "kirilim"
        ? `KIRILIM · skor ${score} · daralma %${meta.contractionPct}` +
          (targetPrice != null ? ` · hedef ${fmtPx(targetPrice)}` : "")
        : `Oluşum · skor ${score} · daralma %${meta.contractionPct}`,
    drawings: [...hit.drawings, ...extra],
    meta,
  };
}

export function enrichFlagTriangleHits(
  candles: Candle[],
  hits: PatternHit[]
): PatternHit[] {
  return hits.map((h) =>
    isShtFlagTriangleType(h.type) ? enrichFlagTriangle(candles, h) : h
  );
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}
