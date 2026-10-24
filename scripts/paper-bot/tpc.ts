// @ts-nocheck
// [t145/t150] quantex.html tpcCalc birebir kopya (TP RSI bulut/TSI + PLI±). k={c: kapanış dizisi}. Yalnız kapanmış mumlar verilir.
/* eslint-disable */
export function tpcCalc(k){let R;const c=k.c,n=c.length;
  const em=(a,p)=>{const o=new Array(n).fill(NaN),al=2/(p+1);let q=NaN,s=0,m=0;for(let i=0;i<n;i++){const v=a[i];if(!isFinite(v))continue;if(!isFinite(q)){s+=v;m++;if(m===p){q=s/p;o[i]=q;}continue;}q=al*v+(1-al)*q;o[i]=q;}return o;};
  const bands=o=>{const m=new Array(n).fill(NaN),u=m.slice(),l=m.slice();for(let i=49;i<n;i++){let s=0,q=0,ok=true;for(let j=i-49;j<=i;j++){if(!isFinite(o[j])){ok=false;break;}s+=o[j];q+=o[j]*o[j];}if(!ok)continue;const mu=s/50,sd=Math.sqrt(Math.max(q/50-mu*mu,0));m[i]=mu;u[i]=mu+2*sd;l[i]=mu-2*sd;}return {m,u,l};};
  const pc=c.map((v,i)=>i?v-c[i-1]:0),num=em(em(pc,25),13),den=em(em(pc.map(Math.abs),25),13),tsi=num.map((v,i)=>den[i]?(100*v/den[i]+100)/2:NaN);
  const up=new Array(n).fill(NaN),dn=up.slice();let pu=NaN,pd=NaN;for(let i=0;i<n;i++){const u0=Math.max(pc[i],0),d0=Math.max(-pc[i],0);if(i===14){let a=0,b=0;for(let j=1;j<=14;j++){a+=Math.max(pc[j],0);b+=Math.max(-pc[j],0);}pu=a/14;pd=b/14;}else if(i>14){pu=(pu*13+u0)/14;pd=(pd*13+d0)/14;}up[i]=pu;dn[i]=pd;}
  const v1=up.map((u,i)=>{const r=100-100/(1+u/(dn[i]===0?1e-12:dn[i]));return isFinite(r)?0.1*(r-50):0;});const ift=new Array(n).fill(NaN);
  for(let i=Math.max(8,14);i<n;i++){let s=0;for(let j=0;j<9;j++)s+=(9-j)*v1[i-j];ift[i]=(Math.tanh(s/45)+1)*50;}
  const T=bands(tsi),F=bands(ift),e=p=>em(tsi,p),e21=e(21),e48=e(48),c1=e21.map((v,i)=>(v+e48[i])/2),c3=e(103).map((v,i,a)=>(v+0)/1),e149=e(149),c3m=c3.map((v,i)=>(v+e149[i])/2),e206=e(206),c5=e(499).map((v,i)=>(v+e206[i])/2);
  const X=(a,b,i)=>i>0&&a[i]>b[i]&&a[i-1]<=b[i-1],U=(a,b,i)=>i>0&&a[i]<b[i]&&a[i-1]>=b[i-1];
  const tsiMid=new Array(n).fill(false),cloudX=tsiMid.slice(),fishTop=tsiMid.slice(),tsiSlow=tsiMid.slice(),tsiG=tsiMid.slice();let armG=-1e9;let arm=-1e9;
  for(let i=1;i<n;i++){if(X(c1,c3m,i)&&c1[i]<T.m[i])arm=i;if(i-arm<=5&&i>arm&&X(tsi,T.m,i)){tsiMid[i]=true;arm=-1e9;}cloudX[i]=X(c1,c5,i);fishTop[i]=U(ift,F.u,i);if(X(tsi,T.l,i))armG=i;if(X(e21,e48,i)&&c3[i]<e149[i]&&i-armG>0&&i-armG<=20){tsiG[i]=true;armG=-1e9;}if(X(tsi,c5,i)){for(let j=Math.max(0,i-5);j<=i;j++)if(tsi[j]<T.l[j]+0.5*(T.m[j]-T.l[j])){tsiSlow[i]=true;break;}}}
  // [t150] PLI± alt band↑ (src/lib/indicators/median.ts pliDir birebir: PLI(close,50,5) alt bant, HMA-TV(55) kesişimi) + Bulut3− (EMA103<EMA149 TSI)
  const pliLoC3=new Array(n).fill(false);{const L=50,rk=0.05*(L-1),lo0=Math.floor(rk),hi0=Math.ceil(rk),wq=rk-lo0,low=new Array(n).fill(NaN);
    for(let i=L-1;i<n;i++){const w=c.slice(i-L+1,i+1).sort((a,b)=>a-b);low[i]=lo0===hi0?w[lo0]:w[lo0]*(1-wq)+w[hi0]*wq;}
    const wm=(a,p)=>{const o=new Array(n).fill(NaN),dd=p*(p+1)/2;for(let i=p-1;i<n;i++){let s=0,ok=true;for(let j=0;j<p;j++){const v=a[i-p+1+j];if(!isFinite(v)){ok=false;break;}s+=v*(j+1);}if(ok)o[i]=s/dd;}return o;};
    const h1=wm(c,27),h2=wm(c,55),hm=wm(h1.map((v,i)=>2*v-h2[i]),7);
    for(let i=1;i<n;i++){const a0=hm[i-1],a1=hm[i],b0=low[i-1],b1=low[i];if(isFinite(a0)&&isFinite(a1)&&isFinite(b0)&&isFinite(b1)&&a1>b1&&a0<=b0&&c3[i]<e149[i])pliLoC3[i]=true;}}
  R={tsiMid,cloudX,fishTop,tsiSlow,tsiG,pliLoC3,need:520};return R;}
