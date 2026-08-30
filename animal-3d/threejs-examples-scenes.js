import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/objects/Sky.js';
import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/objects/Water.js';
import { TreeGenerator } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/generators/TreeGenerator.js';

const VERSION = '20260830-official-scenes-1';
const ANIMAL_TO_ENV = {
  lion: 'savanna',
  lioness: 'savanna',
  tiger: 'forest',
  fox: 'forest',
  black_panther: 'forest',
  deer: 'forest',
  horse: 'meadow',
  rabbit: 'meadow',
  alligator: 'wetland',
  seagull: 'coast',
  macaw: 'forest',
  shark: 'ocean',
  whale: 'ocean',
  swordfish: 'ocean',
  tuna: 'ocean',
  starfish: 'ocean'
};

const $ = (selector) => document.querySelector(selector);
let scene = null;
let environment = null;
let sky = null;
let water = null;
let waterNormals = null;
let baseGround = null;
let baseGrid = null;
let initialized = false;
let currentType = null;
const clock = new THREE.Clock();

function disposeObject(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

function makeMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
}

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.receiveShadow = true;
  object.castShadow = true;
  return object;
}

function addSky(kind) {
  sky = new Sky();
  sky.scale.setScalar(100);
  sky.material.uniforms.turbidity.value = kind === 'ocean' ? 5 : 2.5;
  sky.material.uniforms.rayleigh.value = kind === 'ocean' ? 1.8 : 1.25;
  sky.material.uniforms.mieCoefficient.value = 0.005;
  sky.material.uniforms.mieDirectionalG.value = 0.75;

  const sun = new THREE.Vector3();
  if (kind === 'savanna') {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(28), THREE.MathUtils.degToRad(210));
  } else if (kind === 'ocean' || kind === 'coast') {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(42), THREE.MathUtils.degToRad(150));
  } else {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(205));
  }
  sky.material.uniforms.sunPosition.value.copy(sun);
  scene.add(sky);
}

function addGround(kind) {
  const colors = {
    savanna: 0x9b804f,
    forest: 0x455a45,
    meadow: 0x699b52,
    wetland: 0x506e57,
    coast: 0xc0ac83
  };
  const ground = mesh(
    new THREE.CircleGeometry(14, 96),
    makeMaterial(colors[kind] || 0x58645a),
    [0, -0.025, 0],
    [-Math.PI / 2, 0, 0]
  );
  ground.name = 'official-example-ground';
  environment.add(ground);
}

function addGrass(kind) {
  const color = kind === 'savanna' ? 0x839d43 : 0x5e9c4c;
  for (let i = 0; i < 75; i += 1) {
    const angle = i * 2.399;
    const radius = 2.2 + (i % 11) * 0.72;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 0.18 + (i % 5) * 0.06;
    const blade = mesh(
      new THREE.ConeGeometry(0.018, height, 4),
      makeMaterial(color),
      [x, height / 2, z],
      [0, 0, (i % 2 ? 0.24 : -0.24)]
    );
    blade.userData.grass = true;
    blade.userData.phase = i * 0.67;
    environment.add(blade);
  }
}

function addTrees(kind) {
  const trunkMaterial = makeMaterial(kind === 'savanna' ? 0x5d4932 : 0x4e4032);
  const treeGenerator = new TreeGenerator(trunkMaterial)
    .setLevels(4)
    .setChildren(3)
    .setSeed(7);

  const positions = kind === 'savanna'
    ? [[-7, -6, 1.2], [-4.8, -7.2, 0.9], [5.5, -6.5, 1.15], [7.3, -3.5, 0.9], [-6.5, 3.6, 0.85], [6.6, 3.4, 1.05]]
    : [[-7.2, -6.2, 0.9], [-5, -7.6, 1.15], [-2.6, -6.9, 0.8], [3.3, -7.4, 1.0], [6.1, -6.1, 0.9], [7.4, -2.7, 1.15], [-6.4, 3.6, 1.0], [6.1, 3.7, 0.85]];

  positions.forEach(([x, z, scale], index) => {
    const trunk = treeGenerator.setSeed(10 + index).build();
    trunk.scale.setScalar(scale * 0.58);
    trunk.position.set(x, 0, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    environment.add(trunk);

    const foliage = mesh(
      new THREE.ConeGeometry(0.95 * scale, 1.7 * scale, 8),
      makeMaterial(kind === 'savanna' ? 0x566b2e : 0x315c3a),
      [x, 1.45 * scale, z]
    );
    const foliage2 = mesh(
      new THREE.ConeGeometry(0.7 * scale, 1.2 * scale, 8),
      makeMaterial(kind === 'savanna' ? 0x67833a : 0x477147),
      [x, 2.2 * scale, z]
    );
    environment.add(foliage, foliage2);
  });
}

function addRock() {
  const positions = [[-3.4, -2.8, 1.0], [2.9, -2.1, 0.78], [4.5, 2.4, 0.6]];
  positions.forEach(([x, z, s], index) => {
    const rock = mesh(
      new THREE.DodecahedronGeometry(0.32 * s, 0),
      makeMaterial(0x696a62),
      [x, 0.18 * s, z],
      [0, index * 0.7, 0],
      [1.25, 0.75, 1]
    );
    environment.add(rock);
  });
}

function addMeadowDetails() {
  addGrass('meadow');
  const petalColors = [0xeaa7c0, 0xf2cf78, 0xcab4e8, 0xf4e8ad];
  for (let i = 0; i < 50; i += 1) {
    const a = i * 2.31;
    const r = 1.8 + (i % 13) * 0.62;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 0.75 + (i % 3) * 0.12;
    const stem = mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.18 * s, 5), makeMaterial(0x4e7e45), [x, 0.09 * s, z]);
    const flower = new THREE.Group();
    for (let p = 0; p < 5; p += 1) {
      const pa = p * Math.PI * 2 / 5;
      flower.add(mesh(new THREE.SphereGeometry(0.045 * s, 6, 5), makeMaterial(petalColors[i % petalColors.length]), [Math.cos(pa) * 0.055 * s, 0.2 * s, Math.sin(pa) * 0.055 * s]));
    }
    flower.position.set(x, 0, z);
    const center = mesh(new THREE.SphereGeometry(0.022 * s, 6, 5), makeMaterial(0xf1cf65), [0, 0.205 * s, 0]);
    flower.add(center);
    environment.add(stem, flower);
  }
}

async function addOcean() {
  waterNormals = new THREE.TextureLoader().load(
    'https://threejs.org/examples/textures/waternormals.jpg',
    (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
    },
    undefined,
    () => { waterNormals = null; }
  );

  const geometry = new THREE.PlaneGeometry(30, 30);
  water = new Water(geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: new THREE.Vector3(0.6, 0.8, 0.35).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x155d7a,
    distortionScale: 3.2,
    fog: true
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.12;
  water.name = 'official-threejs-water';
  environment.add(water);

  const seabed = mesh(
    new THREE.CircleGeometry(14, 96),
    makeMaterial(0x3f6658),
    [0, -0.35, 0],
    [-Math.PI / 2, 0, 0]
  );
  seabed.receiveShadow = true;
  environment.add(seabed);
}

function restoreStudioBase(show) {
  if (baseGround) baseGround.visible = show;
  if (baseGrid) baseGrid.visible = show;
}

function clearEnvironment() {
  if (!environment) return;
  if (water?.material) water.material.dispose();
  water = null;
  disposeObject(environment);
  scene.remove(environment);
  environment = null;
  sky = null;
}

function buildEnvironment(type) {
  if (!scene || currentType === type) return;
  currentType = type;
  clearEnvironment();

  const isStudio = type === 'studio';
  restoreStudioBase(isStudio);
  scene.fog = null;

  if (isStudio) {
    scene.background = new THREE.Color(0x080a0b);
    return;
  }

  environment = new THREE.Group();
  environment.name = `official-example-${type}`;

  addSky(type);
  if (type !== 'ocean') addGround(type);

  if (type === 'forest') {
    addTrees('forest');
    addGrass('forest');
    addRock();
  } else if (type === 'savanna') {
    addTrees('savanna');
    addGrass('savanna');
    addRock();
  } else if (type === 'meadow') {
    addMeadowDetails();
    addTrees('meadow');
  } else if (type === 'wetland') {
    addGrass('wetland');
    addTrees('forest');
    const pond = mesh(
      new THREE.CircleGeometry(5.5, 64),
      makeMaterial(0x416f72, { transparent: true, opacity: 0.72, roughness: 0.18 }),
      [0, 0.02, -1],
      [-Math.PI / 2, 0, 0]
    );
    environment.add(pond);
  } else if (type === 'coast') {
    const shoreWater = mesh(
      new THREE.CircleGeometry(7, 64),
      makeMaterial(0x4c9fb8, { transparent: true, opacity: 0.75, roughness: 0.18 }),
      [0, 0.02, -2.2],
      [-Math.PI / 2, 0, 0]
    );
    environment.add(shoreWater);
    addRock();
  } else if (type === 'ocean') {
    addOcean();
  }

  scene.add(environment);
}

function environmentForAnimal(kind) {
  return ANIMAL_TO_ENV[kind] || 'studio';
}

function captureScene() {
  if (scene || !window.THREE) return;
  scene = window.__animal3dScene || null;
}

function detectSceneFromPrototype() {
  if (scene) return true;
  const originalAdd = THREE.Scene.prototype.add;
  if (originalAdd.__animal3dPatched) return true;

  const patchedAdd = function patchedSceneAdd(...objects) {
    const result = originalAdd.apply(this, objects);
    if (!scene) {
      scene = this;
      window.__animal3dScene = this;
      setTimeout(() => initialize(), 0);
    }
    return result;
  };
  patchedAdd.__animal3dPatched = true;
  THREE.Scene.prototype.add = patchedAdd;
  return false;
}

function initialize() {
  if (initialized || !scene) return;
  initialized = true;

  baseGround = scene.children.find((obj) => obj.isMesh && obj.geometry?.type === 'CircleGeometry') || null;
  baseGrid = scene.children.find((obj) => obj.isGridHelper) || null;

  const animals = $('.animals');
  if (!animals) return;

  animals.addEventListener('click', (event) => {
    const button = event.target.closest('.animal');
    if (!button) return;
    const kind = button.dataset.animal;
    setTimeout(() => buildEnvironment(environmentForAnimal(kind)), 0);
  });

  const currentButton = animals.querySelector('.animal.active');
  const initialKind = currentButton?.dataset.animal || 'lion';
  buildEnvironment(environmentForAnimal(initialKind));

  requestAnimationFrame(tick);
}

function tick() {
  const dt = clock.getDelta();
  if (water?.material?.uniforms?.time) {
    water.material.uniforms.time.value += dt;
  }
  if (environment) {
    environment.traverse((object) => {
      if (object.isMesh && object.userData.grass) {
        object.rotation.z = Math.sin(performance.now() * 0.0015 + object.userData.phase) * 0.06;
      }
    });
  }
  requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectSceneFromPrototype, { once: true });
} else {
  detectSceneFromPrototype();
}
window.__animal3dOfficialScenesVersion = VERSION;
