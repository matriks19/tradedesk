"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { CustomScript, ScriptLanguage } from "@/lib/types";
import {
  convertAny,
  detectLanguage,
  PINE_SAMPLE,
} from "@/lib/scripts/pine/translate";
import { TD_SAMPLES } from "@/lib/scripts/td/compile";

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

export function ScriptEditor() {
  const { scripts, upsertScript, applyScriptToActive } = useDeskStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<ScriptLanguage>("td");
  const [originalCode, setOriginalCode] = useState<string | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    if (!selectedId && scripts[0]) {
      select(scripts[0]);
    }
  }, [scripts, selectedId]);

  const select = (s: CustomScript) => {
    setSelectedId(s.id);
    setName(s.name);
    setCode(s.code);
    setLanguage(s.language ?? "td");
    setOriginalCode(s.originalCode);
    setWarnings(s.warnings ?? []);
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
    try {
      const res = await fetch("/api/store");
      const db = await res.json();
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scripts: [
            ...db.scripts.filter((x: CustomScript) => x.id !== script.id),
            script,
          ],
        }),
      });
      setStatus("Kaydedildi");
    } catch {
      setStatus("Yerel kaydedildi");
    }
  };

  const createNew = () => {
    const sample = TD_SAMPLES[0];
    const s: CustomScript = {
      id: uid(),
      name: "Yeni TD Script",
      code: sample?.code ?? "//@version=td1\nplot(close, \"Close\")\n",
      language: "td",
      updatedAt: Date.now(),
    };
    upsertScript(s);
    select(s);
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
    // also copy-friendly: show in import box
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

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">TD Script / Pine</div>
      <p className="text-2xs text-desk-muted">
        Basit DSL: sma, ema, rsi, macd, bollinger, crossover, plot, plotshape,
        hline. TradingView Pine yapıştır → TD&apos;ye çevir.
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
        <button type="button" className="btn text-2xs" onClick={() => setImportOpen((v) => !v)}>
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
            <button type="button" className="btn-accent text-2xs" onClick={() => doImport("td")}>
              Dönüştür &amp; yükle (TD)
            </button>
            <button type="button" className="btn text-2xs" onClick={() => doImport("keep")}>
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
    </div>
  );
}
