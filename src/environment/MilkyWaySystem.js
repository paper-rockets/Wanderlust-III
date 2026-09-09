import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, texture, float, vec3, dot, mix, clamp } from 'three/tsl';

export const uMilkyWayOpacity = uniform(0.0);
export const uMilkyWayBrightness = uniform(2.0);
export const uMilkyWayContrast = uniform(1.0);
export const uMilkyWayHue = uniform(0.0);
export const uMilkyWaySat = uniform(1.0);

export const milkyWayParams = {
    brightness: 2.0,
    opacity: 1.0,
    contrast: 1.0,
    hue: 0.0,
    saturation: 1.0,
    tiltX: 0,
    tiltY: 90,
    tiltZ: 23
};

export let milkyWayMesh = null;
export let milkyWayReady = false;

export function applyMilkyWayTilt() {
    if (!milkyWayMesh) return;
    milkyWayMesh.rotation.set(
        THREE.MathUtils.degToRad(milkyWayParams.tiltX),
        THREE.MathUtils.degToRad(milkyWayParams.tiltY),
        THREE.MathUtils.degToRad(milkyWayParams.tiltZ)
    );
}

export function initMilkyWay({ scene, resolveAssetUrl }) {
    try {
        const loader = new THREE.TextureLoader();
        const mwTex = new THREE.Texture();
        mwTex.colorSpace = THREE.SRGBColorSpace;
        mwTex.anisotropy = 4;
        mwTex.wrapS = THREE.RepeatWrapping;
        mwTex.wrapT = THREE.ClampToEdgeWrapping;

        const candidates = [
            resolveAssetUrl('assets/skybox/milkyway_equirect.jpg'),
            resolveAssetUrl('assets/Skybox/milkyway_equirect.jpg'),
            'assets/skybox/milkyway_equirect.jpg',
            'assets/Skybox/milkyway_equirect.jpg',
            '/assets/skybox/milkyway_equirect.jpg',
            '/assets/Skybox/milkyway_equirect.jpg',
            'public/assets/skybox/milkyway_equirect.jpg',
            'public/assets/Skybox/milkyway_equirect.jpg'
        ];

        let attemptIdx = 0;
        function tryLoadNext() {
            if (attemptIdx >= candidates.length) {
                console.error('[MilkyWay] All candidate paths failed to load Milky Way texture:', candidates);
                return;
            }
            const path = candidates[attemptIdx++];
            loader.load(
                path,
                (loadedTex) => {
                    mwTex.image = loadedTex.image;
                    mwTex.needsUpdate = true;
                    milkyWayReady = true;
                    console.log('[MilkyWay] Successfully loaded Milky Way texture from:', path);
                },
                undefined,
                (err) => {
                    console.warn(`[MilkyWay] Failed to load from: ${path}, trying next fallback...`);
                    tryLoadNext();
                }
            );
        }
        tryLoadNext();

        const mwMat = new MeshBasicNodeMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: true,
            transparent: true,
            fog: false,
            blending: THREE.AdditiveBlending
        });

        // TSL color processing chain
        const mwSample = texture(mwTex);
        const mwRaw = mwSample.rgb;
        const mwBright = mwRaw.mul(uMilkyWayBrightness);
        const mwContrasted = mwBright.sub(0.5).mul(uMilkyWayContrast).add(0.5);
        const mwLum = dot(mwContrasted, vec3(0.2126, 0.7152, 0.0722));
        const mwSatOut = mix(vec3(mwLum), mwContrasted, uMilkyWaySat);

        // Rodrigues-style hue rotation in linear RGB space
        const mwCosH = uMilkyWayHue.mul(Math.PI / 180.0).cos();
        const mwSinH = uMilkyWayHue.mul(Math.PI / 180.0).sin();
        const w = float(0.57735); // 1/sqrt(3)
        const d = dot(mwSatOut, vec3(w, w, w)).mul(float(1.0).sub(mwCosH));
        const cx = mwSatOut.y.sub(mwSatOut.z).mul(w).mul(mwSinH);
        const cy = mwSatOut.z.sub(mwSatOut.x).mul(w).mul(mwSinH);
        const cz = mwSatOut.x.sub(mwSatOut.y).mul(w).mul(mwSinH);
        const mwHued = vec3(
            mwSatOut.x.mul(mwCosH).add(cx).add(d),
            mwSatOut.y.mul(mwCosH).add(cy).add(d),
            mwSatOut.z.mul(mwCosH).add(cz).add(d)
        );

        mwMat.colorNode = clamp(mwHued, 0.0, 10.0);
        mwMat.opacityNode = uMilkyWayOpacity;

        const mwGeo = new THREE.SphereGeometry(16000, 64, 32);
        milkyWayMesh = new THREE.Mesh(mwGeo, mwMat);
        milkyWayMesh.renderOrder = -999;
        milkyWayMesh.frustumCulled = false;
        milkyWayMesh.visible = false;
        applyMilkyWayTilt();
        scene.add(milkyWayMesh);
    } catch (e) {
        console.warn('[MilkyWay] failed to init sky panorama', e);
    }

    if (typeof window !== 'undefined') {
        window._milkyWay = () => milkyWayMesh;
    }

    return {
        milkyWayMesh,
        milkyWayParams,
        applyMilkyWayTilt,
        updateMilkyWay
    };
}

export function updateMilkyWay(cameraPos, nightFactor) {
    if (!milkyWayMesh || !milkyWayReady) return;
    uMilkyWayOpacity.value = nightFactor * milkyWayParams.opacity;
    uMilkyWayBrightness.value = milkyWayParams.brightness;
    uMilkyWayContrast.value = milkyWayParams.contrast;
    uMilkyWayHue.value = milkyWayParams.hue;
    uMilkyWaySat.value = milkyWayParams.saturation;
    milkyWayMesh.visible = uMilkyWayOpacity.value > 0.01;
    milkyWayMesh.position.copy(cameraPos);
}
