// FlightModelManager.js
// Manages loading, caching, orientation calibration, animation mixers, and dynamic cycling of all flight models.

import * as THREE from 'three';
import { FLIGHT_MODELS } from '../config/FlightModelsConfig.js';
export { FLIGHT_MODELS };

export class FlightModelManager {
    constructor(parentGroup, gltfLoader, resolveAssetUrlFn) {
        this.parentGroup = parentGroup;
        this.gltfLoader = gltfLoader;
        this.resolveAssetUrl = resolveAssetUrlFn || ((p) => p);
        
        this.models = FLIGHT_MODELS;
        this.currentIndex = 0;
        this.currentWrapper = null;
        this.currentInner = null;
        this.currentMixer = null;
        this.isVisible = true;
        this.animSpeed = 1.0;
        
        // Cache loaded models to enable instant switching
        this.cache = new Map(); // id -> { root, wrapper, inner, mixer, animations, baseScale, cfg }
        this.isLoading = false;
        
        // Toast Notification DOM
        this._initToast();
    }

    _initToast() {
        if (typeof document === 'undefined') return;
        let toast = document.getElementById('flight-model-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'flight-model-toast';
            toast.style.cssText = `
                position: fixed;
                top: 64px;
                left: 50%;
                transform: translateX(-50%) translateY(-12px);
                background: rgba(15, 20, 30, 0.92);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.25);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 0.5px;
                padding: 8px 20px;
                border-radius: 20px;
                pointer-events: none;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
            `;
            document.body.appendChild(toast);
        }
        this.toastEl = toast;
    }

    showToast(message) {
        if (!this.toastEl) return;
        this.toastEl.innerHTML = `<span>${message}</span>`;
        this.toastEl.style.opacity = '1';
        this.toastEl.style.transform = 'translateX(-50%) translateY(0px)';
        
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            if (this.toastEl) {
                this.toastEl.style.opacity = '0';
                this.toastEl.style.transform = 'translateX(-50%) translateY(-12px)';
            }
        }, 2200);
    }

    getCurrentConfig() {
        return this.models[this.currentIndex];
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    getAllModels() {
        return this.models;
    }

    setVisible(visible) {
        this.isVisible = !!visible;
        if (this.currentWrapper) {
            this.currentWrapper.visible = this.isVisible;
        }
    }

    getVisible() {
        return this.isVisible;
    }

    setAnimSpeed(speed) {
        this.animSpeed = Math.max(0.1, speed);
        if (this.currentMixer) {
            this.currentMixer.timeScale = this.animSpeed;
        }
    }

    nextModel(silent = false) {
        const nextIdx = (this.currentIndex + 1) % this.models.length;
        return this.loadModelByIndex(nextIdx, silent);
    }

    prevModel(silent = false) {
        const prevIdx = (this.currentIndex - 1 + this.models.length) % this.models.length;
        return this.loadModelByIndex(prevIdx, silent);
    }

    setModelById(id, silent = false) {
        const idx = this.models.findIndex(m => m.id === id);
        if (idx !== -1) {
            return this.loadModelByIndex(idx, silent);
        }
        return Promise.reject(new Error(`Model id "${id}" not found.`));
    }

    loadModelByIndex(index, silent = false) {
        if (index < 0 || index >= this.models.length) return Promise.reject(new Error("Index out of bounds"));
        this.currentIndex = index;
        const cfg = this.models[this.currentIndex];

        // Check if already in cache
        if (this.cache.has(cfg.id)) {
            const cached = this.cache.get(cfg.id);
            this._activateModel(cached, cfg, silent);
            return Promise.resolve(cached);
        }

        this.isLoading = true;
        const cleanFile = cfg.file.replace(/^\.?\//, '');
        const candidateUrls = [
            this.resolveAssetUrl(cfg.file),
            `./${cleanFile}`,
            cleanFile,
            `public/${cleanFile}`,
            `./public/${cleanFile}`
        ];

        return new Promise((resolve, reject) => {
            const tryLoad = (idx) => {
                if (idx >= candidateUrls.length) {
                    this.isLoading = false;
                    console.warn(`[FlightModelManager] Failed to load ${cfg.file} from all fallback URLs`);
                    return reject(new Error(`Failed to load ${cfg.file}`));
                }
                const url = candidateUrls[idx];
                this.gltfLoader.load(
                    url,
                    (gltf) => {
                        this.isLoading = false;
                        const root = gltf.scene;
                        
                        // Calculate exact bounding box to center geometry
                        const rawBox = new THREE.Box3().setFromObject(root);
                        const rawSize = new THREE.Vector3();
                        rawBox.getSize(rawSize);
                        const rawCenter = new THREE.Vector3();
                        rawBox.getCenter(rawCenter);

                        const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z);
                        const baseScale = maxDim > 0 ? (2.0 / maxDim) : 1.0;

                        const wrapper = new THREE.Group();
                        const inner = new THREE.Group();

                        // Center mesh inside inner group
                        root.position.x = -rawCenter.x;
                        root.position.y = -rawCenter.y;
                        root.position.z = -rawCenter.z;

                        // Apply shadow casting, double-sided materials, and disable frustum culling
                        root.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                child.frustumCulled = false;
                                if (child.material) {
                                    const applyMatConfig = (m) => {
                                        m.side = THREE.DoubleSide;
                                        if (cfg.transparent !== undefined) {
                                            m.transparent = cfg.transparent;
                                        }
                                        if (cfg.alphaTest !== undefined) {
                                            m.alphaTest = cfg.alphaTest;
                                        }
                                        m.needsUpdate = true;
                                    };
                                    if (Array.isArray(child.material)) {
                                        child.material.forEach(applyMatConfig);
                                    } else {
                                        applyMatConfig(child.material);
                                    }
                                }
                            }
                        });

                        inner.add(root);
                        inner.rotation.x = (cfg.rotX || 0) * Math.PI / 180;
                        inner.rotation.y = (cfg.rotY || 0) * Math.PI / 180;
                        inner.rotation.z = (cfg.rotZ || 0) * Math.PI / 180;

                        wrapper.add(inner);
                        const finalScale = baseScale * (cfg.scale || 1.0);
                        wrapper.scale.set(finalScale, finalScale, finalScale);
                        wrapper.position.y = cfg.offsetY || 0;

                        // Animation Mixer Setup
                        let mixer = null;
                        if (gltf.animations && gltf.animations.length > 0) {
                            mixer = new THREE.AnimationMixer(root);
                            mixer.timeScale = this.animSpeed;
                            let clip = null;
                            if (cfg.anim) {
                                clip = gltf.animations.find(a => a.name === cfg.anim);
                            }
                            if (!clip) clip = gltf.animations[0];
                            if (clip) {
                                const action = mixer.clipAction(clip);
                                action.play();
                            }
                        }

                        const cachedEntry = {
                            root,
                            wrapper,
                            inner,
                            mixer,
                            animations: gltf.animations || [],
                            baseScale,
                            cfg
                        };

                        this.cache.set(cfg.id, cachedEntry);
                        this._activateModel(cachedEntry, cfg, silent);
                        resolve(cachedEntry);
                    },
                    undefined,
                    (err) => {
                        console.warn(`[FlightModelManager] Failed to load model from URL: ${url}. Error:`, err);
                        tryLoad(idx + 1);
                    }
                );
            };
            tryLoad(0);
        });
    }

    _activateModel(entry, cfg, silent = false) {
        if (this.currentWrapper && this.currentWrapper.parent) {
            this.parentGroup.remove(this.currentWrapper);
        }

        this.currentWrapper = entry.wrapper;
        this.currentInner = entry.inner;
        this.currentMixer = entry.mixer;

        this.currentWrapper.visible = this.isVisible;
        this.parentGroup.add(this.currentWrapper);
        this.parentGroup.visible = true;

        if (typeof window !== 'undefined' && window.proxyMesh) {
            window.proxyMesh.visible = false;
        }

        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('wl_saved_model_id', cfg.id);
            } catch (e) {
                // Ignore storage error
            }
        }

        if (!silent) {
            this.showToast(`${cfg.name}`);
        }

        // Trigger custom event for UI updates
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('flight-model-changed', {
                detail: { index: this.currentIndex, config: cfg }
            }));
        }
    }

    update(dt) {
        if (this.currentMixer && this.isVisible) {
            this.currentMixer.update(dt);
        }
    }
}
