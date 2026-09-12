import type { AlertScanKey, Candle } from "@/lib/types";
import { recentHamJurik } from "@/lib/indicators/hamJurikTpo";
import { recentDiagonalSr } from "@/lib/indicators/diagonalSr";

export const SCAN_OPTIONS: { key: AlertScanKey; label: string; group: string }[] = [
  { key: "ham_setup", label: "HAM erken AL", group: "HAM" },
  { key: "ham_confirm", label: "HAM onay", group: "HAM" },
  { key: "ham_al", label: "HAM AL", group: "HAM" },
  { key: "diag_bounce", label: "Diag destek temas", group: "Diag" },
  { key: "diag_break", label: "Diag kırılım", group: "Diag" },
];

export function checkScanAlert(
  candles: Candle[],
  scanKey: AlertScanKey
): { ok: boolean; note: string } {
  switch (scanKey) {
    case "ham_setup":
      return recentHamJurik(candles, "setup", 2);
    case "ham_confirm":
      return recentHamJurik(candles, "confirm", 2);
    case "ham_al":
      return recentHamJurik(candles, "al", 2);
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
    default:
      return { ok: false, note: "" };
  }
}
