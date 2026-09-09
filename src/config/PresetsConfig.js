export const DEFAULT_PRESETS = {
    'Golden Hour Dusk (Default)': {
        name: 'Golden Hour Dusk (Default)',
        timePhase: 1,
        sunAltitude: 160,
        envConfigs: [
            { name: 'Day', bg: 0x3a88d6, mid: 0x72b2e8, fog: 0xb8daf2, amb: 0xd8eefa, dir: 0xfffbf0, ambI: 1.25, dirI: 2.50, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffcf5 },
            { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.10, dirI: 3.20, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
            { name: 'Twilight', bg: 0x080d1e, mid: 0x121e3d, fog: 0x14223d, amb: 0x485878, dir: 0xd8e8ff, ambI: 0.95, dirI: 2.00, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x88b0e8, cloudCol: 0x162238 }
        ],
        params: {
            sceneFog: true,
            fogIntensity: 1.0,
            fogNear: 150,
            fogFar: 3000,
            fogDensity: 0.75,
            sunAltitude: 160,
            godRays: true,
            godRayIntensity: 0.60,
            godRayDecay: 0.92,
            bloom: true,
            skyRenderMode: 'Gradient + Clouds'
        }
    },
    'Bright Daylight (Noon)': {
        name: 'Bright Daylight (Noon)',
        timePhase: 0,
        sunAltitude: 10000,
        envConfigs: [
            { name: 'Day', bg: 0x3a88d6, mid: 0x72b2e8, fog: 0xb8daf2, amb: 0xd8eefa, dir: 0xfffbf0, ambI: 1.25, dirI: 2.50, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffcf5 },
            { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.10, dirI: 3.20, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
            { name: 'Twilight', bg: 0x080d1e, mid: 0x121e3d, fog: 0x14223d, amb: 0x485878, dir: 0xd8e8ff, ambI: 0.95, dirI: 2.00, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x88b0e8, cloudCol: 0x162238 }
        ],
        params: {
            sceneFog: true,
            fogIntensity: 1.0,
            fogNear: 180,
            fogFar: 3200,
            fogDensity: 0.70,
            sunAltitude: 10000,
            godRays: true,
            godRayIntensity: 0.50,
            godRayDecay: 0.90,
            bloom: true,
            skyRenderMode: 'Gradient + Clouds'
        }
    },
    'Midnight Moonlight (Twilight)': {
        name: 'Midnight Moonlight (Twilight)',
        timePhase: 2,
        sunAltitude: -8000,
        envConfigs: [
            { name: 'Day', bg: 0x3a88d6, mid: 0x72b2e8, fog: 0xb8daf2, amb: 0xd8eefa, dir: 0xfffbf0, ambI: 1.25, dirI: 2.50, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffcf5 },
            { name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.10, dirI: 3.20, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec },
            { name: 'Twilight', bg: 0x080d1e, mid: 0x121e3d, fog: 0x14223d, amb: 0x485878, dir: 0xd8e8ff, ambI: 0.95, dirI: 2.00, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x88b0e8, cloudCol: 0x162238 }
        ],
        params: {
            sceneFog: true,
            fogIntensity: 1.0,
            fogNear: 160,
            fogFar: 2800,
            fogDensity: 0.75,
            sunAltitude: -8000,
            godRays: false,
            bloom: true,
            skyRenderMode: 'Gradient + Clouds'
        }
    }
};
