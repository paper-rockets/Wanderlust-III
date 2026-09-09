import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, float, vec3, vec4, mix, clamp, dot, normalize, pow, abs, Fn, positionLocal, positionWorld, normalWorld, cameraPosition } from 'three/tsl';

export const CRYSTAL_COUNT = 16;

export class CrystalSystem {
    constructor({ scene }) {
        this.scene = scene;
        this.count = CRYSTAL_COUNT;

        const geoCrystal = new THREE.OctahedronGeometry(1, 1).toNonIndexed();
        geoCrystal.scale(1, 3, 1);
        geoCrystal.computeVertexNormals();

        this.matCrystal = new MeshStandardNodeMaterial({
            roughness: 0.08,
            metalness: 0.15,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });

        this.uCrystalGlow = uniform(0.0);
        this.uBaseGlow = uniform(1.8);
        this.uNightGlowMult = uniform(1.5);

        this.matCrystal.colorNode = Fn(() => {
            const tC = clamp(positionLocal.y.add(3.0).div(6.0), 0.0, 1.0);
            const col1 = vec3(0.42, 0.0, 1.0);
            const col2 = vec3(1.0, 0.0, 0.4);
            const col3 = vec3(0.0, 0.85, 1.0);
            const grad = mix(mix(col1, col2, tC), col3, tC);
            
            // Fresnel rim glow
            const viewDir = normalize(cameraPosition.sub(positionWorld));
            const fresnel = pow(float(1.0).sub(abs(dot(viewDir, normalWorld))), 3.0);
            return vec4(mix(grad, vec3(1.0), fresnel.mul(0.5)), 1.0);
        })();

        this.matCrystal.emissiveNode = Fn(() => {
            const viewDir = normalize(cameraPosition.sub(positionWorld));
            const fresnel = pow(float(1.0).sub(abs(dot(viewDir, normalWorld))), 3.0);
            const innerGlow = fresnel.mul(0.4).add(0.15);
            return vec3(0.6, 0.2, 1.0).mul(this.uBaseGlow.mul(innerGlow).add(this.uCrystalGlow.mul(this.uNightGlowMult)));
        })();

        this.instCrystals = new THREE.InstancedMesh(geoCrystal, this.matCrystal, this.count);
        this.instCrystals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instCrystals.frustumCulled = false;
        this.instCrystals.visible = false;
        this.scene.add(this.instCrystals);

        // Position them far away initially so they don't pop in at 0,0,0
        const dummyC = new THREE.Object3D();
        for (let i = 0; i < this.count; i++) {
            dummyC.position.set(0, -9999, 0);
            dummyC.updateMatrix();
            this.instCrystals.setMatrixAt(i, dummyC.matrix);
        }
        this.instCrystals.instanceMatrix.needsUpdate = true;

        this._initEditorHooks();
    }

    _initEditorHooks() {
        if (typeof document === 'undefined') return;
        const getElem = (id) => document.getElementById(id);
        if (getElem('c-roughness')) {
            getElem('c-roughness').addEventListener('input', (e) => this.matCrystal.roughness = parseFloat(e.target.value));
            getElem('c-metalness').addEventListener('input', (e) => this.matCrystal.metalness = parseFloat(e.target.value));
            getElem('c-transmission').addEventListener('input', (e) => this.matCrystal.transmission = parseFloat(e.target.value));
            getElem('c-thickness').addEventListener('input', (e) => this.matCrystal.thickness = parseFloat(e.target.value));
            getElem('c-fly-opacity').addEventListener('input', (e) => this.matCrystal.opacity = parseFloat(e.target.value));
        }
    }

    shift(shiftX, shiftZ, dummy) {
        if (!dummy) return;
        for (let i = 0; i < this.count; i++) {
            this.instCrystals.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            dummy.position.x -= shiftX;
            dummy.position.z -= shiftZ;
            dummy.updateMatrix();
            this.instCrystals.setMatrixAt(i, dummy.matrix);
        }
        this.instCrystals.instanceMatrix.needsUpdate = true;
    }

    update(inCrystalLand, time, dummy) {
        this.instCrystals.visible = inCrystalLand;
        if (!inCrystalLand || !dummy) return;

        for (let i = 0; i < this.count; i++) {
            this.instCrystals.getMatrixAt(i, dummy.matrix);
            dummy.position.setFromMatrixPosition(dummy.matrix);
            dummy.scale.setFromMatrixScale(dummy.matrix);

            // Floating bob + gentle yaw rotation
            const bob = Math.sin(time * 1.5 + i * 1.2) * 0.3;
            dummy.position.y += bob * 0.05;
            dummy.rotation.y = time * 0.4 + i * 0.8;
            dummy.rotation.x = Math.sin(time * 0.8 + i) * 0.15;
            dummy.rotation.z = Math.cos(time * 0.8 + i) * 0.15;

            dummy.updateMatrix();
            this.instCrystals.setMatrixAt(i, dummy.matrix);
        }
        this.instCrystals.instanceMatrix.needsUpdate = true;
    }
}
