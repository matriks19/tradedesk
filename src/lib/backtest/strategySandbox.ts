import type { Candle } from "@/lib/types";
import { adx, aroon, sma, stdev } from "@/lib/indicators/math";

export interface StrategySignalBars {
  enterLong: boolean[];
  exitLong: boolean[];
  enterShort: boolean[];
  exitShort: boolean[];
  warnings: string[];
}

function crossoverArr(
  a: (number | null)[],
  b: (number | null)[] | number
): boolean[] {
  const n = a.length;
  const out = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    const bv0 = typeof b === "number" ? b : b[i - 1];
    const bv1 = typeof b === "number" ? b : b[i];
    if (a[i] == null || a[i - 1] == null || bv0 == null || bv1 == null) continue;
    out[i] =
      (a[i - 1] as number) <= (bv0 as number) &&
      (a[i] as number) > (bv1 as number);
  }
  return out;
}

function crossunderArr(
  a: (number | null)[],
  b: (number | null)[] | number
): boolean[] {
  const n = a.length;
  const out = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    const bv0 = typeof b === "number" ? b : b[i - 1];
    const bv1 = typeof b === "number" ? b : b[i];
    if (a[i] == null || a[i - 1] == null || bv0 == null || bv1 == null) continue;
    out[i] =
      (a[i - 1] as number) >= (bv0 as number) &&
      (a[i] as number) < (bv1 as number);
  }
  return out;
}

function asBool(v: unknown, n: number): boolean[] {
  if (Array.isArray(v)) {
    return Array.from({ length: n }, (_, i) => Boolean(v[i]));
  }
  if (typeof v === "boolean") return new Array(n).fill(v);
  return new Array(n).fill(false);
}

/** Light Pine → runnable strategy JS (best-effort). */
export function preprocessStrategySource(src: string): {
  code: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let code = src.replace(/\r\n/g, "\n");
  code = code.replace(/\/\/@version\s*=\s*\d+\s*/g, "");
  code = code.replace(/^\s*(indicator|strategy)\s*\([^)]*\)\s*/gim, "");
  code = code.replace(
    /input\.(int|float|bool)\s*\(\s*([^,)\n]+)[^)]*\)/g,
    (_m, _t, def) => {
      warnings.push("input.* → default değer kullanıldı");
      return String(def).trim();
    }
  );
  code = code.replace(
    /^\s*(plot|plotshape|hline|bgcolor|alertcondition|fill)\s*\([^;]*\)\s*/gim,
    ""
  );
  code = code.replace(/^\s*var\s+table[\s\S]*?(?=\n\S|\n*$)/gm, "");
  code = code.replace(/^\s*if\s+barstate\.islast[\s\S]*?(?=\n\S|\n*$)/gm, "");
  code = code.replace(/:=/g, "=");
  code = code
    .split("\n")
    .filter(
      (l) =>
        !/\b(color\.|table\.|str\.|position\.|size\.|display\.|location\.|shape\.)/.test(
          l
        )
    )
    .join("\n");

  code = code.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*)\s+and\s+(\b[A-Za-z_][A-Za-z0-9_]*)\s+and\s+(\b[A-Za-z_][A-Za-z0-9_]*)/g,
    "and3($1, $2, $3)"
  );
  code = code.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*)\s+and\s+(\b[A-Za-z_][A-Za-z0-9_]*)/g,
    "and2($1, $2)"
  );
  code = code.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*)\s+or\s+(\b[A-Za-z_][A-Za-z0-9_]*)/g,
    "or2($1, $2)"
  );
  code = code.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*)\s*<\s*(-?[\d.]+|[A-Za-z_][A-Za-z0-9_]*)/g,
    "lt($1, $2)"
  );
  code = code.replace(
    /(\b[A-Za-z_][A-Za-z0-9_]*)\s*>\s*(-?[\d.]+|[A-Za-z_][A-Za-z0-9_]*)/g,
    "gt($1, $2)"
  );

  code = code
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t || t.startsWith("//")) return line;
      if (/^(const|let|var|function|return)\b/.test(t)) return line;
      if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(t))
        return `const ${t}${t.endsWith(";") ? "" : ";"}`;
      return line;
    })
    .join("\n");

  code = code.replace(
    /\(close\s*-\s*([A-Za-z_][A-Za-z0-9_]*)\)\s*\/\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    "div(sub(close, $1), $2)"
  );

  return { code, warnings: [...new Set(warnings)] };
}

export const ZSCORE_PULLBACK_SAMPLE = `// Trend + Z-Score Pullback (TradeDesk strategy)
zLength = 20
regimeSMA = 200
entryThreshold = -1.5
exitThreshold = 0.0
fastMA = 5

sma20 = ta.sma(close, zLength)
std20 = ta.stdev(close, zLength)
zScore = (close - sma20) / std20
sma200 = ta.sma(close, regimeSMA)
fastSMA = ta.sma(close, fastMA)

bullRegime = close > sma200
enterLong = bullRegime and zScore < entryThreshold and ta.crossover(close, fastSMA)
exitLong = zScore > exitThreshold
`;

export const DI_ADX_SAMPLE = `// ADX trend + DI cross
adxLen = 14
adxMin = 25
d = ta.adx(adxLen)
enterLong = and2(ta.crossover(d.plusDI, d.minusDI), gt(d.adx, adxMin))
exitLong = or2(ta.crossunder(d.plusDI, d.minusDI), lt(d.adx, 20))
enterShort = and2(ta.crossover(d.minusDI, d.plusDI), gt(d.adx, adxMin))
exitShort = or2(ta.crossunder(d.minusDI, d.plusDI), lt(d.adx, 20))
`;

export const AROON_LONG_SAMPLE = `// Aroon long
period = 14
a = ta.aroon(period)
enterLong = or2(ta.crossover(a.up, a.down), and2(gt(a.up, 70), lt(a.down, 30)))
exitLong = or2(ta.crossunder(a.up, a.down), lt(a.up, 50))
`;

export const JURI_OS_SAMPLE = `// Jurik-style: use stoch as proxy in code sandbox — prefer preset Jurik OS Bounce
kLen = 14
s = ta.sma(close, 1)
// Placeholder: load preset "jurikOsBounce" for full Jurik Kase logic
enterLong = ta.crossover(close, ta.sma(close, 5))
exitLong = ta.crossunder(close, ta.sma(close, 5))
`;

/**
 * Run strategy source (JS or light-Pine) → per-bar entry/exit flags.
 */
export function runStrategyCode(
  source: string,
  candles: Candle[]
): StrategySignalBars {
  const n = candles.length;
  const empty = (): StrategySignalBars => ({
    enterLong: new Array(n).fill(false),
    exitLong: new Array(n).fill(false),
    enterShort: new Array(n).fill(false),
    exitShort: new Array(n).fill(false),
    warnings: [],
  });
  if (!n) return empty();

  const close = candles.map((c) => c.close);
  const open = candles.map((c) => c.open);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const volume = candles.map((c) => c.volume);

  const and2 = (a: unknown, b: unknown) => {
    const A = asBool(a, n);
    const B = asBool(b, n);
    return A.map((v, i) => v && B[i]);
  };
  const and3 = (a: unknown, b: unknown, c: unknown) => and2(and2(a, b), c);
  const or2 = (a: unknown, b: unknown) => {
    const A = asBool(a, n);
    const B = asBool(b, n);
    return A.map((v, i) => v || B[i]);
  };
  const lt = (a: (number | null)[], b: (number | null)[] | number) =>
    a.map((v, i) => {
      const r = typeof b === "number" ? b : b[i];
      return v != null && r != null && v < (r as number);
    });
  const gt = (a: (number | null)[], b: (number | null)[] | number) =>
    a.map((v, i) => {
      const r = typeof b === "number" ? b : b[i];
      return v != null && r != null && v > (r as number);
    });
  const div = (a: (number | null)[], b: (number | null)[]) =>
    a.map((v, i) =>
      v == null || b[i] == null || (b[i] as number) === 0
        ? null
        : (v as number) / (b[i] as number)
    );
  const sub = (a: (number | null)[] | number[], b: (number | null)[]) =>
    a.map((v, i) =>
      v == null || b[i] == null ? null : (v as number) - (b[i] as number)
    );

  const ta = {
    sma: (src: number[], len: number) => sma(src, len),
    stdev: (src: number[], len: number) => stdev(src, len),
    crossover: (a: (number | null)[], b: (number | null)[] | number) =>
      crossoverArr(a, b),
    crossunder: (a: (number | null)[], b: (number | null)[] | number) =>
      crossunderArr(a, b),
    adx: (len = 14) => adx(candles, len),
    aroon: (len = 14) => aroon(candles, len),
  };

  const prepared = preprocessStrategySource(source);
  const body = prepared.code;

  const fn = new Function(
    "close",
    "open",
    "high",
    "low",
    "volume",
    "ta",
    "and2",
    "and3",
    "or2",
    "lt",
    "gt",
    "div",
    "sub",
    "sma",
    "stdev",
    `${body}
     return {
       enterLong: (typeof enterLong !== "undefined") ? enterLong : [],
       exitLong: (typeof exitLong !== "undefined") ? exitLong : [],
       enterShort: (typeof enterShort !== "undefined") ? enterShort : [],
       exitShort: (typeof exitShort !== "undefined") ? exitShort : [],
     };`
  );

  try {
    const out = fn(
      close,
      open,
      high,
      low,
      volume,
      ta,
      and2,
      and3,
      or2,
      lt,
      gt,
      div,
      sub,
      sma,
      stdev
    ) as {
      enterLong: unknown;
      exitLong: unknown;
      enterShort: unknown;
      exitShort: unknown;
    };
    return {
      enterLong: asBool(out.enterLong, n),
      exitLong: asBool(out.exitLong, n),
      enterShort: asBool(out.enterShort, n),
      exitShort: asBool(out.exitShort, n),
      warnings: prepared.warnings,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw Object.assign(new Error(msg), {
      strategyWarnings: [...prepared.warnings, `Kod hatası: ${msg}`],
    });
  }
}
