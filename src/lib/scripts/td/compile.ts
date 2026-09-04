/**
 * TD Script — small DSL compiled to sandboxed JS.
 *
 * Example:
 *   //@version=td1
 *   fast = sma(close, 9)
 *   slow = sma(close, 21)
 *   plot(fast, "SMA9", color=#26a69a)
 *   plot(slow, "SMA21", color=#ef5350)
 *   bull = crossover(fast, slow)
 *   plotshape(bull, "X", style=triangleup)
 */

export interface CompileResult {
  js: string;
  errors: string[];
  warnings: string[];
}

const BUILTINS = new Set([
  "sma",
  "ema",
  "rsi",
  "macd",
  "bollinger",
  "highest",
  "lowest",
  "crossover",
  "crossunder",
  "plot",
  "plotshape",
  "hline",
  "strategy",
  "close",
  "open",
  "high",
  "low",
  "volume",
  "hl2",
  "hlc3",
  "true",
  "false",
  "na",
  "nz",
  "color",
  "trueRange",
  "sessionVwap",
  "change",
  "stdev",
  "atr",
]);

export function isTdScript(code: string): boolean {
  const head = code.trim().slice(0, 80).toLowerCase();
  if (head.includes("//@version=td") || head.includes("// @version=td"))
    return true;
  // heuristic: has plot( and assignment without JS keywords
  if (/\bplot\s*\(/.test(code) && /=\s*(sma|ema|rsi)\s*\(/.test(code))
    return true;
  if (/\bindicator\s*\(/.test(code) || /\bstrategy\s*\(/.test(code))
    return false; // likely Pine
  return false;
}

export function compileTdToJs(source: string): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  out.push("// compiled from TD Script");
  out.push("const na = null;");
  out.push("const nz = (v, d=0) => (v == null || Number.isNaN(v) ? d : v);");
  out.push("const hl2 = close.map((_, i) => (high[i] + low[i]) / 2);");
  out.push(
    "const hlc3 = close.map((_, i) => (high[i] + low[i] + close[i]) / 3);"
  );
  out.push(`
const highest = (src, len) => src.map((_, i) => {
  if (i < len - 1) return null;
  let m = -Infinity;
  for (let j = i - len + 1; j <= i; j++) m = Math.max(m, src[j]);
  return m;
});
const lowest = (src, len) => src.map((_, i) => {
  if (i < len - 1) return null;
  let m = Infinity;
  for (let j = i - len + 1; j <= i; j++) m = Math.min(m, src[j]);
  return m;
});
const crossover = (a, b) => a.map((v, i) => {
  if (i < 1 || v == null || b[i] == null || a[i-1] == null || b[i-1] == null) return false;
  return a[i-1] <= b[i-1] && v > b[i];
});
const crossunder = (a, b) => a.map((v, i) => {
  if (i < 1 || v == null || b[i] == null || a[i-1] == null || b[i-1] == null) return false;
  return a[i-1] >= b[i-1] && v < b[i];
});
const __rsi = (src, len) => {
  const out = new Array(src.length).fill(null);
  if (src.length < len + 1) return out;
  let ag = 0, al = 0;
  for (let i = 1; i <= len; i++) {
    const d = src[i] - src[i-1];
    if (d >= 0) ag += d; else al -= d;
  }
  ag /= len; al /= len;
  out[len] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = len + 1; i < src.length; i++) {
    const d = src[i] - src[i-1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    ag = (ag * (len - 1) + g) / len;
    al = (al * (len - 1) + l) / len;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
};
const rsi = (src, len) => __rsi(src, len);
const macd = (src, fast=12, slow=26, signal=9) => {
  const ef = ema(src, fast), es = ema(src, slow);
  const line = src.map((_, i) => ef[i] != null && es[i] != null ? ef[i] - es[i] : null);
  const filled = line.map(v => v == null ? 0 : v);
  const sig = ema(filled, signal).map((v, i) => line[i] == null ? null : v);
  const hist = line.map((v, i) => v != null && sig[i] != null ? v - sig[i] : null);
  return [line, sig, hist];
};
const bollinger = (src, len=20, mult=2) => {
  const mid = sma(src, len);
  const upper = [], lower = [];
  for (let i = 0; i < src.length; i++) {
    if (mid[i] == null) { upper.push(null); lower.push(null); continue; }
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) { const d = src[j] - mid[i]; s += d*d; }
    const std = Math.sqrt(s / len);
    upper.push(mid[i] + mult * std);
    lower.push(mid[i] - mult * std);
  }
  return [mid, upper, lower];
};
const trueRange = () => high.map((h, i) => {
  if (i === 0) return h - low[i];
  return Math.max(h - low[i], Math.abs(h - close[i-1]), Math.abs(low[i] - close[i-1]));
});
const atr = (len=14) => sma(trueRange(), len);
const change = (src, len=1) => src.map((v, i) => i < len || v == null || src[i-len] == null ? null : v - src[i-len]);
const stdev = (src, len) => {
  const mid = sma(src, len);
  return src.map((_, i) => {
    if (mid[i] == null) return null;
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) { const d = src[j] - mid[i]; s += d*d; }
    return Math.sqrt(s / len);
  });
};
const sessionVwap = () => {
  let cumPV = 0, cumV = 0, day = "";
  return close.map((_, i) => {
    const d = new Date(time[i] * 1000).toISOString().slice(0, 10);
    if (d !== day) { day = d; cumPV = 0; cumV = 0; }
    const tp = (high[i] + low[i] + close[i]) / 3;
    cumPV += tp * volume[i];
    cumV += volume[i];
    return cumV === 0 ? null : cumPV / cumV;
  });
};
const plotshape = (cond, title="shape", opts={}) => {
  const values = (Array.isArray(cond) ? cond : []).map(v => v ? 1 : null);
  plot(title, values, { pane: "sub", color: opts.color || "#ffeb3b", title });
};
const hline = (price, title="hline", opts={}) => {
  const values = close.map(() => price);
  plot(title, values, { pane: opts.pane || "sub", color: opts.color || "#8b95a8", title });
};
const strategy = {
  entry: (id, dir) => { /* stub */ },
  close: (id) => { /* stub */ },
  exit: (id) => { /* stub */ },
};
`);

  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
      out.push(raw);
      continue;
    }
    // strip trailing comments
    const hash = trimmed.indexOf("//");
    if (hash >= 0) raw = trimmed.slice(0, hash).trimEnd();
    else raw = trimmed;

    // color=#rrggbb → color: "#rrggbb" handled in plot rewrite
    // Convert named args style=x to object later

    // plot(series, "title", color=#abc) or plot(series, title="x")
    if (/^plot\s*\(/.test(raw)) {
      const converted = convertPlotCall(raw, "plot");
      if (converted.error) errors.push(`L${li + 1}: ${converted.error}`);
      else if (converted.js) out.push(converted.js);
      continue;
    }
    if (/^plotshape\s*\(/.test(raw)) {
      const converted = convertPlotCall(raw, "plotshape");
      if (converted.error) errors.push(`L${li + 1}: ${converted.error}`);
      else if (converted.js) out.push(converted.js);
      continue;
    }
    if (/^hline\s*\(/.test(raw)) {
      const converted = convertPlotCall(raw, "hline");
      if (converted.error) errors.push(`L${li + 1}: ${converted.error}`);
      else if (converted.js) out.push(converted.js);
      continue;
    }
    if (/^strategy\.(entry|close|exit)\s*\(/.test(raw)) {
      warnings.push(`L${li + 1}: strategy stub — emir gönderilmez`);
      out.push(raw.replace(/strategy\./, "strategy.") + ";");
      continue;
    }
    // destructuring: [macdLine, signal, hist] = macd(close, 12, 26, 9)
    if (/^\[[^\]]+\]\s*=/.test(raw)) {
      out.push(`const ${raw};`);
      continue;
    }
    // assignment: name = expr
    const assign = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assign) {
      let expr = assign[2];
      expr = rewriteColorLiterals(expr);
      out.push(`const ${assign[1]} = ${expr};`);
      continue;
    }
    // bare expression
    out.push(raw.endsWith(";") ? raw : raw + ";");
  }

  return { js: out.join("\n"), errors, warnings };
}

function rewriteColorLiterals(expr: string): string {
  return expr.replace(/color\s*=\s*(#[0-9A-Fa-f]{6,8})/g, 'color: "$1"');
}

function convertPlotCall(
  raw: string,
  kind: "plot" | "plotshape" | "hline"
): { js?: string; error?: string } {
  const open = raw.indexOf("(");
  const close = raw.lastIndexOf(")");
  if (open < 0 || close < 0) return { error: "parantez hatası" };
  const inner = raw.slice(open + 1, close).trim();
  const args = splitArgs(inner);
  if (!args.length) return { error: "argüman yok" };

  if (kind === "hline") {
    const price = args[0];
    const title = stripQuotes(args[1] ?? '"hline"');
    const opts = namedToObject(args.slice(2));
    return {
      js: `hline(${price}, ${JSON.stringify(title)}, ${opts});`,
    };
  }
  if (kind === "plotshape") {
    const cond = args[0];
    const title = stripQuotes(args[1] ?? '"shape"');
    const opts = namedToObject(args.slice(2));
    return {
      js: `plotshape(${cond}, ${JSON.stringify(title)}, ${opts});`,
    };
  }
  // plot(series, title?, ...)
  const series = args[0];
  let title = series;
  let optStart = 1;
  if (args[1] && (args[1].startsWith('"') || args[1].startsWith("'"))) {
    title = stripQuotes(args[1]);
    optStart = 2;
  } else if (args[1] && args[1].includes("=")) {
    title = series;
    optStart = 1;
  } else if (args[1]) {
    title = stripQuotes(args[1]);
    optStart = 2;
  }
  const opts = namedToObject(args.slice(optStart));
  // Infer pane for rsi-like
  const paneHint =
    /rsi|macd|hist|mom|volume/i.test(String(title)) ||
    /rsi\s*\(/.test(series)
      ? '"sub"'
      : '"main"';
  return {
    js: `plot(${JSON.stringify(String(title).slice(0, 40))}, ${series}, { pane: ${paneHint}, ...${opts} });`,
  };
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === quote && s[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      depth++;
      cur += c;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      depth--;
      cur += c;
      continue;
    }
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  )
    return t.slice(1, -1);
  // title=foo
  const m = t.match(/^(?:title|name)\s*=\s*(.+)$/);
  if (m) return stripQuotes(m[1]);
  return t;
}

function namedToObject(args: string[]): string {
  const parts: string[] = [];
  for (const a of args) {
    const m = a.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!m) continue;
    let key = m[1];
    let val = m[2].trim();
    if (key === "color" && /^#/.test(val)) val = JSON.stringify(val);
    else if (key === "title" || key === "style") val = JSON.stringify(stripQuotes(val));
    else if (key === "color" && val.startsWith("color."))
      val = JSON.stringify(pineColor(val));
    if (key === "linewidth") key = "lineWidth";
    parts.push(`${key}: ${val}`);
  }
  return `{ ${parts.join(", ")} }`;
}

function pineColor(v: string): string {
  const map: Record<string, string> = {
    "color.red": "#ef5350",
    "color.green": "#26a69a",
    "color.blue": "#2962ff",
    "color.orange": "#ff6d00",
    "color.yellow": "#ffeb3b",
    "color.purple": "#e040fb",
    "color.gray": "#8b95a8",
    "color.white": "#e8edf5",
  };
  return map[v] ?? "#2962ff";
}

export const TD_SAMPLES: { name: string; code: string }[] = [
  {
    name: "Çift SMA + Cross",
    code: `//@version=td1
// Çift SMA ve kesişim işaretleri
fast = sma(close, 9)
slow = sma(close, 21)
plot(fast, "SMA9", color=#26a69a)
plot(slow, "SMA21", color=#ef5350)
bull = crossover(fast, slow)
bear = crossunder(fast, slow)
plotshape(bull, "Al", style=triangleup, color=#26a69a)
plotshape(bear, "Sat", style=triangledown, color=#ef5350)
`,
  },
  {
    name: "RSI Bant",
    code: `//@version=td1
r = rsi(close, 14)
plot(r, "RSI", color=#2962ff)
hline(70, "Aşırı Alım", color=#ef5350)
hline(30, "Aşırı Satım", color=#26a69a)
`,
  },
  {
    name: "MACD",
    code: `//@version=td1
[macdLine, signal, hist] = macd(close, 12, 26, 9)
plot(macdLine, "MACD", color=#2962ff)
plot(signal, "Signal", color=#ff6d00)
plot(hist, "Hist", color=#26a69a)
`,
  },
];
