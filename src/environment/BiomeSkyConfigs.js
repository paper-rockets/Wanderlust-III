export const BIOME_SKY_CONFIGS = {
    'Ghibli Land': {
        coverage: 0.45, edge: 0.06, speed: 0.018,
        skyZenith: 0x3a88d6, skyHorizon: 0xb8daf2,
        cloudCol: 0xfffcf5, cloudShadow: 0x8ca4c8,
        turbulence: 0.0, stormDarken: 0.0
    },
    'Magical Sanctuary': {
        coverage: 0.38, edge: 0.06, speed: 0.014,
        skyZenith: 0x5e35b1, skyHorizon: 0xce93d8,
        cloudCol: 0xf8eefa, cloudShadow: 0x8e58a8,
        turbulence: 0.0, stormDarken: 0.0
    },
    'Crystal Land': {
        coverage: 0.25, edge: 0.05, speed: 0.01,
        skyZenith: 0x5a4a98, skyHorizon: 0xc4aee8,
        cloudCol: 0xf0e4fa, cloudShadow: 0x8878ac,
        turbulence: 0.0, stormDarken: 0.0
    },
    'Open Ocean': {
        coverage: 0.30, edge: 0.07, speed: 0.022,
        skyZenith: 0x3078c8, skyHorizon: 0xa4d0ee,
        cloudCol: 0xfff8f0, cloudShadow: 0x88a0b8,
        turbulence: 0.0, stormDarken: 0.0
    },
    'Lush Jungle': {
        coverage: 0.55, edge: 0.08, speed: 0.012,
        skyZenith: 0x4a94cc, skyHorizon: 0xa0d4b0,
        cloudCol: 0xf0f8f0, cloudShadow: 0x80a088,
        turbulence: 0.0, stormDarken: 0.05
    },
    'Misty Mountains': {
        coverage: 0.60, edge: 0.10, speed: 0.015,
        skyZenith: 0x5078a8, skyHorizon: 0xa8c4d8,
        cloudCol: 0xf0f4f8, cloudShadow: 0x8090a4,
        turbulence: 0.0, stormDarken: 0.05
    },
    'Desert Dunes': {
        coverage: 0.08, edge: 0.10, speed: 0.008,
        skyZenith: 0xb89848, skyHorizon: 0xf4dcac,
        cloudCol: 0xfff0d8, cloudShadow: 0xb49870,
        turbulence: 0.0, stormDarken: 0.0
    },
    'North Pole': {
        coverage: 0.50, edge: 0.10, speed: 0.01,
        skyZenith: 0x78a8c8, skyHorizon: 0xd8e8f8,
        cloudCol: 0xf4f8fc, cloudShadow: 0x94a8bc,
        turbulence: 0.0, stormDarken: 0.0
    },
    'Archipelago': {
        coverage: 0.40, edge: 0.07, speed: 0.02,
        skyZenith: 0x3a88d6, skyHorizon: 0xb8daf2,
        cloudCol: 0xfffcf5, cloudShadow: 0x8ca4c8,
        turbulence: 0.0, stormDarken: 0.0
    }
};

export const WEATHER_PRESETS = {
    clear:    { coverage: null, edge: null, speed: null, turbulence: 0.0, stormDarken: 0.0 },
    storm:    { coverage: 0.78, edge: 0.15, speed: 0.08, turbulence: 1.0, stormDarken: 0.5 },
    overcast: { coverage: 0.82, edge: 0.20, speed: 0.01, turbulence: 0.0, stormDarken: 0.25 },
};
