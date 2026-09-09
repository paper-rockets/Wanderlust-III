import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { LOW_GFX } from '../config/constants.js';
import { budgetedPixelRatio, deviceTier, tierSettings, describeTier } from './DeviceTier.js';

const container = document.getElementById('app');

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8cbce6);
scene.fog = new THREE.Fog(0x8cbce6, 100, 8000);

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 30000);
camera.position.set(0, 9, 26);

export const renderer = new WebGPURenderer({ 
    antialias: !LOW_GFX, 
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);

// Cap by TOTAL PIXEL COUNT, not by device pixel ratio. A 4K panel reporting dpr 2 would
// otherwise render 7680x4320 = 33M pixels; every full-screen pass then costs 4x what it
// does at native 4K. budgetedPixelRatio() derives the ratio from the tier's pixel budget.
export function applyRenderBudget(scale = 1.0) {
    const ratio = LOW_GFX
        ? 0.5
        : budgetedPixelRatio(window.innerWidth, window.innerHeight) * scale;
    renderer.setPixelRatio(Math.max(0.5, ratio));
    return ratio;
}
applyRenderBudget();

renderer.shadowMap.enabled = !LOW_GFX && tierSettings.shadows;
renderer.shadowMap.type = (LOW_GFX || deviceTier === 'mobile') ? THREE.BasicShadowMap : THREE.PCFShadowMap;
console.info('[Wanderlust] render tier:', describeTier());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;

if (container) {
    container.appendChild(renderer.domElement);
}

export const clock = new THREE.Clock();

export async function prewarmEngineShaders() {
    if (renderer && typeof renderer.compileAsync === 'function') {
        try {
            await renderer.compileAsync(scene, camera);
        } catch (e) {
            console.warn('[Wanderlust] WebGPU prewarm warning:', e);
        }
    }
}
