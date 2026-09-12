import type {
  DiagCond,
  HamCond,
  ListScanConfig,
  MacdCond,
  StochCond,
} from "@/lib/scanner/listScan";

export const HAM_FOUR: { id: HamCond; label: string }[] = [
  { id: "raw_dual_up", label: "Raw H×Y↑" },
  { id: "setup", label: "Setup" },
  { id: "confirm", label: "Onay" },
  { id: "al", label: "AL" },
];

export const DIAG_FOUR: { id: DiagCond; label: string }[] = [
  { id: "bounce", label: "Temas" },
  { id: "break", label: "Kırılım" },
  { id: "twin_bull", label: "İkili↑" },
  { id: "triple_bull", label: "Üçlü↑" },
];

export const MACD_FOUR: { id: MacdCond; label: string }[] = [
  { id: "cross_up", label: "×Sig↑" },
  { id: "cross_dn", label: "×Sig↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_pos", label: "Hist+" },
];

export const STOCH_FOUR: { id: StochCond; label: string }[] = [
  { id: "os", label: "OS" },
  { id: "kx_up", label: "K×D↑" },
  { id: "kx_up_os", label: "↑15–25" },
  { id: "ob", label: "OB" },
];

export function buildFourConfig(opts: {
  hamOn: boolean;
  hamConds: HamCond[];
  diagOn: boolean;
  diagConds: DiagCond[];
  macdOn: boolean;
  macdConds: MacdCond[];
  stochOn: boolean;
  stochConds: StochCond[];
}): ListScanConfig | null {
  if (!opts.hamOn && !opts.diagOn && !opts.macdOn && !opts.stochOn) return null;
  return {
    matchMode: "any",
    ham: {
      enabled: opts.hamOn,
      conds: opts.hamConds.length ? opts.hamConds : ["raw_dual_up"],
    },
    diag: {
      enabled: opts.diagOn,
      conds: opts.diagConds.length ? opts.diagConds : ["bounce"],
    },
    macd: {
      enabled: opts.macdOn,
      conds: opts.macdConds.length ? opts.macdConds : ["cross_up"],
    },
    stoch: {
      enabled: opts.stochOn,
      conds: opts.stochConds.length ? opts.stochConds : ["kx_up"],
    },
  };
}
