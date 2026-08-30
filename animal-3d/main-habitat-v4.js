import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/DRACOLoader.js';
import { ANIMALS } from './animal-manifest-realistic.js';

const $ = (s) => document.querySelector(s);
const SPECIES = Object.fromEntries(ANIMALS.map((x) => [x.id, x]));
const cache = new Map();
const pending = new Map();
const state = Object.fromEntries(ANIMALS.map((x) => [x.id, { loaded: 0, total: 0, phase: 'waiting' }]));
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let scene, camera, renderer, controls;
let current = null;
let mixer = null;
let actions = {};
let active = 'lion';
let environment = null;
let lights = [];
const clock = new THREE.Clock();

const HABITATS={
 savanna:{sky:0xd89a68,fog:0xd3a06f,ground:0x9a804d,density:.007},forest:{sky:0xa8c4ba,fog:0xa7b9ae,ground:0x526149,density:.014},rainforest:{sky:0x7ca99b,fog:0x719388,ground:0x435b40,density:.018},wetland:{sky:0xa8c4c8,fog:0x9cb3af,ground:0x586a55,density:.014},meadow:{sky:0xb6dcf3,fog:0xc4d8c6,ground:0x6f9d59,density:.008},mountain:{sky:0xbdd7ed,fog:0xb4c4cd,ground:0x667067,density:.009},coast:{sky:0xb7dbf0,fog:0xb8cdd0,ground:0xbbaa84,density:.007},ocean:{sky:0x4b90aa,fog:0x4b8798,ground:0x2c7183,density:.011},seabed:{sky:0x19576b,fog:0x225d6b,ground:0x607660,density:.014}
};
const habitatFor={lion:'savanna',lioness:'savanna',tiger:'forest',fox:'forest',black_panther:'rainforest',alligator:'wetland',horse:'meadow',rabbit:'meadow',deer:'mountain',seagull:'coast',macaw:'rainforest',shark:'ocean',whale:'ocean',starfish:'seabed',swordfish:'ocean',tuna:'ocean'};
const habitatType=(k)=>habitatFor[k]||'meadow';

function fixMaterial(material,kind){
 if(!material)return;
 if(material.map)material.map.colorSpace=THREE.SRGBColorSpace;
 if(material.emissiveMap)material.emissiveMap.colorSpace=THREE.SRGBColorSpace;
 if(material.normalMap)material.normalMap.colorSpace=THREE.NoColorSpace;
 if(material.roughnessMap)material.roughnessMap.colorSpace=THREE.NoColorSpace;
 if(material.metalnessMap)material.metalnessMap.colorSpace=THREE.NoColorSpace;
 if(material.aoMap)material.aoMap.colorSpace=THREE.NoColorSpace;
 // These three assets are opaque animal models; some exporters leave BLEND/TRANSMISSION flags that render as a white film.
 if(kind==='fox'||kind==='lioness'||kind==='horse'){
  material.transparent=false;
  material.opacity=1;
  material.depthWrite=true;
  material.depthTest=true;
  material.alphaTest=0;
  material.blending=THREE.NormalBlending;
  if('transmission' in material)material.transmission=0;
  if('thickness' in material)material.thickness=0;
  if('attenuationDistance' in material)material.attenuationDistance=Infinity;
 }
 material.needsUpdate=true;
}
function fixModelMaterials(model,kind){
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>fixMaterial(m,kind));});
}

function add(g,geo,m,pos,rot=[0,0,0],scale=[1,1,1]){const o=new THREE.Mesh(geo,m);o.position.set(...pos);o.rotation.set(...rot);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
const mat=(c,e={})=>new THREE.MeshStandardMaterial({color:c,roughness:1,...e});
function addAcacia(g,x,z,s=1){add(g,new THREE.CylinderGeometry(.07*s,.16*s,1.55*s,8),mat(0x624b31),[x,.78*s,z]);const c=mat(0x4f672c);add(g,new THREE.SphereGeometry(.65*s,10,7),c,[x,1.62*s,z],[0,0,0],[1.45,.48,.9]);add(g,new THREE.SphereGeometry(.42*s,9,7),c,[x-.32*s,1.58*s,z+.06]);add(g,new THREE.SphereGeometry(.44*s,9,7),c,[x+.33*s,1.57*s,z-.03]);}
function addTree(g,x,z,s=1){add(g,new THREE.CylinderGeometry(.065*s,.13*s,1.25*s,7),mat(0x624c35),[x,.63*s,z]);add(g,new THREE.SphereGeometry(.55*s,9,7),mat(0x4f733f),[x,1.35*s,z]);add(g,new THREE.SphereGeometry(.4*s,9,7),mat(0x638b4d),[x-.28*s,1.48*s,z+.08]);}
function addPine(g,x,z,s=1){add(g,new THREE.CylinderGeometry(.055*s,.11*s,1*s,7),mat(0x5c4938),[x,.5*s,z]);add(g,new THREE.ConeGeometry(.58*s,1.35*s,9),mat(0x315442),[x,1.2*s,z]);add(g,new THREE.ConeGeometry(.43*s,1*s,9),mat(0x3e644d),[x,1.72*s,z]);}
function addGrass(g,x,z,s=1,c=0x709844,count=6){for(let i=0;i<count;i++){const a=i/count*Math.PI*2,h=(.25+(i%4)*.07)*s;const b=add(g,new THREE.ConeGeometry(.024*s,h,4),mat(c),[x+Math.cos(a)*.09,h/2,z+Math.sin(a)*.09]);b.userData.grass=true;b.userData.phase=Math.random()*Math.PI*2;}}
function addFlower(g,x,z,s=1,c=0xf1b0c7){add(g,new THREE.CylinderGeometry(.01*s,.015*s,.2*s,5),mat(0x4b7b43),[x,.1*s,z]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(g,new THREE.SphereGeometry(.042*s,6,5),mat(c),[x+Math.cos(a)*.055*s,.215*s,z+Math.sin(a)*.055*s]);}add(g,new THREE.SphereGeometry(.022*s,6,5),mat(0xf5d46d),[x,.22*s,z]);}
function addRock(g,x,z,s=1,c=0x6b6b63){add(g,new THREE.DodecahedronGeometry(.3*s,0),mat(c),[x,.18*s,z],[0,(x+z)*.12,0],[1.25,.72,1]);}
function addMountain(g,x,z,s=1){add(g,new THREE.ConeGeometry(1.65*s,2.9*s,6),mat(0x68736f),[x,1.45*s,z]);add(g,new THREE.ConeGeometry(.62*s,1.2*s,6),mat(0xe8eef1),[x,2.3*s,z-.02]);}

function clearEnvironment(){
 if(environment){environment.traverse(o=>{if(!o.isMesh)return;o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m?.dispose());});scene.remove(environment);environment=null;}
 lights.forEach(l=>scene.remove(l));lights=[];
}
function buildEnvironment(kind){
 clearEnvironment();const type=habitatType(kind),cfg=HABITATS[type];scene.background=new THREE.Color(cfg.sky);scene.fog=new THREE.FogExp2(cfg.fog,cfg.density);
 const hemi=new THREE.HemisphereLight(type==='savanna'?0xffe6c8:0xe8f5ff,type==='savanna'?0x60472b:0x304238,type==='savanna'?1.7:1.55);
 const sun=new THREE.DirectionalLight(type==='savanna'?0xffb35f:0xffedc8,type==='savanna'?2.6:2.15);sun.position.set(type==='savanna'?4:3,7,type==='savanna'?2:4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.camera.near=.5;sun.shadow.camera.far=30;
 const rim=new THREE.DirectionalLight(type==='savanna'?0x9a6c3f:0x7ba0b4,.75);rim.position.set(-6,4,-7);lights=[hemi,sun,rim];scene.add(...lights);
 environment=new THREE.Group();add(environment,new THREE.CircleGeometry(14,96),mat(cfg.ground),[0,-.02,0],[-Math.PI/2,0,0]);
 if(type==='savanna'){add(environment,new THREE.SphereGeometry(.72,24,16),mat(0xffd17a,{emissive:0x8e481a,emissiveIntensity:.8}),[4.6,4,-8]);[[-8,-8,1.7],[-4.8,-7.5,1.2],[4.6,-8.3,1.4],[7.8,-5.8,1],[-6,3,1],[6,2,1.1]].forEach(v=>addAcacia(environment,...v));for(let i=0;i<24;i++)addGrass(environment,-8+(i*1.91)%16,-6+(i*2.47)%12,1+(i%3)*.2,0x8c9840,7);addRock(environment,-2.7,-3,1.15,0x756852);addRock(environment,2.8,-2.2,.85,0x6a604e);}
 else if(type==='mountain'){addMountain(environment,-4.8,-8.5,2);addMountain(environment,.4,-10.5,2.7);addMountain(environment,5,-8.2,1.8);for(let i=0;i<18;i++)addPine(environment,-7+(i*1.73)%14,-2+(i*1.51)%9,.65+(i%3)*.14);for(let i=0;i<12;i++)addRock(environment,-6+(i*1.37)%12,-5+(i*1.17)%7,.55+(i%2)*.16,0x727b77);}
 else if(type==='meadow'){for(let i=0;i<34;i++)addGrass(environment,-7+(i*1.31)%14,-6+(i*1.93)%12,.8+(i%3)*.15,0x6e9b4e);const cs=[0xe8a7c2,0xf0c77d,0xc9b2e9,0xf5ebbb];for(let i=0;i<55;i++)addFlower(environment,-7.5+(i*1.73)%15,-5.8+(i*2.14)%11,.8+(i%3)*.16,cs[i%4]);for(let i=0;i<7;i++)addTree(environment,-6+i*2.2,4.8+(i%2)*.5,.72+(i%2)*.12);}
 else if(type==='forest'){for(let i=0;i<24;i++)addTree(environment,-7.2+(i*1.61)%14,-6.5+(i*1.77)%13,.85+(i%3)*.18);for(let i=0;i<20;i++)addGrass(environment,-7+(i*1.83)%14,-5+(i*2.19)%11,.7,0x547941);}
 else if(type==='rainforest'){for(let i=0;i<22;i++)addTree(environment,-7+(i*1.55)%14,-6.8+(i*1.91)%13,1.05+(i%2)*.22);for(let i=0;i<28;i++)addGrass(environment,-7+(i*1.17)%14,-5.5+(i*2.04)%11,.75,0x416e48);}
 else if(type==='wetland'){add(environment,new THREE.CircleGeometry(6.2,64),mat(0x3f7f87,{transparent:true,opacity:.72,roughness:.12}),[0,.012,-1.1],[-Math.PI/2,0,0]);for(let i=0;i<22;i++)addGrass(environment,-7+(i*1.47)%14,-5+(i*1.91)%10,.9,0x587f54);addAcacia(environment,-6.4,4.2,1);addAcacia(environment,6.2,3.8,.9);}
 else if(type==='coast'){add(environment,new THREE.CircleGeometry(6.8,64),mat(0x4b9fba,{transparent:true,opacity:.76,roughness:.16}),[0,.015,-2],[-Math.PI/2,0,0]);for(let i=0;i<20;i++)addRock(environment,-7+(i*1.73)%14,-5+(i*2.19)%10,.4+(i%3)*.15,0x827a68);}
 else if(type==='ocean'){add(environment,new THREE.CircleGeometry(14,96),mat(0x2d7c9b,{transparent:true,opacity:.88,roughness:.15}),[0,-.08,0],[-Math.PI/2,0,0]);for(let i=0;i<18;i++)addRock(environment,-8+(i*1.6)%16,-7+(i*2)%14,.45+(i%3)*.16,0x497d86);}
 else {add(environment,new THREE.CircleGeometry(14,96),mat(0x337487),[0,-.1,0],[-Math.PI/2,0,0]);for(let i=0;i<24;i++)addRock(environment,-7+(i*1.4)%14,-6+(i*1.8)%12,.4+(i%3)*.15,0x61736b);}
 scene.add(environment);
}

async function loadModel(kind){
 if(cache.has(kind))return cache.get(kind);if(pending.has(kind))return pending.get(kind);
 const d=SPECIES[kind];
 const task=(async()=>{const response=await fetch(d.url,{cache:'force-cache'});if(!response.ok)throw new Error(`${d.name} HTTP ${response.status}`);const buffer=await response.arrayBuffer();const resourcePath=new URL('.',new URL(d.url,location.href)).href;const gltf=await new Promise((resolve,reject)=>loader.parse(buffer,resourcePath,resolve,reject));fixModelMaterials(gltf.scene,kind);cache.set(kind,gltf);return gltf;})();
 pending.set(kind,task);try{return await task;}finally{pending.delete(kind);}
}
function prepare(model,kind){if(model.userData.prepared)return;const target=SPECIES[kind]?.target||3.5;const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()).length();if(size)model.scale.multiplyScalar(target/size);const f=new THREE.Box3().setFromObject(model),c=f.getCenter(new THREE.Vector3());model.position.set(-c.x,-f.min.y,-c.z);model.userData.prepared=true;}
function buildActions(gltf){mixer=null;actions={};if(!gltf.animations?.length)return;mixer=new THREE.AnimationMixer(gltf.scene);for(const clip of gltf.animations){const n=clip.name||'';if(!actions.idle&&/idle|stand|rest|breath|wait|survey/i.test(n))actions.idle=mixer.clipAction(clip);if(!actions.walk&&/walk|walking|stroll|run|running|locomotion|move/i.test(n))actions.walk=mixer.clipAction(clip);if(!actions.roar&&/roar|growl|attack|call|cry|bite/i.test(n))actions.roar=mixer.clipAction(clip);if(!actions.dead&&/dead|death|die/i.test(n))actions.dead=mixer.clipAction(clip);}if(!actions.idle)actions.idle=mixer.clipAction(gltf.animations[0]);}
function playAction(mode){document.querySelectorAll('.action').forEach(b=>b.classList.toggle('active',b.dataset.action===mode));if(!mixer){$('#actionHint').textContent='当前模型没有骨骼动作。';return}const a=actions[mode]||actions.idle;if(!a)return;Object.values(actions).forEach(x=>x.stop());const once=mode==='roar'||mode==='dead';a.reset().fadeIn(.18).play();a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);a.clampWhenFinished=once;$('#actionHint').textContent=actions[mode]?`${SPECIES[active].name}：${a.getClip().name}`:`${SPECIES[active].name}：使用可用动作`;}
function renderButtons(){$('.animals').innerHTML=ANIMALS.map(d=>`<button class="animal${d.id===active?' active':''}" data-animal="${d.id}"><span>${d.no}</span> ${d.emoji} ${d.name}</button>`).join('');}
function renderActions(){$('#actions').innerHTML=[['idle','◌ Idle'],['walk','↗ Walk / Run'],['roar','◉ Attack / Call'],['dead','✕ Dead']].map(([id,text])=>`<button class="action" data-action="${id}">${text}</button>`).join('');}
function renderInfo(kind){const d=SPECIES[kind];if(!d)return;$('#animalNo').textContent=d.no;$('#name').textContent=d.name;$('#latin').textContent=d.latin;$('#tagline').textContent=`${d.category} · ${d.facts?.[0]?.[1]||''}`;$('#facts').innerHTML=(d.facts||[]).map(([a,b])=>`<div class="fact"><b>${a}</b><span>${b}</span></div>`).join('');$('#desc').textContent=d.desc||'';}
async function show(kind,gltf){active=kind;renderInfo(kind);renderButtons();renderActions();buildEnvironment(kind);if(current&&mixer)mixer.stopAllAction();if(current)scene.remove(current);current=gltf.scene;prepare(current,kind);fixModelMaterials(current,kind);scene.add(current);buildActions(gltf);$('#modelStatus').textContent=`${SPECIES[kind].name} · 本地 GLB 已就绪`;playAction('idle');}
async function selectAnimal(kind){active=kind;renderInfo(kind);renderButtons();try{const gltf=await loadModel(kind);await show(kind,gltf);$('#loading').classList.add('hide');}catch(error){console.error(`${kind} load failed`,error);$('#modelStatus').textContent=`${SPECIES[kind]?.name||kind} 加载失败`;$('#actionHint').textContent=error?.message||'模型读取失败';$('#loading').classList.add('hide');}}
function setup(){scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.set(0,2.35,8);renderer=new THREE.WebGLRenderer({canvas:$('#stage'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=3.5;controls.maxDistance=13;controls.target.set(0,1.15,0);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});}
function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();if(mixer)mixer.update(dt);if(environment){const now=performance.now()*.0015;environment.traverse(o=>{if(o.isMesh&&o.userData.grass)o.rotation.z=Math.sin(now+o.userData.phase)*.045;});}controls?.update();renderer?.render(scene,camera);}
$('.animals').addEventListener('click',e=>{const b=e.target.closest('.animal');if(b)selectAnimal(b.dataset.animal);});$('#actions').addEventListener('click',e=>{const b=e.target.closest('.action');if(b)playAction(b.dataset.action);});$('#voiceBtn').addEventListener('click',()=>{const d=SPECIES[active];speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(d.speech||`现在看到的是${d.name}。`);u.lang='zh-CN';u.rate=.92;speechSynthesis.speak(u);});
setup();renderButtons();renderActions();renderInfo(active);buildEnvironment(active);animate();
(async()=>{const first=ANIMALS.slice(0,3).map(x=>x.id);const results=await Promise.allSettled(first.map(loadModel));const ready=results.findIndex(r=>r.status==='fulfilled');if(ready>=0)await show(first[ready],results[ready].value);setTimeout(()=>$('#loading').classList.add('hide'),350);const queue=ANIMALS.map(x=>x.id).filter(id=>!first.includes(id));const worker=async()=>{while(queue.length){const kind=queue.shift();try{await loadModel(kind);}catch(e){state[kind].phase='error';console.warn(`${kind} preload failed`,e);}}};await Promise.all([worker(),worker()]);})();
