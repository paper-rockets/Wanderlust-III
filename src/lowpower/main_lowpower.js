import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { uniform, texture } from 'three/tsl';

import {
    scene, camera, renderer, clock,
    applyLowPowerRenderBudget, LowPowerAdaptiveResolution
} from './LowPowerEngine.js';

import { createLowPowerProceduralSky } from './proceduralSkyLowPower.js';
import { WaterSystemLowPower } from './WaterSystemLowPower.js';
import { TerrainMeshManagerLowPower } from './TerrainMeshManagerLowPower.js';
import { StylizedPineSystemLowPower } from './StylizedPineSystemLowPower.js';

import { createTerrainMaterial } from '../shaders/materials/TerrainNodeMaterial.js';
import { PlayerPhysics } from '../physics/PlayerPhysics.js';
import { CameraManager } from '../physics/CameraManager.js';
import { FlightControlsBridge } from '../physics/FlightControlsBridge.js';
import { FlightModelManager } from '../entities/FlightModelManager.js';
import { AnimatedFlockSystem } from '../entities/AnimatedFlockSystem.js';
import { initMoon, updateMoon, moonParams } from '../environment/CelestialObjects.js';
import {
    getWorldHeight, getWorldColor, getIslandData, getPathStrength,
    getBiomeAt, getWorldWaterHeight, worldOriginOffset, setWorldOriginOffset
} from '../world/TerrainGenerator.js';

import { initAudio, toggleMusic, updateWindSound } from '../audio/MusicSynthesizer.js';

// Wait for WebGPU Backend to initialize
await renderer.init();

function getAppBaseUrl() {
    if (typeof window !== 'undefined' && window.location) {
        const pathname = window.location.pathname;
        if (pathname.includes('/low-power') || pathname.includes('/low_power')) {
            return pathname.replace(/\/(low-power|low_power)(\.html|\/.*)?$/, '/');
        }
    }
    const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : './';
    return envBase.endsWith('/') ? envBase : (envBase + '/');
}

export function resolveAssetUrl(p) {
    if (!p) return p;
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('blob:')) return p;
    const cleanPath = p.replace(/^\.?\//, '');
    const base = getAppBaseUrl();
    return `${base}${cleanPath}`;
}

// Low-power adaptive resolution controller (target 36ms ~ 28 FPS)
const adaptiveRes = new LowPowerAdaptiveResolution({
    onScaleChange: (scale) => {
        applyLowPowerRenderBudget(scale);
    }
});

// 1. LIGHTING (No shadow maps for maximal fill-rate on Mali-G72)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfffaeb, 1.8);
dirLight.position.set(150, 200, 50);
dirLight.castShadow = false;
scene.add(dirLight);

// Sun Mesh
const staticSun = new THREE.Group();
staticSun.position.set(0, 1500, -20000);
scene.add(staticSun);

const sunGeo = new THREE.SphereGeometry(600, 16, 16);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
staticSun.add(sunMesh);

// Moon
const { staticMoon } = initMoon({ scene, resolveAssetUrl });

// 2. PROCEDURAL SKY
const proceduralSky = createLowPowerProceduralSky();
scene.add(proceduralSky.mesh);

// 3. TOON GRADIENT & TERRAIN MATERIAL
const gradientColors = new Uint8Array([160, 160, 160, 255, 255, 255, 255, 255]);
const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RGBAFormat);
gradientMap.needsUpdate = true;
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;

function createSandNoiseTexture(size = 128) {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size * 4; i += 4) {
        const v = Math.floor(Math.random() * 256);
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
}
const sandNoiseMap = createSandNoiseTexture(128);

const terrainUniforms = {
    uTime: uniform(0),
    uSunDir: uniform(new THREE.Vector3(0.3, 0.8, 0.5)),
    uSandNoiseMap: texture(sandNoiseMap),
    uShimmerMult: uniform(0.8),
    uWorldOriginZ: uniform(0.0)
};

const terrainMat = createTerrainMaterial(
    terrainUniforms.uTime,
    terrainUniforms.uSunDir,
    terrainUniforms.uSandNoiseMap,
    terrainUniforms.uShimmerMult,
    terrainUniforms.uWorldOriginZ
);

// 4. TERRAIN & WATER
const terrainMeshManager = new TerrainMeshManagerLowPower({ scene, terrainMat, terrainRes: 48, terrainSize: 8000 });
const terrain = terrainMeshManager.terrain;

const waterSystem = new WaterSystemLowPower(scene, renderer);

// 5. FLIGHT ENTITIES & PHYSICS
const playerGrp = new THREE.Group();
playerGrp.position.set(0, 45, 0);
scene.add(playerGrp);

const cameraBase = new THREE.Group();
scene.add(cameraBase);
cameraBase.add(camera);

const playerPhysics = new PlayerPhysics(playerGrp);
const cameraManager = new CameraManager(camera, cameraBase, 20.0);

const gltfLoader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(dracoLoader);

const ktx2Loader = new KTX2Loader()
    .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/')
    .detectSupport(renderer);
gltfLoader.setKTX2Loader(ktx2Loader);

gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const playerVisuals = new THREE.Group();
playerGrp.add(playerVisuals);

const flightModelManager = new FlightModelManager(playerVisuals, gltfLoader, resolveAssetUrl);

// Load default flight model
flightModelManager.setModelById('psx_saviola_s21');

// 6. INSTANCED FOLIAGE (2-LOD Band Low Power Pines)
const pineSystem = new StylizedPineSystemLowPower({
    scene,
    camera,
    gltfLoader,
    resolveAssetUrl,
    uTime: terrainUniforms.uTime,
    uSunDir: terrainUniforms.uSunDir,
    gradientMap,
    getWorldHeight: (x, z) => terrainMeshManager.getGroundedHeight(x, z),
    getBiomeAt,
    getIslandData,
    getPathStrength,
    densityScale: 0.4
});
pineSystem.load();

// 7. LOW-POWER INSTANCED DIORAMA PROPS


// Wind Trails (25 instances)
const TRAIL_COUNT = 25;
const trailGeo = new THREE.BoxGeometry(0.1, 0.1, 8.0);
const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
const instTrails = new THREE.InstancedMesh(trailGeo, trailMat, TRAIL_COUNT);
instTrails.frustumCulled = false;
scene.add(instTrails);

const trailsData = new Float32Array(TRAIL_COUNT * 4);
for (let i = 0; i < TRAIL_COUNT; i++) {
    trailsData[i * 4] = (Math.random() - 0.5) * 60;
    trailsData[i * 4 + 1] = (Math.random() - 0.5) * 40;
    trailsData[i * 4 + 2] = (Math.random() - 0.5) * 80;
    trailsData[i * 4 + 3] = Math.random();
}

// Birds (15 flocking birds)
let birdSystem = null;
try {
    birdSystem = new AnimatedFlockSystem({
        scene,
        gltfLoader,
        resolveAssetUrl,
        count: 12,
        modelPath: 'flight_models/low_poly_bird_animated_optimized.glb',
        scale: 0.08,
        getBiomeAt
    });
} catch (e) {
    console.warn('[Wanderlust LowPower] Bird system fallback:', e);
}

// 8. CONTROLS & TOUCH BRIDGE
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
const touchState = { x: 0, y: 0, boost: false, brake: false };

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') keys.w = true;
    if (k === 's' || k === 'arrowdown') keys.s = true;
    if (k === 'a' || k === 'arrowleft') keys.a = true;
    if (k === 'd' || k === 'arrowright') keys.d = true;
    if (k === ' ') keys.space = true;
    if (e.shiftKey) keys.shift = true;
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') keys.w = false;
    if (k === 's' || k === 'arrowdown') keys.s = false;
    if (k === 'a' || k === 'arrowleft') keys.a = false;
    if (k === 'd' || k === 'arrowright') keys.d = false;
    if (k === ' ') keys.space = false;
    if (!e.shiftKey) keys.shift = false;
});

// Touch Joystick Setup
const joyBase = document.getElementById('joystick-base');
const joyKnob = document.getElementById('joystick-knob');
const boostBtn = document.getElementById('boost-btn');

if (joyBase && joyKnob) {
    let touchId = null;
    let baseRect = null;

    joyBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        touchId = t.identifier;
        baseRect = joyBase.getBoundingClientRect();
        updateJoystick(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (touchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === touchId) {
                updateJoystick(t.clientX, t.clientY);
                break;
            }
        }
    }, { passive: false });

    const endTouch = (e) => {
        if (touchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
                touchId = null;
                touchState.x = 0;
                touchState.y = 0;
                joyKnob.style.transform = 'translate(-50%, -50%)';
                break;
            }
        }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    function updateJoystick(clientX, clientY) {
        if (!baseRect) return;
        const centerX = baseRect.left + baseRect.width * 0.5;
        const centerY = baseRect.top + baseRect.height * 0.5;
        const maxR = baseRect.width * 0.45;

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) {
            dx = (dx / dist) * maxR;
            dy = (dy / dist) * maxR;
        }

        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        touchState.x = dx / maxR;
        touchState.y = dy / maxR;
    }
}

if (boostBtn) {
    boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); touchState.boost = true; }, { passive: false });
    boostBtn.addEventListener('touchend', (e) => { e.preventDefault(); touchState.boost = false; }, { passive: false });
    boostBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); touchState.boost = false; }, { passive: false });
}

// 9. TIME OF DAY & ATMOSPHERE
let timePhase = 1; // 0 = Day, 1 = Dusk, 2 = Twilight
const envConfigs = [
    { name: 'Day', bg: 0x3f7fc4, fog: 0xbcd2e2, amb: 0xcfe6f7, dir: 0xfff3d8, sunY: 10000, moonY: -8000, cloudCol: 0xfdf7e8 },
    { name: 'Dusk', bg: 0x2a5090, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, sunY: 160, moonY: 200, cloudCol: 0xfffaec },
    { name: 'Twilight', bg: 0x0a1330, fog: 0x24406e, amb: 0x6b82ad, dir: 0x9ecbff, sunY: -8000, moonY: 9000, cloudCol: 0x33507d }
];

const timeToggleBtn = document.getElementById('time-toggle');
if (timeToggleBtn) {
    timeToggleBtn.addEventListener('click', () => {
        timePhase = (timePhase + 1) % 3;
        timeToggleBtn.innerText = envConfigs[timePhase].name;
    });
}

const zoomToggleBtn = document.getElementById('zoom-toggle');
if (zoomToggleBtn) {
    zoomToggleBtn.addEventListener('click', () => {
        cameraManager.cameraZoomDist = cameraManager.cameraZoomDist === 20.0 ? 32.0 : 20.0;
        zoomToggleBtn.innerText = `Zoom: ${cameraManager.cameraZoomDist}m`;
    });
}

const soundToggleBtn = document.getElementById('sound-toggle');
let isSoundMuted = false;
if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
        isSoundMuted = !isSoundMuted;
        soundToggleBtn.innerText = isSoundMuted ? 'Muted' : 'Audio ON';
    });
}

window.addEventListener('touchstart', () => initAudio({ isSoundMuted }), { once: true });
window.addEventListener('keydown', () => initAudio({ isSoundMuted }), { once: true });

// 10. FPS COUNTER
const fpsElement = document.getElementById('fps-counter');
let frameCount = 0;
let lastFpsTime = performance.now();

// 11. MAIN ANIMATION LOOP (DIRECT RENDER TO CANVAS)
const tempSunPos = new THREE.Vector3();
let currentSunY = envConfigs[timePhase].sunY;
let currentMoonY = envConfigs[timePhase].moonY;

async function animate() {
    const dt = Math.min(0.08, clock.getDelta());
    const time = clock.getElapsedTime();

    // FPS Meter & Biome Display
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 500) {
        const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        if (fpsElement) fpsElement.innerText = `${fps} FPS [Tab S6 Lite]`;
        const biomeElement = document.getElementById('biome-label');
        if (biomeElement && playerGrp) {
            const currZn = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            if (currZn) biomeElement.innerText = currZn.name || '';
        }
        frameCount = 0;
        lastFpsTime = now;
        adaptiveRes.sample(1000 / Math.max(1, fps));
    }

    // Input state
    const isBraking = keys.space || touchState.brake;
    const isBoosting = keys.shift || touchState.boost;
    const inputState = {
        forward: true,
        up: keys.w || touchState.y < -0.1,
        down: keys.s || touchState.y > 0.1,
        left: keys.a || touchState.x < -0.1,
        right: keys.d || touchState.x > 0.1
    };

    // Update water level
    const playerX = playerGrp.position.x;
    const playerZ = playerGrp.position.z;
    const targetWaterY = getWorldWaterHeight(playerX, playerZ);
    waterSystem.setHeight(targetWaterY);

    // Physics & Camera
    playerPhysics.update(dt, inputState, isBraking, isBoosting, false, null);
    cameraManager.update(dt, playerGrp, playerPhysics.currentYaw, isBoosting, targetWaterY);

    // Floating origin recentering (5,000m threshold)
    const distFromOrigin = Math.hypot(playerGrp.position.x, playerGrp.position.z);
    if (distFromOrigin > 5000.0) {
        const shiftX = playerGrp.position.x;
        const shiftZ = playerGrp.position.z;
        playerGrp.position.x = 0;
        playerGrp.position.z = 0;
        cameraBase.position.x = 0;
        cameraBase.position.z = 0;
        terrain.position.x -= shiftX;
        terrain.position.z -= shiftZ;
        setWorldOriginOffset(worldOriginOffset.x + shiftX, worldOriginOffset.y + shiftZ);
        terrainMeshManager.update(playerGrp.position.x, playerGrp.position.z, waterSystem);
        if (pineSystem && typeof pineSystem.respawn === 'function') {
            pineSystem.respawn();
        }
    }

    // Update Terrain & Foliage
    terrainMeshManager.update(playerGrp.position.x, playerGrp.position.z, waterSystem);
    pineSystem.update(playerGrp.position.x, playerGrp.position.z, camera);

    // Update Water
    waterSystem.update(dt, time, camera, playerGrp.position, dirLight.position);

    // Celestial lerping
    const targetCfg = envConfigs[timePhase];
    const decay = 1.0 - Math.exp(-3.0 * dt);
    currentSunY += (targetCfg.sunY - currentSunY) * decay;
    currentMoonY += (targetCfg.moonY - currentMoonY) * decay;

    staticSun.position.set(playerGrp.position.x, playerGrp.position.y * 0.45 + currentSunY, playerGrp.position.z - 20000);
    staticSun.visible = (timePhase !== 2);

    if (staticMoon) {
        staticMoon.position.set(playerGrp.position.x, playerGrp.position.y * 0.45 + currentMoonY, playerGrp.position.z - 20000);
        staticMoon.visible = (timePhase === 2);
        if (timePhase === 2) {
            updateMoon(dt);
        }
    }

    // Sky Uniforms
    const skyU = proceduralSky.uniforms;
    skyU.uTime.value = time;
    skyU.uNightFactor.value = timePhase === 2 ? 1.0 : 0.0;
    skyU.uDuskFactor.value = timePhase === 1 ? 1.0 : 0.0;
    const activeTarget = (timePhase === 2 && staticMoon) ? staticMoon : staticSun;
    tempSunPos.copy(activeTarget.position).sub(playerGrp.position).normalize();
    skyU.uSunPosition.value.copy(tempSunPos);

    dirLight.position.copy(playerGrp.position).add(tempSunPos.multiplyScalar(2000));
    dirLight.target.position.copy(playerGrp.position);
    dirLight.target.updateMatrixWorld();

    terrainUniforms.uTime.value = time;
    terrainUniforms.uSunDir.value.copy(tempSunPos);

    // Wind Trails
    if (isBoosting) {
        instTrails.visible = true;
        trailMat.opacity = 0.22;
        for (let i = 0; i < TRAIL_COUNT; i++) {
            let z = trailsData[i * 4 + 2];
            z += playerPhysics.velocity * 3.0 * dt;
            if (z > 40) {
                z -= 80;
                trailsData[i * 4] = (Math.random() - 0.5) * 60;
                trailsData[i * 4 + 1] = (Math.random() - 0.5) * 40;
            }
            trailsData[i * 4 + 2] = z;

            dummy.position.set(trailsData[i * 4], trailsData[i * 4 + 1], z);
            dummy.scale.set(1.0, 1.0, 2.5);
            dummy.updateMatrix();
            instTrails.setMatrixAt(i, dummy.matrix);
        }
        instTrails.position.copy(playerGrp.position);
        instTrails.rotation.copy(playerGrp.rotation);
        instTrails.instanceMatrix.needsUpdate = true;
    } else {
        instTrails.visible = false;
    }

    if (flightModelManager) {
        flightModelManager.update(dt);
    }

    if (birdSystem && birdSystem.update) {
        birdSystem.update(playerGrp.position, time, dt, playerPhysics ? playerPhysics.velocity : 18.0);
    }

    updateWindSound(true, isBoosting, isSoundMuted, playerPhysics.velocity, time);

    // DIRECT WEBGPU RENDER (No multi-pass composer for maximum FPS)
    await renderer.renderAsync(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyLowPowerRenderBudget(adaptiveRes.scale);
});

renderer.setAnimationLoop((t, f) => {
    animate().catch(e => console.error('[Wanderlust LowPower] loop error:', e));
});
