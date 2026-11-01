/* Radar v13 · sade yerleşim katmanı.
   radar.js'in hesaplama/çizim mantığına dokunmaz: mevcut panelleri (aynı id'lerle) bölümlere taşır,
   her bloğa kısa açıklama ekler, sıralanabilir "Aday tablosu" ve İzleme robotu özetini (/api/watch-report) ekler.
   Salt okuma: işlem açmaz, sır/anahtar içermez. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var nf=function(v,d){return v==null||!isFinite(v)?'—':(+v).toLocaleString('tr-TR',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});};
var pct=function(v,d){return v==null||!isFinite(v)?'—':'<span class="'+(v>=0?'rxG':'rxR')+'">'+(v>=0?'+':'−')+nf(Math.abs(v),d==null?2:d)+'%</span>';};
function fp(v){if(v==null||!isFinite(v))return '—';var a=Math.abs(v),d=a>=1000?1:a>=100?2:a>=1?3:a>=0.01?4:6;return nf(v,d);}
function dt(ms){if(!ms)return '—';var p={};new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(ms)).forEach(function(x){p[x.type]=x.value;});return p.day+'.'+p.month+' '+p.hour+':'+p.minute;}

/* ---------- bölümler ---------- */
var SECS=[
 {id:'adaylar',ic:'🎯',nm:'Adaylar',h:'Sinyale yakın adaylar',
  d:'Radar, seçtiğin evrendeki coin ve BIST hisselerini mum mum tarar ve her biri için "sinyale hazırlık %" hesaplar. %100 = strateji koşullarının hepsi tamam, sinyal oluştu. Tablo sıralanabilir; isme tıklayınca grafik açılır.',
  cards:['cWhy','cWatch']},
 {id:'umut',ic:'🌱',nm:'Umut',h:'Umut — KAL + RSI uyumsuzluğu (4s)',
  d:'Testi geçen tek kural: 4 saatlikte KAL boğa uyumsuzluğu ile RSI14 boğa uyumsuzluğu 5 mum içinde birlikte gelir. İzleme robotu ilk 200 coini tarar, sinyali kaydeder ve 100 mum boyunca izler: R1 +%10 (test edilen hedef), R2 +%20, R3 +%30, stop = giriş − 2 ATR. Yalnız izleme, işlem açılmaz.',cards:[]},
 {id:'ikili',ic:'✦',nm:'İkili',h:'✦ İkili: KDC-MACD + Uyumsuzluk (4s) — patlama ihtimali',
  d:'Aynı coinde KDC-MACD sinyali (30dk KDC K↑D → ≤10 saat içinde 1s MACD yukarı kesişim) ile Umut sinyali (4s KAL + RSI14 boğa uyumsuzluğu) birbirinden 5 mumdan az arayla (4s) gelir. İzleme robotu Umut sinyali olan coinlerde KDC-MACD’yi de hesaplar, son 30 mumu geriye doldurur, yeni sinyalde (yaş 0–2 mum) ntfy gönderir ve 100 mum izler: R1 +%10, R2 +%20, R3 +%30, stop = giriş − 2 ATR. Bu kombinasyon test edilmedi; yalnız izleme, işlem açılmaz.',cards:[]},
 {id:'izleme',ic:'📡',nm:'İzleme sinyalleri',h:'İzleme robotu sinyalleri',
  d:'GitHub üzerinde 2 saatte bir çalışan izleme robotunun bulduğu sinyaller (EK v3 DIV, L/S uyumsuzluk, Dual, RSI30). Robot ilk 200 coin + 200 BIST hissesini tarar; yalnız uyarı üretir, işlem açmaz. Tüm sütunlar ve geçmiş için Robot Paneli\'ne geç.',cards:[]},
 {id:'harita',ic:'🗺',nm:'Görsel harita',h:'Görsel harita (isteğe bağlı)',
  d:'Aday tablosundaki verinin görsel hâli. Merkeze yakın = sinyale yakın. Üstteki düğmelerle Tablo / 2D radar / 3D görünüm arasında geçebilirsin. "Zaman makinesi" son 30/60 günün sinyallerini lab kurallarıyla yeniden oynatır (canlı değildir).',cards:['hero']},
 {id:'piyasa',ic:'🌡',nm:'Piyasa durumu',h:'Piyasa durumu',
  d:'Genel piyasa ne durumda? Stres seviyesi, rejim (sakin / stres / yükseliş / düşüş), saat bazlı likidite ve son 72 saatin sinyal akışı. Brifing ve günlük özet tek metinde toplar, kopyalanabilir.',
  cards:['cPulse','cRegime','cBrief','cDaily','cRiver','cSess','cRmap']},
 {id:'portfoy',ic:'💼',nm:'Portföy & risk',h:'Portföy ve risk',
  d:'Açık pozisyonlar, kağıt simülasyon ve risk kontrolleri. Robotun kendi pozisyonları ve geçmiş koşuları Robot Paneli\'nde ayrıntılı; burada yalnız özet görünür.',
  cards:['cPort','cRobot','cSim','cClust','cStress','cContra']},
 {id:'lab',ic:'🧪',nm:'Geri test (Lab)',h:'Geri test ve strateji sağlığı',
  d:'Stratejilerin geçmiş veride (LAB) ve canlıda (CANLI) nasıl çalıştığı. Bu bloklar karar vermek için değil, stratejilere ne kadar güvenebileceğini görmek için.',
  cards:['cKarne','cMirror','cHealth','cOto','cEvr','cCap','cWF','cPfol','cExit']},
 {id:'alarm',ic:'🔔',nm:'Alarmlar',h:'Alarmlar',
  d:'Bir aday sinyal verdiğinde tarayıcı bildirimi, ses veya ntfy ile haber alabilirsin. Varsayılan kapalıdır; ayarlar yalnız bu tarayıcıda saklanır.',cards:['cAlarm']}
];
var WIDE={cRegime:1,cHealth:1,cWhy:1,cWatch:1,cOto:1,cRmap:1,cEvr:1,cCap:1,cWF:1,cPfol:1,cExit:1,cKarne:1,cStress:1,cRiver:1,hero:1};
var DESC={
 cPulse:'Coin sepetinin genel stresi. 100 ve üzeri = piyasada sert, toplu satış var. Altta sektör sektör kaç coinin para girişi (OBV) yükselişte/düşüşte olduğu ve 24 saatlik değişim ısı şeridi.',
 cRegime:'Piyasa şu an hangi modda (sakin, stres, yükseliş, düşüş) ve geçmiş testte bu modda hangi strateji iyi çalışmış.',
 cBrief:'Rejim, en yakın adaylar ve eksik koşulları, BIST z&lt;−2 hisseleri ve açık pozisyonların tek metinlik özeti. Yapay zekâ değil, sabit şablon.',
 cDaily:'Günün tek ekranlık özeti (TSİ). Kopyalayıp not alabilirsin.',
 cRiver:'Son 72 saatte hangi sembolde hangi stratejinin sinyali çıktı: soldan sağa zaman çizelgesi.',
 cSess:'Günün saatine göre işlem hacmi ve geçmiş testte hangi saatlerde sinyallerin daha isabetli olduğu (TSİ).',
 cRmap:'Geçmiş testte trend ve oynaklığa göre her stratejinin başarısı; bugünkü piyasa konumu işaretli.',
 cPort:'Canlı Portföy A pozisyonları; her birinin yanında geri testteki benzer sonuç (lab rozeti).',
 cRobot:'Kağıt robotun özet durumu (salt okuma). Pozisyonlar, defterler ve geçmiş koşular için <a href="/panel.html#robot">Robot Paneli →</a>',
 cSim:'Radar sinyallerini sinyal başına $10 × 2x ile kağıt üzerinde izleyen simülasyon. Yalnız bu tarayıcıda saklanır, gerçek emir yoktur.',
 cClust:'Pozisyonlar ve adaylar birbirine ne kadar benziyor? Birlikte hareket eden coinler aynı riski taşır; "etkin N" gerçek çeşitlendirme sayısıdır.',
 cStress:'BTC belli oranda düşerse açık pozisyonlar ne kadar etkilenir (beta ile) ve acil stop nerede devreye girer: senaryo testi.',
 cContra:'Kalabalığın tersine erken/geç giriş fikirleri; önceden kayda alınmış (ön-kayıt) test sonuçlarıyla.',
 cKarne:'Her stratejinin geri test (LAB) ve canlı (CANLI) sonuçları yan yana: işlem sayısı, kazanma oranı, kâr faktörü. CSV olarak indirilebilir.',
 cMirror:'Canlı sonuçlar geri testle uyumlu mu? Büyük sapma = strateji canlıda farklı davranıyor olabilir.',
 cHealth:'Her stratejinin canlı performansı istatistiksel olarak bozuluyor mu (bootstrap + CUSUM uyarısı).',
 cOto:'YO6 MA stratejisinin son 20 canlı işlemdeki zayıflamasının nedenleri: şans mı, piyasa değişimi mi?',
 cEvr:'Strateji hangi coin listesinde daha iyi çalışıyor: geri testteki 37 coin (Lab37), hacimde ilk 50, yeni listelenen coinler.',
 cCap:'Aynı mumda kaç girişe izin verilmeli? 2 veya 3 sınırının rastgele seçime göre sonucu.',
 cWF:'Kurallar farklı dönemlerde de çalışıyor mu? 3 ay eğitim / 1 ay test, kurallar sabit.',
 cPfol:'Üç strateji birlikte işletilseydi özsermaye eğrisi, aylık sonuçlar ve stratejiler arası korelasyon.',
 cExit:'YO6 MA için farklı çıkış kurallarının (süre, hedef, stop) geri testte karşılaştırması.',
 cWhy:'En yakın 5 adayın hangi koşulları tamam (✓), hangileri eksik (✗) ve geçmişteki en benzer 5 kurulumun sonucu.',
 cWatch:'★ ile sabitlediğin semboller. Eklemek için üstteki "🔍 Ara" (Ctrl+K) penceresinde sembolün yanındaki ☆\'a bas.',
 cAlarm:'Alarm türlerini buradan aç/kapat. ntfy konusu yalnız bu tarayıcıda saklanır, sunucuya gönderilmez.'
};
var CUR='adaylar';
function build(){
 var main=$('rxMain')||document.querySelector('main');if(!main||$('rxSide'))return;
 var side=document.createElement('nav');side.className='rxSide';side.id='rxSide';
 side.innerHTML=SECS.map(function(s){return '<button data-s="'+s.id+'"><span class="ic">'+s.ic+'</span>'+esc(s.nm)+'<span class="bd" id="rxBd-'+s.id+'" style="display:none"></span></button>';}).join('')+
  '<div class="rxFoot">Radar tarayıcında çalışır; sayfa kapanınca durur.<br><a href="/panel.html">🤖 Robot Paneli</a> · <a href="/quantex.html">📊 QUANTEX</a><br>Saatler TSİ.</div>';
 var body=document.createElement('div');body.className='rxBody';body.id='rxBody';
 SECS.forEach(function(s){var sec=document.createElement('section');sec.className='rxSec';sec.id='rx-'+s.id;
  sec.innerHTML='<h2>'+s.ic+' '+esc(s.h)+'</h2><p class="rxIntro">'+s.d.replace("Robot Paneli'ne geç",'<a href="/panel.html#izleme">Robot Paneli\'ne geç →</a>').replace("Robot Paneli'nde ayrıntılı",'<a href="/panel.html">Robot Paneli</a>\'nde ayrıntılı')+'</p>';
  if(s.id==='adaylar')sec.insertAdjacentHTML('beforeend','<div class="rxK" id="rxKpi"></div><div class="rxCard" id="rxCand"><h3>Aday tablosu <span class="r" id="rxCandT"></span></h3><div class="rxD">Hazırlık bantları: <span class="rxSt rxb-sig">100 SİNYAL</span> <span class="rxSt rxb-hzr">70–99 hazır olmak üzere</span> <span class="rxSt rxb-yak">40–69 yaklaşıyor</span> <span class="rxSt rxb-uzk">0–39 uzak</span> · "Koşul" = tamamlanan koşul sayısı · "İzleme" = aynı sembolde izleme robotunun açık sinyali var.</div><div class="rxBar" id="rxCandBar"></div><div id="rxCandBody"><div class="rxEmpty">Tarama sürüyor… ilk sonuçlar birkaç saniye içinde gelir.</div></div></div>');
  if(s.id==='izleme')sec.insertAdjacentHTML('beforeend','<div class="rxNote" id="rxUniv">İzleme raporu yükleniyor…</div><div class="rxSc" id="rxWsc"></div><div class="rxCard"><h3>Sinyaller <span class="r" id="rxWst"></span></h3><div class="rxBar" id="rxWbar"></div><div id="rxWbody"></div></div>');
  if(s.id==='umut'||s.id==='ikili'){var P=UCF[s.id].p;sec.insertAdjacentHTML('beforeend',('<div class="rxNote" id="rxUnote">Umut sinyalleri yükleniyor…</div><div class="rxK" id="rxUkpi"></div><div id="rxUchart" style="display:none"></div><div class="rxCard"><h3>Umut sinyalleri <span class="r" id="rxUst"></span></h3><div class="rxD">Çubuk: solda stop, ortada giriş (│), sağa doğru R1 · R2 · R3. Fiyat canlı (Binance vadeli, 1 dk), robot durumu 4s kapanışlarına göre. <b>Ekleme?</b> işareti: fiyat önce en az +1 ATR yükseldi, sonra girişe / giriş −1 ATR bölgesine geri çekildi, stop ve uyumsuzluk dibi sağlam — <b>yalnız ipucu, yatırım tavsiyesi değildir</b>.</div><div class="rxBar" id="rxUbar"></div><div id="rxUbody"></div></div>').replace(/rxU(note|kpi|chart|st|bar|body)\b/g,P+'$1').replace('Umut sinyalleri yükleniyor…',UCF[s.id].nm+' sinyalleri yükleniyor…').replace('<h3>Umut sinyalleri','<h3>'+UCF[s.id].nm+' sinyalleri'));}
  if(s.id==='harita')sec.insertAdjacentHTML('beforeend','<div class="rxTools" id="rxHTools"></div>');
  var g=document.createElement('div');g.className='rxGrid';sec.appendChild(g);
  s.cards.forEach(function(id){var el=$(id);if(!el)return;el.classList.remove('col');if(WIDE[id])el.classList.add('rxWide');
   if(DESC[id]&&!el.querySelector(':scope>.rxD')){var h=el.querySelector(':scope>h3'),p=document.createElement('div');p.className='rxD';p.innerHTML=DESC[id];if(h)h.insertAdjacentElement('afterend',p);else el.insertBefore(p,el.firstChild);}
   g.appendChild(el);});
  body.appendChild(sec);});
 var hid=document.createElement('div');hid.id='rxHidden';hid.style.display='none';while(main.firstChild)hid.appendChild(main.firstChild);document.body.appendChild(hid);main.appendChild(side);main.appendChild(body);
 // eski kart kabını gizli tut (radar.js içinde referans olabilir)
 var ht=$('rxHTools'),vb=$('vBtn'),zb=$('zBtn');if(ht){if(vb){vb.title='3D galaksi ↔ 2D çizim';ht.appendChild(vb);}if(zb){zb.textContent='Temiz mod (Z)';ht.appendChild(zb);}}
 side.querySelectorAll('button[data-s]').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-s'),true);};});
 var hd=$('rxHead');var setH=function(){if(hd)document.documentElement.style.setProperty('--rxh',hd.offsetHeight+'px');};setH();addEventListener('resize',setH);
 var h=(location.hash||'').replace('#','');var dm=/^(umut|ikili)\/([A-Z0-9]+\/\d+)$/.exec(h);if(dm){UDEEP=dm[1]+':'+dm[2];h=dm[1];}go(SECS.some(function(s){return s.id===h;})?h:'adaylar',false);
 addEventListener('hashchange',function(){var h=(location.hash||'').replace('#','');if(SECS.some(function(s){return s.id===h;})&&h!==CUR)go(h,false);});
}
function go(id,push){CUR=id;document.querySelectorAll('.rxSec').forEach(function(s){s.classList.toggle('on',s.id==='rx-'+id);});
 document.querySelectorAll('#rxSide button[data-s]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-s')===id);if(b.classList.contains('on')&&innerWidth<768)try{b.parentNode.scrollLeft=b.offsetLeft-40;}catch(e){}});
 if(push)try{history.replaceState(null,'','#'+id);}catch(e){}
 // gizliyken ölçülemeyen tuvaller için yeniden çizim tetikle
 setTimeout(function(){try{dispatchEvent(new Event('resize'));}catch(e){}},30);
 if(push)scrollTo({top:0});
 if(id==='adaylar')renderCand(true);if(id==='izleme')renderWatch();if(id==='umut'||id==='ikili')renderUmut();}
/* eski kısayollar (R, B, W, M, odak vb.) bir paneli kaydırarak açar → önce o paneli içeren bölüme geç */
var _siv=Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView=function(){try{var sec=this.closest&&this.closest('.rxSec');if(sec&&!sec.classList.contains('on'))go(sec.id.replace('rx-',''),true);}catch(e){}return _siv.apply(this,arguments);};
Element.prototype.scrollIntoView._o=_siv;

/* ---------- Aday tablosu ---------- */
var CF={mk:'',leg:'',band:0,q:'',sort:'p',asc:false,lim:60},CAND=[],LASTC=0;
var BANDS=[[100,'sig','SİNYAL'],[70,'hzr','Hazır olmak üzere'],[40,'yak','Yaklaşıyor'],[0,'uzk','Uzak']];
function band(p){for(var i=0;i<BANDS.length;i++)if(p>=BANDS[i][0])return BANDS[i];return BANDS[3];}
var LEGN={yo6:'YO6 MA · 4s',loxx:'Loxx · 1s',pst:'PST · 1s',bist:'BIST z−2 · 1s',kal:'KAL',rsi:'RSI',hyb:'MACD+Pump',kdc:'KDC-MACD · 30dk→1s',iki:'✦ İkili (KDC-MACD + Uyumsuzluk) · 4s'};
function candRows(){var V=window.QX_V12,ST=window.QX_RADAR;if(!V||!V.rows||!ST)return [];var R;try{R=V.rows(/^(kal|rsi|hyb|kdc|iki|pst)$/.test(CF.leg)?CF.leg:'all');}catch(e){return [];}
 var st={};try{st=(window.QX_V11&&window.QX_V11.states&&window.QX_V11.states())||{};}catch(e){}
 var cm={};(ST.coins||[]).forEach(function(c){cm['c:'+c.sym]=c;});(ST.bist||[]).forEach(function(c){cm['b:'+c.sym]=c;});
 var wsig=watchOpenSet();
 return R.map(function(r){var bist=r.bist!=null?!!r.bist:r.leg==='bist',c=cm[(bist?'b:':'c:')+r.sym]||{},k=c.k1||c.k4,px=c.px||(k&&k.c?k.c[k.c.length-1]:NaN),nm=c.b||String(r.sym).replace(/USDT$/,''),s=st[nm];
  return {sym:r.sym,nm:nm,bist:bist,mk:bist?'BIST':'Coin',leg:r.leg,lg:(r.leg==='kal'||r.leg==='rsi'||r.leg==='hyb')?LEGN[r.leg]+' · '+(r.tf||(bist?'1s':'4s')):LEGN[r.leg]||r.leg,p:r.p,d:r.d,x:r.x,xn:+String(r.x).split('/')[0]/(+String(r.x).split('/')[1]||1),miss:(r.miss||[]).join(' · '),
   ch:isFinite(c.ch)?c.ch:NaN,px:px,qv:c.qv||0,sec:c.sec||'',dur:s?s.durum:'',w:wsig[(bist?'B:':'C:')+nm]||''};});}
function renderKpi(){var el=$('rxKpi');if(!el)return;var ST=window.QX_RADAR||{},n=CAND.length,cnt=function(lo,hi){return CAND.filter(function(r){return r.p>=lo&&r.p<=hi;}).length;};
 var ps=$('pState'),pst=$('pStress'),wo=watchOpenCount();
 var k=[['Taranan',nf((ST.coins||[]).length)+' coin'+((ST.bist||[]).length?' · '+(ST.bist||[]).length+' BIST':''),'satır: '+n+' strateji eşleşmesi'],
  ['SİNYAL (%100)',cnt(100,100),'koşulların hepsi tamam','sig'],['Hazır olmak üzere',cnt(70,99),'hazırlık %70–99','hzr'],['Yaklaşıyor',cnt(40,69),'hazırlık %40–69','yak'],
  ['Piyasa',ps?esc(ps.textContent.trim()).slice(0,28):'—','stres endeksi '+(pst?esc(pst.textContent):'—'),'go:piyasa'],['İzleme robotu',wo==null?'—':wo+' açık','son 7 gün · ayrıntı →','go:izleme']];
 el.innerHTML=k.map(function(x){var a=x[3]||'';return '<div'+(a.indexOf('go:')===0?' data-go="'+a.slice(3)+'"':a?' data-band="'+a+'"':'')+(a&&a.indexOf('go:')<0?' style="cursor:pointer"':'')+'><div class="l">'+x[0]+'</div><div class="v'+(a==='sig'&&x[1]>0?' rxG':'')+'">'+x[1]+'</div><div class="s">'+x[2]+'</div></div>';}).join('');
 el.querySelectorAll('[data-go]').forEach(function(d){d.onclick=function(){go(d.getAttribute('data-go'),true);};});
 el.querySelectorAll('[data-band]').forEach(function(d){d.onclick=function(){var b=d.getAttribute('data-band');CF.band=b==='sig'?100:b==='hzr'?70:40;renderCand(true);};});}
function renderCand(force){var body=$('rxCandBody');if(!body||CUR!=='adaylar')return;var now=Date.now();if(!force&&now-LASTC<8000)return;
 var ae=document.activeElement;if(!force&&ae&&ae.closest&&ae.closest('#rxCand'))return;LASTC=now;CAND=candRows();renderKpi();
 var ST=window.QX_RADAR||{},t=$('rxCandT');if(t)t.textContent=ST.lastAt?'son tarama '+dt(ST.lastAt)+' TSİ':'';
 var bar=$('rxCandBar');if(bar&&!bar._b){bar._b=1;
  bar.innerHTML='<div class="rxChips" id="rxCmk"></div><div class="rxChips" id="rxClg"></div><select id="rxCbd" title="En az hazırlık"><option value="0">Tüm hazırlıklar</option><option value="40">≥ %40 yaklaşanlar</option><option value="70">≥ %70 hazır olmak üzere</option><option value="100">Yalnız SİNYAL</option></select><input class="rxInp" id="rxCq" placeholder="Sembol ara" autocomplete="off">';
  $('rxCq').oninput=function(e){CF.q=e.target.value;CF.lim=60;draw();};$('rxCbd').onchange=function(e){CF.band=+e.target.value;CF.lim=60;draw();};}
 draw();
 function chips(id,cur,opts,set){var el=$(id);el.innerHTML=opts.map(function(o){return '<button data-v="'+o[0]+'" class="'+(cur===o[0]?'on':'')+'">'+esc(o[1])+'</button>';}).join('');el.querySelectorAll('button').forEach(function(b){b.onclick=function(){set(b.getAttribute('data-v'));CF.lim=60;draw();};});}
 function draw(){
  chips('rxCmk',CF.mk,[['','Tüm piyasalar ('+CAND.length+')'],['Coin','Coin'],['BIST','BIST']],function(v){CF.mk=v;});
  chips('rxClg',CF.leg,[['','Tüm stratejiler'],['yo6','YO6 MA'],['loxx','Loxx'],['kal','KAL'],['rsi','RSI'],['hyb','MACD+Pump'],['kdc','KDC-MACD'],['iki','✦ İkili'],['bist','BIST z−2']],function(v){CF.leg=v;CAND=candRows();});
  var sb=$('rxCbd');if(sb)sb.value=String(CF.band);
  var q=CF.q.trim().toUpperCase(),v=CAND.filter(function(r){return (!CF.mk||r.mk===CF.mk)&&(!CF.leg||r.leg===CF.leg)&&r.p>=CF.band&&(!q||r.nm.toUpperCase().indexOf(q)>=0);});
  var cols=[
   {k:'nm',l:'Sembol',f:function(r){return '<span class="rxSym" data-sym="'+esc(r.sym)+'" data-b="'+(r.bist?1:0)+'" title="Grafiği aç">'+esc(r.nm)+'</span>';}},
   {k:'mk',l:'Piyasa',f:function(r){return '<span class="rxP">'+r.mk+'</span>';}},
   {k:'lg',l:'Strateji',f:function(r){return esc(r.lg);}},
   {k:'p',l:'Hazırlık',n:1,f:function(r){var b=band(r.p);return '<span class="rxHz"><i><b style="width:'+Math.max(2,r.p)+'%;background:'+({sig:'#2ecc71',hzr:'#ff9a3c',yak:'#f1c40f',uzk:'#55647d'})[b[1]]+'"></b></i><b>%'+r.p+'</b></span>';}},
   {k:'band',l:'Durum',v:function(r){return r.p;},f:function(r){var b=band(r.p);return '<span class="rxSt rxb-'+b[1]+'">'+b[2]+'</span>';}},
   {k:'d',l:'Değişim',n:1,t:'Son mumdan beri hazırlık değişimi',f:function(r){return r.d>0?'<span class="rxG">↑ '+r.d+'</span>':r.d<0?'<span class="rxR">↓ '+(-r.d)+'</span>':'<span class="rxM">=</span>';}},
   {k:'xn',l:'Koşul',n:1,f:function(r){return esc(r.x);}},
   {k:'ch',l:'24s / 8s %',n:1,t:'Coin: 24 saatlik · BIST: günlük değişim',f:function(r){return pct(r.ch,1);}},
   {k:'px',l:'Fiyat',n:1,f:function(r){return fp(r.px);}},
   {k:'dur',l:'Trend durumu',f:function(r){return esc(r.dur||'—');}},
   {k:'w',l:'İzleme',f:function(r){return r.w?'<a href="#izleme" class="rxP" title="'+esc(r.w)+'">📡 '+esc(r.w.split(' · ')[0])+'</a>':'<span class="rxM">—</span>';}},
   {k:'miss',l:'Eksik koşullar',c:'wrap',f:function(r){return r.p>=100?'<b class="rxG">tümü tamam · giriş sonraki mum</b>':'<span title="'+esc(r.miss)+'">'+esc(r.miss||'—')+'</span>';}}];
  table(body,cols,v,CF,'Bu filtreye uyan aday yok.',draw);
  body.querySelectorAll('.rxSym').forEach(function(s){s.onclick=function(){openSym(s.getAttribute('data-sym'),s.getAttribute('data-b')==='1');};});
  var bd=$('rxBd-adaylar'),ns=CAND.filter(function(r){return r.p>=100;}).length;if(bd){bd.style.display=ns?'':'none';bd.textContent=ns;bd.title=ns+' sinyal';}}
}
function openSym(sym,bist){var ok=false;try{ok=window.QX_V11&&window.QX_V11.open(sym,bist);}catch(e){}if(!ok)location.href='/quantex.html#ac='+(bist?'bist':'coin')+':'+encodeURIComponent(sym);}
/* genel sıralanabilir tablo */
function table(el,cols,rows,S,empty,redraw){if(!rows.length){el.innerHTML='<div class="rxEmpty">'+esc(empty)+'</div>';return;}
 var col=cols.filter(function(c){return c.k===S.sort;})[0]||cols[0],val=col.v||function(r){return r[col.k];};
 rows=rows.slice().sort(function(a,b){var A=val(a),B=val(b);if(A==null||A!==A)A=typeof B==='string'?'':-1e18;if(B==null||B!==B)B=typeof A==='string'?'':-1e18;var c=typeof A==='string'?String(A).localeCompare(String(B),'tr'):A-B;return S.asc?c:-c;});
 var lim=S.lim||60,R=rows.slice(0,lim);
 el.innerHTML='<div class="rxTw"><table><thead><tr>'+cols.map(function(c){return '<th data-k="'+c.k+'" class="'+(c.n?'n ':'')+(S.sort===c.k?'s'+(S.asc?' asc':''):'')+'"'+(c.t?' title="'+esc(c.t)+'"':'')+'>'+esc(c.l)+'</th>';}).join('')+'</tr></thead><tbody>'+
  R.map(function(r){return '<tr>'+cols.map(function(c){return '<td class="'+(c.n?'n ':'')+(c.c||'')+'">'+c.f(r)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>'+
  '<div class="rxCnt">'+R.length+' / '+rows.length+' satır gösteriliyor · sütun başlığına tıkla → sırala</div>'+(rows.length>lim?'<button class="btn rxMore">Daha fazla göster (+60)</button>':'');
 el.querySelectorAll('th[data-k]').forEach(function(th){th.onclick=function(){var k=th.getAttribute('data-k');if(S.sort===k)S.asc=!S.asc;else{S.sort=k;S.asc=['nm','mk','lg','dur','miss','symbol','label'].indexOf(k)>=0;}redraw();};});
 var m=el.querySelector('.rxMore');if(m)m.onclick=function(){S.lim=lim+60;redraw();};}

/* ---------- İzleme robotu (/api/watch-report) ---------- */
var W=null,WERR='',WF={scan:'',mk:'',st:'',q:'',sort:'foundAt',asc:false,lim:60};
function cleanSym(s){return String(s||'').replace(/\.IS$/,'').replace(/USDT$/,'');}
function loadWatch(){return fetch('/api/watch-report',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(j){W=j;WERR='';}).catch(function(e){WERR=String(e&&e.message||e);}).then(function(){renderWatch();renderUmut();if(UDEEP&&W&&UDEEP.indexOf(CUR+':')===0){var d=UDEEP.slice(CUR.length+1);UDEEP='';uOpen(d,CUR);}if(CUR==='adaylar')renderCand(true);});}
function wSigs(){if(!W||!W.scans)return [];var out=[];Object.keys(W.scans).forEach(function(id){var sc=W.scans[id];(sc.signals||[]).forEach(function(s){var e=s.entry!=null?s.entry:s.price,l=s.exitPx!=null?s.exitPx:s.last;
 out.push({o:s,scan:id,label:sc.label||id,market:sc.market||'',symbol:cleanSym(s.symbol),raw:s.symbol,tsi:s.tsi||'',t:s.t||0,status:s.status||'',entry:e,stop:s.stop,target:s.target,last:l,mv:e&&l?100*(l/e-1):NaN,mfe:s.ex100&&s.ex100.mfePct,mae:s.ex100&&s.ex100.maePct,foundAt:s.foundAt||0,info:s.info||'',kind:s.kind||''});});});return out;}
function watchOpenSet(){var m={},wk=Date.now()-7*864e5;wSigs().forEach(function(s){if((s.status==='açık'||s.status==='bekliyor')&&s.foundAt>=wk){var k=(s.market==='BIST'?'B:':'C:')+s.symbol;m[k]=(m[k]?m[k]+' · ':'')+s.label;}});return m;}
function watchOpenCount(){if(!W)return null;var wk=Date.now()-7*864e5;return wSigs().filter(function(s){return (s.status==='açık'||s.status==='bekliyor')&&s.foundAt>=wk;}).length;}
function renderWatch(){if(CUR!=='izleme'&&$('rxBd-izleme')==null)return;var u=$('rxUniv'),sc=$('rxWsc'),body=$('rxWbody'),bar=$('rxWbar');if(!u)return;
 var bd=$('rxBd-izleme'),oc=watchOpenCount();if(bd){bd.style.display=oc?'':'none';bd.textContent=oc||'';}
 if(!W){u.innerHTML=WERR?'İzleme raporu okunamadı ('+esc(WERR)+'). <a href="/panel.html#izleme">Robot Paneli</a>\'nde tekrar dene.':'İzleme raporu yükleniyor…';return;}
 var S=W.scans||{},ids=Object.keys(S),nC=(W.univ&&W.univ.crypto||[]).length,bistN=0;ids.forEach(function(i){if(S[i].market==='BIST')bistN=Math.max(bistN,S[i].nSym||0);});
 u.innerHTML='<b>Evren:</b> ilk '+(nC||200)+' coin (Binance vadeli, hacme göre'+(W.univ&&W.univ.day?', '+esc(W.univ.day)+' listesi':'')+') + '+(bistN||200)+' BIST hissesi · <b>Mod:</b> '+esc(W.tradeMode||'yalnız izleme')+' · <b>Son tur:</b> '+esc(W.updatedTsi||'—')+' TSİ · '+(W.runs||0)+' tur. '+
  '<br>Radar\'ın canlı taraması ise üstten seçtiğin coin sayısı (ilk 50/100/200) ve BIST30 ile sınırlıdır. <a href="/panel.html#izleme">Tam tablo, MFE/MAE ve robot kaydı → Robot Paneli</a>';
 var all=wSigs();
 sc.innerHTML=ids.map(function(i){var s=S[i],v=all.filter(function(x){return x.scan===i;}),c=function(st){return v.filter(function(x){return x.status===st;}).length;};
  return '<div data-id="'+esc(i)+'" class="'+(WF.scan===i?'on':'')+'"><b>'+esc(s.label||i)+'</b><br>'+v.length+' sinyal · <span class="rxG">'+c('hedef')+' hedef</span> · <span class="rxR">'+c('stop')+' stop</span> · '+(c('açık')+c('bekliyor'))+' açık<br><span title="'+esc(s.note||'')+'">'+(s.nOk||0)+'/'+(s.nSym||0)+' sembol tarandı · '+esc(s.lastRunTsi||'—')+'</span></div>';}).join('');
 sc.querySelectorAll('[data-id]').forEach(function(d){d.onclick=function(){var i=d.getAttribute('data-id');WF.scan=WF.scan===i?'':i;WF.lim=60;renderWatch();};});
 if(!bar._b){bar._b=1;bar.innerHTML='<select id="rxWm"><option value="">Tüm piyasalar</option><option value="kripto">Kripto</option><option value="BIST">BIST</option></select><select id="rxWs"><option value="">Tüm sonuçlar</option><option value="bekliyor">Bekliyor</option><option value="açık">Açık</option><option value="hedef">Hedef ✓</option><option value="stop">Stop ✗</option><option value="süre">Süre doldu</option></select><input class="rxInp" id="rxWq" placeholder="Sembol ara" autocomplete="off"><a class="btn" href="/panel.html#izleme">Robot Paneli\'nde aç →</a>';
  $('rxWm').onchange=function(e){WF.mk=e.target.value;WF.lim=60;draw();};$('rxWs').onchange=function(e){WF.st=e.target.value;WF.lim=60;draw();};$('rxWq').oninput=function(e){WF.q=e.target.value;WF.lim=60;draw();};}
 draw();
 function draw(){var q=WF.q.trim().toUpperCase(),v=all.filter(function(s){return (!WF.scan||s.scan===WF.scan)&&(!WF.mk||s.market===WF.mk)&&(!WF.st||s.status===WF.st)&&(!q||s.symbol.toUpperCase().indexOf(q)>=0);});
  var c=function(st){return v.filter(function(s){return s.status===st;}).length;};$('rxWst').innerHTML=v.length+' sinyal · <span class="rxG">'+c('hedef')+' hedef</span> · <span class="rxR">'+c('stop')+' stop</span> · '+(c('açık')+c('bekliyor'))+' açık/bekliyor';
  var cols=[
   {k:'symbol',l:'Sembol',f:function(s){return '<span class="rxSym" data-sym="'+esc(s.market==='BIST'?s.symbol:s.raw)+'" data-b="'+(s.market==='BIST'?1:0)+'" title="Grafiği aç">'+esc(s.symbol)+'</span>';}},
   {k:'label',l:'Tarama',f:function(s){return '<span class="rxP">'+esc(s.label)+'</span>';}},
   {k:'t',l:'Sinyal mumu (TSİ)',f:function(s){return esc(s.tsi);}},
   {k:'status',l:'Sonuç',f:function(s){return '<span class="rxSt '+esc(s.status)+'">'+esc(s.status||'—')+'</span>';}},
   {k:'entry',l:'Giriş',n:1,f:function(s){return fp(s.entry);}},{k:'stop',l:'Stop',n:1,f:function(s){return fp(s.stop);}},{k:'target',l:'Hedef',n:1,f:function(s){return fp(s.target);}},
   {k:'last',l:'Son',n:1,f:function(s){return fp(s.last);}},
   {k:'mv',l:'Girişten %',n:1,f:function(s){return pct(s.mv,2);}},
   {k:'mfe',l:'En iyi / en kötü',n:1,t:'100 mum penceresinde en iyi (MFE) ve en kötü (MAE) hareket',f:function(s){return (s.mfe==null?'—':pct(s.mfe,1))+' / '+(s.mae==null?'—':pct(s.mae,1));}},
   {k:'foundAt',l:'Bulundu (TSİ)',f:function(s){return dt(s.foundAt);}},
   {k:'info',l:'Not',c:'wrap',f:function(s){return '<span title="'+esc(s.info)+'">'+esc(s.info)+'</span>';}}];
  table(body,cols,v,WF,'Bu filtreye uyan sinyal yok.',draw);
  body.querySelectorAll('.rxSym').forEach(function(x){x.onclick=function(){openSym(x.getAttribute('data-sym'),x.getAttribute('data-b')==='1');};});}
}

/* ---------- Umut (KAL+RSI uyumsuzluk 4s) ---------- */
var UCF={umut:{p:'rxU',scan:'umut-4h',nm:'Umut',lab:'Umut (KAL+RSI uyumsuzluk)',test:'<br><b>Test (2022–2026, 4s):</b> 2.013 işlem · kazanma %42 · kâr faktörü 1,15 · işlem başı +%0,51 (2024 Nisan öncesi) / +%0,52 (sonrası) · rastgele giriş −%0,18. Geçmiş sonuç geleceği garanti etmez.'},
 ikili:{p:'rxI',scan:'ikili-4h',nm:'✦ İkili',lab:'✦ İkili: KDC-MACD + Uyumsuzluk',test:'<br><b>Test yok:</b> bu ikili kombinasyon geriye dönük test edilmedi (Umut tek başına PF 1,15; KDC-MACD tek başına ücret sonrası −0,18R, avantajsız). Yalnız izleme, “patlama ihtimali” bir varsayımdır.'}};
var UFS={umut:{st:'aktif',q:'',sort:'t',asc:false,lim:60},ikili:{st:'',q:'',sort:'t',asc:false,lim:60}},UF=UFS.umut,LP={},LPT=0;
var USTN={'bekliyor':['bekliyor','Sonraki 4s açılışı bekleniyor'],'hedefe gidiyor':['gidiyor','Giriş yapıldı, henüz R1 yok, stop sağlam'],'R1':['r1','+%10 hedefe ulaştı (test edilen çıkış)'],'R2':['r2','+%20'],'R3':['r3','+%30 — izleme tamam'],'stop':['stop','R1 gelmeden giriş − 2 ATR stop'],'süre doldu':['sure','100 mumda R1 gelmedi']};
function loadLP(){if(Date.now()-LPT<55000)return Promise.resolve();LPT=Date.now();
 return fetch('/api/fapi/v1/ticker/price',{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(a){var m={};(a||[]).forEach(function(x){m[x.symbol]=+x.price;});if(Object.keys(m).length)LP=m;}).catch(function(){});}
function uRows(id){var sc=W&&W.scans&&W.scans[UCF[id||'umut'].scan];if(!sc)return [];return (sc.signals||[]).map(function(s){var u=s.u||{},lv=u.lv||{},e=s.entry!=null?s.entry:s.price,stop=lv.stop!=null?lv.stop:s.stop;
  var r1=lv.r1||e*1.1,r2=lv.r2||e*1.2,r3=lv.r3||e*1.3,st=u.live||(s.fillT?'hedefe gidiyor':'bekliyor'),act=(st==='bekliyor'||st==='hedefe gidiyor'||st==='R1'||st==='R2')&&!u.end;
  var lp=LP[s.symbol],live=act&&isFinite(lp)&&lp>0,px=live?lp:(u.last!=null?u.last:s.last!=null?s.last:e),chg=100*(px/e-1);
  var hi=u.hiPct!=null?u.hiPct:0,lo=u.loPct!=null?u.loPct:0;if(live&&s.fillT){hi=Math.max(hi,chg);lo=Math.min(lo,chg);}
  var atr=u.atrNow||(s.calc&&s.calc.atr)||0,add=false,why='';
  if(act&&s.fillT&&u.intact!==false&&(u.bars||0)>=2&&atr>0&&u.hi>=e+atr&&px>stop&&px<=e+0.25*atr&&px>=e-atr){add=true;why=u.addWhy||'fiyat girişe geri çekildi, stop ve dip yapısı sağlam';if(live)why='canlı fiyat '+(px>=e?'girişin hemen üstünde':'giriş −'+((e-px)/atr).toFixed(2)+' ATR')+', stop ve uyumsuzluk dibi sağlam';}
  var warn=live&&px<=stop?'canlı fiyat stop altında':'';
  return {o:s,raw:s.symbol,symbol:cleanSym(s.symbol),t:s.t||0,tsi:s.tsi||'',e:e,stop:stop,r1:r1,r2:r2,r3:r3,px:px,live:live,chg:chg,hi:hi,lo:lo,st:st,act:act,stage:u.stage||0,add:add,why:why,warn:warn,hit:u.hit||{},bars:u.bars||0,info:s.info||'',alerted:s.alerted||''};});}
function uBar(r){var span=r.r3-r.stop;if(!(span>0))return '—';var P=function(v){return Math.max(0,Math.min(100,100*(v-r.stop)/span));},x=P(r.px),xe=P(r.e),up=r.px>=r.e;
 var fill=up?'left:'+xe+'%;width:'+Math.max(0,x-xe)+'%;background:var(--g)':'left:'+x+'%;width:'+Math.max(0,xe-x)+'%;background:var(--r)';
 return '<span class="rxUb" title="stop '+fp(r.stop)+' · giriş '+fp(r.e)+' · R1 '+fp(r.r1)+' · R2 '+fp(r.r2)+' · R3 '+fp(r.r3)+' · şu an '+fp(r.px)+'"><i><b style="'+fill+'"></b><em style="left:'+xe+'%" class="e"></em><em style="left:'+P(r.r1)+'%"></em><em style="left:'+P(r.r2)+'%"></em><u style="left:'+x+'%"></u></i><small>'+(r.stage?'R'+r.stage+' ✓':up?'R1\'e %'+nf(Math.max(0,100*(r.px-r.e)/(r.r1-r.e)),0):'stopa %'+nf(Math.min(100,100*(r.e-r.px)/Math.max(1e-12,r.e-r.stop)),0))+'</small></span>';}
function renderUmut(){renderU('umut');renderU('ikili');}
function renderU(ID){var G=UCF[ID],P=G.p,UF=UFS[ID],body=$(P+'body'),note=$(P+'note'),kp=$(P+'kpi'),bar=$(P+'bar');if(!body)return;
 var all=uRows(ID),sc=W&&W.scans&&W.scans[G.scan];
 var bd=$('rxBd-'+ID),na=all.filter(function(r){return r.act;}).length;if(bd){bd.style.display=na?'':'none';bd.textContent=na||'';bd.title=na+' aktif '+G.nm+' sinyali';}
 if(CUR!==ID)return;
 if(!W){note.innerHTML=WERR?'İzleme raporu okunamadı ('+esc(WERR)+').':G.nm+' sinyalleri yükleniyor…';return;}
 note.innerHTML=sc?'<b>Tarama:</b> '+esc(sc.label)+' · '+(sc.nOk||0)+'/'+(sc.nSym||0)+' coin tarandı · son tur '+esc(sc.lastRunTsi||W.updatedTsi||'—')+' TSİ · robot 2 saatte bir çalışır, yeni sinyalde ntfy bildirimi gönderir (yaş ≤ 2 mum).'+G.test:G.nm+' taraması henüz robotta çalışmadı — ilk turdan sonra burada görünür.';
 var c=function(f){return all.filter(f).length;};
 kp.innerHTML=[['Toplam sinyal',all.length,'son 300 kayıt'],['Aktif',na,'bekliyor + hedefe gidiyor + R1/R2'],['Hedefe gidiyor',c(function(r){return r.st==='hedefe gidiyor';}),'girişte, R1 bekleniyor'],['R1+ (≥ %10)',c(function(r){return r.stage>=1;}),'R2: '+c(function(r){return r.stage>=2;})+' · R3: '+c(function(r){return r.stage>=3;}),'g'],['Stop',c(function(r){return r.st==='stop';}),'süre doldu: '+c(function(r){return r.st==='süre doldu';}),'r'],['Ekleme? ipucu',c(function(r){return r.add;}),'yalnız ipucu, tavsiye değil','y']]
  .map(function(x){return '<div><div class="l">'+x[0]+'</div><div class="v'+(x[3]==='g'&&x[1]?' rxG':x[3]==='r'&&x[1]?' rxR':x[3]==='y'&&x[1]?' rxY':'')+'">'+x[1]+'</div><div class="s">'+x[2]+'</div></div>';}).join('');
 if(!bar._b){bar._b=1;bar.innerHTML='<div class="rxChips" id="'+P+'ch"></div><input class="rxInp" id="'+P+'q" placeholder="Sembol ara" autocomplete="off">';$(P+'q').oninput=function(e){UF.q=e.target.value;UF.lim=60;draw();};}
 draw();
 function draw(){var ch=$(P+'ch'),opts=[['aktif','Aktif ('+na+')'],['','Tümü ('+all.length+')'],['ekle','Ekleme? ('+c(function(r){return r.add;})+')'],['bitti','Biten']];
  ch.innerHTML=opts.map(function(o){return '<button data-v="'+o[0]+'" class="'+(UF.st===o[0]?'on':'')+'">'+esc(o[1])+'</button>';}).join('');
  ch.querySelectorAll('button').forEach(function(b){b.onclick=function(){UF.st=b.getAttribute('data-v');UF.lim=60;draw();};});
  var q=UF.q.trim().toUpperCase(),v=all.filter(function(r){return (UF.st===''||(UF.st==='aktif'&&r.act)||(UF.st==='bitti'&&!r.act)||(UF.st==='ekle'&&r.add))&&(!q||r.symbol.toUpperCase().indexOf(q)>=0);});
  $(P+'st').textContent=v.length+' sinyal'+(Object.keys(LP).length?' · canlı fiyat '+dt(LPT)+' TSİ':'');
  var cols=[
   {k:'symbol',l:'Sembol',f:function(r){return '<button type="button" class="rxUgo" data-ukey="'+esc(uKey(r))+'" title="'+G.nm+' grafiği: sinyal mumu, giriş/stop/R1-R3, RSI + KAL uyumsuzlukları">📈 '+esc(r.symbol)+'</button>';}},
   {k:'t',l:'Sinyal (TSİ)',f:function(r){return esc(r.tsi);}},
   {k:'st',l:'Durum',v:function(r){return ['bekliyor','hedefe gidiyor','R1','R2','R3','süre doldu','stop'].indexOf(r.st);},f:function(r){var m=USTN[r.st]||['bekliyor',''];return '<span class="rxUs rxUs-'+m[0]+'" title="'+esc(m[1])+'">'+esc(r.st)+'</span>'+(r.warn?'<br><small class="rxR">'+r.warn+'</small>':'');}},
   {k:'prog',l:'Hedefe ilerleme',v:function(r){return (r.px-r.stop)/(r.r3-r.stop);},f:uBar},
   {k:'e',l:'Giriş',n:1,f:function(r){return fp(r.e);}},
   {k:'stop',l:'Stop (−2 ATR)',n:1,f:function(r){return '<span class="rxR">'+fp(r.stop)+'</span>';}},
   {k:'r1',l:'R1 / R2 / R3',n:1,t:'+%10 / +%20 / +%30 (R1 test edilen hedef)',f:function(r){var h=function(v,k){return '<span class="'+(r.hit['r'+k]?'rxG':'')+'" title="'+(r.hit['r'+k]?k+'. hedef '+r.hit['r'+k]+'. mumda':'')+'">'+fp(v)+(r.hit['r'+k]?' ✓':'')+'</span>';};return h(r.r1,1)+'<br>'+h(r.r2,2)+'<br>'+h(r.r3,3);}},
   {k:'px',l:'Fiyat',n:1,f:function(r){return fp(r.px)+(r.live?' <small class="rxM" title="canlı">●</small>':'');}},
   {k:'chg',l:'Girişten %',n:1,f:function(r){return r.o.fillT?pct(r.chg,2):'<span class="rxM">—</span>';}},
   {k:'hi',l:'En yüksek / en derin',n:1,t:'Girişten bu yana en yüksek yükseliş (MFE) ve en derin düşüş (MAE), 100 mum içinde',f:function(r){return r.o.fillT?pct(r.hi,1)+'<br>'+pct(r.lo,1):'<span class="rxM">—</span>';}},
   {k:'add',l:'Ekleme?',v:function(r){return r.add?1:0;},t:'Yalnız ipucu, yatırım tavsiyesi değil',f:function(r){return r.add?'<span class="rxUs rxUs-ekle" title="'+esc(r.why)+' — yalnız ipucu, tavsiye değil">Ekleme? ipucu</span>':'<span class="rxM">—</span>';}},
   {k:'bars',l:'Mum',n:1,t:'Girişten bu yana 4s mum (en çok 100)',f:function(r){return r.bars+'/100';}},
   {k:'info',l:'Not',c:'wrap',f:function(r){return '<span title="'+esc(r.info)+'">'+esc(r.info)+'</span>';}}];
  table(body,cols,v,UF,UF.st==='aktif'?'Şu an aktif '+G.nm+' sinyali yok. Yeni sinyal çıkınca burada görünür ve ntfy bildirimi gelir.':'Bu filtreye uyan sinyal yok.',draw);
  if(!body._uc){body._uc=1;body.addEventListener('click',function(ev){var x=ev.target.closest&&ev.target.closest('[data-ukey]');if(!x)return;ev.preventDefault();uOpen(x.getAttribute('data-ukey'),ID);});}}
}
/* Umut satırı → grafik her zaman Umut içinde açılır (Radar galaksi/İzleme penceresine gitmez) */
var UOPEN='',UDEEP='';
function uKey(r){return r.o.key||(r.raw+'|'+r.t);}
function uOpen(key,ID){ID=ID||'umut';var G=UCF[ID],r=uRows(ID).filter(function(x){return uKey(x)===key||(x.raw+'/'+x.t)===key;})[0],el=$(G.p+'chart');if(!r||!el)return;
 if(!window.QXUmutChart){el.style.display='';el.innerHTML='<div class="rxEmpty">Grafik bileşeni yükleniyor…</div>';return;}
 UOPEN=key;try{history.replaceState(null,'','#'+ID+'/'+r.raw+'/'+r.t);}catch(e){}
 window.QXUmutChart.open(el,Object.assign({_label:G.lab},r.o),{onClose:function(){UOPEN='';try{history.replaceState(null,'','#'+ID);}catch(e){}}});
}

/* ---------- başlat ---------- */
function init(){build();
 // eski "Basit" görünüm panelleri gizliyordu; bölümler artık bu işi yapıyor → hepsini görünür bırak
 try{if(window.QX_V11&&window.QX_V11.view&&window.QX_V11.view()==='basit')window.QX_V11.view('gelismis');}catch(e){}
 document.body.classList.remove('basit');
 setTimeout(function(){document.querySelectorAll('.pn.col').forEach(function(p){p.classList.remove('col');});},300);
 loadWatch();setInterval(function(){if(!document.hidden)loadWatch();},5*60000);
 loadLP().then(renderUmut);setInterval(function(){if(!document.hidden&&(CUR==='umut'||CUR==='ikili'))loadLP().then(renderUmut);},60000);
 setInterval(function(){if(!document.hidden&&CUR==='adaylar')renderCand(false);},10000);
 var iv=setInterval(function(){if(window.QX_RADAR_READY){clearInterval(iv);renderCand(true);}},1000);
 setTimeout(function(){renderCand(true);},6000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.QX_V13={umut:function(){return uRows('umut');},ikili:function(){return uRows('ikili');},go:go,cand:function(){return CAND;},watch:function(){return W;}};
})();
