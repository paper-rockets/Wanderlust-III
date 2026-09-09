import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getWorldHeight } from '../world/TerrainGenerator.js';

const _flyFwd = new THREE.Vector3();
const _flyRight = new THREE.Vector3();
const _flyUp = new THREE.Vector3(0, 1, 0);
const _lookDir = new THREE.Vector3();

let _isZKeyDown = false;
let _baseGodFov = 60.0;

export function setupGodMode(scene, cameraBase, renderer, playerGrp) {
    // Ultra-wide depth range: 0.01m near plane for millimeter full zoom-in, 10M far plane for unlimited zoom-out
    const godCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10000000);
    godCamera.position.set(0, 150, 400);

    // CRITICAL: Attach godCamera directly to scene (world space), NOT cameraBase!
    // Adding to cameraBase caused cameraBase slerp/lerp to distort OrbitControls during scrolling and orbiting.
    scene.add(godCamera);

    const godControls = new OrbitControls(godCamera, renderer.domElement);
    godControls.minDistance = 0.001; // Allow zooming all the way in to millimeter range
    godControls.maxDistance = 10000000; // Unlimited zoom out distance
    godControls.minPolarAngle = 0.0001; // Allow looking straight down from high altitude
    godControls.maxPolarAngle = Math.PI - 0.0001; // Full 180-degree vertical freedom
    godControls.zoomSpeed = 1.6;
    godControls.panSpeed = 1.6;
    godControls.rotateSpeed = 1.0;
    godControls.enableDamping = true;
    godControls.dampingFactor = 0.08;
    godControls.screenSpacePanning = true;
    godControls.zoomToCursor = true; // Zoom directly towards cursor position on screen
    godControls.enabled = false;
    
    godControls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    
    godControls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Dynamic wheel zoom speed modifier: Shift for turbo zoom, Alt/Ctrl for precision zoom
    const domElem = renderer.domElement;
    if (domElem) {
        domElem.addEventListener('wheel', (e) => {
            if (!godControls.enabled) return;
            if (e.shiftKey) {
                godControls.zoomSpeed = 4.5;
            } else if (e.altKey || e.ctrlKey) {
                godControls.zoomSpeed = 0.4;
            } else {
                godControls.zoomSpeed = 1.6;
            }
        }, { passive: true, capture: true });

        // Double-click to zoom directly in towards clicked position
        const _raycaster = new THREE.Raycaster();
        const _mouseVec = new THREE.Vector2();
        domElem.addEventListener('dblclick', (e) => {
            if (!godControls.enabled) return;
            const rect = domElem.getBoundingClientRect();
            _mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            _mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            _raycaster.setFromCamera(_mouseVec, godCamera);

            // Compute ray intersection along look ray or scene objects
            const curDist = godCamera.position.distanceTo(godControls.target);
            const zoomInStep = Math.max(2.0, curDist * 0.5);
            godCamera.position.addScaledVector(_raycaster.ray.direction, zoomInStep);
            godControls.target.addScaledVector(_raycaster.ray.direction, zoomInStep * 0.5);
            godControls.update();
        });
    }

    // Keyboard zoom controls: Z for telescopic lens zoom, + / - for dolly zoom steps
    window.addEventListener('keydown', (e) => {
        if (!godControls.enabled) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.key === 'z' || e.key === 'Z') {
            _isZKeyDown = true;
        }
        if (e.key === '=' || e.key === '+' || e.key === 'PageUp') {
            godControls.dollyIn(1.35);
            godControls.update();
        }
        if (e.key === '-' || e.key === '_' || e.key === 'PageDown') {
            godControls.dollyOut(1.35);
            godControls.update();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'z' || e.key === 'Z') {
            _isZKeyDown = false;
        }
    });

    if (playerGrp) {
        godControls.target.copy(playerGrp.position);
    }
    godControls.update();

    return { godCamera, godControls };
}

export function clampGodCameraAboveTerrainAndWater(godControls, godCamera, waterLevel = 2.4) {
    const effWaterY = (waterLevel !== undefined && waterLevel !== null) ? waterLevel : 2.4;
    const minWaterClearance = 0.05;
    const minTerrainClearance = 0.05;

    // 1. Clamp godControls.target
    if (godControls && godControls.target) {
        const targetTerrainH = getWorldHeight(godControls.target.x, godControls.target.z);
        const minTargetY = Math.max(targetTerrainH + 0.02, effWaterY + 0.02);
        if (godControls.target.y < minTargetY) {
            godControls.target.y = minTargetY;
        }
    }

    // 2. Clamp godCamera.position
    if (godCamera) {
        const camTerrainH = getWorldHeight(godCamera.position.x, godCamera.position.z);
        const minCamY = Math.max(camTerrainH + minTerrainClearance, effWaterY + minWaterClearance);
        if (godCamera.position.y < minCamY) {
            godCamera.position.y = minCamY;
        }
        godCamera.updateMatrixWorld(true);
    }
}

export function toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, updateWaterCamera, waterLevel = 2.4) {
    if (isGodMode) {
        // Copy exact world position and orientation of active player camera
        camera.getWorldPosition(godCamera.position);
        camera.getWorldQuaternion(godCamera.quaternion);

        godCamera.near = 0.01;
        godCamera.far = 10000000;
        godCamera.updateProjectionMatrix();

        godControls.enabled = true;
        if (playerGrp) {
            godControls.target.copy(playerGrp.position);
        }
        clampGodCameraAboveTerrainAndWater(godControls, godCamera, waterLevel);
        godControls.update();
        if (updateWaterCamera) updateWaterCamera(godCamera);
    } else {
        godControls.enabled = false;
        if (updateWaterCamera) updateWaterCamera(camera);
    }
}

export function updateGodMode(dt, keys, godControls, godCamera, waterLevel = 2.4) {
    if (!godControls || !godControls.enabled) return;

    // Process smooth OrbitControls damping and mouse/wheel updates
    godControls.update();

    // Prevent OrbitControls target freeze when zooming in close
    // As the camera zooms close to target, advance target along view direction so zooming in continues smoothly
    godCamera.getWorldDirection(_lookDir);
    const distToTarget = godCamera.position.distanceTo(godControls.target);
    if (distToTarget < 0.5) {
        godControls.target.copy(godCamera.position).addScaledVector(_lookDir, 0.5);
    }

    // Smooth telescopic optical FOV zoom when holding Z
    const targetFov = _isZKeyDown ? 10.0 : (window.params && window.params.cameraFov ? window.params.cameraFov : 60.0);
    if (Math.abs(godCamera.fov - targetFov) > 0.05) {
        godCamera.fov = THREE.MathUtils.lerp(godCamera.fov, targetFov, 1.0 - Math.exp(-12.0 * dt));
        godCamera.updateProjectionMatrix();
    }

    if (keys) {
        // Dynamically scale movement speed based on distance/height so panning high in the sky feels fast, while close-up is precise
        const effWaterY = (waterLevel !== undefined && waterLevel !== null) ? waterLevel : 2.4;
        const camTerrainH = getWorldHeight(godCamera.position.x, godCamera.position.z);
        const altAboveSurface = Math.max(0.1, godCamera.position.y - Math.max(camTerrainH, effWaterY));
        const currentDist = godCamera.position.distanceTo(godControls.target);
        
        const speedMult = Math.max(0.05, currentDist * 0.04, altAboveSurface * 0.04);
        const baseSpeed = keys.shift ? 400.0 : (keys.alt ? 15.0 : 80.0);
        const moveSpeed = baseSpeed * speedMult * dt;

        godCamera.getWorldDirection(_flyFwd);
        _flyFwd.y = 0;
        _flyFwd.normalize();

        _flyRight.crossVectors(_flyFwd, _flyUp).normalize();

        const moveDelta = new THREE.Vector3();

        if (keys.w || keys.ArrowUp) moveDelta.addScaledVector(_flyFwd, moveSpeed);
        if (keys.s || keys.ArrowDown) moveDelta.addScaledVector(_flyFwd, -moveSpeed);
        if (keys.d || keys.ArrowRight) moveDelta.addScaledVector(_flyRight, moveSpeed);
        if (keys.a || keys.ArrowLeft) moveDelta.addScaledVector(_flyRight, -moveSpeed);

        // Vertical elevation controls: Space or E to move up, Q to move down
        if (keys.space || keys.e) moveDelta.y += moveSpeed;
        if (keys.q) moveDelta.y -= moveSpeed;

        if (moveDelta.lengthSq() > 0) {
            godCamera.position.add(moveDelta);
            godControls.target.add(moveDelta);
        }
    }

    clampGodCameraAboveTerrainAndWater(godControls, godCamera, waterLevel);
}

