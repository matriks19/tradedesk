/* QX direct-Binance shim — coin piyasa verisini kullanıcının TARAYICISINDAN doğrudan Binance'ten çeker.
   Kapsam: fetch('/api/fapi/v1/...') → https://fapi.binance.com/fapi/v1/... (USDT-M perp + TradFi perp)
           fetch('/api/klines?...exchange=binance...') → fapi (".P") / data-api.binance.vision (spot)
   Ayar: localStorage.qx_coin_src = 'direct' (varsayılan) | 'proxy'.
   Direkt istek başarısız (CORS/ağ/451) → 10 dk boyunca otomatik sunucu proxy'si. 400 (Binance'te olmayan sembol) → o istek site proxy'sinden.
   418/429 → ban süresince Binance'e istek yok; 429 + Retry-After döner (proxy'ye YÜK AKTARILMAZ).
   Eşzamanlılık 4; X-MBX-USED-WEIGHT-1M okunabilirse limitin %60'ında dakika sonuna kadar bekler.
   İmzalı/emir istekleri (/api/exchange) etkilenmez. */
(function(){
  if(window.__qxDirect) return; window.__qxDirect=true;
  var orig=window.fetch.bind(window);
  var FAPI='https://fapi.binance.com/fapi/v1/', SPOT='https://data-api.binance.vision/api/v3/';
  var ALLOW={klines:1,'ticker/24hr':1,'ticker/price':1,exchangeInfo:1,ping:1,time:1,premiumIndex:1};
  var NATIVE={'1m':1,'3m':1,'5m':1,'15m':1,'30m':1,'1h':1,'2h':1,'4h':1,'6h':1,'8h':1,'12h':1,'1d':1,'3d':1,'1w':1,'1M':1};
  var st={broken:0,ban:0,w:0,wmin:0,active:0,q:[],n:0,fail:0,lastErr:''};
  window.QX_DIRECT={state:st,mode:mode,setMode:function(m){try{localStorage.setItem('qx_coin_src',m==='proxy'?'proxy':'direct');}catch(e){} st.broken=0;}};
  function mode(){try{return localStorage.getItem('qx_coin_src')==='proxy'?'proxy':'direct';}catch(e){return 'direct';}}
  function usable(){return mode()==='direct'&&Date.now()>st.broken;}
  function acq(){return new Promise(function(r){ if(st.active<4){st.active++;r();} else st.q.push(function(){st.active++;r();}); });}
  function rel(){st.active--;var f=st.q.shift();if(f)f();}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  function banResp(){var s=Math.max(1,Math.ceil((st.ban-Date.now())/1000));return new Response(JSON.stringify({code:-1003,error:'binance-ban',msg:'Binance geçici engel (tarayıcı IP)',banUntil:st.ban}),{status:429,headers:{'content-type':'application/json','retry-after':String(s)}});}
  async function direct(url){
    if(Date.now()<st.ban) return banResp();
    var m=Math.floor(Date.now()/60000);
    if(st.wmin===m&&st.w>=2400*0.6) await sleep(60000-(Date.now()%60000)+250);
    await acq();
    try{
      if(Date.now()<st.ban) return banResp();
      var r=await orig(url,{cache:'no-store'});
      var w=+(r.headers.get('x-mbx-used-weight-1m')||NaN); if(isFinite(w)){st.w=w;st.wmin=Math.floor(Date.now()/60000);}
      if(r.status===418||r.status===429){
        var ra=+(r.headers.get('retry-after')||0); st.ban=Date.now()+Math.max(r.status===418?120:60,ra||0)*1000; return banResp();
      }
      if(r.status===451||r.status===403){ throw new Error('bölge '+r.status); }
      st.n++; return r;
    }finally{rel();}
  }
  function fail(e){st.fail++;st.lastErr=String(e&&e.message||e);st.broken=Date.now()+10*60000;try{console.warn('[QX direct] proxy\'ye düşüldü:',st.lastErr);}catch(_){}}
  window.fetch=function(input,init){
    try{
      var u=typeof input==='string'?input:(input&&input.url)||'';
      if(!usable()||(init&&init.method&&init.method!=='GET')) return orig(input,init);
      var p=u.replace(/^https?:\/\/[^/]+/,'');
      var m=/^\/api\/fapi\/v1\/([a-zA-Z/0-9]+)(\?.*)?$/.exec(p);
      if(m&&ALLOW[m[1]]){
        var durl=FAPI+m[1]+(m[2]||'');
        return direct(durl).then(function(r){return r.status===400?orig(input,init):r;}).catch(function(e){fail(e);return orig(input,init);}); /* 400 (ör. -1121 Invalid symbol: Binance'te olmayan perp) → site proxy (Bybit/OKX/Gate zinciri) */
      }
      if(/^\/api\/klines\?/.test(p)){
        var q=new URLSearchParams(p.split('?')[1]);
        if((q.get('exchange')||'binance')==='binance'){
          var sym=(q.get('symbol')||'BTCUSDT').trim(), tf=q.get('timeframe')||'15m', lim=Math.min(1000,+q.get('limit')||500);
          var iv=NATIVE[tf]?tf:NATIVE[tf.toLowerCase()]?tf.toLowerCase():null;
          if(iv){
            var perp=/\.P$/i.test(sym), rs=sym.replace(/\.P$/i,'').toUpperCase();
            var durl2=(perp?FAPI:SPOT)+'klines?symbol='+encodeURIComponent(rs)+'&interval='+iv+'&limit='+lim;
            return direct(durl2).then(function(r){
              if(r.status===400) return orig(input,init); /* sembol Binance'te yok → site proxy */
              if(!r.ok) return r;
              return r.json().then(function(rows){
                var candles=(rows||[]).map(function(x){return {time:Math.floor(+x[0]/1000),open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]};});
                return new Response(JSON.stringify({candles:candles,delayed:false,feed:perp?'binance-direct':'binance-spot-direct'}),{status:200,headers:{'content-type':'application/json'}});
              });
            }).catch(function(e){fail(e);return orig(input,init);});
          }
        }
      }
    }catch(e){}
    return orig(input,init);
  };
})();
