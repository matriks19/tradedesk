import type { Candle } from "@/lib/types";
import type {
  DetectOptions,
  PatternDrawing,
  PatternHit,
  SwingPoint,
} from "./types";
import { findSwings, lastN } from "./swings";
import { enrichFlagTriangleHits } from "./shtFlagTriangle";

const DEFAULTS: Required<DetectOptions> = {
  swingStrength: 2,
  twinTol: 0.015,
  twinMinGap: 5,
  twinMaxGap: 60,
  boxLookback: 30,
  enable: {},
};

function enabled(
  opts: Required<DetectOptions>,
  type: PatternHit["type"]
): boolean {
  const e = opts.enable?.[type];
  return e !== false;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function near(a: number, b: number, tol: number): boolean {
  const mid = (Math.abs(a) + Math.abs(b)) / 2 || 1;
  return Math.abs(a - b) / mid <= tol;
}

function slope(p1: SwingPoint, p2: SwingPoint): number {
  const dt = p2.index - p1.index || 1;
  return (p2.price - p1.price) / dt;
}

function lineAt(p1: SwingPoint, p2: SwingPoint, index: number): number {
  return p1.price + slope(p1, p2) * (index - p1.index);
}

function trendline(
  id: string,
  a: SwingPoint,
  b: SwingPoint,
  color: string,
  label?: string,
  dashed?: boolean
): PatternDrawing {
  return {
    id,
    kind: "trendline",
    t1: a.time,
    price1: a.price,
    t2: b.time,
    price2: b.price,
    color,
    label,
    dashed,
    lineWidth: 2,
  };
}

function box(
  id: string,
  t1: number,
  t2: number,
  lo: number,
  hi: number,
  color: string,
  label?: string
): PatternDrawing {
  return {
    id,
    kind: "box",
    t1,
    price1: lo,
    t2,
    price2: hi,
    color,
    label,
  };
}

function labelDraw(
  id: string,
  t: number,
  price: number,
  text: string,
  color: string
): PatternDrawing {
  return {
    id,
    kind: "label",
    t1: t,
    price1: price,
    label: text,
    color,
  };
}

function hline(
  id: string,
  t1: number,
  t2: number,
  price: number,
  color: string,
  label?: string,
  dashed = true
): PatternDrawing {
  return {
    id,
    kind: "hline",
    t1,
    price1: price,
    t2,
    price2: price,
    color,
    label,
    dashed,
    lineWidth: 1,
  };
}

function marker(
  id: string,
  t: number,
  price: number,
  bias: "bull" | "bear",
  text: string
): PatternDrawing {
  return {
    id,
    kind: "marker",
    t1: t,
    price1: price,
    label: text,
    color: bias === "bull" ? "#26a69a" : "#ef5350",
    position: bias === "bull" ? "belowBar" : "aboveBar",
    shape: bias === "bull" ? "arrowUp" : "arrowDown",
  };
}

/** Main detector — returns ranked pattern hits with drawable geometry */
export function detectPatterns(
  candles: Candle[],
  options: DetectOptions = {}
): PatternHit[] {
  const opts: Required<DetectOptions> = {
    ...DEFAULTS,
    ...options,
    enable: { ...DEFAULTS.enable, ...options.enable },
  };
  if (candles.length < 40) return [];

  const swings = findSwings(candles, opts.swingStrength);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const hits: PatternHit[] = [];

  if (enabled(opts, "hh_hl") || enabled(opts, "lh_ll")) {
    hits.push(...detectStructure(candles, highs, lows, opts));
  }
  if (enabled(opts, "double_top") || enabled(opts, "double_bottom")) {
    hits.push(...detectDouble(candles, highs, lows, opts));
  }
  if (enabled(opts, "head_shoulders") || enabled(opts, "inv_head_shoulders")) {
    hits.push(...detectHS(candles, highs, lows, opts));
  }
  if (
    enabled(opts, "triangle_asc") ||
    enabled(opts, "triangle_desc") ||
    enabled(opts, "triangle_sym")
  ) {
    hits.push(...detectTriangles(candles, highs, lows, opts));
  }
  if (enabled(opts, "flag") || enabled(opts, "pennant")) {
    hits.push(...detectFlagPennant(candles, highs, lows, opts));
  }
  if (enabled(opts, "breakout_box")) {
    hits.push(...detectBreakoutBox(candles, opts));
  }
  if (enabled(opts, "engulfing")) {
    hits.push(...detectEngulfing(candles));
  }

  const enriched = enrichFlagTriangleHits(candles, hits);
  return enriched
    .sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd)
    .slice(0, 24);
}

function detectStructure(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  _opts: Required<DetectOptions>
): PatternHit[] {
  const out: PatternHit[] = [];
  const h = lastN(highs, 4);
  const l = lastN(lows, 4);
  if (h.length < 2 || l.length < 2) return out;
  const h1 = h[h.length - 2];
  const h2 = h[h.length - 1];
  const l1 = l[l.length - 2];
  const l2 = l[l.length - 1];
  const tStart = Math.min(h1.time, l1.time);
  const tEnd = Math.max(h2.time, l2.time, candles[candles.length - 1].time);

  if (h2.price > h1.price && l2.price > l1.price) {
    const id = uid("hhhl");
    out.push({
      id,
      type: "hh_hl",
      label: "YY / YD (HH/HL)",
      detail: "Yükselen tepeler ve dipler — yükseliş yapısı",
      bias: "bull",
      confidence: 0.7,
      tStart,
      tEnd,
      drawings: [
        trendline(`${id}_h`, h1, h2, "#26a69a", "HH"),
        trendline(`${id}_l`, l1, l2, "#26a69a", "HL"),
        labelDraw(`${id}_lb`, h2.time, h2.price, "HH/HL", "#26a69a"),
        marker(`${id}_m`, h2.time, h2.price, "bull", "HH"),
      ],
    });
  } else if (h2.price < h1.price && l2.price < l1.price) {
    const id = uid("lhll");
    out.push({
      id,
      type: "lh_ll",
      label: "AD / AD (LH/LL)",
      detail: "Alçalan tepeler ve dipler — düşüş yapısı",
      bias: "bear",
      confidence: 0.7,
      tStart,
      tEnd,
      drawings: [
        trendline(`${id}_h`, h1, h2, "#ef5350", "LH"),
        trendline(`${id}_l`, l1, l2, "#ef5350", "LL"),
        labelDraw(`${id}_lb`, h2.time, h2.price, "LH/LL", "#ef5350"),
        marker(`${id}_m`, h2.time, h2.price, "bear", "LH"),
      ],
    });
  }
  return out;
}

function detectDouble(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  opts: Required<DetectOptions>
): PatternHit[] {
  const out: PatternHit[] = [];
  const last = candles[candles.length - 1];

  // Double top: two highs near equal, later close below neckline (intervening low)
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      const a = highs[i];
      const b = highs[j];
      const gap = b.index - a.index;
      if (gap < opts.twinMinGap || gap > opts.twinMaxGap) continue;
      if (!near(a.price, b.price, opts.twinTol)) continue;
      const midLows = lows.filter((x) => x.index > a.index && x.index < b.index);
      if (!midLows.length) continue;
      const neck = midLows.reduce((m, x) => (x.price < m.price ? x : m));
      const peak = Math.max(a.price, b.price);
      const depth = (peak - neck.price) / peak;
      if (depth < 0.008) continue;
      const broken = last.close < neck.price;
      const conf = Math.min(0.95, 0.55 + depth * 8 + (broken ? 0.15 : 0));
      const id = uid("dt");
      out.push({
        id,
        type: "double_top",
        label: "Çift Tepe",
        detail: broken
          ? `Boyun (${neck.price.toPrecision(6)}) kırıldı`
          : `Boyun çizgisi ${neck.price.toPrecision(6)}`,
        bias: "bear",
        confidence: conf,
        tStart: a.time,
        tEnd: last.time,
        drawings: [
          trendline(`${id}_tops`, a, b, "#ef5350", "Çift Tepe"),
          hline(`${id}_neck`, a.time, last.time, neck.price, "#ffb74d", "Boyun"),
          box(
            `${id}_box`,
            a.time,
            b.time,
            neck.price,
            peak,
            "rgba(239,83,80,0.12)",
            "DT"
          ),
          marker(`${id}_m1`, a.time, a.price, "bear", "T1"),
          marker(`${id}_m2`, b.time, b.price, "bear", "T2"),
          labelDraw(`${id}_lb`, b.time, peak, "Çift Tepe", "#ef5350"),
        ],
      });
    }
  }

  // Double bottom
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const a = lows[i];
      const b = lows[j];
      const gap = b.index - a.index;
      if (gap < opts.twinMinGap || gap > opts.twinMaxGap) continue;
      if (!near(a.price, b.price, opts.twinTol)) continue;
      const midHighs = highs.filter(
        (x) => x.index > a.index && x.index < b.index
      );
      if (!midHighs.length) continue;
      const neck = midHighs.reduce((m, x) => (x.price > m.price ? x : m));
      const trough = Math.min(a.price, b.price);
      const depth = (neck.price - trough) / neck.price;
      if (depth < 0.008) continue;
      const broken = last.close > neck.price;
      const conf = Math.min(0.95, 0.55 + depth * 8 + (broken ? 0.15 : 0));
      const id = uid("db");
      out.push({
        id,
        type: "double_bottom",
        label: "Çift Dip",
        detail: broken
          ? `Boyun (${neck.price.toPrecision(6)}) kırıldı`
          : `Boyun çizgisi ${neck.price.toPrecision(6)}`,
        bias: "bull",
        confidence: conf,
        tStart: a.time,
        tEnd: last.time,
        drawings: [
          trendline(`${id}_bots`, a, b, "#26a69a", "Çift Dip"),
          hline(`${id}_neck`, a.time, last.time, neck.price, "#ffb74d", "Boyun"),
          box(
            `${id}_box`,
            a.time,
            b.time,
            trough,
            neck.price,
            "rgba(38,166,154,0.12)",
            "DB"
          ),
          marker(`${id}_m1`, a.time, a.price, "bull", "D1"),
          marker(`${id}_m2`, b.time, b.price, "bull", "D2"),
          labelDraw(`${id}_lb`, b.time, trough, "Çift Dip", "#26a69a"),
        ],
      });
    }
  }

  // keep most recent / confident per type
  return dedupeByType(out, ["double_top", "double_bottom"]);
}

function detectHS(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  opts: Required<DetectOptions>
): PatternHit[] {
  const out: PatternHit[] = [];
  const last = candles[candles.length - 1];

  // Classic H&S on highs: L < H > R, L≈R, head highest
  for (let i = 0; i < highs.length - 2; i++) {
    const ls = highs[i];
    const head = highs[i + 1];
    const rs = highs[i + 2];
    if (!(head.price > ls.price && head.price > rs.price)) continue;
    if (!near(ls.price, rs.price, opts.twinTol * 1.5)) continue;
    if (head.index - ls.index < 3 || rs.index - head.index < 3) continue;
    const neckLows = lows.filter(
      (x) => x.index > ls.index && x.index < rs.index
    );
    if (neckLows.length < 2) continue;
    const n1 = neckLows[0];
    const n2 = neckLows[neckLows.length - 1];
    const neckMid = (n1.price + n2.price) / 2;
    const broken = last.close < Math.min(n1.price, n2.price);
    const id = uid("hs");
    out.push({
      id,
      type: "head_shoulders",
      label: "Omuz-Baş-Omuz",
      detail: broken ? "Boyun kırılımı (ayı)" : "OBO oluşumu",
      bias: "bear",
      confidence: broken ? 0.85 : 0.65,
      tStart: ls.time,
      tEnd: last.time,
      drawings: [
        trendline(`${id}_ls_h`, ls, head, "#ef5350"),
        trendline(`${id}_h_rs`, head, rs, "#ef5350"),
        trendline(`${id}_neck`, n1, n2, "#ffb74d", "Boyun", true),
        hline(`${id}_nl`, n1.time, last.time, neckMid, "#ffb74d", "Boyun", true),
        marker(`${id}_ls`, ls.time, ls.price, "bear", "O"),
        marker(`${id}_h`, head.time, head.price, "bear", "B"),
        marker(`${id}_rs`, rs.time, rs.price, "bear", "O"),
        labelDraw(`${id}_lb`, head.time, head.price, "OBO", "#ef5350"),
      ],
    });
  }

  // Inverse H&S on lows
  for (let i = 0; i < lows.length - 2; i++) {
    const ls = lows[i];
    const head = lows[i + 1];
    const rs = lows[i + 2];
    if (!(head.price < ls.price && head.price < rs.price)) continue;
    if (!near(ls.price, rs.price, opts.twinTol * 1.5)) continue;
    if (head.index - ls.index < 3 || rs.index - head.index < 3) continue;
    const neckHighs = highs.filter(
      (x) => x.index > ls.index && x.index < rs.index
    );
    if (neckHighs.length < 2) continue;
    const n1 = neckHighs[0];
    const n2 = neckHighs[neckHighs.length - 1];
    const neckMid = (n1.price + n2.price) / 2;
    const broken = last.close > Math.max(n1.price, n2.price);
    const id = uid("ihs");
    out.push({
      id,
      type: "inv_head_shoulders",
      label: "Ters Omuz-Baş-Omuz",
      detail: broken ? "Boyun kırılımı (boğa)" : "TOBO oluşumu",
      bias: "bull",
      confidence: broken ? 0.85 : 0.65,
      tStart: ls.time,
      tEnd: last.time,
      drawings: [
        trendline(`${id}_ls_h`, ls, head, "#26a69a"),
        trendline(`${id}_h_rs`, head, rs, "#26a69a"),
        trendline(`${id}_neck`, n1, n2, "#ffb74d", "Boyun", true),
        hline(`${id}_nl`, n1.time, last.time, neckMid, "#ffb74d", "Boyun", true),
        marker(`${id}_ls`, ls.time, ls.price, "bull", "O"),
        marker(`${id}_h`, head.time, head.price, "bull", "B"),
        marker(`${id}_rs`, rs.time, rs.price, "bull", "O"),
        labelDraw(`${id}_lb`, head.time, head.price, "TOBO", "#26a69a"),
      ],
    });
  }

  return dedupeByType(out, ["head_shoulders", "inv_head_shoulders"]);
}

function detectTriangles(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  _opts: Required<DetectOptions>
): PatternHit[] {
  const out: PatternHit[] = [];
  const h = lastN(highs, 6);
  const l = lastN(lows, 6);
  if (h.length < 3 || l.length < 3) return out;
  const h1 = h[h.length - 3];
  const h2 = h[h.length - 2];
  const h3 = h[h.length - 1];
  const l1 = l[l.length - 3];
  const l2 = l[l.length - 2];
  const l3 = l[l.length - 1];
  const sh = slope(h1, h3);
  const sl = slope(l1, l3);
  const last = candles[candles.length - 1];
  const tStart = Math.min(h1.time, l1.time);
  const flatTol = Math.abs(h1.price) * 0.0012;

  // Ascending: flat/rising highs slight, rising lows
  if (sl > 0 && Math.abs(sh) < flatTol * 3 && h3.price >= h1.price * 0.992) {
    const res = Math.max(h1.price, h2.price, h3.price);
    const broken = last.close > res;
    const id = uid("ta");
    out.push({
      id,
      type: "triangle_asc",
      label: "Yükselen Üçgen",
      detail: broken
        ? "Direnç kırılımı (boğa)"
        : "Yatay direnç + yükselen destek",
      bias: "bull",
      confidence: broken ? 0.78 : 0.64,
      tStart,
      tEnd: last.time,
      drawings: [
        trendline(`${id}_res`, h1, h3, "#ef5350", "Direnç", true),
        trendline(`${id}_sup`, l1, l3, "#26a69a", "Destek"),
        labelDraw(
          `${id}_lb`,
          h3.time,
          h3.price,
          broken ? "↑ Üçgen KIRILIM" : "↑ Üçgen",
          "#26a69a"
        ),
      ],
    });
  }

  // Descending: falling highs, flat lows
  if (sh < 0 && Math.abs(sl) < flatTol * 3 && l3.price <= l1.price * 1.008) {
    const sup = Math.min(l1.price, l2.price, l3.price);
    const broken = last.close < sup;
    const id = uid("td");
    out.push({
      id,
      type: "triangle_desc",
      label: "Alçalan Üçgen",
      detail: broken
        ? "Destek kırılımı (ayı)"
        : "Alçalan direnç + yatay destek",
      bias: "bear",
      confidence: broken ? 0.78 : 0.64,
      tStart,
      tEnd: last.time,
      drawings: [
        trendline(`${id}_res`, h1, h3, "#ef5350", "Direnç"),
        trendline(`${id}_sup`, l1, l3, "#26a69a", "Destek", true),
        labelDraw(
          `${id}_lb`,
          h3.time,
          h3.price,
          broken ? "↓ Üçgen KIRILIM" : "↓ Üçgen",
          "#ef5350"
        ),
      ],
    });
  }

  // Symmetrical: falling highs + rising lows
  if (sh < 0 && sl > 0) {
    const id = uid("ts");
    const width1 = lineAt(h1, h3, h1.index) - lineAt(l1, l3, l1.index);
    const width2 = lineAt(h1, h3, h3.index) - lineAt(l1, l3, l3.index);
    if (width2 < width1 * 0.98 && width2 > 0) {
      const lastIdx = candles.length - 1;
      const resNow = lineAt(h1, h3, Math.max(h3.index, lastIdx));
      const supNow = lineAt(l1, l3, Math.max(l3.index, lastIdx));
      const brokenUp = last.close > resNow;
      const brokenDn = last.close < supNow;
      const bias: PatternHit["bias"] = brokenUp
        ? "bull"
        : brokenDn
          ? "bear"
          : "neutral";
      out.push({
        id,
        type: "triangle_sym",
        label: "Simetrik Üçgen",
        detail:
          brokenUp || brokenDn
            ? "Sıkışma kırılımı"
            : "Sıkışan yükselen destek / alçalan direnç",
        bias,
        confidence: brokenUp || brokenDn ? 0.74 : 0.6,
        tStart,
        tEnd: last.time,
        drawings: [
          trendline(`${id}_res`, h1, h3, "#2962ff", "Direnç"),
          trendline(`${id}_sup`, l1, l3, "#2962ff", "Destek"),
          labelDraw(
            `${id}_lb`,
            h2.time,
            h2.price,
            brokenUp || brokenDn ? "Sim Üçgen KIRILIM" : "Sim Üçgen",
            "#2962ff"
          ),
        ],
      });
    }
  }

  void h2;
  void l2;
  return out;
}

function detectFlagPennant(
  candles: Candle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  _opts: Required<DetectOptions>
): PatternHit[] {
  const out: PatternHit[] = [];
  if (candles.length < 40) return out;
  const last = candles[candles.length - 1];
  const n = candles.length;

  // Adaptive pole: strongest |close move| impulse in lookback, then cons after it
  type PoleCand = {
    poleStart: number;
    poleEnd: number;
    poleMove: number;
    polePct: number;
  };
  const poles: PoleCand[] = [];
  for (const poleLen of [12, 16, 20, 24]) {
    for (const consBars of [8, 10, 12, 14, 16, 18]) {
      const poleEnd = n - 1 - consBars;
      const poleStart = poleEnd - poleLen;
      if (poleStart < 2) continue;
      const poleMove = candles[poleEnd].close - candles[poleStart].close;
      const polePct =
        Math.abs(poleMove) / Math.max(1e-12, candles[poleStart].close);
      if (polePct < 0.02) continue;
      poles.push({ poleStart, poleEnd, poleMove, polePct });
    }
  }
  poles.sort((a, b) => b.polePct - a.polePct);

  const seen = new Set<string>();
  for (const pole of poles.slice(0, 12)) {
    const { poleStart, poleEnd, poleMove, polePct } = pole;
    const key = `${poleStart}_${poleEnd}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const consH = highs.filter(
      (x) => x.index >= poleEnd && x.index <= n - 2
    );
    const consL = lows.filter(
      (x) => x.index >= poleEnd && x.index <= n - 2
    );

    let h1: SwingPoint;
    let h2: SwingPoint;
    let l1: SwingPoint;
    let l2: SwingPoint;

    if (consH.length >= 2 && consL.length >= 2) {
      h1 = consH[0];
      h2 = consH[consH.length - 1];
      l1 = consL[0];
      l2 = consL[consL.length - 1];
    } else {
      const cons = candles.slice(poleEnd, n - 1);
      if (cons.length < 4) continue;
      // split cons into early/late halves for channel endpoints
      const mid = Math.floor(cons.length / 2);
      const early = cons.slice(0, Math.max(2, mid));
      const late = cons.slice(mid);
      const eHi = early.reduce((m, c, i) => (c.high >= early[m].high ? i : m), 0);
      const eLo = early.reduce((m, c, i) => (c.low <= early[m].low ? i : m), 0);
      const lHi = late.reduce((m, c, i) => (c.high >= late[m].high ? i : m), 0);
      const lLo = late.reduce((m, c, i) => (c.low <= late[m].low ? i : m), 0);
      h1 = {
        index: poleEnd + eHi,
        time: candles[poleEnd + eHi].time,
        price: candles[poleEnd + eHi].high,
        kind: "high",
      };
      h2 = {
        index: poleEnd + mid + lHi,
        time: candles[poleEnd + mid + lHi].time,
        price: candles[poleEnd + mid + lHi].high,
        kind: "high",
      };
      l1 = {
        index: poleEnd + eLo,
        time: candles[poleEnd + eLo].time,
        price: candles[poleEnd + eLo].low,
        kind: "low",
      };
      l2 = {
        index: poleEnd + mid + lLo,
        time: candles[poleEnd + mid + lLo].time,
        price: candles[poleEnd + mid + lLo].low,
        kind: "low",
      };
    }

    if (h2.index <= h1.index || l2.index <= l1.index) continue;

    const sh = slope(h1, h2);
    const sl = slope(l1, l2);
    const bullPole = poleMove > 0;
    const px = Math.abs(candles[poleEnd].close) || 1;
    const slopeTol = px * 0.0012;
    const parallel =
      Math.abs(sh - sl) < slopeTol ||
      Math.abs(sh - sl) < Math.max(Math.abs(sh), Math.abs(sl), 1e-9) * 0.75;
    const counter =
      (bullPole && sh <= slopeTol && sl <= slopeTol) ||
      (!bullPole && sh >= -slopeTol && sl >= -slopeTol);
    const converging = sh < -1e-12 && sl > 1e-12;
    const consHi = Math.max(h1.price, h2.price);
    const consLo = Math.min(l1.price, l2.price);
    const width1 = Math.abs(h1.price - l1.price);
    const width2 = Math.abs(h2.price - l2.price);
    const widthShrink = width2 <= width1 * 1.08;
    // Cons should be tighter than pole range
    const poleHi = Math.max(
      ...candles.slice(poleStart, poleEnd + 1).map((c) => c.high)
    );
    const poleLo = Math.min(
      ...candles.slice(poleStart, poleEnd + 1).map((c) => c.low)
    );
    const poleRange = poleHi - poleLo;
    if (poleRange <= 0) continue;
    const consTight = consHi - consLo < poleRange * 0.75;

    const id = uid("fp");
    const polePts: [SwingPoint, SwingPoint] = [
      {
        index: poleStart,
        time: candles[poleStart].time,
        price: candles[poleStart].close,
        kind: bullPole ? "low" : "high",
      },
      {
        index: poleEnd,
        time: candles[poleEnd].time,
        price: candles[poleEnd].close,
        kind: bullPole ? "high" : "low",
      },
    ];

    const isFlag =
      consTight &&
      widthShrink &&
      ((parallel && counter) || (counter && !converging));
    const isPennant = consTight && converging && widthShrink;

    if (isFlag) {
      out.push({
        id,
        type: "flag",
        label: bullPole ? "Boğa Bayrağı" : "Ayı Bayrağı",
        detail: `Direk %${(polePct * 100).toFixed(1)} + karşı kanal`,
        bias: bullPole ? "bull" : "bear",
        confidence: Math.min(0.85, 0.5 + polePct * 4),
        tStart: candles[poleStart].time,
        tEnd: last.time,
        drawings: [
          trendline(
            `${id}_pole`,
            polePts[0],
            polePts[1],
            bullPole ? "#26a69a" : "#ef5350",
            "Direk"
          ),
          trendline(`${id}_ch1`, h1, h2, "#ffb74d", "Bayrak"),
          trendline(`${id}_ch2`, l1, l2, "#ffb74d"),
          box(
            `${id}_box`,
            h1.time,
            last.time,
            consLo,
            consHi,
            bullPole ? "rgba(38,166,154,0.1)" : "rgba(239,83,80,0.1)"
          ),
          labelDraw(
            `${id}_lb`,
            h2.time,
            h2.price,
            bullPole ? "Bayrak ↑" : "Bayrak ↓",
            bullPole ? "#26a69a" : "#ef5350"
          ),
        ],
      });
      break;
    }

    if (isPennant) {
      out.push({
        id,
        type: "pennant",
        label: bullPole ? "Boğa Flaması" : "Ayı Flaması",
        detail: `Direk %${(polePct * 100).toFixed(1)} + sıkışma`,
        bias: bullPole ? "bull" : "bear",
        confidence: Math.min(0.82, 0.48 + polePct * 4),
        tStart: candles[poleStart].time,
        tEnd: last.time,
        drawings: [
          trendline(
            `${id}_pole`,
            polePts[0],
            polePts[1],
            bullPole ? "#26a69a" : "#ef5350",
            "Direk"
          ),
          trendline(`${id}_ch1`, h1, h2, "#e040fb", "Flama"),
          trendline(`${id}_ch2`, l1, l2, "#e040fb"),
          box(
            `${id}_box`,
            h1.time,
            last.time,
            consLo,
            consHi,
            "rgba(224,64,251,0.08)"
          ),
          labelDraw(
            `${id}_lb`,
            h2.time,
            h2.price,
            "Flama",
            bullPole ? "#26a69a" : "#ef5350"
          ),
        ],
      });
      break;
    }
  }
  return out;
}

function detectBreakoutBox(
  candles: Candle[],
  opts: Required<DetectOptions>
): PatternHit[] {
  const lb = opts.boxLookback;
  if (candles.length < lb + 5) return [];
  const body = candles.slice(-lb - 1, -1);
  const last = candles[candles.length - 1];
  const hi = Math.max(...body.map((c) => c.high));
  const lo = Math.min(...body.map((c) => c.low));
  const width = (hi - lo) / ((hi + lo) / 2);
  if (width > 0.08 || width < 0.005) return []; // need a tight-ish range
  const id = uid("box");
  const up = last.close > hi;
  const dn = last.close < lo;
  if (!up && !dn) {
    // still show consolidation box with lower confidence
    return [
      {
        id,
        type: "breakout_box",
        label: "Konsolidasyon Kutusu",
        detail: `${lb} bar aralığı · henüz kırılım yok`,
        bias: "neutral",
        confidence: 0.45,
        tStart: body[0].time,
        tEnd: last.time,
        drawings: [
          box(
            `${id}_b`,
            body[0].time,
            last.time,
            lo,
            hi,
            "rgba(41,98,255,0.12)",
            "Box"
          ),
          hline(`${id}_hi`, body[0].time, last.time, hi, "#2962ff", "Üst"),
          hline(`${id}_lo`, body[0].time, last.time, lo, "#2962ff", "Alt"),
        ],
      },
    ];
  }
  return [
    {
      id,
      type: "breakout_box",
      label: up ? "Yukarı Kırılım Kutusu" : "Aşağı Kırılım Kutusu",
      detail: `${lb} bar aralığı kırıldı`,
      bias: up ? "bull" : "bear",
      confidence: 0.72,
      tStart: body[0].time,
      tEnd: last.time,
      drawings: [
        box(
          `${id}_b`,
          body[0].time,
          last.time,
          lo,
          hi,
          up ? "rgba(38,166,154,0.15)" : "rgba(239,83,80,0.15)",
          "Box"
        ),
        hline(`${id}_hi`, body[0].time, last.time, hi, "#ffb74d", "Üst"),
        hline(`${id}_lo`, body[0].time, last.time, lo, "#ffb74d", "Alt"),
        marker(
          `${id}_m`,
          last.time,
          last.close,
          up ? "bull" : "bear",
          "BO"
        ),
        labelDraw(
          `${id}_lb`,
          last.time,
          last.close,
          up ? "Kırılım ↑" : "Kırılım ↓",
          up ? "#26a69a" : "#ef5350"
        ),
      ],
    },
  ];
}

function detectEngulfing(candles: Candle[]): PatternHit[] {
  if (candles.length < 3) return [];
  const a = candles[candles.length - 2];
  const b = candles[candles.length - 1];
  const out: PatternHit[] = [];
  const bullEng =
    a.close < a.open &&
    b.close > b.open &&
    b.open <= a.close &&
    b.close >= a.open;
  const bearEng =
    a.close > a.open &&
    b.close < b.open &&
    b.open >= a.close &&
    b.close <= a.open;
  if (bullEng) {
    const id = uid("engb");
    out.push({
      id,
      type: "engulfing",
      label: "Yutan Boğa",
      detail: "Bullish engulfing",
      bias: "bull",
      confidence: 0.55,
      tStart: a.time,
      tEnd: b.time,
      drawings: [
        box(
          `${id}_b`,
          a.time,
          b.time,
          Math.min(a.low, b.low),
          Math.max(a.high, b.high),
          "rgba(38,166,154,0.2)"
        ),
        marker(`${id}_m`, b.time, b.low, "bull", "ENG"),
      ],
    });
  }
  if (bearEng) {
    const id = uid("engs");
    out.push({
      id,
      type: "engulfing",
      label: "Yutan Ayı",
      detail: "Bearish engulfing",
      bias: "bear",
      confidence: 0.55,
      tStart: a.time,
      tEnd: b.time,
      drawings: [
        box(
          `${id}_b`,
          a.time,
          b.time,
          Math.min(a.low, b.low),
          Math.max(a.high, b.high),
          "rgba(239,83,80,0.2)"
        ),
        marker(`${id}_m`, b.time, b.high, "bear", "ENG"),
      ],
    });
  }
  return out;
}

function dedupeByType(
  hits: PatternHit[],
  types: PatternHit["type"][]
): PatternHit[] {
  const best = new Map<string, PatternHit>();
  for (const h of hits) {
    if (!types.includes(h.type)) continue;
    const key = h.type;
    const prev = best.get(key);
    if (!prev || h.confidence > prev.confidence || h.tEnd > prev.tEnd) {
      best.set(key, h);
    }
  }
  // also keep non-listed
  const others = hits.filter((h) => !types.includes(h.type));
  return [...others, ...best.values()];
}

/** @deprecated alias — older imports */
export type PatternHint = PatternHit;
