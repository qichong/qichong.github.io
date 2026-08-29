import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/DRACOLoader.js';
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
let currentActions = {};
let active = 'lion';
const clock = new THREE.Clock();

function setLoading(title, detail) {
  $('#loadingStage').textContent = title;
  $('#loadingMessage').textContent = detail;
}

function renderAnimalButtons() {
  $('.animals').innerHTML = ANIMALS.map((d) =>
    `<button class="animal${d.id === active ? ' active' : ''}" data-animal="${d.id}"><span>${d.no}</span> ${d.emoji} ${d.name}</button>`
  ).join('');
}

function info(kind) {
  const d = SPECIES[kind];
  if (!d) return;
  $('#animalNo').textContent = d.no;
  $('#name').textContent = d.name;
  $('#latin').textContent = d.latin;
  $('#tagline').textContent = `${d.category} · ${d.facts?.[0]?.[1] || ''}`;
  $('#facts').innerHTML = (d.facts || []).map(([a, b]) => `<div class="fact"><b>${a}</b><span>${b}</span></div>`).join('');
  $('#desc').textContent = d.desc || '';
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

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 64),
    new THREE.MeshStandardMaterial({ color: 0x17130d, roughness: 1 })
  );
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

  const task = (async () => {
    const d = SPECIES[kind];
    const s = state[kind];
    s.phase = 'downloading';
    s.loaded = 0;
    s.total = 0;
    updateProgress();

    setLoading(`正在读取 ${d.name}`, '读取同域本地 GLB，支持 Draco 压缩模型。');

    const res = await fetch(d.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${d.name} HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();
    s.loaded = buffer.byteLength;
    s.total = buffer.byteLength;
    updateProgress();

    if (buffer.byteLength < 20) throw new Error(`${d.name} GLB 文件过小`);

    const magic = new Uint8Array(buffer, 0, 4);
    const signature = String.fromCharCode(magic[0], magic[1], magic[2], magic[3]);
    if (signature !== 'glTF') throw new Error(`${d.name} 不是有效 GLB（magic=${signature}）`);

    return buffer;
  })();

  pending.set(kind, task);
  try {
    return await task;
  } finally {
    pending.delete(kind);
  }
}

async function load(kind) {
  if (cache.has(kind)) return cache.get(kind);

  const buffer = await fetchBuffer(kind);
  state[kind].phase = 'parsing';
  setLoading(`正在解析 ${SPECIES[kind].name}`, '正在解码 Draco / 创建网格、材质、骨骼和动画。');

  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  cache.set(kind, gltf);
  state[kind].phase = 'done';
  updateProgress();
  return gltf;
}

function prepare(model, kind) {
  if (model.userData.animalPrepared) return;
  const target = SPECIES[kind]?.target || 3.5;
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
  mixer = null;
  currentActions = {};
  if (!gltf.animations?.length) return;

  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    const name = clip.name || '';
    if (!currentActions.idle && /idle|stand|survey|rest|breath|wait/i.test(name)) currentActions.idle = mixer.clipAction(clip);
    if (!currentActions.walk && /walk|walking|stroll|run|running|locomotion|move/i.test(name)) currentActions.walk = mixer.clipAction(clip);
    if (!currentActions.roar && /roar|growl|attack|call|cry|bite/i.test(name)) currentActions.roar = mixer.clipAction(clip);
    if (!currentActions.dead && /dead|death|die/i.test(name)) currentActions.dead = mixer.clipAction(clip);
  }
  if (!currentActions.idle) currentActions.idle = mixer.clipAction(gltf.animations[0]);
}

function renderActionButtons() {
  $('#actions').innerHTML = [
    ['idle', '◌ Idle'],
    ['walk', '↗ Walk / Run'],
    ['roar', '◉ Attack / Call'],
    ['dead', '✕ Dead']
  ].map(([id, text]) => `<button class="action" data-action="${id}">${text}</button>`).join('');
}

function playAction(mode) {
  document.querySelectorAll('.action').forEach((b) => b.classList.toggle('active', b.dataset.action === mode));

  if (!mixer) {
    $('#actionHint').textContent = '当前模型没有骨骼动作。';
    return;
  }

  const action = currentActions[mode] || currentActions.idle;
  if (!action) return;

  Object.values(currentActions).forEach((a) => a.stop());
  const once = mode === 'roar' || mode === 'dead';
  action.reset().fadeIn(0.18).play();
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;
  $('#actionHint').textContent = currentActions[mode]
    ? `${SPECIES[active].name}：${action.getClip().name}`
    : `${SPECIES[active].name}：使用可用动作`;
}

function removeCurrent() {
  if (!current) return;
  if (mixer) mixer.stopAllAction();
  scene.remove(current);
  current = null;
  mixer = null;
  currentActions = {};
}

function show(kind, gltf) {
  active = kind;
  info(kind);
  renderAnimalButtons();
  renderActionButtons();
  removeCurrent();

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
    show(kind, gltf);
    $('#loading').classList.add('hide');
  } catch (error) {
    state[kind].phase = 'error';
    console.error(`${kind} load failed`, error);
    $('#modelStatus').textContent = `${SPECIES[kind].name} 加载失败`;
    $('#actionHint').textContent = error?.message || '模型读取失败';
    $('#loading').classList.add('hide');
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
  const button = e.target.closest('.animal');
  if (button) select(button.dataset.animal);
});

$('#actions').addEventListener('click', (e) => {
  const button = e.target.closest('.action');
  if (button) playAction(button.dataset.action);
});

$('#voiceBtn').addEventListener('click', () => {
  const d = SPECIES[active];
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(d.speech || `现在看到的是${d.name}。`);
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
  setLoading('正在准备动物馆', '首屏等待狮子、老虎、赤狐；其余模型随后后台加载。');

  const firstResults = await Promise.allSettled(firstThree.map((kind) => load(kind)));
  const firstReadyIndex = firstResults.findIndex((x) => x.status === 'fulfilled');

  if (firstReadyIndex >= 0) {
    const firstKind = firstThree[firstReadyIndex];
    show(firstKind, firstResults[firstReadyIndex].value);
  }

  $('#loadingMessage').textContent = firstResults.filter((x) => x.status === 'fulfilled').length === 3
    ? '首屏前三个真实动物已加载完成，其余模型正在后台加载。'
    : '首屏部分模型加载完成，其余模型继续后台加载。';

  setTimeout(() => $('#loading').classList.add('hide'), 300);

  const queue = ANIMALS.map((x) => x.id).filter((id) => !firstThree.includes(id));
  const worker = async () => {
    while (queue.length) {
      const kind = queue.shift();
      try {
        await load(kind);
      } catch (error) {
        state[kind].phase = 'error';
        console.warn(`${kind} background preload failed`, error);
      }
    }
  };

  await Promise.all([worker(), worker()]);
})();
