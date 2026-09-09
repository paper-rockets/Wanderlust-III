import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class AnimatedFlockSystem {
    constructor({ scene, gltfLoader, resolveAssetUrl, count = 25, modelPath, scale = 0.08, rotYOffset = 0, isWarmOnly = false, dayOnly = false, getTimePhase = null, getBiomeAt, altitudeOffset = 60, flockRadius = 80 }) {
        this.scene = scene;
        this.gltfLoader = gltfLoader;
        this.resolveAssetUrl = resolveAssetUrl;
        this.count = count;
        this.modelPath = modelPath;
        this.scale = scale;
        this.rotYOffset = rotYOffset;
        this.isWarmOnly = isWarmOnly;
        this.dayOnly = dayOnly;
        this.getTimePhase = getTimePhase;
        this.getBiomeAt = getBiomeAt;
        this.altitudeOffset = altitudeOffset;
        this.flockRadius = flockRadius;

        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.birds = [];
        this.birdData = new Float32Array(count * 6);
        this.offsets = new Float32Array(count * 3);
        this.rotations = new Float32Array(count * 3);
        this.isReady = false;
        this.visible = true;

        for (let i = 0; i < count; i++) {
            const side = (i % 2 === 0) ? 1 : -1;
            const row = Math.floor(i / 2) + 1;
            this.offsets[i * 3 + 0] = side * row * 12.0 + (Math.random() - 0.5) * 4.0;
            this.offsets[i * 3 + 1] = (Math.random() - 0.5) * 6.0;
            this.offsets[i * 3 + 2] = -row * 16.0 + (Math.random() - 0.5) * 6.0;

            this.birdData[i * 6 + 0] = (Math.random() - 0.5) * 200;
            this.birdData[i * 6 + 1] = 80 + Math.random() * 30;
            this.birdData[i * 6 + 2] = (Math.random() - 0.5) * 200;
            this.birdData[i * 6 + 3] = (Math.random() - 0.5) * 5;
            this.birdData[i * 6 + 4] = (Math.random() - 0.5) * 1;
            this.birdData[i * 6 + 5] = (Math.random() - 0.5) * 5;
        }

        this.loadModel();
    }

    loadModel() {
        const cleanPath = this.modelPath.replace(/^\.?\//, '');
        const candidateUrls = [
            this.resolveAssetUrl(this.modelPath),
            `./${cleanPath}`,
            cleanPath,
            `public/${cleanPath}`,
            `./public/${cleanPath}`
        ];

        const tryLoad = (idx) => {
            if (idx >= candidateUrls.length) {
                console.warn(`[AnimatedFlockSystem] Failed to load ${this.modelPath} from all fallback paths`);
                return;
            }
            const url = candidateUrls[idx];
            this.gltfLoader.load(
                url,
                (gltf) => {
                    const baseScene = gltf.scene;
                    const animations = gltf.animations || [];

                    for (let i = 0; i < this.count; i++) {
                        const birdMesh = SkeletonUtils.clone(baseScene);
                        birdMesh.scale.setScalar(this.scale);

                        let mixer = null;
                        if (animations.length > 0) {
                            mixer = new THREE.AnimationMixer(birdMesh);
                            const action = mixer.clipAction(animations[0]);
                            action.time = Math.random() * (animations[0].duration || 1);
                            mixer.timeScale = 0.85 + Math.random() * 0.3;
                            action.play();
                        }

                        birdMesh.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });

                        this.group.add(birdMesh);
                        this.birds.push({
                            mesh: birdMesh,
                            mixer: mixer
                        });
                    }
                    this.isReady = true;
                },
                undefined,
                () => {
                    tryLoad(idx + 1);
                }
            );
        };
        tryLoad(0);
    }

    setScale(scale) {
        this.scale = scale;
        for (let i = 0; i < this.birds.length; i++) {
            if (this.birds[i].mesh) {
                this.birds[i].mesh.scale.setScalar(scale);
            }
        }
    }

    update(playerPos, time, dt, velocity = 35) {
        if (!this.isReady) return;

        if (this.dayOnly) {
            let currentPhase = null;
            if (typeof this.getTimePhase === 'function') {
                currentPhase = this.getTimePhase();
            } else if (typeof window !== 'undefined' && typeof window.getTimePhase === 'function') {
                currentPhase = window.getTimePhase();
            } else if (typeof window !== 'undefined' && window.timePhase !== undefined) {
                currentPhase = window.timePhase;
            }
            if (currentPhase === 2) {
                this.group.visible = false;
                return;
            }
        }

        if (this.isWarmOnly && this.getBiomeAt && playerPos) {
            const biome = this.getBiomeAt(playerPos.x, playerPos.z);
            const warmBiomes = ['Archipelago', 'Lush Jungle', 'Desert Dunes'];
            const isWarm = biome && warmBiomes.includes(biome.name);
            this.group.visible = isWarm && this.visible;
            if (!isWarm || !this.visible) return;
        } else {
            this.group.visible = this.visible;
            if (!this.visible) return;
        }

        const count = this.count;
        const data = this.birdData;

        // Dynamic periodic swoop: birds gently descend closer to the player then climb high again
        const swoopWave = Math.sin(time * 0.12);
        const dynamicAltitude = this.altitudeOffset - (swoopWave > 0 ? swoopWave * 35.0 : 0);
        const dynamicForwardZ  = 40.0 - (swoopWave > 0 ? swoopWave * 20.0 : 0);

        const tX = playerPos ? playerPos.x : 0;
        const tY = (playerPos ? playerPos.y : 50) + dynamicAltitude;
        const tZ = (playerPos ? playerPos.z : 0) + dynamicForwardZ;
        const centerPull = 3.5;

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
                vx += (cx - px) * 0.25 * dt;
                vy += (cy - py) * 0.25 * dt;
                vz += (cz - pz) * 0.25 * dt;
                vx += (ax - vx) * 0.1 * dt;
                vy += (ay - vy) * 0.1 * dt;
                vz += (az - vz) * 0.1 * dt;
            }

            vx += sx * 1.0 * dt; vy += sy * 1.0 * dt; vz += sz * 1.0 * dt;

            let targetX = tX + this.offsets[i * 3 + 0];
            let targetY = tY + this.offsets[i * 3 + 1] + Math.sin(time * 1.2 + i * 0.4) * 3.0;
            let targetZ = tZ + this.offsets[i * 3 + 2];

            let tx = targetX - px, ty = targetY - py, tz = targetZ - pz;
            let dToT = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (dToT > 5) {
                let pullFactor = (dToT > 120) ? centerPull * 2.5 : centerPull * 0.7;
                vx += (tx / dToT) * pullFactor * dt;
                vy += (ty / dToT) * pullFactor * dt;
                vz += (tz / dToT) * pullFactor * dt;
            }

            let maxSpd = Math.max(28, velocity * 1.0);
            let spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (spd > maxSpd) { vx *= maxSpd / spd; vy *= maxSpd / spd; vz *= maxSpd / spd; }
            if (spd < 10) { vx *= 10 / spd; vy *= 10 / spd; vz *= 10 / spd; }

            px += vx * dt; py += vy * dt; pz += vz * dt;
            data[i * 6 + 0] = px; data[i * 6 + 1] = py; data[i * 6 + 2] = pz;
            data[i * 6 + 3] = vx; data[i * 6 + 4] = vy; data[i * 6 + 5] = vz;

            const bird = this.birds[i];
            if (bird && bird.mesh) {
                bird.mesh.position.set(px, py, pz);

                let targetYaw = Math.atan2(vx, vz) + this.rotYOffset;
                let targetPitch = -Math.atan2(vy, Math.sqrt(vx * vx + vz * vz));
                let targetRoll = Math.max(-0.35, Math.min(0.35, sx * 0.02));

                let curPitch = this.rotations[i * 3 + 0];
                let curYaw   = this.rotations[i * 3 + 1];
                let curRoll  = this.rotations[i * 3 + 2];

                let lerpSpeed = Math.min(1.0, dt * 5.0);
                let diffYaw = Math.atan2(Math.sin(targetYaw - curYaw), Math.cos(targetYaw - curYaw));
                curYaw += diffYaw * lerpSpeed;
                curPitch += (targetPitch - curPitch) * lerpSpeed;
                curRoll += (targetRoll - curRoll) * lerpSpeed;

                this.rotations[i * 3 + 0] = curPitch;
                this.rotations[i * 3 + 1] = curYaw;
                this.rotations[i * 3 + 2] = curRoll;

                bird.mesh.rotation.set(curPitch, curYaw, curRoll, 'YXZ');

                if (bird.mixer) {
                    bird.mixer.update(dt);
                }
            }
        }
    }
}
