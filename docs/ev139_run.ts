import { scanSymbol, ALL_DIV_OSC, ALL_DIV_TYPES } from "@/lib/scanner/listScan";
import * as fs from "fs";
const C = JSON.parse(fs.readFileSync("/tmp/conds.json", "utf8"));
const KINDS: Record<string, string> = { macd:"Macd",stoch:"Stoch",diag:"Diag",di:"Di",hull:"Hull",hamAo:"HamAo",gold:"Gold",gold2:"Gold2",multiDip:"MultiDip",bbDivLg:"BbDivLg",obFall:"ObFall",maSimple:"MaSimple",kijunBb:"KijunBb",cmo:"Cmo",pliDir:"PliDir",pliDmi:"PliDmi",pliDtDiv:"PliDtDiv",ppoDsiZ:"PpoDsiZ",eliziLdr4:"EliziLdr4",ema30Band:"Ema30Band",fractal8:"Fractal8",jfkps:"Jfkps",mdo:"Mdo" };
const cfg: any = { matchMode: "any" };
for (const [k, t] of Object.entries(KINDS)) cfg[k] = { enabled: true, conds: C[t] };
cfg.divScan = { enabled: true, oscillators: ALL_DIV_OSC, types: ALL_DIV_TYPES };
const [sym, tf, maxB] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(`/workspace/zdata/${sym}_${tf}v.json`, "utf8")).slice(-(+maxB));
const cs = raw.map((r: number[]) => ({ time: r[0] / 1000, open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
const W = 500, FEE = 0.001, TP = 0.10, SL = 0.05, H = 48; const out: any[] = [];
for (let i = W; i < cs.length - 1; i++) {
  let hits: any[] = []; try { hits = scanSymbol(cs.slice(i - W, i + 1), cfg, 0); } catch { continue; }
  for (const h of hits) { if (h.barsAgo !== 0 || h.bias === "neutral") continue;
    const short = h.bias === "bear"; const e = cs[i + 1].open; let r: number | null = null;
    for (let j = i + 1; j < Math.min(cs.length, i + 1 + H); j++) { const c = cs[j];
      const lo = short ? (e - c.high) / e : (c.low - e) / e, hi = short ? (e - c.low) / e : (c.high - e) / e;
      if (lo <= -SL) { r = -SL; break; } if (hi >= TP) { r = TP; break; } }
    if (r === null) { const j = Math.min(cs.length - 1, i + H); r = short ? (e - cs[j].close) / e : (cs[j].close - e) / e; }
    out.push([h.kind + ":" + h.cond, i, r - 2 * FEE, cs.length]); }
}
fs.writeFileSync(`/workspace/evlab139/out/${sym}_${tf}.json`, JSON.stringify(out));
