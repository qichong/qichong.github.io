import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/DRACOLoader.js';
import { initOfficialScenes, updateOfficialScenes } from './threejs-examples-scenes.js';
import { ANIMALS } from './animal-manifest-realistic.js';

const $ = (s) => document.querySelector(s);
const SPECIES = Object.fromEntries(ANIMALS.map((x) => [x.id, x]));
const SOURCES = {
  lion: 'code4fukui/vr-cats · kenchoo · CC BY-NC-SA 4.0', tiger: '项目原有模型 · 来源记录未变更',
  fox: 'WildMesh 3D / Sketchfab · CC BY 4.0', black_panther: '仓库上传资产 · 原始来源待补充',
  lioness: 'WildMesh 3D / Sketchfab · CC BY 4.0', alligator: 'WildMesh 3D / Sketchfab · CC BY 4.0',
  shark: 'Open Water / Optic_idealist · CC BY 4.0', whale: 'Open Water / Bohdan Lvov · CC BY 4.0',
  horse: 'WildMesh 3D / Sketchfab · CC BY 4.0', seagull: 'Open Water / The lighthouse keeper / geminga · CC BY-SA 4.0',
  macaw: 'Open Water / Mateus Schwaab · CC BY 4.0', starfish: 'Open Water / Digital Atlas of Ancient Life · CC0 1.0',
  swordfish: 'Open Water / Quaternius · CC0 1.0', tuna: 'Open Water / Quaternius · CC0 1.0',
  deer: 'WildMesh 3D / Sketchfab · CC BY 4.0', rabbit: 'WildMesh 3D / Sketchfab · CC BY 4.0'
};

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let scene, camera, renderer, controls, current = null, mixer = null, active = 'lion';
let currentAnimations = [];
const cache = new Map(), pending = new Map();
const clock = new THREE.Clock();

function setLoading(title, detail) { $('#loadingStage').textContent = title; $('#loadingMessage').textContent = detail; }
function renderAnimalButtons() {
  $('.animals').innerHTML = ANIMALS.map((d) => `<button class="animal${d.id === active ? ' active' : ''}" data-animal="${d.id}"><span>${d.no}</span> ${d.emoji} ${d.name}</button>`).join('');
}
function renderInfo(kind) {
  const d = SPECIES[kind];
  $('#animalNo').textContent = d.no; $('#name').textContent = d.name; $('#latin').textContent = d.latin;
  $('#tagline').textContent = `${d.category} · ${d.facts?.[0]?.[1] || ''}`;
  $('#facts').innerHTML = (d.facts || []).map(([a, b]) => `<div class="fact"><b>${a}</b><span>${b}</span></div>`).join('');
  $('#desc').textContent = d.desc || '';
}
function setup() {
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x080a0b); scene.fog = new THREE.FogExp2(0x080a0b, 0.025);
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100); camera.position.set(0, 2.4, 8);
  renderer = new THREE.WebGLRenderer({ canvas: $('#stage'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 3.5; controls.maxDistance = 12; controls.target.set(0, 1.2, 0);

  // 更均匀的展馆补光：减少不同来源 GLB 因 PBR 材质差异产生的“黑脸”。
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2b3440, 3.2));

  const key = new THREE.DirectionalLight(0xfff3df, 4.2);
  key.position.set(5, 8, 6);
  key.castShadow = true;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 2.2);
  fill.position.set(-5, 5, 6);
  scene.add(fill);

  const front = new THREE.PointLight(0xfff8ef, 1.1, 14, 2);
  front.position.set(0, 3.6, 5.5);
  scene.add(front);

  const rim = new THREE.DirectionalLight(0xcfe2ff, 1.15);
  rim.position.set(-5, 4, -5);
  scene.add(rim);

  initOfficialScenes(scene, () => active);
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
  animate();
}
function prepare(model, kind) {
  if (model.userData.animalPrepared) return;
  const target = SPECIES[kind]?.target || 3.5;
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()).length();
  if (size > 0) model.scale.multiplyScalar(target / size);
  const fitted = new THREE.Box3().setFromObject(model), center = fitted.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -fitted.min.y, -center.z);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (m.metalnessMap) m.metalnessMap.colorSpace = THREE.NoColorSpace;
      if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
      if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
      if (m.aoMap) m.aoMap.colorSpace = THREE.NoColorSpace;

      // 对明显偏暗的材质只做轻微提亮，不改变原始贴图色相。
      if (m.color) {
        const brightness = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
        if (brightness < 0.42) m.color.multiplyScalar(1.12);
      }
      if ('envMapIntensity' in m) m.envMapIntensity = Math.max(m.envMapIntensity || 1, 1.15);
      m.needsUpdate = true;
    });
  });
  model.userData.animalPrepared = true;
}
async function applyEmbeddedTextureFallback(gltf, kind) {
  const parser = gltf?.parser, materials = parser?.json?.materials || [], indexes = new Set();
  materials.forEach((def) => { const i = def?.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture?.index; if (Number.isInteger(i)) indexes.add(i); });
  if (!indexes.size || !parser?.getDependency) return;
  const textures = [];
  for (const index of indexes) {
    try { const texture = await parser.getDependency('texture', index); if (texture) { texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; textures.push(texture); } }
    catch (e) { console.warn(`[animal-3d] ${kind} embedded texture ${index} failed`, e); }
  }
  if (!textures.length) return;
  let cursor = 0;
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((material) => {
      if (!material || material.map) return;
      material.map = textures[Math.min(cursor, textures.length - 1)]; cursor++; material.color?.set?.(0xffffff); material.needsUpdate = true;
    });
  });
}
function label(name, index) {
  const n = String(name || '').toLowerCase();
  if (/idle|stand|survey|rest|breath|wait|look|alert/.test(n)) return `Idle / ${name}`;
  if (/walk|walking|stroll|locomotion|move|trot/.test(n)) return `Walk / ${name}`;
  if (/run|running|gallop|sprint|charge/.test(n)) return `Run / ${name}`;
  if (/attack|roar|growl|bite|claw|strike|hit|fight|call|cry/.test(n)) return `Attack / ${name}`;
  if (/dead|death|die|dying|fall|faint/.test(n)) return `Death / ${name}`;
  return `Animation ${index + 1} / ${name || 'Unnamed'}`;
}
function stopMixer() { if (mixer) mixer.stopAllAction(); }
function playAnimation(index) {
  const item = currentAnimations[index]; if (!item || !mixer) return;
  stopMixer(); item.action.reset().fadeIn(0.15).play();
  const once = /dead|death|die|dying|fall|faint|attack|roar|growl|bite|claw|strike|hit/.test(item.name.toLowerCase());
  item.action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); item.action.clampWhenFinished = once;
  document.querySelectorAll('.action').forEach((b) => b.classList.toggle('active', b.dataset.actionIndex === String(index)));
  $('#actionHint').textContent = `${SPECIES[active].name} · ${item.name} · ${item.duration.toFixed(2)}s · ${SOURCES[active] || '来源信息未记录'}`;
}
function renderActions(gltf) {
  currentAnimations = []; const clips = Array.isArray(gltf.animations) ? gltf.animations : []; stopMixer(); mixer = clips.length ? new THREE.AnimationMixer(gltf.scene) : null;
  clips.forEach((clip, index) => currentAnimations.push({ index, name: clip.name || `Animation ${index + 1}`, duration: clip.duration || 0, action: mixer.clipAction(clip) }));
  $('#actions').innerHTML = clips.length ? currentAnimations.map((item) => `<button class="action" data-action-index="${item.index}" title="${item.name.replace(/\"/g, '&quot;')}">${label(item.name, item.index)} <small>${item.duration.toFixed(1)}s</small></button>`).join('') : '<div class="no-actions">这个 GLB 没有嵌入骨骼动画</div>';
  $('#actionHint').textContent = clips.length ? `${clips.length} 个实际动画 · 来源：${SOURCES[active] || '来源信息未记录'}` : `0 个动画 · 来源：${SOURCES[active] || '来源信息未记录'}`;
  if (clips.length) playAnimation(0);
}
async function load(kind) {
  if (cache.has(kind)) return cache.get(kind); if (pending.has(kind)) return pending.get(kind);
  const task = (async () => {
    const d = SPECIES[kind]; setLoading(`正在读取 ${d.name}`, '恢复兼容的内嵌纹理，并读取 GLB 实际 animation clip。');
    const res = await fetch(d.url, { cache: 'force-cache' }); if (!res.ok) throw new Error(`${d.name} HTTP ${res.status}`);
    const buffer = await res.arrayBuffer(); if (buffer.byteLength < 20) throw new Error(`${d.name} GLB 文件过小`);
    if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'glTF') throw new Error(`${d.name} 不是有效 GLB`);
    const modelUrl = new URL(d.url, location.href), resourcePath = new URL('.', modelUrl).href;
    const gltf = await new Promise((resolve, reject) => loader.parse(buffer, resourcePath, resolve, reject));
    await applyEmbeddedTextureFallback(gltf, kind);
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        if (m.metalnessMap) m.metalnessMap.colorSpace = THREE.NoColorSpace;
        if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;
        if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
        if (m.aoMap) m.aoMap.colorSpace = THREE.NoColorSpace;
        m.needsUpdate = true;
      });
    });
    cache.set(kind, gltf); return gltf;
  })();
  pending.set(kind, task); try { return await task; } finally { pending.delete(kind); }
}
async function show(kind, gltf) {
  active = kind; renderInfo(kind); renderAnimalButtons(); if (current) { stopMixer(); scene.remove(current); }
  current = gltf.scene; mixer = null; prepare(current, kind); scene.add(current); renderActions(gltf);
  $('#modelStatus').textContent = `${SPECIES[kind].name} · 本地 GLB 已就绪 · ${gltf.animations?.length || 0} 个动作`;
}
async function select(kind) {
  active = kind; renderInfo(kind); renderAnimalButtons();
  try { const gltf = await load(kind); await show(kind, gltf); $('#loading').classList.add('hide'); }
  catch (error) { console.error(`${kind} load failed`, error); $('#modelStatus').textContent = `${SPECIES[kind].name} 加载失败`; $('#actionHint').textContent = error?.message || '模型读取失败'; $('#loading').classList.add('hide'); }
}
function animate() { requestAnimationFrame(animate); const dt = clock.getDelta(); if (mixer) mixer.update(dt); updateOfficialScenes(dt); controls?.update(); renderer?.render(scene, camera); }
$('.animals').addEventListener('click', (e) => { const b = e.target.closest('.animal'); if (b) select(b.dataset.animal); });
$('#actions').addEventListener('click', (e) => { const b = e.target.closest('.action'); if (b) playAnimation(Number(b.dataset.actionIndex)); });
$('#voiceBtn').addEventListener('click', () => { const d = SPECIES[active]; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(d.speech || `现在看到的是${d.name}。`); u.lang = 'zh-CN'; u.rate = 0.92; speechSynthesis.speak(u); });
setup(); renderAnimalButtons(); renderInfo(active);
(async () => {
  const firstThree = ANIMALS.slice(0, 3).map((x) => x.id); setLoading('正在准备动物馆', '正在读取首屏动物，并恢复模型原始材质与动作。');
  const results = await Promise.allSettled(firstThree.map((kind) => load(kind))); const first = results.findIndex((x) => x.status === 'fulfilled');
  if (first >= 0) await show(firstThree[first], results[first].value);
  $('#loadingMessage').textContent = '动作按钮直接来自当前 GLB 内的真实 animation clip。'; setTimeout(() => $('#loading').classList.add('hide'), 300);
  const queue = ANIMALS.map((x) => x.id).filter((id) => !firstThree.includes(id));
  const worker = async () => { while (queue.length) { const kind = queue.shift(); try { await load(kind); } catch (error) { console.warn(`${kind} background preload failed`, error); } } };
  await Promise.all([worker(), worker()]);
})();
