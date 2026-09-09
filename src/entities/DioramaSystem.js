import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function createDioramaSystem({ scene, LOW_GFX, matRock, matBush, matFlower }) {
    const geoRock = new THREE.DodecahedronGeometry(2.5, 0);
    const geoBush = new THREE.IcosahedronGeometry(2, 0);
    const geoFlower = new THREE.OctahedronGeometry(0.35, 0);

    const ROCK_COUNT = 0;
    const BUSH_COUNT = 0;
    const FLOWER_COUNT = 0;

    const instRocks = new THREE.InstancedMesh(geoRock, matRock, Math.max(1, ROCK_COUNT));
    instRocks.count = ROCK_COUNT;
    instRocks.visible = false;
    scene.add(instRocks);

    const instBushes = new THREE.InstancedMesh(geoBush, matBush, Math.max(1, BUSH_COUNT));
    instBushes.count = BUSH_COUNT;
    instBushes.visible = false;
    scene.add(instBushes);

    const instFlowers = new THREE.InstancedMesh(geoFlower, matFlower, Math.max(1, FLOWER_COUNT));
    instFlowers.count = FLOWER_COUNT;
    instFlowers.visible = false;
    if (FLOWER_COUNT > 0) scene.add(instFlowers);

    const ICEBERG_COUNT = 40;
    const iceGeos = [];
    const iceBase = new THREE.ConeGeometry(5.0, 8, 5);
    iceBase.translate(0, 2.0, 0);
    iceGeos.push(iceBase);
    const icePeak = new THREE.ConeGeometry(3.0, 6, 4);
    icePeak.translate(0.8, 6.5, 0.5);
    icePeak.rotateZ(0.12);
    iceGeos.push(icePeak);
    const iceShoulder = new THREE.DodecahedronGeometry(3.5, 0);
    iceShoulder.scale(1.3, 0.7, 1.1);
    iceShoulder.translate(-1.5, 2.5, 1.0);
    iceGeos.push(iceShoulder);
    const iceSub = new THREE.ConeGeometry(4.5, 5, 5);
    iceSub.translate(0, -1.5, 0);
    iceSub.rotateX(Math.PI);
    iceGeos.push(iceSub);
    const geoIceberg = BufferGeometryUtils.mergeGeometries(iceGeos.map(g => g.index ? g.toNonIndexed() : g), false);

    const matIceberg = new THREE.MeshStandardMaterial({
        vertexColors: false,
        color: 0x8adeef,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
    });
    const instIcebergs = new THREE.InstancedMesh(geoIceberg, matIceberg, ICEBERG_COUNT);
    const tmpIce = new THREE.Object3D();
    for (let i = 0; i < ICEBERG_COUNT; i++) {
        tmpIce.position.set(0, -1000, 0);
        tmpIce.updateMatrix();
        instIcebergs.setMatrixAt(i, tmpIce.matrix);
    }
    scene.add(instIcebergs);

    return {
        instRocks,
        instBushes,
        instFlowers,
        instIcebergs,
        ROCK_COUNT,
        BUSH_COUNT,
        FLOWER_COUNT,
        ICEBERG_COUNT
    };
}

export function shiftDiorama(dioramaSystem, shiftX, shiftZ, shiftInstancedMeshFn) {
    if (!dioramaSystem) return;
    const { instRocks, instBushes, instFlowers, instIcebergs, ROCK_COUNT, BUSH_COUNT, FLOWER_COUNT, ICEBERG_COUNT } = dioramaSystem;
    if (instRocks && ROCK_COUNT > 0) shiftInstancedMeshFn(instRocks, ROCK_COUNT, shiftX, shiftZ);
    if (instBushes && BUSH_COUNT > 0) shiftInstancedMeshFn(instBushes, BUSH_COUNT, shiftX, shiftZ);
    if (instFlowers && FLOWER_COUNT > 0) shiftInstancedMeshFn(instFlowers, FLOWER_COUNT, shiftX, shiftZ);
    if (instIcebergs && ICEBERG_COUNT > 0) shiftInstancedMeshFn(instIcebergs, ICEBERG_COUNT, shiftX, shiftZ);
}
