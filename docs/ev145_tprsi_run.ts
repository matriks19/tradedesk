import { computeTprsi } from "@/lib/indicators/tprsi";
import * as fs from "fs";
const K: Record<string,string> = { al:"tp_al", sat:"tp_sat", p3:"tp_p3", sq:"tp_sq", bdiv:"tp_bdiv", bdivh:"tp_bdivh", jf:"tp_jf" };
for (const line of fs.readFileSync("/workspace/evlab139/jobs.txt","utf8").trim().split("\n")) {
  const [sym, tf, maxB] = line.split(/\s+/); const fn = `/workspace/zdata/${sym}_${tf}v.json`; if (!fs.existsSync(fn)) continue;
  const cs = JSON.parse(fs.readFileSync(fn,"utf8")).slice(-(+maxB)).map((r:number[])=>({time:r[0]/1000,open:r[1],high:r[2],low:r[3],close:r[4],volume:r[5]}));
  const R = computeTprsi(cs), FEE=0.001,TP=0.10,SL=0.05,H=48, out:any[]=[], W=500;
  for (let i = Math.max(W, R.need); i < cs.length-1; i++) for (const k in K) { if (!(R.ev as any)[k][i]) continue;
    const short = k==="sat", e = cs[i+1].open; let r: number|null = null;
    for (let j=i+1;j<Math.min(cs.length,i+1+H);j++){const c=cs[j];const lo=short?(e-c.high)/e:(c.low-e)/e,hi=short?(e-c.low)/e:(c.high-e)/e;if(lo<=-SL){r=-SL;break;}if(hi>=TP){r=TP;break;}}
    if (r===null){const j=Math.min(cs.length-1,i+H);r=short?(e-cs[j].close)/e:(cs[j].close-e)/e;}
    out.push(["tprsi:"+K[k], i, r-2*FEE, cs.length]); }
  const f = `/workspace/evlab139/out/${sym}_${tf}.json`; const prev = fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")).filter((x:any)=>!String(x[0]).startsWith("tprsi:")):[];
  fs.writeFileSync(f, JSON.stringify(prev.concat(out))); console.log(sym, tf, cs.length, out.length);
}
