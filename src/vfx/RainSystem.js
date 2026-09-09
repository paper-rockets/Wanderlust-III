import * as THREE from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { uniform, float, vec2, vec3, vec4, mod, attribute, positionLocal } from 'three/tsl';

export class RainSystem {
    constructor(scene) {
        this.scene = scene;
        this.count = 30000;
        const positions = new Float32Array(this.count * 3);
        const rand = new Float32Array(this.count);
        for (let i = 0; i < this.count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 300;
            positions[i * 3 + 1] = Math.random() * 100;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
            rand[i] = Math.random();
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

        const uTime = uniform(0.0);
        const uCamPos = uniform(new THREE.Vector3());
        const uSize = uniform(2.0);
        const uWind = uniform(new THREE.Vector2(0, 0));
        const uIntensity = uniform(1.0);
        const uAngle = uniform(0.0);

        this.uniforms = { uTime, uCamPos, uSize, uWind, uIntensity, uAngle };

        const aRand = attribute('aRand', 'float');

        // Animating falling rain in local space on GPU
        const fallY = uTime.mul(float(90.0).add(aRand.mul(30.0))).mul(uIntensity);
        const wrappedY = mod(positionLocal.y.sub(fallY), 100.0);
        const driftX = uTime.mul(uWind.x).mul(15.0);
        const driftZ = uTime.mul(uWind.y).mul(15.0);
        const wrappedX = mod(positionLocal.x.add(driftX).add(150.0), 300.0).sub(150.0);
        const wrappedZ = mod(positionLocal.z.add(driftZ).add(150.0), 300.0).sub(150.0);

        const material = new PointsNodeMaterial({
            transparent: true,
            depthWrite: false,
            colorNode: vec4(0.5, 0.6, 0.85, uIntensity.mul(0.65)),
            sizeNode: uSize.mul(aRand.mul(0.4).add(0.6)),
            positionNode: vec3(wrappedX, wrappedY, wrappedZ)
        });

        this.mesh = new THREE.Points(geometry, material);
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        this.scene.add(this.mesh);
    }

    update(time, cam, params) {
        if (!params || !cam) return;
        this.mesh.visible = !!params.rain;
        if (!params.rain) return;
        this.mesh.position.copy(cam.position);
        this.mesh.position.y -= 30.0; // Offset downward to keep camera inside the 0-100 fall box

        this.uniforms.uTime.value = time;
        this.uniforms.uCamPos.value.copy(cam.position);
        this.uniforms.uSize.value = params.rainSize || 2.0;
        this.uniforms.uIntensity.value = params.rainIntensity || 1.0;

        let wx = 1.0;
        let wy = 0.5;
        if (params.rainWindX !== undefined) {
            wx = params.rainWindX;
            wy = params.rainWindY;
        }
        this.uniforms.uWind.value.set(wx, wy);
        this.uniforms.uAngle.value = Math.atan2(wx * 20.0, -70.0);
    }
}
