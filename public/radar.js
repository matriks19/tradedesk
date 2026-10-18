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
function rT41(k,B){var m=k.c.length,sw=rSweep(k),fl=rFlow(k.c,k.v),ma=rSma(k.c,10),vf=[],en=[],wt=[],pend=-1,lastE=-1,pendAt=[];
  for(var i=0;i<m;i++){var t=k.t[i],calm=B?((isFinite(B.mr[t])&&B.mr[t]<=-0.05)||(isFinite(B.br[t])&&B.br[t]>=0.10)):true;
    vf[i]=sw[i]&&calm&&isFinite(fl[i])&&isFinite(fl[i-1])&&fl[i]>fl[i-1];if(vf[i])pend=i;if(pend>=0&&i-pend>12)pend=-1;
    en[i]=false;if(pend>=0&&isFinite(ma[i])&&k.c[i]>ma[i]){if(i>lastE){en[i]=true;lastE=i;}pend=-1;}wt[i]=pend>=0;pendAt[i]=pend;}
  return {sw:sw,fl:fl,ma:ma,vf:vf,en:en,wt:wt,pendAt:pendAt};}
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
var ST={mode:'coin',coins:[],bist:[],pulse:null,tape:[],seen:{},busy:false,lastAt:0,err:[],req:0};

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
    var r1=await getJSON('/api/fapi/v1/klines?symbol='+s+'&interval=1h&limit=1000');
    out.push({sym:s,b:s.replace(/USDT$/,''),qv:+x.quoteVolume,ch:+x.priceChangePercent,k4:kl(r4,H4),k1:kl(r1,H1)});
    done++;status('Coin mumları: '+done+'/'+u.length+' ('+ST.req+' istek, ≤4/sn)');});
  out.sort(function(a,b){return b.qv-a.qv;});
  var B=rBasket(out.slice(0,40).map(function(c){return c.k4;}),H4,null);
  out.forEach(function(c){evalCoin(c,B);});
  var btc=out.filter(function(c){return c.sym==='BTCUSDT';})[0];
  ST.coins=out;ST.pulse=pulseCoin(out,B,btc);ST.cB=B;}
function evalCoin(c,B){
  var k=c.k4,L=k.c.length-1,T=rT41(k,B),k1=c.k1,L1=k1.c.length-1;
  c.flowUp=isFinite(T.fl[L])&&isFinite(T.fl[L-1])?T.fl[L]>T.fl[L-1]:null;
  c.flowSer=T.fl;
  var vs=0,nv=0;for(var i=L1-20;i<L1;i++)if(i>=0){vs+=k1.v[i];nv++;}c.rvol=nv?k1.v[L1]/(vs/nv):1;
  // YO6 MA durumu
  var iE=lastIdx(T.en,L-12),iV=lastIdx(T.vf,L-12),iS=lastIdx(T.sw,L-3);
  c.t41={enAge:iE>=0?L-iE:null,vfAge:iV>=0?L-iV:null,wait:T.wt[L],maGap:isFinite(T.ma[L])?(T.ma[L]-k.c[L])/T.ma[L]:NaN,swAge:iS>=0?L-iS:null,
    enT:iE>=0?k.t[iE]+H4:0,vfT:iV>=0?k.t[iV]+H4:0,ev:[]};
  for(i=Math.max(0,L-42);i<=L;i++){if(T.en[i])c.t41.ev.push({t:k.t[i]+H4,k:'yo6',tx:'YO6 MA AL',p:k.c[i]});else if(T.vf[i])c.t41.ev.push({t:k.t[i]+H4,k:'yo6v',tx:'YO6 VF (SMA10 bekleniyor)',p:k.c[i]});}
  // Loxx + z (1s)
  var J=jfkpsCalc(k1,{jfLen:27,jfX:15,jfSm:12,jfJLen:30,jfPh:0}),V=rVortex(k1),Z=rZ200(k1.c),s5=[];
  for(i=0;i<=L1;i++){var g=J.ev.long[i]&&V.adx[i]>0.2&&V.pl[i]>V.mi[i];s5[i]=g&&J.pst[i]>=10&&J.pst[i]<20&&Z[i]>0;}
  var i5=lastIdx(s5,L1-24);
  c.lx={ok:L1>=J.need,pst:J.pst[L1],pss:J.pss[L1],z:Z[L1],age:i5>=0?L1-i5:null,t:i5>=0?k1.t[i5]+H1:0,ev:[]};
  for(i=Math.max(0,L1-72);i<=L1;i++)if(s5[i])c.lx.ev.push({t:k1.t[i]+H1,k:'loxx',tx:'Loxx üçgen pst '+J.pst[i].toFixed(0)+' · z '+Z[i].toFixed(2),p:k1.c[i]});
  // 48 mum dibine uzaklık (ATR)
  var lo=Infinity,tr=0;for(i=L-47;i<=L;i++){if(i<1)continue;lo=Math.min(lo,k.l[i]);tr+=Math.max(k.h[i]-k.l[i],Math.abs(k.h[i]-k.c[i-1]),Math.abs(k.l[i]-k.c[i-1]));}
  var atr=tr/48,dLo=atr>0?(k.c[L]-lo)/atr:99;
  // yakınlık skoru: 0 = kurulum şimdi ateşliyor, 1 = uzak
  var r=1,why='uzak';
  var far=0.6+0.4*clamp(Math.min(isFinite(c.lx.pst)&&c.lx.ok?Math.abs(c.lx.pst-15)/85:1,dLo/12),0,1);r=far;why='uzak · dibe '+dLo.toFixed(1)+' ATR';
  function take(v,w){if(v<r){r=v;why=w;}}
  if(c.t41.enAge!=null&&c.t41.enAge<=1)take(0.02,'YO6 MA AL · '+ (c.t41.enAge?'1 mum önce':'son mum'));
  if(c.t41.wait)take(0.10+0.20*clamp((c.t41.maGap||0)/0.03,0,1),'YO6 VF ateşledi · SMA10 geri alımı bekleniyor ('+(isFinite(c.t41.maGap)?(c.t41.maGap*100).toFixed(1)+'% altında':'')+')');
  if(c.lx.ok){if(c.lx.age!=null&&c.lx.age<=1)take(0.03,'Loxx üçgen + z>0 · '+(c.lx.age?'1 mum önce':'son mum'));
    else if(c.lx.z>0&&c.lx.pst>=5&&c.lx.pst<30&&c.lx.pst<c.lx.pss)take(0.30+0.25*clamp((c.lx.pss-c.lx.pst)/10,0,1),'Loxx pst '+c.lx.pst.toFixed(0)+' bölgede · kesişim bekleniyor · z '+c.lx.z.toFixed(2));}
  if(c.t41.swAge!=null)take(0.50,'Süpürme var (filtreden geçmedi)');
  c.r=r;c.why=why;c.sec=CSEC[c.b]||'Diğer';c.dLo=dLo;}
function pulseCoin(list,B,btc){var t=B.ts[B.ts.length-1],P={mr:B.mr[t],sc:B.sc[t],bn:B.n};
  P.calm=!((isFinite(P.mr)&&P.mr<=-0.05)||(B.br[t]>=0.10));
  if(btc){var e=rEma(btc.k4.c,50),L=btc.k4.c.length-1;P.btc={c:btc.k4.c[L],e:e[L],d:(btc.k4.c[L]/e[L]-1)};}
  var up=0,n=0;list.forEach(function(c){if(c.flowUp!=null){n++;if(c.flowUp)up++;}});P.br=n?up/n:NaN;P.brN=n;
  // genişlik geçmişi (son 42 adet 4s mum)
  var hist=[];for(var q=42;q>=1;q--){var u=0,m=0;list.forEach(function(c){var f=c.flowSer,L=f.length-q;if(L>0&&isFinite(f[L])&&isFinite(f[L-1])){m++;if(f[L]>f[L-1])u++;}});hist.push(m?u/m:NaN);}
  P.brHist=hist;P.mrHist=B.ts.slice(-42).map(function(x){return B.mr[x];});P.stHist=stressHist(B,48);P.t=t+H4;return P;}
function stressHist(B,n){return B.ts.slice(-n).map(function(x){var a=isFinite(B.mr[x])?-B.mr[x]/0.05:0,b=isFinite(B.br[x])?B.br[x]/0.10:0;return {t:x,s:Math.max(0,Math.min(1.6,Math.max(a,b))),mr:B.mr[x],sc:B.sc[x]};});}

/* --- BIST taraması (sunucu Yahoo kuyruğu üzerinden) --- */
async function scanBist(){
  var syms=BIST30.concat(['XU100']),got={},tries=0;
  while(Object.keys(got).length<syms.length&&tries<6){tries++;var need=syms.filter(function(s){return !got[s];});
    for(var i=0;i<need.length;i+=10){var ch=need.slice(i,i+10);status('BIST mumları (Yahoo kuyruğu): '+Object.keys(got).length+'/'+syms.length);
      var j=await getJSON('/api/yahoo/chart?symbols='+encodeURIComponent(ch.join(','))+'&interval=1h&limit=300');
      (j.results||[]).forEach(function(r){if(r&&r.ok&&r.klines&&r.klines.length>210)got[String(r.symbol).replace(/\.IS$/,'')]=r;});}
    if(Object.keys(got).length<syms.length)await sleep(2500);}
  var xu=got.XU100?kl(got.XU100.klines,H1):null,out=[];
  BIST30.forEach(function(s){if(!got[s])return;var row=got[s],k=kl(row.klines,H1),L=k.c.length-1,Z=rZ200(k.c),fl=rFlow(k.c,k.v),ev=[],iC=-1;
    for(var i=Math.max(1,L-70);i<=L;i++)if(Z[i]>-2&&Z[i-1]<=-2){iC=i;ev.push({t:k.t[i]+H1,k:'bist',tx:'z −2 yukarı kesti ('+Z[i].toFixed(2)+')',p:k.c[i]});}
    var z=Z[L],r,why,age=iC>=0?L-iC:null;
    if(age!=null&&age<=1){r=0.02;why='z −2 yukarı kesti · '+(age?'1 mum önce':'son mum');}
    else if(z<-2){r=0.10+0.25*clamp((-2-z)/1.5,0,1);why='z '+z.toFixed(2)+' · −2 üstüne dönüş bekleniyor';}
    else if(z<-1){r=0.35+0.25*(z+2);why='z '+z.toFixed(2)+' · −2 yakınında';}
    else{r=0.6+0.4*clamp((z+1)/4,0,1);why='z '+z.toFixed(2)+' · uzak';}
    var vs=0;for(i=L-20;i<L;i++)vs+=k.v[i];var d24=isFinite(+row.chg)?+row.chg:NaN;
    out.push({k1x:k,flowSer:fl,sym:s,b:s,qv:+row.qv||k.c[L]*vs,ch:d24,k1:k,z:z,r:r,why:why,age:age,t:iC>=0?k.t[iC]+H1:0,ev:ev,rvol:vs?k.v[L]/(vs/20):1,flowUp:isFinite(fl[L])&&isFinite(fl[L-1])?fl[L]>fl[L-1]:null,sec:BSEC[s]||'Diğer'});});
  ST.bist=out;ST.xu=xu;if(out.length>=3){var BB=rBasket(out.map(function(c){return c.k1x;}),H1,xu),tl=BB.ts[BB.ts.length-1];ST.bPulse={st:stressHist(BB,48),mr:BB.mr[tl],sc:BB.sc[tl],bn:BB.n,calm:!((isFinite(BB.mr[tl])&&BB.mr[tl]<=-0.05)||BB.br[tl]>=0.10)};}}

/* --- robot (sadece okuma) --- */
function readLS(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function robot(){var cfg=readLS('qxbot_cfg_v1'),st=readLS('qxbot_state_v1'),bs=readLS('qxbot_bist_v1');
  return {coin:st?{eq:cfg&&+cfg.equity,pnl:+st.pnl||0,open:(st.open||[]),run:!!st.running}:null,bist:bs?{eq:+bs.equity,pnl:+bs.pnl||0,open:(bs.open||[])}:null};}

var LABEQ={"bist":{"n":105,"usd":26.5,"win":75.2,"dd":-25.4,"pts":[[1767684600,0.98],[1767695400,1.97],[1769423400,3.93],[1770201000,4.92],[1770816600,5.9],[1773124200,7.87],[1773138600,8.85],[1773210600,9.84],[1773315000,11.8],[1773642600,12.79],[1774272600,13.77],[1775629800,14.75],[1775651400,16.72],[1775802600,17.7],[1775817000,18.69],[1776061800,20.66],[1776148200,21.64],[1776173400,22.62],[1776429000,24.59],[1776432600,25.57],[1778567400,26.56],[1779690600,28.52],[1779690600,29.51],[1780381800,30.49],[1781159400,32.46],[1781245800,33.44],[1781249400,34.43],[1781505000,36.39],[1781505000,37.38],[1782984600,38.36],[1783060200,39.34],[1783337400,38.73],[1783409400,39.71],[1783503000,38.57],[1784017800,37.95],[1784017800,38.93],[1784622600,39.91],[1785936600,41.88],[1786012200,42.86],[1786534200,43.85],[1786714200,45.82],[1787308200,46.8],[1787553000,47.78],[1787837400,44.52],[1787837400,45.5],[1788762600,46.49],[1788877800,48.46],[1789115400,49.44],[1789464600,46.6],[1789543800,39.18],[1789565400,34.17],[1789644600,35.15],[1789651800,36.13],[1789741800,38.1],[1789993800,39.08],[1789997400,40.07],[1790069400,42.04],[1790076600,43.02],[1790076600,44.0],[1790145000,45.97],[1790152200,46.95],[1790163000,47.94],[1790922600,49.9],[1791185400,50.89],[1791268200,51.87],[1792162800,44.56],[1792162800,44.48],[1792162800,42.77],[1792162800,42.62],[1792162800,40.41],[1792162800,40.38],[1792162800,37.12],[1792162800,34.67],[1792162800,34.15],[1792162800,34.07],[1792162800,30.83],[1792162800,27.48],[1792162800,27.59],[1792162800,26.88],[1792162800,26.46]],"t0":1767335400},"loxx":{"n":48,"usd":105.9,"win":60.4,"dd":-40.0,"pts":[[1769864400,-5.01],[1769882400,-6.68],[1770303600,-7.49],[1774584000,-12.5],[1776319200,-9.26],[1776373200,-8.2],[1776441600,-4.81],[1777050000,-2.97],[1777150800,-0.29],[1777633200,3.13],[1779526800,0.98],[1780441200,-0.39],[1780538400,-2.18],[1780538400,-5.31],[1780686000,-10.33],[1780718400,-15.34],[1780722000,-17.42],[1781125200,-19.14],[1782316800,-20.93],[1782392400,-25.95],[1782522000,-20.51],[1785193200,-23.2],[1785294000,-28.22],[1785294000,-33.23],[1786453200,-31.88],[1786568400,-36.89],[1788206400,-30.0],[1789765200,-20.12],[1790229600,-11.2],[1790355600,-6.85],[1790384400,-0.04],[1790395200,11.46],[1790398800,16.34],[1790449200,17.88],[1790492400,27.15],[1790499600,36.4],[1790506800,46.28],[1792314000,49.07],[1792314000,48.32],[1792314000,55.24],[1792314000,61.91],[1792314000,75.58],[1792314000,77.79],[1792314000,77.86],[1792314000,91.37],[1792314000,97.12],[1792314000,103.53],[1792314000,105.88]],"t0":1767286800},"yo6":{"n":203,"usd":80.1,"win":65.0,"dd":-10.1,"pts":[[1768392000,1.28],[1768435200,4.89],[1768449600,6.68],[1768449600,9.41],[1769184000,9.87],[1769184000,7.66],[1769184000,6.64],[1769889600,4.2],[1770206400,0.7],[1770537600,1.25],[1770552000,1.93],[1770552000,1.82],[1770552000,2.71],[1770552000,2.94],[1770552000,2.56],[1771761600,1.77],[1772121600,6.92],[1772121600,9.7],[1772150400,18.21],[1772150400,23.15],[1772150400,23.89],[1772179200,28.4],[1774425600,30.52],[1774425600,32.95],[1774425600,33.69],[1774425600,36.59],[1774425600,37.34],[1774425600,38.55],[1774425600,40.88],[1774425600,42.53],[1775001600,43.61],[1775001600,44.41],[1775001600,44.99],[1775001600,44.85],[1780156800,45.95],[1780200000,47.05],[1780200000,47.8],[1780228800,46.29],[1780228800,45.15],[1780300800,45.75],[1780761600,40.26],[1780948800,43.45],[1780948800,43.41],[1780948800,46.2],[1780963200,46.76],[1780963200,47.59],[1780963200,49.77],[1780963200,50.09],[1780963200,51.72],[1780963200,51.3],[1780992000,53.9],[1782489600,53.41],[1782504000,54.87],[1782604800,55.22],[1783036800,56.23],[1783080000,58.55],[1783080000,60.57],[1784721600,59.46],[1784750400,61.03],[1785470400,59.33],[1785542400,59.66],[1785571200,58.83],[1785585600,59.03],[1785600000,58.67],[1785816000,58.72],[1786953600,58.28],[1786982400,58.1],[1789761600,62.12],[1789776000,73.26],[1791676800,73.38],[1791691200,79.46],[1791691200,79.39],[1791748800,79.8],[1791748800,83.37],[1791763200,84.13],[1792065600,85.46],[1792108800,85.34],[1792108800,82.34],[1792108800,81.3],[1792108800,80.07]],"t0":1768219200}};
/* ================= v2 arayüz ================= */
function fmtAge(ms){var m=Math.max(0,Math.round(ms/6e4));if(m<60)return m+' dk';var h=Math.floor(m/60);if(h<48)return h+' sa';return Math.floor(h/24)+' gün';}
function fmtT(t){return new Date(t).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function pct(x,d){return isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(d==null?1:d)+'%':'—';}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function chartUrlS(mode,sym){return '/quantex.html?v=124#ac='+mode+':'+encodeURIComponent(sym);}
function chartUrl(c){return chartUrlS(ST.mode==='bist'?'bist':'coin',c.sym);}
function cur(){return ST.mode==='bist'?ST.bist:ST.coins;}
function hidpi(cv){var dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}var g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);return {g:g,w:w,h:h};}
/* sayı animasyonu */
var NUMS=new WeakMap();
function num(el,val,fmt){if(!el)return;var o=NUMS.get(el),from=o&&isFinite(o.v)?o.v:0;NUMS.set(el,{v:val});if(!isFinite(val)){el.textContent='—';return;}
  var t0=performance.now();(function step(t){var k=Math.min(1,(t-t0)/800),e=1-Math.pow(1-k,3);el.textContent=fmt(from+(val-from)*e);if(k<1)requestAnimationFrame(step);})(t0);}
/* düzen: sektör açıları */
var LAY={dots:[],secs:[]};
function layout(){var list=cur().slice(),secs={};list.forEach(function(c){(secs[c.sec]=secs[c.sec]||[]).push(c);});
  var names=Object.keys(secs).sort(function(a,b){if(a==='Diğer')return 1;if(b==='Diğer')return -1;return a.localeCompare(b,'tr');}),tot=list.length||1,a0=-Math.PI/2,out=[],gap=0.07,S2=[];
  names.forEach(function(nm){var arr=secs[nm].sort(function(a,b){return a.b.localeCompare(b.b);}),span=(2*Math.PI-gap*names.length)*arr.length/tot;S2.push({nm:nm,a0:a0,a1:a0+span,n:arr.length});
    arr.forEach(function(c,i){out.push({c:c,a:a0+span*(i+0.5)/arr.length});});a0+=span+gap;});
  var top=list.slice().sort(function(a,b){return b.qv-a.qv;}).slice(0,5).map(function(c){return c.sym;});out.forEach(function(d){d.top=top.indexOf(d.c.sym)>=0;});
  LAY={dots:out,secs:S2};}
/* ---------- HERO: 3D galaksi / 2D yedek ---------- */
var G={api:null,mode:'?',want:'auto',reason:''};
function webglOK(){try{var c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}catch(e){return false;}}
function lowPower(){var n=navigator,c=n.connection||{};return !!(c.saveData||(n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency&&n.hardwareConcurrency<=2));}
async function heroInit(){var host=$('hero3d');var use3d=G.want==='3d'||(G.want==='auto'&&webglOK()&&!lowPower());
  if(G.api&&G.mode==='3d'&&use3d){heroUpdate();return;}
  if(G.api&&G.mode==='3d'&&!use3d){G.api.dispose();G.api=null;}
  if(use3d){try{status2('3D motor yükleniyor (three.js)…');var M=await import('/radar3d.js?v=2');
      G.api=M.create(host,{lite:innerWidth<700,capture:/capture=1/.test(location.search),onHover:hoverTip,onClick:function(c){window.open(chartUrl(c),'_blank');}});G.mode='3d';$('hero2d').style.display='none';window.RD3=G.api;heroUpdate();return;}
    catch(e){console.warn('3D yüklenemedi, 2D radar',e);G.reason='WebGL/three.js yüklenemedi';}}
  else G.reason=webglOK()?'düşük güç modu':'WebGL yok';
  G.mode='2d';$('hero2d').style.display='block';R2.start();}
function heroUpdate(){layout();var L=cur(),f=L.filter(function(c){return c.r<0.05;}).length,n=L.filter(function(c){return c.r<0.35;}).length;
  if(G.mode==='3d'&&G.api)G.api.update(LAY.dots,{sectors:LAY.secs,fire:f,near:n,histLen:48});
  num($('hFire'),f,function(v){return Math.round(v);});num($('hNear'),n,function(v){return Math.round(v);});num($('hTot'),L.length,function(v){return Math.round(v);});
  $('hMode').textContent=(G.mode==='3d'?'3D · WebGL':'2D radar'+(G.reason?' ('+G.reason+')':''))+' · '+(ST.mode==='bist'?'BIST 30 · 1s · yarıçap = z200’ün −2’ye uzaklığı':'Coin vadeli · yarıçap = YO6 MA / Loxx kurulumuna uzaklık');}
function hoverTip(c,ev){var t=$('rdTip');if(!c){t.style.display='none';return;}var b=$('hero').getBoundingClientRect();
  var rows=['<b>'+esc(c.b)+'</b> <span class="mut">'+esc(c.sec)+'</span>','<span class="y">'+esc(c.why)+'</span>',
   'yakınlık <b>'+(1-c.r).toFixed(2)+'</b> · RVOL <b>'+(isFinite(c.rvol)?c.rvol.toFixed(2):'—')+'×</b>','24s <b class="'+(c.ch>=0?'g':'r')+'">'+(isFinite(c.ch)?(c.ch>=0?'+':'')+c.ch.toFixed(2)+'%':'—')+'</b> · OBV akışı '+(c.flowUp==null?'—':c.flowUp?'<b class="g">▲</b>':'<b class="r">▼</b>')];
  if(ST.mode==='coin'&&c.lx)rows.push('Loxx pst '+(c.lx.ok&&isFinite(c.lx.pst)?c.lx.pst.toFixed(0):'—')+' / pss '+(c.lx.ok&&isFinite(c.lx.pss)?c.lx.pss.toFixed(0):'—')+' · z200 '+(isFinite(c.lx.z)?c.lx.z.toFixed(2):'—'));
  if(ST.mode==='bist')rows.push('z200 (1s) <b>'+(isFinite(c.z)?c.z.toFixed(2):'—')+'</b>');
  rows.push('<span class="mut">tıkla → QUANTEX grafiği</span>');t.innerHTML=rows.join('<br>');t.style.display='block';
  var x=ev.clientX-b.left+16,y=ev.clientY-b.top+16;if(x>b.width-250)x-=270;if(y>b.height-140)y-=150;t.style.left=x+'px';t.style.top=y+'px';}
/* 2D yedek radar (v1) */
var R2={on:false,ang:0,last:0,start:function(){if(this.on)return;this.on=true;var cv=$('hero2d');cv.addEventListener('mousemove',function(e){var d=R2.hit(e);R2.hover=d;cv.style.cursor=d?'pointer':'default';hoverTip(d&&d.c,e);});
  cv.addEventListener('click',function(e){var d=R2.hit(e);if(d)window.open(chartUrl(d.c),'_blank');});requestAnimationFrame(R2.draw);},
 hit:function(e){var b=$('hero2d').getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,best=null,bd=1e9;LAY.dots.forEach(function(d){var q=Math.hypot(d.x-x,d.y-y);if(q<Math.max(12,d.sz+6)&&q<bd){bd=q;best=d;}});return best;},
 draw:function(ts){if(G.mode!=='2d'){R2.on=false;return;}if(document.hidden){requestAnimationFrame(R2.draw);return;}var X=hidpi($('hero2d')),g=X.g,W=X.w,H=X.h,cx=W/2,cy=H/2,R=Math.min(W,H)/2-40,dt=R2.last?ts-R2.last:16;R2.last=ts;R2.ang=(R2.ang+dt*2*Math.PI/7000)%(2*Math.PI);
  g.clearRect(0,0,W,H);[0.25,0.5,0.75,1].forEach(function(q){g.strokeStyle='rgba(0,255,170,'+(q===0.25?0.35:0.14)+')';g.beginPath();g.arc(cx,cy,R*q,0,2*Math.PI);g.stroke();});
  LAY.secs.forEach(function(s){var am=(s.a0+s.a1)/2;g.fillStyle='#7dd3fc';g.font='bold 10px ui-monospace,monospace';g.textAlign='center';g.fillText(s.nm+' '+s.n,cx+Math.cos(am)*(R+20),cy+Math.sin(am)*(R+20));g.textAlign='left';});
  for(var q=0;q<24;q++){var a1=R2.ang-q*0.9/24,a2=R2.ang-(q+1)*0.9/24;g.fillStyle='rgba(0,255,170,'+(0.16*(1-q/24))+')';g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,R,a2,a1);g.closePath();g.fill();}
  var ph=(ts%1600)/1600;LAY.dots.forEach(function(d){var rr=R*(0.04+0.96*clamp(d.c.r,0,1));d.x=cx+Math.cos(d.a)*rr;d.y=cy+Math.sin(d.a)*rr;d.sz=3+6*Math.sqrt(clamp(d.c.rvol||1,0.2,6)/6);
    var since=((R2.ang-((d.a%(2*Math.PI))+2*Math.PI)%(2*Math.PI))+4*Math.PI)%(2*Math.PI),gl=Math.exp(-since/1.2),col=d.c.flowUp==null?'160,160,160':d.c.flowUp?'0,255,170':'255,50,120';
    g.shadowColor='rgba('+col+',1)';g.shadowBlur=4+18*gl;g.fillStyle='rgba('+col+','+(0.45+0.55*gl)+')';g.beginPath();g.arc(d.x,d.y,d.sz,0,2*Math.PI);g.fill();g.shadowBlur=0;
    if(d.c.r<0.05){g.strokeStyle='rgba(255,230,0,'+(0.9-0.6*ph)+')';g.lineWidth=2;g.beginPath();g.arc(d.x,d.y,d.sz+3+5*ph,0,2*Math.PI);g.stroke();g.lineWidth=1;}
    if(d.c.r<0.5||d.top){g.fillStyle='#e6fff6';g.font='10px ui-monospace,monospace';g.fillText(d.c.b,d.x+d.sz+3,d.y+3);}});
  requestAnimationFrame(R2.draw);}};
/* ---------- NABIZ: EKG ---------- */
var ECG={hist:[],head:0,last:0};
function pulseData(){if(ST.mode==='bist'){var b=ST.bPulse;return b?{st:b.st,mr:b.mr,sc:b.sc,bn:b.bn,calm:b.calm,tf:'1s'}:null;}var P=ST.pulse;return P?{st:P.stHist,mr:P.mr,sc:P.sc,bn:P.bn,calm:P.calm,tf:'4s'}:null;}
function ecgDraw(ts){requestAnimationFrame(ecgDraw);if(document.hidden)return;var cv=$('ecg');if(!cv)return;var X=hidpi(cv),g=X.g,W=X.w,H=X.h,P=pulseData();
  var dt=ECG.last?Math.min(100,ts-ECG.last):16;ECG.last=ts;ECG.head=(ECG.head+dt/6500)%1;g.clearRect(0,0,W,H);
  g.strokeStyle='rgba(0,255,170,.07)';g.lineWidth=1;for(var x=0;x<W;x+=12){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(var y=0;y<H;y+=12){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
  if(!P||!P.st.length)return;var n=P.st.length,bw=W/n,base=H*0.62,amp=H*0.55;
  var thY=base-amp*(1/1.6);g.strokeStyle='rgba(255,230,0,.35)';g.setLineDash([4,4]);g.beginPath();g.moveTo(0,thY);g.lineTo(W,thY);g.stroke();g.setLineDash([]);
  g.fillStyle='rgba(255,230,0,.6)';g.font='9px ui-monospace,monospace';g.fillText('eşik = sakin değil',4,thY-3);
  function yAt(xp){var i=Math.floor(xp/bw);if(i<0||i>=n)return base;var u=(xp-i*bw)/bw,s=P.st[i].s,A=0.06+0.94*s/1.6;var v=0;
    v+=0.10*A*Math.exp(-Math.pow((u-0.22)/0.05,2));v-=0.18*A*Math.exp(-Math.pow((u-0.42)/0.018,2));v+=1.0*A*Math.exp(-Math.pow((u-0.47)/0.022,2));v-=0.28*A*Math.exp(-Math.pow((u-0.52)/0.02,2));v+=0.22*A*Math.exp(-Math.pow((u-0.72)/0.07,2));return base-amp*v;}
  var hx=ECG.head*W,gap=26;
  for(var pass=0;pass<2;pass++){g.beginPath();var started=false;for(var px=0;px<=W;px+=1.5){var vis=pass===0?px<=hx:px>hx+gap;if(!vis){started=false;continue;}var yy=yAt(px);if(!started){g.moveTo(px,yy);started=true;}else g.lineTo(px,yy);}
    var hot=P.st[n-1].s>=1;g.strokeStyle=pass===0?(hot?'#ffe600':'#00ffaa'):'rgba(0,255,170,.35)';g.lineWidth=pass===0?2:1.4;g.shadowColor=hot?'#ffe600':'#00ffaa';g.shadowBlur=pass===0?10:0;g.stroke();g.shadowBlur=0;}
  // stres > eşik olan mumları işaretle
  for(var i=0;i<n;i++)if(P.st[i].s>=1){g.fillStyle='rgba(255,60,90,.18)';g.fillRect(i*bw,0,bw,H);}
  g.fillStyle='#fff';g.shadowColor='#00ffaa';g.shadowBlur=14;g.beginPath();g.arc(hx,yAt(hx),2.6,0,7);g.fill();g.shadowBlur=0;}
/* ---------- panel çizimleri ---------- */
function renderPulse(){var P=pulseData(),L=cur();var s=P&&P.st.length?P.st[P.st.length-1].s:NaN;
  num($('pStress'),s*100/1.6,function(v){return Math.round(v);});$('pState').className='state '+(P&&!P.calm?'hot':'calm');$('pState').textContent=!P?'veri bekleniyor':P.calm?'SAKİN · YO6 filtresi kapalı':'SAKİN DEĞİL · YO6 sinyalleri açık';
  $('pEcgLbl').textContent='her atım = bir '+(P?P.tf:'')+' mumu (son '+(P?P.st.length:0)+') · genlik = stres (24s medyan getiri / −5% veya süpüren oranı / %10, hangisi büyükse)';
  num($('pMr'),P?P.mr*100:NaN,function(v){return (v>=0?'+':'')+v.toFixed(2)+'%';});$('pMr').className=P&&P.mr<0?'r':'g';
  num($('pSc'),P?P.sc:NaN,function(v){return Math.round(v)+'/'+(P?P.bn:0);});
  var up=0,nn=0;L.forEach(function(c){if(c.flowUp!=null){nn++;if(c.flowUp)up++;}});num($('pBr'),nn?100*up/nn:NaN,function(v){return Math.round(v)+'%';});
  if(ST.mode==='coin'&&ST.pulse&&ST.pulse.btc){var b=ST.pulse.btc;$('pBtcRow').style.display='';num($('pBtc'),b.d*100,function(v){return (v>=0?'ÜSTÜNDE +':'ALTINDA ')+v.toFixed(2)+'%';});$('pBtc').className=b.d>=0?'g':'r';}else $('pBtcRow').style.display='none';
  // sektör derinliği (emir defteri tarzı)
  var S={};L.forEach(function(c){var o=S[c.sec]=S[c.sec]||{u:0,d:0,n:0};o.n++;if(c.flowUp===true)o.u++;else if(c.flowUp===false)o.d++;});
  var ks=Object.keys(S).sort(function(a,b){return S[b].n-S[a].n;}),mx=1;ks.forEach(function(k){mx=Math.max(mx,S[k].u,S[k].d);});
  $('pDepth').innerHTML=ks.map(function(k){var o=S[k];return '<div class="dr"><span class="dd"><i style="width:'+(100*o.d/mx)+'%"></i><b>'+o.d+'</b></span><span class="dn">'+esc(k)+'</span><span class="du"><i style="width:'+(100*o.u/mx)+'%"></i><b>'+o.u+'</b></span></div>';}).join('');
  // ısı şeridi
  var hs=L.slice().sort(function(a,b){return a.sec===b.sec?b.qv-a.qv:a.sec.localeCompare(b.sec,'tr');});
  $('pHeat').innerHTML=hs.map(function(c){var v=c.ch,a=clamp(Math.abs(v)/8,0.15,1),col=v>=0?'0,255,140':'255,40,110';return '<a href="'+chartUrl(c)+'" target="_blank" title="'+esc(c.b+' '+(isFinite(v)?v.toFixed(2)+'%':'—')+' · '+c.sec)+'" style="background:rgba('+col+','+a+');box-shadow:0 0 '+(6*a)+'px rgba('+col+','+a+')"></a>';}).join('');
  $('pHeatLbl').textContent='Isı şeridi · '+(ST.mode==='bist'?'günlük':'24s')+' değişim';}
function eqSpark(cv,E){var X=hidpi(cv),g=X.g,w=X.w,h=X.h;g.clearRect(0,0,w,h);var p=E.pts,t0=E.t0,t1=p[p.length-1][0],mn=0,mx=0;p.forEach(function(q){mn=Math.min(mn,q[1]);mx=Math.max(mx,q[1]);});
  var Xf=function(t){return 2+(w-4)*(t-t0)/Math.max(1,t1-t0);},Yf=function(v){return h-3-(h-6)*(v-mn)/Math.max(1e-9,mx-mn);};
  g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.moveTo(0,Yf(0));g.lineTo(w,Yf(0));g.stroke();
  var gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,255,170,.35)');gr.addColorStop(1,'rgba(0,255,170,0)');g.beginPath();g.moveTo(Xf(t0),Yf(0));p.forEach(function(q){g.lineTo(Xf(q[0]),Yf(q[1]));});g.lineTo(Xf(t1),Yf(0));g.closePath();g.fillStyle=gr;g.fill();
  g.beginPath();g.moveTo(Xf(t0),Yf(0));p.forEach(function(q){g.lineTo(Xf(q[0]),Yf(q[1]));});g.strokeStyle='#00ffaa';g.lineWidth=1.6;g.shadowColor='#00ffaa';g.shadowBlur=8;g.stroke();g.shadowBlur=0;
  g.fillStyle='rgba(214,255,242,.55)';g.font='9px ui-monospace,monospace';g.fillText('lab · Oca→Eki 2026',4,10);g.textAlign='right';g.fillText('+$'+E.usd,w-3,10);g.textAlign='left';}
function renderPort(){var now=Date.now(),cs=ST.coins,bs=ST.bist,b=[],l=[],y=[],w=[],bn=0,ln=0;
  bs.forEach(function(c){c.ev.forEach(function(e){if(now-e.t<=72*H1)b.push({s:c.b,d:e.tx.replace('z −2 yukarı kesti','−2 kesti')+' · şimdi '+c.z.toFixed(2),t:e.t,u:chartUrlS('bist',c.sym)});});if(c.z<-2)bn++;});
  cs.forEach(function(c){c.lx.ev.forEach(function(e){if(now-e.t<=72*H1)l.push({s:c.b,d:'pst '+(isFinite(c.lx.pst)?c.lx.pst.toFixed(0):'—')+' · z '+(isFinite(c.lx.z)?c.lx.z.toFixed(2):'—'),t:e.t,u:chartUrlS('coin',c.sym)});});
    if(c.lx.ok&&c.lx.z>0&&c.lx.pst>=5&&c.lx.pst<30&&c.lx.pst<c.lx.pss)ln++;
    if(c.t41.enAge!=null&&c.t41.enAge<12)y.push({s:c.b,d:'AL · '+c.t41.enAge+' mum',t:c.t41.enT,u:chartUrlS('coin',c.sym)});
    if(c.t41.wait)w.push({s:c.b,d:'SMA10 '+(c.t41.maGap*100).toFixed(1)+'% yukarıda',t:c.t41.vfT,u:chartUrlS('coin',c.sym)});});
  [b,l,y,w].forEach(function(a){a.sort(function(p,q){return q.t-p.t;});});
  function light(on,near){return on?'<i class="lt on" title="aktif sinyal var"></i>':near?'<i class="lt nr" title="kuruluma yakın sembol var"></i>':'<i class="lt" title="boşta"></i>';}
  function rows(a,e){return a.length?a.slice(0,3).map(function(x){return '<a class="sig" href="'+x.u+'" target="_blank"><b>'+esc(x.s)+'</b><span>'+esc(x.d)+'</span><em>'+fmtAge(now-x.t)+'</em></a>';}).join(''):'<div class="mut sm0">'+e+'</div>';}
  function card(key,L,on,near,cnt,list,empty,id){var E=LABEQ[key];return '<div class="leg glass">'+'<div class="lh">'+light(on,near)+'<h4>'+L.nm+'</h4><small>'+L.tf+'</small></div>'+
    '<div class="bdg"><span>PF <b>'+L.pf+'</b></span><span>rastgele '+L.rnd+'</span><span>'+E.n+' işlem</span><span>kazanma %'+E.win+'</span><span>en kötü DD $'+E.dd+'</span></div>'+
    '<canvas class="eq" id="'+id+'"></canvas><div class="cnt">'+cnt+'</div>'+rows(list,empty)+'</div>';}
  $('rdPort').innerHTML=card('bist',LAB.bist,b.some(function(x){return now-x.t<=24*H1;}),bn>0,'son 72 sa: <b>'+b.length+'</b> sinyal · z<−2 bekleyen: <b>'+bn+'</b>',b,bs.length?'son 72 saatte sinyal yok':'BIST verisi yok','eqB')+
    card('loxx',LAB.loxx,l.some(function(x){return now-x.t<=3*H1;}),ln>0,'son 72 sa: <b>'+l.length+'</b> sinyal · kesişim bekleyen: <b>'+ln+'</b>',l,'son 72 saatte sinyal yok','eqL')+
    card('yo6',LAB.yo6,y.length>0,w.length>0,'aktif AL: <b>'+y.length+'</b> · SMA10 bekleyen VF: <b>'+w.length+'</b>',y.concat(w),'aktif AL yok','eqY')+
    '<div class="mut sm">Rozet + eğri: lab testi 2026-01-01→10-18, $10 marj, 2x, %0.04 komisyon, sonraki mum açılışı (kapanış sırasıyla birikimli $). Işık: yeşil = aktif sinyal, amber = yakın aday, sönük = boşta.</div>';
  eqSpark($('eqB'),LABEQ.bist);eqSpark($('eqL'),LABEQ.loxx);eqSpark($('eqY'),LABEQ.yo6);}
/* ---------- NEHİR: 72 saatlik sinyal zaman çizgisi ---------- */
var RV={ev:[],hot:null,last:0};
var LANES=[['yo6','YO6 MA AL','#00ffaa'],['yo6v','YO6 VF','#7dd3fc'],['loxx','Loxx üçgen','#c084fc'],['bist','BIST z−2','#ffe600']];
function riverData(){var all=[];ST.coins.forEach(function(c){c.t41.ev.concat(c.lx.ev).forEach(function(e){all.push({s:c.b,e:e,u:chartUrlS('coin',c.sym)});});});
  ST.bist.forEach(function(c){c.ev.forEach(function(e){all.push({s:c.b,e:e,u:chartUrlS('bist',c.sym)});});});
  var first=!ST.lastAt;all.forEach(function(x){var id=x.s+'|'+x.e.k+'|'+x.e.t;if(!ST.seen[id])ST.seen[id]=first?1:2;x.nw=ST.seen[id]===2;});
  RV.ev=all.filter(function(x){return Date.now()-x.e.t<=72*H1;});var c={};RV.ev.forEach(function(x){c[x.e.k]=(c[x.e.k]||0)+1;});RV.cnt=c;
  $('rvN').textContent=RV.ev.length+' sinyal / 72 sa'+(RV.ev.some(function(x){return x.nw;})?' · YENİ var':'');}
function riverDraw(ts){requestAnimationFrame(riverDraw);if(document.hidden)return;var cv=$('river');if(!cv)return;var X=hidpi(cv),g=X.g,W=X.w,H=X.h,now=Date.now(),t0=now-72*H1,lx=92,Wd=W-lx-14,lh=(H-18)/LANES.length;
  g.clearRect(0,0,W,H);var T=ts/1000;
  for(var h=0;h<=72;h+=6){var t=now-h*H1,x=lx+Wd*(t-t0)/(72*H1);g.strokeStyle='rgba(125,211,252,'+(h%24===0?0.18:0.07)+')';g.beginPath();g.moveTo(x,0);g.lineTo(x,H-14);g.stroke();
    if(h%12===0){g.fillStyle='rgba(125,211,252,.55)';g.font='9px ui-monospace,monospace';g.textAlign='center';g.fillText(h?'-'+h+'sa':'şimdi',x,H-3);g.textAlign='left';}}
  LANES.forEach(function(L,i){var y=lh*i+lh/2;var gr=g.createLinearGradient(lx,0,lx+Wd,0),o=((T*0.08)%1);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(Math.max(0,o-0.05),'rgba(255,255,255,0)');gr.addColorStop(o,L[2]+'55');gr.addColorStop(Math.min(1,o+0.05),'rgba(255,255,255,0)');gr.addColorStop(1,'rgba(255,255,255,0)');
    g.strokeStyle=L[2]+'30';g.lineWidth=1;g.beginPath();g.moveTo(lx,y);g.lineTo(lx+Wd,y);g.stroke();g.strokeStyle=gr;g.lineWidth=3;g.beginPath();g.moveTo(lx,y);g.lineTo(lx+Wd,y);g.stroke();g.lineWidth=1;
    g.fillStyle=L[2];g.font='bold 10px ui-monospace,monospace';g.fillText(L[1],6,y-1);g.fillStyle='rgba(214,255,242,.5)';g.font='9px ui-monospace,monospace';g.fillText((RV.cnt&&RV.cnt[L[0]]||0)+' sinyal',6,y+10);});
  var nx=lx+Wd,ph=(T%2)/2;g.strokeStyle='rgba(255,230,0,'+(0.7-0.5*ph)+')';g.beginPath();g.moveTo(nx,0);g.lineTo(nx,H-14);g.stroke();
  // aynı şerit+zaman çakışmalarını dikey yay
  var occ={};RV.ev.forEach(function(x){var li=LANES.findIndex(function(L){return L[0]===x.e.k;});if(li<0)return;var px=lx+Wd*(x.e.t-t0)/(72*H1),key=li+'|'+Math.round(px/6),k=occ[key]=(occ[key]||0)+1,per=Math.max(1,Math.floor((lh-6)/5)),row=(k-1)%per,col=Math.floor((k-1)/per);
    x.px=px+col*5;x.py=lh*li+lh/2+((row%2?1:-1)*Math.ceil(row/2))*5;var col=LANES[li][2],r=x.nw?4.5:3.2,pul=x.nw?1+0.4*Math.sin(T*5):1;g.shadowColor=col;g.shadowBlur=12;g.fillStyle=col;g.beginPath();g.arc(x.px,x.py,r*pul,0,7);g.fill();g.shadowBlur=0;
    if(RV.hot===x){g.strokeStyle='#fff';g.beginPath();g.arc(x.px,x.py,r+4,0,7);g.stroke();}});}
function riverHit(e){var b=$('river').getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,best=null,bd=10;RV.ev.forEach(function(v){if(v.px==null)return;var d=Math.hypot(v.px-x,v.py-y);if(d<bd){bd=d;best=v;}});return best;}
/* ---------- robot (salt okuma) ---------- */
function renderRobot(){var R=robot();
  function blk(nm,x,cu){if(!x)return '<div class="rb glass"><h5>'+nm+'</h5><div class="mut">bu tarayıcıda kayıt yok</div></div>';
    var op=x.open.slice(0,6).map(function(p){var s=p.sym||p.symbol||'?',sd=p.side||'L',e=+(p.entry||p.price||0);return '<span class="op">'+esc(String(s).replace(/USDT$/,''))+' '+esc(sd)+(e?' @'+e.toPrecision(5):'')+'</span>';}).join('');
    return '<div class="rb glass"><h5>'+nm+(x.run?' <small class="g">● çalışıyor</small>':'')+'</h5><div class="kv"><span>Bakiye</span><b>'+(isFinite(x.eq)?x.eq.toLocaleString('tr-TR')+cu:'—')+'</b></div><div class="kv"><span>Gerçekleşen K/Z</span><b class="'+(x.pnl>=0?'g':'r')+'">'+x.pnl.toLocaleString('tr-TR',{maximumFractionDigits:2})+cu+'</b></div><div class="kv"><span>Açık pozisyon</span><b>'+x.open.length+'</b></div><div>'+op+'</div></div>';}
  $('rdRobot').innerHTML=blk('Kağıt robot · Coin',R.coin,' $')+blk('Kağıt robot · BIST',R.bist,' ₺');}
/* ---------- üst bar: saat + BTC ---------- */
function clock(){$('tClock').textContent=new Date().toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' TSİ';}
var BTC={p:NaN};
async function btcTick(){if(document.hidden)return;try{var j=await getJSON('/api/fapi/v1/ticker/24hr?symbol=BTCUSDT'),p=+j.lastPrice,ch=+j.priceChangePercent,el=$('tBtc');
  if(isFinite(BTC.p)&&p!==BTC.p){el.classList.remove('fu','fd');void el.offsetWidth;el.classList.add(p>BTC.p?'fu':'fd');}BTC.p=p;
  el.innerHTML='BTC <b>'+p.toLocaleString('tr-TR',{maximumFractionDigits:1})+'</b> <span class="'+(ch>=0?'g':'r')+'">'+(ch>=0?'+':'')+ch.toFixed(2)+'%</span>';}catch(e){}}
function status2(t){var e=$('rdStatus');if(e)e.textContent=t;}
status=function(t){status2(t);var m=/(\d+)\/(\d+)/.exec(t);if(m)$('tProg').style.width=(100*m[1]/m[2])+'%';};
function renderAll(){heroUpdate();renderPulse();renderPort();riverData();renderRobot();}
async function refresh(){if(ST.busy)return;ST.busy=true;ST.err=[];$('rdBtn').disabled=true;$('tScan').classList.add('on');var t0=Date.now();
  try{if(ST.mode==='coin'||!ST.coins.length)await scanCoins(+($('rdN').value)||50);renderAll();
    try{await scanBist();}catch(e){ST.err.push('BIST: '+(e.message||e));}
    renderAll();ST.lastAt=Date.now();status2('Güncellendi '+fmtT(ST.lastAt)+' · '+((Date.now()-t0)/1000).toFixed(0)+' sn · '+ST.req+' istek'+(ST.err.length?' · '+ST.err.length+' hata':''));$('tProg').style.width='100%';
    if(ST.err.length)console.warn('radar hatalar',ST.err);}catch(e){status2('Hata: '+(e.message||e));console.error(e);}
  ST.busy=false;$('rdBtn').disabled=false;$('tScan').classList.remove('on');window.QX_RADAR_READY=true;}
function setMode(m){ST.mode=m;document.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-mode')===m);});if(cur().length)renderAll();}
window.addEventListener('DOMContentLoaded',function(){
  var q=/[?&]view=(2d|3d)/.exec(location.search);if(q)G.want=q[1];
  $('rdBtn').onclick=refresh;document.querySelectorAll('[data-mode]').forEach(function(b){b.onclick=function(){setMode(b.getAttribute('data-mode'));};});
  $('vBtn').onclick=function(){G.want=G.mode==='3d'?'2d':'3d';if(G.want==='2d'&&G.api){G.api.dispose();G.api=null;G.mode='?';}heroInit();$('vBtn').textContent=G.want==='3d'?'2D radar':'3D galaksi';};
  var rv=$('river');rv.addEventListener('mousemove',function(e){var h=riverHit(e);RV.hot=h;rv.style.cursor=h?'pointer':'default';var t=$('rvTip');if(!h){t.style.display='none';return;}var b=rv.getBoundingClientRect();t.innerHTML='<b>'+esc(h.s)+'</b> '+esc(h.e.tx)+'<br><span class="mut">'+fmtT(h.e.t)+' TSİ · '+fmtAge(Date.now()-h.e.t)+' önce</span>';t.style.display='block';t.style.left=Math.min(b.width-240,e.clientX-b.left+12)+'px';t.style.top=(e.clientY-b.top-46)+'px';});
  rv.addEventListener('mouseleave',function(){RV.hot=null;$('rvTip').style.display='none';});rv.addEventListener('click',function(e){var h=riverHit(e);if(h)window.open(h.u,'_blank');});
  clock();setInterval(clock,1000);btcTick();setInterval(btcTick,15000);
  heroInit();requestAnimationFrame(ecgDraw);requestAnimationFrame(riverDraw);renderRobot();refresh();setInterval(refresh,15*60*1000);setInterval(renderRobot,30000);window.QX_RADAR=ST;});
})();
