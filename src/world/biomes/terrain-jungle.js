import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x1a4a8c);
const colorWetSand = new THREE.Color(0xd9c49a);
const colorSand = new THREE.Color(0xf2e1b8);
const colorJungleGrass = new THREE.Color(0x389c45); // Tropical emerald
const colorJungleHigh = new THREE.Color(0x286330);  // Deep canopy green
const colorIslandRock = new THREE.Color(0x8a725a);
const colorDirt = new THREE.Color(0xdcb58a);

// Domain rotation matrix to eliminate grid-aligned saw-tooth cross patterns
const cosR = 0.8660254; // cos(30 deg)
const sinR = 0.5;       // sin(30 deg)

export default {
    name: "Lush Jungle",
    shoreName: "Jungle Shore",
    getHeight(x, z, snoise) {
        // Domain rotation breaks grid axis alignment
        const rx = x * cosR - z * sinR;
        const rz = x * sinR + z * cosR;

        const n1 = snoise(rx * 0.002, rz * 0.002);
        const n2 = snoise(x * 0.006 + 25.0, z * 0.006 + 25.0);
        const n3 = snoise(rx * 0.012, rz * 0.012);

        let ridge = 1.0 - Math.abs(n1);
        ridge = ridge * ridge * (3.0 - 2.0 * ridge); // Smoothstep curve rounds ridge crests

        const h = ridge * 65.0 - 2.0 + n2 * 14.0 + n3 * 3.0;
        const finalH = h + 8.0;
        if (finalH < 5.0) {
            const t = Math.max(0.0, Math.min(1.0, (finalH + 2.5) / 7.5));
            const st = t * t * (3.0 - 2.0 * t);
            return -2.5 + st * 7.5;
        }
        return finalH;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        if (h < -1.5) {
            tempColor.copy(colorDeepWater);
        } else if (h < 0.5) {
            tempColor.lerpColors(colorDeepWater, colorWetSand, smoothstep(-1.5, 0.5, h));
        } else if (h < 2.4) {
            tempColor.lerpColors(colorWetSand, colorSand, smoothstep(0.5, 2.4, h));
        } else if (h < 4.5) {
            tempColor.copy(colorSand);
        } else if (h < 9.0) {
            tempColor.lerpColors(colorSand, colorJungleGrass, smoothstep(4.5, 9.0, h));
        } else if (h < 25) {
            tempColor.lerpColors(colorJungleGrass, colorJungleHigh, smoothstep(9.0, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorJungleHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
