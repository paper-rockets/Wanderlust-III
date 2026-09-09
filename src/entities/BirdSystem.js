import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { positionLocal, positionGeometry, abs, sin, step, Fn } from 'three/tsl';

export function createBirdSystem({ scene, LOW_GFX, terrainUniforms, gradientMap }) {
    const geoBird = new THREE.BufferGeometry();
    const birdVerts = new Float32Array([
        0, 0, 0.6,   -1.8, 0, 0,    0, 0, -0.6,
        0, 0, 0.6,    0, 0, -0.6,   1.8, 0, 0
    ]);
    geoBird.setAttribute('position', new THREE.BufferAttribute(birdVerts, 3));
    geoBird.computeVertexNormals();

    const BIRD_COUNT = LOW_GFX ? 12 : 40;
    const HIGH_BIRD_COUNT = 0;
    const MAX_BIRD_COUNT = 120;

    const matBird = new MeshToonNodeMaterial({ color: 0xd6e5f5, side: THREE.DoubleSide, gradientMap });
    matBird.positionNode = Fn(() => {
        let transformed = positionLocal.toVar();
        const wingDist = abs(positionGeometry.x);
        const flap = sin(terrainUniforms.uTime.mul(9.0).add(wingDist.mul(0.5))).mul(wingDist).mul(0.35);
        const isWing = step(0.3, wingDist);
        transformed.y.addAssign(flap.mul(isWing));
        return transformed;
    })();

    const instBirds = new THREE.InstancedMesh(geoBird, matBird, MAX_BIRD_COUNT);
    instBirds.count = BIRD_COUNT;
    instBirds.castShadow = true;
    instBirds.frustumCulled = false;
    scene.add(instBirds);

    const birdData = new Float32Array(MAX_BIRD_COUNT * 6);
    for (let i = 0; i < MAX_BIRD_COUNT; i++) {
        birdData[i * 6 + 0] = (Math.random() - 0.5) * 600;
        birdData[i * 6 + 1] = 60 + Math.random() * 80;
        birdData[i * 6 + 2] = (Math.random() - 0.5) * 600;
        birdData[i * 6 + 3] = (Math.random() - 0.5) * 10;
        birdData[i * 6 + 4] = (Math.random() - 0.5) * 2;
        birdData[i * 6 + 5] = (Math.random() - 0.5) * 10;
    }

    const instHighBirds = new THREE.InstancedMesh(geoBird, matBird, Math.max(1, HIGH_BIRD_COUNT));
    instHighBirds.count = HIGH_BIRD_COUNT;
    instHighBirds.castShadow = true;
    instHighBirds.frustumCulled = false;
    if (HIGH_BIRD_COUNT > 0) scene.add(instHighBirds);

    const highBirdData = new Float32Array(Math.max(1, HIGH_BIRD_COUNT) * 6);
    const dummy = new THREE.Object3D();

    return {
        geoBird,
        matBird,
        instBirds,
        instHighBirds,
        birdData,
        highBirdData,
        BIRD_COUNT,
        HIGH_BIRD_COUNT,
        MAX_BIRD_COUNT,
        dummy
    };
}

export function updateBirdsGen({
    data,
    inst,
    count,
    tX,
    tY,
    tZ,
    time,
    dt,
    centerPull,
    params,
    velocity,
    dummy
}) {
    if (!inst || count <= 0) return;
    for (let i = 0; i < count; i++) {
        let px = data[i * 6 + 0], py = data[i * 6 + 1], pz = data[i * 6 + 2];
        let vx = data[i * 6 + 3], vy = data[i * 6 + 4], vz = data[i * 6 + 5];

        let cx = 0, cy = 0, cz = 0;
        let sx = 0, sy = 0, sz = 0;
        let ax = 0, ay = 0, az = 0;
        let n = 0;

        for (let j = 0; j < count; j++) {
            if (i === j) continue;
            let dx = px - data[j * 6 + 0], dy = py - data[j * 6 + 1], dz = pz - data[j * 6 + 2];
            let distSq = dx * dx + dy * dy + dz * dz;
            
            if (distSq < 1200) { 
                cx += data[j * 6 + 0]; cy += data[j * 6 + 1]; cz += data[j * 6 + 2];
                ax += data[j * 6 + 3]; ay += data[j * 6 + 4]; az += data[j * 6 + 5];
                n++;
            }
            if (distSq < 400) { 
                sx += dx; sy += dy; sz += dz;
            }
        }

        if (n > 0) {
            cx /= n; cy /= n; cz /= n;
            ax /= n; ay /= n; az /= n;
            vx += (cx - px) * 0.4 * dt;
            vy += (cy - py) * 0.4 * dt;
            vz += (cz - pz) * 0.4 * dt;
            vx += (ax - vx) * 0.1 * dt;
            vy += (ay - vy) * 0.1 * dt;
            vz += (az - vz) * 0.1 * dt;
        }
        
        vx += sx * 1.8 * dt; vy += sy * 1.8 * dt; vz += sz * 1.8 * dt;

        let formAngle = (i / count) * Math.PI * 2.0;
        let formRadius = (params && params.birdFlockRadius ? params.birdFlockRadius : 22) + (i % 6) * (params && params.birdFlockSpread ? params.birdFlockSpread : 9);
        let targetX = tX + Math.cos(formAngle) * formRadius;
        let targetY = tY + ((i % 5) - 2) * 3.5;
        let targetZ = tZ + Math.sin(formAngle) * formRadius;

        let tx = targetX - px, ty = targetY - py, tz = targetZ - pz;
        let dToT = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (dToT > 3) {
            let pullFactor = (dToT > 100) ? centerPull * 4.0 : centerPull * 1.2;
            vx += (tx / dToT) * pullFactor * dt;
            vy += (ty / dToT) * pullFactor * dt;
            vz += (tz / dToT) * pullFactor * dt;
        }

        let maxSpd = (centerPull > 3.0 && typeof velocity !== 'undefined') ? Math.max(40, velocity * 1.2) : (params && params.birdMaxSpeed ? params.birdMaxSpeed : 35);
        let spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (spd > maxSpd) { vx *= maxSpd / spd; vy *= maxSpd / spd; vz *= maxSpd / spd; }
        if (spd < 15) { vx *= 15 / spd; vy *= 15 / spd; vz *= 15 / spd; }

        px += vx * dt; py += vy * dt; pz += vz * dt;
        data[i * 6 + 0] = px; data[i * 6 + 1] = py; data[i * 6 + 2] = pz;
        data[i * 6 + 3] = vx; data[i * 6 + 4] = vy; data[i * 6 + 5] = vz;

        dummy.position.set(px, py, pz);
        let targetYaw = Math.atan2(vx, vz);
        let roll = Math.max(-0.6, Math.min(0.6, sx * 0.05));
        dummy.rotation.set(roll, targetYaw, Math.sin(time * 12 + i) * 0.35);
        dummy.scale.setScalar(params && params.birdScale ? params.birdScale : 0.42);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
}

export function updateFlocks(playerX, playerY, playerZ, time, dt, velocity) {
    const playerPos = { x: playerX, y: playerY, z: playerZ };
    const vel = (typeof velocity !== 'undefined') ? velocity : 35;
    if (typeof window.birdFlock !== 'undefined' && window.birdFlock) window.birdFlock.update(playerPos, time, dt, vel);
    if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) window.flamingoFlock.update(playerPos, time, dt, vel);
}

export function shiftBirds(birdSystem, shiftX, shiftZ, shiftInstancedMeshFn) {
    if (!birdSystem) return;
    const { instBirds, instHighBirds, MAX_BIRD_COUNT, HIGH_BIRD_COUNT } = birdSystem;
    if (instBirds) shiftInstancedMeshFn(instBirds, MAX_BIRD_COUNT, shiftX, shiftZ);
    if (instHighBirds && HIGH_BIRD_COUNT > 0) shiftInstancedMeshFn(instHighBirds, HIGH_BIRD_COUNT, shiftX, shiftZ);
}
