const {hamJurikTpo}=require('./ham.cjs');const fs=require('fs');
const D=require('/tmp/qx/v4/labdata.json'),C1=require('/tmp/qx/v4/labc1.json');
const EV={raw_up:['rawUp',1],raw_dn:['rawDown',-1],hist_zero_up:['histCross',1],hist_zero_dn:['histCrossDown',-1],raw_x_hist_up:['rawCrossHist',1],raw_x_hist_dn:['rawCrossHistDown',-1],raw_x_osc_up:['rawCrossOsc',1],raw_x_osc_dn:['rawCrossOscDown',-1],dual_up:['dualCrossUp',1],dual_dn:['dualCrossDown',-1],raw_dual_up:['rawDualUp',1],raw_dual_dn:['rawDualDown',-1],raw_slow_up:['rawSlowUp',1],raw_slow_dn:['rawSlowDown',-1],osc_fast_up:['oscFastUp',1],osc_fast_dn:['oscFastDown',-1],osc_slow_up:['oscSlowUp',1],osc_slow_dn:['oscSlowDown',-1],osc_fast_zero_up:['oscFastZeroUp',1],osc_slow_zero_up:['oscSlowZeroUp',1]};
const K=a=>a.map(r=>({time:r[0]/1e3,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5]}));
function bt(c,sig,dir){const o=[];let i=100;const n=c.length;while(i<n-1){if(sig[i]){const e=c[i+1].open;let r=null,j;for(j=i+1;j<Math.min(n,i+49);j++){const lo=dir>0?c[j].low/e-1:1-c[j].high/e,hi=dir>0?c[j].high/e-1:1-c[j].low/e;if(lo<=-.05){r=-.05;break}if(hi>=.10){r=.10;break}}if(r==null){j=Math.min(n-1,i+48);r=dir>0?c[j].close/e-1:1-c[j].close/e}o.push([c[i].time,r-.001]);i=j+1}else i++}return o}
function st(r){const n=r.length;if(!n)return{n:0};const w=r.filter(x=>x>0),l=r.filter(x=>x<=0);const p=w.length/n,aw=w.reduce((a,b)=>a+b,0)/(w.length||1),al=-l.reduce((a,b)=>a+b,0)/(l.length||1);const b=al>0?aw/al:9.99;return{n,p:+p.toFixed(4),b:+b.toFixed(3),ev:+(p*b-(1-p)).toFixed(4)}}
const R={};let mm=0,tot=0;
for(const [mk,U] of [['coin|4h',D.c4],['coin|1h',C1],['bist|1h',D.b1]]){const T={};
 for(const sym in U){const c=K(U[sym]);const h=hamJurikTpo(c);
  if(tot<600)for(let q=0;q<20;q++){const i=150+Math.floor(Math.random()*(c.length-151));const h2=hamJurikTpo(c.slice(0,i+1));for(const k in EV){tot++;if(!!h[EV[k][0]][i]!==!!h2[EV[k][0]][i])mm++}}
  for(const k in EV){const [f,d]=EV[k];if(mk.startsWith('bist')&&d<0)continue;(T[k]=T[k]||[]).push(...bt(c,h[f],d))}}
 for(const k in T){const t=T[k].sort((a,b)=>a[0]-b[0]),r=t.map(x=>x[1]),hh=r.length>>1;const g=st(r);g.oos=st(r.slice(hh)).ev??null;R['ham:'+k+'|'+mk]=g;console.log(k,mk,JSON.stringify(g))}}
console.log('repaint mismatch',mm,'/',tot);fs.writeFileSync('ham_ev.json',JSON.stringify(R));
