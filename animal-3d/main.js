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
    urls: ['https://raw.githubusercontent.com/code4fukui/vr-cats/main/lion.glb']
  },
  tiger: {
    no: '02', name: '孟加拉虎', latin: 'PANTHERA TIGRIS TIGRIS',
    tagline: '独居、敏捷而强大的大型猫科捕食者。',
    facts: [['栖息地', '森林与草原'], ['体重', '约 100–260 kg'], ['最高速度', '短距离约 60 km/h']],
    desc: '老虎是现存体型最大的猫科动物之一。橙色毛皮上的深色条纹能帮助它融入林下斑驳的光影环境。',
    speech: '你好，现在来到老虎展区。老虎是体型最大的现存猫科动物之一，通常以独居方式活动，具有非常出色的力量、感知能力和短距离爆发力。',
    urls: [
      'https://huggingface.co/datasets/xhiroga/data/resolve/main/wilds/tripo3d/tiger.glb?download=true',
      'https://www.42biz.in/3D.Models/tiger.glb'
    ]
  }
};

let scene, camera, renderer, controls;
const clock = new THREE.Clock();
let current = null;
let mixer = null;
let clips = [];
let active = 'lion';
const cache = new Map();
const loader = new GLTFLoader();
const $ = (selector) => document.querySelector(selector);

const patterns = {
  idle: /idle|stand|rest|breath/i,
  walk: /walk|walking|stroll|run|running/i,
  roar: /roar|growl|attack|call|cry/i
};

const loadState = {
  lion: { loaded: 0, total: 0, phase: 'waiting', bytesKnown: false },
  tiger: { loaded: 0, total: 0, phase: 'waiting', bytesKnown: false }
};

function setLoadingUI(stage, message = '') {
  $('#loadingStage').textContent = stage;
  if (message) $('#loadingMessage').textContent = message;
}

function formatMB(bytes) {
  return bytes > 0 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '—';
}

function refreshProgress() {
  const states = Object.values(loadState);
  const known = states.filter((item) => item.bytesKnown && item.total > 0);
  let percent = 0;
  let loaded = states.reduce((sum, item) => sum + item.loaded, 0);
  let total = states.reduce((sum, item) => sum + item.total, 0);

  if (known.length === states.length) {
    percent = total ? Math.round((loaded / total) * 100) : 0;
  } else {
    const completed = states.filter((item) => item.phase === 'done').length;
    const current = states.find((item) => item.phase === 'downloading' || item.phase === 'parsing');
    percent = Math.min(99, Math.round(((completed + (current ? (current.bytesKnown && current.total ? current.loaded / current.total : 0.35) : 0)) / states.length) * 100));
  }

  $('#progressFill').style.width = `${percent}%`;
  $('#progressPercent').textContent = `${percent}%`;
  $('#progressSize').textContent = total > 0 ? `${formatMB(loaded)} / ${formatMB(total)}` : '读取模型大小…';
  $('#lionProgress').textContent = loadState.lion.phase === 'done' ? '完成' : loadState.lion.phase === 'parsing' ? '解析中' : loadState.lion.bytesKnown ? `${Math.round(loadState.lion.loaded / loadState.lion.total * 100)}%` : loadState.lion.phase === 'downloading' ? '下载中' : '等待';
  $('#tigerProgress').textContent = loadState.tiger.phase === 'done' ? '完成' : loadState.tiger.phase === 'parsing' ? '解析中' : loadState.tiger.bytesKnown ? `${Math.round(loadState.tiger.loaded / loadState.tiger.total * 100)}%` : loadState.tiger.phase === 'downloading' ? '下载中' : '等待';

  if (loadState.lion.phase === 'done' && loadState.tiger.phase === 'done') {
    $('#progressFill').style.width = '100%';
    $('#progressPercent').textContent = '100%';
  }
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
  animate();
}

function stopMixer() {
  if (!mixer) return;
  mixer.stopAllAction();
  mixer = null;
  clips = [];
}

function removeCurrentFromScene() {
  stopMixer();
  if (current) scene.remove(current);
  current = null;
}

function prepareModel(model) {
  if (model.userData.__prepared) return;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  if (size > 0) model.scale.multiplyScalar(4.2 / size);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y;
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((material) => {
          material.needsUpdate = true;
          if ('color' in material) material.color.convertSRGBToLinear?.();
        });
      }
    }
  });
  model.userData.__prepared = true;
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
  document.querySelectorAll('.action').forEach((button) => button.classList.toggle('active', button.dataset.action === mode));
  if (mixer) {
    Object.values(mixer._map || {}).forEach((action) => action.stop());
    const target = mixer._map?.[mode] || mixer._map?.idle || (clips[0] ? mixer.clipAction(clips[0]) : null);
    if (target) {
      target.reset().fadeIn(0.25).play();
      target.setLoop(mode === 'roar' ? THREE.LoopOnce : THREE.LoopRepeat, mode === 'roar' ? 1 : Infinity);
      $('#actionHint').textContent = mixer._map?.[mode] ? `原生 GLB 动作：${target.getClip().name}` : '当前 GLB 没有该动作，使用可用动作近似。';
      return;
    }
  }
  $('#actionHint').textContent = `当前模型没有骨骼动作：${mode.toUpperCase()} 仅保留展示状态。`;
}

function attachCached(kind, entry) {
  removeCurrentFromScene();
  current = entry.gltf.scene;
  prepareModel(current);
  scene.add(current);
  setupClips(entry.gltf);
  $('#modelStatus').textContent = `${data[kind].name} ${entry.urlIndex > 0 ? '备用真实 GLB' : '已就绪'}`;
  playMode('idle');
}

async function fetchWithProgress(kind, url) {
  const state = loadState[kind];
  state.phase = 'downloading';
  state.loaded = 0;
  state.total = 0;
  state.bytesKnown = false;
  setLoadingUI(`正在下载 ${data[kind].name}`, `${data[kind].name}：读取真实 GLB 文件…`);
  refreshProgress();

  const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  state.total = total;
  state.bytesKnown = total > 0;

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    state.loaded = buffer.byteLength;
    if (!state.total) { state.total = state.loaded; state.bytesKnown = true; }
    refreshProgress();
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    state.loaded += value.byteLength;
    if (!state.total && state.loaded > 0) {
      $('#progressSize').textContent = `${formatMB(state.loaded)} / 未知`;
    }
    refreshProgress();
  }

  const buffer = new ArrayBuffer(state.loaded);
  const target = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) { target.set(chunk, offset); offset += chunk.byteLength; }
  if (!state.total) { state.total = state.loaded; state.bytesKnown = true; }
  refreshProgress();
  return buffer;
}

function parseGLB(kind, arrayBuffer, basePath = '') {
  return new Promise((resolve, reject) => {
    loadState[kind].phase = 'parsing';
    setLoadingUI(`正在解析 ${data[kind].name}`, `${data[kind].name}：GLB 下载完成，正在建立网格、材质与骨骼…`);
    refreshProgress();
    loader.parse(arrayBuffer, basePath, (gltf) => resolve(gltf), reject);
  });
}

async function loadRealAnimal(kind) {
  if (cache.has(kind)) return cache.get(kind);
  let lastError = null;
  for (let i = 0; i < data[kind].urls.length; i += 1) {
    try {
      const url = data[kind].urls[i];
      const arrayBuffer = await fetchWithProgress(kind, url);
      const gltf = await parseGLB(kind, arrayBuffer, url.substring(0, url.lastIndexOf('/') + 1));
      const entry = { gltf, ok: true, urlIndex: i };
      cache.set(kind, entry);
      loadState[kind].phase = 'done';
      refreshProgress();
      return entry;
    } catch (error) {
      lastError = error;
      console.error(`${kind} real GLB failed`, error);
      if (i + 1 < data[kind].urls.length) {
        setLoadingUI(`${data[kind].name} 切换备用源`, '主模型源读取失败，正在切换备用真实 GLB…');
      }
    }
  }
  loadState[kind].phase = 'done';
  refreshProgress();
  throw lastError || new Error(`${kind} model load failed`);
}

async function preloadAll() {
  $('#modelStatus').textContent = '正在加载真实模型';
  try {
    setLoadingUI('正在启动 3D 展馆', '两个模型同时下载，进度按真实字节数计算。');
    const [lion, tiger] = await Promise.all([
      loadRealAnimal('lion').catch((error) => ({ error, ok: false })),
      loadRealAnimal('tiger').catch((error) => ({ error, ok: false }))
    ]);

    const errors = [lion, tiger].filter((item) => !item.ok);
    if (errors.length) {
      throw new Error(errors.map((item) => item.error?.message || '未知模型错误').join('；'));
    }

    setInfo('lion');
    attachCached('lion', lion);
    $('#loadingMessage').textContent = '两个真实 GLB 已加载完成，可立即切换。';
    setTimeout(() => $('#loading').classList.add('hide'), 350);
  } catch (error) {
    console.error('3D model preload failed', error);
    setLoadingUI('模型加载失败', `请刷新页面重试。${error.message || ''}`);
    $('#modelStatus').textContent = '真实模型加载失败';
  }
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
  if (cached?.ok) attachCached(kind, cached);
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