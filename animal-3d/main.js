import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const data={
  lion:{no:'01',name:'非洲狮',latin:'PANTHERA LEO',tagline:'草原上的群居大型猫科动物。',facts:[['栖息地','非洲草原'],['体重','约 120–250 kg'],['最高速度','约 80 km/h']],desc:'狮子是现存最大的猫科动物之一。它们通常以群体形式生活，雄狮醒目的鬃毛是其最具代表性的特征之一。',speech:'你好，欢迎来到三维野生动物馆。现在看到的是非洲狮。狮子通常生活在非洲的草原和稀树草原地区，是少数具有稳定群居社会结构的大型猫科动物。',url:'https://raw.githubusercontent.com/code4fukui/vr-cats/main/lion.glb'},
  tiger:{no:'02',name:'孟加拉虎',latin:'PANTHERA TIGRIS TIGRIS',tagline:'独居、敏捷而强大的大型猫科捕食者。',facts:[['栖息地','森林与草原'],['体重','约 100–260 kg'],['最高速度','短距离约 60 km/h']],desc:'老虎是现存体型最大的猫科动物之一。橙色毛皮上的深色条纹能帮助它融入林下斑驳的光影环境。',speech:'你好，现在来到老虎展区。老虎是体型最大的现存猫科动物之一，通常以独居方式活动，具有非常出色的力量、感知能力和短距离爆发力。',url:'https://storage.googleapis.com/ar-answers-in-search-models/static/Tiger/model.glb'}
};

let scene,camera,renderer,controls,clock=new THREE.Clock();
let current=null, mixer=null, clips=[], active='lion', actionMode='idle', modelToken=0;
const loader=new GLTFLoader();
const $=s=>document.querySelector(s);
const actionNames={idle:/idle|stand|rest|breath/i,walk:/walk|walking|stroll/i,roar:/roar|growl|attack|call|cry/i};

function setup(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x080a0b); scene.fog=new THREE.FogExp2(0x080a0b,.025);
  camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100); camera.position.set(0,2.4,8);
  renderer=new THREE.WebGLRenderer({canvas:$('#stage'),antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.outputColorSpace=THREE.SRGBColorSpace;
  controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.enablePan=false; controls.minDistance=4; controls.maxDistance=11; controls.target.set(0,1.2,0);
  scene.add(new THREE.HemisphereLight(0xfff5e2,0x101820,2.5));
  const key=new THREE.DirectionalLight(0xffd99c,4); key.position.set(4,7,5); key.castShadow=true; scene.add(key);
  const rim=new THREE.DirectionalLight(0x5b9dff,2); rim.position.set(-5,3,-4); scene.add(rim);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(7,64),new THREE.MeshStandardMaterial({color:0x17130d,roughness:1,metalness:0})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  const grid=new THREE.GridHelper(12,24,0x342b1e,0x161616); grid.position.y=.01; scene.add(grid);
  animate();
}

function normalizeModel(model){
  const box=new THREE.Box3().setFromObject(model); const size=box.getSize(new THREE.Vector3()).length();
  if(size>0) model.scale.multiplyScalar(4.2/size);
  model.position.y=0;
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
}

function findClip(pattern){return clips.find(c=>pattern.test(c.name))||null;}
function stopMixer(){if(mixer){mixer.stopAllAction(); mixer.uncacheRoot(current); mixer=null;} clips=[];}
function setupClips(gltf){
  stopMixer();
  if(!gltf.animations?.length)return;
  mixer=new THREE.AnimationMixer(gltf.scene); clips=gltf.animations;
  mixer._actionsByMode={};
  ['idle','walk','roar'].forEach(mode=>{const clip=findClip(actionNames[mode]); if(clip)mixer._actionsByMode[mode]=mixer.clipAction(clip);});
}
function playMode(mode){
  if(!current)return; actionMode=mode;
  document.querySelectorAll('.action').forEach(b=>b.classList.toggle('active',b.dataset.action===mode));
  if(mixer){
    const target=mixer._actionsByMode?.[mode]||mixer._actionsByMode?.idle||clips[0]&&mixer.clipAction(clips[0]);
    if(target){Object.values(mixer._actionsByMode||{}).forEach(a=>a.stop());target.reset().fadeIn(.3).play();if(mode==='roar' && !actionNames.roar.test(target.getClip().name))target.setLoop(THREE.LoopOnce,1);else target.setLoop(THREE.LoopRepeat,Infinity);$('#actionHint').textContent=mixer._actionsByMode?.[mode]?'正在播放模型原生动作：'+target.getClip().name:'该模型没有对应 Roar，使用现有动画近似展示。';return;}
  }
  $('#actionHint').textContent='该模型没有骨骼动作，启用轻量展示动画。';
}

async function loadAnimal(kind){
  const token=++modelToken; active=kind; $('#modelStatus').textContent='正在加载 '+data[kind].name; $('#actionHint').textContent='读取模型动作…';
  if(current){scene.remove(current);current=null;} stopMixer();
  try{
    const gltf=await loader.loadAsync(data[kind].url); if(token!==modelToken)return;
    current=gltf.scene; normalizeModel(current); scene.add(current); setupClips(gltf); $('#loading').classList.add('hide'); $('#modelStatus').textContent=data[kind].name+' 已就绪';
    playMode('idle');
  }catch(error){
    console.error('Animal model load failed:',error); $('#loading').classList.add('hide'); $('#modelStatus').textContent=data[kind].name+' 加载失败'; $('#actionHint').textContent='模型资源无法访问，请刷新页面后重试。';
  }
}

function setInfo(kind){const d=data[kind];$('#animalNo').textContent=d.no;$('#name').textContent=d.name;$('#latin').textContent=d.latin;$('#tagline').textContent=d.tagline;$('#facts').innerHTML=d.facts.map(x=>`<div class="fact"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');$('#desc').textContent=d.desc;}
function select(kind){if(active===kind)return;setInfo(kind);speechSynthesis.cancel();document.querySelectorAll('.animal').forEach(b=>b.classList.toggle('active',b.dataset.animal===kind));loadAnimal(kind);}
function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();if(mixer)mixer.update(dt);if(current&&!mixer){current.position.y=Math.sin(performance.now()*.0018)*.018;}controls.update();renderer.render(scene,camera);}

$('.animals').addEventListener('click',e=>{const b=e.target.closest('.animal');if(b)select(b.dataset.animal);});
$('#actions').addEventListener('click',e=>{const b=e.target.closest('.action');if(b)playMode(b.dataset.action);});
$('#voiceBtn').onclick=()=>{if(!('speechSynthesis'in window))return alert('当前浏览器不支持语音合成');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(data[active].speech);u.lang='zh-CN';u.rate=.92;speechSynthesis.speak(u);};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
setup(); setInfo('lion'); loadAnimal('lion');
