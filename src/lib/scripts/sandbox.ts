import type { Candle } from "@/lib/types";
import { compileTdToJs, isTdScript, TD_SAMPLES } from "@/lib/scripts/td/compile";

export interface ScriptPlot {
  id: string;
  pane?: "main" | "sub";
  type?: "line" | "histogram";
  color?: string;
  title?: string;
  values: (number | null)[];
}

export interface ScriptResult {
  plots: ScriptPlot[];
  error?: string;
  warnings?: string[];
}

/**
 * Run custom indicator (TD Script or legacy JS) in restricted Function sandbox.
 */
export function runCustomScript(
  code: string,
  candles: Candle[],
  language?: "td" | "pine" | "js"
): ScriptResult {
  try {
    let js = code;
    const warnings: string[] = [];
    const useTd =
      language === "td" ||
      (language !== "js" && (language === "pine" ? false : isTdScript(code)));

    if (language === "pine") {
      return {
        plots: [],
        error:
          "Pine doğrudan çalışmaz — önce TD Script'e dönüştürün (İçe Aktar / Dönüştür)",
      };
    }

    if (useTd || isTdScript(code)) {
      const compiled = compileTdToJs(code);
      if (compiled.errors.length) {
        return { plots: [], error: compiled.errors.join("; "), warnings: compiled.warnings };
      }
      js = compiled.js;
      warnings.push(...compiled.warnings);
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const opens = candles.map((c) => c.open);
    const volumes = candles.map((c) => c.volume);
    const times = candles.map((c) => c.time);

    const helper = `
      const sma = (arr, period) => {
        const out = [];
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i];
          if (i >= period) sum -= arr[i - period];
          out.push(i >= period - 1 ? sum / period : null);
        }
        return out;
      };
      const ema = (arr, period) => {
        const out = [];
        const k = 2 / (period + 1);
        let prev = null;
        for (let i = 0; i < arr.length; i++) {
          if (i < period - 1) { out.push(null); continue; }
          if (prev == null) {
            let s = 0;
            for (let j = i - period + 1; j <= i; j++) s += arr[j];
            prev = s / period;
          } else prev = arr[i] * k + prev * (1 - k);
          out.push(prev);
        }
        return out;
      };
      const plot = (id, values, opts = {}) => {
        const vals = Array.isArray(values) ? values : [];
        __plots.push({ id: String(id), values: vals, ...opts, title: opts.title || String(id) });
      };
    `;

    const plots: ScriptPlot[] = [];
    const fn = new Function(
      "candles",
      "close",
      "high",
      "low",
      "open",
      "volume",
      "time",
      "__plots",
      `"use strict";
       ${helper}
       ${js}
       return __plots;`
    );

    const result = fn(candles, closes, highs, lows, opens, volumes, times, plots);
    return {
      plots: Array.isArray(result) ? result : plots,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (e) {
    return {
      plots: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const SAMPLE_SCRIPTS = TD_SAMPLES;
