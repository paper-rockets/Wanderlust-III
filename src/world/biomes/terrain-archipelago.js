import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorWetSand = new THREE.Color(0xd9c49a);
const colorSand = new THREE.Color(0xf2e1b8);
const colorIslandGrass = new THREE.Color(0x76d149);
const colorEmeraldGrass = new THREE.Color(0x56b847);
const colorOliveGrass = new THREE.Color(0x8cc440);
const colorHigh = new THREE.Color(0x89e05e);
const colorIslandRock = new THREE.Color(0x8a725a);
const colorDirt = new THREE.Color(0xdcb58a);

// Static pre-allocated color buffer for Zero-GC vertex shading
const _tempPatchColor = new THREE.Color();

export const PRESETS = {
    tropical_chain: [
        { id: 'isl_1', name: 'Grand Atoll', x: 0, z: 8000, radius: 780, heightScale: 1.45, karstScale: 1.35, roughness: 1.20, riverDepth: 0.95, seed: 4521 },
        { id: 'isl_2', name: 'Emerald Cay', x: 1100, z: 8700, radius: 520, heightScale: 1.10, karstScale: 0.80, roughness: 1.05, riverDepth: 0.65, seed: 202 },
        { id: 'isl_3', name: 'Palm Spire', x: -1050, z: 8800, radius: 480, heightScale: 1.30, karstScale: 1.50, roughness: 1.15, riverDepth: 0.50, seed: 303 },
        { id: 'isl_4', name: 'Lagoon Reef', x: 650, z: 7100, radius: 430, heightScale: 0.95, karstScale: 0.60, roughness: 0.95, riverDepth: 0.75, seed: 404 },
        { id: 'isl_5', name: 'Outer Isle', x: -850, z: 7000, radius: 400, heightScale: 0.90, karstScale: 0.50, roughness: 0.90, riverDepth: 0.45, seed: 505 }
    ],
    volcano: [
        { id: 'isl_v1', name: 'Volcano Peak', x: -500, z: 7800, radius: 820, heightScale: 2.20, karstScale: 2.10, roughness: 1.30, riverDepth: 1.00, seed: 777 },
        { id: 'isl_v2', name: 'Caldera Ridge', x: 500, z: 8200, radius: 620, heightScale: 1.55, karstScale: 1.60, roughness: 1.20, riverDepth: 0.80, seed: 888 },
        { id: 'isl_v3', name: 'Lava Shelf', x: 1150, z: 8650, radius: 450, heightScale: 1.00, karstScale: 0.85, roughness: 1.10, riverDepth: 0.50, seed: 999 }
    ],
    paradise: [
        { id: 'isl_p1', name: 'Twin Island A', x: -650, z: 8000, radius: 680, heightScale: 1.30, karstScale: 1.10, roughness: 1.15, riverDepth: 0.85, seed: 331 },
        { id: 'isl_p2', name: 'Twin Island B', x: 650, z: 8000, radius: 680, heightScale: 1.30, karstScale: 1.10, roughness: 1.15, riverDepth: 0.85, seed: 332 },
        { id: 'isl_p3', name: 'Sand Spit Cay', x: 0, z: 8950, radius: 420, heightScale: 0.75, karstScale: 0.30, roughness: 0.85, riverDepth: 0.35, seed: 333 }
    ],
    atoll: [
        { id: 'isl_a1', name: 'Atoll Ring 1', x: 0, z: 9100, radius: 460, heightScale: 0.95, karstScale: 0.60, roughness: 1.00, riverDepth: 0.50, seed: 1001 },
        { id: 'isl_a2', name: 'Atoll Ring 2', x: 950, z: 8550, radius: 460, heightScale: 0.95, karstScale: 0.60, roughness: 1.00, riverDepth: 0.50, seed: 1002 },
        { id: 'isl_a3', name: 'Atoll Ring 3', x: 950, z: 7450, radius: 460, heightScale: 0.95, karstScale: 0.60, roughness: 1.00, riverDepth: 0.50, seed: 1003 },
        { id: 'isl_a4', name: 'Atoll Ring 4', x: 0, z: 6900, radius: 460, heightScale: 0.95, karstScale: 0.60, roughness: 1.00, riverDepth: 0.50, seed: 1004 },
        { id: 'isl_a5', name: 'Atoll Ring 5', x: -950, z: 7450, radius: 460, heightScale: 0.95, karstScale: 0.60, roughness: 1.00, riverDepth: 0.50, seed: 1005 },
        { id: 'isl_a6', name: 'Atoll Ring 6', x: -950, z: 8550, radius: 460, heightScale: 0.95, karstScale: 0.60, roughness: 1.00, riverDepth: 0.50, seed: 1006 }
    ],
    grand_atoll: [
        { id: 'isl_1', name: 'Grand Atoll', x: 0, z: 8000, radius: 950, heightScale: 1.50, karstScale: 1.40, roughness: 1.25, riverDepth: 1.00, seed: 4521 }
    ]
};

// Live active island database
export let activeIslands = JSON.parse(JSON.stringify(PRESETS.tropical_chain));

export function setArchipelagoPreset(presetName) {
    if (PRESETS[presetName]) {
        activeIslands = JSON.parse(JSON.stringify(PRESETS[presetName]));
        saveArchipelagoToStorage();
        return true;
    }
    return false;
}

export function saveArchipelagoToStorage() {
    try {
        localStorage.setItem('wanderlust_archipelago_islands', JSON.stringify(activeIslands));
    } catch (e) {
        // Storage fallback
    }
}

export function loadArchipelagoFromStorage() {
    try {
        const raw = localStorage.getItem('wanderlust_archipelago_islands');
        if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
                activeIslands = data;
                return true;
            }
        }
    } catch (e) {
        // Fallback
    }
    return false;
}

// Initial storage load
loadArchipelagoFromStorage();

export default {
    name: "Water Archipelago",
    shoreName: "Water Archipelago",
    PRESETS,
    get activeIslands() { return activeIslands; },
    set activeIslands(val) { activeIslands = val; },
    setArchipelagoPreset,
    saveArchipelagoToStorage,
    loadArchipelagoFromStorage,

    getHeight(x, z, snoise, zone) {
        // Base ocean floor (-6.0m to -4.5m)
        const oceanFloor = snoise(x * 0.0008, z * 0.0008) * 1.5 - 5.5;
        let maxIslandH = 0;

        for (let i = 0; i < activeIslands.length; i++) {
            const isl = activeIslands[i];
            const dx = x - isl.x;
            const dz = z - isl.z;
            const dist = Math.hypot(dx, dz);
            const u = dist / isl.radius;
            if (u >= 1.35) continue;

            const radial = Math.max(0.0, 1.0 - Math.pow(u, 1.7));
            if (radial <= 0.001) continue;

            const s = isl.seed || 100;
            // Multi-frequency noise sampling
            const nBase = snoise(x * 0.0018 + s * 0.1, z * 0.0018 - s * 0.1) * 34.0;
            const nHills = snoise(x * 0.0045 + 100, z * 0.0045 + 400 + s * 0.2) * 18.0;
            const nDetail = snoise(x * 0.011 + 300, z * 0.011 + 600 + s * 0.3) * 5.0;

            // Mangrove river / lagoon carving
            const riverN = Math.abs(snoise(x * 0.0028 + 250, z * 0.0028 - 250 + s * 0.4));
            let riverCarve = 0;
            if (riverN < 0.16) {
                const t = 1.0 - (riverN / 0.16);
                riverCarve = (t * t * (3.0 - 2.0 * t)) * 18.0 * (isl.riverDepth !== undefined ? isl.riverDepth : 0.8);
            }

            // Karst limestone pinnacles
            const karstN = snoise(x * 0.0038 - 500, z * 0.0038 + 500 + s * 0.5);
            let karstElevation = 0;
            if (karstN > 0.30) {
                const k = Math.max(0, Math.min(1, (karstN - 0.30) / (0.72 - 0.30)));
                karstElevation = (k * k * (3.0 - 2.0 * k)) * 42.0 * (isl.karstScale !== undefined ? isl.karstScale : 1.1);
            }

            const rawH = (nBase + nHills + nDetail) * (isl.roughness !== undefined ? isl.roughness : 1.15) - riverCarve + karstElevation + 18.0;
            const islandH = rawH * radial * (isl.heightScale !== undefined ? isl.heightScale : 1.25);
            if (islandH > maxIslandH) maxIslandH = islandH;
        }

        if (maxIslandH <= 0.001) {
            return oceanFloor;
        }

        // Hermite slope from seabed to sandy beach and highlands
        let y = oceanFloor;
        if (maxIslandH < 4.5) {
            const t = maxIslandH / 4.5;
            const smoothT = t * t * (3.0 - 2.0 * t);
            y = -2.5 + smoothT * 7.0; // -2.5m up to 4.5m
        } else {
            y = maxIslandH;
        }

        return y;
    },

    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const meadowNoise = snoise(x * 0.0035, z * 0.0035);
        const oliveNoise = snoise(x * 0.008 + 200, z * 0.008 + 200);

        if (h < -1.5) {
            tempColor.copy(colorDeepWater);
        } else if (h < 0.5) {
            tempColor.lerpColors(colorDeepWater, colorWetSand, smoothstep(-1.5, 0.5, h));
        } else if (h < 2.4) {
            tempColor.lerpColors(colorWetSand, colorSand, smoothstep(0.5, 2.4, h));
        } else if (h < 4.5) {
            tempColor.copy(colorSand);
        } else if (h < 10.0) {
            tempColor.lerpColors(colorSand, colorIslandGrass, smoothstep(4.5, 10.0, h));
        } else if (h < 25) {
            _tempPatchColor.copy(colorIslandGrass);
            if (meadowNoise > 0.15) _tempPatchColor.lerp(colorEmeraldGrass, Math.min(1, (meadowNoise - 0.15) * 2.5));
            if (oliveNoise > 0.2) _tempPatchColor.lerp(colorOliveGrass, Math.min(1, (oliveNoise - 0.2) * 2.5));
            tempColor.lerpColors(_tempPatchColor, colorHigh, smoothstep(10.0, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
