"use client";

import { useEffect, useState } from "react";
import { useDeskStore } from "@/store/desk";
import { BUILTIN_META } from "@/lib/indicators/registry";
import type { IndicatorInputDef, IndicatorInstance } from "@/lib/types";

interface Props {
  paneId: string;
  indicator: IndicatorInstance;
  open: boolean;
  onClose: () => void;
}

type Params = Record<string, number | string>;

/** Şema güdümlü ayar penceresi: number/select girdiler + bool anahtarlar (gruplu). */
export function IndicatorSettings({ paneId, indicator, open, onClose }: Props) {
  const { updateIndicatorParams, setIndicatorColor } = useDeskStore();
  const [draft, setDraft] = useState<Params>(indicator.params);
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

  const apply = (next: Params) => {
    setDraft(next);
    updateIndicatorParams(paneId, indicator.id, next);
  };
  const isOn = (inp: IndicatorInputDef) => Number(draft[inp.key] ?? inp.default) !== 0;

  const fields = meta.inputs.filter((i) => i.type !== "bool");
  const general = meta.inputs.filter((i) => i.type === "bool" && !i.group);
  const groups = new Map<string, IndicatorInputDef[]>();
  for (const inp of meta.inputs) {
    if (inp.type !== "bool" || !inp.group) continue;
    const arr = groups.get(inp.group) ?? [];
    arr.push(inp);
    groups.set(inp.group, arr);
  }

  const toggle = (inp: IndicatorInputDef) => (
    <label key={inp.key} className="flex items-center gap-1.5 text-2xs cursor-pointer select-none">
      <input
        type="checkbox"
        data-key={inp.key}
        checked={isOn(inp)}
        onChange={(e) => apply({ ...draft, [inp.key]: e.target.checked ? 1 : 0 })}
      />
      <span>{inp.label}</span>
    </label>
  );

  const setAll = (list: IndicatorInputDef[], v: 0 | 1) => {
    const next = { ...draft };
    for (const i of list) next[i.key] = v;
    apply(next);
  };

  const resetDefaults = () => {
    const next: Params = { ...draft };
    for (const i of meta.inputs) next[i.key] = i.default;
    apply(next);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[min(460px,94vw)] panel shadow-2xl p-3"
        onClick={(e) => e.stopPropagation()}
        data-testid="indicator-settings"
      >
        <div className="flex items-center mb-3 gap-2">
          <div className="text-sm font-semibold">{meta.label} ayarları</div>
          <button type="button" className="btn text-2xs ml-auto" onClick={resetDefaults} title="Tüm girdileri ve anahtarları varsayılana döndür">
            Varsayılan
          </button>
          <button type="button" className="btn text-2xs" onClick={onClose}>
            Kapat
          </button>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {fields.length > 0 && (
            <div>
              <div className="text-2xs font-semibold text-desk-muted mb-1">Girdiler</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                {fields.map((inp) => (
                  <label key={inp.key} className="block text-2xs min-w-0">
                    <span className="text-desk-muted truncate block" title={inp.label}>{inp.label}</span>
                    {inp.type === "select" ? (
                      <select
                        className="input mt-0.5"
                        value={String(draft[inp.key] ?? inp.default)}
                        onChange={(e) => apply({ ...draft, [inp.key]: e.target.value })}
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
                          const v = Number(e.target.value);
                          if (e.target.value === "" || !Number.isFinite(v)) return;
                          apply({ ...draft, [inp.key]: v });
                        }}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
          {general.length > 0 && (
            <div>
              <div className="text-2xs font-semibold text-desk-muted mb-1">Genel</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">{general.map(toggle)}</div>
            </div>
          )}
          {[...groups.entries()].map(([g, list]) => (
            <div key={g}>
              <div className="flex items-center text-2xs font-semibold text-desk-muted mb-1">
                <span>{g}</span>
                <button type="button" className="ml-auto hover:text-desk-text px-1" onClick={() => setAll(list, 1)}>
                  hepsi
                </button>
                <button type="button" className="hover:text-desk-text px-1" onClick={() => setAll(list, 0)}>
                  hiçbiri
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">{list.map(toggle)}</div>
            </div>
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
        <div className="mt-3 text-2xs text-desk-muted">
          Değişiklikler anında uygulanır ve kaydedilir. Sinyal anahtarları yalnız grafiği etkiler; Liste tarama chip’leri ve alarmlar ayrı.
        </div>
      </div>
    </div>
  );
}
