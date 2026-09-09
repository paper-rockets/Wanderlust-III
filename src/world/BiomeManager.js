// Biome Manager & Adjacency Matrix (100% Icon-Free, Zero-GC Optimized)
// Seed-Based Infinite 2D Continents and Organic Voronoi Realm Architecture

import terrainArch from './biomes/terrain-archipelago.js';
import terrainGhibli from './biomes/terrain-ghibli.js';
import terrainMtn from './biomes/terrain-mountains.js';
import terrainJungle from './biomes/terrain-jungle.js';
import terrainCrystal from './biomes/terrain-crystal.js';
import terrainMagical from './biomes/terrain-magical.js';
import terrainDesert from './biomes/terrain-desert.js';
import terrainNorthPole from './biomes/terrain-northpole.js';
import { snoise } from './Noise.js';

// Procedural session seed - generated fresh on each load or configured by user
let _worldSeed = Math.floor(Math.random() * 1000000);

export const WORLD_LENGTH = 215000;
export const BLEND_WIDTH  = 3000;

export function wrapZ(worldZ) {
    return ((worldZ % WORLD_LENGTH) + WORLD_LENGTH) % WORLD_LENGTH;
}

export function wrapPeriodicDist(delta, period) {
    let pd = delta % period;
    if (pd > period * 0.5) pd -= period;
    if (pd < -period * 0.5) pd += period;
    return pd;
}

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

// Deterministic PRNG for Seeded World Layout
function createPRNG(seed) {
    let t = (seed + 0x6D2B79F5) | 0;
    return function() {
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const oceanModule = {
    name: 'Open Ocean',
    getHeight(x, z, snoise) {
        return snoise(x * 0.0008, z * 0.0008) * 1.5 - 6.0;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        tempColor.setHex(0x1a4a8c);
    }
};

export const ZONES = [
    // 0: Ghibli Land (The Fantasy Realm)
    { id: 0, name: 'Ghibli Land',         module: terrainGhibli,    treesOk: true,  continentId: 0, isOcean: false },
    // 1: Magical Sanctuary (The Fantasy Realm)
    { id: 1, name: 'Magical Sanctuary',   module: terrainMagical,   treesOk: false, continentId: 0, isOcean: false },
    // 2: Crystal Land (The Fantasy Realm)
    { id: 2, name: 'Crystal Land',        module: terrainCrystal,   treesOk: false, continentId: 0, isOcean: false },
    // 3: Lush Jungle (The Wilds)
    { id: 3, name: 'Lush Jungle',         module: terrainJungle,    treesOk: false, continentId: 1, isOcean: false },
    // 4: Misty Mountains (The Wilds)
    { id: 4, name: 'Misty Mountains',     module: terrainMtn,       treesOk: false, continentId: 1, isOcean: false },
    // 5: Desert Dunes (The Arid Expanse)
    { id: 5, name: 'Desert Dunes',        module: terrainDesert,    treesOk: false, continentId: 2, isOcean: false },
    // 6: North Pole (The Frozen Isle)
    { id: 6, name: 'North Pole',          module: terrainNorthPole, treesOk: false, continentId: 3, isOcean: false },
    // 7: Archipelago Shelf (Coastal Satellite Islands)
    { id: 7, name: 'Archipelago',         module: terrainArch,      treesOk: false, continentId: -1, isOcean: false },
    // 8: Open Ocean (Inter-Continental Ocean Channels)
    { id: 8, name: 'Open Ocean',          module: oceanModule,      treesOk: false, continentId: -1, isOcean: true }
];

export let CONTINENTS = [];

// Seed offset caches
export let seedOffsets = {
    seedX1: 123.4, seedZ1: 567.8,
    seedX2: 890.1, seedZ2: 234.5,
    seedX3: 456.7, seedZ3: 789.0,
    seedX4: 321.9, seedZ4: 654.3,
    seedX5: 987.6, seedZ5: 543.2
};

function rebuildProceduralContinents(seed) {
    const rng = createPRNG(seed);

    seedOffsets.seedX1 = (seed % 1000) * 17.31 + 123.4;
    seedOffsets.seedZ1 = (((seed / 1000) | 0) % 1000) * 23.77 + 567.8;
    seedOffsets.seedX2 = ((seed * 7) % 1000) * 19.41 + 890.1;
    seedOffsets.seedZ2 = (((seed * 13) / 1000 | 0) % 1000) * 31.13 + 234.5;
    seedOffsets.seedX3 = ((seed * 17) % 1000) * 29.17 + 456.7;
    seedOffsets.seedZ3 = (((seed * 19) / 1000 | 0) % 1000) * 11.23 + 789.0;
    seedOffsets.seedX4 = ((seed * 23) % 1000) * 13.87 + 321.9;
    seedOffsets.seedZ4 = (((seed * 29) / 1000 | 0) % 1000) * 37.49 + 654.3;
    seedOffsets.seedX5 = ((seed * 31) % 1000) * 27.63 + 987.6;
    seedOffsets.seedZ5 = (((seed * 37) / 1000 | 0) % 1000) * 41.81 + 543.2;

    CONTINENTS = [
        // Continent 0: The Fantasy Realm (50,000 to 65,000 across)
        {
            id: 0,
            name: 'The Fantasy Realm',
            cx: (rng() - 0.5) * 2000,
            cz: 28000 + (rng() - 0.5) * 2000,
            rx: 26000 + rng() * 4000, // 52,000 to 60,000 width
            rz: 28000 + rng() * 4000, // 56,000 to 64,000 length
            subBiomes: [
                { zoneId: 0, name: 'Ghibli Land',       relX: -5000 + (rng() - 0.5) * 2000, relZ: -7000 + (rng() - 0.5) * 2000 },
                { zoneId: 1, name: 'Magical Sanctuary', relX:  6000 + (rng() - 0.5) * 2000, relZ:  1000 + (rng() - 0.5) * 2000 },
                { zoneId: 2, name: 'Crystal Land',      relX: -2500 + (rng() - 0.5) * 2000, relZ:  7000 + (rng() - 0.5) * 2000 }
            ]
        },
        // Continent 1: The Wilds (35,000 to 50,000 across)
        {
            id: 1,
            name: 'The Wilds',
            cx: (rng() - 0.5) * 6000,
            cz: 93000 + (rng() - 0.5) * 5000,
            rx: 19000 + rng() * 5000, // 38,000 to 48,000 width
            rz: 21000 + rng() * 5000, // 42,000 to 52,000 length
            subBiomes: [
                { zoneId: 3, name: 'Lush Jungle',     relX: -4500 + (rng() - 0.5) * 3500, relZ: -6000 + (rng() - 0.5) * 3500 },
                { zoneId: 4, name: 'Misty Mountains', relX:  4500 + (rng() - 0.5) * 3500, relZ:  7000 + (rng() - 0.5) * 3500 }
            ]
        },
        // Continent 2: The Arid Expanse (25,000 to 35,000 across)
        {
            id: 2,
            name: 'The Arid Expanse',
            cx: (rng() - 0.5) * 5000,
            cz: 147000 + (rng() - 0.5) * 4500,
            rx: 13500 + rng() * 3500, // 27,000 to 34,000 width
            rz: 14500 + rng() * 3500, // 29,000 to 36,000 length
            subBiomes: [
                { zoneId: 5, name: 'Desert Dunes', relX: 0, relZ: 0 }
            ]
        },
        // Continent 3: The Frozen Isle (20,000 to 30,000 across)
        {
            id: 3,
            name: 'The Frozen Isle',
            cx: (rng() - 0.5) * 5000,
            cz: 188000 + (rng() - 0.5) * 4000,
            rx: 11000 + rng() * 3500, // 22,000 to 29,000 width
            rz: 12500 + rng() * 3500, // 25,000 to 32,000 length
            subBiomes: [
                { zoneId: 6, name: 'North Pole', relX: 0, relZ: 0 }
            ]
        }
    ];
}

// Initial build
rebuildProceduralContinents(_worldSeed);

export function getWorldSeed() {
    return _worldSeed;
}

export function setWorldSeed(seed) {
    _worldSeed = Number(seed) || 0;
    rebuildProceduralContinents(_worldSeed);
}

// Pre-allocated static buffers to avoid GC allocations in hot loop
const _resultOne = [{ idx: 0, w: 1.0, t: 0.0 }];
const _resultTwo = [
    { idx: 0, w: 1.0, t: 0.0 },
    { idx: 0, w: 0.0, t: 0.0 }
];
const _resultThree = [
    { idx: 0, w: 1.0, t: 0.0 },
    { idx: 0, w: 0.0, t: 0.0 },
    { idx: 0, w: 0.0, t: 0.0 }
];

export function getNearestContinent(worldX, worldZ) {
    const wz = wrapZ(worldZ);
    let bestDistSq = Infinity;
    let bestContinent = CONTINENTS[0];

    for (let i = 0; i < CONTINENTS.length; i++) {
        const c = CONTINENTS[i];
        const dx = (worldX - c.cx) / c.rx;
        const dz = wrapPeriodicDist(wz - c.cz, WORLD_LENGTH) / c.rz;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestContinent = c;
        }
    }
    return { continent: bestContinent, distSq: bestDistSq };
}

// 2D Organic Voronoi Sub-Biome Weight Evaluator (Zero-GC)
export function getBiomeWeights2D(worldX, worldZ) {
    const wz = wrapZ(worldZ);
    const { continent } = getNearestContinent(worldX, worldZ);

    if (continent.id === 0) {
        // The Fantasy Realm: 3 sub-biomes with 2D Simplex Domain Warping
        const warpX = snoise((worldX + seedOffsets.seedX1) * 0.00008, (wz + seedOffsets.seedZ1) * 0.00008) * 5500 +
                      snoise((worldX - seedOffsets.seedZ2) * 0.00022, (wz + seedOffsets.seedX2) * 0.00022) * 2200;
        const warpZ = snoise((worldX + seedOffsets.seedX2) * 0.00008, (wz - seedOffsets.seedZ1) * 0.00008) * 5500 +
                      snoise((worldX + seedOffsets.seedZ2) * 0.00022, (wz - seedOffsets.seedX1) * 0.00022) * 2200;

        const px = worldX + warpX;
        const pz = wz + warpZ;

        const b0 = continent.subBiomes[0];
        const b1 = continent.subBiomes[1];
        const b2 = continent.subBiomes[2];

        const d0 = Math.hypot(px - (continent.cx + b0.relX), wrapPeriodicDist(pz - (continent.cz + b0.relZ), WORLD_LENGTH));
        const d1 = Math.hypot(px - (continent.cx + b1.relX), wrapPeriodicDist(pz - (continent.cz + b1.relZ), WORLD_LENGTH));
        const d2 = Math.hypot(px - (continent.cx + b2.relX), wrapPeriodicDist(pz - (continent.cz + b2.relZ), WORLD_LENGTH));

        const p = 2.8;
        const inv0 = 1.0 / (Math.pow(d0 / 12000.0, p) + 0.0001);
        const inv1 = 1.0 / (Math.pow(d1 / 12000.0, p) + 0.0001);
        const inv2 = 1.0 / (Math.pow(d2 / 12000.0, p) + 0.0001);

        const sum = inv0 + inv1 + inv2;
        const w0 = inv0 / sum;
        const w1 = inv1 / sum;
        const w2 = inv2 / sum;

        _resultThree[0].idx = b0.zoneId;
        _resultThree[0].w = w0;
        _resultThree[0].t = 0.0;

        _resultThree[1].idx = b1.zoneId;
        _resultThree[1].w = w1;
        _resultThree[1].t = 0.0;

        _resultThree[2].idx = b2.zoneId;
        _resultThree[2].w = w2;
        _resultThree[2].t = 0.0;

        return _resultThree;
    } else if (continent.id === 1) {
        // The Wilds: Jungle & Misty Mountains with Organic Ridge Warping
        const warpW = snoise((worldX + seedOffsets.seedX3) * 0.00008, (wz + seedOffsets.seedZ3) * 0.00008) * 0.38 +
                      snoise((worldX - seedOffsets.seedZ4) * 0.00022, (wz + seedOffsets.seedX4) * 0.00022) * 0.16;

        const bJungle = continent.subBiomes[0];
        const bMtn = continent.subBiomes[1];

        const dJungle = Math.hypot(worldX - (continent.cx + bJungle.relX), wrapPeriodicDist(wz - (continent.cz + bJungle.relZ), WORLD_LENGTH));
        const dMtn    = Math.hypot(worldX - (continent.cx + bMtn.relX), wrapPeriodicDist(wz - (continent.cz + bMtn.relZ), WORLD_LENGTH));

        const diff = (dJungle - dMtn) / (continent.rx * 0.70) + warpW;
        const wMtn = smoothstep(-0.30, 0.30, diff);
        const wJungle = 1.0 - wMtn;

        _resultTwo[0].idx = bJungle.zoneId;
        _resultTwo[0].w = wJungle;
        _resultTwo[0].t = 0.0;

        _resultTwo[1].idx = bMtn.zoneId;
        _resultTwo[1].w = wMtn;
        _resultTwo[1].t = 0.0;

        return _resultTwo;
    } else if (continent.id === 2) {
        // The Arid Expanse: Desert Dunes
        _resultOne[0].idx = 5;
        _resultOne[0].w = 1.0;
        _resultOne[0].t = 0.0;
        return _resultOne;
    } else {
        // The Frozen Isle: North Pole
        _resultOne[0].idx = 6;
        _resultOne[0].w = 1.0;
        _resultOne[0].t = 0.0;
        return _resultOne;
    }
}

// Backward compatible wrapper
export function zoneWeights(worldZ, worldX = 0) {
    return getBiomeWeights2D(worldX, worldZ);
}

export function getBiomeTeleportCoords(biomeName) {
    for (let i = 0; i < CONTINENTS.length; i++) {
        const c = CONTINENTS[i];
        for (let j = 0; j < c.subBiomes.length; j++) {
            const sb = c.subBiomes[j];
            if (sb.name.toLowerCase() === biomeName.toLowerCase() ||
                ZONES[sb.zoneId].name.toLowerCase() === biomeName.toLowerCase()) {
                return { x: c.cx + sb.relX, z: c.cz + sb.relZ };
            }
        }
    }
    if (biomeName.toLowerCase().includes('ocean')) {
        return { x: 0, z: 65000 };
    }
    return { x: 0, z: 28000 };
}

export function getContinentLabels() {
    return CONTINENTS.map(c => ({
        name: c.name.toUpperCase(),
        x: c.cx,
        z: c.cz
    }));
}

