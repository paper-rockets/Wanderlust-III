import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x0a1c3a); // Dark navy water
const colorWetSand = new THREE.Color(0x80deea);   // Glowing shallow teal sand
const colorSand = new THREE.Color(0xb2ebf2);       // Glowing pale cyan shore sand
const colorMagicalViolet = new THREE.Color(0xab47bc); // Purple/violet mystical grass
const colorMagicalPink = new THREE.Color(0xf8bbd0);   // Soft glowing pink highlight grass
const colorMagicalRock = new THREE.Color(0x311b92);   // Deep indigo basalt rock
const colorDirt = new THREE.Color(0x1a0933);          // Dark void ground

export default {
    name: "Magical Sanctuary",
    shoreName: "Magical Shore",
    getHeight(x, z, snoise) {
        // Surreal rolling plateaus with pillars
        const n1 = snoise(x * 0.0015, z * 0.0015);
        const n2 = snoise(x * 0.008, z * 0.008);
        const pillars = Math.max(0, Math.sin(x * 0.004) * Math.cos(z * 0.004));
        const h = n1 * 45.0 + n2 * 10.0 + (pillars * pillars) * 80.0 + 10.0;
        return Math.max(1.0, h);
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
        } else if (h < 7.0) {
            tempColor.lerpColors(colorSand, colorMagicalViolet, smoothstep(4.5, 7.0, h));
        } else if (h < 25) {
            tempColor.lerpColors(colorMagicalViolet, colorMagicalPink, smoothstep(7.0, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorMagicalPink, colorMagicalRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorMagicalRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};
