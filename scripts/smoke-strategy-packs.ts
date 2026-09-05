import { validateStrategyPacks } from "../src/lib/strategies/validate";

const issues = validateStrategyPacks();
const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");
for (const w of warns) console.warn(`[warn][${w.packId}] ${w.message}`);
if (errors.length) {
  for (const e of errors) console.error(`[error][${e.packId}] ${e.message}`);
  process.exit(1);
}
console.log(`SMOKE OK: ${issues.length} issues (0 errors, ${warns.length} warns)`);
