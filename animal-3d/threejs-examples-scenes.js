import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/objects/Sky.js';
import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/objects/Water.js';

const ANIMAL_TO_ENV = {
  lion: 'savanna', lioness: 'savanna',
  horse: 'meadow', rabbit: 'meadow',
  tiger: 'forest', fox: 'forest', black_panther: 'forest', deer: 'forest', macaw: 'forest',
  alligator: 'wetland', seagull: 'coast',
  shark: 'ocean', whale: 'ocean', swordfish: 'ocean', tuna: 'ocean', starfish: 'ocean'
};

let scene = null;
let environment = null;
let water = null;
let currentEnv = null;
let waterNormals = null;
let waterRequestId = 0;
let started = false;

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
}

function addMesh(group, geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  group.add(object);
  return object;
}

function disposeGroup(group) {
  if (!group) return;
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material?.dispose?.());
  });
  scene.remove(group);
}

function addSky(type) {
  const sky = new Sky();
  sky.scale.setScalar(100);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = type === 'ocean' ? 5 : 3;
  uniforms.rayleigh.value = type === 'ocean' ? 1.8 : 1.25;
  uniforms.mieCoefficient.value = 0.005;
  uniforms.mieDirectionalG.value = 0.78;

  const sun = new THREE.Vector3();
  if (type === 'savanna') {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(23), THREE.MathUtils.degToRad(215));
  } else if (type === 'ocean' || type === 'coast') {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(150));
  } else {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(205));
  }
  uniforms.sunPosition.value.copy(sun);
  scene.add(sky);
}

function addGround(group, color) {
  addMesh(group, new THREE.CircleGeometry(14, 96), mat(color), [0, -0.025, 0], [-Math.PI / 2, 0, 0]);
}

function addTree(group, x, z, scale = 1, pine = false) {
  addMesh(group, new THREE.CylinderGeometry(0.09 * scale, 0.16 * scale, 1.25 * scale, 8), mat(0x55402d), [x, 0.625 * scale, z]);
  if (pine) {
    addMesh(group, new THREE.ConeGeometry(0.72 * scale, 1.7 * scale, 10), mat(0x2e5a3c), [x, 1.55 * scale, z]);
    addMesh(group, new THREE.ConeGeometry(0.52 * scale, 1.25 * scale, 10), mat(0x42734e), [x, 2.2 * scale, z]);
  } else {
    addMesh(group, new THREE.SphereGeometry(0.58 * scale, 14, 10), mat(0x4d682f), [x, 1.48 * scale, z], [0, 0, 0], [1.5, 0.58, 0.9]);
    addMesh(group, new THREE.SphereGeometry(0.38 * scale, 12, 8), mat(0x607b39), [x - 0.28 * scale, 1.55 * scale, z + 0.08]);
    addMesh(group, new THREE.SphereGeometry(0.38 * scale, 12, 8), mat(0x607b39), [x + 0.28 * scale, 1.5 * scale, z - 0.05]);
  }
}

function addGrass(group, count, color) {
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.399;
    const radius = 2 + (i % 13) * 0.58;
    const height = 0.18 + (i % 5) * 0.055;
    const blade = addMesh(group, new THREE.ConeGeometry(0.018, height, 4), mat(color), [Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius], [0, 0, i % 2 ? 0.2 : -0.2]);
    blade.userData.grass = true;
    blade.userData.phase = i * 0.61;
  }
}

function addFlowers(group) {
  const colors = [0xe8a5bd, 0xf0ce77, 0xc5afe7, 0xf3e8aa];
  for (let i = 0; i < 40; i += 1) {
    const angle = i * 2.31;
    const radius = 2 + (i % 12) * 0.53;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    addMesh(group, new THREE.CylinderGeometry(0.008, 0.012, 0.2, 5), mat(0x4c7b43), [x, 0.1, z]);
    const flower = new THREE.Group();
    for (let p = 0; p < 5; p += 1) {
      const pa = p * Math.PI * 2 / 5;
      addMesh(flower, new THREE.SphereGeometry(0.045, 6, 5), mat(colors[i % colors.length]), [Math.cos(pa) * 0.055, 0.205, Math.sin(pa) * 0.055]);
    }
    addMesh(flower, new THREE.SphereGeometry(0.022, 6, 5), mat(0xf0ca62), [0, 0.21, 0]);
    flower.position.set(x, 0, z);
    group.add(flower);
  }
}

function build(type) {
  if (!scene || currentEnv === type) return;
  currentEnv = type;
  const requestId = ++waterRequestId;

  if (environment) {
    disposeGroup(environment);
    environment = null;
  }
  water = null;
  waterNormals = null;
  scene.background = new THREE.Color(0x080a0b);

  if (!type || type === 'studio') return;

  environment = new THREE.Group();
  environment.name = `threejs-official-${type}`;
  scene.add(environment);

  addSky(type);

  if (type === 'ocean') {
    const textureLoader = new THREE.TextureLoader();
    const initialNormals = new THREE.Texture();
    water = new Water(new THREE.PlaneGeometry(30, 30), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: initialNormals,
      sunDirection: new THREE.Vector3(0.6, 0.8, 0.35).normalize(),
      sunColor: 0xffffff,
      waterColor: 0x12627f,
      distortionScale: 3.4,
      fog: false
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.05;
    environment.add(water);

    textureLoader.load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      (texture) => {
        if (requestId !== waterRequestId || !water) {
          texture.dispose();
          return;
        }
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.NoColorSpace;
        waterNormals = texture;
        water.material.uniforms.waterNormals.value = texture;
        water.material.uniforms.waterNormals.value.needsUpdate = true;
      },
      undefined,
      () => {}
    );
    return;
  }

  const groundColors = {
    savanna: 0x9f8957,
    forest: 0x536b52,
    meadow: 0x78a85d,
    wetland: 0x57765e,
    coast: 0xc2b487
  };
  addGround(environment, groundColors[type] || 0x65705e);

  if (type === 'savanna') {
    addGrass(environment, 70, 0x869c46);
    [[-7, -7, 1.7], [-4.5, -8, 1.25], [5.4, -7.4, 1.45], [7, -4, 1.1], [-6.5, 4, 0.9], [6.4, 3.5, 1.0]].forEach((v) => addTree(environment, ...v));
  } else if (type === 'forest') {
    addGrass(environment, 60, 0x5b954d);
    [[-7, -6.5, 1.0], [-4.5, -7.8, 1.2], [-2, -7, 0.85], [3.2, -7.6, 1.0], [6.3, -6.1, 1.0], [7.5, -2.7, 1.1], [-6.5, 3.8, 1.0], [6, 3.8, 0.9]].forEach((v) => addTree(environment, v[0], v[1], v[2], true));
  } else if (type === 'meadow') {
    addGrass(environment, 72, 0x66a14f);
    addFlowers(environment);
    [[-6, 4.5, 0.8], [0, 5.2, 0.9], [6, 4.2, 0.75]].forEach((v) => addTree(environment, ...v));
  } else if (type === 'wetland') {
    addGrass(environment, 48, 0x6c9b56);
    [[-6, 3, 1], [6, 3, 0.9]].forEach((v) => addTree(environment, ...v));
    addMesh(environment, new THREE.CircleGeometry(5.5, 64), mat(0x447a7d, { transparent: true, opacity: 0.7, roughness: 0.18 }), [0, 0.015, -1], [-Math.PI / 2, 0, 0]);
  } else if (type === 'coast') {
    addMesh(environment, new THREE.CircleGeometry(7, 64), mat(0x4b9eb6, { transparent: true, opacity: 0.72, roughness: 0.2 }), [0, 0.02, -2], [-Math.PI / 2, 0, 0]);
  }
}

export function initOfficialScenes(targetScene, getActiveAnimal) {
  if (started) return;
  started = true;
  scene = targetScene;

  const animals = document.querySelector('.animals');
  if (animals) {
    animals.addEventListener('click', (event) => {
      const button = event.target.closest('.animal');
      if (!button) return;
      build(ANIMAL_TO_ENV[button.dataset.animal] || 'studio');
    });
  }

  const initial = getActiveAnimal?.() || 'lion';
  build(ANIMAL_TO_ENV[initial] || 'studio');
}

export function updateOfficialScenes(timeDelta) {
  if (water?.material?.uniforms?.time) {
    water.material.uniforms.time.value += timeDelta;
  }
  if (environment) {
    const t = performance.now() * 0.0015;
    environment.traverse((object) => {
      if (object.isMesh && object.userData.grass) {
        object.rotation.z = Math.sin(t + object.userData.phase) * 0.05;
      }
    });
  }
}
