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
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
loader.setDRACOLoader(draco);

let scene, camera, renderer, controls;
let current = null;
let mixer = null;
let currentActions = {};
let active = 'lion';
const clock = new THREE.Clock();

function setup() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a0b);
  scene.fog = new THREE.FogExp2(0x080a0b, 0.025);
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 2.4, 8);
  renderer = new THREE.WebGLRenderer({ canvas: $('#stage'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 12;
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

function setLoading(title, detail) {
  $('#loadingStage').textContent = title;
  $('#loadingMessage').textContent = detail;
}

function renderAnimalButtons() {
  $('.animals').innerHTML = ANIMALS.map((d) => `<button class="animal${d.id === active ? ' active' : ''}" data-animal="${d.id}"><span>${d.no}</span> ${d.emoji} ${d.name}</button>`).join('');
}

function info(kind) {
  const d = SPECIES[kind];
  $('#animalNo').textContent = d.no;
  $('#name').textContent = d.name;
  $('#latin').textContent = d.latin;
  $('#tagline').textContent = `${d.category} · ${d.facts?.[0]?.[1] || ''}`;
  $('#facts').innerHTML = d.facts.map(([a, b]) => `<div class="fact"><b>${a}</b><span>${b}</span></div>`).join('');
  $('#desc').textContent = d.desc;
}

function updateProgress() {
  const entries = Object.values(state);
  const total = entries.reduce((n, s) => n + (s.total || 0), 0);
  const loaded = entries.reduce((n, s) => n + Math.min(s.loaded, s.total || s.loaded), 0);
  const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  $('#progressFill').style.width = `${pct}%`;
  $('#progressPercent').textContent = `${pct}%`;
  $('#progressSize').textContent = total ? `${(loaded / 1048576).toFixed(1)} MB / ${(total / 1048576).toFixed(1)} MB` : '本地 GLB';
}

async function fetchBuffer(kind) {
  if (pending.has(kind)) return pending.get(kind);
  const p = (async () => {
    const d = SPECIES[kind];
    const s = state[kind];
    s.phase = 'downloading';
    if (!$('#loading').classList.contains('hide')) setLoading(`正在读取 ${d.name}`, '模型位于 GitHub Pages 同域目录。');
    updateProgress();
    const res = await fetch(d.url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`${d.name} HTTP ${res.status}`);
    const encoding = res.headers.get('content-encoding');
    const declaredTotal = Number(res.headers.get('content-length')) || 0;
    s.total = encoding ? 0 : declaredTotal;
    if (!res.body) {
      const buffer = await res.arrayBuffer();
      s.loaded = buffer.byteLength;
      s.total = buffer.byteLength;
      updateProgress();
      return buffer;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      s.loaded = size;
      if (!s.total) s.total = size;
      updateProgress();
    }
    s.total = size;
    const out = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
    s.loaded = size;
    updateProgress();
    return out.buffer;
  })();
  pending.set(kind, p);
  try { return await p; } finally { pending.delete(kind); }
}

async function load(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const buffer = await fetchBuffer(kind);
  state[kind].phase = 'parsing';
  if (!$('#loading').classList.contains('hide')) setLoading(`正在解析 ${SPECIES[kind].name}`, '正在解码网格、材质、骨骼和动画。');
  const d = SPECIES[kind];
  const modelUrl = new URL(d.url, location.href);
  const resourcePath = new URL('.', modelUrl).href;
  console.debug(`[animal-3d] ${d.name} resource path:`, resourcePath);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buffer, resourcePath, (result) => resolve(result), (error) => {
      console.error(`[animal-3d] ${d.name} parse/texture error`, error);
      reject(error);
    });
  });
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => {
      if (!material) return;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      if (material.emissiveMap) material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (material.metalnessMap) material.metalnessMap.colorSpace = THREE.NoColorSpace;
      if (material.roughnessMap) material.roughnessMap.colorSpace = THREE.NoColorSpace;
      if (material.normalMap) material.normalMap.colorSpace = THREE.NoColorSpace;
      if (material.aoMap) material.aoMap.colorSpace = THREE.NoColorSpace;
    });
  });
  cache.set(kind, gltf);
  state[kind].phase = 'done';
  return gltf;
}

function prepare(model, kind) {
  if (model.userData.animalPrepared) return;
  const target = SPECIES[kind].target || 3.5;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  if (size > 0) model.scale.multiplyScalar(target / size);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -fitted.min.y, -center.z);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
  });
  model.userData.animalPrepared = true;
}

function makeActions(gltf) {
  currentActions = {};
  if (!gltf.animations?.length) return;
  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    const n = clip.name || '';
    if (!currentActions.idle && /idle|stand|survey|rest|breath|wait/i.test(n)) currentActions.idle = mixer.clipAction(clip);
    if (!currentActions.walk && /walk|walking|stroll|run|running|locomotion|move/i.test(n)) currentActions.walk = mixer.clipAction(clip);
    if (!currentActions.roar && /roar|growl|attack|call|cry|bite/i.test(n)) currentActions.roar = mixer.clipAction(clip);
  }
  if (!currentActions.idle) currentActions.idle = mixer.clipAction(gltf.animations[0]);
}

function renderActionButtons() {
  $('#actions').innerHTML = '<button class="action" data-action="idle">◌ Idle</button><button class="action" data-action="walk">↗ Walk / Run</button><button class="action" data-action="roar">◉ Attack / Call</button>';
}

function playAction(mode) {
  document.querySelectorAll('.action').forEach((b) => b.classList.toggle('active', b.dataset.action === mode));
  const action = currentActions[mode] || currentActions.idle;
  const hasExact = Boolean(currentActions[mode]);
  if (!action) {
    $('#actionHint').textContent = '当前模型没有骨骼动作。';
    return;
  }
  Object.values(currentActions).forEach((a) => a.stop());
  action.reset().fadeIn(0.18).play();
  const once = mode === 'roar';
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;
  $('#actionHint').textContent = hasExact ? `${SPECIES[active].name}：${action.getClip().name}` : `${SPECIES[active].name}：使用可用动作`;
}

async function show(kind, gltf) {
  active = kind;
  info(kind);
  renderAnimalButtons();
  renderActionButtons();
  if (current) {
    if (mixer) mixer.stopAllAction();
    scene.remove(current);
  }
  mixer = null;
  current = gltf.scene;
  prepare(current, kind);
  scene.add(current);
  makeActions(gltf);
  $('#modelStatus').textContent = `${SPECIES[kind].name} · 本地 GLB 已就绪`;
  playAction('idle');
}

async function select(kind) {
  active = kind;
  info(kind);
  renderAnimalButtons();
  try {
    const gltf = await load(kind);
    await show(kind, gltf);
    $('#loading').classList.add('hide');
  } catch (error) {
    state[kind].phase = 'error';
    console.error(`${kind} load failed`, error);
    $('#modelStatus').textContent = `${SPECIES[kind].name} 加载失败`;
    $('#actionHint').textContent = error?.message || '模型读取失败';
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls?.update();
  renderer?.render(scene, camera);
}

$('.animals').addEventListener('click', (e) => {
  const b = e.target.closest('.animal');
  if (b) select(b.dataset.animal);
});
$('#actions').addEventListener('click', (e) => {
  const b = e.target.closest('.action');
  if (b) playAction(b.dataset.action);
});
$('#voiceBtn').addEventListener('click', () => {
  const d = SPECIES[active];
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(d.speech);
  u.lang = 'zh-CN';
  u.rate = 0.92;
  speechSynthesis.speak(u);
});

setup();
renderAnimalButtons();
renderActionButtons();
info(active);

(async () => {
  const firstThree = ANIMALS.slice(0, 3).map((x) => x.id);
  setLoading('正在准备动物馆', '首屏只等待前 3 个真实模型，其他模型随后后台加载。');
  const firstResults = await Promise.allSettled(firstThree.map((kind) => load(kind)));
  const firstReadyIndex = firstResults.findIndex((x) => x.status === 'fulfilled');
  if (firstReadyIndex >= 0) {
    const firstKind = firstThree[firstReadyIndex];
    await show(firstKind, firstResults[firstReadyIndex].value);
  }
  const readyCount = firstResults.filter((x) => x.status === 'fulfilled').length;
  $('#loadingMessage').textContent = readyCount === 3 ? '首屏前三个真实动物已经加载完成，其余模型正在后台加载。' : `首屏模型 ${readyCount}/3 个加载成功，其余模型继续后台加载。`;
  setTimeout(() => $('#loading').classList.add('hide'), 300);
  const queue = ANIMALS.map((x) => x.id).filter((id) => !firstThree.includes(id));
  const worker = async () => {
    while (queue.length) {
      const kind = queue.shift();
      try { await load(kind); }
      catch (error) { state[kind].phase = 'error'; console.warn(`${kind} background preload failed`, error); }
    }
  };
  await Promise.all([worker(), worker()]);
})();
