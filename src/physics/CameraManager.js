import * as THREE from 'three';
import { getWorldHeight } from '../world/TerrainGenerator.js';

const _tempCamWorldPos = new THREE.Vector3();

export class CameraManager {
    constructor(camera, cameraBase, initialZoomDist = 12.0) {
        this.camera = camera;
        this.cameraBase = cameraBase;
        
        this.baseTargetQuat = new THREE.Quaternion();
        this.eulerRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.quatIdentity = new THREE.Quaternion();
        
        // Settings
        this.BASE_FOV = 60;
        this.MIN_ZOOM = 6.0;
        this.MAX_ZOOM = 300.0;
        this.cameraZoomDist = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, initialZoomDist));
        this.minTerrainClearance = 8.0;
        this.minWaterClearance = 32.0; // Enforces higher minimum elevation above sea level to prevent underwater camera
        this.currentLiftY = 0.0;
    }
    
    update(delta, playerGrp, currentYaw, isBoosting, waterLevel = 2.4) {
        const defaultCamDist = this.cameraZoomDist;
        const defaultCamHeight = this.cameraZoomDist * 0.18;
        
        // Smoothly lerp camera to default distance using exponential decay
        const decayZoom = 1.0 - Math.exp(-5.0 * delta);
        this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, defaultCamDist, decayZoom);
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, defaultCamHeight, decayZoom);
        
        // Extract actual physical yaw from player group quaternion so camera stays 100% in phase with plane movement
        this.eulerRotation.setFromQuaternion(playerGrp.quaternion, 'YXZ');
        const actualYaw = this.eulerRotation.y;

        this.eulerRotation.set(0, actualYaw, 0, 'YXZ'); 
        this.baseTargetQuat.setFromEuler(this.eulerRotation);
        
        const decayCameraBaseQuat = 1.0 - Math.exp(-8.0 * delta);
        const decayCameraQuat = 1.0 - Math.exp(-6.0 * delta);

        this.cameraBase.quaternion.slerp(this.baseTargetQuat, decayCameraBaseQuat); 
        this.camera.quaternion.slerp(this.quatIdentity, decayCameraQuat);
        
        // Evaluate terrain/water clearance lift smoothly to prevent 1-frame snapping
        this.updateLift(delta, playerGrp, waterLevel);

        // High-frequency position filtering to eliminate 1-frame sub-pixel tracking shudder
        const targetX = playerGrp.position.x;
        const targetY = playerGrp.position.y + this.currentLiftY;
        const targetZ = playerGrp.position.z;
        
        const decayPos = 1.0 - Math.exp(-25.0 * delta);
        this.cameraBase.position.x += (targetX - this.cameraBase.position.x) * decayPos;
        this.cameraBase.position.y += (targetY - this.cameraBase.position.y) * decayPos;
        this.cameraBase.position.z += (targetZ - this.cameraBase.position.z) * decayPos;
        
        // Speed zoom effect
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, isBoosting ? this.BASE_FOV + 12 : this.BASE_FOV, 1.0 - Math.exp(-5.0 * delta));
        this.camera.up.set(0, 1, 0);
        this.camera.rotation.z = 0;
        this.camera.updateProjectionMatrix();
    }

    updateLift(delta, playerGrp, waterLevel = 2.4) {
        // Calculate the camera's world position at zero-lift for the current frame
        _tempCamWorldPos.copy(this.camera.position);
        if (this.camera.parent) {
            _tempCamWorldPos.applyQuaternion(this.camera.parent.quaternion);
        }
        _tempCamWorldPos.applyQuaternion(this.cameraBase.quaternion);
        _tempCamWorldPos.add(playerGrp.position);

        const effWaterY = (waterLevel !== undefined && waterLevel !== null) ? waterLevel : 2.4;

        // 1. Direct height check at camera's world coordinates
        const camTerrainH = getWorldHeight(_tempCamWorldPos.x, _tempCamWorldPos.z);
        let minRequiredCamY = Math.max(camTerrainH + this.minTerrainClearance, effWaterY + this.minWaterClearance);

        // 2. Line of sight check between player and camera to prevent clipping through terrain ridges
        if (playerGrp && playerGrp.position) {
            const pX = playerGrp.position.x;
            const pY = playerGrp.position.y;
            const pZ = playerGrp.position.z;
            const cX = _tempCamWorldPos.x;
            const cZ = _tempCamWorldPos.z;

            const steps = Math.max(4, Math.min(10, Math.ceil(this.cameraZoomDist / 25)));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const sampleX = pX + (cX - pX) * t;
                const sampleZ = pZ + (cZ - pZ) * t;
                const sampleTerrainH = getWorldHeight(sampleX, sampleZ);
                const sampleFloor = Math.max(sampleTerrainH + this.minTerrainClearance, effWaterY + this.minWaterClearance);
                
                const reqY = pY + (sampleFloor - pY) / t;
                if (reqY > minRequiredCamY) {
                    minRequiredCamY = reqY;
                }
            }
        }

        // 3. Smoothly lerp lift offset to eliminate 1-frame oscillation chatter
        const targetLift = Math.max(0, minRequiredCamY - _tempCamWorldPos.y);
        const decayLift = 1.0 - Math.exp(-8.0 * delta);
        this.currentLiftY = THREE.MathUtils.lerp(this.currentLiftY, targetLift, decayLift);

        // 4. Hard clamp to prevent the camera from clipping under the terrain or water surface
        const hardMinRequiredCamY = Math.max(camTerrainH + 4.0, effWaterY + 4.0);
        const hardMinLift = Math.max(0, hardMinRequiredCamY - _tempCamWorldPos.y);
        if (this.currentLiftY < hardMinLift) {
            this.currentLiftY = hardMinLift;
        }
    }
    
    setZoom(dist) {
        this.cameraZoomDist = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, dist));
    }
}
