// Stylized Pine Biome Tree System
// =========================================================================================
// 2-Tier Procedural & Draco Distance System:
// - Near (0 to impostorDistance, default 300m): 100% Full 3D Reference Models (pine_tree_01, 05, 06, 07)
// - Far (> impostorDistance to 750m+): Plus-Sign (+) 3D Cross-Quad Impostor Cards (8 tris) ONLY when enabled
// - Overhead Flight Layer: Automatic top-down rosette canopy disk for high-altitude flight (>65m)
// - 100% Unified TSL Material Color and Lighting Parity across all distances

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, positionWorld, normalWorld, cameraPosition,
    modelWorldMatrix, fract, sin, cos, max, pow, abs, normalize, dot
} from 'three/tsl';
import { snoise } from '../world/Noise.js';

// The 4 core Tree Variants on Tier 4 Single-Sided Draco
const PINE_FILES = [
    { key: 'pine_01_rugged',   path: 'assets/models/trees_baked/pine_tree_01.glb', fallbackPath: 'assets/models/trees_low/pine_tree_01.glb', targetHeight: 6.5,  isCluster: false, footprintRadius: 3.5,  boundingRadius: 8.5 },
    { key: 'pine_05_tall',     path: 'assets/models/trees_baked/pine_tree_05.glb', fallbackPath: 'assets/models/trees_low/pine_tree_05.glb', targetHeight: 9.5,  isCluster: false, footprintRadius: 4.5,  boundingRadius: 10.5 },
    { key: 'pine_06_ancient',  path: 'assets/models/trees_baked/pine_tree_06.glb', fallbackPath: 'assets/models/trees_low/pine_tree_06.glb', targetHeight: 11.5, isCluster: false, footprintRadius: 5.5,  boundingRadius: 12.5 },
    { key: 'pine_07_slender',  path: 'assets/models/trees_baked/pine_tree_07.glb', fallbackPath: 'assets/models/trees_low/pine_tree_07.glb', targetHeight: 4.5,  isCluster: false, footprintRadius: 2.8,  boundingRadius: 6.5 }
];

const METRIC_CELL_SIZE = 22.0;
const REBUILD_DISTANCE = 32.0;
const REBUILD_FRAMES = 4;

function hash2D(x, z, seed = 0) {
    let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class StylizedPineSystem {
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
        this.densityScale = opts.densityScale !== undefined ? opts.densityScale : 1.0;
        this.uSunDir = opts.uSunDir || uniform(new THREE.Vector3(0.3, 0.8, 0.5));

        // Tree rendering architecture mode: 'draco', 'hybrid', 'procedural'
        this.treeRenderMode = opts.treeRenderMode || 'hybrid';

        this.ready = false;
        this.enabled = true;
        this.meshes = [];
        this._byVariantBand = [];
        this._dummy = new THREE.Object3D();
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
        this.lastCounts = { hero: 0, impostor: 0, total: 0 };
        this.leafTexture = null;
        this.impostorTexture = null;
        this.overheadTexture = null;

        // 2-Band Manual Settings: Near is 100% full 3D, Far (>300m) is Plus-Sign Impostors
        this.impostorsEnabled = true;      // Enable billboard trees in the far distance
        this.impostorDistance = 300.0;     // Far threshold (>300m only)
        this.impostorDensity = 1.0;        // Impostor density multiplier
        this.impostorWidthFactor = 1.65;   // Wide conifer width multiplier
        this.enableOverheadCanopy = false; // High-altitude canopy is now handled seamlessly by the terrain shader (0 extra meshes)
        this.overheadAltThreshold = 65.0;  // Altitude height trigger (65m)

        // Shading mode: 0.0 = Standard Stylized (Default), 1.0 = Game Toon Shader (Wanderlust Cel)
        this.uToonMode            = uniform(0.0);
        this.shadeMode            = 'standard';

        // 1. Spring Canopy Uniforms (Rich vibrant evergreen pine)
        this.uLeafBottom          = uniform(new THREE.Color('#14351d'));
        this.uLeafMid             = uniform(new THREE.Color('#22582e'));
        this.uLeafTop             = uniform(new THREE.Color('#4c8632'));
        this.uLeafHighlight       = uniform(new THREE.Color('#6ea83e'));
        this.uLeafTeal            = uniform(new THREE.Color('#184232'));
        this.uLeafOlive           = uniform(new THREE.Color('#5e882a'));
        this.uLeafVarColor        = uniform(new THREE.Color('#1a4c28'));
        this.uLeafBrightness      = uniform(1.35);
        this.uLeafGradPower       = uniform(1.05);
        this.uLeafVarStrength     = uniform(0.40);

        // 2. Autumn Canopy Uniforms (Warm golden amber to rich honey russet)
        this.uLeafBottomAutumn    = uniform(new THREE.Color('#481806'));
        this.uLeafMidAutumn       = uniform(new THREE.Color('#9c3810'));
        this.uLeafTopAutumn       = uniform(new THREE.Color('#e06814'));
        this.uLeafHighlightAutumn = uniform(new THREE.Color('#f8a028'));
        this.uLeafVarColorAutumn  = uniform(new THREE.Color('#e89020'));
        this.uLeafBrightnessAutumn= uniform(1.45);
        this.uLeafGradPowerAutumn = uniform(1.10);

        // 3. Winter Canopy Uniforms (Authentic snow and frost palette)
        this.uLeafBottomWinter    = uniform(new THREE.Color('#14282e'));
        this.uLeafMidWinter       = uniform(new THREE.Color('#386672'));
        this.uLeafTopWinter       = uniform(new THREE.Color('#cce6f2'));
        this.uLeafHighlightWinter = uniform(new THREE.Color('#f2faff'));
        this.uLeafVarColorWinter  = uniform(new THREE.Color('#8bb6c9'));
        this.uLeafBrightnessWinter= uniform(1.40);
        this.uLeafGradPowerWinter = uniform(1.15);

        // 4. Trunk Bark Uniforms
        this.uBarkBase            = uniform(new THREE.Color('#24160c'));
        this.uBarkTop             = uniform(new THREE.Color('#5c3a21'));
        this.uBarkBrightness      = uniform(1.65);
        this.uBarkAOStrength      = uniform(0.40);

        // 5. Wind Sway & Flutter Uniforms
        this.uWindStrength        = uniform(0.12);
        this.uWindSpeed           = uniform(1.1);
        this.uLeafFlutterAmp      = uniform(0.02);
        this.uLeafFlutterSpeed    = uniform(2.0);
        this.uLeafDip             = uniform(0.03);

        // 6. 4 Distinct Species Variations (Spring defaults)
        this.uVar1Bottom          = uniform(new THREE.Color('#14351d'));
        this.uVar1Top             = uniform(new THREE.Color('#4c8632'));

        this.uVar2Bottom          = uniform(new THREE.Color('#1c2810'));
        this.uVar2Top             = uniform(new THREE.Color('#6e9432'));

        this.uVar3Bottom          = uniform(new THREE.Color('#14282e'));
        this.uVar3Top             = uniform(new THREE.Color('#38786e'));

        this.uVar4Bottom          = uniform(new THREE.Color('#222810'));
        this.uVar4Top             = uniform(new THREE.Color('#82a438'));

        // Large Pool sizes per band (4,000 near hero * 4 = 16,000 near trees; 6,000 far * 4 = 24,000 far trees)
        this.poolSizes = {
            hero: 4000,     // 16,000 full 3D trees near player
            impostor: 6000  // 24,000 far billboard trees
        };

        // Placement & Metric settings
        this.minElevation = 5.5;
        this.maxElevation = 140.0;
        this.maxSlope = 0.52;
        this.rootEmbed = 0.35;
        this.density = 0.95;
        this.scaleMul = 1.0;
        this.cellSize = METRIC_CELL_SIZE;
        this.currentPreset = 'spring';
        this.heroRadius = 300.0;

        this.overheadMesh = null;
    }

    setImpostorDistance(dist) {
        this.impostorDistance = Math.max(50.0, dist);
        this.heroRadius = this.impostorDistance;
        this.respawn();
    }

    setImpostorDensity(scale) {
        this.impostorDensity = Math.max(0.1, scale);
        this.respawn();
    }

    setImpostorWidth(widthMult) {
        this.impostorWidthFactor = Math.max(0.8, widthMult);
        if (this._plusSignGeo) {
            this._plusSignGeo.dispose();
            this._plusSignGeo = this._buildPlusSignGeometry(this.impostorWidthFactor);
            this._byVariantBand.forEach(row => {
                if (row[1]) row[1].geometry = this._attachInstancedAttributes(this._plusSignGeo.clone(), this.poolSizes.impostor);
            });
        }
    }

    setOverheadCanopyEnabled(enable) {
        this.enableOverheadCanopy = enable;
        if (this.overheadMesh) this.overheadMesh.visible = enable;
        this.respawn();
    }

    setShadeMode(mode) {
        this.shadeMode = mode;
        const isToon = (mode === 'toon' || mode === 'cel' || (typeof mode === 'string' && mode.includes('Cel')));
        this.uToonMode.value = isToon ? 1.0 : 0.0;
    }

    setTreeRenderMode(mode) {
        if (this.treeRenderMode === mode) return;
        this.treeRenderMode = mode;
        this.respawn();
    }

    setPreset(name) {
        this.currentPreset = name;
        if (name === 'autumn' || name === 'fall') {
            this.uVar1Bottom.value.set('#481806'); this.uVar1Top.value.set('#e06814');
            this.uVar2Bottom.value.set('#6e280c'); this.uVar2Top.value.set('#f8a028');
            this.uVar3Bottom.value.set('#3a1405'); this.uVar3Top.value.set('#c85a10');
            this.uVar4Bottom.value.set('#5a2008'); this.uVar4Top.value.set('#f09820');
            this.uBarkBase.value.set('#24160c');
            this.uBarkTop.value.set('#5c3a21');
        } else if (name === 'winter') {
            this.uVar1Bottom.value.set('#14282e'); this.uVar1Top.value.set('#cce6f2');
            this.uVar2Bottom.value.set('#102226'); this.uVar2Top.value.set('#b8dce8');
            this.uVar3Bottom.value.set('#183038'); this.uVar3Top.value.set('#e2f2fa');
            this.uVar4Bottom.value.set('#0e1c20'); this.uVar4Top.value.set('#a4d0e0');
            this.uBarkBase.value.set('#222426');
            this.uBarkTop.value.set('#484c50');
        } else if (name === 'spring' || name === 'auto') {
            this.uVar1Bottom.value.set('#14351d'); this.uVar1Top.value.set('#4c8632');
            this.uVar2Bottom.value.set('#1c2810'); this.uVar2Top.value.set('#6e9432');
            this.uVar3Bottom.value.set('#14282e'); this.uVar3Top.value.set('#38786e');
            this.uVar4Bottom.value.set('#222810'); this.uVar4Top.value.set('#82a438');
            this.uBarkBase.value.set('#24160c');
            this.uBarkTop.value.set('#5c3a21');
        }
        this.respawn();
    }

    _generateImpostorTextures() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 512);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(244, 390, 24, 122);

        const skirts = [
            { topY: 270, botY: 450, w: 236, cutCount: 16, depth: 14 },
            { topY: 200, botY: 360, w: 205, cutCount: 14, depth: 12 },
            { topY: 130, botY: 275, w: 168, cutCount: 12, depth: 10 },
            { topY: 70,  botY: 195, w: 125, cutCount: 10, depth: 8 },
            { topY: 25,  botY: 120, w: 82,  cutCount: 8,  depth: 6 },
            { topY: 6,   botY: 60,  w: 42,  cutCount: 6,  depth: 4 }
        ];

        skirts.forEach(s => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(256, s.topY);
            ctx.lineTo(256 + s.w, s.botY);
            for (let i = s.cutCount; i >= -s.cutCount; i--) {
                const px = 256 + (i / s.cutCount) * s.w;
                const py = s.botY + (Math.abs(i) % 2 === 1 ? -s.depth : s.depth * 0.5);
                ctx.lineTo(px, py);
            }
            ctx.lineTo(256 - s.w, s.botY);
            ctx.closePath();
            ctx.fill();
        });

        this.impostorTexture = new THREE.CanvasTexture(canvas);
        this.impostorTexture.generateMipmaps = true;
        this.impostorTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.impostorTexture.magFilter = THREE.LinearFilter;
        this.impostorTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.impostorTexture.wrapT = THREE.ClampToEdgeWrapping;

        const canvasTop = document.createElement('canvas');
        canvasTop.width = 512;
        canvasTop.height = 512;
        const ctxTop = canvasTop.getContext('2d');
        ctxTop.clearRect(0, 0, 512, 512);

        ctxTop.fillStyle = '#ffffff';
        ctxTop.beginPath();
        const cx = 256, cy = 256, outerR = 240, innerR = 170;
        const points = 24;
        for (let i = 0; i < points * 2; i++) {
            const r = (i % 2 === 0) ? outerR : innerR + (Math.sin(i * 1.5) * 20);
            const a = (i / (points * 2)) * Math.PI * 2;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (i === 0) ctxTop.moveTo(x, y);
            else ctxTop.lineTo(x, y);
        }
        ctxTop.closePath();
        ctxTop.fill();

        ctxTop.fillStyle = '#ffffff';
        ctxTop.beginPath();
        ctxTop.arc(256, 256, 110, 0, Math.PI * 2);
        ctxTop.fill();

        this.overheadTexture = new THREE.CanvasTexture(canvasTop);
        this.overheadTexture.generateMipmaps = true;
        this.overheadTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.overheadTexture.magFilter = THREE.LinearFilter;
        this.overheadTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.overheadTexture.wrapT = THREE.ClampToEdgeWrapping;
    }

    _buildPlusSignGeometry(widthMult = 1.65) {
        const geo = new THREE.BufferGeometry();
        const baseW = 1.95 * widthMult;
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

    _buildOverheadCanopyGeometry(widthMult = 1.65) {
        const geo = new THREE.BufferGeometry();
        const radius = 2.8 * widthMult;
        const h = 6.5;

        const p0 = [-radius, h, -radius];
        const p1 = [ radius, h, -radius];
        const p2 = [ radius, h,  radius];
        const p3 = [-radius, h,  radius];

        const positions = [...p0, ...p1, ...p2, ...p3];
        const uvs = [0, 0, 1, 0, 1, 1, 0, 1];
        const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
        const indices = [0, 1, 2, 0, 2, 3];

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setIndex(indices);
        geo.computeBoundingBox();
        return geo;
    }

    _attachInstancedAttributes(geo, count) {
        const seasonArr = new Float32Array(count).fill(0.0);
        geo.setAttribute('aSeason', new THREE.InstancedBufferAttribute(seasonArr, 1));

        const varArr = new Float32Array(count).fill(0.0);
        geo.setAttribute('aVariation', new THREE.InstancedBufferAttribute(varArr, 1));

        const jitterArr = new Float32Array(count).fill(0.5);
        geo.setAttribute('aColorJitter', new THREE.InstancedBufferAttribute(jitterArr, 1));
        return geo;
    }

    async load() {
        this._generateImpostorTextures();
        this._plusSignGeo = this._buildPlusSignGeometry(this.impostorWidthFactor);
        this._overheadGeo = this._buildOverheadCanopyGeometry(this.impostorWidthFactor);

        const gltfs = await Promise.all(PINE_FILES.map(f =>
            new Promise((res) => {
                const candidateUrls = [
                    this.resolveAssetUrl(f.path),
                    f.fallbackPath ? this.resolveAssetUrl(f.fallbackPath) : null
                ].filter(Boolean);

                const tryLoad = (idx) => {
                    if (idx >= candidateUrls.length) {
                        console.warn(`[StylizedPineSystem] Failed to load pine model for ${f.key}`);
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
                            this.leafTexture = m.map;
                            this.leafTexture.wrapS = THREE.RepeatWrapping;
                            this.leafTexture.wrapT = THREE.RepeatWrapping;
                            this.leafTexture.generateMipmaps = true;
                            this.leafTexture.minFilter = THREE.LinearMipmapLinearFilter;
                            this.leafTexture.magFilter = THREE.LinearFilter;
                            this.leafTexture.needsUpdate = true;
                        });
                    }
                });
            }
        });

        // 2 Bands: 0 = Near Hero 3D, 1 = Far Plus Impostor
        const lodBands = [
            { name: 'hero', maxDist: 750, isImpostor: false, doubleSided: true, sway: true, alphaTest: 0.50 },
            { name: 'impostor', maxDist: 750, isImpostor: true, doubleSided: true, sway: false, alphaTest: 0.40 }
        ];

        gltfs.forEach((gltf, vi) => {
            const row = [];
            const geoHero = gltf ? this._extractMergedGeometry(gltf, PINE_FILES[vi].targetHeight) : null;

            lodBands.forEach((band, bi) => {
                const mat = this._buildMaterial(band);
                const count = this.poolSizes[band.name] || 4000;

                let baseGeo;
                if (band.isImpostor || !geoHero) {
                    baseGeo = this._plusSignGeo.clone();
                } else {
                    baseGeo = geoHero.clone();
                }

                const instGeo = this._attachInstancedAttributes(baseGeo, count);
                const mesh = new THREE.InstancedMesh(instGeo, mat, count);
                mesh.name = `${PINE_FILES[vi].key}_${band.name}`;
                mesh.castShadow = (bi === 0);
                mesh.receiveShadow = true;
                mesh.count = 0;
                mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 800);
                mesh.frustumCulled = true;
                this.scene.add(mesh);
                row.push(mesh);
                this.meshes.push(mesh);
            });
            this._byVariantBand.push(row);
        });

        const overheadMat = this._buildMaterial({ name: 'overhead', isImpostor: true, doubleSided: false, sway: false, alphaTest: 0.40, map: this.overheadTexture });
        const overheadCount = 6000;
        const instOverheadGeo = this._attachInstancedAttributes(this._overheadGeo.clone(), overheadCount);
        this.overheadMesh = new THREE.InstancedMesh(instOverheadGeo, overheadMat, overheadCount);
        this.overheadMesh.name = 'forest_overhead_canopy';
        this.overheadMesh.castShadow = false;
        this.overheadMesh.receiveShadow = true;
        this.overheadMesh.count = 0;
        this.overheadMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 800);
        this.overheadMesh.frustumCulled = true;
        this.scene.add(this.overheadMesh);
        this.meshes.push(this.overheadMesh);

        this.ready = this._byVariantBand.length > 0;
        return this.ready;
    }

    _extractMergedGeometry(gltf, targetHeight = 10.0) {
        gltf.scene.updateMatrixWorld(true);
        const subGeos = [];

        gltf.scene.traverse((c) => {
            if (c.isMesh && c.geometry) {
                const g = c.geometry.clone();
                g.applyMatrix4(c.matrixWorld);

                let barkAttr = g.attributes._aisbark || g.attributes.aIsBark;
                if (!barkAttr) {
                    const m = Array.isArray(c.material) ? c.material[0] : c.material;
                    const mName = (m && m.name ? m.name : '').toLowerCase();
                    const isBark = mName.includes('trunk') || mName.includes('bark') || mName.includes('011') ||
                                   (c.name || '').toLowerCase().includes('trunk') || (c.name || '').toLowerCase().includes('bark');
                    const vCount = g.attributes.position.count;
                    const barkArr = new Float32Array(vCount).fill(isBark ? 1.0 : 0.0);
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
        const tex = band.map || (band.isImpostor ? this.impostorTexture : this.leafTexture);

        const mat = new MeshStandardNodeMaterial({
            map: tex || null,
            roughness: 0.85,
            metalness: 0.02,
            side: band.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            transparent: false,
            alphaTest: band.alphaTest !== undefined ? band.alphaTest : 0.45,
            depthWrite: true,
            depthTest: true,
            dithering: true
        });

        const aIsBark = attribute('aIsBark', 'float');
        const aSeason = attribute('aSeason', 'float');
        const aVariation = attribute('aVariation', 'float');
        const aColorJitter = attribute('aColorJitter', 'float');

        if (tex) {
            const texMap = texture(tex, uv());
            const finalAlpha = mix(texMap.a, float(1.0), aIsBark);
            mat.opacityNode = finalAlpha;
            mat.alphaNode = finalAlpha;
        }

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(8.5), 0.0, 1.0);

            const isVar1 = smoothstep(float(-0.5), float(0.5), aVariation).sub(smoothstep(float(0.5), float(1.5), aVariation));
            const isVar2 = smoothstep(float(0.5), float(1.5), aVariation).sub(smoothstep(float(1.5), float(2.5), aVariation));
            const isVar3 = smoothstep(float(1.5), float(2.5), aVariation).sub(smoothstep(float(2.5), float(3.5), aVariation));
            const isVar4 = smoothstep(float(2.5), float(3.5), aVariation);

            const leafBottom = this.uVar1Bottom.mul(isVar1)
                .add(this.uVar2Bottom.mul(isVar2))
                .add(this.uVar3Bottom.mul(isVar3))
                .add(this.uVar4Bottom.mul(isVar4));

            const leafTop = this.uVar1Top.mul(isVar1)
                .add(this.uVar2Top.mul(isVar2))
                .add(this.uVar3Top.mul(isVar3))
                .add(this.uVar4Top.mul(isVar4));

            const isAutumn = smoothstep(float(0.4), float(0.6), aSeason);
            const isWinter = smoothstep(float(1.4), float(1.6), aSeason);

            const nonWinterBottom = mix(leafBottom, this.uLeafBottomAutumn, isAutumn);
            const nonWinterTop    = mix(leafTop, this.uLeafTopAutumn, isAutumn);
            const nonWinterBright = mix(this.uLeafBrightness, this.uLeafBrightnessAutumn, isAutumn);
            const nonWinterGrad   = mix(this.uLeafGradPower, this.uLeafGradPowerAutumn, isAutumn);

            const curLeafBottom   = mix(nonWinterBottom, this.uLeafBottomWinter, isWinter);
            const curLeafTop      = mix(nonWinterTop, this.uLeafTopWinter, isWinter);
            const curLeafBright   = mix(nonWinterBright, this.uLeafBrightnessWinter, isWinter);
            const curLeafGrad     = mix(nonWinterGrad, this.uLeafGradPowerWinter, isWinter);

            const gradT = pow(localY, curLeafGrad);
            const leafBase = mix(curLeafBottom, curLeafTop, gradT);

            const jitterShift = aColorJitter.sub(0.5).mul(0.24);
            const jitteredFoliage = leafBase.mul(float(1.0).add(jitterShift));

            const canopyAO = mix(float(1.0).sub(this.uBarkAOStrength.mul(0.55)), float(1.0), smoothstep(float(0.0), float(0.75), localY));
            const stdFoliage = jitteredFoliage.mul(curLeafBright).mul(canopyAO);

            const isToon = smoothstep(float(0.4), float(0.6), this.uToonMode);
            const celTone = mix(float(0.45), float(1.0), smoothstep(float(0.12), float(0.60), localY));
            const toonFoliage = jitteredFoliage.mul(curLeafBright).mul(celTone);

            const finalLeafColor = mix(stdFoliage, toonFoliage, isToon);

            const warmBarkBase = this.uBarkBase;
            const warmBarkTop  = this.uBarkTop;
            const coolBarkBase = vec3(0.13, 0.14, 0.15);
            const coolBarkTop  = vec3(0.28, 0.30, 0.31);

            const curBarkBase = mix(warmBarkBase, coolBarkBase, isWinter);
            const curBarkTop  = mix(warmBarkTop, coolBarkTop, isWinter);
            const barkAO = mix(float(1.0).sub(this.uBarkAOStrength.mul(0.65)), float(1.0), smoothstep(float(0.0), float(0.5), localY));
            const barkCol = mix(curBarkBase, curBarkTop, smoothstep(float(0.0), float(0.6), localY))
                .mul(this.uBarkBrightness)
                .mul(barkAO);

            return mix(finalLeafColor, barkCol, aIsBark);
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
                const speed = this.uWindSpeed;
                const str = this.uWindStrength;
                const flutterSpd = this.uLeafFlutterSpeed;
                const flutterAmp = this.uLeafFlutterAmp;
                const dip = this.uLeafDip;

                const w1 = sin(this.uTime.mul(speed)).mul(0.08);
                const w2 = cos(this.uTime.mul(speed.mul(1.6))).mul(0.04);
                const flutter = sin(this.uTime.mul(speed.mul(flutterSpd)).add(positionGeometry.y.mul(1.5))).mul(flutterAmp);

                const heightFactor = clamp(positionGeometry.y.div(8.0), 0.0, 1.0);
                const mask = heightFactor.mul(heightFactor);

                const totalSway = w1.add(w2).add(flutter).mul(mask).mul(str);

                p.x.addAssign(totalSway);
                p.z.addAssign(totalSway.mul(0.6));
                p.y.subAssign(totalSway.mul(totalSway).mul(dip));

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

        const rawN1 = snoise(cellCenterX * 0.0035, cellCenterZ * 0.0035) * 0.5 + 0.5;
        const n1 = Math.pow(rawN1, 1.35);
        const n2 = snoise(cellCenterX * 0.021 + 137.2, cellCenterZ * 0.021 + 491.7) * 0.5 + 0.5;

        const effDensity = n1 * this.density * this.densityScale;
        if (effDensity < 0.28) return;

        const candidateCount = effDensity > 0.75 ? 3 : (effDensity > 0.45 ? 2 : 1);

        for (let s = 0; s < candidateCount; s++) {
            const jx = (hash2D(cx, cz, s * 10 + 1) - 0.5) * 0.85;
            const jz = (hash2D(cx, cz, s * 10 + 2) - 0.5) * 0.85;
            const px = (cx + 0.5 + jx) * this.cellSize;
            const pz = (cz + 0.5 + jz) * this.cellSize;

            const treeDist = Math.hypot(px - focusX, pz - focusZ);
            if (treeDist * treeDist > maxDistSq) continue;

            const varPick = (hash2D(cx, cz, s * 10 + 3) + n2 * 0.5) % 1.0;
            let vIdx = Math.floor(varPick * PINE_FILES.length);
            vIdx = Math.min(PINE_FILES.length - 1, Math.max(0, vIdx));

            const cfg = PINE_FILES[vIdx];
            const site = this._isValidSite(px, pz, cfg.footprintRadius, cfg.isCluster);
            if (site === null) continue;

            let season = 0.0;
            if (this.currentPreset === 'auto') {
                if (site.isMisty) {
                    season = 2.0;
                } else {
                    const sHash = hash2D(cx, cz, s * 10 + 7);
                    season = (sHash < 0.12) ? 1.0 : 0.0;
                }
            } else if (this.currentPreset === 'autumn' || this.currentPreset === 'fall') {
                season = 1.0;
            } else if (this.currentPreset === 'winter') {
                season = 2.0;
            }

            const rotY = hash2D(cx, cz, s * 10 + 4) * Math.PI * 2.0;
            const tiltX = (hash2D(cx, cz, s * 10 + 8) - 0.5) * 0.05;
            const tiltZ = (hash2D(cx, cz, s * 10 + 9) - 0.5) * 0.05;

            const scaleJitter = 0.80 + hash2D(cx, cz, s * 10 + 5) * 0.50;
            const widthJitter = 0.92 + hash2D(cx, cz, s * 10 + 6) * 0.18;
            const scaleX = scaleJitter * widthJitter * this.scaleMul;
            const scaleY = scaleJitter * this.scaleMul;
            const scaleZ = scaleJitter * widthJitter * this.scaleMul;

            const varIdx = Math.floor(hash2D(cx, cz, s * 10 + 11) * 4.0) % 4;
            const colorJitter = hash2D(cx, cz, s * 10 + 12);

            out.push({
                x: px, y: site.h - this.rootEmbed, z: pz,
                variant: vIdx,
                variation: varIdx,
                colorJitter: colorJitter,
                rotY,
                tiltX,
                tiltZ,
                scaleX,
                scaleY,
                scaleZ,
                season,
                dist: treeDist
            });
        }
    }

    _commit(focusX, focusZ, camY = 0) {
        const perMeshCount = this._byVariantBand.map(row => row.map(() => 0));
        const dummy = this._dummy;
        let overheadCount = 0;
        const isHighAltitude = this.enableOverheadCanopy && (camY >= this.overheadAltThreshold);

        this._collected.sort((a, b) => a.dist - b.dist);

        for (const c of this._collected) {
            // ALWAYS render near trees as 100% full 3D models (Band 0).
            // ONLY trees beyond impostorDistance (>300m) switch to Band 1 (Plus-Sign Impostors) when enabled.
            let band = 0;
            if (this.impostorsEnabled && c.dist > this.impostorDistance) {
                band = 1;
            } else {
                band = 0;
            }

            const row = this._byVariantBand[c.variant];
            if (!row) continue;
            const mesh = row[band];
            if (!mesh) continue;

            const idx = perMeshCount[c.variant][band];
            if (idx >= mesh.instanceMatrix.count) continue;

            dummy.position.set(c.x, c.y, c.z);
            dummy.rotation.set(c.tiltX, c.rotY, c.tiltZ);
            dummy.scale.set(c.scaleX, c.scaleY, c.scaleZ);
            dummy.updateMatrix();

            mesh.setMatrixAt(idx, dummy.matrix);

            if (mesh.geometry && mesh.geometry.attributes) {
                if (mesh.geometry.attributes.aSeason) mesh.geometry.attributes.aSeason.setX(idx, c.season);
                if (mesh.geometry.attributes.aVariation) mesh.geometry.attributes.aVariation.setX(idx, c.variation);
                if (mesh.geometry.attributes.aColorJitter) mesh.geometry.attributes.aColorJitter.setX(idx, c.colorJitter);
            }

            perMeshCount[c.variant][band] = idx + 1;

            if (band === 1 && isHighAltitude && this.overheadMesh && overheadCount < this.overheadMesh.instanceMatrix.count) {
                this.overheadMesh.setMatrixAt(overheadCount, dummy.matrix);
                if (this.overheadMesh.geometry && this.overheadMesh.geometry.attributes) {
                    if (this.overheadMesh.geometry.attributes.aSeason) this.overheadMesh.geometry.attributes.aSeason.setX(overheadCount, c.season);
                    if (this.overheadMesh.geometry.attributes.aVariation) this.overheadMesh.geometry.attributes.aVariation.setX(overheadCount, c.variation);
                    if (this.overheadMesh.geometry.attributes.aColorJitter) this.overheadMesh.geometry.attributes.aColorJitter.setX(overheadCount, c.colorJitter);
                }
                overheadCount++;
            }
        }

        const counts = { hero: 0, impostor: 0, total: 0 };
        this._byVariantBand.forEach((row, vi) => {
            row.forEach((mesh, bi) => {
                mesh.count = perMeshCount[vi][bi];
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.geometry && mesh.geometry.attributes) {
                    if (mesh.geometry.attributes.aSeason) mesh.geometry.attributes.aSeason.needsUpdate = true;
                    if (mesh.geometry.attributes.aVariation) mesh.geometry.attributes.aVariation.needsUpdate = true;
                    if (mesh.geometry.attributes.aColorJitter) mesh.geometry.attributes.aColorJitter.needsUpdate = true;
                }
                mesh.boundingSphere.center.set(focusX, 0, focusZ);
                mesh.boundingSphere.radius = 800;
                mesh.frustumCulled = true;
                if (bi === 0) counts.hero += mesh.count;
                else counts.impostor += mesh.count;
                counts.total += mesh.count;
            });
        });

        if (this.overheadMesh) {
            this.overheadMesh.count = overheadCount;
            this.overheadMesh.instanceMatrix.needsUpdate = true;
            if (this.overheadMesh.geometry && this.overheadMesh.geometry.attributes) {
                if (this.overheadMesh.geometry.attributes.aSeason) this.overheadMesh.geometry.attributes.aSeason.needsUpdate = true;
                if (this.overheadMesh.geometry.attributes.aVariation) this.overheadMesh.geometry.attributes.aVariation.needsUpdate = true;
                if (this.overheadMesh.geometry.attributes.aColorJitter) this.overheadMesh.geometry.attributes.aColorJitter.needsUpdate = true;
            }
            this.overheadMesh.boundingSphere.center.set(focusX, 0, focusZ);
            this.overheadMesh.boundingSphere.radius = 800;
        }

        this.lastCounts = counts;
    }

    update(focusX, focusZ, camera = null) {
        if (!this.ready || !this.enabled) return;

        const camY = camera ? (camera.position ? camera.position.y : (this.camera ? this.camera.position.y : 0)) : (this.camera ? this.camera.position.y : 0);

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
                this._commit(w.focusX, w.focusZ, camY);
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

        const maxDist = 750.0;
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
            if (m.geometry && m.geometry.attributes) {
                if (m.geometry.attributes.aSeason) m.geometry.attributes.aSeason.needsUpdate = true;
                if (m.geometry.attributes.aVariation) m.geometry.attributes.aVariation.needsUpdate = true;
                if (m.geometry.attributes.aColorJitter) m.geometry.attributes.aColorJitter.needsUpdate = true;
            }
        });
    }

    setVisible(visible) {
        this.enabled = visible;
        this.meshes.forEach(m => { m.visible = visible; });
        if (visible) this.respawn();
    }

    setCellSize(newCellSize) {
        if (Math.abs(this.cellSize - newCellSize) < 0.5) return;
        this.cellSize = Math.max(10.0, newCellSize);
        this.respawn();
    }
}
