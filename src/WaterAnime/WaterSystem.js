import * as THREE from 'three';
import {
  createOpenSeaMaterial,
  timeUniform,
  seaUniform,
  speedUniform,
  detailAmountUniform,
  foamAmountUniform,
  waterOpacityUniform,
  waveHeightUniform,
  oceanScaleUniform,
  swellWavelengthUniform,
  deepColorUniform,
  shallowColorUniform,
  horizonColorUniform,
  zenithColorUniform,
  sunColorUniform,
  sunDirUniform,
  objPosUniform,
  objActiveUniform,
  qualityModeUniform,
  distanceLodUniform,
  lodDistanceThresholdUniform,
  waterLevelUniform,
  setTerrainDepthTexture,
  getWaterHeightAt,
  getWaterNormalAt
} from './OpenSeaOcean.js';
import { TerrainDepthField } from './TerrainDepthField.js';

export class WaterSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        // Resolution geometries cache
        this.geometries = {
            '512': this._createPlaneGeo(512),
            '256': this._createPlaneGeo(256),
            '128': this._createPlaneGeo(128)
        };

        this.meshResolution = '512';
        this.qualityMode = 'high'; // 'high' | 'performance'
        this.distanceLod = true;

        // CPU-baked terrain height field for shoreline shading.
        // MUST be constructed and registered before createOpenSeaMaterial(): TSL node
        // graphs are built once, so the texture has to exist when the graph is created.
        this.depthField = new TerrainDepthField(512, 8000, 32);
        setTerrainDepthTexture(this.depthField.texture);

        this.waterLevel = 2.4;
        waterLevelUniform.value = this.waterLevel;

        this.openSeaMaterial = createOpenSeaMaterial();
        this.openSeaMesh = new THREE.Mesh(this.geometries['512'], this.openSeaMaterial);
        this.openSeaMesh.frustumCulled = false;
        this.openSeaMesh.castShadow = false;
        this.openSeaMesh.receiveShadow = false;
        this.openSeaMesh.position.y = this.waterLevel;
        // Depth-faded alpha at the shore needs the water to stop writing depth, or it punches
        // a hole in everything drawn behind it. Explicit render order so it draws after opaque.
        this.openSeaMaterial.depthWrite = false;
        this.openSeaMesh.renderOrder = 10;
        this.scene.add(this.openSeaMesh);

        this.visible = true;
    }

    _createPlaneGeo(segments) {
        const geo = new THREE.PlaneGeometry(16000, 16000, segments, segments);
        geo.rotateX(-Math.PI / 2);
        return geo;
    }

    setMeshResolution(res) {
        const key = String(res);
        if (this.geometries[key] && this.openSeaMesh) {
            this.openSeaMesh.geometry = this.geometries[key];
            this.meshResolution = key;
        }
    }

    setQualityMode(mode) {
        this.qualityMode = mode;
        if (mode === 'performance') {
            qualityModeUniform.value = 0.0;
            distanceLodUniform.value = 1.0;
            this.setMeshResolution(128);
        } else {
            qualityModeUniform.value = 1.0;
            distanceLodUniform.value = 1.0;
            this.setMeshResolution(512);
        }
    }

    setDistanceLod(enabled) {
        this.distanceLod = !!enabled;
        distanceLodUniform.value = this.distanceLod ? 1.0 : 0.0;
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.openSeaMesh) this.openSeaMesh.visible = visible;
    }

    setHeight(y) {
        this.waterLevel = y;
        waterLevelUniform.value = y;
        if (this.openSeaMesh) this.openSeaMesh.position.y = y;
    }

    /**
     * Re-bake the terrain depth field around a new centre. Cheap - the actual
     * height sampling is amortised across subsequent tickDepthField() calls.
     * Called from updateTerrainGeometry() on every 150 m terrain step.
     */
    rebuildDepthField(centerX, centerZ) {
        if (this.depthField) this.depthField.rebuild(centerX, centerZ);
    }

    /** Advance the amortised depth-field bake by one row block. No-op when idle. */
    tickDepthField() {
        if (this.depthField) this.depthField.tick();
    }

    getWaterHeight(x, z, time = 0) {
        const baseHeight = this.openSeaMesh ? this.openSeaMesh.position.y : 2.4;
        return baseHeight + getWaterHeightAt(x, z, time || timeUniform.value, seaUniform.value);
    }

    getWaterNormal(x, z, time = 0) {
        return getWaterNormalAt(x, z, time || timeUniform.value, seaUniform.value);
    }

    update(dt, elapsedTime, camera, playerPos = null, sunDir = null) {
        if (!this.visible) return;

        timeUniform.value = elapsedTime;

        if (sunDir) {
            sunDirUniform.value.copy(sunDir).normalize();
        }

        // Ocean plane follows camera in XZ for infinite horizon, SNAPPED to the vertex grid.
        //
        // Following the raw camera position slid the 31.25 m sampling lattice continuously
        // beneath a world-locked wave field, so the sampling pattern stayed pinned to the
        // viewer and travelled with them -- waves never read as passing by. Snapping to whole
        // grid cells keeps every vertex on the same world position it had last frame.
        if (this.openSeaMesh && camera) {
            if (!this._tempCamPos) this._tempCamPos = new THREE.Vector3();
            camera.getWorldPosition(this._tempCamPos);
            const cell = 16000 / 512;   // 31.25m, must match the mesh tessellation
            const invCell = 512 / 16000;
            this.openSeaMesh.position.x = Math.round(this._tempCamPos.x * invCell) * cell;
            this.openSeaMesh.position.z = Math.round(this._tempCamPos.z * invCell) * cell;
        }

        // Player tracking
        if (playerPos) {
            objPosUniform.value.copy(playerPos);
        }
        objActiveUniform.value = 0.0;
    }

    dispose() {
        if (this.depthField) {
            this.depthField.dispose();
            this.depthField = null;
        }
        if (this.openSeaMesh) {
            this.scene.remove(this.openSeaMesh);
            this.openSeaMesh.geometry.dispose();
            this.openSeaMesh.material.dispose();
        }
    }
}
