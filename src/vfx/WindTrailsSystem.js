import * as THREE from 'three';

export function createWindTrails({ scene }) {
    const trailGeo = new THREE.BoxGeometry(0.1, 0.1, 10.0);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const instTrails = new THREE.InstancedMesh(trailGeo, trailMat, 100);
    instTrails.frustumCulled = false;
    scene.add(instTrails);

    const trailsData = new Float32Array(100 * 4); 
    for (let i = 0; i < 100; i++) {
        trailsData[i * 4] = (Math.random() - 0.5) * 80;
        trailsData[i * 4 + 1] = (Math.random() - 0.5) * 60;
        trailsData[i * 4 + 2] = (Math.random() - 0.5) * 100;
        trailsData[i * 4 + 3] = Math.random();
    }

    const dummyTrail = new THREE.Object3D();

    return {
        instTrails,
        trailsData,
        dummyTrail
    };
}

export function updateWindTrails({
    windTrails,
    playerX,
    playerY,
    playerZ,
    dt,
    isWindTrailsOn,
    velocity
}) {
    if (!windTrails) return;
    const { instTrails, trailsData, dummyTrail } = windTrails;
    if (instTrails) instTrails.visible = !!isWindTrailsOn;
    if (!isWindTrailsOn) return;

    const vel = (typeof velocity !== 'undefined') ? velocity : 35;
    for (let i = 0; i < 100; i++) {
        let x = trailsData[i * 4];
        let y = trailsData[i * 4 + 1];
        let z = trailsData[i * 4 + 2];
        let life = trailsData[i * 4 + 3];

        z += (vel * 1.5 + 40.0) * dt;
        life += dt * 0.5;

        if (z > 50 || life > 1.0) {
            x = (Math.random() - 0.5) * 80;
            y = (Math.random() - 0.5) * 60;
            z = -80 - Math.random() * 40;
            life = 0.0;
        }

        trailsData[i * 4] = x;
        trailsData[i * 4 + 1] = y;
        trailsData[i * 4 + 2] = z;
        trailsData[i * 4 + 3] = life;

        dummyTrail.position.set(playerX + x, playerY + y, playerZ + z);
        dummyTrail.scale.set(1.0, 1.0, Math.min(3.0, vel / 20.0));
        dummyTrail.updateMatrix();
        instTrails.setMatrixAt(i, dummyTrail.matrix);
    }
    instTrails.instanceMatrix.needsUpdate = true;
}

export function shiftWindTrails(windTrails, shiftX, shiftZ, shiftInstancedMeshFn) {
    if (!windTrails) return;
    const { instTrails } = windTrails;
    if (instTrails) shiftInstancedMeshFn(instTrails, 100, shiftX, shiftZ);
}
