import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorWetSand = new THREE.Color(0xd9c49a);
const colorSand = new THREE.Color(0xf2e1b8);
const colorMountainGrass = new THREE.Color(0x4b7043); // Dark alpine green
const colorMountainRock = new THREE.Color(0x5a5e6b);  // Slate grey rock
const colorSnow = new THREE.Color(0xf5f6fa);          // Crisp snow white

// Domain rotation matrix to eliminate grid-aligned saw-tooth cross patterns
const cosR = 0.8660254; // cos(30 deg)
const sinR = 0.5;       // sin(30 deg)

export default {
    name: "Misty Mountains",
    shoreName: "Mountain Shore",
    getHeight(x, z, snoise) {
        // Domain rotation breaks grid axis alignment and removes artificial cross-hatch staircases
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        const n1 = snoise(rx * 0.0008, rz * 0.0008);
        const n2 = snoise(x * 0.0035 + 17.0, z * 0.0035 + 17.0);
        const n3 = snoise(rx * 0.008, rz * 0.008);

        // Smooth organic ridge shape
        let ridge = 1.0 - Math.abs(n1);
        ridge = ridge * ridge * (3.0 - 2.0 * ridge); // Smoothstep curve eliminates sharp crease artifacts

        const h = ridge * 165.0 + n2 * 22.0 + n3 * 6.0 + 8.0;
        if (h < 4.5) {
            const t = Math.max(0.0, Math.min(1.0, (h + 3.0) / 7.5));
            const st = t * t * (3.0 - 2.0 * t);
            return -3.0 + st * 7.5;
        }
        return h;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        // Natural organic variation on snow line using noise
        const nNoise = snoise(x * 0.01, z * 0.01) * 6.0;
        const snowStart = 55.0 + nNoise;
        const snowFull = 105.0 + nNoise;

        if (h < -1.5) {
            tempColor.copy(colorDeepWater);
        } else if (h < 0.5) {
            tempColor.lerpColors(colorDeepWater, colorWetSand, smoothstep(-1.5, 0.5, h));
        } else if (h < 2.4) {
            tempColor.lerpColors(colorWetSand, colorSand, smoothstep(0.5, 2.4, h));
        } else if (h < 4.2) {
            tempColor.copy(colorSand);
        } else if (h < 15.0) {
            tempColor.lerpColors(colorSand, colorMountainGrass, smoothstep(4.2, 15.0, h));
        } else if (h < snowStart) {
            tempColor.lerpColors(colorMountainGrass, colorMountainRock, smoothstep(15.0, snowStart, h));
        } else {
            tempColor.lerpColors(colorMountainRock, colorSnow, smoothstep(snowStart, snowFull, h));
        }
    }
};
