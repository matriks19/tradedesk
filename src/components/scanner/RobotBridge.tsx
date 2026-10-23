"use client";
// [bridge138 + kombin140] Robota bağla satırları (ayar + test), Kombin robot (oylama/ağırlık), robot durum paneli.
// Sadece kendi qx_* anahtarlarını yazar; robot pozisyonlarına/ayarlarına dokunmaz.
import { useEffect, useMemo, useRef, useState } from "react";
import { getLinks, setLink, BUS_KEY, paramsOf, hashOf, baseHash, userEv, getKombin, setKombin, type Kombin, type BusSignal, type EvRow } from "@/lib/signalBus";

type Pos = { sym: string; side: string; entry: number; src?: string; t: number };
type Td = Record<string, { n: number; p: number; b: number; ev: number; oos: number }>;
const TFMS: Record<string, number> = { "15m": 9e5, "30m": 18e5, "1h": 36e5, "2h": 72e5, "4h": 144e5, "1d": 864e5 };
const NAMES: Record<string, string> = { pliDir: "PLI± Yönlü Oran", pliDmi: "PLI± DMI Hibrit", pliDtDiv: "PLI-DT Uyumsuzluk", maSimple: "MA kesişim", ema30Band: "EMA30 Band", gold: "Gold", gold2: "Gold2", divScan: "Uyumsuzluk", multiDip: "Çoklu dip", hamAo: "HAM AO", eliziLdr4: "ELIZI-LDR4", hull: "Doktor Hull", di: "DI kesişim" };
export const PRESETS: Kombin[] = [
  { name: "Hazır kombin 4s (9 gösterge, en az 3 AL)", on: true, tf: "4h", K: 3, minScore: 0, M: 2, chips: ["pliDtDiv:pdt_d_div","gold2:div_bull","ema30Band:e30_long","ema30Band:e30_rev_long","pliDir:pli_lo_up","pliDmi:comb_top","gold:div_bull","pliDtDiv:pdt_bull","maSimple:x_20_200"].map((k) => ({ k, w: 1 })) },
  { name: "Hazır kombin 1s (7 gösterge, en az 3 AL)", on: true, tf: "1h", K: 3, minScore: 0, M: 2, chips: ["pliDir:pli_hi_up","pliDtDiv:pdt_bull","maSimple:x_50_200","ema30Band:e30_brk_long","pliDir:pli_lo_up","divScan:macd_hist|hid_bull","ema30Band:e30_rev_long"].map((k) => ({ k, w: 1 })) },
];
const nm = (k: string) => { const [kind, ...c] = k.split(":"); return `${NAMES[kind] || kind} · ${c.join(":")}`; };
function readSt() {
  try {
    const st = JSON.parse(localStorage.getItem("qxbot_state_v1") || "{}") || {};
    const bus = (JSON.parse(localStorage.getItem(BUS_KEY) || "[]") || []) as BusSignal[];
    const hb = +(localStorage.getItem("qx_bus_hb") || 0);
    return { running: !!st.running, open: (st.open || []) as Pos[], log: ((st.log || []) as unknown[]).slice(-4).map(String), bus, hb };
  } catch { return { running: false, open: [] as Pos[], log: [] as string[], bus: [] as BusSignal[], hb: 0 }; }
}
function withWeights(k: Kombin, td: Td): Kombin {
  const raw = k.chips.map((c) => Math.max(0, td[`${c.k}|coin|${k.tf}`]?.oos ?? 0));
  const mx = Math.max(...raw, 1e-9);
  return { ...k, chips: k.chips.map((c, i) => ({ ...c, w: +(raw[i] / mx).toFixed(2) || 0.1 })) };
}
const big = "text-sm";
const btn = "px-2 py-1 rounded border border-desk-border text-sm";

export function RobotBridge({ kinds, tf, cfg, onTest, onAuto, running }: {
  kinds: string[]; tf: string; cfg: Record<string, unknown>;
  onTest: (kind: string, onProg: (m: string) => void) => Promise<Record<string, EvRow>>;
  onAuto: () => void; running: boolean;
}) {
  const [links, setL] = useState<string[]>([]);
  const [s, setS] = useState(readSt);
  const [td, setTd] = useState<Td>({});
  const [prog, setProg] = useState<Record<string, string>>({});
  const [ue, setUe] = useState<Record<string, EvRow>>({});
  const [km, setKm] = useState<Kombin | null>(null);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(running);
  autoRef.current = running;
  useEffect(() => {
    setL(getLinks()); setUe(userEv()); setKm(getKombin());
    try { setAuto(localStorage.getItem("qx_bus_auto") === "1"); } catch {}
    fetch("/ev_stats.json").then((r) => r.json()).then((d) => setTd(d.td || {})).catch(() => {});
    const t = setInterval(() => setS(readSt()), 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { // Otomatik tarama: 15 dk (sekme açıkken)
    if (!auto) return;
    const t = setInterval(() => { if (!autoRef.current) onAuto(); }, 15 * 60000);
    return () => clearInterval(t);
  }, [auto, onAuto]);
  const qxOpen = Date.now() - s.hb < 3 * 60000;
  const saveKm = (k: Kombin) => {
    setKm(k); setKombin(k);
    if (k.on) { const need = new Set(k.chips.map((c) => c.k.split(":")[0])); need.forEach((x) => setLink(x, true)); setL(getLinks()); }
  };
  const scores = useMemo(() => {
    if (!km) return [];
    const ms = (TFMS[km.tf] || 36e5) * km.M, now = Date.now(), W = new Map(km.chips.map((c) => [c.k, c.w]));
    const by: Record<string, Set<string>> = {};
    for (const g of s.bus) {
      if (g.market !== "coin" || g.side !== "LONG" || g.tf !== km.tf || now - g.t > ms) continue;
      const k = `${g.src}:${g.cond}`; if (!W.has(k)) continue;
      (by[g.symbol] ||= new Set()).add(k);
    }
    const tot = km.chips.reduce((a, c) => a + c.w, 0) || 1;
    return Object.entries(by).map(([sym, v]) => ({ sym, v: [...v], n: v.size, sc: [...v].reduce((a, k) => a + (W.get(k) || 0), 0), tot }))
      .sort((a, b) => b.n - a.n || b.sc - a.sc).slice(0, 15);
  }, [km, s.bus]);
  const passing = useMemo(() => Object.entries(td).filter(([k, v]) => k.endsWith(`|coin|${km?.tf || "4h"}`) && v.n >= 30 && v.ev > 0 && v.oos > 0)
    .map(([k]) => k.split("|coin|")[0]).sort(), [td, km?.tf]);

  return (
    <div className="border border-desk-border/40 rounded p-2 mb-1 space-y-2 text-sm leading-snug">
      {/* Robot durumu */}
      <div className={big}>
        🤖 Robot: <b>{s.running ? "🟢 çalışıyor (KÂĞIT)" : "🔴 durdu"}</b> · açık {s.open.length} · sinyal yolu {s.bus.length}
        {!qxOpen && <div className="text-desk-down">QUANTEX sekmesi kapalı — sinyaller o sekme açılınca işlenir.</div>}
        {" "}<a className="underline" href="/quantex.html#robot" target="_blank" rel="noreferrer">Robotu aç</a>
      </div>
      {s.open.slice(0, 5).map((p) => <div key={p.sym + p.t} className="font-mono text-xs">{p.sym} {p.side} @{p.entry} · {p.src || ""}</div>)}
      {s.log.map((l, i) => <div key={i} className="text-desk-muted truncate text-xs">{l}</div>)}
      <label className="flex gap-2 items-center"><input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); try { localStorage.setItem("qx_bus_auto", e.target.checked ? "1" : "0"); } catch {} }} /> Bu listeyi 15 dakikada bir otomatik tara (sekme açıkken)</label>

      {/* Robota bağla satırları */}
      <div className="font-semibold">Robota bağla (TF: {tf})</div>
      {kinds.length ? kinds.map((k) => {
        const on = links.includes(k); const p = paramsOf(cfg[k]); const ph = hashOf(p); const chg = ph !== baseHash(k, ph);
        const mine = Object.entries(ue).filter(([key]) => key.startsWith(k + ":") && key.endsWith(`|coin|${tf}|${ph}`));
        const ps = Object.entries(p).filter(([, v]) => typeof v === "number" || typeof v === "boolean" || typeof v === "string").slice(0, 6).map(([a, v]) => `${a}=${v}`).join(" · ");
        return (
          <div key={k} className="border border-desk-border/30 rounded p-1.5">
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" className={on ? `${btn} bg-desk-up/30 border-desk-up` : btn} onClick={() => { setLink(k, !on); setL(getLinks()); }}>{on ? "✓ Bağlı" : "Bağla"}</button>
              <b>{NAMES[k] || k}</b>
            </div>
            <div className="text-xs text-desk-muted break-words">Ayar: {ps || "varsayılan"} (ayarları yukarıdaki kartta değiştir)</div>
            {chg && !mine.length && <div className="text-desk-down">⚠ ayar değişti — test gerekli (robot bu ayarla işlem açmaz)</div>}
            <div className="flex flex-wrap gap-2 items-center mt-1">
              <button type="button" className={btn} disabled={!!prog[k] && prog[k] !== "bitti"} onClick={async () => { await onTest(k, (m) => setProg((o) => ({ ...o, [k]: m }))); setUe(userEv()); }}>Bu ayarla test et</button>
              {prog[k] && <span className="text-xs">{prog[k] === "bitti" ? "✓ test bitti" : "test: " + prog[k]}</span>}
            </div>
            {mine.map(([key, v]) => <div key={key} className="text-xs">{v.n >= 30 && v.ev > 0 && v.oos > 0 ? "🟢" : "⚪"} {key.split("|")[0].split(":").slice(1).join(":")} · n={v.n} · EV {v.ev.toFixed(2)} · test EV {v.oos.toFixed(2)}</div>)}
          </div>
        );
      }) : <div className="text-desk-muted">Önce yukarıda bir tarama kartı aç.</div>}

      {/* Kombin robot */}
      <div className="border-t border-desk-border/40 pt-2">
        <div className="font-semibold text-base">🧩 Kombin robot (oylama)</div>
        <div className="text-xs text-desk-muted">Seçili göstergelerden en az K tanesi aynı coinde son M mum içinde AL verirse robot LONG açar (KÂĞIT, tek pozisyon, global SL aynı). Kombin açıkken tekil köprü sinyalleri işlem açmaz.</div>
        <div className="flex flex-wrap gap-2 my-1">
          {PRESETS.map((p) => <button key={p.name} type="button" className={btn} onClick={() => saveKm(withWeights(p, td))}>{p.name}</button>)}
        </div>
        {km && (<>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={km.on} onChange={(e) => saveKm({ ...km, on: e.target.checked })} /> <b>Kombin açık</b></label>
          <div className="flex flex-wrap gap-2 items-center my-1">
            <span>TF</span><select className="bg-desk-elevated" value={km.tf} onChange={(e) => saveKm({ ...km, tf: e.target.value })}>{["1h", "4h"].map((x) => <option key={x}>{x}</option>)}</select>
            <span>En az K AL</span><input className="w-12 bg-desk-elevated" type="number" min={1} value={km.K} onChange={(e) => saveKm({ ...km, K: Math.max(1, +e.target.value || 1) })} />
            <span>Puan eşiği</span><input className="w-16 bg-desk-elevated" type="number" step={0.1} min={0} value={km.minScore} onChange={(e) => saveKm({ ...km, minScore: Math.max(0, +e.target.value || 0) })} />
            <span>Son M mum</span><input className="w-12 bg-desk-elevated" type="number" min={1} value={km.M} onChange={(e) => saveKm({ ...km, M: Math.max(1, +e.target.value || 2) })} />
          </div>
          {km.chips.map((c, i) => (
            <div key={c.k} className="flex gap-2 items-center">
              <button type="button" className="text-desk-down px-1" onClick={() => saveKm({ ...km, chips: km.chips.filter((_, j) => j !== i) })}>✕</button>
              <span className="flex-1 break-words">{nm(c.k)}</span>
              <span className="text-xs">ağırlık</span>
              <input className="w-14 bg-desk-elevated" type="number" step={0.1} min={0} value={c.w} onChange={(e) => saveKm({ ...km, chips: km.chips.map((x, j) => j === i ? { ...x, w: Math.max(0, +e.target.value || 0) } : x) })} />
            </div>
          ))}
          <select className="bg-desk-elevated w-full my-1" value="" onChange={(e) => { const k = e.target.value; if (k && !km.chips.some((c) => c.k === k)) saveKm(withWeights({ ...km, chips: [...km.chips, { k, w: 1 }] }, td)); }}>
            <option value="">+ Gösterge ekle (testi geçenler, {km.tf})</option>
            {passing.map((k) => <option key={k} value={k}>{nm(k)}</option>)}
          </select>
          <div className="font-semibold mt-1">Canlı puan (son {km.M} mum)</div>
          {scores.length ? scores.map((x) => (
            <div key={x.sym} className="mb-1">
              <div className="flex justify-between"><b>{x.sym}</b><span>{x.n}/{km.K} AL · puan {x.sc.toFixed(2)}{x.n >= km.K && x.sc >= km.minScore ? " ✅" : ""}</span></div>
              <div className="h-2 bg-desk-border/40 rounded"><div className="h-2 rounded bg-desk-up" style={{ width: `${Math.min(100, (x.n / km.K) * 100)}%` }} /></div>
              <div className="text-xs text-desk-muted break-words">{x.v.map(nm).join(" · ")}</div>
            </div>
          )) : <div className="text-desk-muted">Henüz oy yok — {km.tf} TF'de listeyi tara.</div>}
        </>)}
      </div>
    </div>
  );
}
