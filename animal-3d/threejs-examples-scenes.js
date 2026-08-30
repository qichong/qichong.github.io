// Three.js r180 official scene helpers.
// TreeGenerator is intentionally not imported here because it is not available
// from the r180 CDN path. Forest / meadow geometry stays lightweight and local.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/objects/Sky.js';
import { Water } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/objects/Water.js';

const VERSION = '20260830-official-scenes-2';
window.__animal3dOfficialScenesVersion = VERSION;
window.__animal3dOfficialExamples = { THREE, Sky, Water };
