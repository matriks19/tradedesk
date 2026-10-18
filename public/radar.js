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
  ST.coins=out;ST.pulse=pulseCoin(out,B,btc);}
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
  P.brHist=hist;P.mrHist=B.ts.slice(-42).map(function(x){return B.mr[x];});P.t=t+H4;return P;}

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
    out.push({sym:s,b:s,qv:+row.qv||k.c[L]*vs,ch:d24,k1:k,z:z,r:r,why:why,age:age,t:iC>=0?k.t[iC]+H1:0,ev:ev,rvol:vs?k.v[L]/(vs/20):1,flowUp:isFinite(fl[L])&&isFinite(fl[L-1])?fl[L]>fl[L-1]:null,sec:BSEC[s]||'Diğer'});});
  ST.bist=out;ST.xu=xu;}

/* --- robot (sadece okuma) --- */
function readLS(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function robot(){var cfg=readLS('qxbot_cfg_v1'),st=readLS('qxbot_state_v1'),bs=readLS('qxbot_bist_v1');
  return {coin:st?{eq:cfg&&+cfg.equity,pnl:+st.pnl||0,open:(st.open||[]),run:!!st.running}:null,bist:bs?{eq:+bs.equity,pnl:+bs.pnl||0,open:(bs.open||[])}:null};}

/* --- çizim yardımcıları --- */
function fmtAge(ms){var m=Math.max(0,Math.round(ms/6e4));if(m<60)return m+' dk';var h=Math.floor(m/60);if(h<48)return h+' sa';return Math.floor(h/24)+' gün';}
function fmtT(t){var d=new Date(t);return d.toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function pct(x,d){return isFinite(x)?(x>=0?'+':'')+(x*100).toFixed(d==null?1:d)+'%':'—';}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function chartUrl(c){return '/quantex.html?v=124#ac='+(ST.mode==='bist'?'bist':'coin')+':'+encodeURIComponent(c.sym);}

/* --- Panel 1: radar --- */
var RC={cv:null,ctx:null,dots:[],hover:null,ang:0,last:0,W:0,H:0,cx:0,cy:0,R:0};
function cur(){return ST.mode==='bist'?ST.bist:ST.coins;}
function layout(){var list=cur().slice(),secs={};list.forEach(function(c){(secs[c.sec]=secs[c.sec]||[]).push(c);});
  var names=Object.keys(secs).sort(function(a,b){if(a==='Diğer')return 1;if(b==='Diğer')return -1;return a.localeCompare(b,'tr');}),tot=list.length||1,a0=-Math.PI/2,out=[],gap=0.06;
  RC.secs=[];names.forEach(function(nm){var arr=secs[nm].sort(function(a,b){return a.b.localeCompare(b.b);}),span=(2*Math.PI-gap*names.length)*arr.length/tot;
    RC.secs.push({nm:nm,a0:a0,a1:a0+span,n:arr.length});
    arr.forEach(function(c,i){out.push({c:c,a:a0+span*(i+0.5)/arr.length});});a0+=span+gap;});
  var rvMax=1;list.forEach(function(c){if(isFinite(c.rvol))rvMax=Math.max(rvMax,Math.min(c.rvol,6));});
  RC.dots=out.map(function(d){var rv=clamp(isFinite(d.c.rvol)?d.c.rvol:1,0.2,6);d.sz=(3+7*Math.sqrt(rv/6))*(RC.k||1);d.rv=rv;return d;});}
function resize(){var cv=RC.cv,b=cv.parentNode.getBoundingClientRect(),dpr=window.devicePixelRatio||1,s=Math.max(260,Math.min(b.width,b.height||b.width));
  cv.style.width=s+'px';cv.style.height=s+'px';cv.width=s*dpr;cv.height=s*dpr;RC.ctx.setTransform(dpr,0,0,dpr,0,0);RC.W=s;RC.H=s;RC.cx=s/2;RC.cy=s/2;RC.R=s/2-(s<520?52:36);RC.k=clamp(s/640,0.55,1);layout();}
function draw(ts){var g=RC.ctx;if(!g)return;var dt=RC.last?ts-RC.last:16;RC.last=ts;var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  RC.ang=(RC.ang+(reduce?0:dt*2*Math.PI/6000))%(2*Math.PI);
  var W=RC.W,cx=RC.cx,cy=RC.cy,R=RC.R;g.clearRect(0,0,W,W);
  // halkalar
  var rings=[[0.25,'ateşliyor'],[0.5,'yakın'],[0.75,'izlemede'],[1,'uzak']];
  g.lineWidth=1;rings.forEach(function(q){g.strokeStyle='rgba(0,255,170,'+(q[0]===0.25?0.35:0.14)+')';g.beginPath();g.arc(cx,cy,R*q[0],0,2*Math.PI);g.stroke();
    g.fillStyle='rgba(120,255,210,.55)';g.font='10px ui-monospace,monospace';g.fillText(q[1],cx+4,cy-R*q[0]+12);});
  // sektör çizgileri + etiketler
  (RC.secs||[]).forEach(function(s){g.strokeStyle='rgba(0,255,170,.10)';g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(s.a0)*R,cy+Math.sin(s.a0)*R);g.stroke();
    var am=(s.a0+s.a1)/2,lx=cx+Math.cos(am)*(R+(RC.W<520?24:18)),ly=cy+Math.sin(am)*(R+(RC.W<520?14:18));g.fillStyle='#7dd3fc';g.font='bold '+(RC.W<520?9:11)+'px ui-monospace,monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(s.nm+' '+s.n,lx,ly);g.textAlign='left';g.textBaseline='alphabetic';});
  // tarama ışını
  var tr=0.9;for(var q=0;q<24;q++){var a1=RC.ang-q*tr/24,a2=RC.ang-(q+1)*tr/24;g.fillStyle='rgba(0,255,170,'+(0.16*(1-q/24))+')';g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,R,a2,a1);g.closePath();g.fill();}
  g.strokeStyle='rgba(0,255,170,.9)';g.lineWidth=1.5;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(RC.ang)*R,cy+Math.sin(RC.ang)*R);g.stroke();
  // merkez nabız (şu an ateşleyen sayısı)
  var fire=RC.dots.filter(function(d){return d.c.r<0.05;}).length,ph=(ts%1600)/1600;
  if(fire){g.strokeStyle='rgba(255,230,0,'+(0.8*(1-ph))+')';g.lineWidth=2;g.beginPath();g.arc(cx,cy,6+R*0.22*ph,0,2*Math.PI);g.stroke();}
  g.fillStyle=fire?'#ffe600':'rgba(0,255,170,.6)';g.beginPath();g.arc(cx,cy,4,0,2*Math.PI);g.fill();
  // noktalar
  RC.dots.forEach(function(d){var rr=R*(0.04+0.96*clamp(d.c.r,0,1)),x=cx+Math.cos(d.a)*rr,y=cy+Math.sin(d.a)*rr;d.x=x;d.y=y;
    var since=((RC.ang-((d.a%(2*Math.PI))+2*Math.PI)%(2*Math.PI))+4*Math.PI)%(2*Math.PI),glow=reduce?0.6:Math.exp(-since/1.2);
    var col=d.c.flowUp==null?'160,160,160':d.c.flowUp?'0,255,140':'255,60,90';
    g.shadowColor='rgba('+col+',1)';g.shadowBlur=4+18*glow;g.fillStyle='rgba('+col+','+(0.45+0.55*glow)+')';g.beginPath();g.arc(x,y,d.sz,0,2*Math.PI);g.fill();g.shadowBlur=0;
    if(d.c.r<0.05){g.strokeStyle='rgba(255,230,0,'+(0.9-0.6*ph)+')';g.lineWidth=2;g.beginPath();g.arc(x,y,d.sz+3+5*ph,0,2*Math.PI);g.stroke();}
    if(d.c.r<0.35||RC.hover===d){g.fillStyle='#e6fff6';g.font='10px ui-monospace,monospace';g.fillText(d.c.b,x+d.sz+3,y+3);}});
  if(RC.hover){var h=RC.hover;g.strokeStyle='#fff';g.lineWidth=1.5;g.beginPath();g.arc(h.x,h.y,h.sz+4,0,2*Math.PI);g.stroke();}
  requestAnimationFrame(draw);}
function hit(ev){var b=RC.cv.getBoundingClientRect(),x=ev.clientX-b.left,y=ev.clientY-b.top,best=null,bd=1e9;RC.dots.forEach(function(d){var q=Math.hypot(d.x-x,d.y-y);if(q<Math.max(12,d.sz+6)&&q<bd){bd=q;best=d;}});return best;}
function tip(d,ev){var t=$('rdTip');if(!d){t.style.display='none';return;}var c=d.c,b=RC.cv.parentNode.getBoundingClientRect();
  var rows=['<b>'+esc(c.b)+'</b> <span class="mut">'+esc(c.sec)+'</span>','<span class="y">'+esc(c.why)+'</span>','yakınlık '+(1-c.r).toFixed(2)+' · RVOL '+(isFinite(c.rvol)?c.rvol.toFixed(2):'—')+'× · akış '+(c.flowUp==null?'—':c.flowUp?'▲ yükseliyor':'▼ düşüyor')];
  if(ST.mode==='coin'&&c.lx)rows.push('Loxx pst '+(c.lx.ok&&isFinite(c.lx.pst)?c.lx.pst.toFixed(0):'—')+' / pss '+(c.lx.ok&&isFinite(c.lx.pss)?c.lx.pss.toFixed(0):'—')+' · z200 '+(isFinite(c.lx.z)?c.lx.z.toFixed(2):'—'));
  rows.push('<span class="mut">tıkla → QUANTEX grafiği</span>');t.innerHTML=rows.join('<br>');t.style.display='block';
  var x=ev.clientX-b.left+14,y=ev.clientY-b.top+14;if(x>b.width-230)x-=250;t.style.left=x+'px';t.style.top=y+'px';}

/* --- Panel 2: Piyasa Nabzı --- */
function spark(cv,arr,opt){var dpr=window.devicePixelRatio||1,w=cv.clientWidth||200,h=cv.clientHeight||40;cv.width=w*dpr;cv.height=h*dpr;var g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  var v=arr.filter(isFinite);if(!v.length)return;var mn=opt.min!=null?opt.min:Math.min.apply(null,v),mx=opt.max!=null?opt.max:Math.max.apply(null,v);if(mx-mn<1e-9)mx=mn+1;
  var Y=function(x){return h-2-(h-4)*(x-mn)/(mx-mn);};if(opt.th!=null){g.strokeStyle='rgba(255,230,0,.6)';g.setLineDash([3,3]);g.beginPath();g.moveTo(0,Y(opt.th));g.lineTo(w,Y(opt.th));g.stroke();g.setLineDash([]);}
  g.strokeStyle=opt.col||'#00ffaa';g.lineWidth=1.5;g.beginPath();var st=false;arr.forEach(function(x,i){if(!isFinite(x))return;var X=i*(w-2)/Math.max(1,arr.length-1)+1;if(!st){g.moveTo(X,Y(x));st=true;}else g.lineTo(X,Y(x));});g.stroke();}
function gauge(cv,val,th,lo,hi){var dpr=window.devicePixelRatio||1,w=cv.clientWidth||220,h=cv.clientHeight||120;cv.width=w*dpr;cv.height=h*dpr;var g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  var cx=w/2,cy=h-10,R=Math.min(w/2-10,h-20),A=function(x){return Math.PI+Math.PI*clamp((x-lo)/(hi-lo),0,1);};
  g.lineWidth=12;g.strokeStyle='rgba(255,60,90,.55)';g.beginPath();g.arc(cx,cy,R,Math.PI,A(th));g.stroke();g.strokeStyle='rgba(0,255,170,.25)';g.beginPath();g.arc(cx,cy,R,A(th),2*Math.PI);g.stroke();
  g.strokeStyle='#ffe600';g.lineWidth=2;g.beginPath();g.moveTo(cx+Math.cos(A(th))*(R-10),cy+Math.sin(A(th))*(R-10));g.lineTo(cx+Math.cos(A(th))*(R+10),cy+Math.sin(A(th))*(R+10));g.stroke();
  if(isFinite(val)){var a=A(val);g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*(R-4),cy+Math.sin(a)*(R-4));g.stroke();}
  g.fillStyle='#7dd3fc';g.font='10px ui-monospace,monospace';g.textAlign='left';g.fillText((lo*100).toFixed(0)+'%',cx-R-6,cy+10);g.textAlign='right';g.fillText('+'+(hi*100).toFixed(0)+'%',cx+R+6,cy+10);g.textAlign='center';g.fillStyle='#ffe600';g.fillText('−5% eşik',cx+Math.cos(A(th))*(R+22),cy+Math.sin(A(th))*(R+22));g.textAlign='left';}
function got0(xu){return xu&&xu.c.length>8?xu.c[xu.c.length-1]/xu.c[xu.c.length-9]-1:NaN;}
function renderPulse(){var el=$('rdPulse');
  if(ST.mode==='bist'){var L=ST.bist,xu=ST.xu,below=L.filter(function(c){return c.z<-2;}).length,near=L.filter(function(c){return c.z<-1;}).length,up=L.filter(function(c){return c.flowUp;}).length;
    var x24=got0(xu);
    el.innerHTML='<div class="kv"><span>XU100 son 8 saatlik (1s mum) değişim</span><b class="'+(x24>=0?'g':'r')+'">'+pct(x24,2)+'</b></div><div class="kv"><span>z < −2 (aşırı satım)</span><b>'+below+'/'+L.length+'</b></div><div class="kv"><span>z < −1</span><b>'+near+'/'+L.length+'</b></div>'+
      '<div class="lbl">Akış genişliği (OBV akışı yükselen)</div><div class="bar"><i style="width:'+(L.length?100*up/L.length:0)+'%"></i><em>'+(L.length?Math.round(100*up/L.length):0)+'%</em></div>'+heat(L);return;}
  var P=ST.pulse;if(!P){el.innerHTML='<div class="mut">veri bekleniyor…</div>';return;}
  el.innerHTML='<div class="lbl">Sepet "sakin değil" ölçer <span class="mut">(ilk '+P.bn+' coin, 4s)</span></div><canvas id="rdGauge" class="gauge"></canvas>'+
   '<div class="kv"><span>Sepet 24s medyan getiri</span><b class="'+(P.mr>=0?'g':'r')+'">'+pct(P.mr,2)+'</b></div>'+
   '<div class="kv"><span>Son 3 mumda süpüren</span><b>'+P.sc+'/'+P.bn+' <span class="mut">(eşik %10 = '+Math.ceil(P.bn*0.1)+')</span></b></div>'+
   '<div class="state '+(P.calm?'calm':'hot')+'">'+(P.calm?'SAKİN — YO6 filtresi kapalı':'SAKİN DEĞİL — YO6 sinyalleri açık')+'</div>'+
   '<div class="lbl">24s medyan getiri · son 7 gün</div><canvas id="rdMr" class="sp"></canvas>'+
   (P.btc?'<div class="kv"><span>BTC 4s / EMA50</span><b class="'+(P.btc.d>=0?'g':'r')+'">'+(P.btc.d>=0?'ÜSTÜNDE ':'ALTINDA ')+pct(P.btc.d,2)+'</b></div>':'')+
   '<div class="lbl">Akış genişliği (OBV akışı yükselen, 4s)</div><div class="bar"><i style="width:'+(100*P.br)+'%"></i><em>'+Math.round(100*P.br)+'% · '+P.brN+' coin</em></div><canvas id="rdBr" class="sp"></canvas>'+heat(ST.coins);
  gauge($('rdGauge'),P.mr,-0.05,-0.10,0.10);spark($('rdMr'),P.mrHist,{th:-0.05,col:'#7dd3fc'});spark($('rdBr'),P.brHist,{min:0,max:1,th:0.5});}
function heat(L){var s=L.slice().sort(function(a,b){return a.sec===b.sec?b.qv-a.qv:a.sec.localeCompare(b.sec,'tr');});
  return '<div class="lbl">Isı şeridi · '+(ST.mode==='bist'?'günlük':'24s')+' değişim (sektöre göre)</div><div class="heat">'+s.map(function(c){var v=c.ch,a=clamp(Math.abs(v)/8,0.12,1),col=v>=0?'0,255,140':'255,60,90';
    return '<a href="'+chartUrl(c)+'" target="_blank" title="'+esc(c.b+' '+(isFinite(v)?v.toFixed(2)+'%':'—')+' · '+c.sec)+'" style="background:rgba('+col+','+a+')"></a>';}).join('')+'</div>';}

/* --- Panel 3: Portföy A canlı --- */
function badge(L){return '<div class="bdg"><span>PF <b>'+L.pf+'</b></span><span>rastgele '+L.rnd+'</span><span>'+L.ex+'</span></div>';}
function legRows(arr,empty){if(!arr.length)return '<div class="mut">'+empty+'</div>';return arr.slice(0,8).map(function(x){return '<a class="sig" href="'+x.u+'" target="_blank"><b>'+esc(x.s)+'</b><span>'+esc(x.d)+'</span><em>'+fmtAge(Date.now()-x.t)+' önce</em></a>';}).join('');}
function renderPort(){var now=Date.now(),cs=ST.coins,bs=ST.bist;
  var b=[],l=[],y=[],w=[];
  bs.forEach(function(c){c.ev.forEach(function(e){if(now-e.t<=72*H1)b.push({s:c.b,d:e.tx.replace('z −2 yukarı kesti','−2 kesti')+' · şimdi '+c.z.toFixed(2),t:e.t,u:'/quantex.html?v=124#ac=bist:'+c.sym});});});
  cs.forEach(function(c){c.lx.ev.forEach(function(e){if(now-e.t<=72*H1)l.push({s:c.b,d:'pst '+(isFinite(c.lx.pst)?c.lx.pst.toFixed(0):'—')+' · z '+(isFinite(c.lx.z)?c.lx.z.toFixed(2):'—'),t:e.t,u:'/quantex.html?v=124#ac=coin:'+c.sym});});
    if(c.t41.enAge!=null&&c.t41.enAge<12)y.push({s:c.b,d:'AL · '+c.t41.enAge+' mum',t:c.t41.enT,u:'/quantex.html?v=124#ac=coin:'+c.sym});
    if(c.t41.wait)w.push({s:c.b,d:'SMA10 '+(c.t41.maGap*100).toFixed(1)+'% yukarıda',t:c.t41.vfT,u:'/quantex.html?v=124#ac=coin:'+c.sym});});
  [b,l,y,w].forEach(function(a){a.sort(function(p,q){return q.t-p.t;});});
  $('rdPort').innerHTML=
   '<div class="leg"><h4>① '+LAB.bist.nm+' <small>'+LAB.bist.tf+'</small></h4>'+badge(LAB.bist)+'<div class="cnt">son 72 saat: <b>'+b.length+'</b> sinyal'+(bs.length?'':' · BIST verisi yok')+'</div>'+legRows(b,bs.length?'son 72 saatte sinyal yok':'BIST verisi alınamadı')+'</div>'+
   '<div class="leg"><h4>② '+LAB.loxx.nm+' <small>'+LAB.loxx.tf+'</small></h4>'+badge(LAB.loxx)+'<div class="cnt">son 72 saat: <b>'+l.length+'</b> sinyal</div>'+legRows(l,'son 72 saatte sinyal yok')+'</div>'+
   '<div class="leg"><h4>③ '+LAB.yo6.nm+' <small>'+LAB.yo6.tf+'</small></h4>'+badge(LAB.yo6)+'<div class="cnt">aktif (12 mum içinde AL): <b>'+y.length+'</b> · bekleyen VF: <b>'+w.length+'</b></div>'+legRows(y,'aktif AL yok')+(w.length?'<div class="lbl">SMA10 geri alımı bekleyen</div>'+legRows(w,''):'')+'</div>'+
   '<div class="mut sm">Rozetler: lab testi 2026-01-01→10-18, $10 marj, 2x, %0.04 komisyon, sonraki mum açılışı. Rastgele = aynı sayıda rastgele giriş PF’si.</div>';}

/* --- Panel 4: alarm şeridi + robot --- */
function renderTape(){var all=[];ST.coins.forEach(function(c){c.t41.ev.concat(c.lx.ev).forEach(function(e){all.push({s:c.b,e:e,u:'/quantex.html?v=124#ac=coin:'+c.sym});});});
  ST.bist.forEach(function(c){c.ev.forEach(function(e){all.push({s:c.b,e:e,u:'/quantex.html?v=124#ac=bist:'+c.sym});});});
  all=all.filter(function(x){return Date.now()-x.e.t<=72*H1;}).sort(function(a,b){return b.e.t-a.e.t;});
  var first=!ST.lastAt;all.forEach(function(x){var id=x.s+'|'+x.e.k+'|'+x.e.t;if(!ST.seen[id]){ST.seen[id]=first?1:2;}x.nw=ST.seen[id]===2;});
  var col={yo6:'#00ffaa',yo6v:'#7dd3fc',loxx:'#c084fc',bist:'#ffe600'};
  var html=all.slice(0,60).map(function(x){return '<a href="'+x.u+'" target="_blank" class="ti" style="--c:'+col[x.e.k]+'">'+(x.nw?'<i>YENİ</i>':'')+'<b>'+esc(x.s)+'</b> '+esc(x.e.tx)+' <em>'+fmtT(x.e.t)+'</em></a>';}).join('');
  $('rdTape').innerHTML=all.length?'<div class="tr">'+html+html+'</div>':'<div class="mut">son 72 saatte sinyal yok</div>';
  var tr=$('rdTape').querySelector('.tr');if(tr)tr.style.animationDuration=Math.max(30,all.slice(0,60).length*4)+'s';$('rdTapeN').textContent=all.length+' sinyal / 72 sa';}
function renderRobot(){var R=robot(),h='';
  function blk(nm,x,cur){if(!x)return '<div class="rb"><h5>'+nm+'</h5><div class="mut">bu tarayıcıda kayıt yok</div></div>';
    var op=x.open.slice(0,6).map(function(p){var s=p.sym||p.symbol||'?',sd=p.side||'L',e=+(p.entry||p.price||0);return '<span class="op">'+esc(String(s).replace(/USDT$/,''))+' '+esc(sd)+(e?' @'+e.toPrecision(5):'')+'</span>';}).join('');
    return '<div class="rb"><h5>'+nm+(x.run===false?' <small>(durdu)</small>':x.run?' <small class="g">● çalışıyor</small>':'')+'</h5><div class="kv"><span>Bakiye</span><b>'+(isFinite(x.eq)?x.eq.toLocaleString('tr-TR')+cur:'—')+'</b></div><div class="kv"><span>Gerçekleşen K/Z</span><b class="'+(x.pnl>=0?'g':'r')+'">'+x.pnl.toLocaleString('tr-TR',{maximumFractionDigits:2})+cur+'</b></div><div class="kv"><span>Açık pozisyon</span><b>'+x.open.length+'</b></div><div>'+op+'</div></div>';}
  $('rdRobot').innerHTML=blk('Kağıt robot · Coin',R.coin,' $')+blk('Kağıt robot · BIST',R.bist,' ₺')+'<div class="mut sm">Sadece okuma: localStorage’a yazılmaz.</div>';}

function renderAll(){layout();renderPulse();renderPort();renderTape();renderRobot();
  var L=cur(),f=L.filter(function(c){return c.r<0.05;}).length,n=L.filter(function(c){return c.r<0.35;}).length;
  $('rdCount').innerHTML='<b class="y">'+f+'</b> ateşliyor · <b>'+n+'</b> yakın · '+L.length+' '+(ST.mode==='bist'?'hisse':'coin');}
async function refresh(){if(ST.busy)return;ST.busy=true;ST.err=[];$('rdBtn').disabled=true;var t0=Date.now();
  try{if(ST.mode==='coin'||!ST.coins.length)await scanCoins(+($('rdN').value)||50);renderAll();
    try{await scanBist();}catch(e){ST.err.push('BIST: '+(e.message||e));}
    renderAll();ST.lastAt=Date.now();status('Güncellendi '+fmtT(ST.lastAt)+' · '+((Date.now()-t0)/1000).toFixed(0)+' sn · '+ST.req+' istek'+(ST.err.length?' · '+ST.err.length+' hata':''));
    if(ST.err.length)console.warn('radar hatalar',ST.err);}
  catch(e){status('Hata: '+(e.message||e));console.error(e);}
  ST.busy=false;$('rdBtn').disabled=false;}
function setMode(m){ST.mode=m;document.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-mode')===m);});$('rdModeLbl').textContent=m==='bist'?'BIST 30 · 1s · yarıçap = z200’ün −2’ye uzaklığı':'Coin vadeli · yarıçap = YO6 MA / Loxx kurulumuna uzaklık';renderAll();}
window.addEventListener('DOMContentLoaded',function(){RC.cv=$('rdCv');RC.ctx=RC.cv.getContext('2d');resize();window.addEventListener('resize',function(){resize();renderPulse();});
  RC.cv.addEventListener('mousemove',function(e){var d=hit(e);RC.hover=d;RC.cv.style.cursor=d?'pointer':'default';tip(d,e);});
  RC.cv.addEventListener('mouseleave',function(){RC.hover=null;tip(null);});
  RC.cv.addEventListener('click',function(e){var d=hit(e);if(d)window.open(chartUrl(d.c),'_blank');});
  $('rdBtn').onclick=refresh;document.querySelectorAll('[data-mode]').forEach(function(b){b.onclick=function(){setMode(b.getAttribute('data-mode'));};});
  setMode('coin');requestAnimationFrame(draw);refresh();setInterval(refresh,15*60*1000);setInterval(renderRobot,30000);
  window.QX_RADAR=ST;});
})();
