/* QUANTEX Radar v2 — "Sinyal Galaksisi" (Three.js, tembel yükleme). Her görsel gerçek veri:
   çekirdeğe uzaklık = kurulum yakınlığı, yükseklik = 24s değişim, parçacık sayısı/dönüş hızı = RVOL,
   renk = OBV akış yönü, dış torus = her sembolün son 48 mumundaki OBV akışı (tüp etrafı = zaman). */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const VS=`attribute vec3 center;attribute vec3 offs;attribute vec3 col;attribute float size;attribute float phase;attribute float spin;attribute float ang;attribute float bright;
uniform float time;uniform float sweep;uniform float pr;varying vec3 vC;varying float vA;
void main(){float a=time*spin+phase*6.2831;float cs=cos(a),sn=sin(a);vec3 o=vec3(offs.x*cs-offs.z*sn,offs.y+0.08*sin(time*1.3+phase*9.0)*spin,offs.x*sn+offs.z*cs);
 vec4 mv=modelViewMatrix*vec4(center+o,1.0);float d=mod(sweep-ang+12.5664,6.2831);float g=exp(-d*1.4);
 float tw=0.78+0.22*sin(time*2.2+phase*40.0);vC=col*(bright*tw+1.2*g*bright);vA=clamp(0.35+0.65*bright+0.5*g,0.0,1.0);
 gl_PointSize=size*pr*(42.0/-mv.z)*(1.0+0.6*g);gl_Position=projectionMatrix*mv;}`;
const FS=`varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord-0.5;float d=length(p);if(d>0.5)discard;float a=smoothstep(0.5,0.0,d);a*=a;gl_FragColor=vec4(vC,a*vA);}`;

function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function flowCol(up,str){// yükselen: yeşil→camgöbeği, düşen: macenta→kırmızı, bilinmiyor: gri
  if(up==null)return new THREE.Color(0.45,0.5,0.55);const s=Math.min(1,Math.abs(str||0)/1.5);
  return up?new THREE.Color().setHSL(0.36+0.14*s,1,0.55):new THREE.Color().setHSL(0.97-0.07*s,1,0.58);}

export function create(host,opt){
  opt=opt||{};const lite=!!opt.lite;
  const renderer=new THREE.WebGLRenderer({antialias:!lite,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:!!opt.capture});
  const PR=Math.min(window.devicePixelRatio||1,lite?1:1.75);renderer.setPixelRatio(PR);renderer.setClearColor(0x02060b,1);
  host.appendChild(renderer.domElement);renderer.domElement.className='g3d';
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x02060b,0.018);
  const cam=new THREE.PerspectiveCamera(48,1,0.1,400);cam.position.set(0,12.5,27.5);
  const ctl=new OrbitControls(cam,renderer.domElement);ctl.enableDamping=true;ctl.dampingFactor=0.06;ctl.autoRotate=true;ctl.autoRotateSpeed=0.45;ctl.minDistance=8;ctl.maxDistance=48;ctl.maxPolarAngle=Math.PI*0.86;ctl.target.set(0,0.4,0);
  const comp=new EffectComposer(renderer);comp.addPass(new RenderPass(scene,cam));
  const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),lite?0.75:0.9,0.5,0.14);comp.addPass(bloom);comp.addPass(new OutputPass());
  const U={time:{value:0},sweep:{value:0},pr:{value:PR}};
  const mat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const R0=0.9,RM=10.5,TOR=13.4,TUBE=1.35;
  // sabit kılavuzlar: uzaklık halkaları
  const guide=new THREE.Group();scene.add(guide);
  [[0.25,0.5],[0.5,0.28],[0.75,0.2],[1,0.16]].forEach(([q,o])=>{const g=new THREE.BufferGeometry().setFromPoints(Array.from({length:181},(_,i)=>{const a=i/180*Math.PI*2,r=R0+(RM-R0)*q;return new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r);}));
    guide.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x00ffaa,transparent:true,opacity:o})));});
  // çekirdek
  const coreM=new THREE.MeshBasicMaterial({color:0xffe27a});const core=new THREE.Mesh(new THREE.SphereGeometry(0.55,32,16),coreM);scene.add(core);
  const haloM=new THREE.MeshBasicMaterial({color:0xffc400,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending,depthWrite:false});const halo=new THREE.Mesh(new THREE.SphereGeometry(1.1,32,16),haloM);scene.add(halo);
  // tarama yelpazesi (UI: hangi açının tarandığı)
  const fanG=new THREE.CircleGeometry(RM,48,0,0.55);const fanM=new THREE.MeshBasicMaterial({color:0x00ffaa,transparent:true,opacity:0.07,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
  const fan=new THREE.Mesh(fanG,fanM);fan.rotation.x=-Math.PI/2;scene.add(fan);
  let dyn=new THREE.Group();scene.add(dyn);
  let pts=null,hitPts=null,items=[],pulses=[],beams=[],sectors=[],coreLevel=0;
  const st={running:true,t0:performance.now(),manualT:null,fps:0,frames:0,lastF:performance.now()};

  function update(list,info){
    scene.remove(dyn);dyn.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==mat)o.material.dispose();});dyn=new THREE.Group();scene.add(dyn);
    items=[];pulses=[];beams=[];sectors=info.sectors||[];
    const capC=lite?1600:3600,capT=lite?1200:2600;let need=0;list.forEach(d=>{need+=8+28*Math.sqrt(Math.min(d.c.rvol||1,6)/6);});const kC=Math.min(1,capC/Math.max(1,need));
    const hist=info.histLen||48,perT=Math.max(8,Math.min(hist,Math.floor(capT/Math.max(1,list.length))));
    const A={center:[],offs:[],col:[],size:[],phase:[],spin:[],ang:[],bright:[]};
    function push(c,o,cl,sz,ph,sp,an,br){A.center.push(c.x,c.y,c.z);A.offs.push(o.x,o.y,o.z);A.col.push(cl.r,cl.g,cl.b);A.size.push(sz);A.phase.push(ph);A.spin.push(sp);A.ang.push(an);A.bright.push(br);}
    const hp=[];
    list.forEach((d,ix)=>{const c=d.c,a=d.a,r=R0+(RM-R0)*Math.max(0,Math.min(1,c.r)),ch=isFinite(c.ch)?Math.max(-15,Math.min(15,c.ch)):0,y=ch/15*3.2;
      const P=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),rv=Math.max(0.2,Math.min(isFinite(c.rvol)?c.rvol:1,6)),fs=c.flowSer?c.flowSer[c.flowSer.length-1]:0;
      const col=flowCol(c.flowUp,fs),n=Math.max(4,Math.round((8+28*Math.sqrt(rv/6))*kC)),sig=0.16+0.12*Math.sqrt(rv),spin=0.15+0.25*rv,ang=(a%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
      push(P,{x:0,y:0,z:0},col.clone().lerp(new THREE.Color(1,1,1),0.35),5.5+2.5*Math.sqrt(rv),Math.random(),0,ang,1.2);
      for(let q=0;q<n;q++)push(P,{x:gauss()*sig,y:gauss()*sig*0.6,z:gauss()*sig},col,1.6+1.6*Math.random(),Math.random(),spin*(0.6+0.8*Math.random()),ang,0.55+0.25*Math.sqrt(rv/6));
      // yükseklik sapı (24s değişim)
      const sg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(P.x,0,P.z),P]);dyn.add(new THREE.Line(sg,new THREE.LineBasicMaterial({color:ch>=0?0x00ff8c:0xff3c78,transparent:true,opacity:0.22})));
      // dış torus: son "hist" mumun akışı
      const fl=c.flowSer||[],L=fl.length;for(let j=0;j<perT;j++){const bi=L-perT+j,v=bi>=1?fl[bi]:NaN,pv=bi>=1?fl[bi-1]:NaN;if(!isFinite(v)||!isFinite(pv))continue;
        const th=-Math.PI/2+ (j/(perT-1))*Math.PI*2*0.92,rr=TOR+TUBE*Math.cos(th),T=new THREE.Vector3(Math.cos(a)*rr,TUBE*Math.sin(th),Math.sin(a)*rr),up=v>pv,cl=flowCol(up,v),now=j===perT-1;
        push(T,{x:0,y:0,z:0},cl,now?4.6:1.7+1.4*Math.min(1,Math.abs(v)/1.5),Math.random(),0,ang,now?1.1:0.35+0.45*Math.min(1,Math.abs(v)/1.5));}
      hp.push(P.x,P.y,P.z);items.push({d,P});
      if(c.r<0.05){// ateşliyor: nabız halkası + çekirdeğe ışın
        const rg=new THREE.Mesh(new THREE.RingGeometry(0.5,0.62,48),new THREE.MeshBasicMaterial({color:0xffe600,transparent:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));rg.position.copy(P);rg.rotation.x=-Math.PI/2;dyn.add(rg);pulses.push(rg);}
      if(c.r<0.35){const bg=new THREE.BufferGeometry().setFromPoints([P,new THREE.Vector3(0,0,0)]);const bm=new THREE.LineBasicMaterial({color:c.r<0.05?0xffe600:0x7dd3fc,transparent:true,opacity:c.r<0.05?0.9:0.25,blending:THREE.AdditiveBlending});dyn.add(new THREE.Line(bg,bm));beams.push({P,m:bm,fire:c.r<0.05});}});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(A.center,3));
    for(const k of ['center','offs','col'])g.setAttribute(k,new THREE.Float32BufferAttribute(A[k],3));for(const k of ['size','phase','spin','ang','bright'])g.setAttribute(k,new THREE.Float32BufferAttribute(A[k],1));
    pts=new THREE.Points(g,mat);pts.frustumCulled=false;dyn.add(pts);
    // sektör sınırları
    sectors.forEach(s=>{const lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(s.a0)*R0,0,Math.sin(s.a0)*R0),new THREE.Vector3(Math.cos(s.a0)*(TOR+TUBE+0.6),0,Math.sin(s.a0)*(TOR+TUBE+0.6))]);dyn.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:0x7dd3fc,transparent:true,opacity:0.12})));});
    const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));hitPts=new THREE.Points(hg,new THREE.PointsMaterial({size:0.01,transparent:true,opacity:0}));dyn.add(hitPts);
    coreLevel=Math.min(1,((info.fire||0)*2+(info.near||0))/10);st.count=A.size.length;}
  // HTML etiketleri
  const lab=document.createElement('div');lab.className='g3lab';host.appendChild(lab);
  function labels(){const W=host.clientWidth,H=host.clientHeight,v=new THREE.Vector3();let h='';
    sectors.forEach(s=>{const am=(s.a0+s.a1)/2;v.set(Math.cos(am)*(TOR+TUBE+1.6),0.2,Math.sin(am)*(TOR+TUBE+1.6)).project(cam);if(v.z<1)h+=`<span class="sl" style="left:${(v.x+1)/2*W}px;top:${(1-v.y)/2*H}px">${s.nm} ${s.n}</span>`;});
    items.forEach(it=>{const c=it.d.c;if(!(c.r<0.5||it.d.top))return;v.copy(it.P).project(cam);if(v.z<1)h+=`<span class="cl${c.r<0.05?' f':''}" style="left:${(v.x+1)/2*W}px;top:${(1-v.y)/2*H}px">${c.b}</span>`;});
    [['ateşliyor',0.25],['yakın',0.5],['izlemede',0.75],['uzak',1]].forEach(([t,q])=>{v.set(0,0,R0+(RM-R0)*q).project(cam);if(v.z<1)h+=`<span class="rl" style="left:${(v.x+1)/2*W}px;top:${(1-v.y)/2*H}px">${t}</span>`;});
    lab.innerHTML=h;}
  // etkileşim
  const ray=new THREE.Raycaster();ray.params.Points.threshold=0.55;const m2=new THREE.Vector2();let hover=null,downAt=null;
  function pick(e){const b=renderer.domElement.getBoundingClientRect();m2.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(m2,cam);if(!hitPts)return null;const hs=ray.intersectObject(hitPts);return hs.length?items[hs[0].index]:null;}
  renderer.domElement.addEventListener('pointermove',e=>{hover=pick(e);renderer.domElement.style.cursor=hover?'pointer':'grab';opt.onHover&&opt.onHover(hover&&hover.d,e);});
  renderer.domElement.addEventListener('pointerdown',e=>{downAt=[e.clientX,e.clientY];ctl.autoRotate=false;});
  renderer.domElement.addEventListener('pointerup',e=>{if(downAt&&Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])<5){const h=pick(e);if(h&&opt.onClick)opt.onClick(h.d);}downAt=null;setTimeout(()=>{ctl.autoRotate=true;},4000);});
  renderer.domElement.addEventListener('pointerleave',()=>{hover=null;opt.onHover&&opt.onHover(null);});
  function size(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);renderer.domElement.style.width=w+'px';renderer.domElement.style.height=h+'px';comp.setSize(w,h);bloom.resolution.set(w*(lite?0.5:1),h*(lite?0.5:1));cam.aspect=w/h;cam.fov=w<520?62:48;cam.updateProjectionMatrix();}
  new ResizeObserver(size).observe(host);size();
  function frame(tms){const t=st.manualT!=null?st.manualT:(tms-st.t0)/1000;U.time.value=t;const sw=(t*2*Math.PI/7)%(2*Math.PI);U.sweep.value=sw;fan.rotation.z=-sw;
    const ph=(t%1.6)/1.6;pulses.forEach(p=>{const s=1+3*ph;p.scale.set(s,s,s);p.material.opacity=0.9*(1-ph);});beams.forEach(b=>{b.m.opacity=b.fire?0.5+0.5*Math.sin(t*6):0.12+0.1*Math.sin(t*2);});
    const cl=0.35+0.65*coreLevel,pz=1+0.06*Math.sin(t*(2+4*coreLevel));core.scale.set(pz,pz,pz);coreM.color.setRGB(1*cl+0.3,0.85*cl+0.2,0.35*cl+0.1);halo.scale.setScalar(1+0.25*coreLevel+0.12*Math.sin(t*3));haloM.opacity=0.06+0.18*coreLevel;
    if(st.manualT==null)ctl.update();comp.render();labels();
    st.frames++;if(tms-st.lastF>1000){st.fps=st.frames*1000/(tms-st.lastF);st.frames=0;st.lastF=tms;}}
  function loop(){renderer.setAnimationLoop(st.running?frame:null);}loop();
  document.addEventListener('visibilitychange',()=>{st.running=!document.hidden;loop();});
  return {update,state:st,
    renderAt(t,az){st.manualT=t;renderer.setAnimationLoop(null);const r=Math.hypot(cam.position.x,cam.position.z);cam.position.x=Math.sin(az)*r;cam.position.z=Math.cos(az)*r;cam.lookAt(ctl.target);frame(performance.now());},
    resume(){st.manualT=null;loop();},dispose(){renderer.setAnimationLoop(null);renderer.dispose();host.removeChild(renderer.domElement);host.removeChild(lab);}};}
