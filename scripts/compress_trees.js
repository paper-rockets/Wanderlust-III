import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, quantize, prune, dedup, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';
import { Matrix4, Vector3, Quaternion } from 'three';

// Inject default sampler if missing in glTF JSON
function fixGlbBuffer(filePath) {
    const fileBuf = fs.readFileSync(filePath);
    
    const magic = fileBuf.toString('utf8', 0, 4);
    if (magic !== 'glTF') throw new Error('Not a GLB file');
    
    const jsonLength = fileBuf.readUInt32LE(12);
    const jsonStr = fileBuf.toString('utf8', 20, 20 + jsonLength);
    const gltf = JSON.parse(jsonStr);
    
    let fixed = false;
    if (!gltf.samplers) {
        gltf.samplers = [{
            magFilter: 9729,
            minFilter: 9987,
            wrapS: 10497,
            wrapT: 10497
        }];
        fixed = true;
    }
    
    if (!fixed) return fileBuf;
    
    const newJsonBuf = Buffer.from(JSON.stringify(gltf));
    const padLength = (4 - (newJsonBuf.length % 4)) % 4;
    const paddedJsonBuf = Buffer.concat([newJsonBuf, Buffer.alloc(padLength, 0x20)]);
    
    const binHeaderStart = 20 + jsonLength;
    const binLength = fileBuf.readUInt32LE(binHeaderStart);
    const binBuf = fileBuf.subarray(binHeaderStart + 8, binHeaderStart + 8 + binLength);
    
    const newLength = 20 + paddedJsonBuf.length + 8 + binBuf.length;
    const outBuf = Buffer.alloc(newLength);
    outBuf.write('glTF', 0);
    outBuf.writeUInt32LE(2, 4);
    outBuf.writeUInt32LE(newLength, 8);
    outBuf.writeUInt32LE(paddedJsonBuf.length, 12);
    outBuf.write('JSON', 16);
    paddedJsonBuf.copy(outBuf, 20);
    
    const newBinHeaderStart = 20 + paddedJsonBuf.length;
    outBuf.writeUInt32LE(binBuf.length, newBinHeaderStart);
    outBuf.write('BIN\0', newBinHeaderStart + 4);
    binBuf.copy(outBuf, newBinHeaderStart + 8);
    
    return outBuf;
}

function getNodeLocalMatrix(node) {
    const mat = new Matrix4();
    const t = node.getTranslation();
    const r = node.getRotation();
    const s = node.getScale();
    
    const pos = t ? new Vector3(t[0], t[1], t[2]) : new Vector3(0, 0, 0);
    const quat = r ? new Quaternion(r[0], r[1], r[2], r[3]) : new Quaternion(0, 0, 0, 1);
    const scale = s ? new Vector3(s[0], s[1], s[2]) : new Vector3(1, 1, 1);
    
    mat.compose(pos, quat, scale);
    return mat;
}

export async function processAtlasTree(io, filePath, outputPath, stripTextures = false) {
    console.log(`Processing: ${path.basename(filePath)} ${stripTextures ? '(Toon/Procedural)' : ''}`);
    const fixedBuf = fixGlbBuffer(filePath);
    const doc = await io.readBinary(new Uint8Array(fixedBuf));
    
    if (stripTextures) {
        doc.getRoot().listTextures().forEach(t => t.dispose());
        doc.getRoot().listMaterials().forEach(m => {
            m.setBaseColorTexture(null);
            m.setNormalTexture(null);
            m.setMetallicRoughnessTexture(null);
        });
    }

    const meshes = doc.getRoot().listMeshes();
    if (meshes.length === 0) return;
    
    const mesh = meshes[0];
    const prims = mesh.listPrimitives();
    if (prims.length === 0) return;
    
    const prim = prims[0];
    const posAccessor = prim.getAttribute('POSITION');
    if (!posAccessor) return;
    
    const posArray = posAccessor.getArray();
    const count = posAccessor.getCount();
    
    // Auto-detect vertical axis
    let minVals = [Infinity, Infinity, Infinity];
    let maxVals = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) {
        for (let a = 0; a < 3; a++) {
            const v = posArray[i * 3 + a];
            if (v < minVals[a]) minVals[a] = v;
            if (v > maxVals[a]) maxVals[a] = v;
        }
    }
    
    let verticalAxis = 2;
    let maxRange = 0;
    for (let a = 0; a < 3; a++) {
        const range = maxVals[a] - minVals[a];
        if (range > maxRange) {
            maxRange = range;
            verticalAxis = a;
        }
    }
    
    const minZ = minVals[verticalAxis];
    const maxZ = maxVals[verticalAxis];
    const range = maxZ - minZ;
    
    const isBarkUint8 = new Uint8Array(count);
    const colorUint8 = new Uint8Array(count * 4);
    
    for (let i = 0; i < count; i++) {
        const x = posArray[i * 3];
        const y = posArray[i * 3 + 1];
        const z = posArray[i * 3 + 2];
        const vertCoord = posArray[i * 3 + verticalAxis];
        const normZ = range > 0 ? (vertCoord - minZ) / range : 0;
        
        let val = 0.0;
        if (normZ < 0.15) {
            val = 1.0;
        } else if (normZ > 0.35) {
            val = 0.0;
        } else {
            val = (0.35 - normZ) / 0.20;
        }
        
        const barkByte = Math.round(Math.min(1.0, Math.max(0.0, val)) * 255);
        const heightByte = Math.round(Math.min(1.0, Math.max(0.0, normZ)) * 255);
        const h1 = verticalAxis === 0 ? y : x;
        const h2 = verticalAxis === 2 ? y : z;
        const rad = Math.sqrt(h1 * h1 + h2 * h2);
        const radByte = Math.round(Math.min(1.0, Math.max(0.0, rad / 5.0)) * 255);
        const windWeightByte = Math.round(Math.min(1.0, Math.max(0.0, normZ * normZ)) * 255);
        
        isBarkUint8[i] = barkByte;
        colorUint8[i * 4 + 0] = barkByte;
        colorUint8[i * 4 + 1] = heightByte;
        colorUint8[i * 4 + 2] = radByte;
        colorUint8[i * 4 + 3] = windWeightByte;
    }
    
    const idxAccessor = prim.getIndices();
    if (idxAccessor && count < 65536) {
        idxAccessor.setArray(new Uint16Array(idxAccessor.getArray()));
    }
    
    const isBarkAccessor = doc.createAccessor()
        .setType('SCALAR')
        .setNormalized(true)
        .setArray(isBarkUint8);
    prim.setAttribute('_aisbark', isBarkAccessor);
    
    const colorAccessor = doc.createAccessor()
        .setType('VEC4')
        .setNormalized(true)
        .setArray(colorUint8);
    prim.setAttribute('COLOR_0', colorAccessor);
    
    await doc.transform(
        weld({ tolerance: 0.0001 }),
        quantize({
            quantizePosition: 14,
            quantizeNormal: 8,
            quantizeTexcoord: 10,
            quantizeColor: 8
        }),
        prune(),
        dedup(),
        draco({
            quantizePosition: 14,
            quantizeNormal: 8,
            quantizeTexcoord: 10,
            quantizeColor: 8,
            quantizeGeneric: 8,
            encodeSpeed: 3,
            decodeSpeed: 5
        })
    );
    
    await io.write(outputPath, doc);
    const origSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(outputPath).size;
    const savings = ((1 - (newSize / origSize)) * 100).toFixed(1);
    console.log(`Saved ${path.basename(outputPath)}: ${origSize} -> ${newSize} bytes (${savings}% reduction)`);
}

export async function processPineTreesCombined(io, filePath, outputPath) {
    console.log(`Processing Combined Pines: ${path.basename(filePath)}`);
    const fixedBuf = fixGlbBuffer(filePath);
    const doc = await io.readBinary(new Uint8Array(fixedBuf));
    
    const root = doc.getRoot();
    const scene = root.getDefaultScene();
    const children = scene.listChildren();
    
    for (const node of children) {
        const name = node.getName();
        if (name.startsWith('UCX_')) {
            node.detach();
            continue;
        }
        
        const nodeAndDescendants = [node];
        function collectNodes(n) {
            n.listChildren().forEach(c => {
                nodeAndDescendants.push(c);
                collectNodes(c);
            });
        }
        collectNodes(node);
        
        const primsToMerge = [];
        const isBarkFlags = [];
        
        nodeAndDescendants.forEach(n => {
            const mesh = n.getMesh();
            if (!mesh) return;
            
            const mat = new Matrix4();
            let curr = n;
            while (curr && curr !== node) {
                mat.premultiply(getNodeLocalMatrix(curr));
                const parents = curr.listParents();
                curr = parents.find(p => p.type === 'Node');
            }
            
            mesh.listPrimitives().forEach(prim => {
                const material = prim.getMaterial();
                const matName = material ? material.getName().toLowerCase() : '';
                
                let isBark = 0.0;
                if (matName.includes('tr') || matName.includes('trunk') || matName.includes('bark') || matName.includes('wood') || matName.includes('stump')) {
                    isBark = 1.0;
                } else if (matName.includes('billboard')) {
                    isBark = 'billboard';
                } else if (name.toLowerCase().includes('fallenbranches')) {
                    isBark = 1.0;
                }
                
                primsToMerge.push({ prim, matrix: mat });
                isBarkFlags.push(isBark);
            });
        });
        
        if (primsToMerge.length === 0) continue;
        
        let mergedPositions = [];
        let mergedNormals = [];
        let mergedTexCoords = [];
        let mergedIndices = [];
        let mergedIsBark = [];
        let mergedColors = [];
        let vertexOffset = 0;
        
        primsToMerge.forEach(({ prim, matrix }, primIdx) => {
            const isBark = isBarkFlags[primIdx];
            const posAcc = prim.getAttribute('POSITION');
            const normAcc = prim.getAttribute('NORMAL');
            const uvAcc = prim.getAttribute('TEXCOORD_0');
            const idxAcc = prim.getIndices();
            
            const posArray = posAcc.getArray();
            const normArray = normAcc.getArray();
            const uvArray = uvAcc ? uvAcc.getArray() : null;
            const idxArray = idxAcc ? idxAcc.getArray() : null;
            const count = posAcc.getCount();
            
            const vecPos = new Vector3();
            const vecNorm = new Vector3();
            
            for (let i = 0; i < count; i++) {
                vecPos.set(posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2]);
                vecPos.applyMatrix4(matrix);
                mergedPositions.push(vecPos.x, vecPos.y, vecPos.z);
                
                vecNorm.set(normArray[i * 3], normArray[i * 3 + 1], normArray[i * 3 + 2]);
                vecNorm.transformDirection(matrix);
                vecNorm.normalize();
                mergedNormals.push(vecNorm.x, vecNorm.y, vecNorm.z);
                
                if (uvArray) {
                    mergedTexCoords.push(uvArray[i * 2], uvArray[i * 2 + 1]);
                } else {
                    mergedTexCoords.push(0, 0);
                }
                
                let barkVal = 0.0;
                if (isBark === 'billboard') {
                    let minY = Infinity, maxY = -Infinity;
                    for (let j = 0; j < count; j++) {
                        vecPos.set(posArray[j * 3], posArray[j * 3 + 1], posArray[j * 3 + 2]).applyMatrix4(matrix);
                        if (vecPos.y < minY) minY = vecPos.y;
                        if (vecPos.y > maxY) maxY = vecPos.y;
                    }
                    const range = maxY - minY;
                    const y = vecPos.set(posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2]).applyMatrix4(matrix).y;
                    const normY = range > 0 ? (y - minY) / range : 0;
                    barkVal = normY < 0.15 ? 1.0 : (normY > 0.35 ? 0.0 : (0.35 - normY) / 0.20);
                } else {
                    barkVal = isBark;
                }
                
                const barkByte = Math.round(Math.min(1.0, Math.max(0.0, barkVal)) * 255);
                const normHeightByte = Math.round(Math.min(1.0, Math.max(0.0, vecPos.y / 22.0)) * 255);
                const rad = Math.sqrt(vecPos.x * vecPos.x + vecPos.z * vecPos.z);
                const radByte = Math.round(Math.min(1.0, Math.max(0.0, rad / 5.5)) * 255);
                const windWeightByte = Math.round(Math.min(1.0, Math.max(0.0, (vecPos.y / 22.0) ** 2)) * 255);
                
                mergedIsBark.push(barkByte);
                mergedColors.push(barkByte, normHeightByte, radByte, windWeightByte);
            }
            
            if (idxArray) {
                for (let i = 0; i < idxArray.length; i++) {
                    mergedIndices.push(idxArray[i] + vertexOffset);
                }
            } else {
                for (let i = 0; i < count; i++) {
                    mergedIndices.push(i + vertexOffset);
                }
            }
            
            vertexOffset += count;
        });
        
        const totalVerts = mergedPositions.length / 3;
        const newPosAccessor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(mergedPositions));
        const newNormAccessor = doc.createAccessor().setType('VEC3').setArray(new Float32Array(mergedNormals));
        const newUvAccessor = doc.createAccessor().setType('VEC2').setArray(new Float32Array(mergedTexCoords));
        const idxTypedArray = totalVerts < 65536 ? new Uint16Array(mergedIndices) : new Uint32Array(mergedIndices);
        const newIdxAccessor = doc.createAccessor().setType('SCALAR').setArray(idxTypedArray);
        
        const newIsBarkAccessor = doc.createAccessor()
            .setType('SCALAR')
            .setNormalized(true)
            .setArray(new Uint8Array(mergedIsBark));
            
        const newColorAccessor = doc.createAccessor()
            .setType('VEC4')
            .setNormalized(true)
            .setArray(new Uint8Array(mergedColors));
        
        const newPrim = doc.createPrimitive()
            .setAttribute('POSITION', newPosAccessor)
            .setAttribute('NORMAL', newNormAccessor)
            .setAttribute('TEXCOORD_0', newUvAccessor)
            .setAttribute('_aisbark', newIsBarkAccessor)
            .setAttribute('COLOR_0', newColorAccessor)
            .setIndices(newIdxAccessor);
            
        newPrim.setMaterial(primsToMerge[0].prim.getMaterial());
        const newMesh = doc.createMesh().addPrimitive(newPrim);
        
        node.listChildren().forEach(c => c.detach());
        node.setMesh(newMesh);
    }
    
    await doc.transform(
        weld({ tolerance: 0.0001 }),
        quantize({
            quantizePosition: 14,
            quantizeNormal: 8,
            quantizeTexcoord: 10,
            quantizeColor: 8
        }),
        prune(),
        dedup(),
        draco({
            quantizePosition: 14,
            quantizeNormal: 8,
            quantizeTexcoord: 10,
            quantizeColor: 8,
            quantizeGeneric: 8,
            encodeSpeed: 3,
            decodeSpeed: 5
        })
    );
    
    await io.write(outputPath, doc);
    const origSize = fs.statSync(filePath).size;
    const newSize = fs.statSync(outputPath).size;
    const savings = ((1 - (newSize / origSize)) * 100).toFixed(1);
    console.log(`Saved ${path.basename(outputPath)}: ${origSize} -> ${newSize} bytes (${savings}% reduction)`);
}

async function main() {
    const inputDir = "E:/Z FUCK CLAUDE/public/assets/Trees/";
    const compressedDir = "E:/Z FUCK CLAUDE/public/assets/Trees_Compressed/";
    const toonDir = "E:/Z FUCK CLAUDE/public/assets/Trees_Compressed_Toon/";
    
    if (!fs.existsSync(compressedDir)) fs.mkdirSync(compressedDir, { recursive: true });
    if (!fs.existsSync(toonDir)) fs.mkdirSync(toonDir, { recursive: true });
    
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': await draco3d.createDecoderModule(),
            'draco3d.encoder': await draco3d.createEncoderModule(),
        });
        
    const files = [
        "Background_Tree_Atlas_001_alt.glb",
        "Background_Tree_Atlas_002_alt.glb",
        "Background_Tree_Atlas_003_alt.glb",
        "Background_Tree_Atlas_004_alt.glb",
        "Background_Tree_Atlas_005_alt.glb",
        "Background_Tree_Atlas_006_alt.glb",
        "Background_Tree_Atlas_007_alt.glb",
        "Background_Tree_Atlas_009_alt.glb",
        "Background_Tree_Atlas_010_alt.glb",
        "Background_Tree_Atlas_alt.glb"
    ];
    
    console.log("=== EXPORTING COMPRESSED TREES ===");
    for (const f of files) {
        const inPath = path.join(inputDir, f);
        if (fs.existsSync(inPath)) {
            // Full compressed
            await processAtlasTree(io, inPath, path.join(compressedDir, f), false);
            // Ultra-lightweight Toon/Procedural
            await processAtlasTree(io, inPath, path.join(toonDir, f), true);
        }
    }
    
    const pineIn = path.join(inputDir, "pine_trees.glb");
    if (fs.existsSync(pineIn)) {
        await processPineTreesCombined(io, pineIn, path.join(compressedDir, "pine_trees.glb"));
    }
    
    console.log("\nCompression pipeline finished successfully.");
}

main().catch(console.error);
