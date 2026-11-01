/* Umut grafiği — mum + giriş/stop/R1-R3 + RSI14 ve KAL alt panelleri, boğa uyumsuzluk çizgileri.
 * Hesaplar src/lib/watch/umut.ts ve src/lib/indicators/kalHibrit.ts ile birebir (robotla aynı 1000 mum 4s Binance vadeli veri).
 * Kullanım: QXUmutChart.open(el, sig)  — sig = izleme raporu sinyali (symbol, t, tf, entry/price, stop, u.lv, u.hit, fillT…). Yalnız izleme. */
(function(){
'use strict';
var TSI=3*3600,TFS={'1h':3600e3,'2h':7200e3,'4h':14400e3,'1d':86400e3};
var P={N:5,piv:3,maxLb:50,atrK:2};
function fin(x){return typeof x==='number'&&isFinite(x);}
/* ---- KAL Hibrit (kalHibrit.ts) ---- */
function rollCorr(a,b,w){var n=a.length,o=new Array(n).fill(NaN);for(var i=w-1;i<n;i++){var sa=0,sb=0,ok=true,j;for(j=i-w+1;j<=i;j++){if(!fin(a[j])||!fin(b[j])){ok=false;break;}sa+=a[j];sb+=b[j];}if(!ok)continue;var ma=sa/w,mb=sb/w,c=0,va=0,vb=0;for(j=i-w+1;j<=i;j++){var x=a[j]-ma,y=b[j]-mb;c+=x*y;va+=x*x;vb+=y*y;}o[i]=va>0&&vb>0?c/Math.sqrt(va*vb):0;}return o;}
function ewm(a,span){var al=2/(span+1),o=new Array(a.length).fill(NaN),p=NaN;for(var i=0;i<a.length;i++){var v=a[i];if(!fin(v))continue;p=fin(p)?al*v+(1-al)*p:v;o[i]=p;}return o;}
function kal(cs,W,B,mult,piv,maxLb){W=W||14;B=B||50;mult=mult||1.5;piv=piv||3;maxLb=maxLb||50;
 var n=cs.length,lc=cs.map(function(c){return Math.log(c.close);}),t=cs.map(function(_,i){return i;});
 var r=lc.map(function(v,i){return i?v-lc[i-1]:NaN;}),r1=r.map(function(_,i){return i?r[i-1]:NaN;});
 var rt=rollCorr(lc,t,W),ra=rollCorr(r,r1,W);
 var raw=rt.map(function(v,i){return fin(v)?50+50*Math.max(-1,Math.min(1,0.7*v+0.3*(fin(ra[i])?ra[i]:0))):NaN;});
 var k=ewm(raw,3),sig=ewm(k,9),hist=k.map(function(v,i){return v-sig[i];});
 var mid=new Array(n).fill(NaN),sd=new Array(n).fill(NaN),i,j;
 for(i=B-1;i<n;i++){var s=0,c=0;for(j=i-B+1;j<=i;j++)if(fin(k[j])){s+=k[j];c++;}if(c<B)continue;var m=s/B,q=0;for(j=i-B+1;j<=i;j++)q+=Math.pow(k[j]-m,2);mid[i]=m;sd[i]=Math.sqrt(q/(B-1));}
 var up=mid.map(function(m,i){return m+mult*sd[i];}),lo=mid.map(function(m,i){return m-mult*sd[i];});
 var hd=new Array(n).fill(false),lows=[],lastDiv=-Infinity;
 for(i=1;i<n;i++){var cc=i-piv;
  if(cc-piv>=0&&fin(k[cc])){var isP=true;for(j=cc-piv;j<=cc+piv;j++)if(j!==cc&&cs[j].low<=cs[cc].low&&(j>cc||cs[j].low<cs[cc].low)){isP=false;break;}
   if(isP){var pr=lows[lows.length-1];if(pr&&cc-pr.bar<=maxLb&&cs[cc].low<pr.p&&k[cc]>pr.k)lastDiv=i;lows.push({bar:cc,p:cs[cc].low,k:k[cc]});}}
  if(!fin(k[i])||!fin(k[i-1]))continue;
  var emaUp=fin(sig[i-1])&&hist[i-1]<=0&&hist[i]>0;hd[i]=emaUp&&i-lastDiv<=maxLb;}
 return {k:k,sig:sig,hist:hist,up:up,lo:lo,hd:hd};}
/* ---- umut.ts ---- */
function rsiW(c,n){n=n||14;var L=c.length,out=new Array(L).fill(NaN);if(L<=n)return out;var ag=0,al=0,i,d;
 for(i=1;i<=n;i++){d=c[i]-c[i-1];ag+=d>0?d:0;al+=d<0?-d:0;}ag/=n;al/=n;var f=function(g,l){return 100-100/(1+g/(l===0?1e-12:l));};out[n]=f(ag,al);
 for(i=n+1;i<L;i++){d=c[i]-c[i-1];ag=(ag*(n-1)+(d>0?d:0))/n;al=(al*(n-1)+(d<0?-d:0))/n;out[i]=f(ag,al);}return out;}
function atrW(b,n){n=n||14;var L=b.length,out=new Array(L).fill(NaN);if(L<n)return out;
 var tr=b.map(function(x,i){return i===0?x.high-x.low:Math.max(x.high-x.low,Math.abs(x.high-b[i-1].close),Math.abs(x.low-b[i-1].close));});
 var a=0,i;for(i=0;i<n;i++)a+=tr[i];a/=n;out[n-1]=a;for(i=n;i<L;i++){a=(a*(n-1)+tr[i])/n;out[i]=a;}return out;}
/* oscDiv + önceki pivot (çizgi için) */
function oscDiv(low,k,piv,maxLb){piv=piv||3;maxLb=maxLb||50;var n=low.length,ev=new Array(n).fill(false),pv=new Array(n).fill(-1),pp0=new Array(n).fill(-1),pb=-1,pp=0,pk=0,has=false,pl=[];
 for(var i=1;i<n;i++){var c=i-piv;if(c-piv>=0&&fin(k[c])){var isp=true;for(var j=c-piv;j<=c+piv;j++)if(j!==c&&low[j]<=low[c]&&(j>c||low[j]<low[c])){isp=false;break;}
  if(isp){if(has&&c-pb<=maxLb&&low[c]<pp&&k[c]>pk){ev[i]=true;pv[i]=c;pp0[i]=pb;}pb=c;pp=low[c];pk=k[c];has=true;pl.push({c:c,at:i});}}}
 return {ev:ev,pv:pv,pb:pp0,pl:pl};}
function compute(b){var n=b.length,close=b.map(function(x){return x.close;}),low=b.map(function(x){return x.low;});
 var kh=kal(b),r=rsiW(close),A=atrW(b),vd=oscDiv(low,r,P.piv,P.maxLb),kd=oscDiv(low,kh.k,P.piv,P.maxLb),hd=kh.hd;
 var lastD=-1e9,lastV=-1e9,sigs=[];
 for(var i=0;i<n;i++){if(vd.ev[i])lastV=i;if(hd[i])lastD=i;if(i<120||n<150)continue;
  if((hd[i]||vd.ev[i])&&i-lastD<P.N&&i-lastV<P.N&&fin(A[i]))sigs.push({i:i,kalAt:lastD,rsiAt:lastV});}
 return {kh:kh,rsi:r,atr:A,vd:vd,kd:kd,sigs:sigs};}

/* ---- veri ---- */
var CACHE={};
function bars(sym,tf){var key=sym+'|'+tf,c=CACHE[key];if(c&&Date.now()-c.at<60000)return Promise.resolve(c.b);
 return fetch('/api/fklines?symbol='+encodeURIComponent(sym)+'&interval='+tf+'&limit=1000',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('mum verisi alınamadı (HTTP '+r.status+')');return r.json();}).then(function(a){
  if(!Array.isArray(a)||!a.length)throw new Error('mum verisi boş');var b=a.map(function(x){return {t:+x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5],qv:+x[7],tbq:+x[10]};});
  // açık (henüz kapanmamış) son mum robotta da kullanılmaz → grafikte gösterilir ama sinyal hesabı kapanmış mumlarla
  CACHE[key]={at:Date.now(),b:b};return b;});}
function loadPGlib(){if(window.QXPatlama)return Promise.resolve(window.QXPatlama);if(loadPGlib.p)return loadPGlib.p;
 loadPGlib.p=new Promise(function(res,rej){var s=document.createElement('script');s.src='/patlama.js?v=1';s.onload=function(){res(window.QXPatlama);};s.onerror=function(){loadPGlib.p=null;rej(new Error('Patlama Gücü kütüphanesi yüklenemedi'));};document.head.appendChild(s);});return loadPGlib.p;}
/* Umut+PG: Patlama Gücü için BTC (RS) + funding geçmişi (FUND); biri gelmezse PG3'e düşer */
function pgData(sym,tf){return Promise.all([loadPGlib(),sym==='BTCUSDT'?Promise.resolve(null):bars('BTCUSDT',tf).catch(function(){return null;}),
 fetch('/api/ffunding?symbol='+encodeURIComponent(sym)+'&limit=1000',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(a){return Array.isArray(a)?a.map(function(x){return [+x.fundingTime,+x.fundingRate];}).filter(function(x){return fin(x[1]);}).sort(function(a,b){return a[0]-b[0];}):null;}).catch(function(){return null;})]);}
function loadLW(){if(window.LightweightCharts)return Promise.resolve(window.LightweightCharts);if(loadLW.p)return loadLW.p;
 loadLW.p=new Promise(function(res,rej){var s=document.createElement('script');s.src='/vendor/lightweight-charts-5.2.1.js';s.onload=function(){res(window.LightweightCharts);};s.onerror=function(){rej(new Error('grafik kütüphanesi yüklenemedi'));};document.head.appendChild(s);});return loadLW.p;}
function pad(x){return (x<10?'0':'')+x;}
function tsi(ms){var d=new Date(ms+TSI*1000);return pad(d.getUTCDate())+'.'+pad(d.getUTCMonth()+1)+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());}
function fp(v){if(!fin(v))return '—';var a=Math.abs(v);return v.toLocaleString('tr-TR',{maximumFractionDigits:a>=100?2:a>=1?4:a>=0.01?5:8});}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function cssOnce(){if(document.getElementById('uchCss'))return;var st=document.createElement('style');st.id='uchCss';st.textContent=
 '.uch{scroll-margin-top:90px;position:relative;border:1px solid #22314f;border-radius:12px;background:#0b1324;padding:10px;margin:0 0 14px}'+
 '.uch-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:8px;font:14px system-ui,sans-serif;color:#d9e4f5}'+
 '.uch-h b{font-size:16px}.uch-h .mu{color:#8ea3c4;font-size:12.5px}.uch-x{margin-left:auto;background:#13203a;border:1px solid #2a3d63;color:#d9e4f5;border-radius:8px;padding:5px 12px;font:600 13px system-ui;cursor:pointer}'+
 '.uch-lv{display:flex;flex-wrap:wrap;gap:6px;font:12.5px system-ui;margin-bottom:8px}.uch-lv span{padding:2px 8px;border-radius:999px;border:1px solid #2a3d63;white-space:nowrap}'+
 '.uch-c{position:relative;width:100%;height:640px}.uch-msg{display:flex;align-items:center;justify-content:center;height:100%;color:#8ea3c4;font:14px system-ui}'+
 '.uch-pl{position:absolute;left:8px;z-index:3;font:600 11.5px system-ui;color:#8ea3c4;background:rgba(11,19,36,.75);padding:1px 6px;border-radius:5px;pointer-events:none}'+
 '.uch-lg{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font:12px system-ui;color:#8ea3c4}.uch-lg i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin-right:5px;border-radius:2px}'+
 '.uch-c.pg{height:780px}@media(max-width:700px){.uch-c.pg{height:680px}}'+
 '@media(max-width:700px){.uch-c{height:560px}.uch{padding:8px 4px}.uch-h b{font-size:15px}}';document.head.appendChild(st);}

var CUR=null;
function close(){if(CUR){try{CUR.ro&&CUR.ro.disconnect();CUR.chart&&CUR.chart.remove();}catch(e){}CUR.el.innerHTML='';CUR.el.style.display='none';CUR=null;}}
/* sig: {symbol,t,tf,entry,price,stop,target,u:{lv,hit},fillT,tsi,scan,_label} */
function open(el,sig,opt){opt=opt||{};cssOnce();close();
 var sym=String(sig.symbol||'').toUpperCase(),tf=sig.tf||'4h',isPG=sig.scan==='umutpg-4h'||!!opt.pg,isU=sig.scan==='umut-4h'||isPG||!!sig.u,u=sig.u||{},lv=u.lv||{},hit=u.hit||{};
 var e=fin(sig.entry)?sig.entry:sig.price,stop=fin(lv.stop)?lv.stop:sig.stop;
 var lvl=isU?[['Giriş',e,'#d9e4f5',0],['Stop (−2 ATR)',stop,'#ff5c5c',2],['R1 +%10',fin(lv.r1)?lv.r1:e*1.1,'#2ecc71',2],['R2 +%20',fin(lv.r2)?lv.r2:e*1.2,'#27ae60',2],['R3 +%30',fin(lv.r3)?lv.r3:e*1.3,'#1e8449',2]]
  :[['Giriş',e,'#d9e4f5',0],['Stop',stop,'#ff5c5c',2],['Hedef',sig.target,'#2ecc71',2]];
 el.style.display='';
 el.innerHTML='<div class="uch"><div class="uch-h"><b>'+esc(sym.replace(/USDT$/,''))+'</b><span class="mu">'+esc((sig._label||(isU?'Umut':'Sinyal'))+' · '+tf+' · sinyal mumu '+tsi(sig.t)+' TSİ'+(sig.fillT?' · giriş '+tsi(sig.fillT)+' açılışı':' · giriş bekleniyor'))+'</span>'+
  '<button class="uch-x" type="button">Kapat ✕</button></div>'+
  '<div class="uch-lv">'+lvl.filter(function(l){return fin(l[1]);}).map(function(l){return '<span style="color:'+l[2]+';border-color:'+l[2]+'55">'+l[0]+' '+fp(l[1])+'</span>';}).join('')+'</div>'+
  '<div class="uch-c'+(isPG?' pg':'')+'"><div class="uch-msg">Grafik yükleniyor…</div></div>'+
  '<div class="uch-lg"><span><i style="background:#f1c40f"></i>Sinyal mumu (▲ SİNYAL)</span><span><i style="background:#2ecc71"></i>Boğa uyumsuzluğu (fiyat daha düşük dip, osilatör daha yüksek dip)</span><span><i style="background:#b388ff"></i>RSI14 (30/70)</span><span><i style="background:#ff9f43"></i>KAL · <i style="background:#8ea3c4"></i>EMA9</span><span>◆ KAL AL = KAL uyumsuzluk + EMA9 yukarı kesişim (Umut koşulu)</span>'+(isPG?'<span><i style="background:#00d2d3"></i>Patlama Gücü (PG5: VPA·SQZ·RS·TAKER·FUND; eksik veride PG3) — ≥50 eşiği</span>':'')+'<span>Saatler TSİ · yalnız izleme, tavsiye değildir</span></div></div>';
 var box=el.querySelector('.uch-c'),me={el:el};CUR=me;
 el.querySelector('.uch-x').onclick=function(){close();if(opt.onClose)opt.onClose();};
 if(opt.scroll!==false)setTimeout(function(){try{el.scrollIntoView({behavior:'smooth',block:'start'});}catch(x){}},30);
 Promise.all([loadLW(),bars(sym,tf),isPG?pgData(sym,tf).catch(function(){return null;}):null]).then(function(res){if(CUR!==me)return;var LW=res[0],b=res[1],PGD=res[2];
  var tfms=TFS[tf]||14400e3,closed=b.filter(function(x){return x.t+tfms<=Date.now();});
  var C=compute(closed),n=b.length,T=function(i){return Math.floor(b[i].t/1000)+TSI;};
  box.innerHTML='';
  var chart=LW.createChart(box,{autoSize:true,layout:{background:{type:'solid',color:'#0b1324'},textColor:'#c9d4e3',fontSize:11,panes:{separatorColor:'#22314f',separatorHoverColor:'#2a3d63',enableResize:true}},
   grid:{vertLines:{color:'#131f36'},horzLines:{color:'#131f36'}},rightPriceScale:{borderColor:'#22314f'},
   timeScale:{borderColor:'#22314f',timeVisible:true,secondsVisible:false,rightOffset:6},crosshair:{mode:0},
   localization:{locale:'tr-TR',priceFormatter:fp,timeFormatter:function(t){return tsi((t-TSI)*1000)+' TSİ';}}});
  me.chart=chart;
  var cs=chart.addSeries(LW.CandlestickSeries,{upColor:'#2ecc71',downColor:'#ff5c5c',borderVisible:false,wickUpColor:'#2ecc71',wickDownColor:'#ff5c5c',priceFormat:{type:'custom',formatter:fp,minMove:1e-9}},0);
  cs.setData(b.map(function(x,i){return {time:T(i),open:x.open,high:x.high,low:x.low,close:x.close};}));
  lvl.forEach(function(l){if(fin(l[1]))cs.createPriceLine({price:l[1],color:l[2],lineWidth:l[3]?1:2,lineStyle:l[3],axisLabelVisible:true,title:l[0]});});
  var idx={};b.forEach(function(x,i){idx[x.t]=i;});
  var si=idx[sig.t],fi=sig.fillT!=null?idx[sig.fillT]:(si!=null&&si+1<n?si+1:null);
  var mk=[],mr=[],mkK=[];
  // tüm Umut sinyalleri (küçük), seçili sinyal (büyük)
  C.sigs.forEach(function(h){if(h.i===si)return;mk.push({time:T(h.i),position:'belowBar',color:'#f1c40f99',shape:'circle',size:0.6,text:'U'});});
  if(si!=null){mk.push({time:T(si),position:'belowBar',color:'#f1c40f',shape:'arrowUp',size:2,text:'SİNYAL '+tsi(sig.t)});}
  if(fi!=null&&fi<n){mk.push({time:T(fi),position:'aboveBar',color:'#d9e4f5',shape:'arrowDown',size:1,text:'Giriş '+fp(e)});
   [['r1','R1 ✓','#2ecc71'],['r2','R2 ✓','#27ae60'],['r3','R3 ✓','#1e8449'],['stop','Stop ✗','#ff5c5c']].forEach(function(h){var k=hit[h[0]];if(k!=null&&fi+k-1<n)mk.push({time:T(fi+k-1),position:h[0]==='stop'?'belowBar':'aboveBar',color:h[2],shape:h[0]==='stop'?'square':'circle',size:1,text:h[1]});});}
  mk.sort(function(a,b){return a.time-b.time;});
  if(LW.createSeriesMarkers)LW.createSeriesMarkers(cs,mk);
  // panes
  var fix=function(){return {priceRange:{minValue:0,maxValue:100}};};
  var rs=chart.addSeries(LW.LineSeries,{autoscaleInfoProvider:fix,color:'#b388ff',lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,priceFormat:{type:'price',precision:1,minMove:0.1}},1);
  rs.setData(C.rsi.map(function(v,i){return fin(v)?{time:T(i),value:v}:{time:T(i)};}));
  rs.createPriceLine({price:30,color:'#2ecc7188',lineStyle:2,lineWidth:1,axisLabelVisible:false,title:''});rs.createPriceLine({price:70,color:'#ff5c5c88',lineStyle:2,lineWidth:1,axisLabelVisible:false,title:''});
  var kb=function(a,col,w){var s=chart.addSeries(LW.LineSeries,{autoscaleInfoProvider:fix,color:col,lineWidth:w,priceLineVisible:false,lastValueVisible:w>1,crosshairMarkerVisible:w>1,priceFormat:{type:'price',precision:1,minMove:0.1}},2);s.setData(a.map(function(v,i){return fin(v)?{time:T(i),value:v}:{time:T(i)};}));return s;};
  kb(C.kh.up,'#3a4a6b',1);kb(C.kh.lo,'#3a4a6b',1);kb(C.kh.sig,'#8ea3c4',1);var ks=kb(C.kh.k,'#ff9f43',2);
  // uyumsuzluk çizgileri: yalnız görünür pencere civarında (son 400 mum)
  var from=Math.max(0,closed.length-400),seg=function(pane,i0,i1,v0,v1,col){var s=chart.addSeries(LW.LineSeries,{color:col,lineWidth:2,lineStyle:0,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,pointMarkersVisible:true,pointMarkersRadius:2},pane);s.setData([{time:T(i0),value:v0},{time:T(i1),value:v1}]);};
  var lows=closed.map(function(x){return x.low;});
  for(var i=from;i<closed.length;i++){
   if(C.vd.ev[i]){var c=C.vd.pv[i],p=C.vd.pb[i];if(p>=0){seg(1,p,c,C.rsi[p],C.rsi[c],'#2ecc71');seg(0,p,c,lows[p],lows[c],'#b388ffaa');mr.push({time:T(i),position:'belowBar',color:'#2ecc71',shape:'arrowUp',size:1,text:'RSI uyumsuz'});}}
   if(C.kd.ev[i]){var c2=C.kd.pv[i],p2=C.kd.pb[i];if(p2>=0){seg(2,p2,c2,C.kh.k[p2],C.kh.k[c2],'#2ecc71');seg(0,p2,c2,lows[p2],lows[c2],'#ff9f43aa');mkK.push({time:T(i),position:'belowBar',color:'#2ecc71',shape:'arrowUp',size:1,text:'KAL uyumsuz'});}}
   if(C.kh.hd[i])mkK.push({time:T(i),position:'aboveBar',color:'#f1c40f',shape:'circle',size:1,text:'◆ KAL AL'});}
  if(LW.createSeriesMarkers){mr.sort(function(a,b){return a.time-b.time;});mkK.sort(function(a,b){return a.time-b.time;});LW.createSeriesMarkers(rs,mr);LW.createSeriesMarkers(ks,mkK);}
  // Patlama Gücü alt paneli (Umut+PG)
  var pgInfo=null;
  if(isPG&&PGD&&PGD[0]){try{var QP=PGD[0],btc=PGD[1]?new Map(PGD[1].map(function(x){return [x.t,x.close];})):(sym==='BTCUSDT'?new Map(closed.map(function(x){return [x.t,x.close];})):null);
   var PC=QP.components(closed,{btc:btc,fund:PGD[2],tfMs:tfms}),pv=QP.series(PC,closed.length);
   var pgs=chart.addSeries(LW.LineSeries,{autoscaleInfoProvider:fix,color:'#00d2d3',lineWidth:2,priceLineVisible:false,lastValueVisible:true,priceFormat:{type:'price',precision:1,minMove:0.1}},3);
   pgs.setData(pv.map(function(v,i){return fin(v)?{time:T(i),value:v}:{time:T(i)};}));
   pgs.createPriceLine({price:QP.PASS,color:'#f1c40f',lineStyle:2,lineWidth:1,axisLabelVisible:true,title:'50'});
   if(si!=null&&si<closed.length){var pa=QP.at(PC,si);pgInfo=pa;if(LW.createSeriesMarkers)LW.createSeriesMarkers(pgs,[{time:T(si),position:'aboveBar',color:pa.score>=QP.PASS?'#2ecc71':'#ff5c5c',shape:'circle',size:1,text:'PG '+(fin(pa.score)?pa.score.toFixed(0):'—')+' '+pa.mode}]);}
  }catch(x){pgInfo={err:String(x&&x.message||x)};}}
  try{var ps=chart.panes();if(ps[0])ps[0].setStretchFactor(3);if(ps[3])ps[3].setStretchFactor(1.15);if(ps[1])ps[1].setStretchFactor(1.15);if(ps[2])ps[2].setStretchFactor(1.15);}catch(x){}
  // pane etiketleri
  setTimeout(function(){if(CUR!==me)return;try{var ps=chart.panes(),y=0;['Fiyat '+tf,'RSI 14','KAL (+ EMA9, bant)','Patlama Gücü'+(pgInfo&&pgInfo.mode?' ('+pgInfo.mode+(pgInfo.missing&&pgInfo.missing.length?' · eksik: '+pgInfo.missing.join('/'):'')+')':'')].forEach(function(nm,j){if(!ps[j])return;var d=document.createElement('div');d.className='uch-pl';d.style.top=(y+4)+'px';d.textContent=nm;box.appendChild(d);y+=ps[j].getHeight()+1;});}catch(x){}},60);
  var mobile=box.clientWidth<600,c0=si!=null?si:n-1,L=mobile?70:130;
  var to=Math.min(n-1+6,Math.max(c0+(mobile?25:45),Math.min(n-1+6,c0+(u.bars||0)+8)));chart.timeScale().setVisibleLogicalRange({from:Math.max(0,to-L),to:to});
  var found=si!=null&&C.sigs.some(function(h){return h.i===si;});
  if(isU&&si!=null&&!found){var w=document.createElement('div');w.className='uch-pl';w.style.cssText+='top:auto;bottom:34px;color:#f1c40f';w.textContent='Not: sinyal robotun kaydından; güncel veriyle yeniden hesapta bu mum işaretlenmedi';box.appendChild(w);}
  if(si==null){var w2=document.createElement('div');w2.className='uch-pl';w2.style.cssText+='top:auto;bottom:34px;color:#f1c40f';w2.textContent='Sinyal mumu son 1000 mumun dışında';box.appendChild(w2);}
  me.info={n:n,si:si,fi:fi,found:found,sigs:C.sigs.length,rsiDiv:mr.length,kalMk:mkK.length,pg:pgInfo};
 }).catch(function(err){if(CUR!==me)return;box.innerHTML='<div class="uch-msg">Grafik açılamadı: '+esc(err&&err.message||err)+'</div>';});
 return me;}
/* Sinyale hazırlık (Radar) için: KAL + RSI dizileri, onaylı pivotlar — robotla aynı hesap */
function kr(b){var C=compute(b);return {k:C.kh.k,sig:C.kh.sig,hist:C.kh.hist,hd:C.kh.hd,rsi:C.rsi,kd:C.kd,vd:C.vd,low:b.map(function(x){return x.low;}),n:b.length};}
window.QXUmutChart={open:open,close:close,compute:compute,kr:kr,_cur:function(){return CUR;}};
})();
