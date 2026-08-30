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
let environment = null;
const clock = new THREE.Clock();

const ENVIRONMENTS = {
  savanna: { sky: 0xb9dcff, fog: 0xc5d9d1, ground: 0xb99a67, fogDensity: 0.012 },
  forest: { sky: 0xaec8c0, fog: 0xb5c7c0, ground: 0x68785b, fogDensity: 0.018 },
  rainforest: { sky: 0x8fb8af, fog: 0x7fa39a0, ground: 0x566947, fogDensity: 0.022 },
  wetland: { sky: 0xacc6cf, fog: 0xa7b9b4, ground: 0x61715b, fogDensity: 0.018 },
  meadow: { sky: 0xb9ddff, fog: 0xd2dfd7, ground: 0x83a467, fogDensity: 0.011 },
  mountain: { sky: 0xc6dcf3, fog: 0xb8c7cf, ground: 0x7b8270, fogDensity: 0.012 },
  coast: { sky: 0xb9dcf2, fog: 0xb5cdd1, ground: 0xc9b989, fogDensity: 0.01 },
  ocean: { sky: 0x4b91ad, fog: 0x4d8ca3, ground: 0x2e7081, fogDensity: 0.016 },
  seabed: { sky: 0x145168, fog: 0x1c5d70, ground: 0x6a795d, fogDensity: 0.02 }
};

function environmentFor(kind) {
  const map = {
    lion: 'savanna',
    tiger: 'forest',
    fox: 'forest',
    black_panther: 'rainforest',
    lioness: 'savanna',
    alligator: 'wetland',
    shark: 'ocean',
    whale: 'ocean',
    horse: 'meadow',
    deer: 'mountain',
    rabbit: 'meadow',
    seagull: 'coast',
    macaw: 'rainforest',
    starfish: 'seabed',
    swordfish: 'ocean',
    tuna: 'ocean'
  };
  return map[kind] || 'meadow';
}

function disposeEnvironment() {
  if (!environment) return;
  environment.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => m?.dispose?.());
  });
  scene.remove(environment);
  environment = null;
}

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.scale.set(...scale);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

function addTree(group, x, z, scale = 1, tropical = false) {
  const trunk = mesh(
    new THREE.CylinderGeometry(0.09 * scale, 0.16 * scale, 1.4 * scale, 7),
    new THREE.MeshStandardMaterial({ color: tropical ? 0x5f4a32 : 0x6c5538, roughness: 1 }),
    [x, 0.7 * scale, z]
  );
  group.add(trunk);
  if (tropical) {
    group.add(mesh(new THREE.ConeGeometry(0.8 * scale, 1.5 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x2e6635, roughness: 1 }), [x, 1.65 * scale, z]));
    group.add(mesh(new THREE.SphereGeometry(0.65 * scale, 9, 7), new THREE.MeshStandardMaterial({ color: 0x438247, roughness: 1 }), [x - 0.32 * scale, 2.05 * scale, z + 0.12 * scale]));
  } else {
    group.add(mesh(new THREE.ConeGeometry(0.75 * scale, 1.5 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x4f763f, roughness: 1 }), [x, 1.65 * scale, z]));
    group.add(mesh(new THREE.ConeGeometry(0.58 * scale, 1.1 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x608b48, roughness: 1 }), [x, 2.3 * scale, z]));
  }
}

function addGrass(group, x, z, scale = 1, count = 8) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6d923e, roughness: 1 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = 0.18 * scale + (i % 2) * 0.06;
    group.add(mesh(new THREE.ConeGeometry(0.025 * scale, (0.28 + (i % 3) * 0.08) * scale, 4), mat, [x + Math.cos(a) * r, 0.16 * scale, z + Math.sin(a) * r], [0, 0, (i % 2 ? 0.22 : -0.22)]));
  }
}

function addRock(group, x, z, s = 1, color = 0x68665e) {
  group.add(mesh(new THREE.DodecahedronGeometry(0.32 * s, 0), new THREE.MeshStandardMaterial({ color, roughness: 1 }), [x, 0.2 * s, z], [0, (x + z) % 1, 0], [1.25, 0.75, 1]));
}

function addMountain(group, x, z, s = 1) {
  group.add(mesh(new THREE.ConeGeometry(1.5 * s, 2.7 * s, 5), new THREE.MeshStandardMaterial({ color: 0x69746c, roughness: 1 }), [x, 1.25 * s, z]));
  group.add(mesh(new THREE.ConeGeometry(0.55 * s, 1.1 * s, 5), new THREE.MeshStandardMaterial({ color: 0xd7dfe2, roughness: 1 }), [x, 2.2 * s, z - 0.02]));
}

function buildEnvironment(kind) {
  disposeEnvironment();
  const type = environmentFor(kind);
  const cfg = ENVIRONMENTS[type];
  environment = new THREE.Group();
  environment.name = `environment-${type}`;

  scene.background = new THREE.Color(cfg.sky);
  scene.fog = new THREE.FogExp2(cfg.fog, cfg.fogDensity);

  if (type === 'ocean' || type === 'seabed') {
    const water = mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: type === 'seabed' ? 0x347b8c : 0x3189a8, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.82 }), [0, -0.08, 0], [-Math.PI / 2, 0, 0]);
    environment.add(water);
    for (let i = 0; i < 10; i++) {
      const x = -6 + (i % 5) * 3;
      const z = -6 + Math.floor(i / 5) * 3;
      environment.add(mesh(new THREE.ConeGeometry(0.14 + (i % 3) * 0.05, 0.4 + (i % 4) * 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x6e9a61, roughness: 1 }), [x, 0.15, z]));
    }
    for (let i = 0; i < 12; i++) addRock(environment, -5.5 + (i * 1.13) % 10.5, -5 + ((i * 1.87) % 9), 0.5 + (i % 3) * 0.18, type === 'seabed' ? 0x68765d : 0x4f7880);
    for (let i = 0; i < 6; i++) {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.08 + (i % 3) * 0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb8efff, transparent: true, opacity: 0.28, roughness: 0.2 }));
      bubble.position.set(-2.5 + i * 0.9, 0.5 + (i % 3) * 0.45, -1.5 + (i % 2) * 2);
      environment.add(bubble);
    }
  } else {
    const ground = mesh(new THREE.CircleGeometry(7.8, 64), new THREE.MeshStandardMaterial({ color: cfg.ground, roughness: 1 }), [0, 0, 0], [-Math.PI / 2, 0, 0]);
    environment.add(ground);
    if (type === 'savanna') {
      for (let i = 0; i < 22; i++) addGrass(environment, -6 + (i * 1.71) % 12, -5.5 + ((i * 2.31) % 11), 0.8 + (i % 3) * 0.2, 5);
      [[-4.8,-3.3,1.1],[4.2,-4.3,0.9],[-3.5,3.8,1.0],[4.8,2.8,1.3]].forEach(([x,z,s]) => addTree(environment,x,z,s,false));
      addRock(environment,-2.8,-2.3,1.2,0x776e5b); addRock(environment,2.7,-1.7,0.9,0x6e6757);
    } else if (type === 'forest') {
      for (let i = 0; i < 14; i++) addTree(environment, -6 + (i * 2.1) % 12, -6 + ((i * 1.85) % 10), 0.85 + (i % 3) * 0.18, false);
      for (let i = 0; i < 14; i++) addGrass(environment, -5.5 + (i * 1.42) % 11, -4.8 + ((i * 2.2) % 9), 0.55, 6);
      addRock(environment, 2.4, -2.6, 0.9, 0x596058);
    } else if (type === 'rainforest') {
      for (let i = 0; i < 12; i++) addTree(environment, -6 + (i * 2.3) % 12, -5.8 + ((i * 1.97) % 10), 1.0 + (i % 2) * 0.25, true);
      for (let i = 0; i < 18; i++) addGrass(environment, -5.6 + (i * 1.28) % 11, -4.9 + ((i * 1.73) % 9), 0.7, 5);
      addRock(environment, 2.8, -2.7, 1.1, 0x566458); addRock(environment,-2.9,2.9,0.8,0x4c5d50);
    } else if (type === 'wetland') {
      const water = mesh(new THREE.CircleGeometry(5.7, 48), new THREE.MeshStandardMaterial({ color: 0x567f78, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.72 }), [0, 0.02, -0.8], [-Math.PI / 2, 0, 0]);
      environment.add(water);
      for (let i = 0; i < 14; i++) addGrass(environment, -5.4 + (i * 1.55) % 10.5, -5.2 + ((i * 2.11) % 8), 0.85, 7);
      [[-5.3,2.8,1.1],[5.0,2.5,0.95]].forEach(([x,z,s]) => addTree(environment,x,z,s,true));
      addRock(environment,-3.6,-1.5,0.8,0x657064); addRock(environment,3.2,-2.2,1.0,0x5e675e);
    } else if (type === 'meadow') {
      for (let i = 0; i < 28; i++) addGrass(environment, -6 + (i * 1.37) % 12, -5.5 + ((i * 2.04) % 10), 0.7 + (i % 3) * 0.15, 6);
      for (let i = 0; i < 7; i++) addTree(environment, -5.8 + (i * 2.05), 4.1 + (i % 2) * 0.7, 0.8 + (i % 2) * 0.15, false);
      addRock(environment,4.5,-3.5,0.7,0x77766b);
    } else if (type === 'mountain') {
      addMountain(environment,-4.2,-3.7,1.45); addMountain(environment,4.5,-4.2,1.8); addMountain(environment,0.5,-5.3,1.2);
      for (let i = 0; i < 14; i++) addTree(environment, -6 + (i * 1.75) % 12, -1.5 + ((i * 1.83) % 7), 0.7 + (i % 2) * 0.15, false);
      for (let i = 0; i < 10; i++) addRock(environment,-5.5 + (i * 1.4) % 11,-4.5 + ((i * 1.27) % 7),0.5 + (i % 2) * 0.18,0x76786f);
    } else if (type === 'coast') {
      const sea = mesh(new THREE.CircleGeometry(5.2, 48), new THREE.MeshStandardMaterial({ color: 0x61a9c2, roughness: 0.18, transparent: true, opacity: 0.78 }), [0, 0.02, -1.3], [-Math.PI / 2, 0, 0]);
      environment.add(sea);
      for (let i = 0; i < 12; i++) addRock(environment,-5.8 + (i * 1.25) % 11,-5 + ((i * 1.9) % 8),0.4 + (i % 3) * 0.14,0x8c8878);
      [[-4.6,3.4,0.8],[4.9,3.2,1.0]].forEach(([x,z,s]) => addTree(environment,x,z,s,false));
    }
  }

  // distant soft sky disc / sun, kept simple so it works reliably on GitHub Pages
  const sun = mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshBasicMaterial({ color: type === 'ocean' || type === 'seabed' ? 0x9de1f0 : 0xffe0a3 }), [4.8, 5.8, -5.8]);
  environment.add(sun);

  scene.add(environment);
}

function setup() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9dcff);
  scene.fog = new THREE.FogExp2(0xc5d9d1, 0.012);

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

  scene.add(new THREE.HemisphereLight(0xfff5e2, 0x36525d, 2.7));
  const key = new THREE.DirectionalLight(0xffd99c, 4);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x74b8df, 2.2);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

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
    const buffer = await res.arrayBuffer();
    s.loaded = buffer.byteLength;
    s.total = buffer.byteLength;
    updateProgress();
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
      if (!material) return;
      if (!material.map) {
        const texture = textures[Math.min(textureCursor, textures.length - 1)];
        material.map = texture;
        textureCursor += 1;
        material.color?.set?.(0xffffff);
        material.needsUpdate = true;
        console.info(`[animal-3d] ${kind} applied embedded diffuse texture fallback`);
      }
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
  console.debug(`[animal-3d] ${d.name} resource path:`, resourcePath);
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(buffer, resourcePath, resolve, reject);
  });
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
  buildEnvironment(kind);
  if (current) {
    if (mixer) mixer.stopAllAction();
    scene.remove(current);
  }
  mixer = null;
  current = gltf.scene;
  prepare(current, kind);
  scene.add(current);
  makeActions(gltf);
  $('#modelStatus').textContent = `${SPECIES[kind].name} · ${ENVIRONMENTS[environmentFor(kind)] ? environmentFor(kind) : 'meadow'} 场景 · 本地 GLB 已就绪`;
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
buildEnvironment(active);

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
