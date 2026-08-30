import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/DRACOLoader.js';
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
let environment = null;
let lightSet = null;
const clock = new THREE.Clock();

const HABITATS = {
  savanna: { sky: 0xc99258, fog: 0xd89b68, ground: 0x9a804e, density: 0.007 },
  forest: { sky: 0xa9c4bb, fog: 0xa7b9ae, ground: 0x54634c, density: 0.014 },
  rainforest: { sky: 0x7fac9e, fog: 0x72968a, ground: 0x455e41, density: 0.018 },
  wetland: { sky: 0xa7c3c7, fog: 0x9bb2ae, ground: 0x5b6b57, density: 0.014 },
  meadow: { sky: 0xb5daf2, fog: 0xc5d9c7, ground: 0x6f9d59, density: 0.008 },
  mountain: { sky: 0xbcd7ed, fog: 0xb5c5ce, ground: 0x657067, density: 0.009 },
  coast: { sky: 0xb6daf0, fog: 0xb9d0d1, ground: 0xb9aa82, density: 0.007 },
  ocean: { sky: 0x4d91aa, fog: 0x4b8798, ground: 0x2c7081, density: 0.011 },
  seabed: { sky: 0x19566a, fog: 0x225d6c, ground: 0x60755f, density: 0.014 }
};

function habitatFor(kind) {
  const map = {
    lion: 'savanna', tiger: 'forest', fox: 'forest', black_panther: 'rainforest', lioness: 'savanna',
    alligator: 'wetland', shark: 'ocean', whale: 'ocean', horse: 'meadow', deer: 'mountain',
    rabbit: 'meadow', seagull: 'coast', macaw: 'rainforest', starfish: 'seabed', swordfish: 'ocean', tuna: 'ocean'
  };
  return map[kind] || 'meadow';
}

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

function createMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
}

function addObject(group, geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const o = new THREE.Mesh(geometry, material);
  o.position.set(...position);
  o.rotation.set(...rotation);
  o.scale.set(...scale);
  o.castShadow = true;
  o.receiveShadow = true;
  group.add(o);
  return o;
}

function addAcacia(group, x, z, scale = 1) {
  const trunk = addObject(group, new THREE.CylinderGeometry(0.07 * scale, 0.16 * scale, 1.55 * scale, 8), createMaterial(0x624b31), [x, 0.78 * scale, z]);
  trunk.rotation.z = (x % 3) * 0.035;
  const crown = createMaterial(0x4f672c);
  addObject(group, new THREE.SphereGeometry(0.65 * scale, 10, 7), crown, [x, 1.62 * scale, z], [0, 0, 0], [1.45, 0.48, 0.9]);
  addObject(group, new THREE.SphereGeometry(0.42 * scale, 9, 7), crown, [x - 0.32 * scale, 1.58 * scale, z + 0.06]);
  addObject(group, new THREE.SphereGeometry(0.44 * scale, 9, 7), crown, [x + 0.33 * scale, 1.57 * scale, z - 0.03]);
}

function addPine(group, x, z, scale = 1) {
  addObject(group, new THREE.CylinderGeometry(0.055 * scale, 0.11 * scale, 1.0 * scale, 7), createMaterial(0x5c4938), [x, 0.5 * scale, z]);
  const green = createMaterial(0x315442);
  addObject(group, new THREE.ConeGeometry(0.58 * scale, 1.35 * scale, 9), green, [x, 1.2 * scale, z]);
  addObject(group, new THREE.ConeGeometry(0.43 * scale, 1.0 * scale, 9), createMaterial(0x3e644d), [x, 1.72 * scale, z]);
}

function addBroadleaf(group, x, z, scale = 1) {
  addObject(group, new THREE.CylinderGeometry(0.065 * scale, 0.13 * scale, 1.25 * scale, 7), createMaterial(0x624c35), [x, 0.63 * scale, z]);
  addObject(group, new THREE.SphereGeometry(0.55 * scale, 9, 7), createMaterial(0x4f733f), [x, 1.35 * scale, z]);
  addObject(group, new THREE.SphereGeometry(0.4 * scale, 9, 7), createMaterial(0x638b4d), [x - 0.28 * scale, 1.48 * scale, z + 0.08]);
}

function addGrass(group, x, z, scale = 1, color = 0x709844, count = 7) {
  const m = createMaterial(color);
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const r = 0.08 + (i % 3) * 0.035;
    const h = (0.25 + (i % 4) * 0.06) * scale;
    const blade = addObject(group, new THREE.ConeGeometry(0.024 * scale, h, 4), m, [x + Math.cos(a) * r, h * 0.5, z + Math.sin(a) * r]);
    blade.userData.grass = true;
    blade.userData.baseRotation = blade.rotation.z;
  }
}

function addFlower(group, x, z, scale = 1, petalColor = 0xf1b0c7) {
  addObject(group, new THREE.CylinderGeometry(0.01 * scale, 0.015 * scale, 0.2 * scale, 5), createMaterial(0x4b7b43), [x, 0.1 * scale, z]);
  const petal = createMaterial(petalColor);
  for (let i = 0; i < 5; i += 1) {
    const a = i * Math.PI * 2 / 5;
    addObject(group, new THREE.SphereGeometry(0.042 * scale, 6, 5), petal, [x + Math.cos(a) * 0.055 * scale, 0.215 * scale, z + Math.sin(a) * 0.055 * scale]);
  }
  addObject(group, new THREE.SphereGeometry(0.022 * scale, 6, 5), createMaterial(0xf5d46d), [x, 0.22 * scale, z]);
}

function addRock(group, x, z, scale = 1, color = 0x6b6b63) {
  addObject(group, new THREE.DodecahedronGeometry(0.3 * scale, 0), createMaterial(color), [x, 0.18 * scale, z], [0, (x + z) * 0.12, 0], [1.25, 0.72, 1]);
}

function addMountain(group, x, z, scale = 1) {
  addObject(group, new THREE.ConeGeometry(1.65 * scale, 2.9 * scale, 6), createMaterial(0x68736f), [x, 1.45 * scale, z]);
  addObject(group, new THREE.ConeGeometry(0.62 * scale, 1.2 * scale, 6), createMaterial(0xe8eef1), [x, 2.3 * scale, z - 0.02]);
}

function addSunset(group) {
  addObject(group, new THREE.SphereGeometry(0.72, 24, 16), createMaterial(0xffd17a, { emissive: 0x8e481a, emissiveIntensity: 1.0, roughness: 0.55 }), [4.5, 4.0, -8]);
  addObject(group, new THREE.SphereGeometry(1.25, 24, 16), createMaterial(0xffa25b, { transparent: true, opacity: 0.13, depthWrite: false }), [4.5, 4.0, -8]);
}

function disposeEnvironment() {
  if (environment) {
    environment.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose?.();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m?.dispose?.());
    });
    scene.remove(environment);
    environment = null;
  }
  if (lightSet) {
    lightSet.forEach((l) => scene.remove(l));
    lightSet = null;
  }
}

function configureLighting(type) {
  const p = {
    savanna: [0xffe4bf, 0x60472b, 0xffb35f, 3.6, [4, 6, 2], 0x9a6c3f],
    mountain: [0xe8f5ff, 0x38444b, 0xf4f8ff, 2.6, [-3, 7, 4], 0x86a8c3],
    meadow: [0xe9f6ff, 0x40563a, 0xfff0c2, 3.2, [4, 7, 3], 0x88afc5],
    forest: [0xdbe9e0, 0x2b3b30, 0xffe6c6, 2.8, [4, 6, 3], 0x78958a],
    rainforest: [0xd4ede0, 0x20362a, 0xd8ffe5, 2.4, [4, 7, 2], 0x6caa8b],
    wetland: [0xdcecf0, 0x30443b, 0xffe3b6, 2.8, [4, 6, 3], 0x78a3aa],
    coast: [0xe2f4ff, 0x585447, 0xffedca, 3.0, [3, 7, 3], 0x77b6cc],
    ocean: [0xa7def0, 0x153f4e, 0x88d4ee, 2.2, [-3, 8, 4], 0x69cce9],
    seabed: [0x79bed1, 0x173f3a, 0x6dd3e4, 2.0, [-3, 6, 3], 0x64c7ad]
  }[type] || [0xe9f6ff, 0x40563a, 0xfff0c2, 3.2, [4, 7, 3], 0x88afc5];
  const hemi = new THREE.HemisphereLight(p[0], p[1], 2.35);
  const key = new THREE.DirectionalLight(p[2], p[3]);
  key.position.set(...p[4]);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  const rim = new THREE.DirectionalLight(p[5], 1.55);
  rim.position.set(-6, 4, -7);
  lightSet = [hemi, key, rim];
  scene.add(...lightSet);
}

function buildEnvironment(kind) {
  disposeEnvironment();
  const type = habitatFor(kind);
  const cfg = HABITATS[type];
  environment = new THREE.Group();
  environment.name = `habitat-${type}`;
  scene.background = new THREE.Color(cfg.sky);
  scene.fog = new THREE.FogExp2(cfg.fog, cfg.density);
  configureLighting(type);

  const ground = addObject(environment, new THREE.CircleGeometry(14, 96), createMaterial(cfg.ground), [0, -0.02, 0], [-Math.PI / 2, 0, 0]);
  ground.receiveShadow = true;

  if (type === 'savanna') {
    addSunset(environment);
    [[-8,-8,1.7],[-4.8,-7.5,1.2],[4.6,-8.3,1.45],[7.8,-5.8,1.05],[-6.2,2.8,0.95],[6.2,2.2,1.15]].forEach((v) => addAcacia(environment, ...v));
    for (let i = 0; i < 24; i += 1) addGrass(environment, -9 + ((i * 1.71) % 18), -2 + ((i * 2.3) % 16), 1.05 + (i % 3) * 0.2, 0x8e9b3f, 7);
    addRock(environment, -2.5, -3.2, 1.15, 0x766b51);
    addRock(environment, 2.8, -2.1, 0.9, 0x6e624d);
  } else if (type === 'mountain') {
    addMountain(environment, -5.6, -10.5, 2.0);
    addMountain(environment, 0.3, -12.2, 2.75);
    addMountain(environment, 5.6, -10.0, 1.85);
    for (let i = 0; i < 20; i += 1) addPine(environment, -8 + ((i * 1.65) % 16), -4 + ((i * 1.45) % 8), 0.7 + (i % 3) * 0.14);
    for (let i = 0; i < 11; i += 1) addRock(environment, -6 + ((i * 1.44) % 12), -5 + ((i * 1.21) % 8), 0.45 + (i % 2) * 0.2, 0x737a76);
  } else if (type === 'meadow') {
    for (let i = 0; i < 34; i += 1) addGrass(environment, -8 + ((i * 1.31) % 16), -6 + ((i * 1.91) % 13), 0.75 + (i % 3) * 0.15, 0x6b9849, 8);
    const flowers = [0xe7a6bf, 0xf1c873, 0xc9afe8, 0xf2ebba];
    for (let i = 0; i < 65; i += 1) addFlower(environment, -8 + ((i * 1.83) % 16), -6 + ((i * 2.1) % 12), 0.75 + (i % 3) * 0.15, flowers[i % flowers.length]);
    for (let i = 0; i < 7; i += 1) addBroadleaf(environment, -7 + i * 2.3, 4.5 + (i % 2) * 0.6, 0.72 + (i % 2) * 0.12);
  } else if (type === 'forest') {
    for (let i = 0; i < 25; i += 1) addBroadleaf(environment, -8 + ((i * 1.61) % 16), -7 + ((i * 1.77) % 14), 0.8 + (i % 3) * 0.18);
    for (let i = 0; i < 20; i += 1) addGrass(environment, -7 + ((i * 1.83) % 14), -4 + ((i * 2.11) % 10), 0.6, 0x537741, 7);
    addRock(environment, 2.5, -2.7, 0.9, 0x565f59);
  } else if (type === 'rainforest') {
    for (let i = 0; i < 22; i += 1) addBroadleaf(environment, -8 + ((i * 1.53) % 16), -7 + ((i * 1.91) % 14), 1.0 + (i % 2) * 0.23);
    for (let i = 0; i < 30; i += 1) addGrass(environment, -7 + ((i * 1.17) % 14), -5 + ((i * 2.04) % 11), 0.75, 0x426e49, 8);
    addRock(environment, 3.0, -2.7, 1.1, 0x4f604f);
  } else if (type === 'wetland') {
    addObject(environment, new THREE.CircleGeometry(6.4, 64), createMaterial(0x3e8188, { transparent: true, opacity: 0.74, roughness: 0.12 }), [0, 0.012, -1], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 24; i += 1) addGrass(environment, -8 + ((i * 1.47) % 16), -5 + ((i * 1.95) % 11), 0.9, 0x5b8054, 9);
    addAcacia(environment, -6.5, 4.2, 1.0);
    addAcacia(environment, 6.3, 4.0, 0.9);
    addRock(environment, -3.1, -1.6, 0.8, 0x606961);
  } else if (type === 'coast') {
    addObject(environment, new THREE.CircleGeometry(7.0, 64), createMaterial(0x4c9fb8, { transparent: true, opacity: 0.75, roughness: 0.16 }), [0, 0.01, -2.2], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 20; i += 1) addRock(environment, -8 + ((i * 1.7) % 16), -5 + ((i * 2.1) % 10), 0.4 + (i % 3) * 0.16, 0x827963);
  } else if (type === 'ocean') {
    addObject(environment, new THREE.CircleGeometry(14, 96), createMaterial(0x2e7f9e, { transparent: true, opacity: 0.89, roughness: 0.12 }), [0, -0.08, 0], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 18; i += 1) addRock(environment, -8 + ((i * 1.6) % 16), -7 + ((i * 2.0) % 14), 0.45 + (i % 3) * 0.16, 0x497d86);
  } else if (type === 'seabed') {
    addObject(environment, new THREE.CircleGeometry(14, 96), createMaterial(0x337487, { roughness: 0.25 }), [0, -0.1, 0], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 24; i += 1) addRock(environment, -8 + ((i * 1.37) % 16), -7 + ((i * 1.91) % 13), 0.45 + (i % 3) * 0.15, 0x60746c);
  }
  scene.add(environment);
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
    if (!$('#loading').classList.contains('hide')) setLoading(`正在读取 ${d.name}`, '读取同域本地 GLB。');
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
  try { return await task; } finally { pending.delete(kind); }
}

async function load(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const buffer = await fetchBuffer(kind);
  state[kind].phase = 'parsing';
  if (!$('#loading').classList.contains('hide')) setLoading(`正在解析 ${SPECIES[kind].name}`, '正在解码 Draco / 创建网格、材质、骨骼与动画。');
  const d = SPECIES[kind];
  const resourcePath = new URL('.', new URL(d.url, location.href)).href;
  const gltf = await new Promise((resolve, reject) => loader.parse(buffer, resourcePath, resolve, reject));
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
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
  gltf.scene.userData.animalKind = kind;
  cache.set(kind, gltf);
  state[kind].phase = 'done';
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
  model.userData.animalPrepared = true;
}

function makeActions(gltf) {
  currentActions = {};
  mixer = null;
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
    ['idle', '◌ Idle'], ['walk', '↗ Walk / Run'], ['roar', '◉ Attack / Call'], ['dead', '✕ Dead']
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
  buildEnvironment(kind);
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

function setup() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 2.35, 8);
  renderer = new THREE.WebGLRenderer({ canvas: $('#stage'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 13;
  controls.target.set(0, 1.15, 0);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  if (environment) {
    const time = performance.now() * 0.0014;
    environment.traverse((obj) => {
      if (obj.userData?.grass) obj.rotation.z = obj.userData.baseRotation + Math.sin(time + obj.id * 0.17) * 0.035;
    });
  }
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
buildEnvironment(active);

(async () => {
  const firstThree = ANIMALS.slice(0, 3).map((x) => x.id);
  setLoading('正在准备动物馆', '首屏等待狮子、老虎、赤狐；其余模型随后后台加载。');
  const firstResults = await Promise.allSettled(firstThree.map((kind) => load(kind)));
  const firstReadyIndex = firstResults.findIndex((x) => x.status === 'fulfilled');
  if (firstReadyIndex >= 0) show(firstThree[firstReadyIndex], firstResults[firstReadyIndex].value);
  const readyCount = firstResults.filter((x) => x.status === 'fulfilled').length;
  $('#loadingMessage').textContent = readyCount === 3 ? '首屏前三个真实动物已加载完成，其余模型正在后台加载。' : `首屏模型 ${readyCount}/3 个加载成功，其余模型继续后台加载。`;
  setTimeout(() => $('#loading').classList.add('hide'), 350);

  const queue = ANIMALS.map((x) => x.id).filter((id) => !firstThree.includes(id));
  const worker = async () => {
    while (queue.length) {
      const kind = queue.shift();
      try { await load(kind); } catch (error) { state[kind].phase = 'error'; console.warn(`${kind} background preload failed`, error); }
    }
  };
  await Promise.all([worker(), worker()]);
})();
