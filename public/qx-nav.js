/* [bridge138] Ortak üst menü: Grafik / Liste Tarama / QUANTEX İzleme / Radar / Robot. Sadece 'qx_nav_min' anahtarını yazar. */
(function(){function go(){if(document.getElementById('qxNav'))return;
var p=location.pathname,L=[['📈 Grafik','/',p==='/'&&!/tab=list/.test(location.search)],['🔎 Liste Tarama','/?tab=list',/tab=list/.test(location.search)],['📊 QUANTEX İzleme','/quantex.html',/quantex/.test(p)&&location.hash!=='#robot'],['🛰 Radar','/radar.html',/radar/.test(p)],['🤖 Robot','/quantex.html#robot',/quantex/.test(p)&&location.hash==='#robot']];
var d=document.createElement('div');d.id='qxNav';
d.style.cssText='position:fixed;top:2px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;gap:4px;background:rgba(8,14,28,.92);border:1px solid #2a3a5a;border-radius:10px;padding:3px 6px;font:600 15px Inter,system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.5)';
var min=false;try{min=localStorage.getItem('qx_nav_min')==='1';}catch(e){}
function draw(){d.innerHTML='';if(min){var b=document.createElement('a');b.textContent='☰ Menü';b.href='#';b.style.cssText='color:#cfe;text-decoration:none;padding:2px 8px';b.onclick=function(e){e.preventDefault();min=false;try{localStorage.setItem('qx_nav_min','0');}catch(x){}draw();};d.appendChild(b);return;}
L.forEach(function(x){var a=document.createElement('a');a.textContent=x[0];a.href=x[1];a.style.cssText='color:'+(x[2]?'#fff':'#9fb3d1')+';background:'+(x[2]?'#1f6feb':'transparent')+';text-decoration:none;padding:3px 9px;border-radius:7px;white-space:nowrap';
 if(x[1]==='/quantex.html#robot'&&/quantex/.test(p))a.onclick=function(){setTimeout(function(){try{window.switchMainTab('robot');}catch(e){}},50);};d.appendChild(a);});
var c=document.createElement('a');c.textContent='–';c.href='#';c.title='Küçült';c.style.cssText='color:#9fb3d1;text-decoration:none;padding:3px 6px';c.onclick=function(e){e.preventDefault();min=true;try{localStorage.setItem('qx_nav_min','1');}catch(x){}draw();};d.appendChild(c);}
draw();document.body.appendChild(d);
if(/quantex/.test(p)&&location.hash==='#robot')setTimeout(function(){try{window.switchMainTab('robot');}catch(e){}},1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();})();
