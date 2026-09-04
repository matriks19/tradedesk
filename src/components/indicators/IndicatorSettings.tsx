"use client";

import { useEffect, useState } from "react";
import { useDeskStore } from "@/store/desk";
import { BUILTIN_META } from "@/lib/indicators/registry";
import type { IndicatorInstance } from "@/lib/types";

interface Props {
  paneId: string;
  indicator: IndicatorInstance;
  open: boolean;
  onClose: () => void;
}

export function IndicatorSettings({ paneId, indicator, open, onClose }: Props) {
  const { updateIndicatorParams, setIndicatorColor } = useDeskStore();
  const [draft, setDraft] = useState(indicator.params);
  const [color, setColor] = useState(indicator.color ?? "#2962ff");

  useEffect(() => {
    if (open) {
      setDraft({ ...indicator.params });
      setColor(indicator.color ?? "#2962ff");
    }
  }, [open, indicator]);

  if (!open || indicator.type === "custom") return null;
  const meta = BUILTIN_META[indicator.type];
  if (!meta) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[min(400px,94vw)] panel shadow-2xl p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-3">
          <div className="text-sm font-semibold">{meta.label} ayarları</div>
          <button type="button" className="btn text-2xs ml-auto" onClick={onClose}>
            Kapat
          </button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {meta.inputs.map((inp) => (
            <label key={inp.key} className="block text-2xs">
              <span className="text-desk-muted">{inp.label}</span>
              {inp.type === "select" ? (
                <select
                  className="input mt-0.5"
                  value={String(draft[inp.key] ?? inp.default)}
                  onChange={(e) => {
                    const next = { ...draft, [inp.key]: e.target.value };
                    setDraft(next);
                    updateIndicatorParams(paneId, indicator.id, next);
                  }}
                >
                  {(inp.options ?? []).map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  className="input mt-0.5"
                  min={inp.min}
                  max={inp.max}
                  step={inp.step ?? 1}
                  value={Number(draft[inp.key] ?? inp.default)}
                  onChange={(e) => {
                    const next = {
                      ...draft,
                      [inp.key]: Number(e.target.value),
                    };
                    setDraft(next);
                    updateIndicatorParams(paneId, indicator.id, next);
                  }}
                />
              )}
            </label>
          ))}
          <label className="block text-2xs">
            <span className="text-desk-muted">Renk</span>
            <input
              type="color"
              className="block mt-0.5 h-8 w-full cursor-pointer bg-transparent"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setIndicatorColor(paneId, indicator.id, e.target.value);
              }}
            />
          </label>
        </div>
        <div className="mt-3 text-2xs text-desk-muted">Değişiklikler anında uygulanır.</div>
      </div>
    </div>
  );
}
