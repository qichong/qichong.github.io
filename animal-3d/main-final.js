import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/DRACOLoader.js';

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

const state = {
  lion: { loaded: 0, total: 0, phase: 'waiting' },
  tiger: { loaded: 0, total: 0, phase: 'waiting' }
};
const cache = new Map();
const pending = new Map();

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let scene, camera, renderer, controls;
let current = null;
let mixer = null;
let active = 'lion';
const clock = new THREE.Clock();
const actionPatterns = {
  idle: /idle|stand|rest|breath|wait/i,
  walk: /walk|walking|stroll|run|running|locomotion|move/i,
  roar: /roar|growl|attack|call|cry|bite/i
};

function mb(v) { return v ? (v / 1048576).toFixed(1) + ' MB' : '—'; }
function phaseText(s) {
  if (s.phase === 'done') return '完成';
  if (s.phase === 'parsing') return '解析中';
  if (s.phase === 'error') return '失败';
  if (s.phase === 'downloading') return s.total ? Math.min(100, Math.floor(Math.min(s.loaded, s.total) / s.total * 100)) + '%' : '下载中';
  return '等待';
}
function refreshProgress() {
  const a = state.lion, b = state.tiger;
  const total = a.total + b.total;
  const loaded = Math.min(a.loaded, a.total || a.loaded) + Math.min(b.loaded, b.total || b.loaded);
  let pct = total ? Math.min(100, Math.floor(loaded / total * 100)) : 0;
  if (a.phase === 'done' && b.phase === 'done') pct = 100;
  $('#progressFill').style.width = pct + '%';
  $('#progressPercent').textContent = pct + '%';
  $('#progressSize').textContent = total ? `${mb(loaded)} / ${mb(total)}` : '读取模型大小…';
  $('#lionProgress').textContent = phaseText(a);
  $('#tigerProgress').textContent = phaseText(b);
}
function stage(title, msg) {
  $('#loadingStage').textContent = title;
  $('#loadingMessage').textContent = msg;
}
function info(kind) {
  const d = SPECIES[kind];
  $('#animalNo').textContent = d.no;
  $('#name').textContent = d.name;
  $('#latin').textContent = d.latin;
  $('#tagline').textContent = d.tagline;
  $('#facts').innerHTML = d.facts.map(([a,b]) => `<div class="fact"><b>${a}</b><span>${b}</span></div>`).join('');
  $('#desc').textContent = d.desc;
}
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
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  animate();
}
async function fetchBuffer(kind) {
  if (pending.has(kind)) return pending.get(kind);
  const p = (async () => {
    const s = state[kind];
    s.phase = 'downloading';
    s.loaded = 0;
    s.total = 0;
    stage(`正在下载 ${SPECIES[kind].name}`, `${SPECIES[kind].name}：读取 GLB 文件…`);
    refreshProgress();
    const res = await fetch(SPECIES[kind].url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${SPECIES[kind].name} HTTP ${res.status}`);
    s.total = Number(res.headers.get('content-length')) || 0;
    if (!res.body) {
      const buf = await res.arrayBuffer();
      s.loaded = buf.byteLength;
      if (!s.total) s.total = s.loaded;
      refreshProgress();
      return buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    while (true) {
      const x = await reader.read();
      if (x.done) break;
      chunks.push(x.value);
      s.loaded += x.value.byteLength;
      if (s.total) s.loaded = Math.min(s.loaded, s.total);
      refreshProgress();
    }
    s.loaded = s.total || s.loaded;
    const out = new Uint8Array(s.loaded);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
    refreshProgress();
    return out.buffer;
  })();
  pending.set(kind, p);
  try { return await p; } finally { pending.delete(kind); }
}
async function load(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const buffer = await fetchBuffer(kind);
  state[kind].phase = 'parsing';
  stage(`正在解析 ${SPECIES[kind].name}`, `${SPECIES[kind].name}：正在解码压缩网格、建立材质与骨骼…`);
  refreshProgress();
  const gltf = await new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));
  cache.set(kind, gltf);
  state[kind].phase = 'done';
  refreshProgress();
  return gltf;
}
function prepare(model, kind) {
  if (model.userData.animalPrepared) return;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  if (size) model.scale.multiplyScalar(SPECIES[kind].target / size);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -fitted.min.y, -center.z);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  model.userData.animalPrepared = true;
}
function buildActions(gltf) {
  mixer = null;
  if (!gltf.animations?.length) return;
  mixer = new THREE.AnimationMixer(gltf.scene);
  const map = {};
  for (const clip of gltf.animations) {
    const name = clip.name || '';
    if (!map.idle && actionPatterns.idle.test(name)) map.idle = mixer.clipAction(clip);
    if (!map.walk && actionPatterns.walk.test(name)) map.walk = mixer.clipAction(clip);
    if (!map.roar && actionPatterns.roar.test(name)) map.roar = mixer.clipAction(clip);
  }
  if (!map.idle) map.idle = mixer.clipAction(gltf.animations[0]);
  mixer.map = map;
}
function playAction(mode) {
  document.querySelectorAll('.action').forEach(b => b.classList.toggle('active', b.dataset.action === mode));
  if (!mixer) { $('#actionHint').textContent = '这个 GLB 没有骨骼动作。'; return; }
  Object.values(mixer.map).forEach(a => a.stop());
  const action = mixer.map[mode] || mixer.map.idle;
  if (!action) return;
  action.reset().fadeIn(0.2).play();
  action.setLoop(mode === 'roar' ? THREE.LoopOnce : THREE.LoopRepeat, mode === 'roar' ? 1 : Infinity);
  $('#actionHint').textContent = mixer.map[mode] ? `原生 GLB 动作：${action.getClip().name}` : '当前 GLB 没有该动作，使用可用动作。';
}
function show(kind, gltf) {
  if (current) scene.remove(current);
  if (mixer) mixer.stopAllAction();
  current = gltf.scene;
  prepare(current, kind);
  scene.add(current);
  buildActions(gltf);
  $('#modelStatus').textContent = `${SPECIES[kind].name} 已就绪`;
  playAction('idle');
}
function select(kind) {
  active = kind;
  info(kind);
  speechSynthesis.cancel();
  document.querySelectorAll('.animal').forEach(b => b.classList.toggle('active', b.dataset.animal === kind));
  const gltf = cache.get(kind);
  if (gltf) show(kind, gltf);
}
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls?.update();
  renderer?.render(scene, camera);
}

$('.animals').addEventListener('click', e => { const b = e.target.closest('.animal'); if (b) select(b.dataset.animal); });
$('#actions').addEventListener('click', e => { const b = e.target.closest('.action'); if (b) playAction(b.dataset.action); });
$('#voiceBtn').addEventListener('click', () => {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(SPECIES[active].speech);
  u.lang = 'zh-CN';
  u.rate = 0.92;
  speechSynthesis.speak(u);
});

setup();
info('lion');
(async () => {
  stage('正在预加载动物模型', '狮子和老虎会同时下载并解析，完成后切换无需重新下载。');
  const tasks = ['lion', 'tiger'].map(async kind => {
    try { return { kind, gltf: await load(kind) }; }
    catch (e) { state[kind].phase = 'error'; refreshProgress(); console.error(`${kind} load failed`, e); return { kind, error: e }; }
  });
  const results = await Promise.all(tasks);
  const lion = results.find(x => x.kind === 'lion');
  const tiger = results.find(x => x.kind === 'tiger');
  if (lion?.gltf && tiger?.gltf) {
    show('lion', lion.gltf);
    $('#loadingMessage').textContent = '狮子与老虎均已加载完成，可以瞬间切换。';
    $('#progressFill').style.width = '100%';
    $('#progressPercent').textContent = '100%';
    setTimeout(() => $('#loading').classList.add('hide'), 350);
  } else {
    const failed = !lion?.gltf ? '狮子' : '老虎';
    stage(`${failed} 模型加载失败`, (lion?.error || tiger?.error)?.message || '请刷新页面重试。');
    $('#loadingMessage').textContent = `${failed}没有成功加载，浏览器控制台会显示具体错误。`;
  }
})();
