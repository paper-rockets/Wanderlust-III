import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export class InstancedProps {
    constructor({ scene, cloudCount = 80, isLowGfx = false }) {
        this.scene = scene;
        this.isLowGfx = isLowGfx;

        // 1. Clouds
        const geoCloud = new THREE.IcosahedronGeometry(25, 2);
        geoCloud.scale(2.0, 1.0, 1.5);
        const cpos = geoCloud.attributes.position;
        for (let i = 0; i < cpos.count; i++) {
            let x = cpos.getX(i);
            let y = cpos.getY(i);
            let z = cpos.getZ(i);
            if (y < 0) {
                y *= 0.3;
            } else {
                let billow = Math.sin(x * 0.2) * Math.cos(z * 0.2) * 4.0;
                y += Math.max(0, billow);
            }
            cpos.setXYZ(i, x, y, z);
        }
        geoCloud.computeVertexNormals();

        const matCloud = new THREE.MeshToonMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.92,
            depthWrite: true
        });

        this.maxCloudCount = 300;
        this.cloudCount = cloudCount;
        this.instClouds = new THREE.InstancedMesh(geoCloud, matCloud, this.maxCloudCount);
        this.instClouds.count = this.cloudCount;
        this.instClouds.frustumCulled = false;
        this.scene.add(this.instClouds);

        // 2. Icebergs
        const iceGeos = [];
        const iceBase = new THREE.ConeGeometry(5.0, 8, 5);
        iceBase.translate(0, 2.0, 0);
        this._applyColor(iceBase, 0x8adeef);
        iceGeos.push(iceBase);

        const icePeak = new THREE.ConeGeometry(3.0, 6, 4);
        icePeak.translate(0.8, 6.5, 0.5);
        icePeak.rotateZ(0.12);
        this._applyColor(icePeak, 0xc5f0fa);
        iceGeos.push(icePeak);

        const iceShoulder = new THREE.DodecahedronGeometry(3.5, 0);
        iceShoulder.scale(1.3, 0.7, 1.1);
        iceShoulder.translate(-1.5, 2.5, 1.0);
        this._applyColor(iceShoulder, 0x67d4e8);
        iceGeos.push(iceShoulder);

        const iceSub = new THREE.ConeGeometry(4.5, 5, 5);
        iceSub.translate(0, -1.5, 0);
        iceSub.rotateX(Math.PI);
        this._applyColor(iceSub, 0x38bdf8);
        iceGeos.push(iceSub);

        const geoIceberg = BufferGeometryUtils.mergeGeometries(iceGeos.map(g => g.index ? g.toNonIndexed() : g), false);
        const matIceberg = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.15,
            metalness: 0.05,
            transparent: true,
            opacity: 0.88,
            side: THREE.DoubleSide
        });
        this.icebergCount = 40;
        this.instIcebergs = new THREE.InstancedMesh(geoIceberg, matIceberg, this.icebergCount);
        const tmpIce = new THREE.Object3D();
        for (let i = 0; i < this.icebergCount; i++) {
            tmpIce.position.set(0, -1000, 0);
            tmpIce.updateMatrix();
            this.instIcebergs.setMatrixAt(i, tmpIce.matrix);
        }
        this.instIcebergs.frustumCulled = false;
        this.scene.add(this.instIcebergs);

        // 3. Wind Trails
        const trailGeo = new THREE.BoxGeometry(0.1, 0.1, 10.0);
        this.trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
        this.instTrails = new THREE.InstancedMesh(trailGeo, this.trailMat, 100);
        this.instTrails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instTrails.frustumCulled = false;
        this.scene.add(this.instTrails);

        this.trailsData = new Float32Array(100 * 4);
        for (let i = 0; i < 100; i++) {
            this.trailsData[i * 4] = (Math.random() - 0.5) * 80;
            this.trailsData[i * 4 + 1] = (Math.random() - 0.5) * 60;
            this.trailsData[i * 4 + 2] = (Math.random() - 0.5) * 100;
            this.trailsData[i * 4 + 3] = Math.random();
        }

        this.dummy = new THREE.Object3D();
    }

    _applyColor(geometry, colorHex) {
        const color = new THREE.Color(colorHex);
        const colors = [];
        const count = geometry.attributes.position.count;
        for (let i = 0; i < count; i++) {
            colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    updateTrails(isWindTrailsOn, isWindOn, isBoosting, velocity, playerGrp, time, dt) {
        if (isWindTrailsOn && isWindOn && playerGrp) {
            this.instTrails.visible = true;
            this.trailMat.opacity = isBoosting ? 0.22 : 0.08;
            for (let i = 0; i < 100; i++) {
                let z = this.trailsData[i * 4 + 2];
                z += (velocity || 18.0) * 3.0 * dt;
                if (z > 50) {
                    z -= 100;
                    this.trailsData[i * 4] = (Math.random() - 0.5) * 80;
                    this.trailsData[i * 4 + 1] = (Math.random() - 0.5) * 60;
                }
                this.trailsData[i * 4 + 2] = z;

                this.dummy.position.set(this.trailsData[i * 4], this.trailsData[i * 4 + 1], z);
                this.dummy.position.x += Math.sin(time * 3.0 + this.trailsData[i * 4 + 3] * 10) * 0.5;
                this.dummy.position.y += Math.cos(time * 3.0 + this.trailsData[i * 4 + 3] * 10) * 0.5;
                this.dummy.scale.set(1.0, 1.0, isBoosting ? 2.5 : 1.0);
                this.dummy.rotation.set(0, 0, 0);
                this.dummy.updateMatrix();
                this.instTrails.setMatrixAt(i, this.dummy.matrix);
            }
            this.instTrails.position.copy(playerGrp.position);
            this.instTrails.rotation.copy(playerGrp.rotation);
            this.instTrails.instanceMatrix.needsUpdate = true;
        } else {
            this.instTrails.visible = false;
        }
    }
}
