"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { PickItem } from "@/lib/ui/pickGroups";
import { groupItems } from "@/lib/ui/pickGroups";

export function GroupedPick(props: {
  items: PickItem[];
  order: string[];
  selected: string | string[];
  onPick: (id: string) => void;
  multi?: boolean;
  placeholder?: string;
  maxH?: string;
}) {
  const {
    items,
    order,
    selected,
    onPick,
    multi,
    placeholder = "Ara…",
    maxH = "max-h-36",
  } = props;
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("Tümü");
  const selectedSet = useMemo(() => {
    const arr = Array.isArray(selected) ? selected : selected ? [selected] : [];
    return new Set(arr);
  }, [selected]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (group !== "Tümü" && it.group !== group) return false;
      if (!qq) return true;
      return (
        it.label.toLowerCase().includes(qq) ||
        it.id.toLowerCase().includes(qq) ||
        it.group.toLowerCase().includes(qq) ||
        (it.hint ?? "").toLowerCase().includes(qq)
      );
    });
  }, [items, q, group]);

  const grouped = useMemo(
    () => groupItems(filtered, order),
    [filtered, order]
  );
  const groups = useMemo(() => {
    const present = new Set(items.map((i) => i.group));
    return ["Tümü", ...order.filter((g) => present.has(g))];
  }, [items, order]);

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <input
        className="input text-2xs w-full"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="flex gap-0.5 overflow-x-auto pb-0.5">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            className={clsx(
              "btn text-2xs whitespace-nowrap",
              group === g && "btn-accent"
            )}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>
      <div className={clsx("overflow-y-auto flex flex-col gap-1.5", maxH)}>
        {grouped.map((g) => (
          <div key={g.group} className="min-w-0">
            {group === "Tümü" ? (
              <div className="text-2xs text-desk-muted px-0.5 mb-0.5">
                {g.group}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1">
              {g.items.map((it) => {
                const on = selectedSet.has(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    title={it.hint || it.label}
                    className={clsx("btn text-2xs", on && "btn-accent")}
                    onClick={() => onPick(it.id)}
                  >
                    {it.label}
                    {multi && on ? " ×" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!grouped.length ? (
          <div className="text-2xs text-desk-muted px-1">Eşleşme yok</div>
        ) : null}
      </div>
    </div>
  );
}
