"use client";

import { LAYOUT_OPTIONS, useDeskStore } from "@/store/desk";
import clsx from "clsx";

export function TopBar() {
  const { layoutMode, setLayoutMode } = useDeskStore();
  return (
    <header className="h-11 shrink-0 flex items-center gap-3 px-3 border-b border-desk-border bg-desk-panel">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-desk-accent flex items-center justify-center text-white text-xs font-bold">
          TD
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">TradeDesk</div>
          <div className="text-2xs text-desk-muted">Binance · BIST</div>
        </div>
      </div>
      <div className="h-5 w-px bg-desk-border" />
      <div className="flex items-center gap-1">
        <span className="text-2xs text-desk-muted mr-1">Düzen</span>
        {LAYOUT_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={clsx("btn px-2", layoutMode === m && "btn-accent")}
            onClick={() => setLayoutMode(m)}
            title={`${m} panel`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 text-2xs text-desk-muted">
        <span className="hidden sm:inline">Canlı Binance WS · BIST gecikmeli</span>
        <span className="w-1.5 h-1.5 rounded-full bg-desk-up animate-pulse" />
      </div>
    </header>
  );
}
