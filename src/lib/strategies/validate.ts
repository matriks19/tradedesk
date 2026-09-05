import { BUILTIN_META, BUILTIN_LIST } from "@/lib/indicators/registry";
import type { BuiltinIndicatorId } from "@/lib/types";
import { PRESET_LABELS } from "@/lib/backtest/presets";
import type { StrategyPresetId } from "@/lib/backtest/types";
import { SCANNER_PRESETS } from "@/lib/scanner/engine";
import { STRATEGY_PACKS } from "./catalog";
import {
  CATEGORY_LABELS,
  STRATEGY_CATEGORY_ORDER,
  type StrategyCategory,
} from "./types";

export interface PackValidationIssue {
  packId: string;
  severity: "error" | "warn";
  message: string;
}

export function validateStrategyPacks(): PackValidationIssue[] {
  const issues: PackValidationIssue[] = [];
  const metaIds = new Set(Object.keys(BUILTIN_META));
  const listIds = new Set(BUILTIN_LIST.map((m) => m.id));
  const presetIds = new Set(Object.keys(PRESET_LABELS) as StrategyPresetId[]);
  const scannerIds = new Set(Object.keys(SCANNER_PRESETS));

  for (const id of metaIds) {
    if (!listIds.has(id as BuiltinIndicatorId)) {
      issues.push({
        packId: "_registry",
        severity: "error",
        message: `BUILTIN_META has ${id} missing from BUILTIN_LIST`,
      });
    }
  }

  for (const c of STRATEGY_CATEGORY_ORDER) {
    if (!(c in CATEGORY_LABELS)) {
      issues.push({
        packId: "_categories",
        severity: "error",
        message: `STRATEGY_CATEGORY_ORDER entry missing label: ${c}`,
      });
    }
  }
  for (const c of Object.keys(CATEGORY_LABELS) as StrategyCategory[]) {
    if (!STRATEGY_CATEGORY_ORDER.includes(c)) {
      issues.push({
        packId: "_categories",
        severity: "error",
        message: `CATEGORY_LABELS ${c} missing from STRATEGY_CATEGORY_ORDER`,
      });
    }
  }

  const seen = new Set<string>();
  for (const pack of STRATEGY_PACKS) {
    if (seen.has(pack.id)) {
      issues.push({
        packId: pack.id,
        severity: "error",
        message: "duplicate pack id",
      });
    }
    seen.add(pack.id);

    for (const ind of pack.indicators) {
      if (!BUILTIN_META[ind.type]) {
        issues.push({
          packId: pack.id,
          severity: "error",
          message: `unknown indicator type: ${ind.type}`,
        });
      }
    }

    if (pack.backtestPreset && !presetIds.has(pack.backtestPreset)) {
      issues.push({
        packId: pack.id,
        severity: "error",
        message: `unknown backtestPreset: ${pack.backtestPreset}`,
      });
    }

    for (const sp of pack.scannerPresets ?? []) {
      if (!scannerIds.has(sp)) {
        issues.push({
          packId: pack.id,
          severity: "error",
          message: `unknown scannerPresets id: ${sp}`,
        });
      }
    }

    if (pack.category === "high_edge" || pack.category === "elizi") {
      if (!pack.researchNote) {
        issues.push({
          packId: pack.id,
          severity: "warn",
          message: `${pack.category} pack missing researchNote`,
        });
      }
      if (!pack.howTo?.length) {
        issues.push({
          packId: pack.id,
          severity: "error",
          message: `${pack.category} pack missing howTo`,
        });
      }
      if (
        pack.literatureEstimate?.winRateHint &&
        pack.category === "elizi"
      ) {
        issues.push({
          packId: pack.id,
          severity: "warn",
          message:
            "elizi pack has literatureEstimate.winRateHint — Elizi is proprietary; prefer researchNote only",
        });
      }
    }
  }

  return issues;
}

export function assertStrategyPacksValid(): void {
  const issues = validateStrategyPacks().filter((i) => i.severity === "error");
  if (issues.length) {
    const msg = issues
      .map((i) => `[${i.packId}] ${i.message}`)
      .join("\n");
    throw new Error(`Strategy pack validation failed:\n${msg}`);
  }
}
