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
  postCoins(out);}
/* v6: tarama sonrası türetme — canlı akışta kapanan mumdan sonra da aynı yol (kesinleşti) */
function postCoins(out){
  out.sort(function(a,b){return b.qv-a.qv;});
  var B=rBasket(out.slice(0,40).map(function(c){return c.k4;}),H4,null),start=Date.now()-RWIN;
  out.forEach(function(c){prepCoin(c,B,start);});
  var btc=out.filter(function(c){return c.sym==='BTCUSDT';})[0];
  ST.coins=out;ST.cB=B;ST.pulse=pulseCoin(out,B,btc);ST.cReg=regSeries(out.slice(0,40).map(function(c){return c.k4;}),H4,btc?btc.k4:null);out.forEach(function(c){featCoin(c,B);});}

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
  // 4s bileşeni (YO6 MA / süpürme) ve 1s bileşeni (Loxx) ayrı tutulur → r = min(r4, r1)
  var o4={r:0.6+0.4*clamp(dl/12,0,1),why:'uzak · dibe '+f1(dl)+' ATR',setup:'—',miss:'48 mum dibine '+f1(dl)+' ATR',st:'far'};
  var o1={r:0.6+0.4*clamp(isFinite(pst)?Math.abs(pst-15)/85:1,0,1),why:'uzak · pst '+f0(pst),setup:'—',miss:isFinite(pst)&&z>0&&pst>=30?'pst '+f0(pst)+'→30 altı bekleniyor':isFinite(z)&&z<=0?'z200 '+f2(z)+' → >0 gerekli':'pst '+f0(pst),st:'far'};
  function take(o,v,w,s,m,st){if(v<o.r){o.r=v;o.why=w;o.setup=s;o.miss=m;o.st=st;}}
  if(T.en[i]||(i>0&&T.en[i-1]))take(o4,0.02,'YO6 MA AL','YO6 MA','ateşledi · giriş sonraki mum','yo6f');
  if(T.wt[i]){var gap=(T.ma[i]-k.c[i])/T.ma[i],left=12-(i-T.pendAt[i]);take(o4,0.10+0.20*clamp(gap/0.03,0,1),'YO6 VF ateşledi · SMA10 geri alımı bekleniyor','YO6 MA','SMA10\'a %'+f1(gap*100)+' · '+left+' mum kaldı','vfw');}
  if(lxOk){if(c.s5[j]||(j>0&&c.s5[j-1]))take(o1,0.03,'Loxx üçgen + z>0','Loxx','ateşledi · giriş sonraki mum','lxf');
    else if(z>0&&pst>=5&&pst<30&&pst<pss)take(o1,0.30+0.25*clamp((pss-pst)/10,0,1),'Loxx pst bölgede · kesişim bekleniyor','Loxx','pst '+f0(pst)+'→pss '+f0(pss)+' kesişimi'+(pst<10?' (pst ≥10 olmalı)':pst>=20?' (pst <20 olmalı)':''),'lxz');}
  var si=T.sw[i]?i:(i>0&&T.sw[i-1])?i-1:(i>1&&T.sw[i-2])?i-2:-1;
  if(si>=0&&!T.vf[si]){var fo=isFinite(T.fl[si])&&isFinite(T.fl[si-1])&&T.fl[si]>T.fl[si-1];take(o4,0.50,'Süpürme var (filtreden geçmedi)','YO6','süpürme var · eksik: '+[!T.cl[si]?'sakin değil filtresi':'',!fo?'OBV akışı↑':''].filter(Boolean).join(' + '),'sw');}
  // eski davranışla aynı: en yakın bileşen kazanır; uzak durumda eksik metni 1s/4s'ten hangisi daha bilgilendiriciyse
  var o=o1.r<o4.r?o1:o4;if(o.st==='far'){o={r:Math.min(o1.r,o4.r),why:'uzak · dibe '+f1(dl)+' ATR',setup:'—',miss:o1.miss.indexOf('→')>=0?o1.miss:o4.miss,st:'far'};}
  return {r:o.r,why:o.why,setup:o.setup,miss:o.miss,st:o.st,r1:o1.r,r4:o4.r,st1:o1.st,st4:o4.st};}
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
  ST.bist=out;ST.xu=xu;if(out.length>=3){var BB=rBasket(out.map(function(c){return c.k1;}),H1,xu),tl=BB.ts[BB.ts.length-1];ST.bB=BB;ST.bPulse={st:stressHist(BB,48),mr:BB.mr[tl],sc:BB.sc[tl],bn:BB.n,calm:!((isFinite(BB.mr[tl])&&BB.mr[tl]<=-0.05)||BB.br[tl]>=0.10)};ST.bReg=regSeries(out.map(function(c){return c.k1;}),H1,null);out.forEach(function(c){featBist(c,BB);});}}
function proxBist(c,i){var z=c.Z[i],o;
  if(c.cr[i]||(i>0&&c.cr[i-1]))o={r:0.02,why:'z −2 yukarı kesti',miss:'ateşledi · giriş sonraki mum',st:'bf'};
  else if(z<-2)o={r:0.10+0.25*clamp((-2-z)/1.5,0,1),why:'z '+f2(z)+' · −2 üstüne dönüş bekleniyor',miss:'z '+f2(z)+' → −2 üstü kapanış',st:'bz'};
  else if(z<-1)o={r:0.35+0.25*(z+2),why:'z '+f2(z)+' · −2 yakınında',miss:'z '+f2(z)+' · önce −2 altı, sonra dönüş',st:'bn'};
  else o={r:0.6+0.4*clamp((z+1)/4,0,1),why:'z '+f2(z)+' · uzak',miss:'z '+f2(z)+' · −2 bölgesine uzak',st:'far'};o.setup='BIST z−2';return o;}
function readLS(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function robot(){var cfg=readLS('qxbot_cfg_v1'),st=readLS('qxbot_state_v1'),bs=readLS('qxbot_bist_v1');
  return {coin:st?{eq:cfg&&+cfg.equity,pnl:+st.pnl||0,open:(st.open||[]),run:!!st.running}:null,bist:bs?{eq:+bs.equity,pnl:+bs.pnl||0,open:(bs.open||[])}:null};}
/* ================= v4 · istihbarat katmanı ================= */
/* LAB rejim tablosu: lab işlemleri (Oca→Eki 2026) girişteki rejime göre etiketlendi (regime_lab.py, aynı formül) */
var LABREG={"legs":{"yo6":{"stres":{"n":67,"w":34,"usd":24.1,"pf":2.15,"win":50.7},"sakin":{"n":29,"w":17,"usd":3.2,"pf":1.4,"win":58.6},"up":{"n":1,"w":1,"usd":0.6,"pf":null,"win":100.0},"down":{"n":106,"w":80,"usd":52.2,"pf":5.21,"win":75.5}},"loxx":{"up":{"n":27,"w":16,"usd":66.0,"pf":3.63,"win":59.3},"sakin":{"n":7,"w":7,"usd":26.6,"pf":null,"win":100.0},"stres":{"n":3,"w":1,"usd":-0.1,"pf":0.99,"win":33.3},"down":{"n":11,"w":5,"usd":13.4,"pf":1.54,"win":45.5}},"bist":{"stres":{"n":46,"w":37,"usd":20.7,"pf":2.32,"win":80.4},"down":{"n":44,"w":29,"usd":0.2,"pf":1.01,"win":65.9},"sakin":{"n":8,"w":8,"usd":7.9,"pf":null,"win":100.0},"up":{"n":7,"w":5,"usd":-2.3,"pf":0.68,"win":71.4}}},"bars4":{"down":591,"sakin":343,"up":576,"stres":232},"barsB":{"sakin":218,"up":614,"down":716,"stres":155},"period":"2026-01-01\u21922026-10-16"};
var REGN={stres:'STRES',sakin:'SAKİN',up:'TREND ↑',down:'TREND ↓'},REGC={stres:'#ff2e6e',sakin:'#7dd3fc',up:'#00ffaa',down:'#ffb020'},REGK=['sakin','stres','up','down'];
function stressOf(mr,br){var a=isFinite(mr)?-mr/0.05:0,b=isFinite(br)?br/0.10:0;return Math.max(0,Math.min(1.6,Math.max(a,b)));}
function classify(s,d,b50){if(s>=1)return 'stres';if(isFinite(d)&&isFinite(b50)){if(d>0&&b50>=0.55)return 'up';if(d<0&&b50<=0.45)return 'down';}return 'sakin';}
/* Rejim serisi: sepet stresi (YO6 filtresiyle aynı) + BTC/EMA50 (coin) ya da eşit ağırlıklı medyan endeks/EMA50 (BIST) + genişlik (EMA50 üstü oranı) */
function regSeries(list,tf,btcK){var swT={},nT={},retT={},ab={},nb={};
  list.forEach(function(k){var sw=rSweep(k),e=rEma(k.c,50);for(var i=0;i<k.c.length;i++){var t=k.t[i];nT[t]=(nT[t]||0)+1;if(sw[i]||(i>0&&sw[i-1])||(i>1&&sw[i-2]))swT[t]=(swT[t]||0)+1;if(i>0)(retT[t]=retT[t]||[]).push(Math.log(k.c[i]/k.c[i-1]));if(i>=49){nb[t]=(nb[t]||0)+1;if(k.c[i]>e[i])ab[t]=(ab[t]||0)+1;}}});
  var ts=Object.keys(nT).map(Number).sort(function(a,b){return a-b;}),NB=Math.max(1,Math.round(864e5/tf));
  var med=ts.map(function(t){var a=(retT[t]||[]).slice().sort(function(x,y){return x-y;});if(!a.length)return NaN;var h=a.length>>1;return a.length%2?a[h]:(a[h-1]+a[h])/2;});
  var cum=[],acc=0;med.forEach(function(m){acc+=isFinite(m)?m:0;cum.push(acc);});var ce=rEma(cum,50),bd={};
  if(btcK){var be=rEma(btcK.c,50);for(var q=49;q<btcK.c.length;q++)bd[btcK.t[q]]=btcK.c[q]/be[q]-1;}
  var R={ts:ts,reg:{},s:{},d:{},b50:{},tf:tf};
  for(var i=0;i<ts.length;i++){var t=ts[i],s=0,c=0;for(var j=Math.max(0,i-NB+1);j<=i;j++)if(isFinite(med[j])){s+=med[j];c++;}var mr=c>=Math.ceil(NB/2)?s:NaN,br=(swT[t]||0)/nT[t];
    var st=stressOf(mr,br),d=btcK?(t in bd?bd[t]:NaN):(i>=49?cum[i]-ce[i]:NaN),b=nb[t]?(ab[t]||0)/nb[t]:NaN;R.s[t]=st;R.d[t]=d;R.b50[t]=b;R.reg[t]=classify(st,d,b);}
  return R;}
function regIdx(R,T){var lo=0,hi=R.ts.length-1,f=-1;while(lo<=hi){var m=(lo+hi)>>1;if(R.ts[m]+R.tf<=T){f=m;lo=m+1;}else hi=m-1;}return f;}
function regAt(R,T){if(!R)return null;var q=regIdx(R,T==null?Date.now():T);if(q<0)return null;var t=R.ts[q];return {t:t,reg:R.reg[t],s:R.s[t],d:R.d[t],b50:R.b50[t]};}
function legMarket(leg){return leg==='bist'?'b':'c';}
function legReg(leg,T){return regAt(leg==='bist'?ST.bReg:ST.cReg,T);}
/* güven etiketi: lab'de bu rejimde n≥10 ve PF≥1.3 ve $>0 → GÜVEN; PF<1 veya $<0 → ZAYIF; n<10 → VERİ AZ */
function trust(leg,reg){var o=LABREG.legs[leg]&&LABREG.legs[leg][reg];if(!o||o.n<10)return {k:'az',t:'VERİ AZ',o:o};var pf=o.pf==null?99:o.pf;if(pf>=1.3&&o.usd>0)return {k:'ok',t:'GÜVEN',o:o};if(pf<1||o.usd<0)return {k:'bad',t:'ZAYIF',o:o};return {k:'mid',t:'NÖTR',o:o};}
function pfTxt(o){return !o?'—':o.pf==null?'∞':o.pf.toFixed(2);}
/* ---------- BENZERİ KAHİN: geçmiş analog anlar → ileri 12 mum getiri konisi ---------- */
var ANH=12;
/* ayarlar (radar_settings_v1; yalnız radar_* anahtarı) */
var CFG={N:50,rho:0.8,al:0.45,nmin:15,perf:'auto'};
(function(){try{var v=JSON.parse(localStorage.getItem('radar_settings_v1')||'null');if(v&&typeof v==='object')for(var k in CFG)if(k in v)CFG[k]=v[k];}catch(e){}})();
function featCoin(c,B){var k=c.k4,n=k.c.length,F={st:new Array(n),r:new Array(n),fl:c.T.fl,lrv:new Array(n),s:new Array(n)};
  for(var i=0;i<n;i++){if(i<60){F.st[i]=null;continue;}var j=idxAt(c.k1.t,k.t[i]+H4,H1),P=proxCoin(c,i,j);F.st[i]=P.st;F.r[i]=P.r;F.lrv[i]=Math.log(Math.max(0.05,j>=0?c.rv1[j]:1));F.s[i]=stressOf(B.mr[k.t[i]],B.br[k.t[i]]);}c.F=F;}
function featBist(c,B){var k=c.k1,n=k.c.length,F={st:new Array(n),r:new Array(n),z:c.Z,fl:c.flowSer,lrv:new Array(n),s:new Array(n)};
  for(var i=0;i<n;i++){if(i<210){F.st[i]=null;continue;}var P=proxBist(c,i);F.st[i]=P.st;F.r[i]=P.r;F.lrv[i]=Math.log(Math.max(0.05,c.rv1[i]));F.s[i]=B?stressOf(B.mr[k.t[i]],B.br[k.t[i]]):0;}c.F=F;}
function qnt(a,p){if(!a.length)return NaN;var x=(a.length-1)*p,lo=Math.floor(x),hi=Math.ceil(x);return a[lo]+(a[hi]-a[lo])*(x-lo);}
var STN={far:'uzak',vfw:'YO6 VF bekliyor',yo6f:'YO6 MA ateşledi',lxz:'Loxx bölgede',lxf:'Loxx ateşledi',sw:'süpürme (filtresiz)',bf:'z−2 kesti',bz:'z<−2',bn:'z −2 yakınında'};
function analog(c0,i0,Tc,opt){opt=opt||{};var bist=opt.bist!=null?opt.bist:ST.mode==='bist',tf=bist?H1:H4,F0=c0.F,LIST=opt.list||cur(),NMIN=opt.nmin||CFG.nmin;if(!F0||F0.st[i0]==null)return null;
  var st=F0.st[i0],r0=F0.r[i0],a0=bist?F0.z[i0]:F0.fl[i0],l0=F0.lrv[i0],s0=F0.s[i0],cand=[],tot=0;
  LIST.forEach(function(c){var F=c.F,k=bist?c.k1:c.k4;if(!F)return;for(var q=bist?210:60;q+ANH<k.c.length;q++){if(k.t[q+ANH]+tf>Tc)break;if(F.st[q]!==st)continue;tot++;
    var a=bist?F.z[q]:F.fl[q];if(!isFinite(a)||!isFinite(a0))continue;var d=Math.abs(F.r[q]-r0)/0.12+Math.abs(a-a0)/(bist?0.4:0.8)+Math.abs(F.lrv[q]-l0)/0.6+Math.abs(F.s[q]-s0)/0.4;if(d<=3)cand.push({c:c,k:k,q:q,d:d});}});
  cand.sort(function(x,y){return x.d-y.d;});var pick=[],used={};
  for(var u=0;u<cand.length&&pick.length<60;u++){var x=cand[u],key=x.c.sym,arr=used[key]=used[key]||[],ok=true;for(var w=0;w<arr.length;w++)if(Math.abs(arr[w]-x.q)<6){ok=false;break;}if(ok){arr.push(x.q);pick.push(x);}}
  var P=pick.map(function(x){var o=[];for(var h=0;h<=ANH;h++)o.push(x.k.c[x.q+h]/x.k.c[x.q]-1);return o;});
  var Q=[];for(var h=0;h<=ANH;h++){var col=P.map(function(p){return p[h];}).sort(function(a,b){return a-b;});Q.push([qnt(col,0.1),qnt(col,0.25),qnt(col,0.5),qnt(col,0.75),qnt(col,0.9)]);}
  var end=P.map(function(p){return p[ANH];}),win=end.length?end.filter(function(v){return v>0;}).length/end.length:NaN,mean=end.length?end.reduce(function(a,b){return a+b;},0)/end.length:NaN;
  return {st:st,n:P.length,pool:tot,ok:P.length>=NMIN,nmin:NMIN,q:Q,win:win,mean:mean,med:Q[ANH][2],tf:bist?'1s':'4s',picks:pick.slice(0,8).map(function(x){return {s:x.c.b,t:x.k.t[x.q]+tf,r:x.k.c[x.q+ANH]/x.k.c[x.q]-1,d:x.d};})};}
function stLeg(st){return st==='vfw'||st==='yo6f'||st==='sw'?'yo6':st==='lxz'||st==='lxf'?'loxx':ST.mode==='bist'?'bist':null;}
/* ---------- KORELASYON TAKIMYILDIZI: son 7 gün getirilerinin Pearson korelasyonu (coin 4s×42, BIST 1s×63) ---------- */
function corrList(list,bist,Tc){var tf=bist?H1:H4,W=bist?63:42,R=[],cnt={};
  list.forEach(function(c){var k=bist?c.k1:c.k4,i=Tc==null?k.c.length-1:idxAt(k.t,Tc,tf);if(i<W+1){R.push(null);return;}var a=[],m=0;for(var q=i-W+1;q<=i;q++){var v=Math.log(k.c[q]/k.c[q-1]);a.push(v);m+=v;}m/=W;var sd=0;a.forEach(function(v){sd+=(v-m)*(v-m);});sd=Math.sqrt(sd);
    R.push({t:k.t[i],a:a,m:m,sd:sd});cnt[k.t[i]]=(cnt[k.t[i]]||0)+1;});
  var tm=null,best=0;for(var t in cnt)if(cnt[t]>best){best=cnt[t];tm=+t;}
  var E=[],par=list.map(function(_,k){return k;});function fd(x){while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;}
  for(var x=0;x<R.length;x++){var A=R[x];if(!A||A.t!==tm||!(A.sd>0))continue;for(var y=x+1;y<R.length;y++){var B=R[y];if(!B||B.t!==tm||!(B.sd>0))continue;var s=0;for(var q=0;q<W;q++)s+=(A.a[q]-A.m)*(B.a[q]-B.m);var rho=s/(A.sd*B.sd);if(rho>CFG.rho){E.push([x,y,rho]);par[fd(x)]=fd(y);}}}
  E.sort(function(p,q){return q[2]-p[2];});var cl={},sz={};list.forEach(function(_,k){var r=fd(k);sz[r]=(sz[r]||0)+1;});var cid={},nc=0,big=0;list.forEach(function(_,k){var r=fd(k);if(sz[r]>1){if(cid[r]==null)cid[r]=++nc;cl[k]=cid[r];big=Math.max(big,sz[r]);}});
  var M={};E.forEach(function(e){(M[e[0]]=M[e[0]]||{})[e[1]]=e[2];(M[e[1]]=M[e[1]]||{})[e[0]]=e[2];});
  var ok=R.filter(function(x){return x&&x.t===tm;}).length,deg={},S=[];E.forEach(function(e){var a=deg[e[0]]=(deg[e[0]]||0),b=deg[e[1]]=(deg[e[1]]||0);if(a<3||b<3){S.push(e);deg[e[0]]++;deg[e[1]]++;}});
  return {S:S,E:E,cl:cl,nc:nc,big:big,M:M,W:W,tf:bist?'1s':'4s',T:tm,n:ok,pairs:ok*(ok-1)/2};}
/* iki enstrüman arası 7g getiri korelasyonu (doğrulama ve plan için) */
function rhoPair(ka,kb,Tc,tf,W){var ia=idxAt(ka.t,Tc,tf),ib=idxAt(kb.t,Tc,tf);if(ia<W+1||ib<W+1||ka.t[ia]!==kb.t[ib])return NaN;var a=[],b=[],ma=0,mb=0;for(var q=0;q<W;q++){var x=Math.log(ka.c[ia-q]/ka.c[ia-q-1]),y=Math.log(kb.c[ib-q]/kb.c[ib-q-1]);a.push(x);b.push(y);ma+=x;mb+=y;}ma/=W;mb/=W;var s=0,sa=0,sb=0;for(q=0;q<W;q++){s+=(a[q]-ma)*(b[q]-mb);sa+=(a[q]-ma)*(a[q]-ma);sb+=(b[q]-mb)*(b[q]-mb);}return sa>0&&sb>0?s/Math.sqrt(sa*sb):NaN;}
function corrAt(Tc){return corrList(LAY.dots.map(function(d){return d.c;}),ST.mode==='bist',Tc);}
function rho(k1,k2){var C=FR&&FR.corr;return C&&C.M[k1]&&C.M[k1][k2]||null;}
/* bir listede ρ>0.8 olan çiftler → "aynı kümeden iki sinyal" */
function twins(ks){var out={};for(var a=0;a<ks.length;a++)for(var b=0;b<ks.length;b++){if(a===b)continue;var r=rho(ks[a],ks[b]);if(r&&(!out[ks[a]]||out[ks[a]].r<r))out[ks[a]]={k:ks[b],r:r};}return out;}
function kOfSym(sym){var d=LAY.dots.filter(function(d){return d.c.sym===sym;})[0];return d?d.c._k:null;}
/* ================= v5 · SİNYAL KALİTE PUANI (0-100) — ağırlıklar önceden sabit, veriye uydurulmadı ================= */
var W5={reg:30,cone:25,tf:15,div:15,flow:15},W5N={reg:'rejim güveni',cone:'kâhin konisi',tf:'1s/4s hizası',div:'çeşitlendirme',flow:'RVOL / OBV akışı'};
function letter(s){return s>=70?'A':s>=55?'B':s>=40?'C':'D';}
function legOfState(st,r1,r4,bist){if(bist)return 'bist';var l=stLeg(st);if(l&&l!=='bist')return l;return (r1!=null&&r4!=null&&r1<r4)?'loxx':'yo6';}
/* x: {leg, regO (lab: o bacak + rejim istatistiği), an (analog), r1, r4, bist, partner, up, rv} */
function qscore(x){var o=x.regO,pf=o?(o.pf==null?3:o.pf):NaN;
  var reg=!o||o.n<5?0.3:clamp((pf-0.8)/1.7,0,1)*(0.5+0.5*Math.min(1,o.n/30));
  var A=x.an,cone=!A||!A.ok?0.35:0.5*clamp((A.win-0.40)/0.25,0,1)+0.5*clamp((A.med+0.01)/0.04,0,1);
  var tf=x.bist?0.5:(x.r1<CFG.al&&x.r4<CFG.al)?1:(Math.min(x.r1,x.r4)<CFG.al?0.55:0.2);
  var div=x.partner?0:1,flow=0.6*(x.up?1:0)+0.4*clamp(((isFinite(x.rv)?x.rv:1)-0.7)/1.3,0,1);
  var P={reg:reg,cone:cone,tf:tf,div:div,flow:flow},s=0;for(var k in W5)s+=W5[k]*P[k];s=Math.round(s);return {s:s,L:letter(s),P:P,leg:x.leg};}
/* geri test için: bacak+rejim istatistiği, yalnız Tc'den önce KAPANMIŞ lab işlemlerinden (ileriye bakmadan) */
function regStatsBefore(rows,Tc){var o={};rows.forEach(function(r){if(r.closeT>Tc||!r.reg)return;var x=o[r.reg]=o[r.reg]||{n:0,w:0,gp:0,gl:0};x.n++;if(r.ret>0){x.w++;x.gp+=r.ret;}else x.gl-=r.ret;});
  for(var k in o){var x=o[k];x.pf=x.gl>0?x.gp/x.gl:null;x.win=100*x.w/x.n;}return o;}
var LABRET={"yo6":[0.063846,0.074396,0.073893,0.032209,0.041797,0.047708,0.051476,0.077122,0.00825,0.027855,-0.005045,-0.029199,-0.04921,-0.032168,-0.01691,-0.03416,-0.062172,-0.030586,-0.029241,-0.117642,-0.057204,-0.039265,0.061063,0.005557,0.010239,-0.012603,0.036735,0.00864,-0.014287,0.034979,-0.003361,0.012994,0.010435,0.000694,-0.0008,-0.014879,-0.003293,0.002963,-0.042566,0.130437,0.049665,0.077611,0.102312,0.036591,0.050522,0.07176,0.303255,0.03278,0.142,0.072175,0.079041,-0.04202,0.089047,0.104446,0.03217,0.051357,0.054454,0.048585,0.048333,0.024749,0.021348,0.015506,0.047073,0.054723,0.043393,0.027483,0.009712,0.038826,-0.016218,0.038242,0.035133,0.04651,0.03473,0.023142,0.059417,0.037458,0.026609,-0.010205,-0.003611,0.043732,0.012073,-0.002886,0.019588,-0.003238,-0.003753,0.020032,0.011634,0.023289,0.042141,0.013146,0.021421,0.008735,0.007475,-0.023291,-0.002994,-0.049389,-0.017428,-0.039758,-0.005283,-0.02287,0.058381,-0.129504,-0.144828,0.065011,0.012891,0.081181,0.035475,-0.037304,0.053295,0.046183,0.03992,0.01907,0.053241,-0.043971,0.007586,0.033685,0.031936,0.064068,0.012952,0.029566,-0.013388,0.017679,0.046001,0.017909,-0.021498,0.000246,-0.001283,0.007574,0.123759,0.002269,-0.026824,0.01069,0.025764,0.036392,-0.020265,0.082656,-0.044551,-0.012317,0.062727,0.01944,0.02874,0.067677,0.081657,0.019576,-0.071575,0.006286,0.009862,0.049282,0.028975,-0.066054,-0.001233,-0.017859,-0.010558,0.027444,0.020085,-0.042029,-0.019925,0.004428,0.017185,-0.011655,-0.028096,0.010095,-0.002485,-0.031386,0.036525,-0.019139,-0.002873,-0.022129,0.016663,-0.003291,0.023501,0.177219,0.170607,0.212095,0.174333,-0.059483,0.065574,0.103136,0.130512,0.070283,0.001728,0.003598,-0.008565,-0.011394,0.031876,0.103653,0.055855,0.019004,0.015837,0.021698,0.017524,0.053821,-0.004364,0.014194,-0.02047,-0.06643,-0.038494,-0.045015,-0.028135,-0.023896,-0.042989,0.011353,-0.029849],"loxx":[0.345793,-0.083519,-0.068477,0.463839,0.494335,0.171291,0.217232,0.169355,0.683471,0.092246,-0.037394,-0.10758,0.110229,0.06761,-0.040062,0.139493,-0.086188,0.340864,-0.2507,-0.2507,0.133855,0.446211,0.05302,0.271599,0.574883,0.161945,0.493837,-0.2507,0.244002,0.333627,-0.089773,-0.2507,0.076801,-0.134353,0.462129,-0.089434,0.6754,0.003507,-0.156466,0.344558,-0.10402,0.2876,-0.2507,-0.2507,-0.2507,0.320444,-0.2507,0.11747],"bist":[0.04918,0.04918,0.04918,-0.003782,0.04918,0.04918,0.04918,0.04918,-0.141686,-0.163123,0.04918,0.04918,0.04918,-0.0855,0.04918,0.04918,0.04918,0.04918,-0.044697,-0.079879,0.04918,0.04918,0.04918,-0.120506,0.04918,-0.077692,0.04918,0.04918,0.04918,-0.212273,0.04918,0.04918,-0.001521,-0.080346,0.04918,0.04918,0.04918,0.04918,0.04918,0.04918,0.04918,-0.003475,0.04918,0.04918,-0.2507,-0.110405,-0.057191,0.04918,0.04918,0.04918,-0.004218,0.04918,0.04918,0.04918,0.04918,-0.2507,0.04918,0.04918,0.04918,0.04918,-0.2507,0.04918,-0.114858,0.04918,0.04918,0.04918,0.04918,0.00548,0.04918,0.04918,0.04918,-0.167726,0.04918,0.04918,-0.036399,0.04918,0.04918,0.04918,0.04918,0.04918,0.04918,0.04918,-0.004106,0.04918,0.04918,-0.078864,0.04918,-0.082982,0.04918,0.04918,0.04918,0.04918,0.04918,-0.026114,0.04918,0.04918,0.04918,0.04918,0.04918,0.001168,0.04918,-0.021014,0.04918,0.04918,0.04918]};
var SCOREVAL={"t\u00fcm\u00fc":{"rho":-0.2127,"b":{"A":{"n":50,"win":70,"avg":1.0113,"usd":10.1126,"sc":77.34},"B":{"n":102,"win":64.7059,"avg":-0.3099,"usd":-6.3224,"sc":62.2941},"C":{"n":105,"win":62.8571,"avg":2.9208,"usd":61.3362,"sc":46.7238},"D":{"n":99,"win":73.7374,"avg":7.4384,"usd":147.2803,"sc":30.7172}},"hi":{"n":178,"win":66.8539,"avg":0.5025,"usd":17.8891,"sc":65.0506},"lo":{"n":178,"win":67.9775,"avg":5.464,"usd":194.5175,"sc":37.0169},"md":51},"yo6":{"rho":-0.1449,"b":{"A":{"n":34,"win":70.5882,"avg":1.5379,"usd":10.4578,"sc":78.0588},"B":{"n":71,"win":69.0141,"avg":1.2501,"usd":17.7513,"sc":62.6901},"C":{"n":50,"win":46,"avg":1.4648,"usd":14.6481,"sc":45.72},"D":{"n":48,"win":75,"avg":3.8763,"usd":37.2129,"sc":30.2917}},"hi":{"n":104,"win":69.2308,"avg":1.3157,"usd":27.3662,"sc":67.7885},"lo":{"n":99,"win":60.6061,"avg":2.6618,"usd":52.7038,"sc":38.3333},"md":56},"loxx":{"rho":-0.3031,"b":{"A":{"n":1,"win":100,"avg":0.3507,"usd":0.0701,"sc":82},"B":{"n":4,"win":0,"avg":-17.2235,"usd":-13.7788,"sc":57.5},"C":{"n":14,"win":50,"avg":6.7994,"usd":19.0383,"sc":46.6429},"D":{"n":29,"win":72.4138,"avg":17.3355,"usd":100.546,"sc":30.5517}},"hi":{"n":26,"win":46.1538,"avg":3.8605,"usd":20.0746,"sc":46.9231},"lo":{"n":22,"win":77.2727,"avg":19.5002,"usd":85.801,"sc":28.6818},"md":36},"bist":{"rho":-0.0866,"b":{"A":{"n":15,"win":66.6667,"avg":-0.1384,"usd":-0.4153,"sc":75.4},"B":{"n":27,"win":62.963,"avg":-1.9065,"usd":-10.2949,"sc":61.963},"C":{"n":41,"win":87.8049,"avg":3.3719,"usd":27.6498,"sc":47.9756},"D":{"n":22,"win":72.7273,"avg":2.164,"usd":9.5214,"sc":31.8636}},"hi":{"n":57,"win":70.1754,"avg":-0.0273,"usd":-0.311,"sc":62.9298},"lo":{"n":48,"win":81.25,"avg":2.7888,"usd":26.772,"sc":39.2708},"md":51}};
var CONTRA={"res":{"K1":{"early":{"n":72,"pf":3.8166,"win":0.7639,"avg":0.0411,"usd":59.2498,"bpf":2.0051,"bn":167,"r50":2.0174,"r90":2.9436,"pct":0.9786,"pass":true},"late":{"n":27,"pf":6.1723,"win":0.6667,"avg":0.163,"usd":88.0304,"bpf":2.7144,"bn":189,"r50":2.738,"r90":6.8875,"pct":0.876,"pass":false},"promote":false},"K2":{"early":{"n":131,"pf":1.8791,"win":0.6336,"avg":0.019,"usd":49.7338,"bpf":2.0051,"bn":167,"r50":1.9997,"r90":2.3851,"pct":0.3094,"pass":false},"late":{"n":95,"pf":3.7979,"win":0.6737,"avg":0.0734,"usd":139.4822,"bpf":2.7144,"bn":189,"r50":2.7015,"r90":3.7866,"pct":0.902,"pass":true},"promote":false},"K3":{"early":{"n":148,"pf":1.9743,"win":0.6689,"avg":0.0195,"usd":57.8535,"bpf":2.0051,"bn":167,"r50":1.9932,"r90":2.2565,"pct":0.452,"pass":false},"late":{"n":106,"pf":3.3749,"win":0.717,"avg":0.0658,"usd":139.5653,"bpf":2.7144,"bn":189,"r50":2.7356,"r90":3.6499,"pct":0.8266,"pass":false},"promote":false}},"pre":{"kayit":"2026-10-18 20:40 TSİ, sonuçlar hesaplanmadan önce","kapsam":"356 lab işlemi (YO6 203, Loxx 48, BIST 105), çıkış kuralları değişmeden; v5 puan bileşenleri ileriye bakmadan","bolme":"erken: sinyal kapanışı < 2026-06-01T00:00Z (Oca–May) · geç: ≥ (Haz–Eki)","kurallar":{"K1":"Ters puan: yalnız D kovası (puan < 40)","K2":"Stres / düşük güven: rejim STRES veya rejim-güveni alt puanı < 0.5","K3":"Ters koni: kâhin konisi alt puanı ≤ 0.5 (koni kötü ya da yetersiz)"},"taban":"aynı yarıdaki tüm işlemler","rastgele":"aynı yarıdan aynı n'li 5000 rastgele alt küme (tohum 6), PF dağılımı","terfi":"geç yarıda n ≥ 30 VE PF_kural > PF_taban VE PF_kural > rastgele p90; ayrıca erken yarıda PF_kural > PF_taban","test_sayisi":3,"not":"Kontraryan fikir v5'in TÜM örnek (erken+geç) bulgusundan geldi → geç yarı tam temiz değil; bu yüzden eşik p90 ve n≥30."}};
var LAB6={"HR":{"yo6":[[0,0,0],[0,0,0],[0,0,0],[27,21,0.9967],[0,0,0],[0,0,0],[0,0,0],[59,38,1.4138],[0,0,0],[0,0,0],[0,0,0],[22,15,0.2828],[0,0,0],[0,0,0],[0,0,0],[33,29,1.0519],[0,0,0],[0,0,0],[0,0,0],[42,22,0.4785],[0,0,0],[0,0,0],[0,0,0],[20,7,-0.2202]],"loxx":[[2,2,0.7975],[2,2,0.4495],[1,0,-0.0862],[2,1,0.0951],[1,0,-0.1076],[1,0,-0.0898],[1,0,-0.2507],[1,0,-0.1565],[1,0,-0.2507],[0,0,0],[2,2,0.3095],[5,3,0.9879],[1,1,0.1339],[2,0,-0.3851],[1,1,0.4938],[4,2,0.0292],[1,1,0.1175],[0,0,0],[2,2,0.6016],[0,0,0],[4,3,0.5184],[3,2,0.8757],[9,6,1.4083],[2,1,-0.1977]],"bist":[[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[27,22,0.4575],[14,10,0.2093],[15,10,-0.0569],[15,9,0.2249],[5,4,-0.054],[10,8,0.0886],[8,8,0.3934],[5,2,-0.235],[6,6,0.2951],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]]},"worst":{"btc":{"v":-0.1404,"t":1770321600000},"btcUp":{"v":0.1221,"t":1770408000000},"basket":{"v":-0.155,"t":1770321600000,"n":37},"from":1763812800000,"to":1792296000000,"n":37}};
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
  var P=proxCoin(c,i,j),fl=c.T.fl;return {i:i,j:j,r:P.r,r1:P.r1,r4:P.r4,st:P.st,why:P.why,miss:P.miss,setup:P.setup,ch:T==null?c.ch:(k.c[i]/k.c[Math.max(0,i-6)]-1)*100,up:isFinite(fl[i])&&isFinite(fl[i-1])?fl[i]>fl[i-1]:null,fl:fl[i],rv:c.rv1[j],tor:fl.slice(i-47,i+1)};}
function atBist(c,T){var k=c.k1,i=T==null?k.c.length-1:idxAt(k.t,T,H1);if(i<210)return null;var P=proxBist(c,i),fl=c.flowSer;
  return {i:i,j:i,r:P.r,st:P.st,why:P.why,miss:P.miss,setup:P.setup,z:c.Z[i],ch:T==null?c.ch:(k.c[i]/k.c[Math.max(0,i-8)]-1)*100,up:isFinite(fl[i])&&isFinite(fl[i-1])?fl[i]>fl[i-1]:null,fl:fl[i],rv:c.rv1[i],tor:fl.slice(i-47,i+1)};}
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
  var ck=ST.mode+'|'+(T==null?'L'+ST.lastAt:T)+'|'+LAY.dots.length;if(G.corrKey!==ck){G.corrKey=ck;G.corr=corrAt(T);}
  var al=0;c.forEach(function(f){f.al=f.r1!=null&&f.r1<CFG.al&&f.r4<CFG.al;if(f.al)al++;});
  FR={T:T,Tc:Tc,c:c,tor:tor,neb:neb,fire:fire,near:near,comets:comets,list:list,corr:G.corr,al:al,reg:{c:regAt(ST.cReg,Tc),b:regAt(ST.bReg,Tc)},opt:VIEW};return FR;}
function pushFrame(){if(!LAY.dots.length)return;buildFrame();if(G.mode==='3d'&&G.api)G.api.setFrame(FR);renderTop5();renderScore();renderCounts();renderPulse();renderRegime();renderBrief();if(FOC.k!=null)renderFocus();}
/* ---------- HERO ---------- */
var G={api:null,mode:'?',want:'auto',reason:''};
function webglOK(){try{var c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}catch(e){return false;}}
function lowPower(){var n=navigator,c=n.connection||{};return !!(c.saveData||(n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2));}
async function heroInit(){var host=$('hero3d'),use3d=G.want==='3d'||(G.want==='auto'&&webglOK()&&!lowPower());
  if(G.api&&G.mode==='3d'&&use3d){heroData();return;}if(G.api&&!use3d){G.api.dispose();G.api=null;}
  if(use3d){try{status2('3D motor yükleniyor (three.js)…');var M=await import('/radar3d.js?v=6');
      G.api=M.create(host,{lite:innerWidth<700,capture:CLK.cap,clock:function(){return CLK.now();},onHover:hoverTip,onPick:function(k){focusOn(k);},drawHolo:function(g,w,h,k){drawMini(g,w,h,k,true);}});
      G.mode='3d';$('hero2d').style.display='none';window.RD3=G.api;if(G.api.setOpts)G.api.setOpts(VIEW);heroData();return;}catch(e){console.warn('3D yüklenemedi, 2D radar',e);G.reason='WebGL/three.js yüklenemedi';}}
  else G.reason=webglOK()?'düşük güç':'WebGL yok';G.mode='2d';$('hero2d').style.display='block';R2.start();heroData();}
function heroData(){if(!cur().length)return;var fresh=LAY.mode!==ST.mode||LAY.dots.length!==Math.min(80,cur().length);layout();
  if(G.mode==='3d'&&G.api&&(fresh||G.api.state.n!==LAY.dots.length||G.dataGen!==ST.lastAt)){G.api.setData(LAY.dots,{sectors:LAY.secs,histLen:48,assemble:fresh&&!INTRO.on});G.dataGen=ST.lastAt;}pushFrame();
  $('hMode').textContent=(G.mode==='3d'?'3D · WebGL':'2D radar'+(G.reason?' ('+G.reason+')':''))+' · '+(ST.mode==='bist'?'BIST 30 · 1s · yarıçap = z200’ün −2’ye uzaklığı':'Coin vadeli · yarıçap = YO6 MA / Loxx kurulumuna uzaklık');}
function renderCounts(){if(!FR)return;var hc=$('hCorr');if(hc)hc.innerHTML=FR.corr?'✦ <b>'+FR.corr.E.length+'</b> çift ρ&gt;'+CFG.rho+' / '+FR.corr.pairs+' · en büyük küme '+FR.corr.big+' · çizilen '+FR.corr.S.length+(FR.al?' · <span class="y">◎ '+FR.al+' hizalı</span>':''):'';num($('hFire'),FR.fire,Math.round);num($('hNear'),FR.near,Math.round);num($('hTot'),FR.list.length,Math.round);}
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
  var ph=(ts%1600)/1600;LAY.dots.forEach(function(d,k){var f=FR.c[k];var rr=R*(0.04+0.96*clamp(f.r,0,1));d.x=cx+Math.cos(d.a)*rr;d.y=cy+Math.sin(d.a)*rr;});
  if(VIEW.corr&&FR.corr)(FOC.k!=null?FR.corr.E:FR.corr.S).forEach(function(e){var A=LAY.dots[e[0]],B=LAY.dots[e[1]];if(!A||!B)return;var foc=FOC.k!=null&&(e[0]===FOC.k||e[1]===FOC.k);g.strokeStyle='rgba(192,132,252,'+(FOC.k!=null&&!foc?0.06:0.15+0.6*(e[2]-0.8)/0.2)+')';g.beginPath();g.moveTo(A.x,A.y);g.lineTo(B.x,B.y);g.stroke();});
  if(VIEW.tf&&ST.mode==='coin')LAY.dots.forEach(function(d,k){var f=FR.c[k];if(f.r1==null)return;var x1=cx+Math.cos(d.a)*R*(0.04+0.96*clamp(f.r1,0,1)),y1=cy+Math.sin(d.a)*R*(0.04+0.96*clamp(f.r1,0,1)),x4=cx+Math.cos(d.a)*R*(0.04+0.96*clamp(f.r4,0,1)),y4=cy+Math.sin(d.a)*R*(0.04+0.96*clamp(f.r4,0,1));
    g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(x1,y1);g.lineTo(x4,y4);g.stroke();g.fillStyle='#7dd3fc';g.beginPath();g.arc(x1,y1,2.2,0,7);g.fill();g.fillStyle='#c084fc';g.beginPath();g.arc(x4,y4,2.2,0,7);g.fill();if(f.al){g.strokeStyle='rgba(255,200,0,'+(0.9-0.5*ph)+')';g.beginPath();g.arc(d.x,d.y,12+4*ph,0,7);g.stroke();}});
  LAY.dots.forEach(function(d,k){var f=FR.c[k];d.sz=3+6*Math.sqrt(clamp(f.rv||1,0.2,6)/6);
    var since=((R2.ang-((d.a%(2*Math.PI))+2*Math.PI)%(2*Math.PI))+4*Math.PI)%(2*Math.PI),gl=Math.exp(-since/1.2),col=f.up==null?'160,160,160':f.up?'0,255,170':'255,46,110';
    g.shadowColor='rgba('+col+',1)';g.shadowBlur=4+18*gl;g.fillStyle='rgba('+col+','+(0.45+0.55*gl)+')';g.beginPath();g.arc(d.x,d.y,d.sz,0,2*Math.PI);g.fill();g.shadowBlur=0;
    if(f.r<0.05){g.strokeStyle='rgba(255,230,0,'+(0.9-0.6*ph)+')';g.lineWidth=2;g.beginPath();g.arc(d.x,d.y,d.sz+3+5*ph,0,2*Math.PI);g.stroke();g.lineWidth=1;}
    var pn=FR.pin&&FR.pin.indexOf(k)>=0;if(pn){g.strokeStyle='rgba(255,226,122,.95)';g.setLineDash([4,3]);g.lineWidth=1.5;g.beginPath();g.arc(d.x,d.y,d.sz+7,R2.ang*2,R2.ang*2+2*Math.PI);g.stroke();g.setLineDash([]);g.lineWidth=1;}
    if(f.r<0.5||d.top||FOC.k===k||pn){g.fillStyle=FOC.k===k?'#ffe600':pn?'#ffe27a':'#e6fff6';g.font='10px ui-monospace,monospace';g.fillText((pn?'★ ':'')+d.c.b,d.x+d.sz+3,d.y+3);}});}};
/* ---------- odak modu ---------- */
var FOC={k:null};
function focusOn(k){if(k==null||!LAY.dots[k])return;FOC.k=k;var fe=$('focus');if(innerWidth>1100){if(fe.parentNode.tagName!=='MAIN')document.querySelector('main').appendChild(fe);fe.classList.add('side');}else{if(fe.parentNode!==$('hero'))$('hero').appendChild(fe);fe.classList.remove('side');}if(G.mode==='3d'&&G.api)G.api.focus(k);$('focus').classList.add('on');$('hero').classList.add('foc');renderFocus();sfx('focus');}
function unfocus(){if(FOC.k==null)return;FOC.k=null;if(G.api)G.api.unfocus();$('focus').classList.remove('on');$('hero').classList.remove('foc');}
function renderFocus(){var k=FOC.k,d=LAY.dots[k];if(!d||!FR)return;var f=FR.c[k]||{},c=d.c,Tc=FR.Tc;
  var tr=(c.trades||[]).filter(function(t){return t.fireT<=Tc;}).slice(-4).reverse().map(function(t){var s=tradeAt(t,Tc);return '<div class="ftr"><i style="background:'+LEGC[t.leg]+'"></i>'+LEGN[t.leg]+' · '+fmtT(t.fireT)+' <b class="'+(s.ret>=0?'g':'r')+'">'+(s.closed?'':'açık ')+pct(s.ret,2)+' ('+usd(s.usd)+')</b></div>';}).join('')||'<div class="mut">bu pencerede işlem yok</div>';
  $('fBody').innerHTML='<div class="fh"><b>'+esc(c.b)+'</b><span>'+esc(c.sec)+' · '+(ST.mode==='bist'?'1s':'4s')+'</span></div><div class="y">'+esc(f.why||'')+'</div><div class="c">eksik: '+esc(f.miss||'—')+'</div>'+
   '<div class="kv"><span>yakınlık</span><b>'+(1-(f.r||1)).toFixed(2)+'</b></div><div class="kv"><span>24s</span><b class="'+(f.ch>=0?'g':'r')+'">'+(isFinite(f.ch)?(f.ch>=0?'+':'')+f.ch.toFixed(2)+'%':'—')+'</b></div><div class="kv"><span>RVOL · OBV akışı</span><b>'+(isFinite(f.rv)?f.rv.toFixed(2):'—')+'× · '+(f.up==null?'—':f.up?'<span class="g">▲</span>':'<span class="r">▼</span>')+'</b></div>'+
   focusIntel(k,f,c,Tc)+'<div class="lbl">işlemler <span class="live">CANLI</span> (lab çıkış kuralı, imleç anına kadar)</div>'+tr;
  if(G.mode!=='3d'||innerWidth<700||innerWidth>1100){$('fMini').style.display='block';var X=hidpi($('fMini'));drawMini(X.g,X.w,X.h,k,false);}else $('fMini').style.display='none';
  $('fOpen').onclick=function(){window.open(chartUrl(c),'_blank');};if(G.api&&G.mode==='3d')G.api.redrawHolo();}
/* mini mum grafiği (holografik / 2D): son 48 mum, SMA10, OBV akışı, sinyal ve işlem işaretleri */
function drawMini(g,W,H,k,holo){var d=LAY.dots[k];if(!d)return;var c=d.c,f=FR&&FR.c[k],k4=ST.mode==='bist'?c.k1:c.k4,tf=ST.mode==='bist'?H1:H4,i=f&&f.i!=null?f.i:k4.c.length-1,a=Math.max(0,i-47),n=i-a+1;
  if(!c.ma10)c.ma10=ST.mode==='bist'?rSma(c.k1.c,10):c.T.ma;var ma=c.ma10,fl=c.flowSer;
  g.clearRect(0,0,W,H);if(!holo){g.fillStyle='rgba(2,8,12,.6)';g.fillRect(0,0,W,H);}
  var AN=FOC.k===k?FOC.an:null,coneW=AN?(W-2*(holo?22:8))*0.27:0;
  var pad=holo?22:8,top=holo?52:20,ph=(H-top-pad)*0.68,fh=(H-top-pad)*0.24,fy=top+ph+(H-top-pad)*0.08,bw=(W-2*pad-coneW)/n,mn=Infinity,mx=-Infinity;
  for(var q=a;q<=i;q++){mn=Math.min(mn,k4.l[q]);mx=Math.max(mx,k4.h[q]);if(isFinite(ma[q])){mn=Math.min(mn,ma[q]);mx=Math.max(mx,ma[q]);}}
  if(AN&&AN.ok){var c0=k4.c[i];AN.q.forEach(function(r){mn=Math.min(mn,c0*(1+r[0]));mx=Math.max(mx,c0*(1+r[4]));});}var Y=function(v){return top+ph-(ph)*(v-mn)/Math.max(1e-12,mx-mn);};
  var C1=holo?'rgba(0,255,200,':'rgba(0,255,170,',C2=holo?'rgba(255,60,160,':'rgba(255,46,110,',fs=holo?20:10;
  if(holo){g.strokeStyle='rgba(0,255,220,.55)';g.lineWidth=2;g.strokeRect(4,4,W-8,H-8);g.fillStyle='rgba(0,40,50,.35)';g.fillRect(4,4,W-8,H-8);
    g.fillStyle='rgba(180,255,245,.95)';g.font='bold '+(fs+4)+'px ui-monospace,monospace';g.fillText(c.b+' · '+(ST.mode==='bist'?'1s':'4s')+' · son 48 mum',pad,34);g.font=fs*0.8+'px ui-monospace,monospace';g.fillStyle='rgba(125,211,252,.9)';g.textAlign='right';g.fillText(AN?'SMA10 · OBV · ▶ BENZERİ KAHİN konisi':'SMA10 · OBV akışı · sinyal/işlem',W-pad,34);g.textAlign='left';}
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
  if(AN)drawCone(g,AN,pad+n*bw,coneW,Y,k4.c[i],top,ph,holo);
  if(holo){g.fillStyle='rgba(255,255,255,.035)';for(y=6;y<H-6;y+=4)g.fillRect(6,y,W-12,1);}}
/* ---------- En Yakın 5 ---------- */
function renderTop5(){if(!FR)return;var L=FR.list.slice().sort(function(a,b){return a.r-b.r;}).slice(0,5);
  var TW=twins(L.map(function(f){return f.k;}));
  $('top5').innerHTML=L.map(function(f,q){var p=Math.round(100*(1-f.r)),tw=TW[f.k];return '<button class="t5'+(f.r<0.05?' fire':'')+(f.al?' al':'')+'" data-k="'+f.k+'"><em>#'+(q+1)+'</em><b>'+esc(f.c.b)+'</b><small>'+esc(f.setup)+(f.al?' · ◎ 1s+4s':'')+'</small><span class="pb"><i style="width:'+p+'%"></i></span><span class="ms">'+esc(f.miss)+'</span>'+(tw?'<span class="tw">⚠ aynı küme: '+esc(LAY.dots[tw.k].c.b)+' ρ '+tw.r.toFixed(2)+' · çift risk</span>':'')+'</button>';}).join('');
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
function introWanted(){var m=/[?&]intro=([01])/.exec(location.search);if(m)return m[1]==='1';try{return !sessionStorage.getItem('qxr_intro6');}catch(e){return false;}}
function introStart(){INTRO.on=true;INTRO.t0=CLK.now();$('intro').classList.add('on');try{sessionStorage.setItem('qxr_intro6','1');}catch(e){}
  INTRO.lines=['› evren: Binance USDT-M ilk '+($('rdN').value||50)+' · BIST 30','› mumlar: 4s×500 · 1s×1500 · BIST 1s×700','› kuyruk ≤4 istek/sn · 429 → Retry-After','› lab kuralları: YO6 MA 12 mum · Loxx C(50/80) · BIST TP %5','› rejim · kâhin · takımyıldız katmanları hazırlanıyor','› sinyal galaksisi kuruluyor…'];}
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
  cs.forEach(function(c){c.lx.ev.forEach(function(e){if(now-e.t<=72*H1)l.push({s:c.b,sym:c.sym,d:'pst '+f0(c.lx.pst)+' · z '+f2(c.lx.z),t:e.t,u:chartUrlS('coin',c.sym)});});if(c.lx.ok&&c.lx.z>0&&c.lx.pst>=5&&c.lx.pst<30&&c.lx.pst<c.lx.pss)ln++;
    if(c.t41.enAge!=null&&c.t41.enAge<12)y.push({s:c.b,sym:c.sym,d:'AL · '+c.t41.enAge+' mum',t:c.t41.enT,u:chartUrlS('coin',c.sym)});if(c.t41.wait)w.push({s:c.b,sym:c.sym,d:'SMA10 '+f1(c.t41.maGap*100)+'% yukarıda',t:c.t41.vfT,u:chartUrlS('coin',c.sym)});});
  [b,l,y,w].forEach(function(a){a.sort(function(p,q){return q.t-p.t;});});
  var actK=[];[l,y,w].forEach(function(a){a.slice(0,3).forEach(function(x){x.k=kOfSym(x.sym);if(x.k!=null&&actK.indexOf(x.k)<0)actK.push(x.k);});});var PTW=ST.mode==='coin'?twins(actK):{};
  function light(on,near){return on?'<i class="lt on" title="aktif sinyal"></i>':near?'<i class="lt nr" title="yakın aday"></i>':'<i class="lt" title="boşta"></i>';}
  function rows(a,e){return a.length?a.slice(0,3).map(function(x){return '<a class="sig" href="'+x.u+'" target="_blank"><b>'+esc(x.s)+'</b><span>'+esc(x.d)+(x.k!=null&&PTW[x.k]?' <i class="tw" title="ρ '+PTW[x.k].r.toFixed(2)+' — aynı kümeden iki sinyal">⚠ '+esc(LAY.dots[PTW[x.k].k].c.b)+'</i>':'')+'</span><em>'+fmtAge(now-x.t)+'</em></a>';}).join(''):'<div class="mut sm0">'+e+'</div>';}
  function card(key,L,on,near,cnt,list,empty,id){var E=LABEQ[key];return '<div class="leg glass2"><div class="lh">'+light(on,near)+'<h4 style="color:'+LEGC[key]+'">'+L.nm+'</h4><small>'+L.tf+'</small></div><div class="bdg"><span>PF <b>'+L.pf+'</b></span><span>rastgele '+L.rnd+'</span><span>'+E.n+' işlem</span><span>%'+E.win+' kazanma</span><span>DD $'+E.dd+'</span></div><canvas class="eq" id="'+id+'"></canvas><div class="cnt">'+cnt+'</div>'+rows(list,empty)+'</div>';}
  $('rdPort').innerHTML=card('bist',LAB.bist,b.some(function(x){return now-x.t<=24*H1;}),bn>0,'72 sa: <b>'+b.length+'</b> sinyal · z<−2: <b>'+bn+'</b>',b,bs.length?'son 72 saatte sinyal yok':'BIST verisi yok','eqB')+
    card('loxx',LAB.loxx,l.some(function(x){return now-x.t<=3*H1;}),ln>0,'72 sa: <b>'+l.length+'</b> sinyal · kesişim bekleyen: <b>'+ln+'</b>',l,'son 72 saatte sinyal yok','eqL')+
    card('yo6',LAB.yo6,y.length>0,w.length>0,'aktif AL: <b>'+y.length+'</b> · SMA10 bekleyen: <b>'+w.length+'</b>',y.concat(w),'aktif AL yok','eqY')+'<div class="mut sm">Rozet + eğri: lab 2026-01-01→10-18 · $10 marj 2x · %0.04 komisyon. Işık: yeşil aktif · amber yakın · sönük boşta.</div>';
  eqSpark($('eqB'),LABEQ.bist);eqSpark($('eqL'),LABEQ.loxx);eqSpark($('eqY'),LABEQ.yo6);}
/* ---------- Sinyal nehri ---------- */
var RV={ev:[],hot:null};
function riverData(){var all=[];ST.coins.forEach(function(c){c.t41.ev.concat(c.lx.ev).forEach(function(e){all.push({s:c.b,sym:c.sym,e:e,u:chartUrlS('coin',c.sym),sym:c.sym});});});ST.bist.forEach(function(c){c.ev.forEach(function(e){all.push({s:c.b,sym:c.sym,e:e,u:chartUrlS('bist',c.sym),sym:c.sym});});});
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
    renderAll();ST.lastAt=Date.now();try{alarmCheck();}catch(e){console.warn('alarm',e);}status2('Güncellendi '+fmtT(ST.lastAt)+' · '+((Date.now()-t0)/1000).toFixed(0)+' sn · '+ST.req+' istek'+(ST.err.length?' · '+ST.err.length+' hata':''));$('tProg').style.width='100%';if(ST.err.length)console.warn('radar hatalar',ST.err);}
  catch(e){status2('Hata: '+(e.message||e));console.error(e);}ST.busy=false;$('rdBtn').disabled=false;$('tScan').classList.remove('on');window.QX_RADAR_READY=true;}
function setMode(m){if(ST.mode===m)return;unfocus();ST.replay=null;$('rp').classList.remove('on');$('score').classList.remove('mob');$('rpLog').innerHTML='';ST.mode=m;document.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-mode')===m);});if(cur().length)heroData();}
/* ---------- ana döngü ---------- */
var LT=null;function uiTick(){var n=CLK.now(),dt=LT==null?16:Math.min(200,n-LT);LT=n;introTick();rpTick(dt);}
function rafLoop(){uiTick();requestAnimationFrame(rafLoop);}
window.RDCAP={tick:function(dt){CLK.v+=dt;uiTick();if(G.api)G.api.frame();},begin:function(){introStart();},replay:function(x,spd){rpStart();ST.replay.x=x||0;ST.replay.speed=spd||6;rpApply(true);},focus:focusOn,unfocus:unfocus,orbit:function(a){G.api&&G.api.orbit(a);},view:function(k,v){setView(k,v);},live:function(){rpLive();}};
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
/* ================= v4 arayüz: kahin · rejim · takımyıldız · brifing · TF yörüngeleri · alarm köprüsü ================= */
var VIEW={corr:!/[?&]corr=0/.test(location.search),tf:/[?&]tf=1/.test(location.search)};
function setView(k,v){VIEW[k]=v==null?!VIEW[k]:!!v;var b=$(k==='corr'?'tbCorr':'tbTf');if(b)b.classList.toggle('on',VIEW[k]);if(G.api&&G.api.setOpts)G.api.setOpts(VIEW);$('hero').classList.toggle('tfv',VIEW.tf);pushFrame();}
function sgn(x,d){return pct(x,d==null?1:d);}
/* ---------- odak istihbaratı ---------- */
function focusIntel(k,f,c,Tc){var key=ST.mode+'|'+k+'|'+f.i+'|'+Tc;if(FOC.key!==key){FOC.key=key;FOC.an=f.i!=null?analog(c,f.i,Tc):null;}var A=FOC.an,h='<div class="lbl">◈ Benzeri kâhin <span class="live">CANLI geçmiş</span> <span class="mut">ileri '+ANH+'×'+(ST.mode==='bist'?'1s':'4s')+'</span></div>';
  if(!A)h+='<div class="ins">durum verisi yok</div>';
  else if(!A.ok)h+='<div class="ins">yetersiz örnek · n='+A.n+' (&lt;'+A.nmin+') · durum: '+esc(STN[A.st]||A.st)+' · aynı durumdaki havuz '+A.pool+' mum</div>';
  else h+='<div class="cone"><span>n <b>'+A.n+'</b></span><span>kazanma <b class="'+(A.win>=0.5?'g':'r')+'">%'+Math.round(100*A.win)+'</b></span><span>medyan <b class="'+(A.med>=0?'g':'r')+'">'+sgn(A.med)+'</b></span><span>p10 <b class="r">'+sgn(A.q[ANH][0])+'</b></span><span>p90 <b class="g">'+sgn(A.q[ANH][4])+'</b></span></div><div class="mut sm0">durum: '+esc(STN[A.st]||A.st)+' · benzer yakınlık/akış/RVOL/stres · '+A.pool+' mumluk havuzdan · kapanıştan kapanışa, brüt · imleçten önce kapanmış pencereler</div>';
  var leg=stLeg(A?A.st:null);if(leg){var rg=legReg(leg,Tc),tr=rg?trust(leg,rg.reg):null,o=tr&&tr.o;h+='<div class="kv"><span><span class="lab">LAB</span> '+LEGN[leg]+' · '+(rg?REGN[rg.reg]:'—')+'</span><b>'+(o?o.n+' işlem · PF '+pfTxt(o)+' · %'+o.win:'bu rejimde işlem yok')+(tr?' <i class="tr '+tr.k+'">'+tr.t+'</i>':'')+'</b></div>';}
  var M=FR.corr&&FR.corr.M[k],ps=M?Object.keys(M).map(function(x){return [+x,M[x]];}).sort(function(a,b){return b[1]-a[1];}):[];
  h+='<div class="kv"><span>✦ ρ&gt;'+CFG.rho+' (7g, '+(FR.corr?FR.corr.tf:'')+')</span><b>'+(ps.length?ps.slice(0,4).map(function(p){return esc(LAY.dots[p[0]].c.b)+' '+p[1].toFixed(2);}).join(' · ')+(ps.length>4?' +'+(ps.length-4):''):'<span class="mut">eşi yok</span>')+'</b></div>';
  if(ST.mode==='coin'&&f.r1!=null)h+='<div class="kv"><span>◎ yakınlık 1s · 4s</span><b><span class="c">'+(1-f.r1).toFixed(2)+'</span> · <span class="v">'+(1-f.r4).toFixed(2)+'</span> '+(f.al?'<i class="tr ok">HİZALI</i>':'<span class="mut">hizasız</span>')+'</b></div>';
  return h;}
function drawCone(g,A,x0,w,Y,c0,top,ph,holo){var fs=holo?15:9;g.save();g.strokeStyle='rgba(192,132,252,.5)';g.setLineDash([4,4]);g.beginPath();g.moveTo(x0+2,top-6);g.lineTo(x0+2,top+ph+4);g.stroke();g.setLineDash([]);
  g.fillStyle='rgba(216,180,254,.95)';g.font='bold '+fs+'px ui-monospace,monospace';g.fillText('KÂHİN',x0+8,top+fs);
  if(!A.ok){g.font=fs*0.9+'px ui-monospace,monospace';g.fillStyle='rgba(255,200,120,.95)';g.fillText('yetersiz',x0+8,top+ph/2);g.fillText('örnek n='+A.n,x0+8,top+ph/2+fs*1.2);g.restore();return;}
  var X=function(h){return x0+4+(w-(holo?62:34))*h/ANH;},P=function(h,j){return Y(c0*(1+A.q[h][j]));};
  function band(j1,j2,col){g.beginPath();for(var h=0;h<=ANH;h++)g.lineTo(X(h),P(h,j2));for(h=ANH;h>=0;h--)g.lineTo(X(h),P(h,j1));g.closePath();g.fillStyle=col;g.fill();}
  band(0,4,'rgba(192,132,252,.20)');band(1,3,'rgba(192,132,252,.38)');
  g.strokeStyle='rgba(255,240,200,.95)';g.lineWidth=holo?3:1.5;g.beginPath();for(var h=0;h<=ANH;h++){if(!h)g.moveTo(X(h),P(h,2));else g.lineTo(X(h),P(h,2));}g.stroke();
  g.strokeStyle='rgba(255,255,255,.25)';g.lineWidth=1;g.beginPath();g.moveTo(X(0),Y(c0));g.lineTo(X(ANH),Y(c0));g.stroke();
  g.font=(fs*0.85)+'px ui-monospace,monospace';[[4,'p90','#00ffaa'],[2,'med','#fff0c8'],[0,'p10','#ff2e6e']].forEach(function(r){g.fillStyle=r[2];g.fillText(sgn(A.q[ANH][r[0]]),X(ANH)+3,P(ANH,r[0])+4);});
  g.fillStyle='rgba(216,180,254,.95)';g.fillText('n '+A.n+' · %'+Math.round(100*A.win),x0+8,top+ph+(holo?2:0));g.restore();}
/* ---------- REJİM paneli ---------- */
function regLive(leg,Tc){var R=leg==='bist'?ST.bReg:ST.cReg,o={};if(!R)return o;allTrades().forEach(function(t){if(t.leg!==leg)return;var s=tradeAt(t,Tc);if(!s||!s.closed)return;var r=regAt(R,t.fireT);if(!r)return;var x=o[r.reg]=o[r.reg]||{n:0,w:0,usd:0};x.n++;if(s.ret>0)x.w++;x.usd+=s.usd;});return o;}
function regBox(nm,r,R,bist){if(!r)return '<div class="rgx"><small>'+nm+'</small><b>—</b><em>veri bekleniyor</em></div>';return '<div class="rgx" style="--rc:'+REGC[r.reg]+'"><small>'+nm+'</small><b>'+REGN[r.reg]+'</b><em>stres '+Math.round(r.s*100/1.6)+'/100 · '+(bist?'endeks':'BTC')+'/EMA50 '+(isFinite(r.d)?(bist?(r.d>=0?'+':'')+(r.d*100).toFixed(1)+'%':sgn(r.d)):'—')+' · genişlik %'+(isFinite(r.b50)?Math.round(100*r.b50):'—')+'</em></div>';}
function renderRegime(){var el=$('rgBody');if(!el||!FR)return;var Tc=FR.Tc,rc=FR.reg.c,rb=FR.reg.b;
  var head='<div class="rgb">'+regBox('COIN 4s',rc,ST.cReg,false)+regBox('BIST 1s',rb,ST.bReg,true)+'</div><canvas id="rgStrip"></canvas><div class="rgl">'+REGK.map(function(k){return '<span><i style="background:'+REGC[k]+'"></i>'+REGN[k]+'</span>';}).join('')+'<span class="mut">son 30 gün'+(ST.replay&&ST.replay.on?' · imlece kadar':'')+'</span></div>';
  var rows='',now=[];['yo6','loxx','bist'].forEach(function(leg){var r=legReg(leg,Tc),cr=r&&r.reg,tr=cr?trust(leg,cr):null,L=regLive(leg,Tc);
    rows+='<tr><th style="color:'+LEGC[leg]+'">'+LEGN[leg]+'<small>'+(leg==='bist'?'BIST':'coin')+'</small></th>'+REGK.map(function(k){var o=LABREG.legs[leg][k],lv=L[k];return '<td class="'+(k===cr?'now':'')+'">'+(o?'<b>'+o.n+'</b> · %'+Math.round(o.win)+'<br>PF '+pfTxt(o)+' · <span class="'+(o.usd>=0?'g':'r')+'">'+usd(o.usd)+'</span>':'<span class="mut">—</span>')+'<br><span class="lv">'+(lv?lv.n+' · '+usd(lv.usd):'·')+'</span></td>';}).join('')+'<td>'+(tr?'<i class="tr '+tr.k+'">'+tr.t+'</i>':'')+'</td></tr>';
    if(tr)now.push({leg:leg,tr:tr,reg:cr});});
  var ok=now.filter(function(x){return x.tr.k==='ok';}),bad=now.filter(function(x){return x.tr.k==='bad';});
  el.innerHTML='<div class="rgw"><div>'+head+'<div class="trn">'+(ok.length?'Şimdi güvenilecek: '+ok.map(function(x){return '<b style="color:'+LEGC[x.leg]+'">'+LEGN[x.leg]+'</b> ('+REGN[x.reg]+' · PF '+pfTxt(x.tr.o)+', n '+x.tr.o.n+')';}).join(' · '):'Bu rejimde lab’de güçlü bacak yok')+(bad.length?'<br><span class="r">Dikkat:</span> '+bad.map(function(x){return LEGN[x.leg]+' ('+REGN[x.reg]+' · PF '+pfTxt(x.tr.o)+')';}).join(' · '):'')+'</div>'+
    '</div><div><table class="rgt"><tr><th></th>'+REGK.map(function(k){return '<th style="color:'+REGC[k]+'">'+REGN[k]+'</th>';}).join('')+'<th>şimdi</th></tr>'+rows+'</table>'+
    '<div class="mut sm"><span class="lab">LAB</span> '+LABREG.period+' işlemleri girişteki rejime göre (n · kazanma · PF · $). <span class="live">CANLI</span> satırı: son 30 gün, aynı etiketleme (n · $). Çerçeveli hücre = bacağın şu anki rejimi. Kural: stres ≥ eşik → STRES; yoksa BTC (BIST: medyan endeks) EMA50 üstü + genişlik ≥%55 → TREND ↑; altı + ≤%45 → TREND ↓; aksi SAKİN. Lab mum sayımı coin 4s: '+REGK.map(function(k){return REGN[k]+' '+LABREG.bars4[k];}).join(' · ')+'.</div></div></div>';
  drawStrip();}
function drawStrip(){var cv=$('rgStrip');if(!cv||!cv.clientWidth||!FR)return;var X=hidpi(cv),g=X.g,W=X.w,H=X.h,Tc=FR.Tc,t0=Tc-RWIN,rows=[['coin 4s',ST.cReg],['BIST 1s',ST.bReg]];g.clearRect(0,0,W,H);var lh=(H-4)/2,lx=52;
  rows.forEach(function(rw,ri){var R=rw[1],y=2+ri*lh;g.fillStyle='rgba(214,255,242,.6)';g.font='9px ui-monospace,monospace';g.fillText(rw[0],2,y+lh/2+3);if(!R)return;
    for(var q=0;q<R.ts.length;q++){var t=R.ts[q],te=t+R.tf;if(te<t0||te>Tc)continue;var nx=q+1<R.ts.length?R.ts[q+1]+R.tf:te+R.tf,x1=lx+(W-lx)*(te-t0)/RWIN,x2=lx+(W-lx)*(Math.min(nx,Tc)-t0)/RWIN;g.fillStyle=REGC[R.reg[t]];g.globalAlpha=0.75;g.fillRect(x1,y+1,Math.max(1,x2-x1),lh-3);g.globalAlpha=1;}});
  g.strokeStyle='#fff';g.beginPath();g.moveTo(W-1,0);g.lineTo(W-1,H);g.stroke();}
/* ---------- GÜNLÜK BRİFİNG (kural tabanlı şablon, LLM yok) ---------- */
var BR={key:null,txt:''};
function briefText(){var T=FR?FR.T:null,Tc=FR?FR.Tc:Date.now(),L=[],rp=ST.replay&&ST.replay.on;
  L.push('QUANTEX RADAR · BRİFİNG · '+fmtT(Tc)+' TSİ'+(rp?' (geri oynatma imleci)':''));
  function rg(nm,r,bist){return r?nm+': '+REGN[r.reg]+' — stres '+Math.round(r.s*100/1.6)+'/100, '+(bist?'medyan endeks':'BTC')+' EMA50’nin '+(isFinite(r.d)?(Math.abs(r.d*100).toFixed(1)+'% '+(r.d>=0?'üstünde':'altında')):'—')+', genişlik %'+(isFinite(r.b50)?Math.round(100*r.b50):'—')+'.':nm+': veri yok.';}
  var rc=regAt(ST.cReg,Tc),rb=regAt(ST.bReg,Tc);L.push('');L.push('■ REJİM');L.push(rg('Coin 4s',rc,false));L.push(rg('BIST 1s',rb,true));
  var tl=['yo6','loxx','bist'].map(function(leg){var r=legReg(leg,Tc);if(!r)return null;var t=trust(leg,r.reg);return LEGN[leg]+' '+t.t+(t.o?' (lab '+REGN[r.reg]+': PF '+pfTxt(t.o)+', n '+t.o.n+', %'+Math.round(t.o.win)+')':' (lab: bu rejimde işlem yok)');}).filter(Boolean);
  L.push('Bacaklar (LAB, mevcut rejimde): '+tl.join(' · '));
  // coin adayları
  var cs=ST.coins.slice(0,80),cf=cs.map(function(c){return atCoin(c,T);}),idx=cf.map(function(f,i){return f?i:-1;}).filter(function(i){return i>=0;}).sort(function(a,b){return cf[a].r-cf[b].r;});
  var ck='c|'+(T==null?'L'+ST.lastAt:T);if(BR.ck!==ck){BR.ck=ck;BR.corr=cs.length?corrList(cs,false,T):null;}
  L.push('');L.push('■ EN YAKIN ADAYLAR (coin, CANLI)');var top=idx.slice(0,5);
  top.forEach(function(i,n){var f=cf[i];L.push((n+1)+'. '+cs[i].b+' — '+(f.setup==='—'?'kurulum yok':f.setup)+' · yakınlık '+(1-f.r).toFixed(2)+' · eksik: '+f.miss+(f.r1<CFG.al&&f.r4<CFG.al?' · 1s+4s hizalı':''));});
  if(!top.length)L.push('veri yok');
  if(BR.corr){var M=BR.corr.M,warn=[];for(var a=0;a<top.length;a++)for(var b=a+1;b<top.length;b++){var r=M[top[a]]&&M[top[a]][top[b]];if(r)warn.push(cs[top[a]].b+' ↔ '+cs[top[b]].b+' (ρ '+r.toFixed(2)+')');}
    L.push(warn.length?'⚠ Aynı kümeden iki sinyal: '+warn.join(', ')+' — ikisini birden almak riski ikiler.':'Korelasyon: ilk 5 aday arasında ρ>'+CFG.rho+' çift yok ('+BR.corr.E.length+' çift ρ>'+CFG.rho+' / '+BR.corr.pairs+').');}
  var al=idx.filter(function(i){return cf[i].r1<CFG.al&&cf[i].r4<CFG.al;}).map(function(i){return cs[i].b;});L.push('◎ 1s+4s hizalı: '+(al.length?al.join(', '):'yok'));
  // BIST
  L.push('');L.push('■ BIST z<−2 (1s, CANLI)');var bl=ST.bist.map(function(c){var f=atBist(c,T);return f?{b:c.b,z:f.z,f:f,c:c}:null;}).filter(Boolean),lo=bl.filter(function(x){return x.z<-2;}).sort(function(a,b){return a.z-b.z;});
  L.push(lo.length?lo.map(function(x){return x.b+' '+x.z.toFixed(2);}).join(' · ')+' → −2 üstü kapanış beklenir':'z<−2 hisse yok');
  var cr=bl.filter(function(x){var k=x.c.k1,i=x.f.i;for(var q=Math.max(1,i-8);q<=i;q++)if(x.c.cr[q])return true;return false;}).map(function(x){return x.b;});L.push('Son ~8 mumda −2 yukarı kesen: '+(cr.length?cr.join(', '):'yok'));
  // açık pozisyonlar
  L.push('');L.push('■ AÇIK LAB-TİPİ POZİSYONLAR (radar simülasyonu, $10 marj 2x, CANLI)');
  ['yo6','loxx','bist'].forEach(function(leg){var op=[];allTrades().forEach(function(t){if(t.leg!==leg)return;var s=tradeAt(t,Tc);if(s&&!s.closed)op.push({t:t,s:s});});
    if(!op.length){L.push(LEGN[leg]+': açık yok');return;}op.sort(function(a,b){return a.s.ret-b.s.ret;});var tot=op.reduce(function(a,x){return a+x.s.usd;},0);
    L.push(LEGN[leg]+': '+op.length+' açık · toplam '+usd(tot)+' · '+op.slice(0,leg==='bist'?3:5).map(function(x){return x.t.sym.replace(/USDT$/,'')+' '+sgn(x.s.ret)+' ('+fmtT(x.t.fireT)+')';}).join(' · ')+(op.length>(leg==='bist'?3:5)?' …':''));});
  var S={};allTrades().forEach(function(t){var s=tradeAt(t,Tc);if(!s||!s.closed)return;var o=S[t.leg]=S[t.leg]||{n:0,w:0,u:0};o.n++;if(s.ret>0)o.w++;o.u+=s.usd;});
  L.push('Son 30 gün kapanan (CANLI): '+['yo6','loxx','bist'].map(function(k){var o=S[k];return LEGN[k]+' '+(o?o.n+' işlem %'+Math.round(100*o.w/o.n)+' '+usd(o.u):'0 işlem');}).join(' · '));
  L.push('');L.push('Not: LAB = Oca–Eki 2026 geriye dönük test; CANLI = son 30 gün aynı kurallarla. Otomatik şablon metni, yatırım tavsiyesi değildir.');
  return L.join('\n');}
function renderBrief(){var el=$('brTxt');if(!el||!FR)return;var key=ST.mode+'|'+FR.T+'|'+ST.lastAt+'|'+ST.bist.length+'|'+ST.coins.length+'|'+ST.req;if(BR.key===key)return;BR.key=key;BR.txt=briefText();el.textContent=BR.txt;}
function copyBrief(){var t=BR.txt||'',done=function(){var b=$('brCopy');b.textContent='✓ kopyalandı';setTimeout(function(){b.textContent='Kopyala';},1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,function(){fb();});else fb();
  function fb(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){}document.body.removeChild(ta);}}
/* ---------- ALARM KÖPRÜSÜ (varsayılan kapalı; yalnız 'radar_alarm_v1' yazılır, QUANTEX kanal ayarları salt-okunur) ---------- */
var ALM={cfg:null,LS:'radar_alarm_v1'};
function almLoad(){var d={on:false,screen:true,sound:true,voice:false,remote:false,types:{fire:true,vf:true,bist:true},seen:{},log:[]};try{var v=JSON.parse(localStorage.getItem(ALM.LS)||'null');if(v&&typeof v==='object'){for(var k in d)if(k in v)d[k]=v[k];d.types=Object.assign({fire:true,vf:true,bist:true},v.types||{});}}catch(e){}ALM.cfg=d;return d;}
function almSave(){try{localStorage.setItem(ALM.LS,JSON.stringify(ALM.cfg));}catch(e){}}
function tdChannelsRO(){var out=[];// QUANTEX robotAlarm ile aynı kaynaklar (salt okuma)
  try{var tg=JSON.parse(localStorage.getItem('tradedesk-tg-v1')||'null');if(tg&&tg.url&&tg.chatId)out.push({k:'Telegram',url:tg.url,telegramChatId:tg.chatId});}catch(e){}
  try{var nt=JSON.parse(localStorage.getItem('tradedesk-ntfy-v1')||'null');if(nt&&nt.url)out.push({k:'ntfy',url:nt.url});}catch(e){}
  try{var st0=JSON.parse(localStorage.getItem('tradedesk-v1')||'null'),b=st0&&st0.state&&st0.state.botSettings;if(b&&b.enabled&&b.webhookUrl&&!out.some(function(o){return o.url===b.webhookUrl;}))out.push({k:'webhook',url:b.webhookUrl,telegramChatId:b.telegramChatId||undefined});}catch(e){}
  return out;}
function almEvents(){var now=Date.now(),ev=[],ty=ALM.cfg.types;
  ST.coins.forEach(function(c){(c.trades||[]).forEach(function(t){var win=t.leg==='yo6'?H4:H1;if(ty.fire&&now-t.fireT<=win&&now>=t.fireT)ev.push({id:'fire|'+t.leg+'|'+c.sym+'|'+t.ti,txt:c.b+' · '+LEGN[t.leg]+' ateşledi ('+fmtT(t.fireT)+' TSİ) · giriş sonraki mum açılışı',sym:c.sym});});
    var L=c.k4.c.length-1;if(ty.vf&&c.T.vf[L]&&now-(c.k4.t[L]+H4)<=H4)ev.push({id:'vf|'+c.sym+'|'+c.k4.t[L],txt:c.b+' · YO6 VF ateşledi · SMA10 geri alımı bekleniyor (12 mum)',sym:c.sym});});
  ST.bist.forEach(function(c){var L=c.k1.c.length-1;if(ty.bist&&c.cr[L]&&now-(c.k1.t[L]+H1)<=2*H1)ev.push({id:'bist|'+c.sym+'|'+c.k1.t[L],txt:c.b+' · BIST z −2 yukarı kesti (z '+f2(c.Z[L])+')',sym:c.sym});});
  return ev;}
function alarmCheck(){almLoad();if(!ALM.cfg.on||CLK.cap||(ST.replay&&ST.replay.on))return 0;var cf=ALM.cfg,now=Date.now(),fr=almEvents().filter(function(e){return !cf.seen[e.id];});
  for(var id in cf.seen)if(now-cf.seen[id]>4*DAY)delete cf.seen[id];fr.forEach(function(e){cf.seen[e.id]=now;cf.log.unshift({t:now,txt:e.txt});});cf.log=cf.log.slice(0,20);almSave();if(fr.length)almDispatch(fr,false);renderAlarm();return fr.length;}
function almDispatch(list,test){var cf=ALM.cfg,msg=list.length===1?'QUANTEX Radar · '+list[0].txt:'QUANTEX Radar · '+list.length+' yeni sinyal: '+list.slice(0,6).map(function(e){return e.txt.split(' · ').slice(0,2).join(' ');}).join(' | ');
  if(cf.screen){list.slice(0,3).forEach(function(e){rtoast(e.txt);});if(list.length>3)rtoast('+'+(list.length-3)+' sinyal daha');try{if(window.Notification&&Notification.permission==='granted'&&document.hidden)new Notification('QUANTEX Radar',{body:msg});}catch(e){}}
  if(cf.sound)rbeep4(list.length>1?2:1);
  if(cf.voice&&window.speechSynthesis){try{var u=new SpeechSynthesisUtterance(list.length===1?'Radar. '+list[0].txt.split(' · ').slice(0,2).join(', '):'Radar. '+list.length+' yeni sinyal.');u.lang='tr-TR';speechSynthesis.speak(u);}catch(e){}}
  if(cf.remote&&!test)tdChannelsRO().forEach(function(c){fetch('/api/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:c.url,telegramChatId:c.telegramChatId,payload:{text:msg,event:'radar'}})}).catch(function(){});});}
var RB4={ac:null};function rbeep4(n){try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;RB4.ac=RB4.ac||new AC();var ac=RB4.ac;if(ac.state==='suspended')ac.resume();var t=ac.currentTime;for(var i=0;i<n;i++){var o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(i%2?660:990,t+i*.2);g.gain.setValueAtTime(.0001,t+i*.2);g.gain.exponentialRampToValueAtTime(.25,t+i*.2+.02);g.gain.exponentialRampToValueAtTime(.0001,t+i*.2+.18);o.connect(g);g.connect(ac.destination);o.start(t+i*.2);o.stop(t+i*.2+.19);}}catch(e){}}
function rtoast(txt){var box=$('rToasts');if(!box)return;var el=document.createElement('div');el.className='rtoast';el.innerHTML='<b>🔔 Radar</b> '+esc(txt);box.appendChild(el);setTimeout(function(){el.classList.add('out');setTimeout(function(){el.remove();},500);},7000);el.onclick=function(){el.remove();};}
function renderAlarm(){var el=$('alBody');if(!el)return;var cf=ALM.cfg||almLoad(),ch=tdChannelsRO(),np=window.Notification?Notification.permission:'yok';
  function cb(id,on,txt,dis){return '<label class="tg'+(dis?' dis':'')+'"><input type="checkbox" data-al="'+id+'"'+(on?' checked':'')+(dis?' disabled':'')+'> '+txt+'</label>';}
  el.innerHTML='<div class="alm">'+cb('on',cf.on,'<b>Radar sinyallerini QUANTEX alarm kanallarına bağla</b>')+'</div>'+
   '<div class="lbl">Sinyaller</div><div class="alr">'+cb('t.fire',cf.types.fire,'ateşleme (YO6 MA / Loxx)')+cb('t.vf',cf.types.vf,'YO6 VF bekliyor')+cb('t.bist',cf.types.bist,'BIST z−2 kesişi')+'</div>'+
   '<div class="lbl">Kanallar</div><div class="alr">'+cb('screen',cf.screen,'ekran + bildirim')+cb('sound',cf.sound,'ses (bip)')+cb('voice',cf.voice,'sesli okuma',!window.speechSynthesis)+cb('remote',cf.remote,'uzak: Telegram / ntfy / webhook')+'</div>'+
   '<div class="kv"><span>QUANTEX kanalları (salt okuma)</span><b>'+(ch.length?ch.map(function(c){return c.k;}).join(' · '):'<span class="mut">bu tarayıcıda ayar yok</span>')+'</b></div><div class="kv"><span>Bildirim izni</span><b>'+np+'</b></div>'+
   '<div class="fbt al"><button class="btn" id="alTest">Test (yalnız ekran/ses)</button><span class="mut sm0">'+(cf.on?'<span class="g">● açık</span> · her taramada (15 dk) kontrol':'○ kapalı')+'</span></div>'+
   (cf.log.length?'<div class="lbl">Son alarmlar</div>'+cf.log.slice(0,5).map(function(l){return '<div class="sig"><em>'+fmtT(l.t)+'</em><span>'+esc(l.txt)+'</span></div>';}).join(''):'')+
   '<div class="mut sm">Aynı sinyal bir kez (tür | sembol | mum). Radar yalnız <code>radar_alarm_v1</code> anahtarını yazar; QUANTEX alarm ayarları ve diğer anahtarlar değiştirilmez. Geri oynatmada alarm çalmaz.</div>';
  el.querySelectorAll('[data-al]').forEach(function(x){x.onchange=function(){var k=x.getAttribute('data-al');if(k.indexOf('t.')===0)cf.types[k.slice(2)]=x.checked;else cf[k]=x.checked;
    if(k==='on'&&x.checked&&cf.screen&&window.Notification&&Notification.permission==='default'){try{Notification.requestPermission();}catch(e){}}
    almSave();if(k==='on'&&x.checked)alarmCheck();/* açılışta hâlâ taze olan sinyaller bir kez çalınır */renderAlarm();};});
  $('alTest').onclick=function(){almDispatch([{txt:'TEST · radar alarm köprüsü çalışıyor'}],true);};}
/* ---------- bağlama ---------- */
window.addEventListener('DOMContentLoaded',function(){$('tbCorr').onclick=function(){setView('corr');};$('tbTf').onclick=function(){setView('tf');};$('tbCorr').classList.toggle('on',VIEW.corr);$('tbTf').classList.toggle('on',VIEW.tf);
  $('brCopy').onclick=copyBrief;almLoad();renderAlarm();
  var nd=document.querySelectorAll('#cards>section').length,cd=$('cdots');cd.innerHTML=Array.from({length:nd},function(_,i){return '<i'+(i?'':' class="on"')+'></i>';}).join('');
  window.addEventListener('resize',function(){drawStrip();});});
window.QX_AN=function(){return FOC.an;};window.QX_BRIEF=function(){return BR.txt;};window.QX_INTEL={analog:analog,corrList:corrList,regAt:regAt,cur:cur,LAY:function(){return LAY;},FR:function(){return FR;},trust:trust,LABREG:LABREG};

/* ================= v5: karar motoru · kalite puanı · işlem planı · izleme listesi · performans aynası · palet/kısayollar/ayarlar/perf ================= */
var SC5={cache:{},sig:{}};
function mkt(){return ST.mode==='bist'?'bist':'coin';}
function wKey(m,b){return m+':'+b;}
/* ---------- kalite puanı (canlı) ---------- */
function sigList(bist,Tc){var m=bist?'b':'c',key=Tc+'|'+ST.lastAt+'|'+ST.req;if(SC5.sig['k'+m]===key)return SC5.sig[m];
  var L=(bist?ST.bist:ST.coins.slice(0,80)),T=ST.replay&&ST.replay.on?Tc:null,o=[];L.forEach(function(c){var f=bist?atBist(c,T):atCoin(c,T);if(f&&f.r<0.35)o.push(c);});SC5.sig[m]=o;SC5.sig['k'+m]=key;return o;}
function partnerOf(c,bist,Tc){var tf=bist?H1:H4,W=bist?63:42,best=null;
  function chk(c2,why){if(c2===c)return;var r=rhoPair(bist?c.k1:c.k4,bist?c2.k1:c2.k4,Tc,tf,W);if(r>CFG.rho&&(!best||r>best.r))best={b:c2.b,r:r,why:why};}
  (bist?ST.bist:ST.coins).forEach(function(c2){(c2.trades||[]).forEach(function(t){var s=tradeAt(t,Tc);if(s&&!s.closed)chk(c2,'açık poz.');});});
  sigList(bist,Tc).forEach(function(c2){chk(c2,'eş zamanlı sinyal');});return best;}
function scoreOf(c,bist,f,Tc){if(!f||f.i==null)return null;var key=(bist?'b':'c')+'|'+c.sym+'|'+f.i+'|'+Tc+'|'+CFG.rho+'|'+CFG.al+'|'+CFG.nmin;if(SC5.cache[key])return SC5.cache[key];
  var leg=legOfState(f.st,f.r1,f.r4,bist),rg=legReg(leg,Tc),regO=rg&&LABREG.legs[leg]?LABREG.legs[leg][rg.reg]:null;
  var an=analog(c,f.i,Tc,{list:bist?ST.bist:ST.coins.slice(0,80),bist:bist}),pt=partnerOf(c,bist,Tc);
  var S=qscore({leg:leg,regO:regO,an:an,r1:f.r1,r4:f.r4,bist:bist,partner:pt,up:f.up,rv:f.rv});S.reg=rg;S.regO=regO;S.an=an;S.pt=pt;S.f=f;S.c=c;S.bist=bist;
  var ks=Object.keys(SC5.cache);if(ks.length>400)SC5.cache={};SC5.cache[key]=S;return S;}
function sv(){return SCOREVAL&&SCOREVAL['tümü'];}
function infoOnly(){var o=sv();return !o||!(o.rho>0.1&&o.b.A.avg>o.b.D.avg);}
function qBadge(S){return S?'<i class="qs q'+S.L+'" title="Sinyal kalite puanı · '+(infoOnly()?'bilgi amaçlı (lab geri testinde ayrıştırmadı)':'lab doğrulamalı')+'">'+S.L+' '+S.s+'</i>':'';}
function qBlock(S){if(!S)return '';var o=sv(),h='<div class="lbl">⚖ Sinyal kalite puanı '+qBadge(S)+' <span class="'+(infoOnly()?'warnc':'live')+'">'+(infoOnly()?'BİLGİ AMAÇLI':'DOĞRULANDI')+'</span></div><div class="qbars">';
  for(var k in W5){var v=S.P[k];h+='<div class="qb"><span>'+W5N[k]+'</span><i><b style="width:'+Math.round(100*v)+'%"></b></i><em>'+Math.round(W5[k]*v)+'/'+W5[k]+'</em></div>';}
  h+='</div><div class="mut sm0">'+LEGN[S.leg]+' · rejim '+(S.reg?REGN[S.reg.reg]:'—')+' <span class="lab">LAB</span> '+(S.regO?'n '+S.regO.n+' PF '+pfTxt(S.regO):'işlem yok')+' · koni '+(S.an&&S.an.ok?'n '+S.an.n+' %'+Math.round(100*S.an.win)+' med '+sgn(S.an.med):'yetersiz')+(S.pt?' · ⚠ '+esc(S.pt.b)+' ρ '+S.pt.r.toFixed(2)+' ('+S.pt.why+')':'')+'</div>';
  if(infoOnly()&&o)h+='<div class="ins sm0">Geri test (356 lab işlemi, ileriye bakmadan): puan getiriyi <b>ayırmadı</b> — Spearman ρ '+o.rho.toFixed(2)+'; A ort '+sgn(o.b.A.avg/100)+' · D ort '+sgn(o.b.D.avg/100)+'. Karar için kullanmayın; yalnız bağlam.</div>';
  return h;}
/* ---------- işlem planı ---------- */
var PLAN={txt:''};
var EXIT={yo6:'Lab çıkışı: 12 × 4s mum (48 saat) sonra kapanışta çık (time12). Kâr hedefi yok.',loxx:'Lab çıkışı C(50/80): Loxx pst ilk ≥50 kapanışında yarısı, ≥80 kapanışında kalanı (1s).',bist:'Lab çıkışı TP %5 (giriş × 1.05 limit), en fazla 720 × 1s mum.'};
var ENTRY={yo6:'4s mum SMA10 üstünde kapanıp YO6 MA AL ateşlerse → bir sonraki 4s mumun AÇILIŞINDA gir.',loxx:'1s Loxx üçgen + pst 10–20 + z>0 + vortex onayı ateşlerse → bir sonraki 1s mumun AÇILIŞINDA gir.',bist:'z200 −2’nin yukarı kesişi 1s kapanışla gelirse → bir sonraki 1s mumun AÇILIŞINDA gir.'};
function openTrades(Tc){var o=[];allTrades().forEach(function(t){var s=tradeAt(t,Tc);if(s&&!s.closed)o.push(t);});return o;}
function planOpen(c,bist){var Tc=FR?FR.Tc:Date.now(),T=ST.replay&&ST.replay.on?Tc:null,f=bist?atBist(c,T):atCoin(c,T);if(!f)return;var S=scoreOf(c,bist,f,Tc);if(!S)return;
  var k=bist?c.k1:(S.leg==='loxx'?c.k1:c.k4),i=idxAt(k.t,Tc,S.leg==='yo6'?H4:H1),P=k.c[i],qty=20/P,stop=P*0.75,A=S.an,op=openTrades(Tc),R=robot(),ro=(R.coin?R.coin.open.length:0)+(R.bist?R.bist.open.length:0);
  var dg=P<1?6:P<10?4:2,px=function(x){return isFinite(x)?x.toFixed(dg):'—';},fire=f.r<0.05;
  var cnt={};op.forEach(function(t){cnt[t.leg]=(cnt[t.leg]||0)+1;});var worst=20*netR(-0.25);
  var L=[],H='';
  L.push('QUANTEX RADAR · İŞLEM PLANI · '+c.b+' ('+(bist?'BIST':'coin')+') · '+LEGN[S.leg]+' · '+fmtT(Tc)+' TSİ'+(T!=null?' (geri oynatma imleci)':''));
  L.push('Durum: '+(fire?'ATEŞLEDİ':'YAKIN (yakınlık '+(1-f.r).toFixed(2)+')')+' — '+f.why+' · eksik: '+f.miss);
  L.push('Giriş: '+ENTRY[S.leg]+' Referans ≈ son kapanış '+px(P)+'.');
  L.push('Çıkış: '+EXIT[S.leg]+(S.leg==='bist'?' Hedef ≈ '+px(P*1.05)+'.':''));
  L.push('Acil stop: −%25 → '+px(stop)+' (düşük bu seviyeye değerse, lab kuralı; global SL robot ayarlarınıza tabidir).');
  L.push('Büyüklük: $10 marj × 2x = $20 nominal ≈ '+(qty>=100?qty.toFixed(0):qty.toPrecision(4))+' adet · komisyon %0.04 × 2 · acil stopta ≈ '+usd(worst)+'.');
  if(A&&A.ok){var q=A.q[ANH];L.push('Beklenen aralık (benzeri kâhin, '+ANH+' mum, brüt, n '+A.n+', kazanma %'+Math.round(100*A.win)+'): p10 '+sgn(q[0])+' ('+px(P*(1+q[0]))+', '+usd(20*netR(q[0]))+') · p25 '+sgn(q[1])+' · medyan '+sgn(q[2])+' ('+usd(20*netR(q[2]))+') · p75 '+sgn(q[3])+' · p90 '+sgn(q[4])+' ('+px(P*(1+q[4]))+', '+usd(20*netR(q[4]))+')');}
  else L.push('Beklenen aralık: benzeri kâhin için örnek yetersiz (n='+(A?A.n:0)+' < '+CFG.nmin+') — aralık verilmiyor.');
  L.push('Eşzamanlı risk: radar simülasyonunda '+op.length+' açık ('+Object.keys(cnt).map(function(x){return LEGN[x]+' '+cnt[x];}).join(', ')+(op.length?'':'yok')+') + bu = '+(op.length+1)+' → nominal $'+20*(op.length+1)+' · hepsi acil stopta en kötü ≈ '+usd(worst*(op.length+1))+'. QUANTEX kağıt robotu (salt okuma): '+ro+' açık.');
  var tr=S.reg?trust(S.leg,S.reg.reg):null;
  L.push('Notlar:');
  L.push('• Rejim: '+(S.reg?REGN[S.reg.reg]:'—')+' — LAB '+(tr&&tr.o?'n '+tr.o.n+', PF '+pfTxt(tr.o)+', %'+Math.round(tr.o.win)+' → '+tr.t:'bu rejimde lab işlemi yok')+'.');
  if(S.pt)L.push('• Korelasyon: '+S.pt.b+' ile ρ '+S.pt.r.toFixed(2)+' ('+S.pt.why+') — ikisi aynı risk; birini seçin.');else L.push('• Korelasyon: açık pozisyon / eş zamanlı sinyal ile ρ>'+CFG.rho+' çift yok.');
  if(f.st==='vfw')L.push('• YO6 VF ateşledi, MA AL bekleniyor: SMA10 geri alınmadan giriş yok (12 mum içinde).');
  if(!bist&&f.r1!=null)L.push('• 1s/4s hizası: '+(f.al?'HİZALI':'hizasız')+' (1s '+(1-f.r1).toFixed(2)+' · 4s '+(1-f.r4).toFixed(2)+').');
  L.push('• Kalite puanı '+S.L+' '+S.s+'/100 — '+(infoOnly()?'BİLGİ AMAÇLI: lab geri testinde ayrıştırmadı (Spearman '+sv().rho.toFixed(2)+').':'lab doğrulamalı.'));
  L.push('• Kağıt robota gönderim yok: QUANTEX güvenli bir kağıt-robot pozisyon API’si sunmuyor; plan yalnız gösterilir. Yatırım tavsiyesi değildir.');
  PLAN.txt=L.join('\n');
  function row(a,b,cl){return '<div class="kv"><span>'+a+'</span><b'+(cl?' class="'+cl+'"':'')+'>'+b+'</b></div>';}
  H='<div class="ph"><b>'+esc(c.b)+'</b><span>'+(bist?'BIST 1s':'coin')+' · '+LEGN[S.leg]+'</span>'+qBadge(S)+'<i class="st '+(fire?'f':'n')+'">'+(fire?'ATEŞLEDİ':'YAKIN '+(1-f.r).toFixed(2))+'</i><button class="btn" id="plX">✕</button></div>'+
   '<div class="mut sm0">'+esc(f.why)+' · eksik: '+esc(f.miss)+' · '+fmtT(Tc)+' TSİ'+(T!=null?' · <span class="y">geri oynatma imleci</span>':'')+'</div><div class="pgrid"><div>'+
   '<div class="lbl">Giriş <span class="lab">LAB kuralı</span></div><div class="ins">'+ENTRY[S.leg]+'<br>Referans ≈ <b>'+px(P)+'</b> (son kapanış)</div>'+
   '<div class="lbl">Çıkış <span class="lab">LAB kuralı</span></div><div class="ins">'+EXIT[S.leg]+(S.leg==='bist'?'<br>Hedef ≈ <b class="g">'+px(P*1.05)+'</b>':'')+'</div>'+
   row('Acil stop −%25','<span class="r">'+px(stop)+'</span>')+row('Büyüklük','$10 marj × 2x = $20 · '+(qty>=100?qty.toFixed(0):qty.toPrecision(4))+' adet')+row('Acil stopta kayıp',usd(worst),'r')+
   '</div><div><div class="lbl">Beklenen aralık <span class="live">CANLI geçmiş</span> <span class="mut">kâhin konisi · '+ANH+' mum · brüt</span></div>'+
   (A&&A.ok?'<div class="rng">'+['p10','p25','medyan','p75','p90'].map(function(nm,j){var q=A.q[ANH][j];return '<div><small>'+nm+'</small><b class="'+(q>=0?'g':'r')+'">'+sgn(q)+'</b><em>'+px(P*(1+q))+'</em><em>'+usd(20*netR(q))+'</em></div>';}).join('')+'</div><div class="mut sm0">n '+A.n+' · kazanma %'+Math.round(100*A.win)+' · havuz '+A.pool+' mum</div>':'<div class="ins">örnek yetersiz (n='+(A?A.n:0)+' &lt; '+CFG.nmin+') — aralık verilmiyor</div>')+
   '<div class="lbl">Eşzamanlı risk <span class="live">CANLI</span></div>'+row('Radar sim. açık',op.length+(op.length?' ('+Object.keys(cnt).map(function(x){return LEGN[x]+' '+cnt[x];}).join(', ')+')':''))+row('Bu dahil toplam nominal','$'+20*(op.length+1))+row('Hepsi acil stopta',usd(worst*(op.length+1)),'r')+row('QUANTEX robot açık (salt okuma)',ro)+
   '</div></div><div class="lbl">Notlar</div><div class="ins sm0">'+L.slice(L.indexOf('Notlar:')+1).map(esc).join('<br>')+'</div>'+
   '<div class="fbt"><button class="btn hot" id="plCopy">Planı kopyala</button><button class="btn" disabled title="QUANTEX güvenli kağıt-robot API sunmuyor">Kağıt robota gönder · yok</button><button class="btn" id="plChart">QUANTEX grafiği ↗</button></div>';
  $('plBody').innerHTML=H;$('plan').classList.add('on');$('plX').onclick=planClose;$('plChart').onclick=function(){window.open(chartUrlS(bist?'bist':'coin',c.sym),'_blank');};
  $('plCopy').onclick=function(){copyTxt(PLAN.txt,$('plCopy'),'Planı kopyala');};}
function planClose(){$('plan').classList.remove('on');}
function copyTxt(t,b,lbl){var done=function(){b.textContent='✓ kopyalandı';setTimeout(function(){b.textContent=lbl;},1600);};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(done,fb);else fb();
  function fb(){var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){}ta.remove();}}
/* ---------- izleme listesi (radar_watch_v1) ---------- */
var WL={LS:'radar_watch_v1',a:null};
function wLoad(){if(WL.a)return WL.a;try{var v=JSON.parse(localStorage.getItem(WL.LS)||'[]');WL.a=Array.isArray(v)?v.filter(function(x){return typeof x==='string';}).slice(0,40):[];}catch(e){WL.a=[];}return WL.a;}
function wHas(m,b){return wLoad().indexOf(wKey(m,b))>=0;}
function wToggle(m,b){var a=wLoad(),k=wKey(m,b),i=a.indexOf(k);if(i>=0)a.splice(i,1);else a.unshift(k);try{localStorage.setItem(WL.LS,JSON.stringify(a));}catch(e){}BR.key=null;renderWatch();pushFrame();}
function wItem(k){var p=k.split(':'),bist=p[0]==='bist',c=(bist?ST.bist:ST.coins).filter(function(x){return x.b===p[1];})[0];return {k:k,m:p[0],b:p[1],bist:bist,c:c};}
function renderWatch(){var el=$('wBody');if(!el)return;var a=wLoad(),Tc=FR?FR.Tc:Date.now(),T=ST.replay&&ST.replay.on?Tc:null;
  if(!a.length){el.innerHTML='<div class="ins">Henüz sabitlenen yok. Odak panelinde <b>☆ izle</b> ya da <b>Ctrl+K</b> paletinde ☆ ile ekleyin. Sabitlenenler galakside ★ halka ile işaretlenir, brifing ve alarmlarda en başta yer alır.</div>';return;}
  el.innerHTML=a.map(function(k){var w=wItem(k);if(!w.c)return '<div class="wr"><em class="mk">'+w.m+'</em><b>'+esc(w.b)+'</b><span class="mut">evrende yok / veri bekleniyor</span><button class="btn sm" data-wx="'+k+'">✕</button></div>';
    var f=w.bist?atBist(w.c,T):atCoin(w.c,T),S=f?scoreOf(w.c,w.bist,f,Tc):null,p=f?Math.round(100*(1-f.r)):0,near=f&&f.r<0.35;
    return '<div class="wr'+(f&&f.r<0.05?' fire':'')+'"><em class="mk">'+(w.bist?'BIST':'coin')+'</em><span><b>'+esc(w.b)+'</b>'+qBadge(S)+'</span><span class="pb"><i style="width:'+p+'%"></i></span><span class="ws">'+(f?esc(f.setup==='—'?'kurulum yok':f.setup)+' · <span class="mut">'+esc(f.miss)+'</span>':'—')+'</span>'+
      '<span class="wb"><button class="btn sm" data-wf="'+k+'">odak</button>'+(near?'<button class="btn sm hot" data-wp="'+k+'">plan</button>':'')+'<button class="btn sm" data-wx="'+k+'" title="listeden çıkar">✕</button></span></div>';}).join('')+
   '<div class="mut sm0">'+a.length+' sabit · yalnız <code>radar_watch_v1</code> anahtarına yazılır</div>';
  el.querySelectorAll('[data-wx]').forEach(function(b){b.onclick=function(){var w=wItem(b.getAttribute('data-wx'));wToggle(w.m,w.b);};});
  el.querySelectorAll('[data-wf]').forEach(function(b){b.onclick=function(){jumpTo(wItem(b.getAttribute('data-wf')));};});
  el.querySelectorAll('[data-wp]').forEach(function(b){b.onclick=function(){var w=wItem(b.getAttribute('data-wp'));planOpen(w.c,w.bist);};});}
function jumpTo(w){if(!w||!w.c)return;var m=w.bist?'bist':'coin';if(ST.mode!==m){setMode(m);}setTimeout(function(){var k=kOfSym(w.c.sym);if(k!=null){focusOn(k);document.getElementById('hero').scrollIntoView({behavior:'smooth',block:'start'});}},60);}
/* ---------- performans aynası ---------- */
function lcg(seed){var s=seed>>>0;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function statsOf(r){var n=r.length,w=0,gp=0,gl=0,s=0;r.forEach(function(x){s+=x;if(x>0){w++;gp+=x;}else gl-=x;});return {n:n,win:n?w/n:NaN,pf:gl>0?gp/gl:(gp>0?Infinity:NaN),avg:n?s/n:NaN};}
var BOOT={};
function bootBand(leg,n){var key=leg+'|'+n;if(BOOT[key])return BOOT[key];var R=LABRET[leg],rnd=lcg(1234+n),M=[],P=[];for(var b=0;b<2000;b++){var a=[];for(var q=0;q<n;q++)a.push(R[Math.floor(rnd()*R.length)]);var s=statsOf(a);M.push(s.avg);P.push(isFinite(s.pf)?s.pf:99);}
  M.sort(function(a,b){return a-b;});P.sort(function(a,b){return a-b;});return BOOT[key]={m5:qnt(M,0.05),m95:qnt(M,0.95),p5:qnt(P,0.05),p50:qnt(P,0.5)};}
function mirrorData(){var now=Date.now(),out={};['yo6','loxx','bist'].forEach(function(leg){var r=[],open=0;allTrades().forEach(function(t){if(t.leg!==leg)return;var s=tradeAt(t,now);if(!s)return;if(s.closed)r.push(t.ret);else open++;});
  var lab=statsOf(LABRET[leg]),live=statsOf(r),n=live.n,o={leg:leg,lab:lab,live:live,open:open};
  if(n>0){var se=Math.sqrt(lab.win*(1-lab.win)/n);o.wLo=Math.max(0,lab.win-1.645*se);o.wHi=Math.min(1,lab.win+1.645*se);var B=bootBand(leg,n);o.mLo=B.m5;o.mHi=B.m95;o.pf5=B.p5;}
  o.st=n<5?'az':(live.win<o.wLo||live.avg<o.mLo)?'drift':(live.win>o.wHi||live.avg>o.mHi)?'ust':'ok';out[leg]=o;});return out;}
function renderMirror(){var el=$('mBody');if(!el)return;var D=mirrorData(),SN={az:['örnek az','az'],drift:['⚠ SAPMA — beklentinin altında','dr'],ust:['beklentinin üstünde','up'],ok:['bant içinde · normal','ok']};
  function bar(lo,hi,lab,live,mn,mx,fmt){var X=function(v){return clamp((v-mn)/(mx-mn),0,1)*100;};return '<div class="mbar"><i class="bd" style="left:'+X(lo)+'%;width:'+Math.max(1,X(hi)-X(lo))+'%"></i><i class="lb" style="left:'+X(lab)+'%"></i>'+(isFinite(live)?'<i class="lv" style="left:'+X(live)+'%"></i>':'')+'<small style="left:0">'+fmt(mn)+'</small><small style="right:0">'+fmt(mx)+'</small></div>';}
  el.innerHTML='<div class="mut sm0"><span class="lab">LAB</span> Oca–Eki 2026 tüm işlemler · <span class="live">CANLI</span> son 30 gün kapanan, aynı kural · bant: kazanma binom %90, ortalama bootstrap %5–95 (2000, tohumlu)</div>'+
   ['yo6','loxx','bist'].map(function(leg){var o=D[leg],L=o.lab,V=o.live,s=SN[o.st];
    return '<div class="mrow"><div class="mh"><i style="background:'+LEGC[leg]+'"></i><b>'+LEGN[leg]+'</b><em class="ms '+s[1]+'">'+s[0]+'</em><span class="mut">canlı n '+V.n+(o.open?' · açık '+o.open:'')+'</span></div>'+
     '<div class="mg"><span></span><small class="lab">LAB</small><small class="live">CANLI</small><small>bant</small>'+
     '<span>kazanma</span><b>%'+Math.round(100*L.win)+'</b><b class="'+(V.n&&V.win<o.wLo?'r':'')+'">'+(V.n?'%'+Math.round(100*V.win):'—')+'</b><em>'+(V.n?'%'+Math.round(100*o.wLo)+'–'+Math.round(100*o.wHi):'—')+'</em>'+
     '<span>ort. getiri</span><b>'+sgn(L.avg,2)+'</b><b class="'+(V.n&&V.avg<o.mLo?'r':'')+'">'+(V.n?sgn(V.avg,2):'—')+'</b><em>'+(V.n?sgn(o.mLo,1)+' … '+sgn(o.mHi,1):'—')+'</em>'+
     '<span>PF</span><b>'+(isFinite(L.pf)?L.pf.toFixed(2):'∞')+'</b><b>'+(V.n?(isFinite(V.pf)?V.pf.toFixed(2):'∞'):'—')+'</b><em>'+(V.n?'p5 '+(o.pf5>=99?'∞':o.pf5.toFixed(2)):'—')+'</em></div>'+
     (V.n?bar(o.wLo,o.wHi,L.win,V.win,0,1,function(v){return '%'+Math.round(100*v);}):'')+'</div>';}).join('')+
   '<div class="lbl">⚖ Kalite puanı geri testi <span class="lab">LAB</span> <span class="warnc">'+(infoOnly()?'AYRIŞTIRMADI → bilgi amaçlı':'ayrıştırdı')+'</span></div>'+svTable()+
   '<div class="mut sm">Sapma uyarısı yalnız canlı sonuç bandın altına düşerse yanar; n&lt;5 iken yorum yapılmaz. Gürültü bandı lab dağılımından; rejim farkı (ör. lab ağırlıkla TREND↓) canlıyı tek başına bandın dışına itebilir.</div>';}
function svTable(){var o=sv();if(!o)return '';var h='<div class="svt"><span></span><small>n</small><small>kazanma</small><small>ort.</small><small>Σ $</small>';
  ['A','B','C','D'].forEach(function(L){var b=o.b[L];h+='<span><i class="qs q'+L+'">'+L+'</i></span><b>'+b.n+'</b><b>%'+(b.win==null?'—':b.win.toFixed(0))+'</b><b class="'+(b.avg>=0?'g':'r')+'">'+(b.avg>=0?'+':'')+b.avg.toFixed(2)+'%</b><b>'+usd(b.usd)+'</b>';});
  return h+'</div><div class="mut sm0">Spearman ρ(puan, getiri) = <b class="'+(o.rho>0?'g':'r')+'">'+o.rho.toFixed(3)+'</b> · YO6 '+SCOREVAL.yo6.rho.toFixed(2)+' · Loxx '+SCOREVAL.loxx.rho.toFixed(2)+' · BIST '+SCOREVAL.bist.rho.toFixed(2)+'</div>';}
/* ---------- odak / En yakın 5 / brifing / alarm kancaları ---------- */
var _bf5=buildFrame;buildFrame=function(){var F=_bf5(),a=wLoad(),m=mkt();F.pin=[];LAY.dots.forEach(function(d,k){if(a.indexOf(wKey(m,d.c.b))>=0)F.pin.push(k);});return F;};
var _pf5=pushFrame;pushFrame=function(){_pf5();renderWatch();renderPerf();};
var _rt5=renderTop5;renderTop5=function(){_rt5();if(!FR)return;var bist=ST.mode==='bist';$('top5').querySelectorAll('.t5').forEach(function(b){var k=+b.getAttribute('data-k'),f=FR.c[k],d=LAY.dots[k];if(!f||!d)return;var S=scoreOf(d.c,bist,f,FR.Tc),em=b.querySelector('em');if(em)em.insertAdjacentHTML('afterend',qBadge(S));if(wHas(mkt(),d.c.b))b.classList.add('pin');});};
var _rf5=renderFocus;renderFocus=function(){_rf5();var k=FOC.k,d=LAY.dots[k];if(!d||!FR)return;var f=FR.c[k],bist=ST.mode==='bist',S=scoreOf(d.c,bist,f,FR.Tc),near=f&&f.r<0.35,pin=wHas(mkt(),d.c.b);
  var box=document.createElement('div');box.className='q5';box.innerHTML='<div class="fbt"><button class="btn'+(pin?' on':'')+'" id="fPin">'+(pin?'★ izleniyor':'☆ izle')+'</button>'+(near?'<button class="btn hot" id="fPlan">▤ İşlem planı</button>':'<button class="btn" disabled title="plan yalnız yakın (≥0.65) veya ateşleyen adayda">▤ plan · aday değil</button>')+'</div>'+qBlock(S);
  var cEl=$('fBody').querySelector('.c');if(cEl)cEl.insertAdjacentElement('afterend',box);else $('fBody').appendChild(box);
  $('fPin').onclick=function(){wToggle(mkt(),d.c.b);};if(near)$('fPlan').onclick=function(){planOpen(d.c,bist);};};
var _bt5=briefText;briefText=function(){var t=_bt5(),a=wLoad();if(!a.length)return t;var Tc=FR?FR.Tc:Date.now(),T=ST.replay&&ST.replay.on?Tc:null,L=['','■ İZLEME LİSTESİ (sabitlenen, CANLI)'];
  a.forEach(function(k){var w=wItem(k);if(!w.c){L.push('★ '+w.b+' ('+w.m+') — veri yok');return;}var f=w.bist?atBist(w.c,T):atCoin(w.c,T);if(!f){L.push('★ '+w.b+' — veri yok');return;}var S=scoreOf(w.c,w.bist,f,Tc);
    L.push('★ '+w.b+' ('+(w.bist?'BIST':'coin')+') — '+(f.setup==='—'?'kurulum yok':f.setup)+' · yakınlık '+(1-f.r).toFixed(2)+' · eksik: '+f.miss+(S?' · kalite '+S.L+' '+S.s+(infoOnly()?' (bilgi)':''):''));});
  var x=t.split('\n');x.splice(1,0,L.join('\n'));return x.join('\n');};
var _ae5=almEvents;almEvents=function(){var ev=_ae5(),a=wLoad();ev.forEach(function(e){var bist=e.id.indexOf('bist|')===0,c=(bist?ST.bist:ST.coins).filter(function(x){return x.sym===e.sym;})[0];if(c&&a.indexOf(wKey(bist?'bist':'coin',c.b))>=0){e.pin=1;e.txt='★ '+e.txt;}});ev.sort(function(x,y){return (y.pin||0)-(x.pin||0);});return ev;};
var _ra5=renderAll;renderAll=function(){_ra5();SC5.cache={};renderMirror();renderWatch();};
/* ---------- komut paleti ---------- */
var PAL={on:false,sel:0,items:[]};
function cmds(){return [
  {t:'En yakın adaya odaklan',k:'F',f:focusNearest},{t:'Piyasa rejimi paneli',k:'R',f:function(){goCard('cRegime');}},{t:'Günlük brifing',k:'B',f:function(){goCard('cBrief');}},
  {t:'İzleme listesi',k:'W',f:function(){goCard('cWatch');}},{t:'Performans aynası',k:'M',f:function(){goCard('cMirror');}},{t:'Zaman makinesi oynat / duraklat',k:'Space',f:spaceAct},
  {t:'Coin moduna geç',k:'',f:function(){setMode('coin');}},{t:'BIST moduna geç',k:'',f:function(){setMode('bist');}},{t:'Ayarlar',k:',',f:setOpen},{t:'Kısayollar',k:'?',f:helpOpen},{t:'Şimdi tara',k:'',f:function(){refresh(true);}},{t:'Temiz mod (galaksi tek başına)',k:'Z',f:function(){cleanSet();}},{t:'Senaryo: BTC −10%',k:'',f:function(){stressRun(-0.1);goCard('cStress');}},{t:'Kontraryan keşif paneli',k:'',f:function(){goCard('cContra');}},{t:'Tanıtım turu',k:'',f:function(){tourStart();}}];}
function palItems(q){q=(q||'').trim().toUpperCase();var it=[];cmds().forEach(function(c){if(!q||c.t.toUpperCase().indexOf(q)>=0)it.push({cmd:c});});
  var T=ST.replay&&ST.replay.on?FR.Tc:null;[['coin',ST.coins],['bist',ST.bist]].forEach(function(p){p[1].forEach(function(c){if(q&&c.b.indexOf(q)<0&&(c.sec||'').toUpperCase().indexOf(q)<0)return;it.push({w:{k:wKey(p[0],c.b),m:p[0],b:c.b,bist:p[0]==='bist',c:c}});});});
  if(q)it.sort(function(a,b){var sa=a.w?(a.w.b===q?0:a.w.b.indexOf(q)===0?1:2):1.5,sb=b.w?(b.w.b===q?0:b.w.b.indexOf(q)===0?1:2):1.5;return sa-sb;});return it.slice(0,40);}
function palOpen(){PAL.on=true;$('pal').classList.add('on');var i=$('palQ');i.value='';palRender();setTimeout(function(){i.focus();},10);}
function palClose(){PAL.on=false;$('pal').classList.remove('on');}
function palRender(){PAL.items=palItems($('palQ').value);PAL.sel=Math.min(PAL.sel,Math.max(0,PAL.items.length-1));var T=FR&&ST.replay&&ST.replay.on?FR.Tc:null;
  $('palL').innerHTML=PAL.items.map(function(x,i){if(x.cmd)return '<div class="pi'+(i===PAL.sel?' on':'')+'" data-i="'+i+'"><em>⌘</em><b>'+esc(x.cmd.t)+'</b><kbd>'+esc(x.cmd.k)+'</kbd></div>';
    var w=x.w,f=w.bist?atBist(w.c,T):atCoin(w.c,T),p=f?Math.round(100*(1-f.r)):0,pin=wHas(w.m,w.b);
    return '<div class="pi'+(i===PAL.sel?' on':'')+'" data-i="'+i+'"><em class="mk">'+(w.bist?'BIST':'coin')+'</em><b>'+esc(w.b)+'</b><span class="mut">'+esc(w.c.sec||'')+' · '+(f?esc(f.setup==='—'?'kurulum yok':f.setup):'—')+'</span><span class="pb"><i style="width:'+p+'%"></i></span><button class="btn sm'+(pin?' on':'')+'" data-pin="'+i+'">'+(pin?'★':'☆')+'</button></div>';}).join('')||'<div class="mut" style="padding:10px">eşleşme yok</div>';
  $('palL').querySelectorAll('.pi').forEach(function(el){el.onclick=function(e){var i=+el.getAttribute('data-i');if(e.target.hasAttribute('data-pin')){var w=PAL.items[i].w;wToggle(w.m,w.b);palRender();return;}PAL.sel=i;palGo();};});}
function palGo(){var x=PAL.items[PAL.sel];if(!x)return;palClose();if(x.cmd)x.cmd.f();else jumpTo(x.w);}
/* ---------- kısayollar / yardım ---------- */
function focusNearest(){if(!FR||!FR.list.length)return;var f=FR.list.slice().sort(function(a,b){return a.r-b.r;})[0];focusOn(f.k);}
function goCard(id){var el=$(id);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});el.classList.add('flash');setTimeout(function(){el.classList.remove('flash');},1200);}
function spaceAct(){if(ST.replay&&ST.replay.on)$('rpPlay').click();else rpStart();}
function helpOpen(){$('help').classList.add('on');}
function anyModal(){return PAL.on||$('help').classList.contains('on')||$('plan').classList.contains('on')||$('set').classList.contains('on');}
function closeModals(){palClose();$('help').classList.remove('on');planClose();$('set').classList.remove('on');}
window.addEventListener('keydown',function(e){var tg=e.target,typing=tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT');
  if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();e.stopImmediatePropagation();PAL.on?palClose():palOpen();return;}
  if(PAL.on){if(e.key==='Escape'){palClose();}else if(e.key==='ArrowDown'){PAL.sel=Math.min(PAL.items.length-1,PAL.sel+1);palRender();}else if(e.key==='ArrowUp'){PAL.sel=Math.max(0,PAL.sel-1);palRender();}else if(e.key==='Enter'){palGo();}else return;e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.key==='Escape'&&anyModal()){closeModals();e.preventDefault();e.stopImmediatePropagation();return;}
  if(typing||e.ctrlKey||e.metaKey||e.altKey)return;var k=e.key;
  var map={'/':palOpen,'?':helpOpen,'f':focusNearest,'F':focusNearest,'r':function(){goCard('cRegime');},'R':function(){goCard('cRegime');},'b':function(){goCard('cBrief');},'B':function(){goCard('cBrief');},'w':function(){goCard('cWatch');},'W':function(){goCard('cWatch');},'m':function(){goCard('cMirror');},'M':function(){goCard('cMirror');},',':setOpen,
    'p':function(){if(FOC.k!=null){var d=LAY.dots[FOC.k],f=FR.c[FOC.k];if(f&&f.r<0.35)planOpen(d.c,ST.mode==='bist');}}};
  if(k===' '&&!(ST.replay&&ST.replay.on)){e.preventDefault();e.stopImmediatePropagation();rpStart();return;}
  if(map[k]){e.preventDefault();e.stopImmediatePropagation();map[k]();}},true);
/* ---------- ayarlar (radar_settings_v1) + performans modu ---------- */
function setSave(){try{localStorage.setItem('radar_settings_v1',JSON.stringify(CFG));}catch(e){}}
function setOpen(){var el=$('setBody');function sel(id,lbl,opts,v,note){return '<div class="kv"><span>'+lbl+(note?'<br><small class="mut">'+note+'</small>':'')+'</span><b><select data-set="'+id+'">'+opts.map(function(o){return '<option value="'+o[0]+'"'+(String(o[0])===String(v)?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></b></div>';}
  el.innerHTML=sel('N','Coin evreni',[[30,'ilk 30'],[50,'ilk 50'],[80,'ilk 80']],CFG.N,'değişince yeniden tarar (≤4 istek/sn)')+sel('rho','Korelasyon eşiği ρ',[[0.7,'0.70'],[0.75,'0.75'],[0.8,'0.80'],[0.85,'0.85'],[0.9,'0.90']],CFG.rho,'takımyıldız, çift-risk, puan çeşitlendirme')+
   sel('al','1s+4s hiza eşiği',[[0.35,'yakınlık ≥0.65'],[0.4,'≥0.60'],[0.45,'≥0.55'],[0.5,'≥0.50'],[0.55,'≥0.45']],CFG.al)+sel('nmin','Kâhin asgari örnek',[[10,'10'],[15,'15'],[20,'20'],[30,'30']],CFG.nmin,'altında koni gösterilmez')+
   sel('perf','3B performans',[['auto','otomatik (fps)'],['high','yüksek'],['low','düşük']],perfMode(),'otomatik: 2 sn’de bir ölçülen fps &lt;30 → düşür, &gt;55 → yükselt')+'<div class="kv"><span>Ölçülen</span><b id="setPerf">—</b></div>'+
   '<div class="mut sm">Yalnız <code>radar_settings_v1</code> anahtarına yazılır. Lab sonuçları (PF, n, geri test) sabittir; eşikler yalnız canlı görünümü etkiler.</div>';
  el.querySelectorAll('[data-set]').forEach(function(s){s.onchange=function(){var id=s.getAttribute('data-set'),v=id==='perf'?s.value:+s.value,old=CFG[id];CFG[id]=v;setSave();
    if(id==='perf'){if(G.api&&G.api.setPerf)G.api.setPerf(v);}else if(id==='N'){$('rdN').value=String(v);if(old!==v)refresh(true);}else{G.corrKey=null;BR.key=null;BR.ck=null;FOC.key=null;SC5.cache={};pushFrame();renderMirror();}};});
  $('set').classList.add('on');renderPerf();}
function perfMode(){var m=/[?&]perf=(auto|high|low)/.exec(location.search);return m?m[1]:CFG.perf;}
function renderPerf(){if(G.api&&G.api.setPerf&&!G.api._pf){G.api._pf=1;G.api.setPerf(perfMode());}var el=$('setPerf'),pi=G.api&&G.api.perfInfo?G.api.perfInfo():null,t=G.mode!=='3d'||!pi?'2D çizim · perf modu yok':pi.mode+' · seviye '+pi.name+' · yoğunluk %'+Math.round(100*pi.dens)+' · '+pi.fps.toFixed(0)+' fps';if(el)el.textContent=t;var b=$('hPerf');if(b)b.textContent=G.mode==='3d'&&pi?'⚡ '+pi.name+' · '+pi.fps.toFixed(0)+' fps':'';}
window.addEventListener('DOMContentLoaded',function(){$('rdN').value=String(CFG.N);$('rdN').addEventListener('change',function(){CFG.N=+this.value;setSave();});
  $('palQ').addEventListener('input',function(){PAL.sel=0;palRender();});$('pal').addEventListener('click',function(e){if(e.target.id==='pal')palClose();});
  ['help','plan','set'].forEach(function(id){$(id).addEventListener('click',function(e){if(e.target.id===id)$(id).classList.remove('on');});});
  $('kBtn').onclick=palOpen;$('setBtn').onclick=setOpen;$('hlpBtn').onclick=helpOpen;$('setX').onclick=function(){$('set').classList.remove('on');};$('hlpX').onclick=function(){$('help').classList.remove('on');};
  renderWatch();renderMirror();setInterval(renderPerf,2000);});
window.QX_V5={scoreOf:scoreOf,planOpen:planOpen,planTxt:function(){return PLAN.txt;},mirror:mirrorData,watch:wLoad,palOpen:palOpen,setOpen:setOpen,helpOpen:helpOpen,closeModals:closeModals,jump:function(m,b){jumpTo(wItem(wKey(m,b)));},perf:function(){return G.api&&G.api.perfInfo?G.api.perfInfo():null;}};

/* ================= v6: canlı akış (WS) · kontraryan keşif · senaryo stres testi · seans halkası · sadeleştirme ================= */
/* ---------- 1) CANLI AKIŞ: Binance USDⓈ-M /market birleşik akış (kline 1s+4s, BTC markPrice@1s) ---------- */
var WSS={conns:[],map:{},syms:'',tot:0,win:[],rate:0,last:0,reconn:0,closed:0,log:[],stopped:false,confT:null,gap:false,btc:NaN,btcT:0,provN:0,provMs:0};
var WS_BASE='wss://fstream.binance.com/market/stream?streams=',WS_CHUNK=100;
function wsWanted(){return !/[?&]ws=0/.test(location.search)&&typeof WebSocket!=='undefined';}
function wsLive(){return WSS.conns.length>0&&WSS.conns.every(function(c){return c.state==='açık';})&&Date.now()-WSS.last<20000;}
function wsLog(t){WSS.log.unshift({t:Date.now(),x:t});WSS.log=WSS.log.slice(0,12);}
function wsStart(){if(!wsWanted()||CLK.cap&&!/[?&]ws=1/.test(location.search))return;var list=ST.coins.slice(0,80).map(function(c){return c.sym.toLowerCase();}),key=list.join(',');
  WSS.map={};ST.coins.forEach(function(c){WSS.map[c.sym]=c;});if(key===WSS.syms&&WSS.conns.length)return;wsStop();WSS.stopped=false;WSS.syms=key;
  var st=['btcusdt@markPrice@1s'];list.forEach(function(s){st.push(s+'@kline_1h',s+'@kline_4h');});
  var nc=Math.ceil(st.length/WS_CHUNK),cs=Math.ceil(st.length/nc);for(var i=0;i<st.length;i+=cs)WSS.conns.push({id:WSS.conns.length,streams:st.slice(i,i+cs),state:'bekliyor',att:0,ws:null,n:0});
  WSS.conns.forEach(function(cn,q){setTimeout(function(){wsOpen(cn);},q*1500);});/* bağlantı açılışları aralıklı (Binance bağlantı limiti) */
  wsLog(WSS.conns.length+' bağlantı · '+st.length+' akış');}
function wsStop(){WSS.stopped=true;WSS.conns.forEach(function(cn){clearTimeout(cn.rt);clearTimeout(cn.life);if(cn.ws){cn.ws.onclose=null;try{cn.ws.close();}catch(e){}}});WSS.conns=[];}
function wsOpen(cn){if(WSS.stopped)return;cn.state='bağlanıyor';var ws;try{ws=new WebSocket(WS_BASE+cn.streams.join('/'));}catch(e){wsRetry(cn,'kurulamadı');return;}cn.ws=ws;
  ws.onopen=function(){cn.state='açık';var down=cn.downAt?Date.now()-cn.downAt:0;if(cn.att)wsLog('#'+cn.id+' yeniden bağlandı ('+(down/1000).toFixed(1)+' sn sonra, deneme '+cn.att+')');else wsLog('#'+cn.id+' açık');cn.att=0;cn.openAt=Date.now();
    if(down>50*60*1000||WSS.gap){WSS.gap=false;wsLog('kopukluk uzun → REST yeniden eşitleme');refresh(true);}
    clearTimeout(cn.life);cn.life=setTimeout(function(){wsLog('#'+cn.id+' 23 sa yenileme');try{ws.close();}catch(e){}},23*3600*1000);/* Binance bağlantıyı 24 sa'de kapatır */};
  ws.onmessage=function(e){cn.n++;var m;try{m=JSON.parse(e.data);}catch(x){return;}wsMsg(m.data);};
  ws.onerror=function(){};ws.onclose=function(e){cn.state='kapalı';cn.downAt=cn.downAt&&cn.att?cn.downAt:Date.now();wsRetry(cn,'kapandı ('+e.code+')');};}
function wsRetry(cn,why){if(WSS.stopped)return;var d=Math.min(60000,1000*Math.pow(2,cn.att))*(0.75+0.5*Math.random());cn.att++;WSS.reconn++;cn.state='bekliyor';wsLog('#'+cn.id+' '+why+' → '+(d/1000).toFixed(1)+' sn sonra tekrar');clearTimeout(cn.rt);cn.rt=setTimeout(function(){wsOpen(cn);},d);}
function wsMsg(d){if(!d)return;var now=Date.now();WSS.tot++;WSS.win.push(now);WSS.last=now;
  if(d.e==='markPriceUpdate'){WSS.btc=+d.p;WSS.btcT=d.E;btcLive();return;}if(d.e!=='kline')return;var c=WSS.map[d.s];if(!c)return;var k=d.k,iv=k.i==='1h'?H1:H4,A=iv===H1?c.k1:c.k4,bar={t:+k.t,o:+k.o,h:+k.h,l:+k.l,c:+k.c,v:+k.v};
  if(k.x){var L=A.t.length-1;if(bar.t===A.t[L]+iv){A.t.push(bar.t);A.o.push(bar.o);A.h.push(bar.h);A.l.push(bar.l);A.c.push(bar.c);A.v.push(bar.v);WSS.closed++;clearTimeout(WSS.confT);WSS.confT=setTimeout(wsConfirm,12000);}
    else if(bar.t>A.t[L]+iv){WSS.gap=true;}if(iv===H1)c.live1=null;else c.live4=null;}
  else{if(iv===H1)c.live1=bar;else c.live4=bar;c.px=bar.c;c.pxT=d.E;c.dirty=true;var a=c.k1.c,n=a.length;if(iv===H1&&n>24)c.chLive=(bar.c/a[n-24]-1)*100;}}
/* kapanan mumlar → aynı tarama yolu (postCoins) → sinyaller KESİNLEŞİR */
function wsConfirm(){if(ST.busy){WSS.confT=setTimeout(wsConfirm,5000);return;}if(WSS.gap){WSS.gap=false;wsLog('mum boşluğu → REST eşitleme');refresh(true);return;}
  var t0=performance.now();postCoins(ST.coins);ST.coins.forEach(function(c){c.prov=null;});SC5.cache={};G.corrKey=null;BR.key=null;renderAll();ST.lastAt=Date.now();try{alarmCheck();}catch(e){}pushFrame();
  wsLog('mum kapandı → kesinleşti ('+WSS.closed+' mum, '+(performance.now()-t0).toFixed(0)+' ms)');WSS.closed=0;status2('Kesinleşti '+fmtT(ST.lastAt)+' · canlı akış');}
/* oluşan mum: anlık yakınlık (döner sırayla; yakın adaylar öncelikli) */
function addBar(k,b){return {t:k.t.concat([b.t]),o:k.o.concat([b.o]),h:k.h.concat([b.h]),l:k.l.concat([b.l]),c:k.c.concat([b.c]),v:k.v.concat([b.v])};}
function provTick(){if(!ST.coins.length||!ST.cB||ST.busy||ST.mode!=='coin'&&FOC.k==null&&false)return;var now=Date.now(),L=ST.coins.slice(0,80).filter(function(c){return c.dirty;});if(!L.length)return;
  L.sort(function(a,b){var pa=(now-((a.prov&&a.prov.t)||0))*((a.r<0.5)?3:1),pb=(now-((b.prov&&b.prov.t)||0))*((b.r<0.5)?3:1);return pb-pa;});var t0=performance.now(),n=0;
  for(var q=0;q<L.length&&n<4;q++){var c=L[q],l4=c.live4&&c.live4.t===c.k4.t[c.k4.t.length-1]+H4?c.live4:null,l1=c.live1&&c.live1.t===c.k1.t[c.k1.t.length-1]+H1?c.live1:null;if(!l4&&!l1){c.dirty=false;continue;}
    var x={sym:c.sym,b:c.b,qv:c.qv,ch:c.ch,k4:l4?addBar(c.k4,l4):c.k4,k1:l1?addBar(c.k1,l1):c.k1};try{prepCoin(x,ST.cB,now);}catch(e){c.dirty=false;continue;}
    var i=x.k4.c.length-1,j=x.k1.c.length-1,P=proxCoin(x,i,j),fl=x.T.fl;c.prov={r:P.r,r1:P.r1,r4:P.r4,st:P.st,why:P.why,miss:P.miss,setup:P.setup,up:isFinite(fl[i])&&isFinite(fl[i-1])?fl[i]>fl[i-1]:null,fl:fl[i],rv:x.rv1[j],t:now,c4:l4?l4.t+H4:null,c1:l1?l1.t+H1:null};c.dirty=false;n++;}
  WSS.provN+=n;WSS.provMs=performance.now()-t0;}
var _atC6=atCoin;atCoin=function(c,T){var f=_atC6(c,T);if(!f||T!=null)return f;f.conf={r:f.r,st:f.st,why:f.why};var p=c.prov;if(p&&wsLive()&&Date.now()-p.t<180000){f.r=p.r;f.r1=p.r1;f.r4=p.r4;f.st=p.st;f.why=p.why;f.miss=p.miss;f.setup=p.setup;f.up=p.up;f.fl=p.fl;f.rv=p.rv;f.form=p;}if(wsLive()&&isFinite(c.chLive))f.ch=c.chLive;return f;};
function fState(f){if(!f)return '';if(f.conf&&f.conf.r<0.05)return 'k';if(f.form)return 'o';return '';}
function closeIn(f){var p=f&&f.form;if(!p)return '';var t=f.r1!=null&&p.c1&&(!p.c4||p.c1<p.c4)?p.c1:p.c4||p.c1;return t?Math.max(0,Math.round((t-Date.now())/60000))+' dk':'';}
function stChip(f){var s=fState(f);return s==='k'?'<i class="sc k" title="kapanmış mumla doğrulandı">✓ kesinleşti</i>':s==='o'?'<i class="sc o" title="mum henüz kapanmadı; değer kapanışta değişebilir">◌ oluşuyor · '+closeIn(f)+'</i>':'';}
function btcLive(){var el=$('tBtc'),p=WSS.btc;if(!el||!isFinite(p))return;if(isFinite(BTC.p)&&p!==BTC.p){el.classList.remove('fu','fd');void el.offsetWidth;el.classList.add(p>BTC.p?'fu':'fd');}BTC.p=p;var b=ST.coins.filter(function(c){return c.sym==='BTCUSDT';})[0],ch=b&&isFinite(b.chLive)?b.chLive:NaN;
  el.innerHTML='<small>BTC</small> <b>'+p.toLocaleString('tr-TR',{maximumFractionDigits:1})+'</b> '+(isFinite(ch)?'<span class="'+(ch>=0?'g':'r')+'">'+(ch>=0?'+':'')+ch.toFixed(2)+'%</span>':'')+' <small class="g">● mark</small>';}
var _btc6=btcTick;btcTick=function(){if(wsLive()&&isFinite(WSS.btc))return;return _btc6();};
var _ref6=refresh;refresh=function(manual){/* WS sağlıklıyken 15 dk REST taraması 60 dk'ya seyrekleşir; elle tarama her zaman çalışır */if(manual===undefined&&wsLive()&&Date.now()-ST.lastAt<60*60*1000)return;return _ref6().then(function(){wsStart();});};
function wsTick(){var now=Date.now();WSS.win=WSS.win.filter(function(t){return now-t<5000;});WSS.rate=WSS.win.length/5;var el=$('wsPill');if(!el)return;
  var on=wsLive(),cs=WSS.conns,open=cs.filter(function(c){return c.state==='açık';}).length;
  el.className='btn ws '+(on?'on':cs.length?'wait':'off');el.innerHTML=on?'● CANLI AKIŞ <b>'+WSS.rate.toFixed(0)+'</b>/sn':cs.length?'◌ akış '+open+'/'+cs.length+' · yeniden bağlanıyor':'○ REST (15 dk)';
  el.title=on?cs.length+' WS bağlantısı · '+cs.reduce(function(a,c){return a+c.streams.length;},0)+' akış · toplam '+WSS.tot+' mesaj · yeniden bağlanma '+WSS.reconn:'canlı akış yok → REST kuyruğu (≤4 istek/sn)';}
/* ---------- 2) KONTRARYAN ---------- */
var KR={K1:function(S){return S.L==='D';},K2:function(S){return (S.reg&&S.reg.reg==='stres')||S.P.reg<0.5;},K3:function(S){return S.P.cone<=0.5;}};
function contraLive(S){if(!S)return null;var R=CONTRA.res,hit=[];for(var k in KR)if(R[k]&&R[k].promote&&KR[k](S))hit.push(k);return hit.length?hit:null;}
function renderContra(){var el=$('kBody');if(!el)return;var R=CONTRA.res,P=CONTRA.pre,any=Object.keys(R).some(function(k){return R[k].promote;});
  function cell(o,late){var ok=o.pass;return '<b>'+o.n+'</b><b>'+(isFinite(o.pf)&&o.pf<90?o.pf.toFixed(2):'∞')+'</b><em>'+o.bpf.toFixed(2)+'</em><em>'+o.r90.toFixed(2)+'</em><i class="ms '+(ok?'ok':'dr')+'">'+(ok?'✓':'✕')+'</i>';}
  el.innerHTML='<div class="mut sm0"><span class="lab">LAB</span> ön-kayıt '+esc(P.kayit)+' · '+esc(P.bolme)+' · <b>'+P.test_sayisi+' test</b> · tüm önceki kurallar değişmeden</div>'+
   '<div class="kt"><span></span><small>yarı</small><small>n</small><small>PF</small><small>taban</small><small>rast. p90</small><small></small>'+
   Object.keys(P.kurallar).map(function(k){var o=R[k];return '<span class="kn"><b>'+k+'</b> '+esc(P.kurallar[k])+'</span><small>Oca–May</small>'+cell(o.early)+'<small>Haz–Eki</small>'+cell(o.late,1)+'<span class="kv2"><i class="ms '+(o.promote?'ok':'az')+'">'+(o.promote?'TERFİ → Kontraryan ★':'terfi yok')+'</i>'+(o.late.n<30?' <span class="mut">geç n '+o.late.n+' &lt; 30</span>':'')+(!o.early.pass?' <span class="mut">erken yarıda tutmadı</span>':'')+(o.late.n>=30&&o.late.pf<=o.late.r90?' <span class="mut">geç PF ≤ rastgele p90</span>':'')+'</span>';}).join('')+'</div>'+
   '<div class="ins sm0">'+(any?'Örneklem dışında tutan kural canlı adaylarda <b>Kontraryan ★</b> rozeti alır.':'<b>Hiçbir kural terfi etmedi</b> → canlı rozet yok. K1 erken yarıda güçlü (PF '+R.K1.early.pf.toFixed(2)+' vs '+R.K1.early.bpf.toFixed(2)+') ama geç yarıda n '+R.K1.late.n+' ve rastgele p90’ı geçemedi; K2 yalnız geç yarıda tuttu. Kontraryan fikir v5’in tüm-örnek bulgusundan çıktığı için geç yarı da tam temiz değil.')+'</div>'+
   '<div class="mut sm">Taban: aynı yarının tüm işlemleri (erken PF '+(R.K1.early.bpf).toFixed(2)+', geç '+(R.K1.late.bpf).toFixed(2)+'). Rastgele: aynı n’li 5000 alt küme (tohum 6). Terfi: '+esc(P.terfi)+'. CSV: radar6_kontraryan.csv</div>';}
/* ---------- 3) SENARYO STRES TESTİ ---------- */
var STR={s:null};
function betaOf(c){var btc=ST.coins.filter(function(x){return x.sym==='BTCUSDT';})[0];if(!btc)return NaN;if(c===btc)return 1;var key=c.sym+'|'+c.k4.t.length;if(c._bk===key)return c._b;
  var bi={};btc.k4.t.forEach(function(t,i){bi[t]=i;});var a=[],b=[],k=c.k4,n=k.t.length;for(var i=Math.max(1,n-180);i<n;i++){var q=bi[k.t[i]];if(q==null||q<1||bi[k.t[i-1]]!==q-1)continue;a.push(Math.log(k.c[i]/k.c[i-1]));b.push(Math.log(btc.k4.c[q]/btc.k4.c[q-1]));}
  if(a.length<60)return NaN;var ma=0,mb=0;a.forEach(function(x,i){ma+=x;mb+=b[i];});ma/=a.length;mb/=b.length;var cv=0,vb=0;a.forEach(function(x,i){cv+=(x-ma)*(b[i]-mb);vb+=(b[i]-mb)*(b[i]-mb);});c._bk=key;c._b=vb>0?cv/vb:NaN;return c._b;}
function pxNow(c){return wsLive()&&isFinite(c.px)?c.px:c.k1.c[c.k1.c.length-1];}
function stressRun(s){STR.s=s;var now=Date.now(),rows=[],bist=0;
  allTrades().forEach(function(t){var st=tradeAt(t,now);if(!st||st.closed)return;if(t.leg==='bist'){bist++;return;}var c=WSS.map[t.sym]||ST.coins.filter(function(x){return x.sym===t.sym;})[0];if(!c)return;
    var P=pxNow(c),b=betaOf(c),al=P<=t.e*0.75,r0=al?-0.25:P/t.e-1,P2=P*Math.max(0.01,1+b*s),r1=P2/t.e-1,hit=al||P2<=t.e*0.75;rows.push({k:'poz',c:c,leg:t.leg,e:t.e,P:P,b:b,r0:r0,r1:hit?-0.25:r1,hit:hit,al:al,u0:20*netR(r0),u1:20*netR(hit?-0.25:r1)});});
  var T=ST.replay&&ST.replay.on?FR.Tc:null;ST.coins.slice(0,80).forEach(function(c){var f=atCoin(c,null);if(!f||f.r>=0.35)return;var P=pxNow(c),b=betaOf(c),r1=b*s,hit=r1<=-0.25;rows.push({k:'aday',c:c,leg:legOfState(f.st,f.r1,f.r4,false),e:P,P:P,b:b,r0:0,r1:hit?-0.25:r1,hit:hit,u0:0,u1:20*netR(hit?-0.25:r1)});});
  STR.rows=rows;STR.bist=bist;renderStress();}
function worstLive(){var B=ST.cB,btc=ST.coins.filter(function(x){return x.sym==='BTCUSDT';})[0],w={b:0,m:0};if(btc){var k=btc.k4;for(var i=6;i<k.c.length;i++){var v=k.c[i]/k.c[i-6]-1;if(v<w.b){w.b=v;w.bt=k.t[i]+H4;}}}
  if(B)B.ts.forEach(function(t){var v=B.mr[t];if(isFinite(v)&&v<w.m){w.m=v;w.mt=t+H4;}});return w;}
function renderStress(){var el=$('xBody');if(!el)return;var W=LAB6.worst,wl=worstLive(),s=STR.s;
  var h='<div class="fbt">'+[[-0.10,'BTC −10%'],[-0.20,'BTC −20%'],[0.10,'BTC +10%']].map(function(x){return '<button class="btn'+(s===x[0]?' hot':'')+'" data-sx="'+x[0]+'">'+x[1]+'</button>';}).join('')+'<span class="mut sm0">anlık şok · β = 30g 4s log-getiri (BTC’ye göre)</span></div>';
  if(s==null)h+='<div class="ins sm0">Bir senaryo seçin: açık radar-sim pozisyonları ve yakın adaylar (≥0.65) β ile şoklanır; −%25 acil stopa değen işaretlenir.</div>';
  else{var R=STR.rows||[],d0=0,d1=0,hits=R.filter(function(r){return r.hit;});R.forEach(function(r){d0+=r.u0;d1+=r.u1;});
    h+='<div class="xt"><small>tür</small><small>sembol</small><small>β</small><small>şimdi</small><small>şok sonrası</small><small>P/L Δ</small><small></small>'+(R.length?R.map(function(r){return '<em>'+(r.k==='poz'?'açık '+LEGN[r.leg]:'aday')+'</em><b>'+esc(r.c.b)+'</b><span>'+(isFinite(r.b)?r.b.toFixed(2):'—')+'</span><span class="'+(r.r0>=0?'g':'r')+'">'+sgn(r.r0)+'</span><span class="'+(r.r1>=0?'g':'r')+'">'+sgn(r.r1)+'</span><b class="'+(r.u1-r.u0>=0?'g':'r')+'">'+usd(r.u1-r.u0)+'</b><i class="ms '+(r.hit?'dr':'ok')+'">'+(r.al?'STOPTA (şimdi)':r.hit?'ACİL STOP':'—')+'</i>';}).join(''):'<span class="mut" style="grid-column:1/-1">açık coin pozisyonu ya da yakın aday yok</span>')+'</div>'+
     '<div class="kv"><span>Toplam (coin, $20/işlem)</span><b class="'+(d1>=0?'g':'r')+'">'+usd(d0)+' → '+usd(d1)+' (Δ '+usd(d1-d0)+')</b></div><div class="kv"><span>Acil stopa değen</span><b class="'+(hits.length?'r':'')+'">'+(hits.length?hits.map(function(r){return r.c.b;}).join(', '):'yok')+'</b></div>'+
     (STR.bist?'<div class="mut sm0">BIST açık '+STR.bist+' pozisyon BTC şokuna dahil edilmedi (β tanımsız).</div>':'');}
  h+='<div class="lbl">Tarihsel en kötü 24 saat</div><div class="kv"><span><span class="lab">LAB</span> BTC (Kas 2025–Eki 2026)</span><b class="r">'+sgn(W.btc.v)+' · '+fmtT(W.btc.t+H4)+'</b></div><div class="kv"><span><span class="lab">LAB</span> sepet medyanı ('+W.basket.n+' coin)</span><b class="r">'+sgn(W.basket.v)+' · '+fmtT(W.basket.t+H4)+'</b></div><div class="kv"><span><span class="lab">LAB</span> BTC en iyi 24 sa</span><b class="g">'+sgn(W.btcUp.v)+'</b></div>'+
   '<div class="kv"><span><span class="live">CANLI</span> pencere (son '+(ST.coins[0]?Math.round(ST.coins[0].k4.t.length*4/24):0)+' gün) BTC / sepet</span><b class="r">'+sgn(wl.b)+' / '+sgn(wl.m)+'</b></div>'+
   '<div class="mut sm">Varsayım: şok anlık, β sabit, mum içi yol ve likidite kayması yok; acil stop seviyesinde dolum. Gerçek kriz günlerinde β genelde 1’e yakınsar ve korelasyon artar.</div>';
  el.innerHTML=h;el.querySelectorAll('[data-sx]').forEach(function(b){b.onclick=function(){stressRun(+b.getAttribute('data-sx'));};});}
/* ---------- 4) SEANS SAATİ ---------- */
function hourTSI(t){return new Date((t==null?Date.now():t)+3*36e5).getUTCHours();}
function sessData(){return {hr:LAB6.HR,now:hourTSI(),min:new Date(Date.now()+3*36e5).getUTCMinutes()};}
function drawSess(){var cv=$('sCv');if(!cv||!cv.clientWidth)return;var X=hidpi(cv),g=X.g,W=X.w,H=X.h,cx=W/2,cy=H/2,R0=Math.min(W,H)/2-34,D=sessData(),legs=['yo6','loxx','bist'];g.clearRect(0,0,W,H);
  legs.forEach(function(leg,li){var r1=R0*(0.45+li*0.18),r2=r1+R0*0.15;for(var h=0;h<24;h++){var a=D.hr[leg][h],n=a[0],wr=n?a[1]/n:0,a0=-Math.PI/2+h/24*2*Math.PI+0.01,a1=a0+2*Math.PI/24-0.02;
      g.beginPath();g.arc(cx,cy,r2,a0,a1);g.arc(cx,cy,r1,a1,a0,true);g.closePath();g.fillStyle=n?'hsla('+Math.round(120*clamp((wr-0.3)/0.6,0,1))+',100%,50%,'+(0.25+0.6*Math.min(1,n/15))+')':'rgba(255,255,255,.04)';g.fill();
      if(n&&n>=8){g.fillStyle='#02060b';g.font='bold 8px ui-monospace,monospace';g.textAlign='center';var am=(a0+a1)/2,rm=(r1+r2)/2;g.fillText(Math.round(100*wr),cx+Math.cos(am)*rm,cy+Math.sin(am)*rm+3);}}
});
  var an=-Math.PI/2+(D.now+D.min/60)/24*2*Math.PI;g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.moveTo(cx+Math.cos(an)*R0*0.38,cy+Math.sin(an)*R0*0.38);g.lineTo(cx+Math.cos(an)*(R0+6),cy+Math.sin(an)*(R0+6));g.stroke();g.lineWidth=1;
  var a0=-Math.PI/2+D.now/24*2*Math.PI;g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;g.beginPath();g.arc(cx,cy,R0+3,a0,a0+2*Math.PI/24);g.stroke();g.lineWidth=1;
  [[10,'açılış'],[18,'kapanış']].forEach(function(x){var a=-Math.PI/2+x[0]/24*2*Math.PI;g.strokeStyle='#ffe600';g.beginPath();g.moveTo(cx+Math.cos(a)*R0*0.42,cy+Math.sin(a)*R0*0.42);g.lineTo(cx+Math.cos(a)*(R0+10),cy+Math.sin(a)*(R0+10));g.stroke();g.fillStyle='#ffe600';g.font='9px ui-monospace,monospace';g.textAlign=Math.cos(a)>0?'left':'right';g.fillText(x[1],cx+Math.cos(a)*(R0+12),cy+Math.sin(a)*(R0+12)+3);});
  g.fillStyle='#7dd3fc';g.font='9px ui-monospace,monospace';g.textAlign='center';[0,6,12,18].forEach(function(h){var a=-Math.PI/2+h/24*2*Math.PI;g.fillText(String(h).padStart(2,'0'),cx+Math.cos(a)*(R0*0.36),cy+Math.sin(a)*(R0*0.36)+3);});
  g.fillStyle='#fff';g.font='bold 12px ui-monospace,monospace';g.fillText(String(D.now).padStart(2,'0')+':'+String(D.min).padStart(2,'0'),cx,cy+2);g.font='8px ui-monospace,monospace';g.fillStyle='#5f8f88';g.fillText('TSİ',cx,cy+13);}
function renderSess(){var el=$('sTxt');if(!el)return;var D=sessData(),h=D.now;function row(leg){var a=D.hr[leg][h],tot=D.hr[leg].reduce(function(s,x){return s+x[0];},0),bw=D.hr[leg].reduce(function(s,x){return s+x[1];},0);
    return '<div class="kv"><span><i class="dot" style="background:'+LEGC[leg]+'"></i>'+LEGN[leg]+' · '+String(h).padStart(2,'0')+':00 girişleri</span><b>'+(a[0]?'n '+a[0]+' · %'+Math.round(100*a[1]/a[0])+(a[0]<8?' <span class="mut">(az)</span>':''):'<span class="mut">bu saatte giriş yok</span>')+' <span class="mut">· tümü %'+Math.round(100*bw/tot)+'</span></b></div>';}
  var bo=h>=10&&h<18;el.innerHTML='<div class="mut sm0"><span class="lab">LAB</span> giriş saati (TSİ) başına isabet · halkalar içten dışa: <span style="color:#00ffaa">YO6</span> · <span style="color:#c084fc">Loxx</span> · <span style="color:#ffe600">BIST</span> · renk kırmızı %30 → yeşil %90 · opaklık = n · beyaz = şimdi · sarı = BIST 10:00 / 18:00</div>'+['yo6','loxx','bist'].map(row).join('')+
   '<div class="kv"><span>BIST seansı</span><b class="'+(bo?'g':'mut')+'">'+(bo?'AÇIK · kapanışa '+((18-h)*60-D.min)+' dk':'KAPALI · açılış 10:00 TSİ')+'</b></div><div class="mut sm">YO6 4s mumla girer → yalnız 03/07/11/15/19/23. Tanımlayıcıdır, kural değildir; saat başına n küçük (çoğu &lt;10), bu yüzden filtre olarak kullanılmaz.</div>';}
/* ---------- 5) sadeleştirme: katlanır paneller · temiz mod (Z) · tur ---------- */
var UI6={LS:'radar_ui_v1',s:null};
function uiLoad(){if(UI6.s)return UI6.s;try{UI6.s=JSON.parse(localStorage.getItem(UI6.LS)||'null');}catch(e){}if(!UI6.s||typeof UI6.s!=='object')UI6.s={col:{},clean:false};UI6.s.col=UI6.s.col||{};return UI6.s;}
function uiSave(){try{localStorage.setItem(UI6.LS,JSON.stringify(UI6.s));}catch(e){}}
function colInit(){var s=uiLoad();document.querySelectorAll('#cards>section.pn').forEach(function(sec){var h=sec.querySelector('h3');if(!h||h._c)return;h._c=1;var b=document.createElement('button');b.className='colb';b.title='paneli daralt / aç';b.textContent='▾';h.appendChild(b);
  if(s.col[sec.id])sec.classList.add('col');b.onclick=function(e){e.stopPropagation();sec.classList.toggle('col');s.col[sec.id]=sec.classList.contains('col');uiSave();if(!s.col[sec.id]){drawStrip();drawSess();}};});}
function cleanSet(v){var s=uiLoad();s.clean=v==null?!s.clean:!!v;uiSave();document.body.classList.toggle('clean',s.clean);var b=$('zBtn');if(b)b.classList.toggle('on',s.clean);setTimeout(function(){window.dispatchEvent(new Event('resize'));},50);}
var TOUR={i:-1,steps:[['hero','Sinyal galaksisi: çekirdeğe yakın = kuruluma yakın. Tıkla → odak + plan.'],['top5','En Yakın 5: ◌ oluşuyor = mum kapanmadı (değişebilir) · ✓ kesinleşti = kapanmış mumla doğrulandı.'],['wsPill','Canlı akış: Binance WS ile anlık; kopunca kendini yeniden bağlar, olmazsa REST kuyruğu.'],['kBtn','Ctrl+K: coin/hisseye atla, ☆ ile izleme listesine ekle. ? = tüm kısayollar.'],['cContra','Kontraryan keşif: ön-kayıtlı kurallar erken/geç yarıda test edildi — yalnız tutan canlı rozet alır.'],['zBtn','Z = temiz mod: tüm katmanları gizler, sadece galaksi kalır. Panel başlığındaki ▾ ile daralt.']]};
function tourWanted(){var m=/[?&]tour=([01])/.exec(location.search);if(m)return m[1]==='1';if(CLK.cap)return false;try{return !sessionStorage.getItem('qxr_tour6');}catch(e){return false;}}
function tourStart(){TOUR.i=0;try{sessionStorage.setItem('qxr_tour6','1');}catch(e){}tourShow();}
function tourEnd(){TOUR.i=-1;$('tour').classList.remove('on');document.querySelectorAll('.tourhl').forEach(function(e){e.classList.remove('tourhl');});}
function tourShow(){var st=TOUR.steps[TOUR.i];if(!st)return tourEnd();var el=$(st[0]);document.querySelectorAll('.tourhl').forEach(function(e){e.classList.remove('tourhl');});var box=$('tour');
  if(!el||!el.offsetParent&&el.id!=='hero'){TOUR.i++;return tourShow();}el.scrollIntoView({block:'nearest',inline:'nearest'});el.classList.add('tourhl');var r=el.getBoundingClientRect();
  box.innerHTML='<div class="tn">'+(TOUR.i+1)+' / '+TOUR.steps.length+'</div><div>'+st[1]+'</div><div class="fbt"><button class="btn" id="tSkip">Geç</button><button class="btn hot" id="tNext">'+(TOUR.i===TOUR.steps.length-1?'Bitir':'İleri →')+'</button></div>';box.classList.add('on');
  var bw=Math.min(300,innerWidth-20),x=clamp(r.left+(st[0]==='hero'?r.width/2-bw/2:0),10,innerWidth-bw-10),y=r.bottom+10;if(st[0]==='hero')y=r.top+r.height*0.55;if(y+150>innerHeight)y=Math.max(10,r.top-160);box.style.left=x+'px';box.style.top=y+'px';box.style.width=bw+'px';
  $('tNext').onclick=function(){TOUR.i++;tourShow();};$('tSkip').onclick=tourEnd;}
/* ---------- kancalar ---------- */
var _rt6=renderTop5;renderTop5=function(){_rt6();if(!FR)return;$('top5').querySelectorAll('.t5').forEach(function(b){var k=+b.getAttribute('data-k'),f=FR.c[k];if(!f)return;var ch=stChip(f),sm=b.querySelector('small');if(ch&&sm)sm.insertAdjacentHTML('beforebegin',ch);
  var d=LAY.dots[k],S=d&&scoreOf(d.c,ST.mode==='bist',f,FR.Tc),kk=contraLive(S);if(kk)b.querySelector('em').insertAdjacentHTML('afterend','<i class="qs qK" title="örneklem dışında tutan kontraryan kural: '+kk.join(', ')+'">Kontraryan ★</i>');});};
var _rf6=renderFocus;renderFocus=function(){_rf6();var k=FOC.k,f=FR&&FR.c[k];if(!f||!f.conf)return;var box=document.createElement('div');box.className='kv fs6';
  box.innerHTML=fState(f)==='o'?'<span>◌ oluşuyor — anlık / kesinleşmiş yakınlık</span><b><span class="y">'+(1-f.r).toFixed(2)+'</span> / '+(1-f.conf.r).toFixed(2)+' · kapanışa '+closeIn(f)+'</b>':fState(f)==='k'?'<span>✓ kesinleşti</span><b>kapanmış mumla</b>':'<span>durum</span><b>kapanmış mum (akış yok)</b>';
  var c=$('fBody').querySelector('.c');if(c)c.insertAdjacentElement('afterend',box);};
var _bf6=buildFrame;buildFrame=function(){var F=_bf6();F.c.forEach(function(f){f.fs=fState(f);});return F;};
var _pf6=pushFrame;pushFrame=function(){_pf6();renderSess();if(G.api&&G.api.setSession)G.api.setSession(sessData());};
var _ra6=renderAll;renderAll=function(){_ra6();renderStress();if(STR.s!=null)stressRun(STR.s);};
var _h5=helpOpen;
window.addEventListener('keydown',function(e){var tg=e.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT')||e.ctrlKey||e.metaKey||e.altKey)return;if(PAL.on)return;
  if(e.key==='z'||e.key==='Z'){e.preventDefault();e.stopImmediatePropagation();cleanSet();}else if(e.key==='Escape'&&TOUR.i>=0){tourEnd();e.stopImmediatePropagation();}},true);
var _in6=introEnd;introEnd=function(){_in6();if(tourWanted())setTimeout(tourStart,900);};
window.addEventListener('DOMContentLoaded',function(){colInit();if(uiLoad().clean)cleanSet(true);renderContra();renderStress();renderSess();drawSess();
  $('zBtn').onclick=function(){cleanSet();};$('wsPill').onclick=function(){var l=WSS.log.map(function(x){return fmtT(x.t)+' '+x.x;}).join('\n');rtoast((wsLive()?'canlı akış · ':'')+(WSS.log[0]?WSS.log[0].x:'akış yok'));};
  setInterval(wsTick,1000);setInterval(function(){provTick();},1000);setInterval(function(){if(FR&&!(ST.replay&&ST.replay.on)&&wsLive()&&ST.mode==='coin'){pushFrame();}},2000);setInterval(drawSess,60000);
  window.addEventListener('resize',drawSess);var iv=setInterval(function(){if(window.QX_RADAR_READY){clearInterval(iv);wsStart();if(!INTRO.on&&tourWanted())setTimeout(tourStart,1500);}},500);});
window.QX_V6={ws:function(){return {live:wsLive(),rate:WSS.rate,tot:WSS.tot,reconn:WSS.reconn,conns:WSS.conns.map(function(c){return {id:c.id,state:c.state,streams:c.streams.length,n:c.n,att:c.att};}),log:WSS.log.slice(),provN:WSS.provN,provMs:WSS.provMs,btc:WSS.btc};},
  kill:function(i){var c=WSS.conns[i||0];if(c&&c.ws)c.ws.close(4000,'test');},stress:stressRun,clean:cleanSet,tour:tourStart,tourEnd:tourEnd,confirm:wsConfirm,forming:function(){return ST.coins.filter(function(c){return c.prov;}).length;}};
})();
