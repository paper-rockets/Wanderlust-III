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

export default {
    name: "Ghibli Land",
    shoreName: "Continental Shore",
    getHeight(x, z, snoise) {
        let y = snoise(x * 0.0015, z * 0.0015) * 90.0 + snoise(x * 0.005, z * 0.005) * 35.0 + snoise(x * 0.009, z * 0.009) * 6.0;
        if (y < 12.0) y = (y - 12.0) * 0.25 + 12.0;
        
        // Smooth continuous river channels (broadened to eliminate 1-vertex notch artifacts)
        const rn = snoise(x * 0.0015 + 100.0, z * 0.0015 + 100.0);
        const rw = snoise(x * 0.004, z * 0.004) * 0.015;
        const rd = Math.abs(rn + rw);
        if (rd < 0.11) { 
            let c = 1.0 - rd / 0.11; 
            c = c * c * (3.0 - 2.0 * c); 
            y -= c * 13.0; 
        }
        
        // Smooth broad lakes with clean concave basins
        const ln = snoise(x * 0.0015 - 500.0, z * 0.0015 + 500.0);
        if (ln > 0.65) {
            const d = Math.min((ln - 0.65) * 2.5, 1.0); 
            let c = d * d * (3.0 - 2.0 * d); 
            y -= c * 16.0; 
        }

        // Natural continuous shoreline slope (eliminates flat 6m terrace shelf)
        if (y < 3.5) {
            const t = Math.max(0.0, Math.min(1.0, (y + 4.0) / 7.5));
            const st = t * t * (3.0 - 2.0 * t);
            y = -4.0 + st * 7.5;
        }

        return y;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const meadowNoise = snoise(x * 0.0035, z * 0.0035);
        const oliveNoise = snoise(x * 0.008 + 200, z * 0.008 + 200);

        // Underwater shallow sand to dry land grass progression
        if (h < -1.5) {
            tempColor.copy(colorDeepWater);
        } else if (h < 0.5) {
            tempColor.lerpColors(colorDeepWater, colorWetSand, smoothstep(-1.5, 0.5, h));
        } else if (h < 2.4) {
            tempColor.lerpColors(colorWetSand, colorSand, smoothstep(0.5, 2.4, h));
        } else if (h < 4.5) {
            tempColor.copy(colorSand);
        } else if (h < 9.0) {
            tempColor.lerpColors(colorSand, colorIslandGrass, smoothstep(4.5, 9.0, h));
        } else if (h < 25) {
            const patchColor = colorIslandGrass.clone();
            if (meadowNoise > 0.15) patchColor.lerp(colorEmeraldGrass, Math.min(1, (meadowNoise - 0.15) * 2.5));
            if (oliveNoise > 0.2) patchColor.lerp(colorOliveGrass, Math.min(1, (oliveNoise - 0.2) * 2.5));
            tempColor.lerpColors(patchColor, colorHigh, smoothstep(9.0, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
