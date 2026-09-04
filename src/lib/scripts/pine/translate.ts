/**
 * Best-effort Pine Script (v5-ish / Pine-like) ↔ TD Script.
 * Covers: sma/ema/rsi/macd/bollinger/plot/hline/crossover basics.
 */

import { isTdScript } from "@/lib/scripts/td/compile";

export interface TranslateResult {
  code: string;
  warnings: string[];
  language: "td" | "pine";
}

const UNSUPPORTED =
  /\b(request\.security|ticker\.|input\.|var\s+|varip\s+|matrix\.|polyline\.|box\.new|line\.new|label\.new|table\.|alert\(|timeframe\.|session\.|array\.|map\.|bgcolor|fill\()/;

export function detectLanguage(code: string): "pine" | "td" | "js" | "unknown" {
  const t = code.trim();
  if (/\/\/@version\s*=\s*[56]/.test(t) || /\bindicator\s*\(/.test(t) || /\bstrategy\s*\(/.test(t))
    return "pine";
  if (isTdScript(t) || /\/\/@version\s*=\s*td/.test(t)) return "td";
  if (/\bplot\s*\(.*__plots|\bfunction\b|\bconst\b|\blet\b/.test(t)) return "js";
  if (/\bplot\s*\(/.test(t) && /\b(sma|ema|rsi)\s*\(/.test(t)) return "td";
  return "unknown";
}

/** Pine → TD Script */
export function pineToTd(pine: string): TranslateResult {
  const warnings: string[] = [];
  let code = pine.replace(/\r\n/g, "\n");

  if (UNSUPPORTED.test(code)) {
    warnings.push(
      "Desteklenmeyen Pine özellikleri bulundu (request.security, line/box/label.new, input, var, …) — atlandı veya sadeleştirildi"
    );
  }

  // Remove version / indicator / strategy headers
  code = code.replace(/\/\/@version\s*=\s*[^\n]+/gi, "//@version=td1");
  if (!code.includes("//@version=td1")) {
    code = "//@version=td1\n" + code;
  }

  code = code.replace(
    /^\s*(indicator|strategy)\s*\([^)]*\)\s*/gim,
    (m) => {
      warnings.push(`Başlık kaldırıldı: ${m.trim().slice(0, 40)}…`);
      return "";
    }
  );

  // input.int(14, "len") → 14
  code = code.replace(
    /input\.(?:int|float|bool|string|source|color)\s*\(\s*([^,)]+)/g,
    (_, v) => {
      warnings.push("input() → sabit değer");
      return v.trim();
    }
  );
  code = code.replace(/input\s*\(\s*([^,)]+)/g, "$1");

  // ta.sma → sma, etc.
  code = code.replace(/\bta\.(sma|ema|rsi|macd|bb|crossover|crossunder|highest|lowest|atr|vwap|stdev|change|stoch)\b/g, "$1");
  code = code.replace(/\bta\.tr\b/g, "trueRange");
  code = code.replace(/\bta\.rma\b/g, "ema"); // approx
  code = code.replace(/\bbbollinger\b/g, "bollinger");
  code = code.replace(/\bbb\s*\(/g, "bollinger(");
  code = code.replace(/\bmath\.(max|min|abs|sqrt)\b/g, "Math.$1");

  // color.red → #ef5350 in named args later handled by compiler; rewrite common
  const colorMap: Record<string, string> = {
    "color.red": "#ef5350",
    "color.green": "#26a69a",
    "color.blue": "#2962ff",
    "color.orange": "#ff6d00",
    "color.yellow": "#ffeb3b",
    "color.purple": "#e040fb",
    "color.aqua": "#00bcd4",
    "color.gray": "#8b95a8",
    "color.white": "#e8edf5",
    "color.black": "#0b0e11",
    "color.teal": "#26a69a",
    "color.lime": "#8bc34a",
  };
  for (const [k, v] of Object.entries(colorMap)) {
    code = code.split(k).join(v);
  }

  // plot(series, title, color=...) already TD-like
  // Change plot(series, color, title) pine order occasionally — best effort leave

  // Remove := pine reassignment → =
  code = code.replace(/:=/g, "=");

  // bool true/false ok
  // Strip unsupported lines
  const lines = code.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (UNSUPPORTED.test(line)) {
      warnings.push(`Satır atlandı: ${line.trim().slice(0, 60)}`);
      kept.push(`// unsupported: ${line.trim()}`);
      continue;
    }
    if (/^\s*(bgcolor|fill|alert)\s*\(/.test(line)) {
      warnings.push(`Desteklenmiyor: ${line.trim().slice(0, 40)}`);
      kept.push(`// ${line.trim()}`);
      continue;
    }
    kept.push(line);
  }

  return { code: kept.join("\n").trim() + "\n", warnings: uniq(warnings), language: "td" };
}

/** TD Script → Pine-like v5 */
export function tdToPine(td: string): TranslateResult {
  const warnings: string[] = [];
  let code = td.replace(/\r\n/g, "\n");
  code = code.replace(/\/\/@version\s*=\s*td\d*/gi, "//@version=5");
  if (!code.includes("//@version=5")) {
    code = "//@version=5\n" + code;
  }
  if (!/\bindicator\s*\(/.test(code) && !/\bstrategy\s*\(/.test(code)) {
    code = code.replace(
      "//@version=5",
      '//@version=5\nindicator("TradeDesk Export", overlay=true)'
    );
  }

  // sma → ta.sma
  code = code.replace(
    /\b(sma|ema|rsi|crossover|crossunder|highest|lowest|atr|stdev|change)\s*\(/g,
    "ta.$1("
  );
  code = code.replace(/\btrueRange\s*\(/g, "ta.tr(");
  code = code.replace(/\bsessionVwap\s*\(/g, "ta.vwap(");
  code = code.replace(/\bmacd\s*\(/g, "ta.macd(");
  code = code.replace(/\bbollinger\s*\(/g, "ta.bb(");

  // plotshape stubs
  if (/\bplotshape\b/.test(code)) {
    warnings.push("plotshape stil eşlemesi sadeleştirildi");
  }
  if (/\bstrategy\./.test(code)) {
    warnings.push("strategy.* stub — Pine strategy() başlığı gerekebilir");
  }

  // color=#hex → color.new / keep hex (Pine accepts #)
  return { code: code.trim() + "\n", warnings: uniq(warnings), language: "pine" };
}

export function convertAny(
  code: string,
  target: "td" | "pine"
): TranslateResult {
  const lang = detectLanguage(code);
  if (target === "td") {
    if (lang === "td") return { code, warnings: [], language: "td" };
    if (lang === "pine" || lang === "unknown") return pineToTd(code);
    return pineToTd(code);
  }
  if (lang === "pine") return { code, warnings: ["Zaten Pine"], language: "pine" };
  return tdToPine(code);
}

function uniq(a: string[]): string[] {
  return [...new Set(a)];
}

export const PINE_SAMPLE = `//@version=5
indicator("MA RSI Demo", overlay=false)
len = input.int(14, "RSI Length")
r = ta.rsi(close, len)
plot(r, "RSI", color=color.blue)
hline(70, "OB")
hline(30, "OS")
fast = ta.sma(close, 9)
slow = ta.sma(close, 21)
// overlay tip: ayrı gösterge olarak kullanın
`;
