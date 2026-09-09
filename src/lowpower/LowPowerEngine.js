import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

const container = document.getElementById('app');

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8cbce6);
scene.fog = new THREE.Fog(0x8cbce6, 120, 3500);

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 25000);
camera.position.set(0, 9, 26);

// Low-power WebGPU renderer configuration
export const renderer = new WebGPURenderer({
    antialias: false,
    powerPreference: 'low-power'
});
renderer.setSize(window.innerWidth, window.innerHeight);

// Target 550,000 pixels for Samsung Galaxy Tab S6 Lite (Mali-G72 MP3) to guarantee 20-30 FPS
export const LOW_POWER_PIXEL_BUDGET = 550_000;

export function budgetedPixelRatio(width, height, budget = LOW_POWER_PIXEL_BUDGET) {
    const cssPixels = Math.max(1, width * height);
    const maxRatio = Math.sqrt(budget / cssPixels);
    return Math.max(0.45, Math.min(0.70, maxRatio));
}

export function applyLowPowerRenderBudget(scale = 1.0) {
    const baseRatio = budgetedPixelRatio(window.innerWidth, window.innerHeight);
    const finalRatio = Math.max(0.45, Math.min(0.75, baseRatio * scale));
    renderer.setPixelRatio(finalRatio);
    return finalRatio;
}
applyLowPowerRenderBudget();

// Disable shadow maps entirely on low power tier to eliminate secondary render pass
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;

if (container) {
    container.appendChild(renderer.domElement);
}

export const clock = new THREE.Clock();

/**
 * Adaptive resolution controller targeting 25-30 FPS (36ms).
 */
export class LowPowerAdaptiveResolution {
    constructor({ onScaleChange, targetMs = 36, windowSize = 60 } = {}) {
        this.onScaleChange = onScaleChange;
        this.targetMs = targetMs;
        this.windowSize = windowSize;
        this.samples = [];
        this.scale = 1.0;
        this.enabled = true;
        this.minScale = 0.85;
        this.maxScale = 1.15;
        this.step = 0.08;
        this._goodStreak = 0;
        this._cooldownUntil = 0;
    }

    setEnabled(v) {
        this.enabled = v;
        this.samples.length = 0;
        this._goodStreak = 0;
    }

    reset() {
        this.samples.length = 0;
        this._goodStreak = 0;
        this.scale = 1.0;
    }

    sample(dtMs) {
        if (!this.enabled) return;
        if (dtMs > 500 || dtMs <= 0) return;

        this.samples.push(dtMs);
        if (this.samples.length < this.windowSize) return;

        const now = performance.now();
        if (now < this._cooldownUntil) {
            this.samples.length = 0;
            return;
        }

        const sorted = this.samples.slice().sort((a, b) => a - b);
        const median = sorted[sorted.length >> 1];
        this.samples.length = 0;

        let next = this.scale;
        if (median > this.targetMs * 1.18) {
            next = Math.max(this.minScale, this.scale - this.step);
            this._goodStreak = 0;
        } else if (median < this.targetMs * 0.70) {
            this._goodStreak++;
            if (this._goodStreak >= 3) {
                next = Math.min(this.maxScale, this.scale + this.step);
                this._goodStreak = 0;
            }
        } else {
            this._goodStreak = 0;
        }

        if (Math.abs(next - this.scale) > 0.001) {
            this.scale = next;
            this._cooldownUntil = now + 2000;
            if (this.onScaleChange) this.onScaleChange(this.scale);
        }
    }
}
