// AUTO-EXTRACTED verbatim from kripto-tarayici pro/screener.html //====PURE-START==== block
// (reference implementation for scripts/smoke-pdo.ts; do not edit)
'use strict';
function hashSeed(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function fin(v){return Number.isFinite(v);}
function smaArr(src,n){
  var L=src.length,out=new Array(L).fill(NaN),sum=0,started=-1;
  for(var i=0;i<L;i++){
    var v=src[i];
    if(!fin(v))continue;
    if(started<0)started=i;
    sum+=v;
    if(i-started+1>n)sum-=src[i-n];
    if(i-started+1>=n)out[i]=sum/n;
  }
  return out;
}
function emaArr(src,n){
  var L=src.length,out=new Array(L).fill(NaN),f=-1;
  for(var i=0;i<L;i++){if(fin(src[i])){f=i;break;}}
  if(f<0||f+n-1>=L)return out;
  var s=f+n-1,sum=0;
  for(var j=f;j<=s;j++)sum+=src[j];
  var prev=sum/n;out[s]=prev;
  var k=2/(n+1);
  for(var i2=s+1;i2<L;i2++){prev=src[i2]*k+prev*(1-k);out[i2]=prev;}
  return out;
}
function rsiArr(close,n){
  var L=close.length,out=new Array(L).fill(NaN),f=-1;
  for(var i=0;i<L;i++){if(fin(close[i])&&fin(close[i-1])){f=i;break;}}
  if(f<0||f+n>=L)return out;
  var g=0,l=0;
  for(var a=f;a<f+n;a++){var d=close[a]-close[a-1];if(d>0)g+=d;else l-=d;}
  var ag=g/n,al=l/n;
  out[f+n-1]=al===0?100:100-100/(1+ag/al);
  for(var b=f+n;b<L;b++){
    var d2=close[b]-close[b-1];
    ag=(ag*(n-1)+Math.max(d2,0))/n;
    al=(al*(n-1)+Math.max(-d2,0))/n;
    out[b]=al===0?100:100-100/(1+ag/al);
  }
  return out;
}
function stochArr(h,l,c,kN,sk,dN){
  var L=c.length,rsv=new Array(L).fill(NaN);
  for(var i=kN-1;i<L;i++){
    var lo=Infinity,hi=-Infinity;
    for(var j=i-kN+1;j<=i;j++){if(l[j]<lo)lo=l[j];if(h[j]>hi)hi=h[j];}
    var rng=hi-lo;
    rsv[i]=rng===0?50:(c[i]-lo)/rng*100;
  }
  return {K:smaArr(rsv,sk),D:smaArr(smaArr(rsv,sk),dN)};
}
function bollArr(c,len,mult){
  var L=c.length,mid=smaArr(c,len),up=new Array(L).fill(NaN),lo=new Array(L).fill(NaN),pb=new Array(L).fill(NaN);
  for(var i=len-1;i<L;i++){
    var m=mid[i];if(!fin(m))continue;
    var s2=0;
    for(var j=i-len+1;j<=i;j++){var dv=c[j]-m;s2+=dv*dv;}
    var sd=Math.sqrt(s2/len)*mult;
    up[i]=m+sd;lo[i]=m-sd;
    pb[i]=sd===0?0.5:(c[i]-lo[i])/(up[i]-lo[i]);
  }
  return {mid:mid,up:up,lo:lo,pb:pb};
}
function makeDemoKlines(name,bars,ivMs){
  var rnd=mulberry32(hashSeed(name));
  var out={t:[],o:[],h:[],l:[],c:[],v:[]};
  var price=0.01+Math.pow(10,rnd()*6);
  var drift=(rnd()-0.42)*0.004;
  var now=Math.floor(Date.now()/ivMs)*ivMs;
  for(var i=0;i<bars;i++){
    if(i%97===0)drift=(rnd()-0.5)*0.009;
    var o=price;
    var vol=0.004+rnd()*0.02;
    var c=o*(1+drift+(rnd()-0.5)*2*vol);
    var h=Math.max(o,c)*(1+rnd()*vol*0.7);
    var l=Math.min(o,c)*(1-rnd()*vol*0.7);
    out.t.push(now-(bars-1-i)*ivMs);
    out.o.push(o);out.h.push(h);out.l.push(l);out.c.push(c);
    out.v.push((Math.abs(c-o)/Math.max(o,1e-9))*8e4+1e3*(1+rnd()*0.5));
    price=c;
  }
  return out;
}
function moveAvg(a,lo,hi){
  var s=0,n=0;
  lo=Math.max(0,lo);hi=Math.min(a.length-1,hi);
  for(var i=lo;i<=hi;i++)if(fin(a[i])){s+=a[i];n++;}
  return n?s/n:NaN;
}
function moveMax(a,lo,hi){var x=-Infinity;for(var i=Math.max(0,lo);i<=Math.min(a.length-1,hi);i++)if(fin(a[i])&&a[i]>x)x=a[i];return x===-Infinity?NaN:x;}
function moveMin(a,lo,hi){var x=Infinity;for(var i=Math.max(0,lo);i<=Math.min(a.length-1,hi);i++)if(fin(a[i])&&a[i]<x)x=a[i];return x===Infinity?NaN:x;}
function moveTr(k,i){
  if(!fin(k.h[i])||!fin(k.l[i]))return NaN;
  if(i<=0||!fin(k.c[i-1]))return k.h[i]-k.l[i];
  return Math.max(k.h[i]-k.l[i],Math.abs(k.h[i]-k.c[i-1]),Math.abs(k.l[i]-k.c[i-1]));
}
function moveCtx(k){
  var n=k.c.length,tr=new Array(n),i;
  for(i=0;i<n;i++)tr[i]=moveTr(k,i);
  var e10=emaArr(k.c,10),e20=emaArr(k.c,20),rsi=rsiArr(k.c,14);
  var f=emaArr(k.c,12),sl=emaArr(k.c,26),dif=new Array(n);
  for(i=0;i<n;i++)dif[i]=fin(f[i])&&fin(sl[i])?f[i]-sl[i]:NaN;
  var sg=emaArr(dif,9),hist=new Array(n);
  for(i=0;i<n;i++)hist[i]=fin(dif[i])&&fin(sg[i])?dif[i]-sg[i]:NaN;
  return {tr:tr,e10:e10,e20:e20,rsi:rsi,hist:hist};
}
function moveFeature(k,end,pre,ctx){
  var n=k.c.length,e=Math.min(n-1,end),s=Math.max(0,e-pre+1);
  ctx=ctx||moveCtx(k);
  if(e<0||!fin(k.c[e]))return {valid:false};
  var p=k.c[e],i,body=0,clv=0,up=0,dn=0,wickU=0,wickD=0,cnt=0;
  for(i=s;i<=e;i++){
    if(!fin(k.c[i])||!fin(k.o[i])||!fin(k.h[i])||!fin(k.l[i]))continue;
    var rg=Math.max(k.h[i]-k.l[i],p*1e-9),b=(k.c[i]-k.o[i])/rg;
    body+=b;clv+=((k.c[i]-k.l[i])/rg)*2-1;
    if(k.c[i]>=k.o[i])up++;else dn++;
    wickU+=(k.h[i]-Math.max(k.o[i],k.c[i]))/rg;
    wickD+=(Math.min(k.o[i],k.c[i])-k.l[i])/rg;cnt++;
  }
  var a5=moveAvg(ctx.tr,e-4,e),a20=moveAvg(ctx.tr,e-19,e),v3=moveAvg(k.v,e-2,e),vBase=moveAvg(k.v,e-22,e-3);
  var e10now=ctx.e10[e],e10old=ctx.e10[Math.max(0,e-5)],e20now=ctx.e20[e];
  var priorHi=moveMax(k.h,s,e-1),priorLo=moveMin(k.l,s,e-1);
  var f={valid:cnt>0,from:s,to:e,price:p,preRet:s<e&&fin(k.c[s])?(p/k.c[s]-1)*100:0,
    atr5Pct:fin(a5)?a5/p*100:NaN,atr20Pct:fin(a20)?a20/p*100:NaN,
    compression:fin(a5)&&a20>0?a5/a20:NaN,volRatio:fin(v3)&&vBase>0?v3/vBase:NaN,
    bodyBias:cnt?body/cnt:NaN,closeBias:cnt?clv/cnt:NaN,upFrac:cnt?up/cnt:NaN,downFrac:cnt?dn/cnt:NaN,
    wickUp:cnt?wickU/cnt:NaN,wickDown:cnt?wickD/cnt:NaN,
    emaSlope:fin(e10now)&&fin(e10old)&&e10old!==0?(e10now/e10old-1)*100:NaN,
    trendGap:fin(e10now)&&fin(e20now)&&e20now!==0?(e10now/e20now-1)*100:NaN,
    rsi:ctx.rsi[e],macdPct:fin(ctx.hist[e])&&p!==0?ctx.hist[e]/p*100:NaN,
    breakUp:fin(priorHi)&&priorHi>0?(p/priorHi-1)*100:NaN,
    breakDown:fin(priorLo)&&priorLo>0?(p/priorLo-1)*100:NaN};
  return f;
}
function move01(x,a,b){return !fin(x)?NaN:Math.max(0,Math.min(1,(x-a)/(b-a)));}
function moveScore(f,P){
  if(!f||!f.valid)return {pump:0,dump:0,diff:0,label:'veri yok'};
  var pu=0,du=0,w=0,add=function(a,b,c,ww){if(!a||!fin(b)||!fin(c))return;pu+=b*ww;du+=c*ww;w+=ww;};
  if(P.moveVolOn){var vr=move01(f.volRatio,0.8,Math.max(2,P.moveVolMin+1));add(true,vr,vr,20);}
  if(P.moveSqueezeOn){var sq=fin(f.compression)?1-move01(f.compression,Math.min(.5,P.moveCompress),Math.max(1.5,P.moveCompress+0.45)):NaN;add(true,sq,sq,15);}
  if(P.movePressureOn){add(true,move01(f.bodyBias,-.35,.45),move01(-f.bodyBias,-.35,.45),25);}
  if(P.moveTrendOn){add(true,move01(f.emaSlope,-.5,.8),move01(-f.emaSlope,-.5,.8),18);add(true,move01(f.trendGap,-.6,1.2),move01(-f.trendGap,-.6,1.2),7);}
  if(P.moveMomentumOn){
    var rp=fin(f.rsi)?1-Math.min(1,Math.abs(f.rsi-57)/38):NaN;
    var rd=fin(f.rsi)?1-Math.min(1,Math.abs(f.rsi-43)/38):NaN;
    var mp=fin(f.macdPct)?move01(f.macdPct,-.08,.12):NaN,md=fin(f.macdPct)?move01(-f.macdPct,-.08,.12):NaN;
    add(true,fin(rp)&&fin(mp)?(rp+mp)/2:rp,fin(rd)&&fin(md)?(rd+md)/2:rd,15);
  }
  var den=w||1,ps=Math.round(100*pu/den),ds=Math.round(100*du/den);
  var label=ps>=ds+12&&ps>=60?'pump hazırlığı':ds>=ps+12&&ds>=60?'dump hazırlığı':Math.max(ps,ds)>=55?'karışık / izleme':'nötr yapı';
  return {pump:ps,dump:ds,diff:ps-ds,label:label};
}
function moveOscSeriesLegacy(k,P,count){
  var n=k.c.length,ctx=moveCtx(k),raw=new Array(n).fill(NaN),pump=new Array(n).fill(NaN),dump=new Array(n).fill(NaN);
  var st=Math.max(0,n-(count||240));
  for(var i=Math.max(P.movePre,0);i<n;i++){
    var f=moveFeature(k,i,P.movePre,ctx),sc=moveScore(f,P);
    if(sc&&fin(sc.pump)){pump[i]=sc.pump;dump[i]=sc.dump;raw[i]=50+(sc.pump-sc.dump)/2;}
  }
  return {raw:raw,signal:emaArr(raw,P.oscSignal||5),pump:pump,dump:dump,st:st,model:'legacy-structure'};
}
function moveOscSeries(k,P,count,mode){
  P=P||{};
  if(mode==='legacy')return moveOscSeriesLegacy(k,P,count);
  var n=k.c.length,ctx=moveCtx(k),raw=new Array(n).fill(NaN),signal=new Array(n).fill(NaN),pumpBase=new Array(n).fill(NaN),dumpBase=new Array(n).fill(NaN),structure=new Array(n).fill(NaN),hybrid=new Array(n).fill(NaN),dLine=new Array(n).fill(NaN);
  var st=Math.max(0,n-(count||240));
  var stK=Math.max(2,Math.floor(+P.pdoStochK||14)),stSk=Math.max(1,Math.floor(+P.pdoStochSk||3)),stD=Math.max(1,Math.floor(+P.pdoStochD||3));
  var stoch=stochArr(k.h,k.l,k.c,stK,stSk,stD);
  var sw=Math.max(.5,Math.min(1,(+P.pdoStochWeight||70)/100)),pw=Math.max(1,Math.floor(+P.pdoSmooth||2)),sigN=Math.max(1,Math.floor(+P.oscSignal||5));
  var crossMode=P.pdoCrossMode==='ema'?'ema':'kd';
  function clamp100(v){return v<0?0:v>100?100:v;}
  for(var i=Math.max(P.movePre||0,0);i<n;i++){
    var f=moveFeature(k,i,P.movePre,ctx),sc=moveScore(f,P);
    if(sc&&fin(sc.pump)){
      pumpBase[i]=sc.pump;dumpBase[i]=sc.dump;structure[i]=50+(sc.pump-sc.dump)/2;
    }
    if(fin(stoch.K[i])&&fin(stoch.D[i])&&fin(structure[i])){
      if(crossMode==='ema'){
        var stBase=stoch.K[i]*.4+stoch.D[i]*.6;
        hybrid[i]=stBase*sw+structure[i]*(1-sw);
      }else{
        var bias=(structure[i]-50)*(1-sw);
        hybrid[i]=clamp100(stoch.K[i]+bias);dLine[i]=clamp100(stoch.D[i]+bias);
      }
    }
  }
  // PDO ve görsel P/D serileri aynı yumuşaklık katmanından geçer (pdoSmooth=1 → yumuşatma yok).
  function sm(a){return pw>1?emaArr(a,pw):a.slice();}
  raw=sm(hybrid);
  signal=crossMode==='ema'?emaArr(raw,sigN):sm(dLine);
  var pump=emaArr(pumpBase,pw),dump=emaArr(dumpBase,pw);
  return {raw:raw,signal:signal,pump:pump,dump:dump,st:st,stochK:stoch.K,stochD:stoch.D,structure:structure,hybrid:hybrid,stochWeight:sw,smooth:pw,crossMode:crossMode,model:'stoch-hybrid'};
}
function pdoPivotIndices(k,side,w){
  var n=k.c.length,out=[],ww=Math.max(1,Math.floor(+w||2));
  for(var i=ww;i<n-ww;i++){
    var v=side==='low'?k.l[i]:k.h[i];if(!fin(v))continue;
    var ok=true,strict=false;
    for(var j=i-ww;j<=i+ww;j++){
      if(j===i)continue;
      var q=side==='low'?k.l[j]:k.h[j];if(!fin(q)){ok=false;break;}
      if(side==='low'&&q<v){ok=false;break;}
      if(side==='high'&&q>v){ok=false;break;}
      if(q!==v)strict=true;
    }
    if(ok&&strict)out.push(i);
  }
  return out;
}
function pdoBetweenExtreme(k,side,a,b){
  if(b<=a+1)return NaN;
  var v=side==='low'?-Infinity:Infinity;
  for(var i=a+1;i<b;i++){
    var q=side==='low'?k.h[i]:k.l[i];if(!fin(q))return NaN;
    if(side==='low'&&q>v)v=q;
    if(side==='high'&&q<v)v=q;
  }
  return v===-Infinity||v===Infinity?NaN:v;
}
function pdoPatternScan(k,ser,P){
  P=P||{};
  var n=k.c.length,bars=Math.max(5,Math.floor(+P.bars||20)),w=Math.max(1,Math.floor(+P.pivot||2));
  var tol=Math.max(0,+P.tol||2)/100,rise=Math.max(0,+P.rise||2)/100;
  var from=Math.max(0,n-1-bars),raw=ser&&ser.raw?ser.raw:[],lowP=pdoPivotIndices(k,'low',w),highP=pdoPivotIndices(k,'high',w);
  var ua=[],us=[],doubleBottom=[],tripleBottom=[],doubleTop=[],tripleTop=[],buy=[],sell=[];
  var tripleLowTo=Object.create(null),tripleHighTo=Object.create(null);
  function inScan(i){return i>=from&&i<n;}
  function oscOK(points){for(var i=0;i<points.length;i++)if(!fin(raw[points[i]]))return false;return true;}
  function levelsOK(points,side){
    var lo=Infinity,hi=-Infinity;
    for(var i=0;i<points.length;i++){var v=side==='low'?k.l[points[i]]:k.h[points[i]];if(!fin(v))return false;if(v<lo)lo=v;if(v>hi)hi=v;}
    return lo>0&&(hi-lo)/lo<=tol;
  }
  function event(kind,label,side,points,oscSide){
    var a=points[0],b=points[points.length-1];
    return {kind:kind,label:label,side:side,points:points.slice(),from:a,to:b,priceFrom:side==='buy'?k.l[a]:k.h[a],priceTo:side==='buy'?k.l[b]:k.h[b],oscFrom:raw[a],oscTo:raw[b],oscSide:oscSide||side};
  }
  // Üçlü yapılar önce seçilir; aynı son pivotta ikili yapı tekrar etiketlenmez.
  for(var t=2;t<lowP.length;t++){
    var l0=lowP[t-2],l1=lowP[t-1],l2=lowP[t];
    if(l2-l0<=bars&&inScan(l2)&&oscOK([l0,l1,l2])&&levelsOK([l0,l1,l2],'low')){
      var r01=pdoBetweenExtreme(k,'low',l0,l1),r12=pdoBetweenExtreme(k,'low',l1,l2),base=Math.max(k.l[l0],k.l[l1],k.l[l2]);
      if(fin(r01)&&fin(r12)&&r01>=base*(1+rise)&&r12>=base*(1+rise)){
        var e3=event('tripleBottom','3D AL','buy',[l0,l1,l2],'low');tripleBottom.push(e3);tripleLowTo[l2]=true;buy.push(e3);
      }
    }
  }
  for(var t2=2;t2<highP.length;t2++){
    var h0=highP[t2-2],h1=highP[t2-1],h2=highP[t2];
    if(h2-h0<=bars&&inScan(h2)&&oscOK([h0,h1,h2])&&levelsOK([h0,h1,h2],'high')){
      var rr01=pdoBetweenExtreme(k,'high',h0,h1),rr12=pdoBetweenExtreme(k,'high',h1,h2),top=Math.min(k.h[h0],k.h[h1],k.h[h2]);
      if(fin(rr01)&&fin(rr12)&&rr01<=top*(1-rise)&&rr12<=top*(1-rise)){
        var et3=event('tripleTop','3T SAT','sell',[h0,h1,h2],'high');tripleTop.push(et3);tripleHighTo[h2]=true;sell.push(et3);
      }
    }
  }
  for(var q=1;q<lowP.length;q++){
    var a=lowP[q-1],b=lowP[q];
    if(b-a>bars||!inScan(b)||!oscOK([a,b]))continue;
    var rebound=pdoBetweenExtreme(k,'low',a,b);
    if(fin(rebound)&&levelsOK([a,b],'low')&&rebound>=Math.max(k.l[a],k.l[b])*(1+rise)&&!tripleLowTo[b]){
      var e2=event('doubleBottom','2D AL','buy',[a,b],'low');doubleBottom.push(e2);buy.push(e2);
    }
  }
  for(var q2=1;q2<highP.length;q2++){
    var c=highP[q2-1],d=highP[q2];
    if(d-c>bars||!inScan(d)||!oscOK([c,d]))continue;
    var pull=pdoBetweenExtreme(k,'high',c,d);
    if(fin(pull)&&levelsOK([c,d],'high')&&pull<=Math.min(k.h[c],k.h[d])*(1-rise)&&!tripleHighTo[d]){
      var et2=event('doubleTop','2T SAT','sell',[c,d],'high');doubleTop.push(et2);sell.push(et2);
    }
  }
  // Klasik uyumsuzluk: fiyat yeni dip/tepe yaparken osilatör aynı yönde gitmez.
  // • Osilatör farkı en az divMin puan (0–100 ölçek, varsayılan 2): eşit/gürültü değerler uyumsuzluk sayılmaz.
  // • Aradaki pivot iki uçtan da "küçük" ise (dipte daha yüksek / tepede daha alçak) bir önceki pivotla da
  //   karşılaştırılır; önceden yalnız ardışık pivotlara bakıldığı için ara diple bölünen uyumsuzluklar kaçıyordu.
  var divMin=fin(+P.divMin)?Math.max(0,+P.divMin):2;
  function divPair(list,q,side){
    var pb=list[q];
    for(var back=1;back<=2&&q-back>=0;back++){
      var pa=list[q-back];
      if(pb-pa>bars)break;
      if(back===2){var mid=list[q-1];if(side==='low'?!(k.l[mid]>k.l[pa]&&k.l[mid]>k.l[pb]):!(k.h[mid]<k.h[pa]&&k.h[mid]<k.h[pb]))break;}
      if(!oscOK([pa,pb]))continue;
      if(side==='low'?(k.l[pb]<k.l[pa]&&raw[pb]>raw[pa]+divMin):(k.h[pb]>k.h[pa]&&raw[pb]<raw[pa]-divMin))return pa;
    }
    return -1;
  }
  for(var q3=1;q3<lowP.length;q3++){
    var pb=lowP[q3];if(!inScan(pb))continue;
    var pa=divPair(lowP,q3,'low');
    if(pa>=0){var eu=event('bullishDivergence','UA','buy',[pa,pb],'low');ua.push(eu);buy.push(eu);}
  }
  for(var q4=1;q4<highP.length;q4++){
    var hb=highP[q4];if(!inScan(hb))continue;
    var ha=divPair(highP,q4,'high');
    if(ha>=0){var es=event('bearishDivergence','US','sell',[ha,hb],'high');us.push(es);sell.push(es);}
  }
  // CANLI (teyit bekleyen) uyumsuzluk: pivot teyidi için w mum beklemeden, son w mumda son teyitli pivottan daha
  // düşük dip (UA) / daha yüksek tepe (US) oluşuyor ve osilatör o pivottakinden en az divMin kadar iyiyse işaretlenir.
  var uaLive=[],usLive=[],liveOn=P.live!==false;
  function liveDiv(side){
    var list=side==='low'?lowP:highP;if(!list.length)return null;
    var last=list[list.length-1],m=-1,j;
    for(j=Math.max(last+1,n-w);j<n;j++){var v=side==='low'?k.l[j]:k.h[j];if(fin(v)&&(m<0||(side==='low'?v<k.l[m]:v>k.h[m])))m=j;}
    if(m<0||!fin(raw[m])||m-last>bars)return null;
    for(j=last+1;j<m;j++)if(side==='low'?k.l[j]<k.l[m]:k.h[j]>k.h[m])return null; // m son pivottan beri en uç nokta olmalı
    var tmp=list.concat([m]),pa=divPair(tmp,tmp.length-1,side);
    if(pa<0)return null;
    var e=event(side==='low'?'bullishDivergence':'bearishDivergence',side==='low'?'UA':'US',side==='low'?'buy':'sell',[pa,m],side);
    e.live=true;return e;
  }
  if(liveOn){var luA=liveDiv('low');if(luA)uaLive.push(luA);var luS=liveDiv('high');if(luS)usLive.push(luS);}
  // CANLI seviye teması: son teyitli dip/tepe seviyesine şu anki mum değiyor → ikili/üçlü dip-tepe oluşuyor.
  var touch=liveOn?pivotLevelTouch(k,{pivot:w,bars:bars,tol:tol*100,rise:rise*100,touch:fin(+P.touch)?+P.touch:0.5,recent:1,lowP:lowP,highP:highP}):{bottom:null,top:null,watchBottom:null,watchTop:null};
  buy.sort(function(a,b){return a.to-b.to;});sell.sort(function(a,b){return a.to-b.to;});
  var all=buy.concat(sell).sort(function(a,b){return a.to-b.to;}),latest=all.length?all[all.length-1]:null;
  return {bars:bars,pivot:w,tol:tol,rise:rise,from:from,divMin:divMin,lowPivots:lowP,highPivots:highP,ua:ua,us:us,uaLive:uaLive,usLive:usLive,touchBottom:touch.bottom,touchTop:touch.top,watchBottom:touch.watchBottom,watchTop:touch.watchTop,doubleBottom:doubleBottom,tripleBottom:tripleBottom,doubleTop:doubleTop,tripleTop:tripleTop,buy:buy,sell:sell,latestBuy:buy.length?buy[buy.length-1]:null,latestSell:sell.length?sell[sell.length-1]:null,latest:latest};
}
function pivotLevelTouch(k,P){
  P=P||{};
  var n=k.c.length,L=n-1,w=Math.max(1,Math.floor(+P.pivot||2)),bars=Math.max(5,Math.floor(+P.bars||20));
  var tol=Math.max(0,fin(+P.tol)?+P.tol:2)/100,rise=Math.max(0,fin(+P.rise)?+P.rise:2)/100,tt=Math.max(0,fin(+P.touch)?+P.touch:0.5)/100,recent=Math.max(0,Math.floor(fin(+P.recent)?+P.recent:1));
  function one(side){
    var low=side==='low',list=low?(P.lowP||pdoPivotIndices(k,'low',w)):(P.highP||pdoPivotIndices(k,'high',w));
    if(!list.length)return {hit:null,watch:null};
    var p1=list[list.length-1];if(L-p1>bars)return {hit:null,watch:null};
    var lv=low?k.l[p1]:k.h[p1];if(!(lv>0))return {hit:null,watch:null};
    var label=low?'2D':'2T',pts=[p1];
    if(list.length>=2){
      var p0=list[list.length-2],lv0=low?k.l[p0]:k.h[p0];
      if(p1-p0<=bars&&lv0>0&&Math.abs(lv0-lv)<=Math.min(lv0,lv)*tol){
        var e01=pdoBetweenExtreme(k,side,p0,p1);
        if(fin(e01)&&(low?e01>=Math.max(lv0,lv)*(1+rise):e01<=Math.min(lv0,lv)*(1-rise))){label=low?'3D':'3T';pts=[p0,p1];}
      }
    }
    function ok(j){ // p1 → j arası: tepki var, seviye bozulmamış
      var ext=pdoBetweenExtreme(k,side,p1,j);
      if(!fin(ext)||(low?ext<lv*(1+rise):ext>lv*(1-rise)))return false;
      for(var q=p1+1;q<j;q++){var y=low?k.l[q]:k.h[q];if(low?y<lv*(1-tol):y>lv*(1+tol))return false;}
      return true;
    }
    for(var j=L;j>=Math.max(p1+w+1,L-recent);j--){
      var x=low?k.l[j]:k.h[j];if(!fin(x))continue;
      if(!(low?(x<=lv*(1+tt)&&x>=lv*(1-tol)):(x>=lv*(1-tt)&&x<=lv*(1+tol))))continue;
      if(!ok(j))continue;
      return {hit:{label:label,side:low?'buy':'sell',level:lv,points:pts,index:j,age:L-j,price:x,dist:(x/lv-1)*100},watch:null};
    }
    // değmemiş ama silahlı seviye: tepki gerçekleşmiş, seviye bozulmamış, şu an bandın dışında
    var armed=L>p1+w&&ok(L)&&(low?k.l[L]>lv*(1+tt):k.h[L]<lv*(1-tt));
    return {hit:null,watch:armed?{label:label,side:low?'buy':'sell',level:lv,points:pts}:null};
  }
  var b=one('low'),t=one('high');
  return {bottom:b.hit,top:t.hit,watchBottom:b.watch,watchTop:t.watch};
}
function pdoZoneOK(a,i,dir,zone){
  if(!zone)return true;
  var look=Math.max(1,Math.floor(+zone.look||5)),lo=fin(+zone.low)?+zone.low:30,hi=fin(+zone.high)?+zone.high:70;
  for(var j=Math.max(0,i-look+1);j<=i;j++){if(!fin(a[j]))continue;if(dir==='up'?a[j]<=lo:a[j]>=hi)return true;}
  return false;
}
function pdoCrossEvents(a,b,zone,from){
  var out=[],n=a.length;
  for(var i=Math.max(1,from||1);i<n;i++){
    if(!fin(a[i])||!fin(b[i])||!fin(a[i-1])||!fin(b[i-1]))continue;
    var up=a[i-1]<=b[i-1]&&a[i]>b[i],down=a[i-1]>=b[i-1]&&a[i]<b[i];
    if(up&&pdoZoneOK(a,i,'up',zone))out.push({index:i,age:n-1-i,direction:'up',label:'AL'});
    else if(down&&pdoZoneOK(a,i,'down',zone))out.push({index:i,age:n-1-i,direction:'down',label:'SAT'});
  }
  return out;
}
function pdoCrossSignal(a,b,mode,maxBars,zone){
  var n=a.length,lim=Math.min(Math.max(0,+maxBars||0),n-2),want=mode==='up'||mode==='down'?mode:'both';
  for(var age=0;age<=lim;age++){
    var i=n-1-age;if(i<=0||!fin(a[i])||!fin(b[i])||!fin(a[i-1])||!fin(b[i-1]))continue;
    var up=a[i-1]<=b[i-1]&&a[i]>b[i]&&pdoZoneOK(a,i,'up',zone),down=a[i-1]>=b[i-1]&&a[i]<b[i]&&pdoZoneOK(a,i,'down',zone);
    if((want==='up'||want==='both')&&up)return {age:age,index:i,direction:'up',label:'AL'};
    if((want==='down'||want==='both')&&down)return {age:age,index:i,direction:'down',label:'SAT'};
  }
  return null;
}
function pdoSeparatedBandSignal(k,a,b,mode,crossBars,bandWindow,len,mult,tolPct,order,zone){
  var n=a.length,lim=Math.min(Math.max(0,+crossBars||0),n-2),win=Math.max(1,+bandWindow||1),want=mode==='up'||mode==='down'?mode:'both',bb=bollArr(k.c,+len||20,+mult||2),tol=Math.max(0,+tolPct||0)/100;
  function bandAt(j){return j>=0&&j<n&&fin(bb.lo[j])&&(k.l[j]<=bb.lo[j]*(1+tol)||k.c[j]<=bb.lo[j]*(1+tol));}
  function hitAt(i,dist,dir){var j=dir==='before'?i-dist:i+dist;return bandAt(j)?j:-1;}
  for(var age=0;age<=lim;age++){
    var i=n-1-age;if(i<=0||!fin(a[i])||!fin(b[i])||!fin(a[i-1])||!fin(b[i-1]))continue;
    var up=a[i-1]<=b[i-1]&&a[i]>b[i]&&pdoZoneOK(a,i,'up',zone),down=a[i-1]>=b[i-1]&&a[i]<b[i]&&pdoZoneOK(a,i,'down',zone),label=up?'AL':down?'SAT':'',direction=up?'up':down?'down':'';
    if(!((want==='up'&&up)||(want==='down'&&down)||(want==='both'&&(up||down))))continue;
    var band=-1;
    for(var d=1;d<=win&&band<0;d++){
      if(order!=='crossThenBand'){var before=hitAt(i,d,'before');if(before>=0)band=before;}
      if(band<0&&order!=='bandThenCross'){var after=hitAt(i,d,'after');if(after>=0)band=after;}
    }
    if(band>=0)return {age:age,index:i,bandIndex:band,bandAge:n-1-band,direction:direction,label:label,lower:bb.lo[band],price:k.c[i]};
  }
  return null;
}
function levelExitSignal(o,mode,maxBars,low,high){
  var n=o.length,lim=Math.min(Math.max(0,+maxBars||0),n-2),want=mode==='up'||mode==='down'?mode:'both';
  for(var age=0;age<=lim;age++){
    var i=n-1-age;if(i<=0||!fin(o[i])||!fin(o[i-1]))continue;
    var up=o[i-1]<=low&&o[i]>low,down=o[i-1]>=high&&o[i]<high;
    if(up&&(want==='up'||want==='both'))return {age:age,index:i,direction:'up',label:'AL',value:o[i],from:o[i-1]};
    if(down&&(want==='down'||want==='both'))return {age:age,index:i,direction:'down',label:'SAT',value:o[i],from:o[i-1]};
  }
  return null;
}
function latestDivergence(k,osc,P){
  P=P||{};
  var n=k.c.length,recent=Math.max(1,Math.floor(+P.recent||4)),dir=P.dir||'both';
  var pat=pdoPatternScan(k,{raw:osc||[]},{bars:+P.bars||20,pivot:+P.pivot||2,tol:+P.tol||2,rise:+P.rise||2,divMin:P.divMin,live:P.live});
  function latestRecent(list,live){
    var e=list&&list.length?list[list.length-1]:null,lv=live&&live.length?live[live.length-1]:null;
    if(lv&&(!e||lv.to>=e.to))e=lv; // canlı (teyitsiz) uyumsuzluk daha yeniyse o
    return e&&n-1-e.to<=recent?e:null;
  }
  var ua=latestRecent(pat.ua,pat.uaLive),us=latestRecent(pat.us,pat.usLive),sig=null;
  if(dir==='up')sig=ua;else if(dir==='down')sig=us;else if(ua&&us)sig=ua.to>=us.to?ua:us;else sig=ua||us;
  return {sig:sig,ua:ua,us:us,uaAge:ua?n-1-ua.to:-1,usAge:us?n-1-us.to:-1,signalLabel:sig?sig.label:'',signalSide:sig?sig.side:'',signalAge:sig?n-1-sig.to:-1,signalLive:!!(sig&&sig.live),recent:recent,patterns:pat};
}
module.exports={hashSeed,mulberry32,fin,smaArr,emaArr,rsiArr,stochArr,bollArr,makeDemoKlines,moveAvg,moveMax,moveMin,moveTr,moveCtx,moveFeature,move01,moveScore,moveOscSeriesLegacy,moveOscSeries,pdoPivotIndices,pdoBetweenExtreme,pdoPatternScan,pivotLevelTouch,pdoZoneOK,pdoCrossEvents,pdoCrossSignal,pdoSeparatedBandSignal,levelExitSignal,latestDivergence};
