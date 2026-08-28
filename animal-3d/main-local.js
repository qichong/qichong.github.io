import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const $ = (s) => document.querySelector(s);
const SPECIES = {
  lion: {
    no: '01', name: '非洲狮', latin: 'PANTHERA LEO', tagline: '草原上的群居大型猫科动物。',
    facts: [['栖息地','非洲草原'],['体重','约 120–250 kg'],['最高速度','约 80 km/h']],
    desc: '狮子是现存最大的猫科动物之一，通常以群体形式生活。雄狮醒目的鬃毛是其最有辨识度的特征之一。',
    speech: '你好，现在看到的是非洲狮。狮子通常生活在非洲草原和稀树草原地区，是少数具有稳定群居社会结构的大型猫科动物。',
    url: 'https://raw.githubusercontent.com/code4fukui/vr-cats/main/lion.glb', target: 4.2
  },
  tiger: {
    no: '02', name: '孟加拉虎', latin: 'PANTHERA TIGRIS TIGRIS', tagline: '独居、敏捷而强大的大型猫科捕食者。',
    facts: [['栖息地','森林、草原与湿地'],['体重','约 100–260 kg'],['最高速度','短距离约 60 km/h']],
    desc: '老虎通常独居活动，橙色毛皮上的深色条纹可以帮助它融入林下斑驳的光影环境。',
    speech: '你好，现在看到的是孟加拉虎。老虎是现存体型最大的猫科动物之一，通常独居，拥有非常强的爆发力和出色的感知能力。',
    url: './models/tiger.glb', target: 4.9
  }
};
const state = { lion:{loaded:0,total:0,phase:'waiting'}, tiger:{loaded:0,total:0,phase:'waiting'} };
const cache = new Map();
const pending = new Map();
const loader = new GLTFLoader();
let scene, camera, renderer, controls;
let current = null, currentKind = null;
let mixer = null, clips = [], actions = {};
let active = 'lion';
const clock = new THREE.Clock();

function setLoading(title, msg=''){ $('#loadingStage').textContent = title; $('#loadingMessage').textContent = msg; }
function mb(v){ return v ? (v / 1048576).toFixed(1) + ' MB' : '—'; }
function phaseText(s){ if(s.phase==='done') return '完成'; if(s.phase==='parsing') return '解析中'; if(s.phase==='downloading') return s.total ? Math.round(s.loaded/s.total*100)+'%' : '下载中'; return s.phase==='error'?'失败':'等待'; }
function refreshProgress(){
  const a=state.lion,b=state.tiger,total=a.total+b.total,loaded=a.loaded+b.loaded;
  $('#progressSize').textContent=total ? `${mb(loaded)} / ${mb(total)}` : '读取模型大小…';
  $('#lionProgress').textContent=phaseText(a); $('#tigerProgress').textContent=phaseText(b);
  let pct=total ? Math.round(loaded/total*100) : Math.round(([a,b].filter(x=>x.phase==='done').length/2)*100);
  if(a.phase==='parsing' || b.phase==='parsing') pct=Math.max(pct,99);
  $('#progressPercent').textContent=pct+'%'; $('#progressFill').style.width=pct+'%';
}
function setup(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x080a0b); scene.fog=new THREE.FogExp2(0x080a0b,0.025);
  camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,0.1,100); camera.position.set(0,2.4,8);
  renderer=new THREE.WebGLRenderer({canvas:$('#stage'),antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace;
  controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.enablePan=false; controls.minDistance=4; controls.maxDistance=11; controls.target.set(0,1.2,0);
  scene.add(new THREE.HemisphereLight(0xfff5e2,0x101820,2.5));
  const key=new THREE.DirectionalLight(0xffd99c,4); key.position.set(4,7,5); key.castShadow=true; scene.add(key);
  const rim=new THREE.DirectionalLight(0x5b9dff,2); rim.position.set(-5,3,-4); scene.add(rim);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(7,64),new THREE.MeshStandardMaterial({color:0x17130d,roughness:1})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  const grid=new THREE.GridHelper(12,24,0x342b1e,0x161616); grid.position.y=.01; scene.add(grid);
  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  animate();
}
async function fetchBuffer(kind,url){
  const s=state[kind]; s.phase='downloading'; s.loaded=0; s.total=0; setLoading(`正在下载 ${SPECIES[kind].name}`, `${SPECIES[kind].name}：读取本地 GLB…`); refreshProgress();
  const res=await fetch(url,{cache:'no-store'}); if(!res.ok) throw new Error(`HTTP ${res.status}`);
  s.total=Number(res.headers.get('content-length'))||0;
  if(!res.body){const buf=await res.arrayBuffer();s.loaded=buf.byteLength;if(!s.total)s.total=s.loaded;refreshProgress();return buf;}
  const reader=res.body.getReader(),chunks=[]; while(true){const x=await reader.read();if(x.done)break;chunks.push(x.value);s.loaded+=x.value.byteLength;refreshProgress();}
  const buf=new Uint8Array(s.loaded);let off=0;for(const c of chunks){buf.set(c,off);off+=c.byteLength;}return buf.buffer;
}
function parse(kind,buf){state[kind].phase='parsing';setLoading(`正在解析 ${SPECIES[kind].name}`,`${SPECIES[kind].name}：建立网格、材质与骨骼…`);refreshProgress();return new Promise((resolve,reject)=>loader.parse(buf,'./',resolve,reject));}
async function load(kind){if(cache.has(kind))return cache.get(kind);if(pending.has(kind))return pending.get(kind);const p=(async()=>{const d=SPECIES[kind];try{const buf=await fetchBuffer(kind,d.url);const gltf=await parse(kind,buf);cache.set(kind,gltf);state[kind].phase='done';refreshProgress();return gltf;}catch(e){state[kind].phase='error';refreshProgress();throw e;}})();pending.set(kind,p);try{return await p;}finally{pending.delete(kind);}}
function prepare(model,kind){const box=new THREE.Box3().setFromObject(model);const size=box.getSize(new THREE.Vector3()).length();if(size)model.scale.multiplyScalar(SPECIES[kind].target/size);const b=new THREE.Box3().setFromObject(model);const c=b.getCenter(new THREE.Vector3());model.position.set(-c.x,-b.min.y,-c.z);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
function buildActions(gltf){mixer=null;clips=gltf.animations||[];actions={};if(!clips.length)return; mixer=new THREE.AnimationMixer(gltf.scene);for(const c of clips){const n=c.name.toLowerCase();if(!actions.idle && /(idle|stand|rest|breath|wait)/.test(n))actions.idle=mixer.clipAction(c);if(!actions.walk && /(walk|walking|run|running|locomotion|move)/.test(n))actions.walk=mixer.clipAction(c);if(!actions.roar && /(roar|growl|attack|call|cry|bite)/.test(n))actions.roar=mixer.clipAction(c);}if(!actions.idle)actions.idle=mixer.clipAction(clips[0]);}
function playAction(mode){document.querySelectorAll('.action').forEach(b=>b.classList.toggle('active',b.dataset.action===mode));if(!mixer){$('#actionHint').textContent='该 GLB 没有骨骼动作。';return;}for(const a of Object.values(actions))a.stop();const a=actions[mode]||actions.idle;if(!a)return;a.reset().fadeIn(.25).play();a.setLoop(mode==='roar'?THREE.LoopOnce:THREE.LoopRepeat,mode==='roar'?1:Infinity);$('#actionHint').textContent=actions[mode]?`原生 GLB 动作：${a.getClip().name}`:'当前 GLB 没有该动作，使用可用动作。';}
function show(kind,gltf){if(current)scene.remove(current);if(mixer)mixer.stopAllAction();current=gltf.scene;currentKind=kind;prepare(current,kind);scene.add(current);buildActions(gltf);$('#modelStatus').textContent=`${SPECIES[kind].name} 已就绪`;playAction('idle');}
function info(kind){const d=SPECIES[kind];$('#animalNo').textContent=d.no;$('#name').textContent=d.name;$('#latin').textContent=d.latin;$('#tagline').textContent=d.tagline;$('#facts').innerHTML=d.facts.map(([a,b])=>`<div class="fact"><b>${a}</b><span>${b}</span></div>`).join('');$('#desc').textContent=d.desc;}
function select(kind){active=kind;info(kind);speechSynthesis.cancel();document.querySelectorAll('.animal').forEach(b=>b.classList.toggle('active',b.dataset.animal===kind));const gltf=cache.get(kind);if(gltf)show(kind,gltf);}
function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();if(mixer)mixer.update(dt);controls?.update();renderer?.render(scene,camera);}
$('.animals').addEventListener('click',e=>{const b=e.target.closest('.animal');if(b)select(b.dataset.animal);});
$('#actions').addEventListener('click',e=>{const b=e.target.closest('.action');if(b)playAction(b.dataset.action);});
$('#voiceBtn').addEventListener('click',()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(SPECIES[active].speech);u.lang='zh-CN';u.rate=.92;speechSynthesis.speak(u);});
setup();info('lion');
(async()=>{setLoading('正在预加载动物模型','狮子和老虎会同时进入浏览器内存，首次完成后切换无需重新下载。');try{const [lion,tiger]=await Promise.all([load('lion'),load('tiger')]);show('lion',lion);$('#loadingMessage').textContent='两个动物都已准备完成，可以瞬间切换。';$('#progressFill').style.width='100%';$('#progressPercent').textContent='100%';setTimeout(()=>$('#loading').classList.add('hide'),350);}catch(e){console.error(e);setLoading('模型加载失败',e.message||'请检查网络或刷新页面。');$('#loadingMessage').textContent='狮子或老虎模型没有成功加载。';}})();
