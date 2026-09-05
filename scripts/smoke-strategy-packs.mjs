/**
 * Smoke: assert every strategy pack indicator/backtest/scanner id is wired.
 * Run: node --experimental-strip-types is unavailable on some nodes;
 * prefer: npx tsc --noEmit && npx --yes tsx scripts/smoke-strategy-packs.ts
 * This .mjs is a lightweight regex fallback when tsx is not used.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = fs.readFileSync(path.join(root, "src/lib/strategies/catalog.ts"), "utf8");
const types = fs.readFileSync(path.join(root, "src/lib/types.ts"), "utf8");
const presets = fs.readFileSync(path.join(root, "src/lib/backtest/types.ts"), "utf8");
const scanner = fs.readFileSync(path.join(root, "src/lib/scanner/engine.ts"), "utf8");
const registry = fs.readFileSync(path.join(root, "src/lib/indicators/registry.ts"), "utf8");

const builtin = [...types.matchAll(/\|\s*"([a-zA-Z0-9_]+)"/g)]
  .map((m) => m[1])
  .filter((id, i, a) => {
    const start = types.indexOf("export type BuiltinIndicatorId");
    const end = types.indexOf("export interface IndicatorInputDef");
    const pos = types.indexOf(`"${id}"`, start);
    return pos > start && pos < end && a.indexOf(id) === i;
  });
const builtinSet = new Set(builtin);

const listIds = [...registry.matchAll(/\{\s*id:\s*"([a-zA-Z0-9_]+)"/g)].map((m) => m[1]);
const listSet = new Set(listIds);

const presetIds = [...presets.matchAll(/\|\s*"([a-zA-Z0-9_]+)"/g)]
  .map((m) => m[1])
  .filter((id) => {
    const start = presets.indexOf("export type StrategyPresetId");
    const end = presets.indexOf("export interface BacktestParams");
    const pos = presets.indexOf(`"${id}"`, start);
    return pos > start && pos < end;
  });
const presetSet = new Set(presetIds);

const scannerIds = [...scanner.matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\{/gm)].map((m) => m[1]);
const scannerSet = new Set(scannerIds);

const errors = [];
for (const id of builtin) {
  if (!listSet.has(id)) errors.push(`BuiltinIndicatorId ${id} missing from BUILTIN_LIST`);
}

const typeRefs = [...catalog.matchAll(/type:\s*"([a-zA-Z0-9_]+)"/g)].map((m) => m[1]);
for (const t of typeRefs) {
  if (!builtinSet.has(t)) errors.push(`catalog indicator type not in BuiltinIndicatorId: ${t}`);
}

const bt = [...catalog.matchAll(/backtestPreset:\s*"([a-zA-Z0-9_]+)"/g)].map((m) => m[1]);
for (const p of bt) {
  if (!presetSet.has(p)) errors.push(`catalog backtestPreset unknown: ${p}`);
}

const sp = [...catalog.matchAll(/scannerPresets:\s*\[([^\]]*)\]/g)];
for (const m of sp) {
  const ids = [...m[1].matchAll(/"([a-zA-Z0-9_]+)"/g)].map((x) => x[1]);
  for (const id of ids) {
    if (!scannerSet.has(id)) errors.push(`catalog scannerPresets unknown: ${id}`);
  }
}

if (errors.length) {
  console.error("SMOKE FAIL:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
console.log(
  `SMOKE OK: ${builtin.length} indicators, ${typeRefs.length} pack indicator refs, ${bt.length} backtest presets, scanner ok`
);
