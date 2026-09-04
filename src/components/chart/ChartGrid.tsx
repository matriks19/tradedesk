"use client";

import { useDeskStore } from "@/store/desk";
import { ChartPane } from "./ChartPane";
import clsx from "clsx";

const GRID: Record<number, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-2 grid-rows-1",
  4: "grid-cols-2 grid-rows-2",
  6: "grid-cols-3 grid-rows-2",
  9: "grid-cols-3 grid-rows-3",
};

export function ChartGrid() {
  const { layoutMode, panes } = useDeskStore();
  return (
    <div className={clsx("h-full w-full grid gap-1 p-1", GRID[layoutMode])}>
      {panes.map((p) => (
        <ChartPane key={p.id} pane={p} compact={layoutMode > 4} />
      ))}
    </div>
  );
}
