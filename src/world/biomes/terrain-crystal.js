import * as THREE from 'three';

const colorDeepWater   = new THREE.Color(0x0a1e3f);
const colorCrystalSea  = new THREE.Color(0x19a0c7);
const colorCrystalSand = new THREE.Color(0xd5effa);
const colorCrystalFloor= new THREE.Color(0x38bdf8); // Vibrant crystalline blue bedrock
const colorAmethystLow = new THREE.Color(0x818cf8); // Celestite / light amethyst crystal
const colorAmethystMid = new THREE.Color(0xc084fc); // Rich purple amethyst
const colorPrismHigh   = new THREE.Color(0xf472b6); // Luminous prism magenta crystal
const colorSpire       = new THREE.Color(0xffffff); // Pure faceted quartz spires

export default {
    name: 'Crystal Land',
    getHeight(x, z, snoise) {
        // High crystalline plateau foundation (always above sea level 2.4m)
        const baseFloor = Math.abs(snoise(x * 0.0004, z * 0.0004)) * 28.0 + 18.0;

        // Stepped quartz terraces and geometric faceted crystal ridges
        const terrace = Math.floor(baseFloor / 6.0) * 6.0;
        const plateau = baseFloor * 0.4 + terrace * 0.6;

        // Faceted crystal harmonics & pyramidal spikes across the entire terrain
        const fx = Math.abs((x * 0.015) % 2.0 - 1.0);
        const fz = Math.abs((z * 0.015) % 2.0 - 1.0);
        const pyramidFacet = (1.0 - Math.max(fx, fz)) * 18.0;

        // Giant sharp quartz towers and crystalline obelisks
        const spike1 = Math.pow(Math.max(0, snoise(x * 0.0025 + 300, z * 0.0025 - 200)), 2.0) * 75.0;
        const spike2 = Math.pow(Math.max(0, snoise(x * 0.0042 - 500, z * 0.0042 + 400)), 2.2) * 55.0;
        const spike3 = Math.pow(Math.max(0, snoise(x * 0.0075 + 700, z * 0.0075 + 100)), 2.5) * 40.0;

        // Crystalline ridges and needle formations
        const ridge = (1.0 - Math.abs(snoise(x * 0.008 + 120, z * 0.008 - 120))) * 14.0;

        const totalH = plateau + pyramidFacet + spike1 + spike2 + spike3 + ridge;
        return Math.max(12.0, totalH);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const shimmer = snoise(x * 0.025 + 1000, z * 0.025 + 1000) * 0.5 + 0.5;

        if (h < 15.0) {
            tempColor.lerpColors(colorCrystalSand, colorCrystalFloor, smoothstep(8.0, 15.0, h));
        } else if (h < 30.0) {
            tempColor.lerpColors(colorCrystalFloor, colorAmethystLow, smoothstep(15.0, 30.0, h));
        } else if (h < 65.0) {
            const t = smoothstep(30.0, 65.0, h);
            tempColor.lerpColors(colorAmethystLow, colorAmethystMid, t);
            if (shimmer > 0.5) tempColor.lerp(colorPrismHigh, (shimmer - 0.5) * 1.8);
        } else {
            tempColor.lerpColors(colorAmethystMid, colorSpire, smoothstep(65.0, 110.0, h));
        }
    }
};
