import * as THREE from 'three';
import { snoise } from './Noise.js';
import { getWorldHeight, getWorldColor } from './TerrainGenerator.js';

export class TerrainMeshManager {
    constructor({ scene, terrainMat, terrainRes = 128, terrainSize = 8000 }) {
        this.scene = scene;
        this.terrainRes = terrainRes;
        this.terrainSize = terrainSize;

        this.terrainGeo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.terrainRes, this.terrainRes);
        this.terrainGeo.rotateX(-Math.PI / 2);

        const count = this.terrainGeo.attributes.position.count;
        this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

        this.terrain = new THREE.Mesh(this.terrainGeo, terrainMat);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        this.lastTerrainGridX = -9999;
        this.lastTerrainGridZ = -9999;
        this.lastDepthFieldGridX = -999999;
        this.lastDepthFieldGridZ = -999999;

        this.tempColor = new THREE.Color();

        // Staging buffers for time-sliced asynchronous generation
        this._allocateStagingBuffers();
        this._buildJob = null;
    }

    _allocateStagingBuffers() {
        const N = this.terrainRes + 1;
        const count = N * N;
        this._stagingHeights = new Float32Array(count);
        this._stagingNorm = new Float32Array(count * 3);
        this._stagingCol = new Float32Array(count * 3);
    }

    invalidate() {
        this._buildJob = null;
        this.lastTerrainGridX = -999999;
        this.lastTerrainGridZ = -999999;
        this.lastDepthFieldGridX = -999999;
        this.lastDepthFieldGridZ = -999999;
    }

    shiftOrigin(shiftX, shiftZ) {
        this.lastTerrainGridX -= shiftX;
        this.lastTerrainGridZ -= shiftZ;
        this.lastDepthFieldGridX -= shiftX;
        this.lastDepthFieldGridZ -= shiftZ;
        this.terrain.position.x -= shiftX;
        this.terrain.position.z -= shiftZ;
        if (this._buildJob) {
            this._buildJob.gridX -= shiftX;
            this._buildJob.gridZ -= shiftZ;
        }
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

        this._allocateStagingBuffers();
        this.invalidate();

        if (playerX !== null && playerZ !== null) {
            const stepThreshold = 80;
            const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
            const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;
            this._buildSynchronous(gridX, gridZ, animeWaterSystem);
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

    _startBuildJob(gridX, gridZ, animeWaterSystem) {
        this._buildJob = {
            gridX,
            gridZ,
            animeWaterSystem,
            phase: 'heights',
            currentRow: 0
        };
    }

    _stepBuildJob() {
        const job = this._buildJob;
        if (!job) return;

        const N = this.terrainRes + 1;
        const halfSize = this.terrainSize * 0.5;
        const innerRadius = halfSize * 0.72;
        const cellSpacing = this.terrainSize / this.terrainRes;

        if (job.phase === 'heights') {
            // Process 4 slices for heights
            const rowsPerSlice = Math.ceil(N / 4);
            const startRow = job.currentRow;
            const endRow = Math.min(N, startRow + rowsPerSlice);

            for (let r = startRow; r < endRow; r++) {
                const rOffset = r * N;
                const localZ = -halfSize + r * cellSpacing;
                const worldZ = localZ + job.gridZ;

                for (let c = 0; c < N; c++) {
                    const localX = -halfSize + c * cellSpacing;
                    const worldX = localX + job.gridX;
                    let h = getWorldHeight(worldX, worldZ);

                    const edgeDist = Math.max(Math.abs(localX), Math.abs(localZ));
                    if (edgeDist > innerRadius) {
                        const skirtT = this._smoothstep(halfSize, innerRadius, edgeDist);
                        h = 2.4 + (h - 2.4) * skirtT;
                    }

                    job.gridHeights = job.gridHeights || this._stagingHeights;
                    job.gridHeights[rOffset + c] = h;
                }
            }

            job.currentRow = endRow;
            if (job.currentRow >= N) {
                job.phase = 'normals';
                job.currentRow = 0;
            }
            return;
        }

        if (job.phase === 'normals') {
            // Direct grid normal computation across all rows (vector math is fast, ~0.3ms)
            const twoSpacing = cellSpacing * 2.0;
            const heights = this._stagingHeights;
            const normArr = this._stagingNorm;

            for (let r = 0; r < N; r++) {
                const rOffset = r * N;
                const rPrev = Math.max(0, r - 1) * N;
                const rNext = Math.min(N - 1, r + 1) * N;
                for (let c = 0; c < N; c++) {
                    const idx = rOffset + c;
                    const idx3 = idx * 3;
                    const hL = heights[rOffset + Math.max(0, c - 1)];
                    const hR = heights[rOffset + Math.min(N - 1, c + 1)];
                    const hD = heights[rPrev + c];
                    const hU = heights[rNext + c];
                    const dx = hL - hR;
                    const dz = hD - hU;
                    const invLen = 1.0 / Math.sqrt(dx * dx + twoSpacing * twoSpacing + dz * dz);
                    normArr[idx3] = dx * invLen;
                    normArr[idx3 + 1] = twoSpacing * invLen;
                    normArr[idx3 + 2] = dz * invLen;
                }
            }

            job.phase = 'colors';
            job.currentRow = 0;
            return;
        }

        if (job.phase === 'colors') {
            // Process 2 slices for vertex colors
            const rowsPerSlice = Math.ceil(N / 2);
            const startRow = job.currentRow;
            const endRow = Math.min(N, startRow + rowsPerSlice);
            const heights = this._stagingHeights;
            const colArr = this._stagingCol;

            for (let r = startRow; r < endRow; r++) {
                const rOffset = r * N;
                const localZ = -halfSize + r * cellSpacing;
                const worldZ = localZ + job.gridZ;

                for (let c = 0; c < N; c++) {
                    const idx = rOffset + c;
                    const idx3 = idx * 3;
                    const localX = -halfSize + c * cellSpacing;
                    const worldX = localX + job.gridX;
                    const h = heights[idx];
                    getWorldColor(h, worldX, worldZ, this.tempColor);
                    colArr[idx3] = this.tempColor.r;
                    colArr[idx3 + 1] = this.tempColor.g;
                    colArr[idx3 + 2] = this.tempColor.b;
                }
            }

            job.currentRow = endRow;
            if (job.currentRow >= N) {
                job.phase = 'commit';
            }
            return;
        }

        if (job.phase === 'commit') {
            this._commitStaging(job.gridX, job.gridZ, job.animeWaterSystem);
            this._buildJob = null;
        }
    }

    _commitStaging(gridX, gridZ, animeWaterSystem) {
        const posArr = this.terrainGeo.attributes.position.array;
        const normArr = this.terrainGeo.attributes.normal.array;
        const colArr = this.terrainGeo.attributes.color.array;

        // Apply heights into position buffer (x and z remain unmodified)
        const heights = this._stagingHeights;
        for (let i = 0; i < heights.length; i++) {
            posArr[i * 3 + 1] = heights[i];
        }

        normArr.set(this._stagingNorm);
        colArr.set(this._stagingCol);

        this.terrainGeo.attributes.position.needsUpdate = true;
        this.terrainGeo.attributes.normal.needsUpdate = true;
        this.terrainGeo.attributes.color.needsUpdate = true;

        this.terrain.position.set(gridX, 0, gridZ);
        this.lastTerrainGridX = gridX;
        this.lastTerrainGridZ = gridZ;

        if (animeWaterSystem && Math.hypot(gridX - this.lastDepthFieldGridX, gridZ - this.lastDepthFieldGridZ) > 200) {
            animeWaterSystem.rebuildDepthField(gridX, gridZ);
            this.lastDepthFieldGridX = gridX;
            this.lastDepthFieldGridZ = gridZ;
        }
    }

    _buildSynchronous(gridX, gridZ, animeWaterSystem) {
        this._buildJob = null;
        const N = this.terrainRes + 1;
        const halfSize = this.terrainSize * 0.5;
        const innerRadius = halfSize * 0.72;
        const cellSpacing = this.terrainSize / this.terrainRes;
        const twoSpacing = cellSpacing * 2.0;

        const heights = this._stagingHeights;
        const normArr = this._stagingNorm;
        const colArr = this._stagingCol;

        // 1. Heights
        for (let r = 0; r < N; r++) {
            const rOffset = r * N;
            const localZ = -halfSize + r * cellSpacing;
            const worldZ = localZ + gridZ;
            for (let c = 0; c < N; c++) {
                const localX = -halfSize + c * cellSpacing;
                const worldX = localX + gridX;
                let h = getWorldHeight(worldX, worldZ);
                const edgeDist = Math.max(Math.abs(localX), Math.abs(localZ));
                if (edgeDist > innerRadius) {
                    const skirtT = this._smoothstep(halfSize, innerRadius, edgeDist);
                    h = 2.4 + (h - 2.4) * skirtT;
                }
                heights[rOffset + c] = h;
            }
        }

        // 2. Normals
        for (let r = 0; r < N; r++) {
            const rOffset = r * N;
            const rPrev = Math.max(0, r - 1) * N;
            const rNext = Math.min(N - 1, r + 1) * N;
            for (let c = 0; c < N; c++) {
                const idx = rOffset + c;
                const idx3 = idx * 3;
                const hL = heights[rOffset + Math.max(0, c - 1)];
                const hR = heights[rOffset + Math.min(N - 1, c + 1)];
                const hD = heights[rPrev + c];
                const hU = heights[rNext + c];
                const dx = hL - hR;
                const dz = hD - hU;
                const invLen = 1.0 / Math.sqrt(dx * dx + twoSpacing * twoSpacing + dz * dz);
                normArr[idx3] = dx * invLen;
                normArr[idx3 + 1] = twoSpacing * invLen;
                normArr[idx3 + 2] = dz * invLen;
            }
        }

        // 3. Colors
        for (let r = 0; r < N; r++) {
            const rOffset = r * N;
            const localZ = -halfSize + r * cellSpacing;
            const worldZ = localZ + gridZ;
            for (let c = 0; c < N; c++) {
                const idx = rOffset + c;
                const idx3 = idx * 3;
                const localX = -halfSize + c * cellSpacing;
                const worldX = localX + gridX;
                const h = heights[idx];
                getWorldColor(h, worldX, worldZ, this.tempColor);
                colArr[idx3] = this.tempColor.r;
                colArr[idx3 + 1] = this.tempColor.g;
                colArr[idx3 + 2] = this.tempColor.b;
            }
        }

        this._commitStaging(gridX, gridZ, animeWaterSystem);
    }

    update(playerX, playerZ, animeWaterSystem) {
        const stepThreshold = 80;
        const distFromLast = Math.hypot(playerX - this.lastTerrainGridX, playerZ - this.lastTerrainGridZ);

        // Immediate build on initial startup or after invalidate
        if (this.lastTerrainGridX === -9999 || this.lastTerrainGridX === -999999) {
            const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
            const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;
            this._buildSynchronous(gridX, gridZ, animeWaterSystem);
            return;
        }

        // Advance ongoing time-sliced build if active
        if (this._buildJob) {
            this._stepBuildJob();
            return;
        }

        // Check if player crossed step threshold to launch new time-sliced build
        if (distFromLast >= stepThreshold) {
            const gridX = Math.round(playerX / stepThreshold) * stepThreshold;
            const gridZ = Math.round(playerZ / stepThreshold) * stepThreshold;
            this._startBuildJob(gridX, gridZ, animeWaterSystem);
            this._stepBuildJob();
        }
    }
}
