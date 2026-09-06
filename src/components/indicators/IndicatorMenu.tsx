"use client";

import { useMemo, useState } from "react";
import { useDeskStore } from "@/store/desk";
import {
  BUILTIN_LIST,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/indicators/registry";
import type { BuiltinIndicatorId, IndicatorCategory } from "@/lib/types";
import clsx from "clsx";
import { ListScanActions } from "@/components/scanner/ListScanActions";

interface Props {
  open: boolean;
  onClose: () => void;
  /** If set, add indicator on this parent series */
  onParentId?: string | null;
  paneId?: string;
}

export function IndicatorMenu({ open, onClose, onParentId, paneId }: Props) {
  const {
    activePaneId,
    panes,
    addIndicator,
    favoriteIndicators,
    toggleFavoriteIndicator,
  } = useDeskStore();
  const targetPane = paneId ?? activePaneId;
  const pane = panes.find((x) => x.id === targetPane);
  const [category, setCategory] = useState<IndicatorCategory | "favorites" | "all">(
    "all"
  );
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    let items = BUILTIN_LIST;
    if (onParentId) {
      items = items.filter((m) => m.acceptsSeries);
    }
    if (category === "favorites") {
      items = items.filter((m) => favoriteIndicators.includes(m.id));
    } else if (category !== "all") {
      items = items.filter((m) => m.category === category);
    }
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      items = items.filter(
        (m) =>
          m.label.toLowerCase().includes(qq) ||
          m.id.toLowerCase().includes(qq) ||
          CATEGORY_LABELS[m.category].toLowerCase().includes(qq)
      );
    }
    return items;
  }, [category, q, favoriteIndicators, onParentId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[8vh] bg-black/50" onClick={onClose}>
      <div
        className="w-[min(720px,94vw)] h-[min(520px,80vh)] panel shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-desk-border shrink-0 flex-wrap">
          <span className="text-sm font-semibold">
            {onParentId ? "Göstergeye gösterge ekle" : "Göstergeler"}
          </span>
          <input
            className="input ml-auto max-w-[220px]"
            placeholder="Ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn text-2xs" onClick={onClose}>
            Kapat
          </button>
        </div>
        {!onParentId && (
          <div className="px-3 py-1.5 border-b border-desk-border shrink-0">
            <ListScanActions />
          </div>
        )}
        <div className="flex flex-1 min-h-0">
          <div className="w-48 shrink-0 border-r border-desk-border overflow-y-auto p-1">
            <CatBtn
              active={category === "favorites"}
              onClick={() => setCategory("favorites")}
              label="★ Favoriler"
            />
            <CatBtn
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="Tümü"
            />
            {CATEGORY_ORDER.map((c) => (
              <CatBtn
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
                label={CATEGORY_LABELS[c]}
              />
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {list.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-desk-elevated group"
              >
                <button
                  type="button"
                  className="text-desk-muted hover:text-yellow-400 text-xs w-5"
                  title="Favori"
                  onClick={() => toggleFavoriteIndicator(m.id)}
                >
                  {favoriteIndicators.includes(m.id) ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  className="flex-1 text-left text-xs"
                  onClick={() => {
                    if (onParentId) {
                      const parent = pane?.indicators.find((i) => i.id === onParentId);
                      const parentMeta =
                        parent && parent.type !== "custom"
                          ? BUILTIN_LIST.find((x) => x.id === parent.type)
                          : undefined;
                      addIndicator(
                        targetPane,
                        m.id as BuiltinIndicatorId,
                        {
                          type: "indicator",
                          indicatorId: onParentId,
                          seriesKey: parentMeta?.primarySeriesKey,
                        },
                        onParentId
                      );
                    } else {
                      addIndicator(targetPane, m.id as BuiltinIndicatorId);
                    }
                    onClose();
                  }}
                >
                  <div>
                    <span className="font-medium">{m.label}</span>
                    <span className="text-2xs text-desk-muted ml-2">
                      {CATEGORY_LABELS[m.category]} · {m.pane}
                    </span>
                    {m.description ? (
                      <div className="text-2xs text-desk-muted/80 mt-0.5 line-clamp-2">
                        {m.description}
                      </div>
                    ) : null}
                  </div>
                </button>
              </div>
            ))}
            {!list.length && (
              <div className="text-2xs text-desk-muted p-4">Sonuç yok</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "w-full text-left px-2 py-1.5 rounded text-2xs mb-0.5",
        active ? "bg-desk-accent/20 text-desk-accent" : "hover:bg-desk-elevated"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
