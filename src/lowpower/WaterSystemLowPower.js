import * as THREE from 'three';
import {
  createLowPowerOpenSeaMaterial,
  timeUniform,
  seaUniform,
  speedUniform,
  waterLevelUniform,
  sunDirUniform,
  objPosUniform,
  objActiveUniform,
  setTerrainDepthTexture,
  getWaterHeightAt,
  getWaterNormalAt
} from './OpenSeaOceanLowPower.js';
import { TerrainDepthField } from '../WaterAnime/TerrainDepthField.js';

export class WaterSystemLowPower {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        // 64x64 low-power plane geometry (4,225 vertices instead of 262,144)
        this.geometry = new THREE.PlaneGeometry(16000, 16000, 64, 64);
        this.geometry.rotateX(-Math.PI / 2);

        // Lightweight 128x128 amortized depth field
        this.depthField = new TerrainDepthField(128, 4000, 16);
        setTerrainDepthTexture(this.depthField.texture);

        this.waterLevel = 2.4;
        waterLevelUniform.value = this.waterLevel;

        this.material = createLowPowerOpenSeaMaterial();
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.position.y = this.waterLevel;
        this.mesh.renderOrder = 10;
        this.scene.add(this.mesh);

        this.visible = true;
        this._tempCamPos = new THREE.Vector3();
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.mesh) this.mesh.visible = visible;
    }

    setHeight(y) {
        this.waterLevel = y;
        waterLevelUniform.value = y;
        if (this.mesh) this.mesh.position.y = y;
    }

    rebuildDepthField(centerX, centerZ) {
        if (this.depthField) this.depthField.rebuild(centerX, centerZ);
    }

    tickDepthField() {
        if (this.depthField) this.depthField.tick();
    }

    getWaterHeight(x, z, time = 0) {
        const baseHeight = this.mesh ? this.mesh.position.y : 2.4;
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

        // Ocean plane snaps to 64-division grid cells (250m) to follow camera without swimming
        if (this.mesh && camera) {
            camera.getWorldPosition(this._tempCamPos);
            const cell = 16000 / 64; // 250m
            this.mesh.position.x = Math.round(this._tempCamPos.x / cell) * cell;
            this.mesh.position.z = Math.round(this._tempCamPos.z / cell) * cell;
        }

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
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.geometry.dispose();
            this.material.dispose();
        }
    }
}
