/* QUANTEX Radar v3 — "Sinyal Galaksisi" (Three.js + UnrealBloom). Tüm görseller gerçek veriyi kodlar:
   çekirdeğe uzaklık = kurulum yakınlığı · yükseklik = 24s değişim · parlaklık/dönüş = RVOL · renk = OBV akış yönü
   dış torus = son 48 mum OBV akışı · bulutsu = sektör akış genişliği · kuyruklu yıldız = gerçek işlem sonucu (lab çıkış kuralı). */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const MAXC=80;
const VS=`#define MAXC ${MAXC}
attribute vec3 tpos;attribute vec3 offs;attribute vec3 tcol;attribute float cid;attribute float size;attribute float phase;attribute float spinm;attribute float tb;
uniform vec4 uC[MAXC];uniform vec4 uS[MAXC];uniform float time,sweep,pr,uAsm,uF;varying vec3 vC;varying float vA;
float h1(float n){return fract(sin(n)*43758.5453);}
void main(){vec3 cen;vec3 col;float br;float spin;float ang;float sz=size;
 if(cid>=0.0){int k=int(cid);cen=uC[k].xyz;col=uS[k].rgb;float b0=uS[k].a;br=b0*tb;spin=uC[k].w*spinm;sz*=(0.75+0.45*clamp((b0-0.45)/0.55,0.0,1.0))*(abs(cid-uF)<0.5?1.4:1.0);if(uF>=0.0&&abs(cid-uF)>0.5)br*=0.35;}else{cen=tpos;col=tcol;br=tb;spin=0.0;}
 ang=atan(cen.z,cen.x);if(ang<0.0)ang+=6.2831;
 float a=time*spin+phase*6.2831;float cs=cos(a),sn=sin(a);vec3 o=vec3(offs.x*cs-offs.z*sn,offs.y,offs.x*sn+offs.z*cs);vec3 p=cen+o;
 float dl=phase*0.45;float q=clamp((uAsm-dl)/0.55,0.0,1.0);q=1.0-pow(1.0-q,3.0);
 vec3 sp=normalize(vec3(h1(phase*91.7)-0.5,h1(phase*37.3)-0.5,h1(phase*13.1)-0.5)+1e-3)*(55.0+20.0*h1(phase*7.0));p=mix(sp,p,q);
 vec4 mv=modelViewMatrix*vec4(p,1.0);float d=mod(sweep-ang+12.5664,6.2831);float g=exp(-d*1.4);
 float tw=0.8+0.2*sin(time*2.2+phase*40.0);vC=col*(br*tw+0.9*g*br);vA=clamp(0.3+0.7*br+0.4*g,0.0,1.0)*(0.25+0.75*q);
 gl_PointSize=sz*pr*(42.0/-mv.z)*(1.0+0.5*g);gl_Position=projectionMatrix*mv;}`;
const FS=`varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord-0.5;float d=length(p);if(d>0.5)discard;float a=smoothstep(0.5,0.0,d);a*=a;gl_FragColor=vec4(vC,a*vA);}`;
const CVS=`attribute vec3 col;attribute float al;attribute float size;uniform float pr;varying vec3 vC;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vC=col;vA=al;gl_PointSize=size*pr*(42.0/-mv.z);gl_Position=projectionMatrix*mv;}`;
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
export function flowCol(up,str){if(up==null)return new THREE.Color(0.45,0.5,0.55);const s=Math.min(1,Math.abs(str||0)/1.5);return up?new THREE.Color().setHSL(0.40+0.10*s,1,0.55):new THREE.Color().setHSL(0.95-0.04*s,1,0.58);}
function glowTex(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.35,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
export function create(host,opt){
  opt=opt||{};const lite=!!opt.lite,clock=opt.clock||(()=>performance.now());
  const renderer=new THREE.WebGLRenderer({antialias:!lite,powerPreference:'high-performance',preserveDrawingBuffer:!!opt.capture});
  const PR=Math.min(window.devicePixelRatio||1,lite?1:1.75);renderer.setPixelRatio(PR);renderer.setClearColor(0x02060b,1);host.appendChild(renderer.domElement);renderer.domElement.className='g3d';
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x02060b,0.02);
  const cam=new THREE.PerspectiveCamera(48,1,0.1,400);const HOME={p:new THREE.Vector3(0,12.5,27.5),t:new THREE.Vector3(0,0.4,0)};cam.position.copy(HOME.p);
  const ctl=new OrbitControls(cam,renderer.domElement);ctl.enableDamping=true;ctl.dampingFactor=0.06;ctl.autoRotate=true;ctl.autoRotateSpeed=0.4;ctl.minDistance=3;ctl.maxDistance=48;ctl.maxPolarAngle=Math.PI*0.86;ctl.target.copy(HOME.t);
  const comp=new EffectComposer(renderer);comp.addPass(new RenderPass(scene,cam));const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),lite?0.75:0.9,0.5,0.14);comp.addPass(bloom);comp.addPass(new OutputPass());
  const U={time:{value:0},sweep:{value:0},pr:{value:PR},uAsm:{value:0},uF:{value:-1},uC:{value:Array.from({length:MAXC},()=>new THREE.Vector4())},uS:{value:Array.from({length:MAXC},()=>new THREE.Vector4(0.5,0.5,0.5,0.5))}};
  const mat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const R0=0.9,RM=10.5,TOR=13.4,TUBE=1.35,GT=glowTex();
  [[0.25,0.45],[0.5,0.26],[0.75,0.18],[1,0.14]].forEach(([q,o])=>{const g=new THREE.BufferGeometry().setFromPoints(Array.from({length:181},(_,i)=>{const a=i/180*Math.PI*2,r=R0+(RM-R0)*q;return new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r);}));scene.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x00ffaa,transparent:true,opacity:o})));});
  const coreM=new THREE.MeshBasicMaterial({color:0xffe27a});const core=new THREE.Mesh(new THREE.SphereGeometry(0.55,32,16),coreM);scene.add(core);
  const haloM=new THREE.SpriteMaterial({map:GT,color:0xffc400,transparent:true,opacity:0.3,blending:THREE.AdditiveBlending,depthWrite:false});const halo=new THREE.Sprite(haloM);halo.scale.set(4,4,1);scene.add(halo);
  const fan=new THREE.Mesh(new THREE.CircleGeometry(RM,48,0,0.55),new THREE.MeshBasicMaterial({color:0x00ffaa,transparent:true,opacity:0.06,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));fan.rotation.x=-Math.PI/2;scene.add(fan);
  let dyn=new THREE.Group();scene.add(dyn);
  const S={n:0,syms:[],cur:[],tgt:[],sectors:[],neb:[],stems:null,hit:null,torus:null,torusMap:[],comets:null,cometCap:lite?1200:3000,fx:[],coreLevel:0,focus:null,fly:null,holo:null,holoTex:null,asmT0:null,running:true,fps:0,frames:0,lastF:0,manualT:null,count:0};
  function setData(list,info){scene.remove(dyn);dyn.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==mat&&o.material.dispose)o.material.dispose();});dyn=new THREE.Group();scene.add(dyn);
    S.n=Math.min(MAXC,list.length);S.syms=list.slice(0,S.n);S.sectors=info.sectors||[];S.cur=[];S.tgt=[];S.fx=[];
    const A={tpos:[],offs:[],tcol:[],cid:[],size:[],phase:[],spinm:[],tb:[]};const per=lite?16:28,TL=info.histLen||48;
    function push(tp,o,cl,cid,sz,ph,sm,tb){A.tpos.push(tp.x,tp.y,tp.z);A.offs.push(o.x,o.y,o.z);A.tcol.push(cl.r,cl.g,cl.b);A.cid.push(cid);A.size.push(sz);A.phase.push(ph);A.spinm.push(sm);A.tb.push(tb);}
    const Z=new THREE.Vector3(),W=new THREE.Color(1,1,1);S.torusMap=[];
    S.syms.forEach((d,k)=>{S.cur.push({p:new THREE.Vector3(Math.cos(d.a)*RM,0,Math.sin(d.a)*RM),col:new THREE.Color(0.5,0.5,0.5),br:0.6,spin:0.3,sz:1});S.tgt.push({p:new THREE.Vector3(),col:new THREE.Color(),br:0.6,spin:0.3,sz:1});
      push(Z,Z,W,k,6.5,Math.random(),0,1.25);for(let q=0;q<per;q++){const sg=0.22;push(Z,{x:gauss()*sg,y:gauss()*sg*0.6,z:gauss()*sg},W,k,1.6+1.6*Math.random(),Math.random(),0.6+0.8*Math.random(),0.7);}});
    // torus parçacıkları: (sembol, mum) → sabit konum, renk her karede güncellenir
    const t0=A.tpos.length/3;S.syms.forEach((d,k)=>{for(let j=0;j<TL;j++){const th=-Math.PI/2+(j/(TL-1))*Math.PI*2*0.92,rr=TOR+TUBE*Math.cos(th);push(new THREE.Vector3(Math.cos(d.a)*rr,TUBE*Math.sin(th),Math.sin(d.a)*rr),Z,new THREE.Color(0.2,0.2,0.2),-1,j===TL-1?4.6:2.2,Math.random(),0,0.4);S.torusMap.push([k,j]);}});
    S.torusStart=t0;S.TL=TL;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(A.tpos,3));
    for(const k of ['tpos','offs','tcol'])g.setAttribute(k,new THREE.Float32BufferAttribute(A[k],3));for(const k of ['cid','size','phase','spinm','tb'])g.setAttribute(k,new THREE.Float32BufferAttribute(A[k],1));
    g.attributes.tcol.setUsage(THREE.DynamicDrawUsage);g.attributes.tb.setUsage(THREE.DynamicDrawUsage);S.geo=g;const pts=new THREE.Points(g,mat);pts.frustumCulled=false;dyn.add(pts);S.count=A.size.length;
    // yükseklik sapları
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(S.n*6),3));sg.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(S.n*6),3));
    S.stems=new THREE.LineSegments(sg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.3}));S.stems.frustumCulled=false;dyn.add(S.stems);
    // ışınlar (yakın/ateşleyen → çekirdek)
    const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(S.n*6),3));bg.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(S.n*6),3));
    S.beams=new THREE.LineSegments(bg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false}));S.beams.frustumCulled=false;dyn.add(S.beams);
    // vuruş alanı
    const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(S.n*3),3));S.hit=new THREE.Points(hg,new THREE.PointsMaterial({size:0.01,transparent:true,opacity:0}));S.hit.frustumCulled=false;dyn.add(S.hit);
    // sektör sınırları + bulutsular
    S.neb=[];S.sectors.forEach((s,si)=>{const lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(s.a0)*R0,0,Math.sin(s.a0)*R0),new THREE.Vector3(Math.cos(s.a0)*(TOR+TUBE+0.6),0,Math.sin(s.a0)*(TOR+TUBE+0.6))]);dyn.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0x7dd3fc,transparent:true,opacity:0.1})));
      const span=s.a1-s.a0,nb=Math.max(2,Math.min(6,Math.round(span*3)));for(let q=0;q<nb;q++){const a=s.a0+span*(q+0.5)/nb,rr=R0+(RM-R0)*(0.45+0.4*Math.random()),m=new THREE.SpriteMaterial({map:GT,color:0x00ffaa,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
        const sp=new THREE.Sprite(m);sp.position.set(Math.cos(a)*rr,(Math.random()-0.5)*1.2,Math.sin(a)*rr);const sc=2.5+span*4.5;sp.scale.set(sc,sc*0.6,1);dyn.add(sp);S.neb.push({sp,si,rot:(Math.random()-0.5)*0.1});}});
    // kuyruklu yıldızlar (dinamik tampon)
    const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(S.cometCap*3),3));cg.setAttribute('col',new THREE.Float32BufferAttribute(new Float32Array(S.cometCap*3),3));cg.setAttribute('al',new THREE.Float32BufferAttribute(new Float32Array(S.cometCap),1));cg.setAttribute('size',new THREE.Float32BufferAttribute(new Float32Array(S.cometCap),1));
    cg.setDrawRange(0,0);S.comets=new THREE.Points(cg,new THREE.ShaderMaterial({uniforms:{pr:U.pr},vertexShader:CVS,fragmentShader:FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));S.comets.frustumCulled=false;dyn.add(S.comets);
    if(S.asmT0===null&&info.assemble!==false)S.asmT0=clock();if(info.assemble===false)U.uAsm.value=1;}
  // kare durumu (canlı ya da geri oynatma imleci)
  function setFrame(F){for(let k=0;k<S.n;k++){const f=F.c[k],d=S.syms[k];if(!f)continue;const r=R0+(RM-R0)*Math.max(0,Math.min(1,f.r)),y=(isFinite(f.ch)?Math.max(-15,Math.min(15,f.ch)):0)/15*3.2,T=S.tgt[k];
      T.p.set(Math.cos(d.a)*r,y,Math.sin(d.a)*r);T.col.copy(flowCol(f.up,f.fl));const rv=Math.max(0.2,Math.min(isFinite(f.rv)?f.rv:1,6));T.br=0.45+0.55*Math.sqrt(rv/6);T.spin=0.15+0.25*rv;T.sz=0.75+0.45*Math.sqrt(rv/6);T.r=f.r;T.ch=f.ch;}
    if(F.tor){const tc=S.geo.attributes.tcol,tb=S.geo.attributes.tb;for(let q=0;q<S.torusMap.length;q++){const [k,j]=S.torusMap[q],a=F.tor[k];if(!a)continue;const v=a[j],pv=j>0?a[j-1]:NaN,ix=S.torusStart+q;
        if(!isFinite(v)||!isFinite(pv)){tc.setXYZ(ix,0.1,0.1,0.12);tb.setX(ix,0.15);continue;}const cl=flowCol(v>pv,v);tc.setXYZ(ix,cl.r,cl.g,cl.b);tb.setX(ix,j===S.TL-1?1.1:0.3+0.45*Math.min(1,Math.abs(v)/1.5));}tc.needsUpdate=true;tb.needsUpdate=true;}
    if(F.neb)S.neb.forEach(n=>{const b=F.neb[n.si];if(b==null)return;n.sp.material.color.setHSL(b>=0.5?0.42:0.93,1,0.5);n.sp.material.opacity=0.04+0.22*Math.abs(b-0.5)*2*0.6+0.1*b;});
    S.coreLevel=Math.min(1,((F.fire||0)*2+(F.near||0))/10);S.cometData=F.comets||[];}
  function fire(k){S.fx.push({k,t0:clock()});}
  // HTML etiketleri
  const lab=document.createElement('div');lab.className='g3lab';host.appendChild(lab);
  function labels(){const W=host.clientWidth,H=host.clientHeight,v=new THREE.Vector3();let h='';
    if(!S.focus)S.sectors.forEach(s=>{const am=(s.a0+s.a1)/2;v.set(Math.cos(am)*(TOR+TUBE+1.6),0.2,Math.sin(am)*(TOR+TUBE+1.6)).project(cam);if(v.z<1)h+=`<span class="sl" style="left:${(v.x+1)/2*W}px;top:${(1-v.y)/2*H}px">${s.nm} ${s.n}</span>`;});
    S.syms.forEach((d,k)=>{const c=S.cur[k],T=S.tgt[k];if(!(T.r<0.5||d.top||S.focus===k))return;v.copy(c.p).project(cam);if(v.z<1&&U.uAsm.value>0.9)h+=`<span class="cl${T.r<0.05?' f':''}${S.focus===k?' fo':''}" style="left:${(v.x+1)/2*W}px;top:${(1-v.y)/2*H}px">${d.b}</span>`;});
    if(!S.focus)[['ateşliyor',0.25],['yakın',0.5],['izlemede',0.75],['uzak',1]].forEach(([t,q])=>{v.set(0,0,R0+(RM-R0)*q).project(cam);if(v.z<1)h+=`<span class="rl" style="left:${(v.x+1)/2*W}px;top:${(1-v.y)/2*H}px">${t}</span>`;});
    lab.innerHTML=h;}
  // etkileşim
  const ray=new THREE.Raycaster();ray.params.Points.threshold=0.6;const m2=new THREE.Vector2();let downAt=null;
  function pick(e){const b=renderer.domElement.getBoundingClientRect();m2.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(m2,cam);if(!S.hit)return -1;const hs=ray.intersectObject(S.hit);return hs.length?hs[0].index:-1;}
  renderer.domElement.addEventListener('pointermove',e=>{const k=pick(e);renderer.domElement.style.cursor=k>=0?'pointer':'grab';opt.onHover&&opt.onHover(k>=0?S.syms[k]:null,e);});
  renderer.domElement.addEventListener('pointerdown',e=>{downAt=[e.clientX,e.clientY];ctl.autoRotate=false;});
  renderer.domElement.addEventListener('pointerup',e=>{if(downAt&&Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])<5){const k=pick(e);if(k>=0&&opt.onPick)opt.onPick(k);}downAt=null;if(!S.focus)setTimeout(()=>{if(!S.focus)ctl.autoRotate=true;},4000);});
  renderer.domElement.addEventListener('pointerleave',()=>{opt.onHover&&opt.onHover(null);});
  // odak: kameranın coine uçuşu + holografik mini grafik
  function focus(k){S.focus=k;ctl.autoRotate=false;const p=S.cur[k].p.clone(),out=new THREE.Vector3(p.x,0,p.z).normalize();if(!isFinite(out.x))out.set(0,0,1);
    const side=new THREE.Vector3(-out.z,0,out.x);S.holoOut=out;const tg=p.clone().addScaledVector(out,1.0).addScaledVector(side,0.5).add(new THREE.Vector3(0,0.75,0));const camTo=tg.clone().addScaledVector(side,-7.6).addScaledVector(out,1.6).add(new THREE.Vector3(0,1.3,0));
    S.fly={t0:clock(),dur:1400,p0:cam.position.clone(),t0v:ctl.target.clone(),p1:camTo,t1:tg};S.tg=tg;
    if(!S.holo){const cv=document.createElement('canvas');cv.width=768;cv.height=460;S.holoCv=cv;S.holoTex=new THREE.CanvasTexture(cv);S.holoTex.colorSpace=THREE.SRGBColorSpace;
      S.holo=new THREE.Mesh(new THREE.PlaneGeometry(4.2,2.52),new THREE.MeshBasicMaterial({map:S.holoTex,color:0xb8c8c8,transparent:true,opacity:0.92,depthWrite:false,side:THREE.DoubleSide}));scene.add(S.holo);}
    S.holoSide=side;S.holo.visible=true;redrawHolo();}
  function redrawHolo(){if(S.focus==null||!S.holo)return;opt.drawHolo&&opt.drawHolo(S.holoCv.getContext('2d'),S.holoCv.width,S.holoCv.height,S.focus);S.holoTex.needsUpdate=true;}
  function unfocus(){if(S.focus==null)return;S.focus=null;if(S.holo)S.holo.visible=false;S.fly={t0:clock(),dur:1400,p0:cam.position.clone(),t0v:ctl.target.clone(),p1:HOME.p.clone(),t1:HOME.t.clone(),home:true};}
  function size(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);renderer.domElement.style.width=w+'px';renderer.domElement.style.height=h+'px';comp.setSize(w,h);bloom.resolution.set(w*(lite?0.5:1),h*(lite?0.5:1));cam.aspect=w/h;cam.fov=w<520?64:48;cam.updateProjectionMatrix();}
  new ResizeObserver(size).observe(host);size();
  const tmp=new THREE.Vector3();
  function frame(){const now=clock(),t=now/1000;U.time.value=t;U.uF.value=S.focus==null?-1:S.focus;const sw=(t*2*Math.PI/7)%(2*Math.PI);U.sweep.value=sw;fan.rotation.z=-sw;
    if(S.asmT0!==null)U.uAsm.value=Math.min(1,(now-S.asmT0)/2200);
    const kL=1-Math.pow(0.0015,1/60*Math.min(4,(now-(S.lastNow||now))/16.7||1));S.lastNow=now;
    const sp=S.stems&&S.stems.geometry.attributes.position.array,scol=S.stems&&S.stems.geometry.attributes.color.array,hp=S.hit&&S.hit.geometry.attributes.position.array,bp=S.beams&&S.beams.geometry.attributes.position.array,bc=S.beams&&S.beams.geometry.attributes.color.array;
    for(let k=0;k<S.n;k++){const c=S.cur[k],T=S.tgt[k];c.p.lerp(T.p,kL);c.col.lerp(T.col,kL);c.br+=(T.br-c.br)*kL;c.spin+=(T.spin-c.spin)*kL;c.sz+=(T.sz-c.sz)*kL;
      U.uC.value[k].set(c.p.x,c.p.y,c.p.z,c.spin);U.uS.value[k].set(c.col.r,c.col.g,c.col.b,c.br);
      sp[k*6]=c.p.x;sp[k*6+1]=0;sp[k*6+2]=c.p.z;sp[k*6+3]=c.p.x;sp[k*6+4]=c.p.y;sp[k*6+5]=c.p.z;const up=(T.ch||0)>=0;for(let q=0;q<2;q++){scol[k*6+q*3]=up?0:1;scol[k*6+q*3+1]=up?1:0.24;scol[k*6+q*3+2]=up?0.55:0.47;}
      hp[k*3]=c.p.x;hp[k*3+1]=c.p.y;hp[k*3+2]=c.p.z;
      const fireNow=T.r<0.05,near=T.r<0.35,pul=fireNow?0.6+0.4*Math.sin(t*6):near?0.18+0.08*Math.sin(t*2):0;bp[k*6]=c.p.x;bp[k*6+1]=c.p.y;bp[k*6+2]=c.p.z;bp[k*6+3]=0;bp[k*6+4]=0;bp[k*6+5]=0;
      const bcol=fireNow?[1,0.9,0]:[0.49,0.83,0.99];for(let q=0;q<2;q++){bc[k*6+q*3]=bcol[0]*pul*(q?0.25:1);bc[k*6+q*3+1]=bcol[1]*pul*(q?0.25:1);bc[k*6+q*3+2]=bcol[2]*pul*(q?0.25:1);}}
    if(S.stems){S.stems.geometry.attributes.position.needsUpdate=true;S.stems.geometry.attributes.color.needsUpdate=true;S.hit.geometry.attributes.position.needsUpdate=true;S.beams.geometry.attributes.position.needsUpdate=true;S.beams.geometry.attributes.color.needsUpdate=true;S.hit.geometry.computeBoundingSphere();}
    // ateşleme efektleri: genişleyen halka (parçacık) + ışın
    S.fx=S.fx.filter(f=>now-f.t0<2400);
    // kuyruklu yıldızlar
    if(S.comets){const P=S.comets.geometry.attributes.position.array,C=S.comets.geometry.attributes.col.array,AL=S.comets.geometry.attributes.al.array,SZ=S.comets.geometry.attributes.size.array;let n=0;
      const put=(x,y,z,r,g,b,a,s)=>{if(n>=S.cometCap)return;P[n*3]=x;P[n*3+1]=y;P[n*3+2]=z;C[n*3]=r;C[n*3+1]=g;C[n*3+2]=b;AL[n]=a;SZ[n]=s;n++;};
      (S.cometData||[]).forEach(cm=>{const d=S.syms[cm.k];if(!d)return;const r0=R0+(RM-R0)*Math.max(0,Math.min(1,cm.r0)),y0=(isFinite(cm.ch0)?Math.max(-15,Math.min(15,cm.ch0)):0)/15*3.2;
        const L=Math.min(6.5,0.6+55*Math.abs(cm.ret))*cm.grow,sg=cm.ret>=0?1:-1,dx=Math.cos(d.a),dz=Math.sin(d.a),N=Math.max(6,Math.round(8+L*6));
        const col=cm.open?(cm.ret>=0?[0.55,1,0.85]:[1,0.6,0.75]):(cm.ret>=0?[0,1,0.55]:[1,0.16,0.4]),fade=cm.fade;
        for(let q=0;q<N;q++){const u=q/(N-1),x=dx*(r0+L*u*0.9),z=dz*(r0+L*u*0.9),y=y0+sg*L*0.55*u*u;const a=(1-u)*(cm.open?0.55:0.95)*fade;put(x,y,z,col[0],col[1],col[2],a,(1-u*0.7)*(cm.open?3:4.2));}
        put(dx*r0,y0,dz*r0,1,1,1,0.9*fade,cm.open?5:6.5);});
      S.fx.forEach(f=>{const c=S.cur[f.k];if(!c)return;const ph=(now-f.t0)/2400,R=0.4+3.2*ph;for(let q=0;q<36;q++){const a=q/36*Math.PI*2;put(c.p.x+Math.cos(a)*R,c.p.y,c.p.z+Math.sin(a)*R,1,0.9,0.1,(1-ph)*0.95,3.6);}
        for(let q=0;q<20;q++){const u=((q/20)+ph*3)%1;put(c.p.x*(1-u),c.p.y*(1-u),c.p.z*(1-u),1,0.92,0.2,(1-ph)*0.9,3);}});
      S.comets.geometry.setDrawRange(0,n);for(const a of ['position','col','al','size'])S.comets.geometry.attributes[a].needsUpdate=true;}
    S.neb.forEach(nb=>{nb.sp.material.rotation+=nb.rot*0.016;});
    const cl=0.35+0.65*S.coreLevel,pz=1+0.06*Math.sin(t*(2+4*S.coreLevel));core.scale.set(pz,pz,pz);coreM.color.setRGB(cl+0.3,0.85*cl+0.2,0.35*cl+0.1);halo.scale.setScalar(3.4+1.6*S.coreLevel+0.3*Math.sin(t*3));haloM.opacity=(0.18+0.3*S.coreLevel)*(S.focus!=null?0.3:1);coreM.color.multiplyScalar(S.focus!=null?0.45:1);bloom.strength+=(((S.focus!=null)?0.55:(lite?0.75:0.9))-bloom.strength)*0.08;
    if(S.fly){const u=Math.min(1,(now-S.fly.t0)/S.fly.dur),e=u<0.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;cam.position.lerpVectors(S.fly.p0,S.fly.p1,e);ctl.target.lerpVectors(S.fly.t0v,S.fly.t1,e);if(u>=1){if(S.fly.home)ctl.autoRotate=true;S.fly=null;}}
    else if(S.focus!=null){/* odakta hedef sabit */}
    if(S.holo&&S.holo.visible&&S.focus!=null){const c=S.cur[S.focus].p;S.holo.position.copy(c).addScaledVector(S.holoOut,2.0).addScaledVector(S.holoSide,1.0).add(new THREE.Vector3(0,1.5,0));S.holo.lookAt(cam.position);S.holo.material.opacity=0.86+0.06*Math.sin(t*9)*Math.sin(t*2.3);}
    if(S.manualT==null||S.fly)ctl.update();else cam.lookAt(ctl.target);comp.render();labels();
    S.frames++;if(now-S.lastF>1000){S.fps=S.frames*1000/(now-S.lastF);S.frames=0;S.lastF=now;}}
  function loop(){renderer.setAnimationLoop(S.running&&!opt.capture?frame:null);}loop();
  document.addEventListener('visibilitychange',()=>{S.running=!document.hidden;loop();});
  return {setData,setFrame,fire,focus,unfocus,redrawHolo,state:S,frame,
    orbit(az){const r=Math.hypot(cam.position.x-ctl.target.x,cam.position.z-ctl.target.z);cam.position.x=ctl.target.x+Math.sin(az)*r;cam.position.z=ctl.target.z+Math.cos(az)*r;},
    dispose(){renderer.setAnimationLoop(null);renderer.dispose();host.removeChild(renderer.domElement);host.removeChild(lab);}};}
