import * as THREE from 'three';

// Material types that are safe to swap — ShaderMaterial (water, sky, etc.) is excluded
const SWAPPABLE_TYPES = new Set([
    'MeshPhongMaterial',
    'MeshStandardMaterial',
    'MeshLambertMaterial',
    'MeshToonMaterial',
    'MeshBasicMaterial',
]);

export class ToonShaderManager {
    constructor() {
        this.mode = 'original';

        // Hard cel: 2-band gradient — stark shadow / full highlight
        const celColors = new Uint8Array(2);
        celColors[0] = 35;   // deep shadow
        celColors[1] = 255;  // full highlight
        this.celGradientMap = new THREE.DataTexture(celColors, 2, 1, THREE.RedFormat);
        this.celGradientMap.needsUpdate = true;
        this.celGradientMap.minFilter = THREE.NearestFilter;
        this.celGradientMap.magFilter = THREE.NearestFilter;
    }

    apply(scene, mode) {
        this.mode = mode;

        scene.traverse((child) => {
            if (!child.isMesh) return;

            const isArray = Array.isArray(child.material);
            const mats = isArray ? child.material : [child.material];

            const newMats = mats.map((mat, i) => {
                if (!mat) return mat;

                // Save the very first (original) material per slot
                if (!child.userData._origMats) child.userData._origMats = {};
                if (!child.userData._origMats[i]) child.userData._origMats[i] = mat;

                const orig = child.userData._origMats[i];

                // Never touch ShaderMaterial (water, sky, particles, etc.)
                if (!SWAPPABLE_TYPES.has(orig.type)) return orig;

                if (mode === 'original') return orig;

                const base = {
                    color: orig.color ? orig.color.clone() : new THREE.Color(1, 1, 1),
                    map: orig.map ?? null,
                    vertexColors: orig.vertexColors ?? false,
                    transparent: orig.transparent ?? false,
                    opacity: orig.opacity ?? 1,
                    side: orig.side ?? THREE.FrontSide,
                    alphaTest: orig.alphaTest ?? 0,
                };

                if (mode === 'cel') {
                    return new THREE.MeshToonMaterial({
                        ...base,
                        gradientMap: this.celGradientMap,
                    });
                }

                if (mode === 'flat') {
                    return new THREE.MeshBasicMaterial(base);
                }

                return orig;
            });

            child.material = isArray ? newMats : newMats[0];
        });
    }

    // Backward-compat shim for old toggle(scene, bool) call sites
    toggle(scene, enable) {
        this.apply(scene, enable ? 'cel' : 'original');
    }
}
