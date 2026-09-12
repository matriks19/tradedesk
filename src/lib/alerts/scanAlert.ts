import type { AlertScanKey, Candle } from "@/lib/types";
import { recentHamJurik } from "@/lib/indicators/hamJurikTpo";
import { recentDiagonalSr } from "@/lib/indicators/diagonalSr";
import { scanSymbol, type ListScanConfig } from "@/lib/scanner/listScan";

export const SCAN_OPTIONS: { key: AlertScanKey; label: string; group: string }[] = [
  { key: "ham_setup", label: "HAM erken AL", group: "HAM" },
  { key: "ham_confirm", label: "HAM onay", group: "HAM" },
  { key: "ham_al", label: "HAM AL", group: "HAM" },
  { key: "ham_dual_up", label: "HAM hızlı×yavaş↑", group: "HAM" },
  { key: "ham_dual_dn", label: "HAM hızlı×yavaş↓", group: "HAM" },
  { key: "diag_bounce", label: "Diag destek temas", group: "Diag" },
  { key: "diag_break", label: "Diag kırılım", group: "Diag" },
  { key: "list_scan", label: "Liste koşulu", group: "Liste" },
];

export function checkScanAlert(
  candles: Candle[],
  scanKey: AlertScanKey,
  payload?: Record<string, unknown>
): { ok: boolean; note: string } {
  switch (scanKey) {
    case "ham_setup":
      return recentHamJurik(candles, "setup", 2);
    case "ham_confirm":
      return recentHamJurik(candles, "confirm", 2);
    case "ham_al":
      return recentHamJurik(candles, "al", 2);
    case "ham_dual_up":
      return recentHamJurik(candles, "dualUp", 2, payload ?? {});
    case "ham_dual_dn":
      return recentHamJurik(candles, "dualDown", 2, payload ?? {});
    case "diag_bounce":
      return recentDiagonalSr(candles, {
        event: "bounce",
        direction: "bull",
        maxBarsAgo: 2,
      });
    case "diag_break":
      return recentDiagonalSr(candles, {
        event: "break",
        direction: "any",
        maxBarsAgo: 2,
      });
    case "list_scan": {
      if (!payload) return { ok: false, note: "" };
      const hits = scanSymbol(candles, payload as ListScanConfig, 2);
      if (!hits.length) return { ok: false, note: "" };
      return { ok: true, note: hits.map((h) => h.note).join(" · ") };
    }
    default:
      return { ok: false, note: "" };
  }
}
