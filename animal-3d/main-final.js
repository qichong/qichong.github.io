import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/DRACOLoader.js';
import { initOfficialScenes, updateOfficialScenes } from './threejs-examples-scenes.js';
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
let allAnimationActions = [];
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

  initOfficialScenes(scene, () => active);

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
  pending.set(kind, p);
  try { return await p; } finally { pending.delete(kind); }
}

async function applyEmbeddedTextureFallback(gltf, kind) {
  const parser = gltf?.parser;
  const json = parser?.json;
  const materials = json?.materials || [];
  const textureIndexes = new Set();
  for (const materialDef of materials) {
    const ext = materialDef?.extensions?.KHR_materials_pbrSpecularGlossiness;
    const index = ext?.diffuseTexture?.index;
    if (Number.isInteger(index)) textureIndexes.add(index);
  }
  if (!textureIndexes.size || !parser?.getDependency) return;
  const textures = [];
  for (const index of textureIndexes) {
    try {
      const texture = await parser.getDependency('texture', index);
      if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        textures.push(texture);
      }
    } catch (error) {
      console.warn(`[animal-3d] ${kind} embedded texture ${index} failed`, error);
    }
  }
  if (!textures.length) return;
  let textureCursor = 0;
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((material) => {
      if (!material || material.map) return;
      const texture = textures[Math.min(textureCursor, textures.length - 1)];
      material.map = texture;
      textureCursor += 1;
      material.color?.set?.(0xffffff);
      material.needsUpdate = true;
    });
  });
}

async function load(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const buffer = await fetchBuffer(kind);
  state[kind].phase = 'parsing';
  if (!$('#loading').classList.contains('hide')) setLoading(`正在解析 ${SPECIES[kind].name}`, '正在解码网格、材质、骨骼和动画。');
  const d = SPECIES[kind];
  const modelUrl = new URL(d.url, location.href);
  const resourcePath = new URL('.', modelUrl).href;
  const gltf = await new Promise((resolve, reject) => loader.parse(buffer, resourcePath, resolve, reject));
  await applyEmbeddedTextureFallback(gltf, kind);
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
      material.needsUpdate = true;
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
  });
  model.userData.animalPrepared = true;
}

function animationCategory(name) {
  const n = String(name || '').toLowerCase().replace(/[|:/\\-]+/g, ' ');
  if (/idle|stand|survey|rest|breath|wait|look|alert/.test(n)) return 'idle';
  if (/run|running|gallop|sprint|charge/.test(n)) return 'run';
  if (/walk|walking|stroll|locomotion|move|trot/.test(n)) return 'walk';
  if (/attack|roar|growl|aggr|bite|claw|strike|hit|fight|call|cry/.test(n)) return 'attack';
  if (/dead|death|die|dying|fall|faint/.test(n)) return 'death';
  return null;
}

function makeActions(gltf) {
  mixer = null;
  currentActions = {};
  allAnimationActions = [];
  const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
  if (!clips.length) return;

  mixer = new THREE.AnimationMixer(gltf.scene);
  clips.forEach((clip, index) => {
    const action = mixer.clipAction(clip);
    const category = animationCategory(clip.name);
    const item = { index, name: clip.name || `Animation ${index + 1}`, action, category };
    allAnimationActions.push(item);
    if (category && !currentActions[category]) currentActions[category] = action;
  });

  // 某些导出器会给第一段动作一个没有语义的名字，仍然保证 Idle 可播放。
  if (!currentActions.idle) currentActions.idle = allAnimationActions[0].action;

  // Run 缺失时，Walk 作为安全降级；Attack / Death 同理不强行冒充。
  if (!currentActions.run && currentActions.walk) currentActions.run = currentActions.walk;
}

function renderActionButtons() {
  const labels = [
    ['idle', '◌ Idle'],
    ['walk', '↗ Walk'],
    ['run', '➜ Run'],
    ['attack', '◉ Attack'],
    ['death', '✕ Death']
  ];
  const semantic = labels
    .filter(([id]) => Boolean(currentActions[id]))
    .map(([id, text]) => `<button class="action" data-action="${id}">${text}</button>`)
    .join('');

  const raw = allAnimationActions
    .filter((item) => item.name && !['idle', 'walk', 'run', 'attack', 'death'].includes(item.category))
    .map((item) => `<button class="action action-raw" data-action-index="${item.index}" title="${item.name.replace(/"/g, '&quot;')}">◇ ${item.name}</button>`)
    .join('');

  $('#actions').innerHTML = semantic + raw;
  $('#actionHint').textContent = allAnimationActions.length
    ? `检测到 ${allAnimationActions.length} 个原始动画；已按来源动作自动映射。`
    : '当前模型没有骨骼动作。';
}

function stopAllActions() {
  const seen = new Set();
  Object.values(currentActions).forEach((action) => {
    if (!action || seen.has(action)) return;
    seen.add(action);
    action.stop();
  });
  allAnimationActions.forEach((item) => {
    if (!item.action || seen.has(item.action)) return;
    seen.add(item.action);
    item.action.stop();
  });
}

function playSpecificAction(action, label, once = false, rawIndex = null) {
  if (!mixer || !action) {
    $('#actionHint').textContent = '当前模型没有可播放的骨骼动作。';
    return;
  }
  stopAllActions();
  action.reset().fadeIn(0.18).play();
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;

  document.querySelectorAll('.action').forEach((b) => {
    b.classList.toggle('active', rawIndex != null
      ? b.dataset.actionIndex === String(rawIndex)
      : b.dataset.action === label);
  });
  $('#actionHint').textContent = `${SPECIES[active].name}：${label}`;
}

function playAction(mode) {
  const action = currentActions[mode];
  if (!action) {
    $('#actionHint').textContent = `${SPECIES[active].name}：暂无 ${mode} 动作`;
    return;
  }
  const clipName = action.getClip()?.name || mode;
  playSpecificAction(action, clipName, mode === 'attack' || mode === 'death');
}

function playRawAction(index) {
  const item = allAnimationActions.find((x) => x.index === index);
  if (!item) return;
  playSpecificAction(item.action, item.name, Boolean(item.category === 'attack' || item.category === 'death'), index);
}

async function show(kind, gltf) {
  active = kind;
  info(kind);
  if (current) {
    if (mixer) stopAllActions();
    scene.remove(current);
  }
  mixer = null;
  currentActions = {};
  allAnimationActions = [];
  current = gltf.scene;
  prepare(current, kind);
  scene.add(current);
  makeActions(gltf);
  renderAnimalButtons();
  renderActionButtons();
  $('#modelStatus').textContent = `${SPECIES[kind].name} · 本地 GLB 已就绪`;
  if (currentActions.idle) playAction('idle');
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
  updateOfficialScenes(dt);
  controls?.update();
  renderer?.render(scene, camera);
}

$('.animals').addEventListener('click', (e) => {
  const b = e.target.closest('.animal');
  if (b) select(b.dataset.animal);
});

$('#actions').addEventListener('click', (e) => {
  const b = e.target.closest('.action');
  if (!b) return;
  if (b.dataset.actionIndex != null) playRawAction(Number(b.dataset.actionIndex));
  else if (b.dataset.action) playAction(b.dataset.action);
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
