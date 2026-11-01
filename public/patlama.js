/* Patlama Gücü (PG) 0–100 — tarayıcı sürümü; src/lib/watch/patlama.ts ile birebir aynı hesap (robot = grafik).
 * QXPatlama.components(bars, {btc: Map(t→close), fund: [[t, oran],…]}) · QXPatlama.at(C, i) · QXPatlama.series(C, n). Yalnız izleme. */
(function(root){
'use strict';
var W=200,H4=144e5;
function fin(x){return typeof x==='number'&&isFinite(x);}
function rpct(x,w){w=w||W;var n=x.length,o=new Array(n).fill(NaN);for(var i=w-1;i<n;i++){var v=x[i];if(!fin(v))continue;var cnt=0,tot=0;for(var j=i-w+1;j<=i;j++){var y=x[j];if(fin(y)){tot++;if(y<=v)cnt++;}}if(tot>=Math.floor(w/2))o[i]=100*cnt/tot;}return o;}
function rsum(a,n){var o=new Array(a.length).fill(NaN),s=0,q=[];for(var i=0;i<a.length;i++){var v=fin(a[i])?a[i]:0;s+=v;q.push(v);if(q.length>n)s-=q.shift();if(i>=n-1)o[i]=s;}return o;}
function atrN(b,n){var L=b.length,o=new Array(L).fill(NaN);if(L<n)return o;var tr=b.map(function(x,i){var pc=i?b[i-1].close:b[0].close;return Math.max(x.high-x.low,Math.abs(x.high-pc),Math.abs(x.low-pc));});var a=0,i;for(i=0;i<n;i++)a+=tr[i];a/=n;o[n-1]=a;for(i=n;i<L;i++){a=(a*(n-1)+tr[i])/n;o[i]=a;}return o;}
function bbw20(c){var n=c.length,o=new Array(n).fill(NaN);for(var i=19;i<n;i++){var s=0,j;for(j=i-19;j<=i;j++)s+=c[j];var m=s/20,q=0;for(j=i-19;j<=i;j++)q+=Math.pow(c[j]-m,2);o[i]=Math.sqrt(q/19)/m;}return o;}
function minPrev(a,n){var o=new Array(a.length).fill(NaN);for(var i=n;i<a.length;i++){var m=Infinity,ok=true;for(var j=i-n;j<i;j++){if(!fin(a[j])){ok=false;break;}if(a[j]<m)m=a[j];}if(ok)o[i]=m;}return o;}
function avg2(a,b){return a.map(function(v,i){return (v+b[i])/2;});}
function components(b,opt){opt=opt||{};var n=b.length,H=opt.tfMs||H4,C={};
 var c=b.map(function(x){return x.close;}),h=b.map(function(x){return x.high;}),l=b.map(function(x){return x.low;});
 var qv=b.map(function(x){return fin(x.qv)?x.qv:NaN;}),hasQv=qv.filter(fin).length>0.9*n;
 var rng=b.map(function(x){return x.high-x.low>0?x.high-x.low:NaN;});
 var clv=b.map(function(x,i){return ((x.close-x.low)-(x.high-x.close))/rng[i];}),body=b.map(function(x,i){return (x.close-x.open)/rng[i];});
 var qvx=hasQv?qv:b.map(function(x){return x.volume*x.close;});
 var num=rsum(clv.map(function(v,i){return (fin(v)?v:0)*qvx[i];}),6),den=rsum(qvx,6);
 C.VPA=avg2(rpct(num.map(function(v,i){return v/den[i];})),rpct(rsum(body,6).map(function(v){return v/6;})));
 var A20=atrN(b,20),bw=minPrev(bbw20(c),10);
 var r2=b.map(function(x,i){return (Math.max(h[i],i?h[i-1]:h[0])-Math.min(l[i],i?l[i-1]:l[0]))/A20[i];});
 C.SQZ=avg2(rpct(bw).map(function(v){return 100-v;}),rpct(r2));
 if(opt.btc&&opt.btc.size){var rs=b.map(function(x){var bc=opt.btc.get(x.t);return bc?Math.log(x.close)-Math.log(bc):NaN;});
  if(rs.filter(fin).length>0.5*n){var d=function(k){return rs.map(function(v,i){return i>=k?v-rs[i-k]:NaN;});};C.RS=avg2(rpct(d(6)),rpct(d(20)));}}
 var tbq=b.map(function(x){return fin(x.tbq)?x.tbq:NaN;});
 if(hasQv&&tbq.filter(fin).length>0.9*n){var a=rsum(tbq,6);C.TAKER=rpct(a.map(function(v,i){return v/den[i];}));}
 if(opt.fund&&opt.fund.length){var F=opt.fund,k=-1;var fv=b.map(function(x){var tc=x.t+H;while(k+1<F.length&&F[k+1][0]<=tc)k++;return k>=0?F[k][1]:NaN;});C.FUND=rpct(fv).map(function(v){return 100-v;});}
 return C;}
var K5=['VPA','SQZ','RS','TAKER','FUND'],K3=['VPA','SQZ','RS'];
function at(C,i){var v=function(k){return C[k]?C[k][i]:NaN;},comps={};K5.forEach(function(k){if(fin(v(k)))comps[k]=+v(k).toFixed(1);});
 var missing=K5.filter(function(k){return !fin(v(k));}),mean=function(ks){return ks.reduce(function(a,k){return a+v(k);},0)/ks.length;};
 if(K5.every(function(k){return fin(v(k));}))return {score:mean(K5),mode:'PG5',comps:comps,missing:missing};
 if(K3.every(function(k){return fin(v(k));}))return {score:mean(K3),mode:'PG3',comps:comps,missing:missing};
 var av=['VPA','SQZ'].filter(function(k){return fin(v(k));});return {score:av.length?mean(av):NaN,mode:'PG-eksik',comps:comps,missing:missing};}
function series(C,n){var o=new Array(n);for(var i=0;i<n;i++){var p=at(C,i);o[i]=p.mode==='PG-eksik'?NaN:p.score;}return o;}
root.QXPatlama={components:components,at:at,series:series,rpct:rpct,PASS:50};
})(typeof window!=='undefined'?window:globalThis);
