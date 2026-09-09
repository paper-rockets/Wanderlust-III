import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshToonNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, positionWorld, normalWorld, cameraPosition,
    modelWorldMatrix, fract, sin, cos, max, pow, normalize, dot
} from 'three/tsl';

const PINE_FILES = [
    { key: 'pine_01_rugged',   path: 'assets/models/trees_baked/pine_tree_01.glb', fallbackPath: 'assets/models/trees_low/pine_tree_01.glb', targetHeight: 6.5,  isCluster: false, footprintRadius: 3.5,  boundingRadius: 8.5 },
    { key: 'pine_05_tall',     path: 'assets/models/trees_baked/pine_tree_05.glb', fallbackPath: 'assets/models/trees_low/pine_tree_05.glb', targetHeight: 9.5,  isCluster: false, footprintRadius: 4.5,  boundingRadius: 10.5 },
    { key: 'pine_06_ancient',  path: 'assets/models/trees_baked/pine_tree_06.glb', fallbackPath: 'assets/models/trees_low/pine_tree_06.glb', targetHeight: 11.5, isCluster: false, footprintRadius: 5.5,  boundingRadius: 12.5 },
    { key: 'pine_07_slender',  path: 'assets/models/trees_baked/pine_tree_07.glb', fallbackPath: 'assets/models/trees_low/pine_tree_07.glb', targetHeight: 4.5,  isCluster: false, footprintRadius: 2.8,  boundingRadius: 6.5 }
];

// 2 LOD bands (0-200m near full 3D, 200-500m far plus impostor)
const LOD_BANDS = [
    { name: 'near', maxDist: 200, isImpostor: false, doubleSided: true, sway: true,  alphaTest: 0.50 },
    { name: 'mid',  maxDist: 500, isImpostor: true,  doubleSided: true, sway: false, alphaTest: 0.40 }
];

const DEFAULT_CELL_SIZE = 32.0;
const REBUILD_DISTANCE = 30.0;
const REBUILD_ROT_DIFF = 0.25;
const REBUILD_FRAMES = 8;

function cellHash(cx, cz, slot) {
    let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class StylizedPineSystemLowPower {
    constructor(opts) {
        this.scene = opts.scene;
        this.camera = opts.camera || null;
        this.gltfLoader = opts.gltfLoader;
        this.resolveAssetUrl = opts.resolveAssetUrl || ((p) => p);
        this.uTime = opts.uTime;
        this.gradientMap = opts.gradientMap || null;
        this.getWorldHeight = opts.getWorldHeight;
        this.getBiomeAt = opts.getBiomeAt;
        this.getIslandData = opts.getIslandData;
        this.getPathStrength = opts.getPathStrength || (() => 0);
        this.densityScale = opts.densityScale !== undefined ? opts.densityScale : 0.4;
        this.uSunDir = opts.uSunDir || uniform(new THREE.Vector3(0.3, 0.8, 0.5));

        this.ready = false;
        this.enabled = true;
        this.meshes = [];
        this._byVariantBand = [];
        this._dummy = new THREE.Object3D();
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._lastCamYaw = 0;
        this._walk = null;
        this._collected = [];
        this.lastCounts = { near: 0, mid: 0 };
        this.leafTexture = null;
        this.impostorTexture = null;

        // Frustum Culling
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();
        this._sphere = new THREE.Sphere();

        // Shading Uniforms
        this.uLeafBottom     = uniform(new THREE.Color('#1c3b23'));
        this.uLeafTop        = uniform(new THREE.Color('#5c8338'));
        this.uLeafVarColor   = uniform(new THREE.Color('#1e4430'));
        this.uLeafBrightness = uniform(1.05);
        this.uLeafGradPower  = uniform(1.1);
        this.uLeafVarStrength= uniform(0.5);

        this.uBarkBase       = uniform(new THREE.Color('#2e1b10'));
        this.uBarkTop        = uniform(new THREE.Color('#5c3a21'));
        this.uBarkBrightness = uniform(1.35);

        this.uWindStrength   = uniform(0.8);
        this.uTreeScale      = uniform(1.0);

        // Low-power pool sizes (per variant)
        this.poolSizes = {
            near: 350,
            mid:  800
        };

        this.minElevation = 5.5;
        this.maxElevation = 140.0;
        this.maxSlope = 0.52;
        this.rootEmbed = 0.35;
        this.density = 0.55;
        this.scaleMul = 1.0;
        this.cellSize = DEFAULT_CELL_SIZE;
        this.currentPreset = 'auto';
    }

    _generateImpostorTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);

        // Trunk
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(122, 195, 12, 61);

        // Wide layered needle skirts
        const skirts = [
            { topY: 135, botY: 225, w: 118, cutCount: 8, depth: 7 },
            { topY: 100, botY: 180, w: 102, cutCount: 7, depth: 6 },
            { topY: 65,  botY: 138, w: 84,  cutCount: 6, depth: 5 },
            { topY: 35,  botY: 98,  w: 62,  cutCount: 5, depth: 4 },
            { topY: 12,  botY: 60,  w: 41,  cutCount: 4, depth: 3 },
            { topY: 3,   botY: 30,  w: 21,  cutCount: 3, depth: 2 }
        ];

        skirts.forEach(s => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(128, s.topY);
            ctx.lineTo(128 + s.w, s.botY);
            for (let i = s.cutCount; i >= -s.cutCount; i--) {
                const px = 128 + (i / s.cutCount) * s.w;
                const py = s.botY + (Math.abs(i) % 2 === 1 ? -s.depth : s.depth * 0.5);
                ctx.lineTo(px, py);
            }
            ctx.lineTo(128 - s.w, s.botY);
            ctx.closePath();
            ctx.fill();
        });

        this.impostorTexture = new THREE.CanvasTexture(canvas);
        this.impostorTexture.generateMipmaps = true;
        this.impostorTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.impostorTexture.magFilter = THREE.LinearFilter;
        this.impostorTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.impostorTexture.wrapT = THREE.ClampToEdgeWrapping;
    }

    _buildPlusSignGeometry() {
        const geo = new THREE.BufferGeometry();
        const baseW = 1.95 * 1.65;
        const h = 9.5;

        const angles = [0, Math.PI / 2];
        const positions = [];
        const uvs = [];
        const normals = [];
        const indices = [];

        angles.forEach((ang, qIdx) => {
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);

            const x0 = -baseW * cosA, z0 = -baseW * sinA;
            const x1 =  baseW * cosA, z1 =  baseW * sinA;

            const base = qIdx * 4;
            positions.push(
                x0, 0, z0,
                x1, 0, z1,
                x1, h, z1,
                x0, h, z0
            );

            uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

            const nx = -sinA, nz = cosA;
            normals.push(
                nx, 0.15, nz,
                nx, 0.15, nz,
                nx, 0.15, nz,
                nx, 0.15, nz
            );

            indices.push(
                base, base + 1, base + 2,
                base, base + 2, base + 3
            );
        });

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingBox();
        return geo;
    }

    async load() {
        this._generateImpostorTexture();
        const plusSignGeo = this._buildPlusSignGeometry();

        const gltfs = await Promise.all(PINE_FILES.map(f =>
            new Promise((res) => {
                const cleanPath = f.path.replace(/^\.?\//, '');
                const cleanFallback = (f.fallbackPath || '').replace(/^\.?\//, '');
                const candidateUrls = [
                    this.resolveAssetUrl(cleanPath),
                    cleanFallback ? this.resolveAssetUrl(cleanFallback) : null
                ].filter(Boolean);

                const tryLoad = (idx) => {
                    if (idx >= candidateUrls.length) {
                        console.warn(`[StylizedPineSystemLowPower] Failed to load pine model for ${f.key}`);
                        return res(null);
                    }
                    this.gltfLoader.load(
                        candidateUrls[idx],
                        (gltf) => res(gltf),
                        undefined,
                        () => tryLoad(idx + 1)
                    );
                };
                tryLoad(0);
            })
        ));

        gltfs.forEach(gltf => {
            if (gltf && !this.leafTexture) {
                gltf.scene.traverse(c => {
                    if (c.isMesh && c.material && !this.leafTexture) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(m => {
                            if (!m || !m.map || this.leafTexture) return;
                            const matName = (m.name || '').toLowerCase();
                            const meshName = (c.name || '').toLowerCase();
                            const isBark = matName.includes('trunk') || matName.includes('bark') ||
                                           meshName.includes('trunk') || meshName.includes('bark');
                            if (!isBark) {
                                this.leafTexture = m.map;
                            }
                        });
                    }
                });
            }
        });

        gltfs.forEach((gltf, vi) => {
            const geoHero = gltf ? this._extractMergedGeometry(gltf, PINE_FILES[vi].targetHeight) : null;

            const row = [];
            LOD_BANDS.forEach((band) => {
                const mat = this._buildMaterial(band);
                const count = this.poolSizes[band.name] || 350;

                const baseGeo = (band.isImpostor || !geoHero) ? plusSignGeo.clone() : geoHero.clone();
                const instGeo = baseGeo.clone();
                const seasonArr = new Float32Array(count);
                instGeo.setAttribute('aSeason', new THREE.InstancedBufferAttribute(seasonArr, 1));

                const mesh = new THREE.InstancedMesh(instGeo, mat, count);
                mesh.name = `${PINE_FILES[vi].key}_${band.name}`;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.count = 0;
                mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), band.maxDist + 40);
                mesh.frustumCulled = false;
                this.scene.add(mesh);
                row.push(mesh);
                this.meshes.push(mesh);
            });
            this._byVariantBand.push(row);
        });

        this.ready = this._byVariantBand.length > 0;
        return this.ready;
    }

    _extractMergedGeometry(gltf, targetHeight) {
        gltf.scene.updateMatrixWorld(true);
        const subGeos = [];

        gltf.scene.traverse(c => {
            if (c.isMesh && c.geometry) {
                const g = c.geometry.clone();
                g.applyMatrix4(c.matrixWorld);

                let barkAttr = g.attributes._aisbark || g.attributes.aIsBark;
                if (!barkAttr) {
                    const m = Array.isArray(c.material) ? c.material[0] : c.material;
                    const matName = (m && m.name) ? m.name.toLowerCase() : '';
                    const meshName = (c.name || '').toLowerCase();
                    const isBark = meshName.includes('trunk') || meshName.includes('bark') ||
                                   matName.includes('trunk') || matName.includes('bark') ? 1.0 : 0.0;

                    const nVerts = g.attributes.position.count;
                    const barkArr = new Float32Array(nVerts).fill(isBark);
                    barkAttr = new THREE.BufferAttribute(barkArr, 1);
                }
                g.setAttribute('aIsBark', barkAttr);

                if (g.attributes.normal) g.computeVertexNormals();
                if (g.attributes.tangent) g.deleteAttribute('tangent');

                subGeos.push(g);
            }
        });

        if (subGeos.length === 0) return null;

        let merged = subGeos.length === 1 ? subGeos[0] : BufferGeometryUtils.mergeGeometries(subGeos, false);
        if (!merged) return null;

        merged.computeBoundingBox();
        const bb = merged.boundingBox;
        const h = bb.max.y - bb.min.y;
        const s = h > 0 ? targetHeight / h : 1.0;
        merged.translate(0, -bb.min.y, 0);
        merged.scale(s, s, s);

        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        return merged;
    }

    _buildMaterial(band) {
        const tex = band.isImpostor ? this.impostorTexture : this.leafTexture;

        const mat = new MeshToonNodeMaterial({
            map: tex || null,
            side: band.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            alphaTest: band.alphaTest,
            transparent: false,
            depthWrite: true,
            depthTest: true,
            dithering: false
        });

        const aIsBark = attribute('aIsBark', 'float');
        const aSeason = attribute('aSeason', 'float');

        if (tex) {
            const texMap = texture(tex, uv());
            const finalAlpha = mix(texMap.a, float(1.0), aIsBark);
            mat.opacityNode = finalAlpha;
            mat.alphaNode = finalAlpha;
        }

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(8.5), 0.0, 1.0);
            const isAutumn = smoothstep(float(0.4), float(0.6), aSeason);
            const isWinter = smoothstep(float(1.4), float(1.6), aSeason);

            const autumnLeafBottom = vec3(0.40, 0.15, 0.05);
            const autumnLeafTop    = vec3(0.95, 0.45, 0.08);

            const winterLeafBottom = vec3(0.12, 0.22, 0.26);
            const winterLeafTop    = vec3(0.85, 0.92, 0.96);

            const nonWinterBottom = mix(this.uLeafBottom, autumnLeafBottom, isAutumn);
            const nonWinterTop    = mix(this.uLeafTop, autumnLeafTop, isAutumn);

            const curLeafBottom   = mix(nonWinterBottom, winterLeafBottom, isWinter);
            const curLeafTop      = mix(nonWinterTop, winterLeafTop, isWinter);

            const gradT = pow(localY, this.uLeafGradPower);
            const foliageCol = mix(curLeafBottom, curLeafTop, gradT).mul(this.uLeafBrightness);

            const warmBarkBase = this.uBarkBase;
            const warmBarkTop  = this.uBarkTop;
            const coolBarkBase = vec3(0.13, 0.14, 0.15);
            const coolBarkTop  = vec3(0.28, 0.30, 0.31);

            const curBarkBase = mix(warmBarkBase, coolBarkBase, isWinter);
            const curBarkTop  = mix(warmBarkTop, coolBarkTop, isWinter);
            const barkCol = mix(curBarkBase, curBarkTop, smoothstep(float(0.0), float(0.6), localY)).mul(this.uBarkBrightness);

            return mix(foliageCol, barkCol, aIsBark);
        })();

        mat.emissiveNode = Fn(() => {
            const viewDir = normalize(cameraPosition.sub(positionWorld));
            const lightDir = normalize(this.uSunDir);
            const norm = normalize(normalWorld);

            // Subsurface scattering when looking toward the sun through needle canopy
            const backDot = clamp(dot(viewDir.negate(), lightDir), 0.0, 1.0);
            const foliageRim = pow(float(1.0).sub(clamp(dot(norm, viewDir), 0.0, 1.0)), 2.8);
            const sunSubsurface = pow(backDot, 3.2).mul(foliageRim.mul(1.2).add(0.15)).mul(vec3(0.08, 0.18, 0.04));

            // Soft atmospheric sky bounce on upward surfaces
            const skyBounce = clamp(norm.y.mul(0.5).add(0.5), 0.0, 1.0).mul(vec3(0.01, 0.025, 0.04));

            return sunSubsurface.add(skyBounce).mul(float(1.0).sub(aIsBark));
        })();

        if (band.sway) {
            mat.positionNode = Fn(() => {
                const p = positionLocal.toVar();
                const speed = 1.2;
                const str = this.uWindStrength;
                const wave = sin(this.uTime.mul(speed)).mul(0.06).add(cos(this.uTime.mul(speed.mul(1.5))).mul(0.03));
                const heightFactor = clamp(positionGeometry.y.div(8.0), 0.0, 1.0);
                const mask = heightFactor.mul(heightFactor);
                const totalSway = wave.mul(mask).mul(str);

                p.x.addAssign(totalSway);
                p.z.addAssign(totalSway.mul(0.6));
                return p;
            })();
        }

        return mat;
    }

    _isValidSite(cx, cz, footprintRadius = 3.5, isCluster = false) {
        const biome = this.getBiomeAt(cx, cz);
        if (!biome || !biome.name) return null;

        const bName = biome.name.toLowerCase();

        if (biome.treesOk === false ||
            bName.includes('crystal') ||
            bName.includes('jungle') ||
            bName.includes('magical') ||
            bName.includes('sanctuary') ||
            bName.includes('desert') ||
            bName.includes('ocean')) {
            return null;
        }

        const isAllowed = biome.treesOk === true ||
                          bName.includes('archipelago') ||
                          bName.includes('ghibli') ||
                          bName.includes('misty') ||
                          bName.includes('mountain') ||
                          bName.includes('plains') ||
                          bName.includes('highland') ||
                          bName.includes('north');
        if (!isAllowed) return null;

        const centerH = this.getWorldHeight(cx, cz);
        if (centerH < this.minElevation || centerH > this.maxElevation) return null;

        const island = this.getIslandData(cx, cz);
        if (!island || island.mask < 0.04) return null;
        if (this.getPathStrength(cx, cz) >= 0.35) return null;

        const isMisty = bName.includes('misty') || bName.includes('mountain') || bName.includes('north');
        return {
            h: centerH,
            isMisty: isMisty
        };
    }

    _visitCell(cx, cz, focusX, focusZ, maxDistSq, out) {
        const cellCenterX = (cx + 0.5) * this.cellSize;
        const cellCenterZ = (cz + 0.5) * this.cellSize;
        const ddx = cellCenterX - focusX;
        const ddz = cellCenterZ - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq > maxDistSq) return;

        const effDensity = this.density * this.densityScale;
        if (effDensity < 0.15) return;

        const jx = (cellHash(cx, cz, 1) - 0.5) * 0.8;
        const jz = (cellHash(cx, cz, 2) - 0.5) * 0.8;
        const px = (cx + 0.5 + jx) * this.cellSize;
        const pz = (cz + 0.5 + jz) * this.cellSize;

        const vIdx = Math.floor(cellHash(cx, cz, 3) * PINE_FILES.length) % PINE_FILES.length;
        const cfg = PINE_FILES[vIdx];

        const site = this._isValidSite(px, pz, cfg.footprintRadius, cfg.isCluster);
        if (site === null) return;

        const dist = Math.sqrt(distSq);
        let season = 0.0;
        if (this.currentPreset === 'auto') {
            if (site.isMisty) season = 2.0;
            else season = (cellHash(cx, cz, 7) < 0.12) ? 1.0 : 0.0;
        } else if (this.currentPreset === 'autumn' || this.currentPreset === 'fall') {
            season = 1.0;
        } else if (this.currentPreset === 'winter') {
            season = 2.0;
        }

        const rotY = cellHash(cx, cz, 4) * Math.PI * 2.0;
        const scaleJitter = 0.85 + cellHash(cx, cz, 5) * 0.35;
        const scale = scaleJitter * this.scaleMul;

        out.push({
            x: px, y: site.h - this.rootEmbed, z: pz,
            variant: vIdx,
            rotY,
            scale,
            season,
            dist
        });
    }

    _commit(focusX, focusZ) {
        const perMeshCount = this._byVariantBand.map(row => row.map(() => 0));
        const dummy = this._dummy;

        this._collected.sort((a, b) => a.dist - b.dist);

        for (const c of this._collected) {
            const band = (c.dist <= 200) ? 0 : 1;

            const row = this._byVariantBand[c.variant];
            if (!row) continue;
            const mesh = row[band];
            if (!mesh) continue;

            const idx = perMeshCount[c.variant][band];
            if (idx >= mesh.instanceMatrix.count) continue;

            dummy.position.set(c.x, c.y, c.z);
            dummy.rotation.set(0, c.rotY, 0);
            dummy.scale.set(c.scale, c.scale, c.scale);
            dummy.updateMatrix();

            mesh.setMatrixAt(idx, dummy.matrix);

            if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.aSeason) {
                mesh.geometry.attributes.aSeason.setX(idx, c.season);
            }

            perMeshCount[c.variant][band] = idx + 1;
        }

        const counts = { near: 0, mid: 0 };
        this._byVariantBand.forEach((row, vi) => {
            row.forEach((mesh, bi) => {
                mesh.count = perMeshCount[vi][bi];
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.aSeason) {
                    mesh.geometry.attributes.aSeason.needsUpdate = true;
                }
                if (bi === 0) counts.near += mesh.count;
                else counts.mid += mesh.count;
            });
        });

        this.lastCounts = counts;
    }

    update(focusX, focusZ, camera = null) {
        if (!this.ready || !this.enabled) return;

        if (this._walk) {
            const w = this._walk;
            const perFrame = Math.ceil(w.total / REBUILD_FRAMES);
            const end = Math.min(w.total, w.i + perFrame);

            for (let i = w.i; i < end; i++) {
                const dx = (i % w.width) - w.radius;
                const dz = ((i / w.width) | 0) - w.radius;
                this._visitCell(w.baseCX + dx, w.baseCZ + dz, w.focusX, w.focusZ, w.maxDistSq, this._collected);
            }
            w.i = end;

            if (w.i >= w.total) {
                this._commit(w.focusX, w.focusZ);
                this._walk = null;
            }
            return;
        }

        const dx = focusX - this._lastFocusX;
        const dz = focusZ - this._lastFocusZ;
        const distMovedSq = dx * dx + dz * dz;

        if (distMovedSq < REBUILD_DISTANCE * REBUILD_DISTANCE) return;

        this._lastFocusX = focusX;
        this._lastFocusZ = focusZ;

        const maxDist = 500.0;
        const radius = Math.ceil(maxDist / this.cellSize);
        const width = radius * 2 + 1;

        this._collected = [];
        this._walk = {
            baseCX: Math.floor(focusX / this.cellSize),
            baseCZ: Math.floor(focusZ / this.cellSize),
            focusX, focusZ,
            maxDistSq: maxDist * maxDist,
            radius, width,
            total: width * width,
            i: 0
        };
    }

    respawn() {
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
        this.meshes.forEach(m => {
            m.count = 0;
            m.instanceMatrix.needsUpdate = true;
        });
    }

    setVisible(visible) {
        this.enabled = visible;
        this.meshes.forEach(m => { m.visible = visible; });
        if (visible) this.respawn();
    }
}
