import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const data = {
  lion: {
    no: '01', name: '非洲狮', latin: 'PANTHERA LEO',
    tagline: '草原上的群居大型猫科动物。',
    facts: [['栖息地', '非洲草原'], ['体重', '约 120–250 kg'], ['最高速度', '约 80 km/h']],
    desc: '狮子是现存最大的猫科动物之一。它们通常以群体形式生活，雄狮醒目的鬃毛是其最具代表性的特征之一。',
    speech: '你好，欢迎来到三维野生动物馆。现在看到的是非洲狮。狮子通常生活在非洲的草原和稀树草原地区，是少数具有稳定群居社会结构的大型猫科动物。',
    url: 'https://raw.githubusercontent.com/code4fukui/vr-cats/main/lion.glb'
  },
  tiger: {
    no: '02', name: '孟加拉虎', latin: 'PANTHERA TIGRIS TIGRIS',
    tagline: '独居、敏捷而强大的大型猫科捕食者。',
    facts: [['栖息地', '森林与草原'], ['体重', '约 100–260 kg'], ['最高速度', '短距离约 60 km/h']],
    desc: '老虎是现存体型最大的猫科动物之一。橙色毛皮上的深色条纹能帮助它融入林下斑驳的光影环境。',
    speech: '你好，现在来到老虎展区。老虎是体型最大的现存猫科动物之一，通常以独居方式活动，具有非常出色的力量、感知能力和短距离爆发力。',
    sourceUrl: 'https://www.42biz.in/3D.Models/tiger.glb'
  }
};

// 用 CORS 友好的公共代理读取 Tiger GLB，避免原始站点的跨域限制。
data.tiger.url = `https://api.allorigins.win/raw?url=${encodeURIComponent(data.tiger.sourceUrl)}`;

let scene, camera, renderer, controls;
const clock = new THREE.Clock();
let current = null;
let mixer = null;
let clips = [];
let active = 'lion';
let actionMode = 'idle';
let actionClock = 0;
const cache = new Map();
const loader = new GLTFLoader();
loader.setCrossOrigin('anonymous');
const $ = (selector) => document.querySelector(selector);

const patterns = {
  idle: /idle|stand|rest|breath/i,
  walk: /walk|walking|stroll|run|running/i,
  roar: /roar|growl|attack|call|cry/i
};

function setup() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a0b);
  scene.fog = new THREE.FogExp2(0x080a0b, 0.025);
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 2.4, 8);
  renderer = new THREE.WebGLRenderer({ canvas: $('#stage'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 11;
  controls.target.set(0, 1.2, 0);
  scene.add(new THREE.HemisphereLight(0xfff5e2, 0x101820, 2.5));
  const key = new THREE.DirectionalLight(0xffd99c, 4);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5b9dff, 2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0x17130d, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(12, 24, 0x342b1e, 0x161616);
  grid.position.y = 0.01;
  scene.add(grid);
  animate();
}

function stopMixer() {
  if (mixer) {
    mixer.stopAllAction();
    if (current) mixer.uncacheRoot(current);
    mixer = null;
  }
  clips = [];
}

function removeCurrentFromScene() {
  if (current) scene.remove(current);
  current = null;
  stopMixer();
}

function makeFallbackTiger() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xd88927, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x26170d, roughness: 1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf3e2c8, roughness: 1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), fur); body.scale.set(1.65, 0.82, 0.82); body.position.y = 1.25; g.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), white); chest.scale.set(0.8, 1.25, 0.95); chest.position.set(0.8, 1.05, 0); g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 40, 28), fur); head.position.set(1.45, 1.7, 0); g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 20), white); snout.scale.set(1.15, 0.8, 1); snout.position.set(1.86, 1.56, 0); g.add(snout);
  const earGeo = new THREE.SphereGeometry(0.22, 24, 18);
  for (const z of [-0.42, 0.42]) { const ear = new THREE.Mesh(earGeo, fur); ear.scale.set(0.8, 1.1, 0.65); ear.position.set(1.34, 2.2, z); g.add(ear); }
  for (const [x, y, z] of [[-0.85,0.68,-0.46],[-0.85,0.68,0.46],[0.95,0.68,-0.46],[0.95,0.68,0.46]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,1.2,20), fur); leg.position.set(x,y,z); g.add(leg); }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.15,2.2,18), fur); tail.rotation.z = -Math.PI/3.1; tail.position.set(-2,1.35,0); g.add(tail);
  for (let i=-2;i<=2;i++) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.95,1.65), dark); stripe.position.set(i*.42,1.35,0); stripe.rotation.z=i*.08; g.add(stripe); }
  return g;
}

function makeFallbackLion() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xb97b34, roughness: 0.9 });
  const maneMat = new THREE.MeshStandardMaterial({ color: 0x553019, roughness: 1 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), fur); body.scale.set(1.65,0.86,0.86); body.position.y=1.25; g.add(body);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(0.88,40,28), maneMat); mane.scale.set(0.82,1.05,1.05); mane.position.set(1.34,1.7,0); g.add(mane);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.68,40,28), fur); head.position.set(1.42,1.7,0); g.add(head);
  for (const x of [-0.75,0.95]) for (const z of [-0.45,0.45]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.22,1.25,20), fur); leg.position.set(x,0.68,z); g.add(leg); }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.15,2.1,18), fur); tail.rotation.z=-Math.PI/3; tail.position.set(-2,1.35,0); g.add(tail);
  return g;
}

function prepareModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  if (size > 0) model.scale.multiplyScalar(4.2 / size);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y;
  model.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
}

function setupClips(gltf) {
  if (!gltf.animations?.length) return;
  mixer = new THREE.AnimationMixer(gltf.scene);
  clips = gltf.animations;
  const map = {};
  for (const mode of Object.keys(patterns)) {
    const clip = clips.find((item) => patterns[mode].test(item.name));
    if (clip) map[mode] = mixer.clipAction(clip);
  }
  mixer._map = map;
}

function playMode(mode) {
  if (!current) return;
  actionMode = mode;
  actionClock = 0;
  document.querySelectorAll('.action').forEach((button) => button.classList.toggle('active', button.dataset.action === mode));
  if (mixer) {
    Object.values(mixer._map || {}).forEach((action) => action.stop());
    const target = mixer._map?.[mode] || mixer._map?.idle || (clips[0] ? mixer.clipAction(clips[0]) : null);
    if (target) {
      target.reset().fadeIn(0.25).play();
      target.setLoop(mode === 'roar' ? THREE.LoopOnce : THREE.LoopRepeat, mode === 'roar' ? 1 : Infinity);
      $('#actionHint').textContent = mixer._map?.[mode] ? `原生 GLB 动作：${target.getClip().name}` : '当前 GLB 没有该动作，正在使用可用动作近似。';
      return;
    }
  }
  $('#actionHint').textContent = `当前模型没有骨骼动作，使用轻量展示动画模拟 ${mode.toUpperCase()}。`;
}

function attachCached(kind, entry) {
  removeCurrentFromScene();
  current = entry.gltf.scene;
  prepareModel(current);
  scene.add(current);
  setupClips(entry.gltf);
  $('#modelStatus').textContent = entry.ok ? `${data[kind].name} 已就绪` : `${data[kind].name} / 备用展示`;
  playMode('idle');
}

async function preloadAnimal(kind) {
  if (cache.has(kind)) return cache.get(kind);
  try {
    const gltf = await loader.loadAsync(data[kind].url);
    const entry = { gltf, ok: true };
    cache.set(kind, entry);
    return entry;
  } catch (error) {
    console.error(`GLB preload failed: ${kind}`, error);
    const fallback = kind === 'tiger' ? makeFallbackTiger() : makeFallbackLion();
    const entry = { gltf: { scene: fallback, animations: [] }, ok: false };
    cache.set(kind, entry);
    return entry;
  }
}

async function preloadAll() {
  $('#modelStatus').textContent = '预加载狮子 + 老虎…';
  $('#actionHint').textContent = '正在同时下载并解析两个 3D 模型，完成后进入展馆。';
  const [lion, tiger] = await Promise.all([preloadAnimal('lion'), preloadAnimal('tiger')]);
  const realReady = Number(lion.ok) + Number(tiger.ok);
  $('#loading').querySelector('span').textContent = realReady === 2 ? '狮子与老虎已准备完成' : `已准备 ${realReady}/2 个真实 GLB，备用模型已就绪`;
  setInfo('lion');
  attachCached('lion', lion);
  $('#loading').classList.add('hide');
}

function setInfo(kind) {
  const d = data[kind];
  $('#animalNo').textContent = d.no;
  $('#name').textContent = d.name;
  $('#latin').textContent = d.latin;
  $('#tagline').textContent = d.tagline;
  $('#facts').innerHTML = d.facts.map(([label, value]) => `<div class="fact"><b>${label}</b><span>${value}</span></div>`).join('');
  $('#desc').textContent = d.desc;
}

function select(kind) {
  active = kind;
  setInfo(kind);
  speechSynthesis.cancel();
  document.querySelectorAll('.animal').forEach((button) => button.classList.toggle('active', button.dataset.animal === kind));
  const cached = cache.get(kind);
  if (cached) attachCached(kind, cached);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls?.update();
  renderer?.render(scene, camera);
}

$('.animals').addEventListener('click', (event) => {
  const button = event.target.closest('.animal');
  if (button) select(button.dataset.animal);
});
$('#actions').addEventListener('click', (event) => {
  const button = event.target.closest('.action');
  if (button) playMode(button.dataset.action);
});
$('#voiceBtn').onclick = () => {
  if (!('speechSynthesis' in window)) return alert('当前浏览器不支持语音合成');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(data[active].speech);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.92;
  speechSynthesis.speak(utterance);
};
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

setup();
setInfo('lion');
preloadAll();
