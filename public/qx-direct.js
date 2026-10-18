/* QX direct-Binance shim v128 — coin piyasa verisini kullanıcının TARAYICISINDAN doğrudan Binance'ten çeker; olmazsa site yedeğine düşer.
   Kapsam: fetch('/api/fapi/v1/...')                  → https://fapi.binance.com/fapi/v1/...  (yedek: aynı /api/fapi yolu = site Bybit/OKX/Gate zinciri)
           fetch('/api/klines?...exchange=binance...') → fapi (".P") / data-api.binance.vision (spot)  (yedek: aynı /api/klines yolu)
           fetch('https://fapi.binance.com/fapi/v1/...')  → direkt; yedek /api/fapi/v1/...
           fetch('https://(api|data-api).binance.(com|vision)/api/v3/klines|ticker/price|ticker/24hr') → direkt; yedek /api/klines (spot, Binance biçimine çevrilir) / /api/fapi/v1/ticker/*
   Ayar: localStorage.qx_coin_src = 'direct' (varsayılan) | 'proxy'.
   Yedeğe düşme: ağ/CORS hatası ('Failed to fetch'), 8 sn zaman aşımı, 403/451 → 10 dk; 418/429 → Retry-After (418'de en az 10 dk, en çok 6 sa).
   Bu süreler sekme boyunca sessionStorage (qx_direct_ban / qx_direct_broken) ile paylaşılır; iframe/yenilemede Binance tekrar denenmez.
   Yedek istekler ≤4 istek/sn, eşzamanlılık 4. 400 (Binance'te olmayan sembol) → o istek site yedeğinden.
   İmzalı/emir istekleri (/api/exchange) etkilenmez. */
(function(){
  if(window.__qxDirect) return; window.__qxDirect=true;
  var orig=window.fetch.bind(window);
  var FAPI='https://fapi.binance.com/fapi/v1/', SPOT='https://data-api.binance.vision/api/v3/';
  var ALLOW={klines:1,'ticker/24hr':1,'ticker/price':1,exchangeInfo:1,ping:1,time:1,premiumIndex:1};
  var NATIVE={'1m':1,'3m':1,'5m':1,'15m':1,'30m':1,'1h':1,'2h':1,'4h':1,'6h':1,'8h':1,'12h':1,'1d':1,'3d':1,'1w':1,'1M':1};
  var IVMS={'1m':6e4,'3m':18e4,'5m':3e5,'15m':9e5,'30m':18e5,'1h':36e5,'2h':72e5,'4h':144e5,'6h':216e5,'8h':288e5,'12h':432e5,'1d':864e5,'3d':2592e5,'1w':6048e5,'1M':2592e6};
  var TMO=8000;
  var st={broken:0,ban:0,w:0,wmin:0,active:0,q:[],n:0,fail:0,lastErr:'',viaProxy:0,src:'',why:''};
  function ssg(k){try{return +sessionStorage.getItem(k)||0;}catch(e){return 0;}}
  function sss(k,v){try{sessionStorage.setItem(k,String(v));}catch(e){}}
  st.ban=ssg('qx_direct_ban');st.broken=ssg('qx_direct_broken');
  window.QX_DIRECT={state:st,mode:mode,source:srcLabel,setMode:function(m){try{localStorage.setItem('qx_coin_src',m==='proxy'?'proxy':'direct');}catch(e){} st.broken=0;sss('qx_direct_broken',0);}};
  function mode(){try{return localStorage.getItem('qx_coin_src')==='proxy'?'proxy':'direct';}catch(e){return 'direct';}}
  function blocked(){return Date.now()<st.ban||Date.now()<st.broken;}
  function usable(){return mode()==='direct'&&!blocked();}
  function srcLabel(){if(usable()&&!st.viaProxy)return 'Binance (tarayıcı)';var s=st.src||'';s=s.replace(/^futures:/,'').replace(/^spot:/,'');return 'site yedeği'+(s?' · '+s.charAt(0).toUpperCase()+s.slice(1):'');}
  function acq(){return new Promise(function(r){ if(st.active<4){st.active++;r();} else st.q.push(function(){st.active++;r();}); });}
  function rel(){st.active--;var f=st.q.shift();if(f)f();}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var plast=0;
  function setBan(t,why){st.ban=Math.max(st.ban,t);sss('qx_direct_ban',st.ban);note(why);}
  function fail(e){st.fail++;st.lastErr=String(e&&e.message||e);st.broken=Date.now()+10*60000;sss('qx_direct_broken',st.broken);note(st.lastErr);try{console.warn('[QX direct] site yedeğine düşüldü:',st.lastErr);}catch(_){}}
  /* --- küçük durum rozeti (yedek kullanılırken) --- */
  var pill=null,pt=0;
  function note(why){if(why)st.why=why;if(pt)return;pt=setTimeout(function(){pt=0;try{if(!document.body)return;if(!pill){pill=document.createElement('div');pill.id='qxDirectPill';pill.style.cssText='position:fixed;right:10px;bottom:10px;z-index:2147483000;background:rgba(15,23,42,.94);color:#fde68a;border:1px solid #f59e0b;border-radius:10px;padding:6px 10px;font:600 12.5px/1.35 system-ui,sans-serif;max-width:360px;box-shadow:0 4px 18px rgba(0,0,0,.35);cursor:pointer';pill.title='Kapatmak için tıklayın';pill.onclick=function(){pill.style.display='none';};document.body.appendChild(pill);}
      pill.textContent='⚠ Binance bu tarayıcıdan erişilemiyor ('+(st.why||'engel').slice(0,60)+') → veriler '+srcLabel()+' üzerinden · '+st.viaProxy+' istek';}catch(e){}},400);}
  async function proxied(input,init){var t=Math.max(Date.now(),plast+250);plast=t;if(t>Date.now())await sleep(t-Date.now());await acq();
    try{st.viaProxy++;var r=await orig(input,init);var s=r.headers&&r.headers.get('x-qx-src');if(s)st.src=s;note();return r;}finally{rel();}}
  function banResp(){var s=Math.max(1,Math.ceil((st.ban-Date.now())/1000));return new Response(JSON.stringify({code:-1003,error:'binance-ban',msg:'Binance geçici engel (tarayıcı IP)',banUntil:st.ban}),{status:429,headers:{'content-type':'application/json','retry-after':String(s)}});}
  /* direkt istek: 8 sn zaman aşımı + çağıranın signal'i; ağ/CORS/zaman aşımı → throw (çağıran yedeğe düşer) */
  async function direct(url,init){
    if(Date.now()<st.ban) return banResp();
    var m=Math.floor(Date.now()/60000);
    if(st.wmin===m&&st.w>=2400*0.6) await sleep(60000-(Date.now()%60000)+250);
    await acq();
    var ctl=typeof AbortController!=='undefined'?new AbortController():null,to=null,us=init&&init.signal,onAb=null;
    try{
      if(Date.now()<st.ban) return banResp();
      if(ctl){to=setTimeout(function(){try{ctl.abort();}catch(e){}},TMO);if(us){if(us.aborted)ctl.abort();else{onAb=function(){try{ctl.abort();}catch(e){}};us.addEventListener('abort',onAb);}}}
      var r;
      try{r=await orig(url,ctl?{cache:'no-store',signal:ctl.signal}:{cache:'no-store'});}
      catch(e){if(us&&us.aborted)throw e; throw new Error(e&&e.name==='AbortError'?'Binance zaman aşımı ('+TMO/1000+' sn)':'ağ/CORS hatası: '+(e&&e.message||e));}
      var w=+(r.headers.get('x-mbx-used-weight-1m')||NaN); if(isFinite(w)){st.w=w;st.wmin=Math.floor(Date.now()/60000);}
      if(r.status===418||r.status===429){
        var ra=+(r.headers.get('retry-after')||0); setBan(Date.now()+Math.min(6*3600,Math.max(r.status===418?600:60,ra||0))*1000,'HTTP '+r.status); return banResp();
      }
      if(r.status===451||r.status===403){ throw new Error('bölge/erişim '+r.status); }
      if(r.status>=500){ throw new Error('Binance HTTP '+r.status); }
      st.n++; return r;
    }finally{if(to)clearTimeout(to);if(us&&onAb)try{us.removeEventListener('abort',onAb);}catch(e){}rel();}
  }
  /* direkt dene → olmazsa yedek (fb: Request|string ya da Promise döndüren fonksiyon) */
  function viaDirect(durl,init,fb){
    var F=typeof fb==='function'?fb:function(){return proxied(fb,init);};
    if(!usable()) return F();
    return direct(durl,init).then(function(r){
      if(r.status===400) return typeof fb==='function'?F():orig(fb,init); /* Binance'te olmayan sembol → site */
      if(r.status===429&&Date.now()<st.ban) return F(); /* Binance engeli → site yedeği */
      return r;
    },function(e){if(init&&init.signal&&init.signal.aborted)throw e;fail(e);return F();});
  }
  /* spot klines yedeği: /api/klines {candles} → Binance dizi biçimi */
  function spotKlinesFb(q,init){
    var sym=(q.get('symbol')||'BTCUSDT').toUpperCase(),iv=q.get('interval')||'1h',lim=Math.min(1000,+q.get('limit')||500);
    var u='/api/klines?exchange=binance&symbol='+encodeURIComponent(sym)+'&timeframe='+encodeURIComponent(iv)+'&limit='+lim+(q.get('endTime')?'&endTime='+q.get('endTime'):'')+(q.get('startTime')?'&startTime='+q.get('startTime'):'');
    return proxied(u,init?{signal:init.signal}:undefined).then(function(r){
      if(!r.ok) return r;
      return r.json().then(function(j){var ms=IVMS[iv]||36e5;var rows=(j&&j.candles||[]).map(function(c){var t=c.time*1000;return [t,String(c.open),String(c.high),String(c.low),String(c.close),String(c.volume),t+ms-1,String(c.volume*c.close),0,'0','0','0'];});
        return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json','x-qx-src':r.headers.get('x-qx-src')||'spot:site'}});});
    });
  }
  window.fetch=function(input,init){
    try{
      var u=typeof input==='string'?input:(input&&input.url)||'';
      if(init&&init.method&&init.method!=='GET') return orig(input,init);
      if(input&&typeof input!=='string'&&input.method&&input.method!=='GET') return orig(input,init);
      var p=u.replace(/^https?:\/\/[^/]+/,''),host=(/^https?:\/\/([^/]+)/.exec(u)||[])[1]||'';
      var own=!host||host===location.host;
      var px=mode()==='proxy';
      /* 1) site yolu /api/fapi/v1/* */
      var m=own&&/^\/api\/fapi\/v1\/([a-zA-Z/0-9]+)(\?.*)?$/.exec(p);
      if(m&&ALLOW[m[1]]){
        if(px) return orig(input,init);
        return viaDirect(FAPI+m[1]+(m[2]||''),init,input);
      }
      /* 2) site yolu /api/klines?exchange=binance */
      if(own&&/^\/api\/klines\?/.test(p)){
        if(px) return orig(input,init);
        var q=new URLSearchParams(p.split('?')[1]);
        if((q.get('exchange')||'binance')==='binance'){
          var sym=(q.get('symbol')||'BTCUSDT').trim(), tf=q.get('timeframe')||'15m', lim=Math.min(1000,+q.get('limit')||500);
          var iv=NATIVE[tf]?tf:NATIVE[tf.toLowerCase()]?tf.toLowerCase():null;
          if(iv&&!q.get('endTime')&&!q.get('startTime')){
            var perp=/\.P$/i.test(sym), rs=sym.replace(/\.P$/i,'').toUpperCase();
            var durl2=(perp?FAPI:SPOT)+'klines?symbol='+encodeURIComponent(rs)+'&interval='+iv+'&limit='+lim;
            if(!usable()) return proxied(input,init);
            return direct(durl2,init).then(function(r){
              if(r.status===400) return orig(input,init); /* sembol Binance'te yok → site */
              if(r.status===429&&Date.now()<st.ban) return proxied(input,init);
              if(!r.ok) return r;
              return r.json().then(function(rows){
                var candles=(rows||[]).map(function(x){return {time:Math.floor(+x[0]/1000),open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]};});
                return new Response(JSON.stringify({candles:candles,delayed:false,feed:perp?'binance-direct':'binance-spot-direct'}),{status:200,headers:{'content-type':'application/json'}});
              });
            },function(e){if(init&&init.signal&&init.signal.aborted)throw e;fail(e);return proxied(input,init);});
          }
        }
        return orig(input,init);
      }
      /* 3) mutlak Binance vadeli adresi */
      var mf=/^https:\/\/fapi\.binance\.com\/fapi\/v1\/([a-zA-Z/0-9]+)(\?.*)?$/.exec(u);
      if(mf&&ALLOW[mf[1]]){
        var fbu='/api/fapi/v1/'+mf[1]+(mf[2]||'');
        if(px) return proxied(fbu,init?{signal:init.signal}:undefined);
        return viaDirect(u,init,fbu);
      }
      /* 4) mutlak Binance spot adresi */
      var ms=/^https:\/\/(?:api\.binance\.com|data-api\.binance\.vision)\/api\/v3\/(klines|ticker\/price|ticker\/24hr)(\?.*)?$/.exec(u);
      if(ms){
        var qs=ms[2]||'',fbF=ms[1]==='klines'?function(){return spotKlinesFb(new URLSearchParams(qs.slice(1)),init);}:function(){return proxied('/api/fapi/v1/'+ms[1]+qs,init?{signal:init.signal}:undefined);};
        if(px) return fbF();
        return viaDirect(u,init,fbF);
      }
    }catch(e){}
    return orig(input,init);
  };
})();
