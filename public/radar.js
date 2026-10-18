function qxResample(k,tfMs,htfMs){var n=k.c.length,map=new Array(n).fill(-1);
  if(!(htfMs>tfMs)){for(var z=0;z<n;z++)map[z]=z;return {k:k,map:map};}
  var o={t:[],o:[],h:[],l:[],c:[],v:[]},first=[],avail=[],bs=null;
  for(var i=0;i<n;i++){var b=Math.floor(k.t[i]/htfMs)*htfMs,vv=(k.v&&+k.v[i])||0;
    if(b!==bs){if(o.t.length&&avail[o.t.length-1]<0)avail[o.t.length-1]=i; bs=b;o.t.push(b);o.o.push(k.o[i]);o.h.push(k.h[i]);o.l.push(k.l[i]);o.c.push(k.c[i]);o.v.push(vv);first.push(k.t[i]);avail.push(-1);}
    else{var j=o.t.length-1;if(k.h[i]>o.h[j])o.h[j]=k.h[i];if(k.l[i]<o.l[j])o.l[j]=k.l[i];o.c[j]=k.c[i];o.v[j]+=vv;}
    if(k.t[i]+tfMs>=b+htfMs)avail[o.t.length-1]=i;}
  var skip0=o.t.length&&first[0]>o.t[0]?1:0,cur=-1,ptr=skip0;
  // avail sırası artan; mum i'de avail≤i olan son kova
  for(i=0;i<n;i++){while(ptr<o.t.length&&avail[ptr]>=0&&avail[ptr]<=i){cur=ptr;ptr++;}map[i]=cur;}
  if(skip0)for(i=0;i<n;i++)if(map[i]===0)map[i]=-1;
  return {k:o,map:map};}
function lxJurik(src,len,phase){var n=src.length,out=new Array(n).fill(NaN),f=-1,i;for(i=0;i<n;i++)if(isFinite(src[i])){f=i;break;}if(f<0)return out;
  // loxxjuriktools/1 jurik_filt birebir: tüm durumlar nz()→0'dan başlar (bsmax/bsmin dahil); na girişli ilk mumlar nz ile 0 sayılır
  var len1=Math.max(Math.log(Math.sqrt(0.5*(len-1)))/Math.log(2)+2,0),len2=Math.sqrt(0.5*(len-1))*len1,pow1=Math.max(len1-2,0.5),beta=0.45*(len-1)/(0.45*(len-1)+2),
    div=1/(10+10*Math.min(Math.max(len-10,0),100)/100),PR=phase<-100?0.5:phase>100?2.5:1.5+phase*0.01,bet=len2/(len2+1),avL=2/(Math.max(4*len,30)+1);
  var bsmax=0,bsmin=0,vsum=0,avolty=0,ma1=0,det0=0,e2=0,jrk=0,vh=[];
  for(i=f;i<n;i++){var x=src[i],c=i-f;if(!isFinite(x)){out[i]=NaN;continue;}
    var del1=x-bsmax,del2=x-bsmin,volty=Math.abs(del1)>Math.abs(del2)?Math.abs(del1):Math.abs(del2);vh.push(volty);
    vsum=vsum+div*(volty-(c>=10?vh[c-10]:0));avolty=avolty+avL*(vsum-avolty);
    var dV=avolty>0?volty/avolty:0,dVolty=Math.max(1,Math.min(Math.pow(len1,1/pow1),dV)),pow2=Math.pow(dVolty,pow1),Kv=Math.pow(bet,Math.sqrt(pow2));
    bsmax=del1>0?x:x-Kv*del1;bsmin=del2<0?x:x-Kv*del2;
    var alpha=Math.pow(beta,pow2);
    ma1=(1-alpha)*x+alpha*ma1;det0=(x-ma1)*(1-beta)+beta*det0;
    var ma2=ma1+PR*det0;
    e2=(ma2-jrk)*Math.pow(1-alpha,2)+alpha*alpha*e2;jrk=e2+jrk;
    out[i]=jrk;}
  return out;}
function jfOpts(S){S=S||{};var g=function(v,d){v=Math.round(+v);return isFinite(v)&&v>0?v:d;};return {len:g(S.jfLen,23),x:g(S.jfX,13),sm:g(S.jfSm,8),jl:g(S.jfJLen,25),ph:Math.max(-100,Math.min(100,isFinite(+S.jfPh)?+S.jfPh:0))};}
function jfkpsCalc(k,S){var o=jfOpts(S),n=k.c.length,lb=o.len*o.x,al=2/(1+o.sm),K=new Array(n),DF=new Array(n),DS=new Array(n),i,j;
  for(i=0;i<n;i++){var mn=NaN,mx=NaN;if(i>=lb-1){mn=Infinity;mx=-Infinity;for(j=i-lb+1;j<=i;j++){if(k.l[j]<mn)mn=k.l[j];if(k.h[j]>mx)mx=k.h[j];}}
    var fmax=mx-mn;K[i]=fmax>0?100*(k.c[i]-mn)/fmax:0;
    var pf=i-o.x>=0?DF[i-o.x]:0,ps=i-o.x>=0?DS[i-o.x]:0;DF[i]=pf+al*(K[i]-pf);DS[i]=(ps*2+DF[i])/3;}
  var sma3=function(a){var r=new Array(n).fill(NaN);for(var q=2;q<n;q++)r[q]=(a[q]+a[q-1]+a[q-2])/3;return r;};
  var pss=lxJurik(sma3(DS),o.jl,o.ph),pst=lxJurik(sma3(DF),o.jl,o.ph),tr=new Array(n),need=lb+10*o.x+3*o.jl+3,ev={long:[],short:[]};
  for(i=0;i<n;i++){var t=i?tr[i-1]:0;if(pst[i]>pss[i])t=1;if(pst[i]<pss[i])t=-1;tr[i]=t;
    var ok=i>=need&&i>0&&isFinite(pst[i-1])&&isFinite(pss[i-1]);ev.long[i]=!!(ok&&pst[i]>pss[i]&&pst[i-1]<=pss[i-1]);ev.short[i]=!!(ok&&pst[i]<pss[i]&&pst[i-1]>=pss[i-1]);}
  return {n:n,need:need,o:o,pss:pss,pst:pst,trend:tr,ev:ev};}

/* ===== QUANTEX Radar — hesap motoru (lab ile aynı kurallar) ===== */
var RD={};
function rEma(x,p){var n=x.length,o=new Array(n).fill(NaN),a=2/(p+1),s=null;for(var i=0;i<n;i++){var v=x[i];if(!isFinite(v)){o[i]=s===null?NaN:s;continue;}s=s===null?v:v*a+s*(1-a);o[i]=s;}return o;}
function rSweep(k){var lb=48,n=k.c.length,sw=new Array(n).fill(false),i,j;
  for(i=lb;i<n;i++){var lo=Infinity,vs=[];for(j=i-lb;j<i;j++){if(k.l[j]<lo)lo=k.l[j];vs.push(+k.v[j]||0);}
    if(!(k.l[i]<lo&&k.c[i]>lo))continue;var rg=Math.max(k.h[i]-k.l[i],1e-12);if((Math.min(k.o[i],k.c[i])-k.l[i])/rg<0.4)continue;
    vs.sort(function(a,b){return a-b;});var md=(vs[23]+vs[24])/2;if((+k.v[i]||0)/Math.max(md,1e-12)>=1.5)sw[i]=true;}
  return sw;}
function rFlow(c,v){var L=50,n=c.length,x=new Array(n),s=0,i,j;for(i=0;i<n;i++){if(i>0)s+=(c[i]>c[i-1]?1:c[i]<c[i-1]?-1:0)*(+v[i]||0);x[i]=s;}
  var e=rEma(x,L),dev=x.map(function(q,i){return q-e[i];}),z=new Array(n).fill(0);
  for(i=L-1;i<n;i++){var m=0,q2=0;for(j=i-L+1;j<=i;j++)m+=dev[j];m/=L;for(j=i-L+1;j<=i;j++)q2+=(dev[j]-m)*(dev[j]-m);var sd=Math.sqrt(q2/(L-1));z[i]=sd>0?dev[i]/sd:0;}
  var f=rEma(z,5);for(i=0;i<Math.min(n,2*L);i++)f[i]=NaN;return f;}
function rSma(c,p){var n=c.length,o=new Array(n).fill(NaN),s=0;for(var i=0;i<n;i++){s+=c[i];if(i>=p)s-=c[i-p];if(i>=p-1)o[i]=s/p;}return o;}
function rZ200(c){var e=rEma(c,200),n=c.length,z=new Array(n).fill(NaN);for(var i=199;i<n;i++){var m=0,q=0;for(var j=i-199;j<=i;j++)m+=c[j];m/=200;for(j=i-199;j<=i;j++)q+=(c[j]-m)*(c[j]-m);var sd=Math.sqrt(q/200);z[i]=sd>0?(c[i]-e[i])/sd:NaN;}return z;}
function rVortex(k){var L=100,P=9,n=k.c.length,tr=[],vp=[],vm=[],i;for(i=0;i<n;i++){var pc=i?k.c[i-1]:NaN;tr.push(i?Math.max(k.h[i]-k.l[i],Math.abs(k.h[i]-pc),Math.abs(k.l[i]-pc)):k.h[i]-k.l[i]);vp.push(i?Math.abs(k.h[i]-k.l[i-1]):NaN);vm.push(i?Math.abs(k.l[i]-k.h[i-1]):NaN);}
  var pl=new Array(n).fill(NaN),mi=new Array(n).fill(NaN),v=new Array(n).fill(NaN);
  for(i=L;i<n;i++){var a=0,b=0,c=0;for(var j=i-L+1;j<=i;j++){a+=vp[j];b+=vm[j];c+=tr[j];}pl[i]=a/Math.max(c,1e-4);mi[i]=b/Math.max(c,1e-4);v[i]=100*(Math.abs(pl[i]-mi[i])*10)/Math.max((pl[i]+mi[i])*10,1e-4);}
  var a1=Math.exp(-Math.PI*Math.SQRT2/P),c2=2*a1*Math.cos(Math.SQRT2*Math.PI/P),c3=-a1*a1,c1=1-c2-c3,f=new Array(n).fill(0);
  for(i=2;i<n;i++){if(!isFinite(v[i])||!isFinite(v[i-1])){f[i]=isFinite(v[i])?v[i]:0;continue;}f[i]=c1*(v[i]+v[i-1])/2+c2*f[i-1]+c3*f[i-2];}
  return {adx:f,pl:pl,mi:mi};}
/* Sepet: hacimce ilk 40 (coin) / tüm hisseler (BIST); 24 saatlik medyan log getirisi ≤ −%5 veya ≥ %10'u son 3 mumda süpürdü */
function rBasket(list,tfMs,xu){var swT={},nT={},retT={};
  list.forEach(function(k){var sw=rSweep(k);for(var i=0;i<k.c.length;i++){var t=k.t[i];nT[t]=(nT[t]||0)+1;if(sw[i]||(i>0&&sw[i-1])||(i>1&&sw[i-2]))swT[t]=(swT[t]||0)+1;if(i>0)(retT[t]=retT[t]||[]).push(Math.log(k.c[i]/k.c[i-1]));}});
  var ts=Object.keys(nT).map(Number).sort(function(a,b){return a-b;}),NB=Math.max(1,Math.round(864e5/tfMs)),xr=null;
  if(xu){xr={};for(var q=1;q<xu.c.length;q++)xr[xu.t[q]]=Math.log(xu.c[q]/xu.c[q-1]);}
  var med=ts.map(function(t){if(xr)return isFinite(xr[t])?xr[t]:NaN;var a=(retT[t]||[]).slice().sort(function(x,y){return x-y;});if(!a.length)return NaN;var h=a.length>>1;return a.length%2?a[h]:(a[h-1]+a[h])/2;});
  var br={},mr={},sc={};for(var i=0;i<ts.length;i++){br[ts[i]]=(swT[ts[i]]||0)/nT[ts[i]];sc[ts[i]]=swT[ts[i]]||0;var s=0,c=0;for(var j=Math.max(0,i-NB+1);j<=i;j++)if(isFinite(med[j])){s+=med[j];c++;}mr[ts[i]]=c>=Math.ceil(NB/2)?s:NaN;}
  return {br:br,mr:mr,sc:sc,ts:ts,n:list.length};}
/* T41 · YO6 MA (iş TF = verilen mumlar; 4s'te 4s bağlam/BTC filtresi yok — lab 4s kuralı) */
function rT41(k,B){var m=k.c.length,sw=rSweep(k),fl=rFlow(k.c,k.v),ma=rSma(k.c,10),vf=[],en=[],wt=[],pend=-1,lastE=-1,pendAt=[],cl=[];
  for(var i=0;i<m;i++){var t=k.t[i],calm=B?((isFinite(B.mr[t])&&B.mr[t]<=-0.05)||(isFinite(B.br[t])&&B.br[t]>=0.10)):true;
    cl[i]=calm;vf[i]=sw[i]&&calm&&isFinite(fl[i])&&isFinite(fl[i-1])&&fl[i]>fl[i-1];if(vf[i])pend=i;if(pend>=0&&i-pend>12)pend=-1;
    en[i]=false;if(pend>=0&&isFinite(ma[i])&&k.c[i]>ma[i]){if(i>lastE){en[i]=true;lastE=i;}pend=-1;}wt[i]=pend>=0;pendAt[i]=pend;}
  return {sw:sw,fl:fl,ma:ma,vf:vf,en:en,wt:wt,pendAt:pendAt,cl:cl};}
function lastIdx(arr,from){for(var i=arr.length-1;i>=Math.max(0,from||0);i--)if(arr[i])return i;return -1;}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
/* ===== QUANTEX Radar — veri + çizim (TASLAK) ===== */
(function(){
'use strict';
var H1=36e5,H4=144e5;
var LAB={bist:{nm:'BIST z−2 dönüş',tf:'1s · TP %5',pf:'1.54',rnd:'0.82',ex:'3/3 dilim'},
  loxx:{nm:'Loxx üçgen + z>0',tf:'Coin 1s · çıkış C',pf:'2.76',rnd:'1.25',ex:'48 işlem · +$106'},
  yo6:{nm:'T41 · YO6 MA',tf:'Coin 4s · 12 mum',pf:'2.94',rnd:'~1.0',ex:'203 işlem · 3/3 dilim'}};
var SECT={L1:'BTC ETH SOL ADA AVAX DOT NEAR APT SUI SEI TON TRX ATOM ALGO ICP HBAR XRP LTC BCH ETC XLM BNB KAS HYPE',
  L2:'ARB OP MATIC POL STRK IMX MNT ZK BLAST',
  Meme:'DOGE 1000PEPE 1000SHIB WIF 1000BONK 1000FLOKI BOME POPCAT MEW BRETT TRUMP PNUT FARTCOIN PENGU 1000CAT SPX MOODENG GOAT',
  AI:'FET RENDER TAO WLD ARKM VIRTUAL AI16Z GRASS IO AIXBT NEIRO',
  Altyapı:'FIL TIA QNT ZRO ALT GRT AR STX',Gizlilik:'ZEC XMR DASH',Oyun:'SAND MANA AXS GALA APE',
  DeFi:'PUMP ASTER UNI AAVE LINK MKR CRV LDO PENDLE JUP ENA DYDX INJ RUNE SNX COMP ONDO ETHFI EIGEN RAY'};
var BSECT={Banka:'AKBNK GARAN ISCTR YKBNK',Holding:'KCHOL SAHOL ALARK ENKAI',Sanayi:'ARCLK ASELS FROTO TOASO EREGL KRDMD SASA SISE OYAKC HEKTS GUBRF KONTR ASTOR',
  'Enerji':'TUPRS PETKM','Ulaşım':'THYAO PGSUS','Perakende':'BIMAS MGROS','Telekom':'TCELL TTKOM','GYO':'EKGYO'};
var BIST30='AKBNK ALARK ARCLK ASELS ASTOR BIMAS EKGYO ENKAI EREGL FROTO GARAN GUBRF HEKTS ISCTR KCHOL KONTR KRDMD MGROS OYAKC PETKM PGSUS SAHOL SASA SISE TCELL THYAO TOASO TTKOM TUPRS YKBNK'.split(' ');
var STABLE=/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|EUR|USDE|BFUSD|XUSD)USDT$/;
function secMap(src){var m={};for(var s in src)src[s].split(' ').forEach(function(b){m[b]=s;});return m;}
var CSEC=secMap(SECT),BSEC=secMap(BSECT);
var $=function(id){return document.getElementById(id);};
var ST={replay:null,mode:'coin',coins:[],bist:[],pulse:null,tape:[],seen:{},busy:false,lastAt:0,err:[],req:0};

/* --- istek kuyruğu: en fazla 4 istek/sn, 429/418 → Retry-After kadar bekle --- */
var Q={hist:[],ban:0};
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function slot(){for(;;){var now=Date.now();Q.hist=Q.hist.filter(function(t){return now-t<1000;});
  if(now>=Q.ban&&Q.hist.length<4){Q.hist.push(now);return;}await sleep(Q.ban>now?Math.min(Q.ban-now,1000):60);}}
async function getJSON(url){for(var a=0;a<4;a++){await slot();ST.req++;var r;try{r=await fetch(url,{cache:'no-store'});}catch(e){await sleep(800);continue;}
  if(r.status===429||r.status===418){var ra=+(r.headers.get('retry-after'))||30;Q.ban=Date.now()+ra*1000;status('429 — '+ra+' sn bekleniyor');continue;}
  if(!r.ok)throw new Error('HTTP '+r.status+' '+url.split('?')[0]);return r.json();}throw new Error('istek başarısız: '+url.split('?')[0]);}
function kl(rows,ivMs){var k={t:[],o:[],h:[],l:[],c:[],v:[]},now=Date.now();for(var i=0;i<rows.length;i++){var b=rows[i];if(+b[0]+ivMs>now)continue;k.t.push(+b[0]);k.o.push(+b[1]);k.h.push(+b[2]);k.l.push(+b[3]);k.c.push(+b[4]);k.v.push(+b[5]);}return k;}
async function pool(items,n,fn){var i=0;async function w(){while(i<items.length){var j=i++;try{await fn(items[j],j);}catch(e){ST.err.push(String(e.message||e));}}}var ws=[];for(var q=0;q<n;q++)ws.push(w());await Promise.all(ws);}
function status(t){var e=$('rdStatus');if(e)e.textContent=t;}

/* --- lab çıkış kuralları (eng.py sim() birebir) --- */
var DAY=864e5,RWIN=30*DAY;
function netR(r){return r-0.0004*(2+r);}
function simRule(k,i,rule,K){var n=k.c.length;if(i+1>=n)return null;var e=k.o[i+1],j;
  if(rule==='tp5'||rule==='time12'){var end=Math.min(n,i+1+(rule==='time12'?12:720)),full=(i+1+(rule==='time12'?12:720))<=n;
    for(j=i+1;j<end;j++){if(k.l[j]<=e*0.75)return {j:j,r:-0.25,open:false};if(rule==='tp5'&&k.h[j]>=e*1.05)return {j:j,r:0.05,open:false};}
    return {j:end-1,r:k.c[end-1]/e-1,open:!full};}
  var x1=null;for(j=i+1;j<n;j++){if(k.l[j]<=e*0.75)return {j:j,r:((x1!==null?x1:e*0.75)+e*0.75)/2/e-1,open:false};
    if(x1===null&&K[j]>=50)x1=k.c[j];if(x1!==null&&K[j]>=80)return {j:j,r:(x1+k.c[j])/2/e-1,open:false};}
  var xp=k.c[n-1];return {j:n-1,r:((x1!==null?x1:xp)+xp)/2/e-1,open:true};}
function runTrades(k,sig,rule,K,leg,sym,tf,start){var out=[],busy=-1;for(var i=0;i<sig.length;i++){if(!sig[i]||k.t[i]<start||i<=busy)continue;var R=simRule(k,i,rule,K);if(!R)continue;
  busy=R.open?1e9:R.j;out.push({leg:leg,sym:sym,i:i,j:R.j,ti:k.t[i],fireT:k.t[i]+tf,exitT:k.t[R.j]+tf,e:k.o[i+1],ret:netR(R.r),usd:20*netR(R.r),open:R.open,k:k,tf:tf});}return out;}
function idxAt(t,T,tf){var lo=0,hi=t.length-1,f=-1;while(lo<=hi){var m=(lo+hi)>>1;if(t[m]+tf<=T){f=m;lo=m+1;}else hi=m-1;}return f;}
function dLoArr(k){var n=k.c.length,o=new Array(n).fill(99);for(var i=48;i<n;i++){var lo=Infinity,tr=0;for(var q=i-47;q<=i;q++){lo=Math.min(lo,k.l[q]);tr+=Math.max(k.h[q]-k.l[q],Math.abs(k.h[q]-k.c[q-1]),Math.abs(k.l[q]-k.c[q-1]));}var a=tr/48;o[i]=a>0?(k.c[i]-lo)/a:99;}return o;}
function rvolArr(v){var n=v.length,o=new Array(n).fill(1),s=0;for(var i=0;i<n;i++){if(i>=20){o[i]=s>0?v[i]/(s/20):1;}s+=v[i];if(i>=20)s-=v[i-20];}return o;}
function f1(x){return isFinite(x)?x.toFixed(1):'—';}function f0(x){return isFinite(x)?x.toFixed(0):'—';}function f2(x){return isFinite(x)?x.toFixed(2):'—';}
/* --- coin taraması --- */
async function scanCoins(N){
  status('Binance 24s özet alınıyor…');
  var tk=await getJSON('/api/fapi/v1/ticker/24hr');
  var u=tk.filter(function(x){return /USDT$/.test(x.symbol)&&!STABLE.test(x.symbol)&&+x.quoteVolume>0&&+x.count>0;}).sort(function(a,b){return b.quoteVolume-a.quoteVolume;});
  var info=null;try{info=await getJSON('/api/fapi/v1/exchangeInfo');}catch(e){}
  if(info&&info.symbols){var ok={};info.symbols.forEach(function(s){if(s.status==='TRADING'&&s.contractType==='PERPETUAL')ok[s.symbol]=1;});u=u.filter(function(x){return ok[x.symbol];});}
  u=u.slice(0,N);var out=[],done=0;
  await pool(u,4,async function(x){var s=x.symbol;
    var r4=await getJSON('/api/fapi/v1/klines?symbol='+s+'&interval=4h&limit=500');
    var r1=await getJSON('/api/fapi/v1/klines?symbol='+s+'&interval=1h&limit=1500');
    out.push({sym:s,b:s.replace(/USDT$/,''),qv:+x.quoteVolume,ch:+x.priceChangePercent,k4:kl(r4,H4),k1:kl(r1,H1)});
    done++;status('Coin mumları: '+done+'/'+u.length+' ('+ST.req+' istek, ≤4/sn)');});
  out=out.filter(function(c){return c.k4.c.length>120&&c.k1.c.length>300;});
  out.sort(function(a,b){return b.qv-a.qv;});
  var B=rBasket(out.slice(0,40).map(function(c){return c.k4;}),H4,null),start=Date.now()-RWIN;
  out.forEach(function(c){prepCoin(c,B,start);});
  var btc=out.filter(function(c){return c.sym==='BTCUSDT';})[0];
  ST.coins=out;ST.cB=B;ST.pulse=pulseCoin(out,B,btc);}
function prepCoin(c,B,start){var k=c.k4,k1=c.k1;c.T=rT41(k,B);c.dLo=dLoArr(k);c.rv1=rvolArr(k1.v);
  c.J=jfkpsCalc(k1,{jfLen:27,jfX:15,jfSm:12,jfJLen:30,jfPh:0});var V=rVortex(k1);c.Z=rZ200(k1.c);c.s5=[];
  for(var i=0;i<k1.c.length;i++){var g=c.J.ev.long[i]&&V.adx[i]>0.2&&V.pl[i]>V.mi[i];c.s5[i]=!!(g&&c.J.pst[i]>=10&&c.J.pst[i]<20&&c.Z[i]>0);}
  c.trades=runTrades(k,c.T.en,'time12',null,'yo6',c.sym,H4,start).concat(runTrades(k1,c.s5,'C',c.J.pst,'loxx',c.sym,H1,start));
  c.sec=CSEC[c.b]||'Diğer';var L=k.c.length-1,L1=k1.c.length-1,P=proxCoin(c,L,L1);c.r=P.r;c.why=P.why;c.miss=P.miss;c.setup=P.setup;
  c.flowUp=isFinite(c.T.fl[L])&&isFinite(c.T.fl[L-1])?c.T.fl[L]>c.T.fl[L-1]:null;c.flowSer=c.T.fl;c.rvol=c.rv1[L1];
  // eski panel uyumluluğu
  var iE=lastIdx(c.T.en,L-12),iV=lastIdx(c.T.vf,L-12);c.t41={enAge:iE>=0?L-iE:null,wait:c.T.wt[L],maGap:isFinite(c.T.ma[L])?(c.T.ma[L]-k.c[L])/c.T.ma[L]:NaN,enT:iE>=0?k.t[iE]+H4:0,vfT:iV>=0?k.t[iV]+H4:0,ev:[]};
  for(i=Math.max(0,L-18);i<=L;i++){if(c.T.en[i])c.t41.ev.push({t:k.t[i]+H4,k:'yo6',tx:'YO6 MA AL',p:k.c[i]});else if(c.T.vf[i])c.t41.ev.push({t:k.t[i]+H4,k:'yo6v',tx:'YO6 VF (SMA10 bekleniyor)',p:k.c[i]});}
  c.lx={ok:L1>=c.J.need,pst:c.J.pst[L1],pss:c.J.pss[L1],z:c.Z[L1],ev:[]};
  for(i=Math.max(0,L1-72);i<=L1;i++)if(c.s5[i])c.lx.ev.push({t:k1.t[i]+H1,k:'loxx',tx:'Loxx üçgen pst '+f0(c.J.pst[i])+' · z '+f2(c.Z[i]),p:k1.c[i]});}
/* yakınlık: 0 = kanıtlanmış kurulum şimdi ateşliyor … 1 = uzak; "miss" = eksik olan */
function proxCoin(c,i,j){var T=c.T,k=c.k4,J=c.J,lxOk=j>=J.need&&j>=0,pst=lxOk?J.pst[j]:NaN,pss=lxOk?J.pss[j]:NaN,z=j>=0?c.Z[j]:NaN,dl=c.dLo[i];
  var o={r:0.6+0.4*clamp(Math.min(isFinite(pst)?Math.abs(pst-15)/85:1,dl/12),0,1),why:'uzak',setup:'—',miss:''};
  o.miss=isFinite(pst)&&z>0&&pst>=30?'pst '+f0(pst)+'→30 altı bekleniyor':isFinite(z)&&z<=0?'z200 '+f2(z)+' → >0 gerekli':'48 mum dibine '+f1(dl)+' ATR';o.why='uzak · dibe '+f1(dl)+' ATR';
  function take(v,w,s,m){if(v<o.r){o.r=v;o.why=w;o.setup=s;o.miss=m;}}
  if(T.en[i]||(i>0&&T.en[i-1]))take(0.02,'YO6 MA AL','YO6 MA','ateşledi · giriş sonraki mum');
  if(T.wt[i]){var gap=(T.ma[i]-k.c[i])/T.ma[i],left=12-(i-T.pendAt[i]);take(0.10+0.20*clamp(gap/0.03,0,1),'YO6 VF ateşledi · SMA10 geri alımı bekleniyor','YO6 MA','SMA10\'a %'+f1(gap*100)+' · '+left+' mum kaldı');}
  if(lxOk){if(c.s5[j]||(j>0&&c.s5[j-1]))take(0.03,'Loxx üçgen + z>0','Loxx','ateşledi · giriş sonraki mum');
    else if(z>0&&pst>=5&&pst<30&&pst<pss)take(0.30+0.25*clamp((pss-pst)/10,0,1),'Loxx pst bölgede · kesişim bekleniyor','Loxx','pst '+f0(pst)+'→pss '+f0(pss)+' kesişimi'+(pst<10?' (pst ≥10 olmalı)':pst>=20?' (pst <20 olmalı)':''));}
  var si=T.sw[i]?i:(i>0&&T.sw[i-1])?i-1:(i>1&&T.sw[i-2])?i-2:-1;
  if(si>=0&&!T.vf[si]){var fo=isFinite(T.fl[si])&&isFinite(T.fl[si-1])&&T.fl[si]>T.fl[si-1];take(0.50,'Süpürme var (filtreden geçmedi)','YO6','süpürme var · eksik: '+[!T.cl[si]?'sakin değil filtresi':'',!fo?'OBV akışı↑':''].filter(Boolean).join(' + '));}
  return o;}
function pulseCoin(list,B,btc){var t=B.ts[B.ts.length-1],P={mr:B.mr[t],sc:B.sc[t],bn:B.n};
  P.calm=!((isFinite(P.mr)&&P.mr<=-0.05)||(B.br[t]>=0.10));
  if(btc){var e=rEma(btc.k4.c,50),L=btc.k4.c.length-1;P.btc={c:btc.k4.c[L],e:e[L],d:(btc.k4.c[L]/e[L]-1)};}
  P.stHist=stressHist(B,48);P.t=t+H4;return P;}
function stressHist(B,n,upto){var ts=B.ts;if(upto!=null){var q=0;while(q<ts.length&&ts[q]<=upto)q++;ts=ts.slice(0,q);}return ts.slice(-n).map(function(x){var a=isFinite(B.mr[x])?-B.mr[x]/0.05:0,b=isFinite(B.br[x])?B.br[x]/0.10:0;return {t:x,s:Math.max(0,Math.min(1.6,Math.max(a,b))),mr:B.mr[x],sc:B.sc[x]};});}
/* --- BIST taraması --- */
async function scanBist(){
  var syms=BIST30.concat(['XU100']),got={},tries=0;
  while(Object.keys(got).length<syms.length&&tries<6){tries++;var need=syms.filter(function(s){return !got[s];});
    for(var i=0;i<need.length;i+=10){var ch=need.slice(i,i+10);status('BIST mumları (Yahoo kuyruğu): '+Object.keys(got).length+'/'+syms.length);
      var j=await getJSON('/api/yahoo/chart?symbols='+encodeURIComponent(ch.join(','))+'&interval=1h&limit=700');
      (j.results||[]).forEach(function(r){if(r&&r.ok&&r.klines&&r.klines.length>260)got[String(r.symbol).replace(/\.IS$/,'')]=r;});}
    if(Object.keys(got).length<syms.length)await sleep(2500);}
  var xu=got.XU100?kl(got.XU100.klines,H1):null,out=[],start=Date.now()-RWIN;
  BIST30.forEach(function(s){if(!got[s])return;var row=got[s],k=kl(row.klines,H1),L=k.c.length-1,Z=rZ200(k.c),fl=rFlow(k.c,k.v),cr=[];
    for(var i=0;i<=L;i++)cr[i]=i>0&&Z[i]>-2&&Z[i-1]<=-2;
    var c={sym:s,b:s,k1:k,k4:k,Z:Z,cr:cr,flowSer:fl,rv1:rvolArr(k.v),qv:+row.qv||0,ch:isFinite(+row.chg)?+row.chg:NaN,sec:BSEC[s]||'Diğer'};
    c.trades=runTrades(k,cr,'tp5',null,'bist',s,H1,start);var P=proxBist(c,L);c.r=P.r;c.why=P.why;c.miss=P.miss;c.setup=P.setup;c.z=Z[L];c.rvol=c.rv1[L];
    c.flowUp=isFinite(fl[L])&&isFinite(fl[L-1])?fl[L]>fl[L-1]:null;c.ev=[];for(i=Math.max(1,L-70);i<=L;i++)if(cr[i])c.ev.push({t:k.t[i]+H1,k:'bist',tx:'z −2 yukarı kesti ('+f2(Z[i])+')',p:k.c[i]});
    out.push(c);});
  ST.bist=out;ST.xu=xu;if(out.length>=3){var BB=rBasket(out.map(function(c){return c.k1;}),H1,xu),tl=BB.ts[BB.ts.length-1];ST.bB=BB;ST.bPulse={st:stressHist(BB,48),mr:BB.mr[tl],sc:BB.sc[tl],bn:BB.n,calm:!((isFinite(BB.mr[tl])&&BB.mr[tl]<=-0.05)||BB.br[tl]>=0.10)};}}
function proxBist(c,i){var z=c.Z[i],o;
  if(c.cr[i]||(i>0&&c.cr[i-1]))o={r:0.02,why:'z −2 yukarı kesti',miss:'ateşledi · giriş sonraki mum'};
  else if(z<-2)o={r:0.10+0.25*clamp((-2-z)/1.5,0,1),why:'z '+f2(z)+' · −2 üstüne dönüş bekleniyor',miss:'z '+f2(z)+' → −2 üstü kapanış'};
  else if(z<-1)o={r:0.35+0.25*(z+2),why:'z '+f2(z)+' · −2 yakınında',miss:'z '+f2(z)+' · önce −2 altı, sonra dönüş'};
  else o={r:0.6+0.4*clamp((z+1)/4,0,1),why:'z '+f2(z)+' · uzak',miss:'z '+f2(z)+' · −2 bölgesine uzak'};o.setup='BIST z−2';return o;}
function readLS(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function robot(){var cfg=readLS('qxbot_cfg_v1'),st=readLS('qxbot_state_v1'),bs=readLS('qxbot_bist_v1');
  return {coin:st?{eq:cfg&&+cfg.equity,pnl:+st.pnl||0,open:(st.open||[]),run:!!st.running}:null,bist:bs?{eq:+bs.equity,pnl:+bs.pnl||0,open:(bs.open||[])}:null};}
var LABEQ={"bist":{"n":105,"usd":26.5,"win":75.2,"dd":-25.4,"pts":[[1767684600,0.98],[1767695400,1.97],[1769423400,3.93],[1770201000,4.92],[1770816600,5.9],[1773124200,7.87],[1773138600,8.85],[1773210600,9.84],[1773315000,11.8],[1773642600,12.79],[1774272600,13.77],[1775629800,14.75],[1775651400,16.72],[1775802600,17.7],[1775817000,18.69],[1776061800,20.66],[1776148200,21.64],[1776173400,22.62],[1776429000,24.59],[1776432600,25.57],[1778567400,26.56],[1779690600,28.52],[1779690600,29.51],[1780381800,30.49],[1781159400,32.46],[1781245800,33.44],[1781249400,34.43],[1781505000,36.39],[1781505000,37.38],[1782984600,38.36],[1783060200,39.34],[1783337400,38.73],[1783409400,39.71],[1783503000,38.57],[1784017800,37.95],[1784017800,38.93],[1784622600,39.91],[1785936600,41.88],[1786012200,42.86],[1786534200,43.85],[1786714200,45.82],[1787308200,46.8],[1787553000,47.78],[1787837400,44.52],[1787837400,45.5],[1788762600,46.49],[1788877800,48.46],[1789115400,49.44],[1789464600,46.6],[1789543800,39.18],[1789565400,34.17],[1789644600,35.15],[1789651800,36.13],[1789741800,38.1],[1789993800,39.08],[1789997400,40.07],[1790069400,42.04],[1790076600,43.02],[1790076600,44.0],[1790145000,45.97],[1790152200,46.95],[1790163000,47.94],[1790922600,49.9],[1791185400,50.89],[1791268200,51.87],[1792162800,44.56],[1792162800,44.48],[1792162800,42.77],[1792162800,42.62],[1792162800,40.41],[1792162800,40.38],[1792162800,37.12],[1792162800,34.67],[1792162800,34.15],[1792162800,34.07],[1792162800,30.83],[1792162800,27.48],[1792162800,27.59],[1792162800,26.88],[1792162800,26.46]],"t0":1767335400},"loxx":{"n":48,"usd":105.9,"win":60.4,"dd":-40.0,"pts":[[1769864400,-5.01],[1769882400,-6.68],[1770303600,-7.49],[1774584000,-12.5],[1776319200,-9.26],[1776373200,-8.2],[1776441600,-4.81],[1777050000,-2.97],[1777150800,-0.29],[1777633200,3.13],[1779526800,0.98],[1780441200,-0.39],[1780538400,-2.18],[1780538400,-5.31],[1780686000,-10.33],[1780718400,-15.34],[1780722000,-17.42],[1781125200,-19.14],[1782316800,-20.93],[1782392400,-25.95],[1782522000,-20.51],[1785193200,-23.2],[1785294000,-28.22],[1785294000,-33.23],[1786453200,-31.88],[1786568400,-36.89],[1788206400,-30.0],[1789765200,-20.12],[1790229600,-11.2],[1790355600,-6.85],[1790384400,-0.04],[1790395200,11.46],[1790398800,16.34],[1790449200,17.88],[1790492400,27.15],[1790499600,36.4],[1790506800,46.28],[1792314000,49.07],[1792314000,48.32],[1792314000,55.24],[1792314000,61.91],[1792314000,75.58],[1792314000,77.79],[1792314000,77.86],[1792314000,91.37],[1792314000,97.12],[1792314000,103.53],[1792314000,105.88]],"t0":1767286800},"yo6":{"n":203,"usd":80.1,"win":65.0,"dd":-10.1,"pts":[[1768392000,1.28],[1768435200,4.89],[1768449600,6.68],[1768449600,9.41],[1769184000,9.87],[1769184000,7.66],[1769184000,6.64],[1769889600,4.2],[1770206400,0.7],[1770537600,1.25],[1770552000,1.93],[1770552000,1.82],[1770552000,2.71],[1770552000,2.94],[1770552000,2.56],[1771761600,1.77],[1772121600,6.92],[1772121600,9.7],[1772150400,18.21],[1772150400,23.15],[1772150400,23.89],[1772179200,28.4],[1774425600,30.52],[1774425600,32.95],[1774425600,33.69],[1774425600,36.59],[1774425600,37.34],[1774425600,38.55],[1774425600,40.88],[1774425600,42.53],[1775001600,43.61],[1775001600,44.41],[1775001600,44.99],[1775001600,44.85],[1780156800,45.95],[1780200000,47.05],[1780200000,47.8],[1780228800,46.29],[1780228800,45.15],[1780300800,45.75],[1780761600,40.26],[1780948800,43.45],[1780948800,43.41],[1780948800,46.2],[1780963200,46.76],[1780963200,47.59],[1780963200,49.77],[1780963200,50.09],[1780963200,51.72],[1780963200,51.3],[1780992000,53.9],[1782489600,53.41],[1782504000,54.87],[1782604800,55.22],[1783036800,56.23],[1783080000,58.55],[1783080000,60.57],[1784721600,59.46],[1784750400,61.03],[1785470400,59.33],[1785542400,59.66],[1785571200,58.83],[1785585600,59.03],[1785600000,58.67],[1785816000,58.72],[1786953600,58.28],[1786982400,58.1],[1789761600,62.12],[1789776000,73.26],[1791676800,73.38],[1791691200,79.46],[1791691200,79.39],[1791748800,79.8],[1791748800,83.37],[1791763200,84.13],[1792065600,85.46],[1792108800,85.34],[1792108800,82.34],[1792108800,81.3],[1792108800,80.07]],"t0":1768219200}};
/* ================= v3 arayüz ================= */
var CLK={cap:/[?&]capture=1/.test(location.search),v:0,now:function(){return this.cap?this.v:performance.now();}};
function fmtAge(ms){var m=Math.max(0,Math.round(ms/6e4));if(m<60)return m+' dk';var h=Math.floor(m/60);if(h<48)return h+' sa';return Math.floor(h/24)+' gün';}
function fmtT(t){return new Date(t).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
function pct(x,d){return isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(d==null?1:d)+'%':'—';}
function usd(x){return isFinite(x)?(x>=0?'+$':'−$')+Math.abs(x).toFixed(1):'—';}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function chartUrlS(mode,sym){return '/quantex.html?v=124#ac='+mode+':'+encodeURIComponent(sym);}
function chartUrl(c){return chartUrlS(ST.mode==='bist'?'bist':'coin',c.sym);}
function cur(){return ST.mode==='bist'?ST.bist:ST.coins;}
function hidpi(cv){var dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}var g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);return {g:g,w:w,h:h};}
var NUMS=new WeakMap();
function num(el,val,fmt){if(!el)return;var o=NUMS.get(el),from=o&&isFinite(o.v)?o.v:0;NUMS.set(el,{v:val});if(!isFinite(val)){el.textContent='—';return;}var t0=performance.now();(function step(t){var k=Math.min(1,(t-t0)/700),e=1-Math.pow(1-k,3);el.textContent=fmt(from+(val-from)*e);if(k<1)requestAnimationFrame(step);})(t0);}
var LANES=[['yo6','YO6 MA AL','#00ffaa'],['yo6v','YO6 VF','#7dd3fc'],['loxx','Loxx üçgen','#c084fc'],['bist','BIST z−2','#ffe600']];
var LEGC={yo6:'#00ffaa',loxx:'#c084fc',bist:'#ffe600'},LEGN={yo6:'YO6 MA',loxx:'Loxx C',bist:'BIST z−2'};
/* ---------- düzen ---------- */
var LAY={dots:[],secs:[],mode:''};
function layout(){var list=cur().slice(0,80),secs={};list.forEach(function(c){(secs[c.sec]=secs[c.sec]||[]).push(c);});
  var names=Object.keys(secs).sort(function(a,b){if(a==='Diğer')return 1;if(b==='Diğer')return -1;return a.localeCompare(b,'tr');}),tot=list.length||1,a0=-Math.PI/2,out=[],gap=0.07,S2=[];
  names.forEach(function(nm){var arr=secs[nm].sort(function(a,b){return a.b.localeCompare(b.b);}),span=(2*Math.PI-gap*names.length)*arr.length/tot;S2.push({nm:nm,a0:a0,a1:a0+span,n:arr.length});arr.forEach(function(c,i){out.push({c:c,b:c.b,a:a0+span*(i+0.5)/arr.length,si:S2.length-1});});a0+=span+gap;});
  var top=list.slice().sort(function(a,b){return b.qv-a.qv;}).slice(0,5).map(function(c){return c.sym;});out.forEach(function(d,k){d.top=top.indexOf(d.c.sym)>=0;d.c._k=k;});LAY={dots:out,secs:S2,mode:ST.mode};}
/* ---------- kare (canlı ya da imleç) ---------- */
function atCoin(c,T){var k=c.k4,i=T==null?k.c.length-1:idxAt(k.t,T,H4),j=T==null?c.k1.c.length-1:idxAt(c.k1.t,T,H1);if(i<60||j<0)return null;
  var P=proxCoin(c,i,j),fl=c.T.fl;return {i:i,j:j,r:P.r,why:P.why,miss:P.miss,setup:P.setup,ch:T==null?c.ch:(k.c[i]/k.c[Math.max(0,i-6)]-1)*100,up:isFinite(fl[i])&&isFinite(fl[i-1])?fl[i]>fl[i-1]:null,fl:fl[i],rv:c.rv1[j],tor:fl.slice(i-47,i+1)};}
function atBist(c,T){var k=c.k1,i=T==null?k.c.length-1:idxAt(k.t,T,H1);if(i<210)return null;var P=proxBist(c,i),fl=c.flowSer;
  return {i:i,j:i,r:P.r,why:P.why,miss:P.miss,setup:P.setup,z:c.Z[i],ch:T==null?c.ch:(k.c[i]/k.c[Math.max(0,i-8)]-1)*100,up:isFinite(fl[i])&&isFinite(fl[i-1])?fl[i]>fl[i-1]:null,fl:fl[i],rv:c.rv1[i],tor:fl.slice(i-47,i+1)};}
function at(c,T){return ST.mode==='bist'?atBist(c,T):atCoin(c,T);}
function allTrades(){var a=[];ST.coins.forEach(function(c){a=a.concat(c.trades||[]);});ST.bist.forEach(function(c){a=a.concat(c.trades||[]);});return a;}
function tradeAt(tr,T){// T anındaki durum (ileriye bakmadan)
  if(T<tr.fireT)return null;if(!tr.open&&T>=tr.exitT)return {closed:true,ret:tr.ret,usd:tr.usd};var q=idxAt(tr.k.t,T,tr.tf);if(q<=tr.i)return {closed:false,ret:0,usd:0};var r=netR(tr.k.c[q]/tr.e-1);return {closed:false,ret:r,usd:20*r};}
var FR=null;
function buildFrame(){var T=ST.replay&&ST.replay.on?ST.replay.T:null,Tc=T==null?Date.now():T,c=[],tor=[],nebU={},nebN={},fire=0,near=0,list=[];
  LAY.dots.forEach(function(d,k){var f=at(d.c,T);if(!f){c.push({r:1,ch:0,up:null,fl:0,rv:1});tor.push(null);return;}f.c=d.c;f.k=k;c.push(f);tor.push(f.tor);list.push(f);
    nebN[d.si]=(nebN[d.si]||0)+1;if(f.up)nebU[d.si]=(nebU[d.si]||0)+1;if(f.r<0.05)fire++;else if(f.r<0.35)near++;});
  var neb=LAY.secs.map(function(s,si){return nebN[si]?(nebU[si]||0)/nebN[si]:null;}),comets=[],legs=ST.mode==='bist'?{bist:1}:{yo6:1,loxx:1};
  LAY.dots.forEach(function(d,k){(d.c.trades||[]).forEach(function(tr){if(!legs[tr.leg])return;var s=tradeAt(tr,Tc);if(!s)return;var age=Tc-(s.closed?tr.exitT:tr.fireT);if(age>7*DAY)return;
    if(tr.r0==null){var f0=at(d.c,tr.fireT);tr.r0=f0?f0.r:0.05;tr.ch0=f0?f0.ch:0;}
    comets.push({k:k,r0:tr.r0,ch0:tr.ch0,ret:s.ret,open:!s.closed,grow:1,fade:clamp(1-(age-3*DAY)/(4*DAY),0.15,1),tr:tr});});});
  FR={T:T,Tc:Tc,c:c,tor:tor,neb:neb,fire:fire,near:near,comets:comets,list:list};return FR;}
function pushFrame(){if(!LAY.dots.length)return;buildFrame();if(G.mode==='3d'&&G.api)G.api.setFrame(FR);renderTop5();renderScore();renderCounts();renderPulse();if(FOC.k!=null)renderFocus();}
/* ---------- HERO ---------- */
var G={api:null,mode:'?',want:'auto',reason:''};
function webglOK(){try{var c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}catch(e){return false;}}
function lowPower(){var n=navigator,c=n.connection||{};return !!(c.saveData||(n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2));}
async function heroInit(){var host=$('hero3d'),use3d=G.want==='3d'||(G.want==='auto'&&webglOK()&&!lowPower());
  if(G.api&&G.mode==='3d'&&use3d){heroData();return;}if(G.api&&!use3d){G.api.dispose();G.api=null;}
  if(use3d){try{status2('3D motor yükleniyor (three.js)…');var M=await import('/radar3d.js?v=3');
      G.api=M.create(host,{lite:innerWidth<700,capture:CLK.cap,clock:function(){return CLK.now();},onHover:hoverTip,onPick:function(k){focusOn(k);},drawHolo:function(g,w,h,k){drawMini(g,w,h,k,true);}});
      G.mode='3d';$('hero2d').style.display='none';window.RD3=G.api;heroData();return;}catch(e){console.warn('3D yüklenemedi, 2D radar',e);G.reason='WebGL/three.js yüklenemedi';}}
  else G.reason=webglOK()?'düşük güç':'WebGL yok';G.mode='2d';$('hero2d').style.display='block';R2.start();heroData();}
function heroData(){if(!cur().length)return;var fresh=LAY.mode!==ST.mode||LAY.dots.length!==Math.min(80,cur().length);layout();
  if(G.mode==='3d'&&G.api&&(fresh||G.api.state.n!==LAY.dots.length||G.dataGen!==ST.lastAt)){G.api.setData(LAY.dots,{sectors:LAY.secs,histLen:48,assemble:fresh&&!INTRO.on});G.dataGen=ST.lastAt;}pushFrame();
  $('hMode').textContent=(G.mode==='3d'?'3D · WebGL':'2D radar'+(G.reason?' ('+G.reason+')':''))+' · '+(ST.mode==='bist'?'BIST 30 · 1s · yarıçap = z200’ün −2’ye uzaklığı':'Coin vadeli · yarıçap = YO6 MA / Loxx kurulumuna uzaklık');}
function renderCounts(){if(!FR)return;num($('hFire'),FR.fire,Math.round);num($('hNear'),FR.near,Math.round);num($('hTot'),FR.list.length,Math.round);}
function hoverTip(d,ev){var t=$('rdTip');if(!d||!FR){t.style.display='none';return;}var f=FR.c[d.c._k]||{},c=d.c,b=$('hero').getBoundingClientRect();
  var rows=['<b>'+esc(c.b)+'</b> <span class="mut">'+esc(c.sec)+'</span>','<span class="y">'+esc(f.why||'')+'</span>','<span class="c">eksik: '+esc(f.miss||'—')+'</span>',
   'yakınlık <b>'+(1-(f.r||1)).toFixed(2)+'</b> · RVOL <b>'+(isFinite(f.rv)?f.rv.toFixed(2):'—')+'×</b> · 24s <b class="'+(f.ch>=0?'g':'r')+'">'+(isFinite(f.ch)?(f.ch>=0?'+':'')+f.ch.toFixed(2)+'%':'—')+'</b>',
   '<span class="mut">tıkla → odak + holografik grafik</span>'];t.innerHTML=rows.join('<br>');t.style.display='block';
  var x=ev.clientX-b.left+16,y=ev.clientY-b.top+16;if(x>b.width-260)x-=280;if(y>b.height-150)y-=160;t.style.left=x+'px';t.style.top=y+'px';}
/* 2D yedek */
var R2={on:false,ang:0,last:0,start:function(){if(this.on)return;this.on=true;var cv=$('hero2d');cv.addEventListener('mousemove',function(e){var d=R2.hit(e);cv.style.cursor=d?'pointer':'default';hoverTip(d,e);});
  cv.addEventListener('click',function(e){var d=R2.hit(e);if(d)focusOn(d.c._k);});requestAnimationFrame(R2.draw);},
 hit:function(e){var b=$('hero2d').getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,best=null,bd=1e9;LAY.dots.forEach(function(d){var q=Math.hypot(d.x-x,d.y-y);if(q<Math.max(12,d.sz+6)&&q<bd){bd=q;best=d;}});return best;},
 draw:function(ts){if(G.mode!=='2d'){R2.on=false;return;}requestAnimationFrame(R2.draw);if(document.hidden||!FR)return;var X=hidpi($('hero2d')),g=X.g,W=X.w,H=X.h,cx=W/2,cy=H/2+10,R=Math.min(W,H)/2-60,dt=R2.last?ts-R2.last:16;R2.last=ts;R2.ang=(R2.ang+dt*2*Math.PI/7000)%(2*Math.PI);
  g.clearRect(0,0,W,H);[0.25,0.5,0.75,1].forEach(function(q){g.strokeStyle='rgba(0,255,170,'+(q===0.25?0.35:0.14)+')';g.beginPath();g.arc(cx,cy,R*q,0,2*Math.PI);g.stroke();});
  LAY.secs.forEach(function(s){var am=(s.a0+s.a1)/2;g.fillStyle='#7dd3fc';g.font='bold 10px ui-monospace,monospace';g.textAlign='center';g.fillText(s.nm+' '+s.n,cx+Math.cos(am)*(R+20),cy+Math.sin(am)*(R+20));g.textAlign='left';});
  for(var q=0;q<24;q++){var a1=R2.ang-q*0.9/24,a2=R2.ang-(q+1)*0.9/24;g.fillStyle='rgba(0,255,170,'+(0.16*(1-q/24))+')';g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,R,a2,a1);g.closePath();g.fill();}
  FR.comets.forEach(function(cm){var d=LAY.dots[cm.k];if(!d)return;var r0=R*(0.04+0.96*clamp(cm.r0,0,1)),L=Math.min(80,8+600*Math.abs(cm.ret)),x0=cx+Math.cos(d.a)*r0,y0=cy+Math.sin(d.a)*r0,gr=g.createLinearGradient(x0,y0,x0+Math.cos(d.a)*L,y0+Math.sin(d.a)*L),col=cm.ret>=0?'0,255,140':'255,40,110';
    gr.addColorStop(0,'rgba('+col+','+(cm.open?0.5:0.9)*cm.fade+')');gr.addColorStop(1,'rgba('+col+',0)');g.strokeStyle=gr;g.lineWidth=3;g.beginPath();g.moveTo(x0,y0);g.lineTo(x0+Math.cos(d.a)*L,y0+Math.sin(d.a)*L);g.stroke();g.lineWidth=1;});
  var ph=(ts%1600)/1600;LAY.dots.forEach(function(d,k){var f=FR.c[k];var rr=R*(0.04+0.96*clamp(f.r,0,1));d.x=cx+Math.cos(d.a)*rr;d.y=cy+Math.sin(d.a)*rr;d.sz=3+6*Math.sqrt(clamp(f.rv||1,0.2,6)/6);
    var since=((R2.ang-((d.a%(2*Math.PI))+2*Math.PI)%(2*Math.PI))+4*Math.PI)%(2*Math.PI),gl=Math.exp(-since/1.2),col=f.up==null?'160,160,160':f.up?'0,255,170':'255,46,110';
    g.shadowColor='rgba('+col+',1)';g.shadowBlur=4+18*gl;g.fillStyle='rgba('+col+','+(0.45+0.55*gl)+')';g.beginPath();g.arc(d.x,d.y,d.sz,0,2*Math.PI);g.fill();g.shadowBlur=0;
    if(f.r<0.05){g.strokeStyle='rgba(255,230,0,'+(0.9-0.6*ph)+')';g.lineWidth=2;g.beginPath();g.arc(d.x,d.y,d.sz+3+5*ph,0,2*Math.PI);g.stroke();g.lineWidth=1;}
    if(f.r<0.5||d.top||FOC.k===k){g.fillStyle=FOC.k===k?'#ffe600':'#e6fff6';g.font='10px ui-monospace,monospace';g.fillText(d.c.b,d.x+d.sz+3,d.y+3);}});}};
/* ---------- odak modu ---------- */
var FOC={k:null};
function focusOn(k){if(k==null||!LAY.dots[k])return;FOC.k=k;if(G.mode==='3d'&&G.api)G.api.focus(k);$('focus').classList.add('on');$('hero').classList.add('foc');renderFocus();sfx('focus');}
function unfocus(){if(FOC.k==null)return;FOC.k=null;if(G.api)G.api.unfocus();$('focus').classList.remove('on');$('hero').classList.remove('foc');}
function renderFocus(){var k=FOC.k,d=LAY.dots[k];if(!d||!FR)return;var f=FR.c[k]||{},c=d.c,Tc=FR.Tc;
  var tr=(c.trades||[]).filter(function(t){return t.fireT<=Tc;}).slice(-4).reverse().map(function(t){var s=tradeAt(t,Tc);return '<div class="ftr"><i style="background:'+LEGC[t.leg]+'"></i>'+LEGN[t.leg]+' · '+fmtT(t.fireT)+' <b class="'+(s.ret>=0?'g':'r')+'">'+(s.closed?'':'açık ')+pct(s.ret,2)+' ('+usd(s.usd)+')</b></div>';}).join('')||'<div class="mut">bu pencerede işlem yok</div>';
  $('fBody').innerHTML='<div class="fh"><b>'+esc(c.b)+'</b><span>'+esc(c.sec)+' · '+(ST.mode==='bist'?'1s':'4s')+'</span></div><div class="y">'+esc(f.why||'')+'</div><div class="c">eksik: '+esc(f.miss||'—')+'</div>'+
   '<div class="kv"><span>yakınlık</span><b>'+(1-(f.r||1)).toFixed(2)+'</b></div><div class="kv"><span>24s</span><b class="'+(f.ch>=0?'g':'r')+'">'+(isFinite(f.ch)?(f.ch>=0?'+':'')+f.ch.toFixed(2)+'%':'—')+'</b></div><div class="kv"><span>RVOL · OBV akışı</span><b>'+(isFinite(f.rv)?f.rv.toFixed(2):'—')+'× · '+(f.up==null?'—':f.up?'<span class="g">▲</span>':'<span class="r">▼</span>')+'</b></div>'+
   '<div class="lbl">işlemler (lab çıkış kuralı, imleç anına kadar)</div>'+tr;
  if(G.mode!=='3d'||innerWidth<700){$('fMini').style.display='block';var X=hidpi($('fMini'));drawMini(X.g,X.w,X.h,k,false);}else $('fMini').style.display='none';
  $('fOpen').onclick=function(){window.open(chartUrl(c),'_blank');};if(G.api&&G.mode==='3d')G.api.redrawHolo();}
/* mini mum grafiği (holografik / 2D): son 48 mum, SMA10, OBV akışı, sinyal ve işlem işaretleri */
function drawMini(g,W,H,k,holo){var d=LAY.dots[k];if(!d)return;var c=d.c,f=FR&&FR.c[k],k4=ST.mode==='bist'?c.k1:c.k4,tf=ST.mode==='bist'?H1:H4,i=f&&f.i!=null?f.i:k4.c.length-1,a=Math.max(0,i-47),n=i-a+1;
  if(!c.ma10)c.ma10=ST.mode==='bist'?rSma(c.k1.c,10):c.T.ma;var ma=c.ma10,fl=c.flowSer;
  g.clearRect(0,0,W,H);if(!holo){g.fillStyle='rgba(2,8,12,.6)';g.fillRect(0,0,W,H);}
  var pad=holo?22:8,top=holo?52:20,ph=(H-top-pad)*0.68,fh=(H-top-pad)*0.24,fy=top+ph+(H-top-pad)*0.08,bw=(W-2*pad)/n,mn=Infinity,mx=-Infinity;
  for(var q=a;q<=i;q++){mn=Math.min(mn,k4.l[q]);mx=Math.max(mx,k4.h[q]);if(isFinite(ma[q])){mn=Math.min(mn,ma[q]);mx=Math.max(mx,ma[q]);}}var Y=function(v){return top+ph-(ph)*(v-mn)/Math.max(1e-12,mx-mn);};
  var C1=holo?'rgba(0,255,200,':'rgba(0,255,170,',C2=holo?'rgba(255,60,160,':'rgba(255,46,110,',fs=holo?20:10;
  if(holo){g.strokeStyle='rgba(0,255,220,.55)';g.lineWidth=2;g.strokeRect(4,4,W-8,H-8);g.fillStyle='rgba(0,40,50,.35)';g.fillRect(4,4,W-8,H-8);
    g.fillStyle='rgba(180,255,245,.95)';g.font='bold '+(fs+4)+'px ui-monospace,monospace';g.fillText(c.b+' · '+(ST.mode==='bist'?'1s':'4s')+' · son 48 mum',pad,34);g.font=fs*0.8+'px ui-monospace,monospace';g.fillStyle='rgba(125,211,252,.9)';g.textAlign='right';g.fillText('SMA10 · OBV akışı · sinyal/işlem',W-pad,34);g.textAlign='left';}
  else{g.fillStyle='#bff';g.font='bold 10px ui-monospace,monospace';g.fillText(c.b+' · son 48 mum · SMA10 · OBV akışı',pad,13);}
  g.strokeStyle='rgba(125,211,252,.12)';g.lineWidth=1;for(var y=0;y<=4;y++){var yy=top+ph*y/4;g.beginPath();g.moveTo(pad,yy);g.lineTo(W-pad,yy);g.stroke();}
  for(q=a;q<=i;q++){var x=pad+(q-a+0.5)*bw,up=k4.c[q]>=k4.o[q],col=(up?C1:C2);g.strokeStyle=col+'0.9)';g.lineWidth=holo?2:1;g.beginPath();g.moveTo(x,Y(k4.h[q]));g.lineTo(x,Y(k4.l[q]));g.stroke();
    var y1=Y(Math.max(k4.o[q],k4.c[q])),y2=Y(Math.min(k4.o[q],k4.c[q]));g.fillStyle=col+(holo?'0.75)':'0.85)');g.fillRect(x-bw*0.32,y1,bw*0.64,Math.max(1,y2-y1));}
  g.strokeStyle='rgba(255,230,0,.95)';g.lineWidth=holo?3:1.5;g.beginPath();var st=false;for(q=a;q<=i;q++){if(!isFinite(ma[q]))continue;var xx=pad+(q-a+0.5)*bw;if(!st){g.moveTo(xx,Y(ma[q]));st=true;}else g.lineTo(xx,Y(ma[q]));}g.stroke();
  var fm=0.5;for(q=a;q<=i;q++)if(isFinite(fl[q]))fm=Math.max(fm,Math.abs(fl[q]));var FY=function(v){return fy+fh/2-fh/2*v/fm;};g.strokeStyle='rgba(125,211,252,.25)';g.beginPath();g.moveTo(pad,FY(0));g.lineTo(W-pad,FY(0));g.stroke();
  for(q=a+1;q<=i;q++){if(!isFinite(fl[q])||!isFinite(fl[q-1]))continue;var x0=pad+(q-a-0.5)*bw,x1=pad+(q-a+0.5)*bw;g.strokeStyle=fl[q]>fl[q-1]?C1+'1)':C2+'1)';g.lineWidth=holo?3:1.5;g.beginPath();g.moveTo(x0,FY(fl[q-1]));g.lineTo(x1,FY(fl[q]));g.stroke();}
  g.font=(holo?16:9)+'px ui-monospace,monospace';
  function mark(q,txt,col,below){var x=pad+(q-a+0.5)*bw,y=below?Y(k4.l[q])+(holo?22:11):Y(k4.h[q])-(holo?10:5);g.fillStyle=col;g.textAlign='center';g.fillText(txt,x,y);g.textAlign='left';}
  if(ST.mode==='bist'){for(q=a;q<=i;q++)if(c.cr[q])mark(q,'▲ z−2','#ffe600',true);}
  else{for(q=a;q<=i;q++){if(c.T.en[q])mark(q,'▲AL','#ffe600',true);else if(c.T.vf[q])mark(q,'△VF','#7dd3fc',true);}
    for(var j=0;j<c.s5.length;j++)if(c.s5[j]){var tt=c.k1.t[j]+H1,qq=idxAt(k4.t,tt,H4);if(qq>=a&&qq<=i)mark(qq,'◆','#c084fc',false);}}
  (c.trades||[]).forEach(function(t){if(t.open||t.exitT>(FR?FR.Tc:Date.now()))return;var qq=idxAt(k4.t,t.exitT,tf);if(qq<a||qq>i)return;mark(qq,(t.ret>=0?'✓':'✕')+(holo?' '+pct(t.ret,1):''),t.ret>=0?'#00ffaa':'#ff2e6e',false);});
  if(holo){g.fillStyle='rgba(255,255,255,.035)';for(y=6;y<H-6;y+=4)g.fillRect(6,y,W-12,1);}}
/* ---------- En Yakın 5 ---------- */
function renderTop5(){if(!FR)return;var L=FR.list.slice().sort(function(a,b){return a.r-b.r;}).slice(0,5);
  $('top5').innerHTML=L.map(function(f,q){var p=Math.round(100*(1-f.r));return '<button class="t5'+(f.r<0.05?' fire':'')+'" data-k="'+f.k+'"><em>#'+(q+1)+'</em><b>'+esc(f.c.b)+'</b><small>'+esc(f.setup)+'</small><span class="pb"><i style="width:'+p+'%"></i></span><span class="ms">'+esc(f.miss)+'</span></button>';}).join('');
  $('top5').querySelectorAll('.t5').forEach(function(b){b.onclick=function(){focusOn(+b.getAttribute('data-k'));};});}
/* ---------- skor tablosu (Portföy A bacakları, imleç anına kadar gerçekleşen) ---------- */
function renderScore(){if(!FR)return;var Tc=FR.Tc,start=Date.now()-RWIN,S={yo6:{n:0,w:0,u:0,o:0,ou:0},loxx:{n:0,w:0,u:0,o:0,ou:0},bist:{n:0,w:0,u:0,o:0,ou:0}};
  allTrades().forEach(function(t){var s=tradeAt(t,Tc);if(!s)return;var o=S[t.leg];if(s.closed){o.n++;if(s.ret>0)o.w++;o.u+=s.usd;}else{o.o++;o.ou+=s.usd;}});
  var tot={n:0,w:0,u:0,o:0,ou:0};['yo6','loxx','bist'].forEach(function(k){for(var q in tot)tot[q]+=S[k][q];});
  function row(nm,col,o){return '<div class="sr"><i style="background:'+col+'"></i><span>'+nm+'</span><b>'+o.n+'</b><b>'+(o.n?Math.round(100*o.w/o.n)+'%':'—')+'</b><b class="'+(o.u>=0?'g':'r')+'">'+usd(o.u)+'</b><em>'+(o.o?o.o+' açık '+usd(o.ou):'')+'</em></div>';}
  $('score').innerHTML='<div class="sh">'+(ST.replay&&ST.replay.on?'GERİ OYNATMA SKORU':'SON 30 GÜN SKORU')+' <span>'+fmtT(start)+' → '+fmtT(Tc)+'</span></div><div class="sr hd"><i></i><span>bacak</span><b>işlem</b><b>kazanma</b><b>gerçekleşen</b><em>açık</em></div>'+
   row('YO6 MA 4s',LEGC.yo6,S.yo6)+row('Loxx C 1s',LEGC.loxx,S.loxx)+row('BIST z−2',LEGC.bist,S.bist)+row('TOPLAM','#fff',tot)+'<div class="mut sm">lab çıkış kuralları · $10 marj 2x · komisyon dahil · ileriye bakmadan</div>';}
/* ---------- geri oynatma ---------- */
function replaySteps(){var src=ST.mode==='bist'?ST.bist.filter(function(c){return c.sym==='THYAO';})[0]||ST.bist[0]:ST.coins.filter(function(c){return c.sym==='BTCUSDT';})[0]||ST.coins[0];if(!src)return [];
  var k=ST.mode==='bist'?src.k1:src.k4,tf=ST.mode==='bist'?H1:H4,t0=Date.now()-RWIN;return k.t.map(function(t){return t+tf;}).filter(function(t){return t>=t0;});}
function rpStart(){if(!cur().length)return;var st=replaySteps();if(st.length<2)return;ST.replay={on:true,play:true,steps:st,x:0,T:st[0],speed:ST.replay?ST.replay.speed:6,lastIdx:-1};$('rp').classList.add('on');$('score').classList.add('mob');$('rpS').max=st.length-1;$('rpS').value=0;unfocus();rpApply(true);}
function rpLive(){if(!ST.replay)return;$('rpLog').innerHTML='';ST.replay.on=false;ST.replay.play=false;$('rp').classList.remove('on');$('score').classList.remove('mob');$('rpPlay').textContent='▶';pushFrame();}
function rpApply(force){var R=ST.replay;if(!R)return;var ix=Math.floor(R.x);R.T=R.steps[Math.min(R.steps.length-1,ix)];$('rpS').value=R.x;$('rpD').textContent=fmtT(R.T)+' TSİ';$('rpPlay').textContent=R.play?'❚❚':'▶';
  if(ix!==R.lastIdx||force){var prevT=R.lastIdx>=0?R.steps[R.lastIdx]:null;R.lastIdx=ix;pushFrame();
    if(prevT!=null&&R.T>prevT){var legs=ST.mode==='bist'?{bist:1}:{yo6:1,loxx:1},fired=[];LAY.dots.forEach(function(d,k){(d.c.trades||[]).forEach(function(t){if(legs[t.leg]&&t.fireT>prevT&&t.fireT<=R.T){fired.push({k:k,t:t});}});});
      fired.forEach(function(x){if(G.api&&G.mode==='3d')G.api.fire(x.k);rpLog(x);});if(fired.length)sfx('chime');}}}
function rpLog(x){var el=$('rpLog'),d=LAY.dots[x.k],s='<div style="--c:'+LEGC[x.t.leg]+'"><b>'+esc(d.c.b)+'</b> '+LEGN[x.t.leg]+' ateşledi · '+fmtT(x.t.fireT)+'</div>';el.insertAdjacentHTML('afterbegin',s);while(el.children.length>4)el.removeChild(el.lastChild);}
function rpTick(dt){var R=ST.replay;if(!R||!R.on||!R.play)return;R.x+=dt/1000*R.speed;if(R.x>=R.steps.length-1){R.x=R.steps.length-1;R.play=false;}rpApply(false);}
/* ---------- giriş sekansı ---------- */
var INTRO={on:false,t0:0,dur:2700,skipAsm:false,lines:[]};
function introWanted(){var m=/[?&]intro=([01])/.exec(location.search);if(m)return m[1]==='1';try{return !sessionStorage.getItem('qxr_intro3');}catch(e){return false;}}
function introStart(){INTRO.on=true;INTRO.t0=CLK.now();$('intro').classList.add('on');try{sessionStorage.setItem('qxr_intro3','1');}catch(e){}
  INTRO.lines=['› evren: Binance USDT-M ilk '+($('rdN').value||50)+' · BIST 30','› mumlar: 4s×500 · 1s×1500 · BIST 1s×700','› kuyruk ≤4 istek/sn · 429 → Retry-After','› lab kuralları: YO6 MA 12 mum · Loxx C(50/80) · BIST TP %5','› sinyal galaksisi kuruluyor…'];}
function introTick(){if(!INTRO.on)return;var u=(CLK.now()-INTRO.t0)/INTRO.dur,T='QUANTEX RADAR',n=Math.min(T.length,Math.floor(clamp(u/0.35,0,1)*T.length));
  $('iT').textContent=T.slice(0,n)+(u<0.4?'▌':'');var ls=INTRO.lines,m=Math.floor(clamp((u-0.3)/0.55,0,1)*ls.length*1.0001);$('iL').innerHTML=ls.slice(0,m).map(function(s){return '<div>'+esc(s)+'</div>';}).join('');
  $('iBar').style.width=Math.round(100*clamp(u,0,1))+'%';$('intro').style.opacity=u>0.85?String(clamp((1-u)/0.15,0,1)):'1';if(u>=1)introEnd();}
function introEnd(){if(!INTRO.on)return;INTRO.on=false;$('intro').classList.remove('on');$('intro').style.opacity='';if(G.api&&G.mode==='3d'&&G.api.state.n){G.api.state.asmT0=CLK.now();}}
/* ---------- ses (varsayılan kapalı, WebAudio, dosya yok) ---------- */
var SND={on:false,ac:null,next:0,timer:null};
function sndToggle(){SND.on=!SND.on;$('sBtn').classList.toggle('on',SND.on);$('sBtn').textContent=SND.on?'🔊 ses açık':'🔇 ses';if(SND.on){try{SND.ac=SND.ac||new (window.AudioContext||window.webkitAudioContext)();SND.ac.resume();}catch(e){SND.on=false;}beat();}else clearTimeout(SND.timer);}
function tone(f0,f1,dur,g0,type){var ac=SND.ac,t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(g0,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+0.05);}
function curStress(){var P=pulseData();return P&&P.st.length?P.st[P.st.length-1].s:0;}
function beat(){if(!SND.on||!SND.ac)return;var s=curStress(),bpm=48+72*Math.min(1.6,s)/1.6;if(!document.hidden){tone(70,40,0.16,0.22);setTimeout(function(){if(SND.on)tone(62,38,0.14,0.13);},150);}SND.timer=setTimeout(beat,60000/bpm);}
function sfx(k){if(!SND.on||!SND.ac)return;if(k==='chime'){tone(880,870,1.2,0.06);setTimeout(function(){tone(1320,1310,1.0,0.04);},70);}else if(k==='focus')tone(520,780,0.25,0.04,'triangle');}
/* ---------- Nabız (EKG) ---------- */
var ECG={head:0,last:0};
function pulseData(){var T=ST.replay&&ST.replay.on?ST.replay.T:null;if(ST.mode==='bist'){var b=ST.bPulse;if(!b)return null;if(T==null)return {st:b.st,mr:b.mr,sc:b.sc,bn:b.bn,calm:b.calm,tf:'1s'};var h=stressHist(ST.bB,48,T-H1),l=h[h.length-1]||{};return {st:h,mr:l.mr,sc:l.sc,bn:b.bn,calm:!(l.s>=1),tf:'1s'};}
  var P=ST.pulse;if(!P)return null;if(T==null)return {st:P.stHist,mr:P.mr,sc:P.sc,bn:P.bn,calm:P.calm,tf:'4s',btc:P.btc};var h2=stressHist(ST.cB,48,T-H4),l2=h2[h2.length-1]||{};return {st:h2,mr:l2.mr,sc:l2.sc,bn:P.bn,calm:!(l2.s>=1),tf:'4s'};}
function ecgDraw(ts){requestAnimationFrame(ecgDraw);if(document.hidden)return;var cv=$('ecg');if(!cv||!cv.clientWidth)return;var X=hidpi(cv),g=X.g,W=X.w,H=X.h,P=pulseData();var dt=ECG.last?Math.min(100,ts-ECG.last):16;ECG.last=ts;ECG.head=(ECG.head+dt/6500)%1;g.clearRect(0,0,W,H);
  g.strokeStyle='rgba(0,255,170,.07)';g.lineWidth=1;for(var x=0;x<W;x+=12){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(var y=0;y<H;y+=12){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  if(!P||!P.st.length)return;var n=P.st.length,bw=W/n,base=H*0.64,amp=H*0.56,thY=base-amp*(1/1.6);for(var i=0;i<n;i++)if(P.st[i].s>=1){g.fillStyle='rgba(255,46,110,.16)';g.fillRect(i*bw,0,bw,H);}
  g.strokeStyle='rgba(255,230,0,.35)';g.setLineDash([4,4]);g.beginPath();g.moveTo(0,thY);g.lineTo(W,thY);g.stroke();g.setLineDash([]);g.fillStyle='rgba(255,230,0,.6)';g.font='9px ui-monospace,monospace';g.fillText('eşik = sakin değil',4,thY-3);
  function yAt(xp){var i=Math.floor(xp/bw);if(i<0||i>=n)return base;var u=(xp-i*bw)/bw,A=0.06+0.94*P.st[i].s/1.6,v=0.10*A*Math.exp(-Math.pow((u-0.22)/0.05,2))-0.18*A*Math.exp(-Math.pow((u-0.42)/0.018,2))+A*Math.exp(-Math.pow((u-0.47)/0.022,2))-0.28*A*Math.exp(-Math.pow((u-0.52)/0.02,2))+0.22*A*Math.exp(-Math.pow((u-0.72)/0.07,2));return base-amp*v;}
  var hx=ECG.head*W,gap=26,hot=P.st[n-1].s>=1;for(var pass=0;pass<2;pass++){g.beginPath();var s=false;for(var px=0;px<=W;px+=1.5){var vis=pass===0?px<=hx:px>hx+gap;if(!vis){s=false;continue;}var yy=yAt(px);if(!s){g.moveTo(px,yy);s=true;}else g.lineTo(px,yy);}
    g.strokeStyle=pass===0?(hot?'#ffe600':'#00ffaa'):'rgba(0,255,170,.35)';g.lineWidth=pass===0?2:1.3;g.shadowColor=hot?'#ffe600':'#00ffaa';g.shadowBlur=pass===0?10:0;g.stroke();g.shadowBlur=0;}
  g.fillStyle='#fff';g.shadowColor='#00ffaa';g.shadowBlur=14;g.beginPath();g.arc(hx,yAt(hx),2.6,0,7);g.fill();g.shadowBlur=0;}
function renderPulse(){var P=pulseData(),L=cur(),s=P&&P.st.length?P.st[P.st.length-1].s:NaN;num($('pStress'),s*100/1.6,Math.round);
  $('pState').className='state '+(P&&!P.calm?'hot':'calm');$('pState').textContent=!P?'veri bekleniyor':P.calm?'SAKİN · YO6 filtresi kapalı':'SAKİN DEĞİL · YO6 sinyalleri açık';
  $('pEcgLbl').textContent='her atım = bir '+(P?P.tf:'')+' mumu (son '+(P?P.st.length:0)+') · genlik = stres'+(ST.replay&&ST.replay.on?' · geri oynatma imleci':'');
  num($('pMr'),P?P.mr*100:NaN,function(v){return (v>=0?'+':'')+v.toFixed(2)+'%';});$('pMr').className=P&&P.mr<0?'r':'g';num($('pSc'),P?P.sc:NaN,function(v){return Math.round(v)+'/'+(P?P.bn:0);});
  var up=0,nn=0;(FR?FR.list:[]).forEach(function(f){if(f.up!=null){nn++;if(f.up)up++;}});num($('pBr'),nn?100*up/nn:NaN,function(v){return Math.round(v)+'%';});
  if(P&&P.btc){$('pBtcRow').style.display='';num($('pBtc'),P.btc.d*100,function(v){return (v>=0?'ÜSTÜNDE +':'ALTINDA ')+v.toFixed(2)+'%';});$('pBtc').className=P.btc.d>=0?'g':'r';}else $('pBtcRow').style.display='none';
  var S={};(FR?FR.list:[]).forEach(function(f){var o=S[f.c.sec]=S[f.c.sec]||{u:0,d:0,n:0};o.n++;if(f.up===true)o.u++;else if(f.up===false)o.d++;});var ks=Object.keys(S).sort(function(a,b){return S[b].n-S[a].n;}),mx=1;ks.forEach(function(k){mx=Math.max(mx,S[k].u,S[k].d);});
  $('pDepth').innerHTML=ks.map(function(k){var o=S[k];return '<div class="dr"><span class="dd"><i style="width:'+(100*o.d/mx)+'%"></i><b>'+o.d+'</b></span><span class="dn">'+esc(k)+'</span><span class="du"><i style="width:'+(100*o.u/mx)+'%"></i><b>'+o.u+'</b></span></div>';}).join('');
  var hs=(FR?FR.list:[]).slice().sort(function(a,b){return a.c.sec===b.c.sec?b.c.qv-a.c.qv:a.c.sec.localeCompare(b.c.sec,'tr');});
  $('pHeat').innerHTML=hs.map(function(f){var v=f.ch,a=clamp(Math.abs(v)/8,0.15,1),col=v>=0?'0,255,170':'255,46,110';return '<a data-k="'+f.k+'" title="'+esc(f.c.b+' '+(isFinite(v)?v.toFixed(2)+'%':'—')+' · '+f.c.sec)+'" style="background:rgba('+col+','+a+');box-shadow:0 0 '+(6*a)+'px rgba('+col+','+a+')"></a>';}).join('');
  $('pHeat').querySelectorAll('a').forEach(function(a){a.onclick=function(){focusOn(+a.getAttribute('data-k'));};});}
/* ---------- Portföy A ---------- */
function eqSpark(cv,E){if(!cv.clientWidth)return;var X=hidpi(cv),g=X.g,w=X.w,h=X.h;g.clearRect(0,0,w,h);var p=E.pts,t0=E.t0,t1=p[p.length-1][0],mn=0,mx=0;p.forEach(function(q){mn=Math.min(mn,q[1]);mx=Math.max(mx,q[1]);});
  var Xf=function(t){return 2+(w-4)*(t-t0)/Math.max(1,t1-t0);},Yf=function(v){return h-3-(h-6)*(v-mn)/Math.max(1e-9,mx-mn);};g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(0,Yf(0));g.lineTo(w,Yf(0));g.stroke();
  var gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,255,170,.35)');gr.addColorStop(1,'rgba(0,255,170,0)');g.beginPath();g.moveTo(Xf(t0),Yf(0));p.forEach(function(q){g.lineTo(Xf(q[0]),Yf(q[1]));});g.lineTo(Xf(t1),Yf(0));g.closePath();g.fillStyle=gr;g.fill();
  g.beginPath();g.moveTo(Xf(t0),Yf(0));p.forEach(function(q){g.lineTo(Xf(q[0]),Yf(q[1]));});g.strokeStyle='#00ffaa';g.lineWidth=1.6;g.shadowColor='#00ffaa';g.shadowBlur=8;g.stroke();g.shadowBlur=0;
  g.fillStyle='rgba(214,255,242,.55)';g.font='9px ui-monospace,monospace';g.fillText('lab · Oca→Eki 2026',4,10);g.textAlign='right';g.fillText('+$'+E.usd,w-3,10);g.textAlign='left';}
function renderPort(){var now=Date.now(),cs=ST.coins,bs=ST.bist,b=[],l=[],y=[],w=[],bn=0,ln=0;
  bs.forEach(function(c){c.ev.forEach(function(e){if(now-e.t<=72*H1)b.push({s:c.b,d:e.tx.replace('z −2 yukarı kesti','−2 kesti')+' · şimdi '+f2(c.z),t:e.t,u:chartUrlS('bist',c.sym)});});if(c.z<-2)bn++;});
  cs.forEach(function(c){c.lx.ev.forEach(function(e){if(now-e.t<=72*H1)l.push({s:c.b,d:'pst '+f0(c.lx.pst)+' · z '+f2(c.lx.z),t:e.t,u:chartUrlS('coin',c.sym)});});if(c.lx.ok&&c.lx.z>0&&c.lx.pst>=5&&c.lx.pst<30&&c.lx.pst<c.lx.pss)ln++;
    if(c.t41.enAge!=null&&c.t41.enAge<12)y.push({s:c.b,d:'AL · '+c.t41.enAge+' mum',t:c.t41.enT,u:chartUrlS('coin',c.sym)});if(c.t41.wait)w.push({s:c.b,d:'SMA10 '+f1(c.t41.maGap*100)+'% yukarıda',t:c.t41.vfT,u:chartUrlS('coin',c.sym)});});
  [b,l,y,w].forEach(function(a){a.sort(function(p,q){return q.t-p.t;});});
  function light(on,near){return on?'<i class="lt on" title="aktif sinyal"></i>':near?'<i class="lt nr" title="yakın aday"></i>':'<i class="lt" title="boşta"></i>';}
  function rows(a,e){return a.length?a.slice(0,3).map(function(x){return '<a class="sig" href="'+x.u+'" target="_blank"><b>'+esc(x.s)+'</b><span>'+esc(x.d)+'</span><em>'+fmtAge(now-x.t)+'</em></a>';}).join(''):'<div class="mut sm0">'+e+'</div>';}
  function card(key,L,on,near,cnt,list,empty,id){var E=LABEQ[key];return '<div class="leg glass2"><div class="lh">'+light(on,near)+'<h4 style="color:'+LEGC[key]+'">'+L.nm+'</h4><small>'+L.tf+'</small></div><div class="bdg"><span>PF <b>'+L.pf+'</b></span><span>rastgele '+L.rnd+'</span><span>'+E.n+' işlem</span><span>%'+E.win+' kazanma</span><span>DD $'+E.dd+'</span></div><canvas class="eq" id="'+id+'"></canvas><div class="cnt">'+cnt+'</div>'+rows(list,empty)+'</div>';}
  $('rdPort').innerHTML=card('bist',LAB.bist,b.some(function(x){return now-x.t<=24*H1;}),bn>0,'72 sa: <b>'+b.length+'</b> sinyal · z<−2: <b>'+bn+'</b>',b,bs.length?'son 72 saatte sinyal yok':'BIST verisi yok','eqB')+
    card('loxx',LAB.loxx,l.some(function(x){return now-x.t<=3*H1;}),ln>0,'72 sa: <b>'+l.length+'</b> sinyal · kesişim bekleyen: <b>'+ln+'</b>',l,'son 72 saatte sinyal yok','eqL')+
    card('yo6',LAB.yo6,y.length>0,w.length>0,'aktif AL: <b>'+y.length+'</b> · SMA10 bekleyen: <b>'+w.length+'</b>',y.concat(w),'aktif AL yok','eqY')+'<div class="mut sm">Rozet + eğri: lab 2026-01-01→10-18 · $10 marj 2x · %0.04 komisyon. Işık: yeşil aktif · amber yakın · sönük boşta.</div>';
  eqSpark($('eqB'),LABEQ.bist);eqSpark($('eqL'),LABEQ.loxx);eqSpark($('eqY'),LABEQ.yo6);}
/* ---------- Sinyal nehri ---------- */
var RV={ev:[],hot:null};
function riverData(){var all=[];ST.coins.forEach(function(c){c.t41.ev.concat(c.lx.ev).forEach(function(e){all.push({s:c.b,e:e,u:chartUrlS('coin',c.sym),sym:c.sym});});});ST.bist.forEach(function(c){c.ev.forEach(function(e){all.push({s:c.b,e:e,u:chartUrlS('bist',c.sym),sym:c.sym});});});
  var first=!ST.lastAt,anyNew=false;all.forEach(function(x){var id=x.s+'|'+x.e.k+'|'+x.e.t;if(!ST.seen[id])ST.seen[id]=first?1:2;x.nw=ST.seen[id]===2;if(x.nw)anyNew=true;});
  RV.ev=all.filter(function(x){return Date.now()-x.e.t<=72*H1;});var c={};RV.ev.forEach(function(x){c[x.e.k]=(c[x.e.k]||0)+1;});RV.cnt=c;$('rvN').textContent=RV.ev.length+' sinyal / 72 sa'+(anyNew?' · YENİ var':'');if(anyNew&&!first)sfx('chime');}
function riverDraw(ts){requestAnimationFrame(riverDraw);if(document.hidden)return;var cv=$('river');if(!cv||!cv.clientWidth)return;var X=hidpi(cv),g=X.g,W=X.w,H=X.h,now=Date.now(),t0=now-72*H1,lx=92,Wd=W-lx-14,lh=(H-18)/LANES.length,T=ts/1000;g.clearRect(0,0,W,H);
  for(var h=0;h<=72;h+=6){var t=now-h*H1,x=lx+Wd*(t-t0)/(72*H1);g.strokeStyle='rgba(125,211,252,'+(h%24===0?0.18:0.07)+')';g.beginPath();g.moveTo(x,0);g.lineTo(x,H-14);g.stroke();if(h%12===0){g.fillStyle='rgba(125,211,252,.55)';g.font='9px ui-monospace,monospace';g.textAlign='center';g.fillText(h?'-'+h+'sa':'şimdi',x,H-3);g.textAlign='left';}}
  LANES.forEach(function(L,i){var y=lh*i+lh/2,gr=g.createLinearGradient(lx,0,lx+Wd,0),o=((T*0.08)%1);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(Math.max(0,o-0.05),'rgba(255,255,255,0)');gr.addColorStop(o,L[2]+'55');gr.addColorStop(Math.min(1,o+0.05),'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,0)');
    g.strokeStyle=L[2]+'30';g.lineWidth=1;g.beginPath();g.moveTo(lx,y);g.lineTo(lx+Wd,y);g.stroke();g.strokeStyle=gr;g.lineWidth=3;g.beginPath();g.moveTo(lx,y);g.lineTo(lx+Wd,y);g.stroke();g.lineWidth=1;g.fillStyle=L[2];g.font='bold 10px ui-monospace,monospace';g.fillText(L[1],6,y-1);g.fillStyle='rgba(214,255,242,.5)';g.font='9px ui-monospace,monospace';g.fillText((RV.cnt&&RV.cnt[L[0]]||0)+' sinyal',6,y+10);});
  var nx=lx+Wd,ph=(T%2)/2;g.strokeStyle='rgba(255,230,0,'+(0.7-0.5*ph)+')';g.beginPath();g.moveTo(nx,0);g.lineTo(nx,H-14);g.stroke();var occ={};
  RV.ev.forEach(function(x){var li=LANES.findIndex(function(L){return L[0]===x.e.k;});if(li<0)return;var px=lx+Wd*(x.e.t-t0)/(72*H1),key=li+'|'+Math.round(px/6),k=occ[key]=(occ[key]||0)+1,per=Math.max(1,Math.floor((lh-6)/5)),row=(k-1)%per,col=Math.floor((k-1)/per);x.px=px+col*5;x.py=lh*li+lh/2+((row%2?1:-1)*Math.ceil(row/2))*5;
    var cl=LANES[li][2],r=x.nw?4.5:3.2,pul=x.nw?1+0.4*Math.sin(T*5):1;g.shadowColor=cl;g.shadowBlur=12;g.fillStyle=cl;g.beginPath();g.arc(x.px,x.py,r*pul,0,7);g.fill();g.shadowBlur=0;if(RV.hot===x){g.strokeStyle='#fff';g.beginPath();g.arc(x.px,x.py,r+4,0,7);g.stroke();}});}
function riverHit(e){var b=$('river').getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,best=null,bd=10;RV.ev.forEach(function(v){if(v.px==null)return;var d=Math.hypot(v.px-x,v.py-y);if(d<bd){bd=d;best=v;}});return best;}
function renderRobot(){var R=robot();function blk(nm,x,cu){if(!x)return '<div class="rb glass2"><h5>'+nm+'</h5><div class="mut">bu tarayıcıda kayıt yok</div></div>';
    var op=x.open.slice(0,6).map(function(p){var s=p.sym||p.symbol||'?',sd=p.side||'L',e=+(p.entry||p.price||0);return '<span class="op">'+esc(String(s).replace(/USDT$/,''))+' '+esc(sd)+(e?' @'+e.toPrecision(5):'')+'</span>';}).join('');
    return '<div class="rb glass2"><h5>'+nm+(x.run?' <small class="g">● çalışıyor</small>':'')+'</h5><div class="kv"><span>Bakiye</span><b>'+(isFinite(x.eq)?x.eq.toLocaleString('tr-TR')+cu:'—')+'</b></div><div class="kv"><span>Gerçekleşen K/Z</span><b class="'+(x.pnl>=0?'g':'r')+'">'+x.pnl.toLocaleString('tr-TR',{maximumFractionDigits:2})+cu+'</b></div><div class="kv"><span>Açık pozisyon</span><b>'+x.open.length+'</b></div><div>'+op+'</div></div>';}
  $('rdRobot').innerHTML=blk('Kağıt robot · Coin',R.coin,' $')+blk('Kağıt robot · BIST',R.bist,' ₺');}
/* ---------- üst bar ---------- */
function clock(){$('tClock').textContent=new Date().toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' TSİ';}
var BTC={p:NaN};async function btcTick(){if(document.hidden)return;try{var j=await getJSON('/api/fapi/v1/ticker/24hr?symbol=BTCUSDT'),p=+j.lastPrice,ch=+j.priceChangePercent,el=$('tBtc');if(isFinite(BTC.p)&&p!==BTC.p){el.classList.remove('fu','fd');void el.offsetWidth;el.classList.add(p>BTC.p?'fu':'fd');}BTC.p=p;
  el.innerHTML='<small>BTC</small> <b>'+p.toLocaleString('tr-TR',{maximumFractionDigits:1})+'</b> <span class="'+(ch>=0?'g':'r')+'">'+(ch>=0?'+':'')+ch.toFixed(2)+'%</span>';}catch(e){}}
function status2(t){var e=$('rdStatus');if(e)e.textContent=t;}
status=function(t){status2(t);var m=/(\d+)\/(\d+)/.exec(t);if(m)$('tProg').style.width=(100*m[1]/m[2])+'%';};
function renderAll(){heroData();renderPort();riverData();renderRobot();}
async function refresh(){if(ST.busy)return;ST.busy=true;ST.err=[];$('rdBtn').disabled=true;$('tScan').classList.add('on');var t0=Date.now();
  try{if(ST.mode==='coin'||!ST.coins.length)await scanCoins(+($('rdN').value)||50);renderAll();try{await scanBist();}catch(e){ST.err.push('BIST: '+(e.message||e));}
    renderAll();ST.lastAt=Date.now();status2('Güncellendi '+fmtT(ST.lastAt)+' · '+((Date.now()-t0)/1000).toFixed(0)+' sn · '+ST.req+' istek'+(ST.err.length?' · '+ST.err.length+' hata':''));$('tProg').style.width='100%';if(ST.err.length)console.warn('radar hatalar',ST.err);}
  catch(e){status2('Hata: '+(e.message||e));console.error(e);}ST.busy=false;$('rdBtn').disabled=false;$('tScan').classList.remove('on');window.QX_RADAR_READY=true;}
function setMode(m){if(ST.mode===m)return;unfocus();ST.replay=null;$('rp').classList.remove('on');$('score').classList.remove('mob');$('rpLog').innerHTML='';ST.mode=m;document.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-mode')===m);});if(cur().length)heroData();}
/* ---------- ana döngü ---------- */
var LT=null;function uiTick(){var n=CLK.now(),dt=LT==null?16:Math.min(200,n-LT);LT=n;introTick();rpTick(dt);}
function rafLoop(){uiTick();requestAnimationFrame(rafLoop);}
window.RDCAP={tick:function(dt){CLK.v+=dt;uiTick();if(G.api)G.api.frame();},begin:function(){introStart();},replay:function(x,spd){rpStart();ST.replay.x=x||0;ST.replay.speed=spd||6;rpApply(true);},focus:focusOn,unfocus:unfocus,orbit:function(a){G.api&&G.api.orbit(a);}};
window.addEventListener('DOMContentLoaded',function(){var q=/[?&]view=(2d|3d)/.exec(location.search);if(q)G.want=q[1];
  $('rdBtn').onclick=refresh;document.querySelectorAll('[data-mode]').forEach(function(b){b.onclick=function(){setMode(b.getAttribute('data-mode'));};});
  $('vBtn').onclick=function(){G.want=G.mode==='3d'?'2d':'3d';if(G.want==='2d'&&G.api){G.api.dispose();G.api=null;G.mode='?';}heroInit();$('vBtn').textContent=G.want==='3d'?'2D':'3D';};
  $('sBtn').onclick=sndToggle;$('rpBtn').onclick=function(){if(ST.replay&&ST.replay.on)rpLive();else rpStart();};
  $('rpPlay').onclick=function(){var R=ST.replay;if(!R)return;if(R.x>=R.steps.length-1)R.x=0;R.play=!R.play;rpApply(true);};$('rpS').oninput=function(){var R=ST.replay;if(!R)return;R.x=+this.value;R.play=false;rpApply(false);};
  $('rpLiveB').onclick=rpLive;document.querySelectorAll('[data-spd]').forEach(function(b){b.onclick=function(){if(ST.replay)ST.replay.speed=+b.getAttribute('data-spd');document.querySelectorAll('[data-spd]').forEach(function(x){x.classList.toggle('on',x===b);});};});
  $('fClose').onclick=unfocus;document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(INTRO.on)introEnd();else unfocus();}if(e.key===' '&&ST.replay&&ST.replay.on&&e.target===document.body){e.preventDefault();$('rpPlay').click();}});
  $('intro').addEventListener('click',introEnd);$('lgBtn').onclick=function(){$('hLeg').classList.toggle('on');};
  var rv=$('river');rv.addEventListener('mousemove',function(e){var h=riverHit(e);RV.hot=h;rv.style.cursor=h?'pointer':'default';var t=$('rvTip');if(!h){t.style.display='none';return;}var b=rv.getBoundingClientRect();t.innerHTML='<b>'+esc(h.s)+'</b> '+esc(h.e.tx)+'<br><span class="mut">'+fmtT(h.e.t)+' TSİ · '+fmtAge(Date.now()-h.e.t)+' önce</span>';t.style.display='block';t.style.left=Math.min(b.width-240,e.clientX-b.left+12)+'px';t.style.top=(e.clientY-b.top-46)+'px';});
  rv.addEventListener('mouseleave',function(){RV.hot=null;$('rvTip').style.display='none';});rv.addEventListener('click',function(e){var h=riverHit(e);if(h)window.open(h.u,'_blank');});
  var cards=$('cards');cards.addEventListener('scroll',function(){var w=cards.clientWidth,i=Math.round(cards.scrollLeft/(w*0.9));document.querySelectorAll('#cdots i').forEach(function(d,q){d.classList.toggle('on',q===i);});},{passive:true});
  clock();setInterval(clock,1000);btcTick();setInterval(btcTick,15000);if(introWanted()&&!CLK.cap)introStart();
  heroInit();requestAnimationFrame(ecgDraw);requestAnimationFrame(riverDraw);if(!CLK.cap)requestAnimationFrame(rafLoop);renderRobot();refresh();setInterval(function(){if(!(ST.replay&&ST.replay.on))refresh();},15*60*1000);setInterval(renderRobot,30000);
  setInterval(function(){if(FR&&!(ST.replay&&ST.replay.on))pushFrame();},60000);window.QX_RADAR=ST;window.QX_FR=function(){return FR;};});
})();
