// Master Procedural Terrain Generator Algorithm (2D Continents & Per-Biome Archipelagos)
// 100% Icon-Free, Zero-GC Optimized, Infinite Seed-Based Architecture

import * as THREE from 'three';
import { snoise } from './Noise.js';
import {
    ZONES,
    CONTINENTS,
    WORLD_LENGTH,
    wrapZ,
    wrapPeriodicDist,
    getBiomeWeights2D,
    getWorldSeed,
    seedOffsets
} from './BiomeManager.js';

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

export const biomeHeights = {
    'Archipelago': 1.0,
    'Ghibli Land': 0.85,
    'Misty Mountains': 1.0,
    'Lush Jungle': 1.0,
    'Crystal Land': 1.0,
    'Magical Sanctuary': 1.0,
    'Desert Dunes': 1.0,
    'North Pole': 1.0,
    'Open Ocean': 1.0
};

export const biomeScales = {
    'Archipelago': 1.0,
    'Ghibli Land': 1.0,
    'Misty Mountains': 1.0,
    'Lush Jungle': 1.0,
    'Crystal Land': 1.0,
    'Magical Sanctuary': 1.0,
    'Desert Dunes': 1.0,
    'North Pole': 1.0,
    'Open Ocean': 1.0
};

export const biomeWaterHeights = {
    'Archipelago': 2.4,
    'Ghibli Land': 2.4,
    'Misty Mountains': 2.4,
    'Lush Jungle': 2.4,
    'Crystal Land': 2.4,
    'Magical Sanctuary': 2.4,
    'Desert Dunes': 2.4,
    'North Pole': 2.4,
    'Open Ocean': 2.4
};

export const globalTerrainParams = {
    globalHeightMultiplier: 1.0,
    globalNoiseScale: 1.0
};

export function getWorldWaterHeight(worldX, worldZ) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;
    const wts = getBiomeWeights2D(wx, wz);
    let wh = 0;
    for (let i = 0; i < wts.length; i++) {
        const zn = ZONES[wts[i].idx];
        const baseWh = (biomeWaterHeights[zn.name] !== undefined) ? biomeWaterHeights[zn.name] : 2.4;
        wh += baseWh * wts[i].w;
    }
    return wh;
}

const _tempC1 = new THREE.Color();
const _tempC2 = new THREE.Color();
const _tempC3 = new THREE.Color();
const _oceanBedColor = new THREE.Color(0x0a1e3f);
const _shallowOceanColor = new THREE.Color(0x19a0c7);
const _shallowSandColor = new THREE.Color(0xd9c49a);

export const worldOriginOffset = new THREE.Vector2(0, 0);

export function setWorldOriginOffset(x, z) {
    worldOriginOffset.set(x, z);
}

// 2D Continent Mask and Archipelago Shelf Calculator (Zero-GC, 100% Seeded & Organic)
export function getContinentMask(worldX, worldZ) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;
    const wrappedZ = wrapZ(wz);

    // Multi-octave 2D Simplex Domain Warping
    const warpX = snoise((wx + seedOffsets.seedX1) * 0.00006, (wz + seedOffsets.seedZ1) * 0.00006) * 0.42 +
                  snoise((wx - seedOffsets.seedZ2) * 0.00018, (wz + seedOffsets.seedX2) * 0.00018) * 0.18;
    const warpZ = snoise((wx + seedOffsets.seedX2) * 0.00006, (wz - seedOffsets.seedZ1) * 0.00006) * 0.42 +
                  snoise((wx + seedOffsets.seedZ2) * 0.00018, (wz - seedOffsets.seedX1) * 0.00018) * 0.18;

    // Multi-octave Fractal Shape Noise (bays, fjords, capes, peninsulas)
    const shapeNoise = snoise((wx + seedOffsets.seedX3) * 0.000035, (wz + seedOffsets.seedZ3) * 0.000035) * 0.32 +
                       snoise((wx - seedOffsets.seedZ4) * 0.00011,  (wz + seedOffsets.seedX4) * 0.00011)  * 0.20 +
                       snoise((wx + seedOffsets.seedX5) * 0.00032,  (wz + seedOffsets.seedZ5) * 0.00032)  * 0.10;

    let maxRawMask = 0.0;
    let bestContinent = CONTINENTS[0];

    for (let i = 0; i < CONTINENTS.length; i++) {
        const c = CONTINENTS[i];
        const dx = (wx - c.cx) / c.rx;
        const dz = wrapPeriodicDist(wrappedZ - c.cz, WORLD_LENGTH) / c.rz;

        const dist = Math.hypot(dx + warpX, dz + warpZ);
        const falloff = smoothstep(1.35, 0.42, dist);
        const continentMask = Math.max(0.0, Math.min(1.0, (falloff + shapeNoise * falloff) * 1.15));

        if (continentMask > maxRawMask) {
            maxRawMask = continentMask;
            bestContinent = c;
        }
    }

    const rawMask = maxRawMask;

    // High-frequency fractal archipelago shelf noise
    const archN1 = snoise((wx + seedOffsets.seedX1) * 0.0012, (wz + seedOffsets.seedZ1) * 0.0012) * 0.38;
    const archN2 = snoise((wx - seedOffsets.seedZ2) * 0.0035 + 400.0, (wz + seedOffsets.seedX2) * 0.0035 + 400.0) * 0.14;
    const shelfMask = rawMask + (archN1 + archN2) * smoothstep(0.18, 0.55, rawMask);

    const isOceanChannel = (rawMask < 0.20 && shelfMask <= 0.48);

    return {
        rawMask,
        shelfMask,
        isOceanChannel,
        continent: bestContinent
    };
}

export function getBiomeAt(worldX, worldZ) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;
    const maskData = getContinentMask(worldX, worldZ);

    if (maskData.isOceanChannel) {
        return ZONES[8]; // Open Ocean
    }

    const wts = getBiomeWeights2D(wx, wz);
    let maxW = -1;
    let bestIdx = wts[0].idx;

    for (let i = 0; i < wts.length; i++) {
        if (wts[i].w > maxW) {
            maxW = wts[i].w;
            bestIdx = wts[i].idx;
        }
    }

    return ZONES[bestIdx] || ZONES[0];
}

// Biome-specific coastal elevation profile for satellite mini-islands
function getBiomeCoastalHeight(bName, wx, wz) {
    const s = snoise(wx * 0.004, wz * 0.004);
    const s2 = snoise(wx * 0.01 + 100, wz * 0.01 + 100) * 0.3;
    const n = Math.max(0, s + s2);

    if (bName.includes('Misty') || bName.includes('Mountain')) {
        // Jagged rocky sea-stacks
        return 12.0 + n * 48.0;
    } else if (bName.includes('Ghibli')) {
        // Rolling lush green islets and sandbars
        return 5.0 + n * 18.0;
    } else if (bName.includes('Jungle')) {
        // Tropical mangrove islets and coral cays
        return 5.0 + n * 20.0;
    } else if (bName.includes('Desert')) {
        // Barrier spits and sandy atolls
        return 3.5 + n * 12.0;
    } else if (bName.includes('North')) {
        // Ice shelves and glacier barrier rocks
        return 4.0 + n * 16.0;
    } else if (bName.includes('Crystal')) {
        // Crystal atolls and quartz reefs
        return 5.0 + n * 22.0;
    } else if (bName.includes('Magical')) {
        // Glowing violet plateaus
        return 6.0 + n * 24.0;
    }
    return 5.0 + n * 18.0;
}

export function getWorldHeight(worldX, worldZ) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;

    const maskData = getContinentMask(worldX, worldZ);
    const { rawMask, shelfMask } = maskData;

    // Base ocean bed floor (-6.0m to -4.5m)
    const oceanBed = snoise(wx * 0.0008, wz * 0.0008) * 1.5 - 5.5;

    // 1. Calculate active continental biome elevation
    const wts = getBiomeWeights2D(wx, wz);
    let biomeH = 0;
    let mainBiomeName = ZONES[wts[0].idx].name;

    for (let i = 0; i < wts.length; i++) {
        const zn = ZONES[wts[i].idx];
        const scale = ((biomeScales[zn.name] !== undefined) ? biomeScales[zn.name] : 1.0) * globalTerrainParams.globalNoiseScale;
        const hMult = ((biomeHeights[zn.name] !== undefined) ? biomeHeights[zn.name] : 1.0) * globalTerrainParams.globalHeightMultiplier;
        let rawH = 0;
        if (zn.module && typeof zn.module.getHeight === 'function') {
            rawH = zn.module.getHeight(wx * scale, wz * scale, snoise);
        } else {
            rawH = oceanBed;
        }
        biomeH += (rawH * hMult) * wts[i].w;
    }

    const coastH = getBiomeCoastalHeight(mainBiomeName, wx, wz);

    // 2. Smooth, continuous coastal profile (eliminates steep cliff stair-stepping at water level 2.4m)
    if (rawMask < 0.35) {
        // Deep Ocean or Archipelago Shelf Band
        if (shelfMask > 0.48) {
            // Satellite mini-island emerging smoothly above water level 2.4m
            const islandT = smoothstep(0.48, 0.70, shelfMask);
            return 2.4 + islandT * coastH;
        } else {
            // Submerged seabed / shallow shelf (smoothly reaches 2.4m water level at threshold)
            const shelfT = smoothstep(0.18, 0.48, shelfMask);
            return oceanBed + shelfT * (2.4 - oceanBed);
        }
    } else if (rawMask < 0.55) {
        // Coastal Beach & Shelf to Mainland Transition (gentle slope at waterline)
        const landFactor = smoothstep(0.35, 0.55, rawMask);
        const coastalLandH = 2.4 + landFactor * coastH;
        if (shelfMask > 0.48) {
            const islandT = smoothstep(0.48, 0.70, shelfMask);
            const shelfH = 2.4 + islandT * coastH;
            return (1.0 - landFactor) * shelfH + landFactor * coastalLandH;
        } else {
            const shelfT = smoothstep(0.18, 0.48, shelfMask);
            const submergedH = oceanBed + shelfT * (2.4 - oceanBed);
            return (1.0 - landFactor) * submergedH + landFactor * coastalLandH;
        }
    } else {
        // Mainland Continental Elevation
        const landFactor = smoothstep(0.55, 0.72, rawMask);
        const coastalLandH = 2.4 + coastH;
        return (1.0 - landFactor) * coastalLandH + landFactor * biomeH;
    }
}

export function getWorldColor(h, worldX, worldZ, targetColor) {
    const wx = worldX + worldOriginOffset.x;
    const wz = worldZ + worldOriginOffset.y;

    const maskData = getContinentMask(worldX, worldZ);
    const { rawMask, shelfMask } = maskData;

    // Submerged deep water / ocean bed with shallow wet sand shelf
    if (h < 2.4 && rawMask < 0.35 && shelfMask <= 0.48) {
        if (h < 0.5) {
            targetColor.copy(_oceanBedColor);
        } else if (h < 1.6) {
            targetColor.lerpColors(_oceanBedColor, _shallowOceanColor, smoothstep(0.5, 1.6, h));
        } else {
            targetColor.lerpColors(_shallowOceanColor, _shallowSandColor, smoothstep(1.6, 2.4, h));
        }
        return;
    }

    const wts = getBiomeWeights2D(wx, wz);
    if (wts.length === 1) {
        const zn = ZONES[wts[0].idx];
        if (zn.module && typeof zn.module.getColor === 'function') {
            zn.module.getColor(h, wx, wz, snoise, targetColor, smoothstep);
        } else {
            targetColor.copy(_oceanBedColor);
        }
        return;
    } else if (wts.length === 2) {
        const zn1 = ZONES[wts[0].idx];
        const zn2 = ZONES[wts[1].idx];
        if (zn1.module && typeof zn1.module.getColor === 'function') {
            zn1.module.getColor(h, wx, wz, snoise, _tempC1, smoothstep);
        } else {
            _tempC1.copy(_oceanBedColor);
        }
        if (zn2.module && typeof zn2.module.getColor === 'function') {
            zn2.module.getColor(h, wx, wz, snoise, _tempC2, smoothstep);
        } else {
            _tempC2.copy(_oceanBedColor);
        }
        targetColor.r = _tempC1.r * wts[0].w + _tempC2.r * wts[1].w;
        targetColor.g = _tempC1.g * wts[0].w + _tempC2.g * wts[1].w;
        targetColor.b = _tempC1.b * wts[0].w + _tempC2.b * wts[1].w;
        return;
    } else {
        const zn1 = ZONES[wts[0].idx];
        const zn2 = ZONES[wts[1].idx];
        const zn3 = ZONES[wts[2].idx];
        if (zn1.module && typeof zn1.module.getColor === 'function') {
            zn1.module.getColor(h, wx, wz, snoise, _tempC1, smoothstep);
        } else {
            _tempC1.copy(_oceanBedColor);
        }
        if (zn2.module && typeof zn2.module.getColor === 'function') {
            zn2.module.getColor(h, wx, wz, snoise, _tempC2, smoothstep);
        } else {
            _tempC2.copy(_oceanBedColor);
        }
        if (zn3.module && typeof zn3.module.getColor === 'function') {
            zn3.module.getColor(h, wx, wz, snoise, _tempC3, smoothstep);
        } else {
            _tempC3.copy(_oceanBedColor);
        }
        targetColor.r = _tempC1.r * wts[0].w + _tempC2.r * wts[1].w + _tempC3.r * wts[2].w;
        targetColor.g = _tempC1.g * wts[0].w + _tempC2.g * wts[1].w + _tempC3.g * wts[2].w;
        targetColor.b = _tempC1.b * wts[0].w + _tempC2.b * wts[1].w + _tempC3.b * wts[2].w;
        return;
    }
}

export function getIslandData(worldX, worldZ) {
    const biome = getBiomeAt(worldX, worldZ);
    const maskData = getContinentMask(worldX, worldZ);
    const { rawMask, shelfMask, isOceanChannel } = maskData;

    let effMask = 0.0;
    if (!isOceanChannel) {
        if (shelfMask > 0.48) {
            effMask = Math.max(0.6, smoothstep(0.48, 0.68, shelfMask));
        } else if (rawMask >= 0.35) {
            effMask = smoothstep(0.35, 0.55, rawMask);
        }
    }

    return {
        mask: effMask,
        rawMask,
        shelfMask,
        isOceanChannel,
        b1: biome,
        b2: biome,
        w1: 1.0,
        w2: 0.0,
        mainBiome: biome
    };
}

export function getPathStrength(x, z) {
    const scale = 0.002;
    const n1 = snoise(x * scale, z * scale);
    const n2 = snoise(x * scale * 2 + 1000, z * scale * 2 + 1000) * 0.3;
    let path = Math.abs(n1 + n2);
    let mask = smoothstep(0.15, 0.0, path);
    return mask;
}


