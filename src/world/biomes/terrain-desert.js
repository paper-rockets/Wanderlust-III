import * as THREE from 'three';

export const desertColors = {
    deepWater:    new THREE.Color(0x0d5c75),
    oasisWater:   new THREE.Color(0x14b8a6),
    oasisGrass:   new THREE.Color(0x22c55e),
    oasisEdge:    new THREE.Color(0x84cc16),
    oasisSand:    new THREE.Color(0xd97706),
    valleyShadow: new THREE.Color(0x7a2e19),
    sandBase:     new THREE.Color(0xd96d27),
    duneSlope:    new THREE.Color(0xf5a047),
    duneCrest:    new THREE.Color(0xfcd385),
    peakHighlight:new THREE.Color(0xfeedd2)
};

export default {
    name: "Desert Dunes",
    shoreName: "Desert Shore",
    getHeight(x, z, snoise) {
        const i = snoise(x * 8e-5, z * 8e-5) * 35 + 35;
        const n = snoise(x * 4e-4, z * 4e-4) * 150;
        const o = snoise(x * 4e-4 + 120, z * 4e-4 + 120) * 150;
        const a = snoise((x + n) * 0.001, (z + o) * 0.001);
        const l = Math.max(0, 1 - Math.abs(a));
        const c = l * l * (3 - 2 * l);
        const u = Math.pow(c, 1.4);
        const d = snoise((x - o) * 0.002 + 50, (z + n) * 0.002 + 50);
        const h = Math.max(0, 1 - Math.abs(d));
        const p = h * h * (3 - 2 * h);
        const f = Math.pow(p, 1.2) * 0.35;
        let g = i + u * 60 + f * 20;
        const A = snoise(x * 3e-4, z * 3e-4);
        if (A > 0.6) {
            const b = (A - 0.6) / 0.4;
            const sx = Math.pow(Math.sin(b * Math.PI * 0.5), 2) * 70;
            g -= sx;
        }
        return Math.max(1.0, g);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const o = snoise(x * 3e-4, z * 3e-4);
        if (h <= 2.4 && o > 0.6) {
            tempColor.lerpColors(desertColors.deepWater, desertColors.oasisSand, smoothstep(0.5, 2.4, h));
            return;
        }
        if (h <= 2.4) {
            tempColor.lerpColors(desertColors.deepWater, desertColors.sandBase, smoothstep(0.5, 2.4, h));
            return;
        }
        if (o > 0.6 && h < 16) {
            if (h < 6.0) {
                tempColor.lerpColors(desertColors.oasisSand, desertColors.oasisEdge, smoothstep(2.4, 6.0, h));
            } else if (h < 11.0) {
                tempColor.lerpColors(desertColors.oasisEdge, desertColors.oasisGrass, smoothstep(6.0, 11.0, h));
            } else {
                tempColor.lerpColors(desertColors.oasisGrass, desertColors.sandBase, smoothstep(11.0, 16.0, h));
            }
            return;
        }
        const a = snoise(x * 0.002, z * 0.002) * 0.08;
        if (h < 22) {
            tempColor.lerpColors(desertColors.sandBase, desertColors.duneSlope, smoothstep(2.4, 22, h));
        } else if (h < 50) {
            tempColor.lerpColors(desertColors.sandBase, desertColors.duneSlope, smoothstep(22, 50, h));
        } else if (h < 85) {
            tempColor.lerpColors(desertColors.duneSlope, desertColors.duneCrest, smoothstep(50, 85, h));
        } else {
            tempColor.lerpColors(desertColors.duneCrest, desertColors.peakHighlight, smoothstep(85, 130, h));
        }
        if (a !== 0) {
            tempColor.r = Math.max(0, Math.min(1, tempColor.r + a));
            tempColor.g = Math.max(0, Math.min(1, tempColor.g + a * 0.6));
        }
    }
};
