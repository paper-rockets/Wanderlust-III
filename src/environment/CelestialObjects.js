import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, positionLocal, float, vec2, vec3, sin, mix, smoothstep as tslSmoothstep, uv, pow, clamp } from 'three/tsl';
import { camera } from '../core/Engine.js';

// ==========================================
// MOON & HALO (Procedural Soft Lunar Glow)
// ==========================================
export let staticMoon = null;
export let moonMesh = null;
export let moonHalo = null;
export let moonGlowSprite = null;
export let uMoonHaloColor = uniform(new THREE.Color('#b0c8e8'));
export let uMoonHaloIntensity = uniform(0.45);

export const moonParams = {
    size: 1.0,
    baseRadius: 450,
    haloRadius: 1200,
    brightness: 1.0,
    color: '#f4f8ff',
    haloColor: '#b0c8e8',
    haloOpacity: 0.45,
    glowIntensity: 0.45,
    glowRadius: 1.8,
    glowColor: '#b0c8e8',
    azimuth: 0,
    distance: 20000,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    rotationSpeed: 0
};

export function initMoon({ scene }) {
    staticMoon = new THREE.Group();
    scene.add(staticMoon);

    const moonGeo = new THREE.SphereGeometry(moonParams.baseRadius, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(moonParams.color),
        fog: false
    });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    staticMoon.add(moonMesh);

    // Procedural soft-feathered radial lunar glow billboard
    const haloGeo = new THREE.PlaneGeometry(moonParams.baseRadius * 5.0, moonParams.baseRadius * 5.0);
    const haloMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    const d = uv().sub(vec2(0.5, 0.5)).length().mul(float(2.0));
    const radialFalloff = pow(clamp(float(1.0).sub(d), float(0.0), float(1.0)), float(2.8));
    haloMat.colorNode = uMoonHaloColor;
    haloMat.opacityNode = radialFalloff.mul(uMoonHaloIntensity);

    moonHalo = new THREE.Mesh(haloGeo, haloMat);
    moonHalo.renderOrder = -999;
    staticMoon.add(moonHalo);

    moonGlowSprite = moonHalo;

    if (typeof window !== 'undefined') {
        window._moon = () => moonMesh;
        window._moonHalo = () => moonHalo;
        window._moonGlow = () => moonHalo;
        window._moonParams = moonParams;
    }

    return { staticMoon, moonMesh, moonHalo, moonGlowSprite, moonParams, updateMoon };
}

export function updateMoon(dt = 0.016) {
    if (!moonMesh) return;
    if (moonParams.rotationSpeed !== 0) {
        moonParams.rotationY = (moonParams.rotationY + dt * moonParams.rotationSpeed * (180.0 / Math.PI)) % 360;
    }
    moonMesh.rotation.set(
        THREE.MathUtils.degToRad(moonParams.rotationX),
        THREE.MathUtils.degToRad(moonParams.rotationY),
        THREE.MathUtils.degToRad(moonParams.rotationZ)
    );
    moonMesh.scale.setScalar(moonParams.size);
    if (moonMesh.material && moonMesh.material.color) {
        moonMesh.material.color.set(moonParams.color);
        if (moonParams.brightness !== 1.0) {
            moonMesh.material.color.multiplyScalar(moonParams.brightness);
        }
    }
    if (moonHalo) {
        if (camera) {
            moonHalo.quaternion.copy(camera.quaternion);
        }
        const hScale = moonParams.size * (moonParams.glowRadius ? moonParams.glowRadius / 1.44 : 1.0);
        moonHalo.scale.setScalar(hScale);
        uMoonHaloIntensity.value = moonParams.glowIntensity;
        uMoonHaloColor.value.set(moonParams.glowColor || moonParams.haloColor);
        moonHalo.visible = moonParams.glowIntensity > 0.01;
    }
}

// ==========================================
// AURORA BOREALIS
// ==========================================
export const uAuroraOpacity = uniform(0.0);
export const uAuroraIntensity = uniform(1.0);
export const uAuroraTime = uniform(0.0);

export let auroraMesh = null;
export const auroraParams = {
    opacity: 0.0,
    intensity: 1.0,
    speed: 1.0,
    altitude: 2500
};

export function initAurora({ scene }) {
    try {
        const auroraMat = new MeshBasicNodeMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            transparent: true,
            fog: false,
            blending: THREE.AdditiveBlending
        });

        // Cylinder half-height = 2500, radius = 12000
        const px = positionLocal.x.div(float(12000));
        const pz = positionLocal.z.div(float(12000));
        const pyNorm = positionLocal.y.add(float(2500)).div(float(5000));

        // Soft fade at top and bottom edges of the curtain
        const vFade = tslSmoothstep(float(0.0), float(0.2), pyNorm)
            .mul(tslSmoothstep(float(1.0), float(0.8), pyNorm));

        const t = uAuroraTime.mul(float(0.4));
        const w1 = sin(px.mul(float(9.0)).add(t)).mul(float(0.5)).add(float(0.5));
        const w2 = sin(pz.mul(float(7.0)).sub(t.mul(float(1.3)))).mul(float(0.5)).add(float(0.5));
        const w3 = sin(px.mul(float(11.0)).add(pz.mul(float(8.0))).sub(t.mul(float(0.8)))).mul(float(0.5)).add(float(0.5));

        const ribbon = w1.mul(w2.mul(float(0.7)).add(float(0.3))).mul(w3).pow(float(2.0));

        const cGreen = vec3(0.0, 1.0, 0.3);
        const cBlue = vec3(0.0, 0.4, 1.0);
        const auroraColor = mix(cGreen, cBlue, w2).mul(ribbon).mul(vFade);

        auroraMat.colorNode = auroraColor.mul(uAuroraIntensity);
        auroraMat.opacityNode = uAuroraOpacity;

        const auroraGeo = new THREE.CylinderGeometry(12000, 12000, 5000, 64, 1, true);
        auroraMesh = new THREE.Mesh(auroraGeo, auroraMat);
        auroraMesh.renderOrder = -998;
        auroraMesh.frustumCulled = false;
        scene.add(auroraMesh);
    } catch (e) {
        console.warn('[Aurora] failed to init', e);
    }

    if (typeof window !== 'undefined') {
        window._aurora = () => auroraMesh;
    }

    return { auroraMesh, auroraParams, updateAurora };
}

export function updateAurora(cameraPos, dt, nightFactor) {
    if (!auroraMesh) return;
    uAuroraTime.value += dt * auroraParams.speed;
    uAuroraOpacity.value = nightFactor * auroraParams.opacity;
    uAuroraIntensity.value = auroraParams.intensity;
    auroraMesh.position.set(
        cameraPos.x,
        cameraPos.y + auroraParams.altitude,
        cameraPos.z
    );
    auroraMesh.visible = uAuroraOpacity.value > 0.01;
}
