import * as THREE from 'three';
import { getWorldHeight, getWorldColor } from '../world/TerrainGenerator.js';

export class TerrainMeshManagerLowPower {
    constructor({ scene, terrainMat, terrainRes = 48, terrainSize = 8000 }) {
        this.scene = scene;
        this.terrainRes = terrainRes;
        this.terrainSize = terrainSize;

        // 48x48 grid = 2,401 vertices (drastically reduced from 16,641-66,049)
        this.terrainGeo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.terrainRes, this.terrainRes);
        this.terrainGeo.rotateX(-Math.PI / 2);
        this.terrain = new THREE.Mesh(this.terrainGeo, terrainMat);
        this.terrain.receiveShadow = false;
        this.scene.add(this.terrain);

        this.lastTerrainGridX = -9999;
        this.lastTerrainGridZ = -9999;
        this.lastDepthFieldGridX = -999999;
        this.lastDepthFieldGridZ = -999999;

        this.tempColor = new THREE.Color();
    }

    invalidate() {
        this.lastTerrainGridX = -999999;
        this.lastTerrainGridZ = -999999;
        this.lastDepthFieldGridX = -999999;
        this.lastDepthFieldGridZ = -999999;
    }

    setResolution(newRes, playerX = null, playerZ = null, animeWaterSystem = null) {
        const parsedRes = parseInt(newRes, 10);
        if (!parsedRes || parsedRes <= 0) return;
        this.terrainRes = parsedRes;

        const newGeo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.terrainRes, this.terrainRes);
        newGeo.rotateX(-Math.PI / 2);

        const count = newGeo.attributes.position.count;
        newGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

        if (this.terrainGeo) {
            this.terrainGeo.dispose();
        }
        this.terrainGeo = newGeo;
        this.terrain.geometry = newGeo;

        this.invalidate();

        if (playerX !== null && playerZ !== null) {
            this.update(playerX, playerZ, animeWaterSystem);
        }
    }

    _smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    getGroundedHeight(worldX, worldZ) {
        const gridX = (this.lastTerrainGridX !== -9999 && this.lastTerrainGridX !== -999999) ? this.lastTerrainGridX : 0;
        const gridZ = (this.lastTerrainGridZ !== -9999 && this.lastTerrainGridZ !== -999999) ? this.lastTerrainGridZ : 0;
        const halfSize = this.terrainSize * 0.5;
        const cellSpacing = this.terrainSize / this.terrainRes;
        const localX = worldX - gridX;
        const localZ = worldZ - gridZ;

        const u = (localX + halfSize) / cellSpacing;
        const v = (localZ + halfSize) / cellSpacing;

        const col0 = Math.floor(u);
        const row0 = Math.floor(v);

        if (col0 < 0 || col0 >= this.terrainRes || row0 < 0 || row0 >= this.terrainRes) {
            return getWorldHeight(worldX, worldZ);
        }

        const fx = u - col0;
        const fz = v - row0;
        const N = this.terrainRes + 1;
        const pos = this.terrainGeo && this.terrainGeo.attributes ? this.terrainGeo.attributes.position : null;

        if (pos) {
            const h00 = pos.getY(row0 * N + col0);
            const h10 = pos.getY(row0 * N + col0 + 1);
            const h01 = pos.getY((row0 + 1) * N + col0);
            const h11 = pos.getY((row0 + 1) * N + col0 + 1);

            if (fx + fz <= 1.0) {
                return h00 + fx * (h10 - h00) + fz * (h01 - h00);
            } else {
                return h11 + (1.0 - fx) * (h01 - h11) + (1.0 - fz) * (h10 - h11);
            }
        }

        return getWorldHeight(worldX, worldZ);
    }

    update(playerX, playerZ, animeWaterSystem) {
        // Increased step threshold from 80m to 120m to reduce update frequency by ~50%
        const stepThreshold = 120;
        if (Math.hypot(playerX - this.lastTerrainGridX, playerZ - this.lastTerrainGridZ) < stepThreshold) return;

        const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
        const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;

        if (animeWaterSystem && Math.hypot(gridX - this.lastDepthFieldGridX, gridZ - this.lastDepthFieldGridZ) > 250) {
            animeWaterSystem.rebuildDepthField(gridX, gridZ);
            this.lastDepthFieldGridX = gridX;
            this.lastDepthFieldGridZ = gridZ;
        }

        this.terrain.position.set(gridX, 0, gridZ);

        const pos = this.terrainGeo.attributes.position;
        const norm = this.terrainGeo.attributes.normal;
        const halfSize = this.terrainSize * 0.5;
        const innerRadius = halfSize * 0.72;
        const N = this.terrainRes + 1;

        // 1. Single-pass height calculation with skirt blending
        for (let i = 0; i < pos.count; i++) {
            const localX = pos.getX(i);
            const localZ = pos.getZ(i);
            const worldX = localX + gridX;
            const worldZ = localZ + gridZ;
            let h = getWorldHeight(worldX, worldZ);

            const edgeDist = Math.max(Math.abs(localX), Math.abs(localZ));
            if (edgeDist > innerRadius) {
                const skirtT = this._smoothstep(halfSize, innerRadius, edgeDist);
                h = 2.4 + (h - 2.4) * skirtT;
            }

            pos.setY(i, h);
        }

        // 2. Direct grid normal calculation from buffer
        const cellSpacing = this.terrainSize / this.terrainRes;
        const twoSpacing = cellSpacing * 2.0;
        for (let r = 0; r < N; r++) {
            const rOffset = r * N;
            const rPrev = Math.max(0, r - 1) * N;
            const rNext = Math.min(N - 1, r + 1) * N;
            for (let c = 0; c < N; c++) {
                const idx = rOffset + c;
                const hL = pos.getY(rOffset + Math.max(0, c - 1));
                const hR = pos.getY(rOffset + Math.min(N - 1, c + 1));
                const hD = pos.getY(rPrev + c);
                const hU = pos.getY(rNext + c);
                const dx = hL - hR;
                const dz = hD - hU;
                const invLen = 1.0 / Math.sqrt(dx * dx + twoSpacing * twoSpacing + dz * dz);
                norm.setXYZ(idx, dx * invLen, twoSpacing * invLen, dz * invLen);
            }
        }

        // 3. Vertex color computation
        if (!this.terrainGeo.attributes.color) {
            this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        }
        const colors = this.terrainGeo.attributes.color;
        for (let i = 0; i < pos.count; i++) {
            const localX = pos.getX(i);
            const localZ = pos.getZ(i);
            const worldX = localX + gridX;
            const worldZ = localZ + gridZ;
            const h = pos.getY(i);
            getWorldColor(h, worldX, worldZ, this.tempColor);
            colors.setXYZ(i, this.tempColor.r, this.tempColor.g, this.tempColor.b);
        }

        pos.needsUpdate = true;
        norm.needsUpdate = true;
        colors.needsUpdate = true;

        this.lastTerrainGridX = gridX;
        this.lastTerrainGridZ = gridZ;
    }
}
