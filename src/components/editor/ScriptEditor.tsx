"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { CustomScript, ScriptLanguage } from "@/lib/types";
import {
  convertAny,
  detectLanguage,
  PINE_SAMPLE,
} from "@/lib/scripts/pine/translate";
import { TD_SAMPLES } from "@/lib/scripts/td/compile";
import {
  COMMUNITY_LIBRARY,
  catalogToScript,
  type CatalogEntry,
} from "@/lib/scripts/catalog";
import clsx from "clsx";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-48 flex items-center justify-center text-xs text-desk-muted">
      Editör yükleniyor…
    </div>
  ),
});

function uid() {
  return `script_${Math.random().toString(36).slice(2, 9)}`;
}

type EditorTab = "edit" | "library";

export function ScriptEditor() {
  const { scripts, upsertScript, applyScriptToActive } = useDeskStore();
  const [tab, setTab] = useState<EditorTab>("edit");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<ScriptLanguage>("td");
  const [originalCode, setOriginalCode] = useState<string | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [libQuery, setLibQuery] = useState("");
  const [libCategory, setLibCategory] = useState<string>("all");

  useEffect(() => {
    if (!selectedId && scripts[0]) {
      select(scripts[0]);
    }
  }, [scripts, selectedId]);

  const categories = useMemo(() => {
    const set = new Set(COMMUNITY_LIBRARY.map((e) => e.category));
    return ["all", ...[...set].sort()];
  }, []);

  const filteredLib = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    return COMMUNITY_LIBRARY.filter((e) => {
      if (libCategory !== "all" && e.category !== libCategory) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q))
      );
    });
  }, [libQuery, libCategory]);

  const select = (s: CustomScript) => {
    setSelectedId(s.id);
    setName(s.name);
    setCode(s.code);
    setLanguage(s.language ?? "td");
    setOriginalCode(s.originalCode);
    setWarnings(s.warnings ?? []);
    setTab("edit");
  };

  const persistScripts = async (next: CustomScript[]) => {
    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scripts: next }),
      });
    } catch {
      /* local only */
    }
  };

  const save = async () => {
    const script: CustomScript = {
      id: selectedId ?? uid(),
      name: name || "İsimsiz",
      code,
      language,
      originalCode,
      originalLanguage: originalCode ? "pine" : undefined,
      warnings,
      updatedAt: Date.now(),
    };
    upsertScript(script);
    setSelectedId(script.id);
    const { scripts: cur } = useDeskStore.getState();
    await persistScripts(cur);
    setStatus("Kaydedildi");
  };

  const createNew = () => {
    const sample = TD_SAMPLES[0];
    const s: CustomScript = {
      id: uid(),
      name: "Yeni TD Script",
      code: sample?.code ?? '//@version=td1\nplot(close, "Close")\n',
      language: "td",
      updatedAt: Date.now(),
    };
    upsertScript(s);
    select(s);
  };

  const installFromCatalog = async (entry: CatalogEntry, apply = false) => {
    const script = catalogToScript(entry);
    upsertScript(script);
    const { scripts: cur } = useDeskStore.getState();
    await persistScripts(cur);
    select(script);
    if (apply) {
      applyScriptToActive(script.id);
      setStatus(`Yüklendi & uygulandı: ${entry.name}`);
    } else {
      setStatus(`Kütüphaneden yüklendi: ${entry.name}`);
    }
  };

  const doImport = (target: "td" | "keep") => {
    const raw = importText.trim();
    if (!raw) return;
    const detected = detectLanguage(raw);
    if (target === "keep" && detected === "pine") {
      setOriginalCode(raw);
      setLanguage("pine");
      setCode(raw);
      setWarnings(["Pine kaydedildi — çalıştırmak için TD'ye dönüştürün"]);
      setName((n) => n || "Pine import");
      setImportOpen(false);
      return;
    }
    const result = convertAny(raw, "td");
    setOriginalCode(detected === "pine" ? raw : originalCode);
    setCode(result.code);
    setLanguage("td");
    setWarnings(result.warnings);
    setName((n) => n || (detected === "pine" ? "Pine→TD" : "İçe aktarım"));
    setStatus(`Dönüştürüldü (${detected} → td)`);
    setImportOpen(false);
  };

  const exportPine = () => {
    const result = convertAny(code, "pine");
    setWarnings(result.warnings);
    const blob = new Blob([result.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name || "script").replace(/\s+/g, "_")}.pine`;
    a.click();
    URL.revokeObjectURL(url);
    setImportText(result.code);
    setImportOpen(true);
    setStatus("Pine dışa aktarıldı");
  };

  const pineToTdInline = () => {
    const result = convertAny(code, "td");
    if (!originalCode) setOriginalCode(code);
    setCode(result.code);
    setLanguage("td");
    setWarnings(result.warnings);
    setStatus("Pine → TD");
  };

  const installedIds = useMemo(
    () => new Set(scripts.map((s) => s.id)),
    [scripts]
  );

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">TD Script / Pine</div>
      <div className="flex gap-1">
        <button
          type="button"
          className={clsx("btn text-2xs", tab === "edit" && "btn-accent")}
          onClick={() => setTab("edit")}
        >
          Editör
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs", tab === "library" && "btn-accent")}
          onClick={() => setTab("library")}
        >
          Kütüphane ({COMMUNITY_LIBRARY.length})
        </button>
      </div>

      {tab === "library" ? (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          <p className="text-2xs text-desk-muted">
            Community Library — TradingView tarzı hazır TD Script&apos;ler. Tek
            tıkla yükle / uygula.
          </p>
          <div className="flex gap-1">
            <input
              className="input flex-1 text-2xs"
              placeholder="Ara (isim, etiket…)"
              value={libQuery}
              onChange={(e) => setLibQuery(e.target.value)}
            />
            <select
              className="input w-auto text-2xs"
              value={libCategory}
              onChange={(e) => setLibCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "Tüm kategoriler" : c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredLib.map((entry) => {
              const id = `lib_${entry.id}`;
              const installed = installedIds.has(id);
              return (
                <div
                  key={entry.id}
                  className="panel p-2 space-y-1 border border-desk-border/50 rounded"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="text-xs font-medium">{entry.name}</div>
                      <div className="text-2xs text-desk-muted">
                        {entry.category}
                        {entry.popular ? " · popüler" : ""}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="btn text-2xs"
                        onClick={() => installFromCatalog(entry, false)}
                      >
                        {installed ? "Güncelle" : "Yükle"}
                      </button>
                      <button
                        type="button"
                        className="btn-accent text-2xs"
                        onClick={() => installFromCatalog(entry, true)}
                      >
                        Uygula
                      </button>
                    </div>
                  </div>
                  <p className="text-2xs text-desk-muted">{entry.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <span
                        key={t}
                        className="text-2xs px-1 rounded bg-desk-elevated text-desk-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {entry.sourceNote && (
                    <div className="text-2xs text-desk-warn">{entry.sourceNote}</div>
                  )}
                </div>
              );
            })}
            {!filteredLib.length && (
              <div className="text-2xs text-desk-muted p-2">Sonuç yok.</div>
            )}
          </div>
          {status && (
            <span className="text-2xs text-desk-muted">{status}</span>
          )}
        </div>
      ) : (
        <>
          <p className="text-2xs text-desk-muted">
            Basit DSL: sma, ema, rsi, macd, bollinger, atr, trueRange,
            sessionVwap, crossover, plot, plotshape, hline. TradingView Pine
            yapıştır → TD&apos;ye çevir.
          </p>
          <div className="flex gap-1 flex-wrap">
            {scripts.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`btn text-2xs ${selectedId === s.id ? "btn-accent" : ""}`}
                onClick={() => select(s)}
              >
                {s.name}
              </button>
            ))}
            <button type="button" className="btn" onClick={createNew}>
              + Yeni
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              type="button"
              className="btn text-2xs"
              onClick={() => setImportOpen((v) => !v)}
            >
              {importOpen ? "İçe aktarmayı kapat" : "İçe aktar (Pine/TD)"}
            </button>
            <button type="button" className="btn text-2xs" onClick={pineToTdInline}>
              → TD çevir
            </button>
            <button type="button" className="btn text-2xs" onClick={exportPine}>
              Pine olarak dışa aktar
            </button>
            <button
              type="button"
              className="btn text-2xs"
              onClick={() => {
                setImportText(PINE_SAMPLE);
                setImportOpen(true);
              }}
            >
              Pine örnek
            </button>
          </div>
          {importOpen && (
            <div className="panel p-2 space-y-1">
              <div className="text-2xs text-desk-muted">
                Ham Pine veya TD yapıştırın
              </div>
              <textarea
                className="input font-mono min-h-[90px]"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`//@version=5\nindicator("x")\nplot(ta.sma(close,20))`}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-accent text-2xs"
                  onClick={() => doImport("td")}
                >
                  Dönüştür &amp; yükle (TD)
                </button>
                <button
                  type="button"
                  className="btn text-2xs"
                  onClick={() => doImport("keep")}
                >
                  Orijinal sakla
                </button>
              </div>
            </div>
          )}
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="İsim"
          />
          <div className="flex items-center gap-2 text-2xs">
            <span className="text-desk-muted">Dil</span>
            <select
              className="input w-auto"
              value={language}
              onChange={(e) => setLanguage(e.target.value as ScriptLanguage)}
            >
              <option value="td">TD Script</option>
              <option value="js">JS (legacy)</option>
              <option value="pine">Pine (yalnızca sakla)</option>
            </select>
            {originalCode && (
              <span className="text-desk-warn">orijinal Pine saklı</span>
            )}
          </div>
          <div className="flex-1 min-h-[160px] border border-desk-border rounded overflow-hidden">
            <Monaco
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
                scrollBeyondLastLine: false,
                tabSize: 2,
              }}
            />
          </div>
          {!!warnings.length && (
            <div className="text-2xs text-desk-warn max-h-16 overflow-y-auto space-y-0.5">
              {warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
          <div className="flex gap-1 flex-wrap">
            <button type="button" className="btn-accent" onClick={save}>
              Kaydet
            </button>
            <button
              type="button"
              className="btn"
              disabled={language === "pine"}
              onClick={async () => {
                const id = selectedId ?? uid();
                const script = {
                  id,
                  name: name || "İsimsiz",
                  code,
                  language,
                  originalCode,
                  warnings,
                  updatedAt: Date.now(),
                };
                upsertScript(script);
                setSelectedId(id);
                applyScriptToActive(id);
                setStatus("Uygulandı");
              }}
            >
              Aktif grafiğe uygula
            </button>
            {status && (
              <span className="text-2xs text-desk-muted self-center">{status}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
