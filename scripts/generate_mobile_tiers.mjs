import { Document, NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, quantize, reorder, weld, prune, dedup, simplify } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression])
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder
  });

const srcBaseDir = 'E:/Z FUCK CLAUDE/public/assets/Trees/New folder';
const outTier1Dir = 'E:/Z FUCK CLAUDE/public/assets/Trees/Tier1_Desktop';
const outTier2Dir = 'E:/Z FUCK CLAUDE/public/assets/Trees/Tier2_Mobile';
const outTier3Dir = 'E:/Z FUCK CLAUDE/public/assets/Trees/Tier3_Flight_Ultra';

const treeMappings = [
  { srcName: 'Apen Large 2', dstName: 'Aspen_Large_2', displayName: 'Aspen Large 2', height: 20, radius: 5 },
  { srcName: 'Aspen Large', dstName: 'Aspen_Large_1', displayName: 'Aspen Large 1', height: 20, radius: 5 },
  { srcName: 'Ash Large', dstName: 'Ash_Large', displayName: 'Ash Large', height: 18, radius: 6 },
  { srcName: 'Ash Medium', dstName: 'Ash_Medium', displayName: 'Ash Medium', height: 14, radius: 4.5 },
  { srcName: 'Oak Large 1', dstName: 'Oak_Large_1', displayName: 'Oak Large 1', height: 19, radius: 7 },
  { srcName: 'Oak Large 2', dstName: 'Oak_Large_2', displayName: 'Oak Large 2', height: 19, radius: 7 },
  { srcName: 'Pine Large 1', dstName: 'Pine_Large_1', displayName: 'Pine Large 1', height: 22, radius: 5.5 },
  { srcName: 'Pine Large 2', dstName: 'Pine_Large_2', displayName: 'Pine Large 2', height: 17, radius: 4.5 },
  { srcName: 'Pine Medium', dstName: 'Pine_Medium', displayName: 'Pine Medium', height: 15, radius: 4 }
];

// Helper: Dilate alpha edges to prevent dark edge fringing
async function dilateAlpha(buffer, width, height) {
  const { data, info } = await sharp(buffer)
    .resize(width, height)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);
  const channels = 4;

  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * channels;
        const alpha = out[idx + 3];
        if (alpha < 128) {
          const neighbors = [
            y > 0 ? ((y - 1) * w + x) * channels : -1,
            y < h - 1 ? ((y + 1) * w + x) * channels : -1,
            x > 0 ? (y * w + (x - 1)) * channels : -1,
            x < w - 1 ? (y * w + (x + 1)) * channels : -1
          ];
          for (const nIdx of neighbors) {
            if (nIdx >= 0 && out[nIdx + 3] >= 128) {
              out[idx] = out[nIdx];
              out[idx + 1] = out[nIdx + 1];
              out[idx + 2] = out[nIdx + 2];
              break;
            }
          }
        }
      }
    }
  }

  return await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

// Build Cross-Quad Billboard Geometry (4 triangles) for LOD3
function createBillboardPrimitive(doc, buffer, mat, height = 18, radius = 5) {
  const h = height;
  const r = radius;

  // 2 perpendicular vertical intersecting quads
  // Quad 1: X from -r to +r (Z=0)
  // Quad 2: Z from -r to +r (X=0)
  const pos = new Float32Array([
    // Quad 1 (along X)
    -r, 0, 0,
     r, 0, 0,
     r, h, 0,
    -r, h, 0,
    // Quad 2 (along Z)
    0, 0, -r,
    0, 0,  r,
    0, h,  r,
    0, h, -r
  ]);

  const norm = new Float32Array([
    0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1,
    1, 0, 0,   1, 0, 0,   1, 0, 0,   1, 0, 0
  ]);

  // UV coordinates mapping to atlas right half (leaves / canopy)
  const uv = new Float32Array([
    0.5, 0.0,   1.0, 0.0,   1.0, 1.0,   0.5, 1.0,
    0.5, 0.0,   1.0, 0.0,   1.0, 1.0,   0.5, 1.0
  ]);

  const bark = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
  const col = new Float32Array(8 * 4).fill(1.0);

  const idx = new Uint16Array([
    0, 1, 2,  0, 2, 3, // Quad 1
    4, 5, 6,  4, 6, 7  // Quad 2
  ]);

  return doc.createPrimitive()
    .setMode(4)
    .setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(pos))
    .setAttribute('NORMAL', doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(norm))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setBuffer(buffer).setType('VEC2').setArray(uv))
    .setAttribute('_aisbark', doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(bark))
    .setAttribute('COLOR_0', doc.createAccessor().setBuffer(buffer).setType('VEC4').setArray(col))
    .setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(idx));
}

async function processTreeSpecies(mapping) {
  console.log(`\n======================================================`);
  console.log(`Processing: ${mapping.displayName} (${mapping.srcName})`);
  console.log(`======================================================`);

  const srcDir = path.join(srcBaseDir, mapping.srcName);
  const lod0Path = path.join(srcDir, 'tree_LOD0.glb');
  if (!fs.existsSync(lod0Path)) {
    console.error(`Missing LOD0 file: ${lod0Path}`);
    return;
  }

  // Extract master textures
  const sampleDoc = await io.read(lod0Path);
  const sampleRoot = sampleDoc.getRoot();
  let trunkMat = null, leafMat = null, sampleTrunkPrim = null;

  for (const mesh of sampleRoot.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (!mat) continue;
      const name = mat.getName().toLowerCase();
      if (name.includes('branch') || name.includes('trunk') || name.includes('bark')) {
        trunkMat = mat;
        sampleTrunkPrim = prim;
      } else if (name.includes('leaf') || name.includes('leaves') || name.includes('canopy')) {
        leafMat = mat;
      }
    }
  }

  if (!trunkMat || !leafMat) {
    const mats = sampleRoot.listMaterials();
    trunkMat = mats[0];
    leafMat = mats[1] || mats[0];
  }

  let trunkTileX = 1;
  if (sampleTrunkPrim) {
    const uvArr = sampleTrunkPrim.getAttribute('TEXCOORD_0').getArray();
    let maxU = 1.0;
    for (let i = 0; i < uvArr.length; i += 2) {
      if (uvArr[i] > maxU) maxU = uvArr[i];
    }
    if (maxU > 1.2) trunkTileX = Math.round(maxU);
  }

  const trunkTexRaw = trunkMat.getBaseColorTexture().getImage();
  const leafTexRaw = leafMat.getBaseColorTexture().getImage();

  // Create Atlas buffers:
  // 1. Tier 1 Atlas: 1024x1024 PNG
  // 2. Tier 2 Atlas: 1024x1024 WebP (High Quality Mobile)
  // 3. Tier 3 Atlas: 512x512 WebP (Ultra Low Memory Flight)
  
  // Helper for atlas building
  async function makeAtlas(width, height, format = 'png', quality = 85) {
    const halfW = width / 2;
    let trunkBuf;
    if (trunkTileX > 1) {
      const singleW = Math.floor(halfW / trunkTileX);
      const singleTile = await sharp(trunkTexRaw).resize(singleW, height).ensureAlpha().toBuffer();
      const composites = [];
      for (let i = 0; i < trunkTileX; i++) {
        composites.push({ input: singleTile, left: i * singleW, top: 0 });
      }
      trunkBuf = await sharp({
        create: { width: halfW, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
      }).composite(composites).png().toBuffer();
    } else {
      trunkBuf = await sharp(trunkTexRaw).resize(halfW, height).ensureAlpha().toBuffer();
    }

    const leafBuf = await dilateAlpha(leafTexRaw, halfW, height);

    const builder = sharp({
      create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([
      { input: trunkBuf, left: 0, top: 0 },
      { input: leafBuf, left: halfW, top: 0 }
    ]);

    if (format === 'webp') {
      return await builder.webp({ quality, alphaQuality: quality, effort: 6 }).toBuffer();
    }
    return await builder.png({ quality, compressionLevel: 9 }).toBuffer();
  }

  const tier1AtlasBuf = await makeAtlas(1024, 1024, 'png', 90);
  const tier2AtlasBuf = await makeAtlas(1024, 1024, 'webp', 82);
  const tier3AtlasBuf = await makeAtlas(512, 512, 'webp', 75);

  console.log(`Atlases built: Tier1 PNG: ${(tier1AtlasBuf.length / 1024).toFixed(1)} KB | Tier2 WebP: ${(tier2AtlasBuf.length / 1024).toFixed(1)} KB | Tier3 WebP: ${(tier3AtlasBuf.length / 1024).toFixed(1)} KB`);

  // Ensure directories exist
  const t1Dir = path.join(outTier1Dir, mapping.dstName);
  const t2Dir = path.join(outTier2Dir, mapping.dstName);
  const t3Dir = path.join(outTier3Dir, mapping.dstName);
  fs.mkdirSync(t1Dir, { recursive: true });
  fs.mkdirSync(t2Dir, { recursive: true });
  fs.mkdirSync(t3Dir, { recursive: true });

  fs.writeFileSync(path.join(t1Dir, `${mapping.dstName}_atlas.png`), tier1AtlasBuf);
  fs.writeFileSync(path.join(t2Dir, `${mapping.dstName}_atlas.webp`), tier2AtlasBuf);
  fs.writeFileSync(path.join(t3Dir, `${mapping.dstName}_atlas.webp`), tier3AtlasBuf);

  // Process LOD geometries
  const srcLodFiles = ['tree_LOD0.glb', 'tree_LOD1.glb', 'tree_LOD2.glb'];

  for (let lodIdx = 0; lodIdx < srcLodFiles.length; lodIdx++) {
    const srcLodFile = path.join(srcDir, srcLodFiles[lodIdx]);
    if (!fs.existsSync(srcLodFile)) continue;

    const srcDoc = await io.read(srcLodFile);
    const srcRoot = srcDoc.getRoot();

    let srcTrunkPrim = null, srcLeafPrim = null;
    for (const mesh of srcRoot.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial();
        const matName = (mat ? mat.getName() : '').toLowerCase();
        if (matName.includes('branch') || matName.includes('trunk') || matName.includes('bark')) {
          srcTrunkPrim = prim;
        } else if (matName.includes('leaf') || matName.includes('leaves') || matName.includes('canopy')) {
          srcLeafPrim = prim;
        }
      }
    }
    if (!srcTrunkPrim || !srcLeafPrim) {
      const meshes = srcRoot.listMeshes();
      if (meshes.length >= 2) {
        srcTrunkPrim = meshes[0].listPrimitives()[0];
        srcLeafPrim = meshes[1].listPrimitives()[0];
      }
    }
    if (!srcTrunkPrim || !srcLeafPrim) continue;

    // Arrays
    const trunkPos = srcTrunkPrim.getAttribute('POSITION').getArray();
    const trunkNorm = srcTrunkPrim.getAttribute('NORMAL').getArray();
    const trunkUV = srcTrunkPrim.getAttribute('TEXCOORD_0').getArray();
    const trunkIdx = srcTrunkPrim.getIndices().getArray();
    const trunkVertCount = trunkPos.length / 3;

    const leafPos = srcLeafPrim.getAttribute('POSITION').getArray();
    const leafNorm = srcLeafPrim.getAttribute('NORMAL').getArray();
    const leafUV = srcLeafPrim.getAttribute('TEXCOORD_0').getArray();
    const leafIdx = srcLeafPrim.getIndices().getArray();
    const leafVertCount = leafPos.length / 3;

    const totalVerts = trunkVertCount + leafVertCount;
    const mergedPos = new Float32Array(totalVerts * 3);
    const mergedNorm = new Float32Array(totalVerts * 3);
    const mergedUV = new Float32Array(totalVerts * 2);
    const mergedBarkMask = new Float32Array(totalVerts);
    const mergedColor = new Float32Array(totalVerts * 4).fill(1.0);

    mergedPos.set(trunkPos, 0);
    mergedNorm.set(trunkNorm, 0);
    for (let i = 0; i < trunkVertCount; i++) {
      const uNorm = trunkTileX > 1 ? (trunkUV[i * 2] / trunkTileX) : trunkUV[i * 2];
      mergedUV[i * 2] = Math.max(0.0, Math.min(0.5, uNorm * 0.5));
      mergedUV[i * 2 + 1] = trunkUV[i * 2 + 1];
      mergedBarkMask[i] = 1.0;
    }

    mergedPos.set(leafPos, trunkVertCount * 3);
    mergedNorm.set(leafNorm, trunkVertCount * 3);
    for (let i = 0; i < leafVertCount; i++) {
      const dstIdx = trunkVertCount + i;
      mergedUV[dstIdx * 2] = 0.5 + Math.max(0.0, Math.min(1.0, leafUV[i * 2])) * 0.5;
      mergedUV[dstIdx * 2 + 1] = leafUV[i * 2 + 1];
      mergedBarkMask[dstIdx] = 0.0;
    }

    const mergedIndices = new Uint32Array(trunkIdx.length + leafIdx.length);
    mergedIndices.set(trunkIdx, 0);
    for (let i = 0; i < leafIdx.length; i++) {
      mergedIndices[trunkIdx.length + i] = leafIdx[i] + trunkVertCount;
    }

    // Ground Center
    let minY = Infinity;
    for (let i = 1; i < mergedPos.length; i += 3) {
      if (mergedPos[i] < minY) minY = mergedPos[i];
    }
    if (Math.abs(minY) > 0.001) {
      for (let i = 1; i < mergedPos.length; i += 3) mergedPos[i] -= minY;
    }

    // Helper: Build and write GLB document
    async function buildGlb(atlasBuffer, mimeType, outPath, simplifyRatio = 1.0, simplifyError = 0.01) {
      const doc = new Document();
      const buffer = doc.createBuffer();
      const scene = doc.createScene(`${mapping.dstName}_LOD${lodIdx}`);

      const atlasTex = doc.createTexture(`${mapping.dstName}_atlas`)
        .setImage(atlasBuffer)
        .setMimeType(mimeType);

      const mat = doc.createMaterial(`${mapping.dstName}_Material`)
        .setBaseColorTexture(atlasTex)
        .setAlphaMode('MASK')
        .setAlphaCutoff(0.5)
        .setDoubleSided(true)
        .setRoughnessFactor(0.8)
        .setMetallicFactor(0.0);

      const mesh = doc.createMesh(`${mapping.dstName}_Mesh_LOD${lodIdx}`);
      const prim = doc.createPrimitive()
        .setMode(4)
        .setMaterial(mat)
        .setAttribute('POSITION', doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(mergedPos)))
        .setAttribute('NORMAL', doc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array(mergedNorm)))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setBuffer(buffer).setType('VEC2').setArray(new Float32Array(mergedUV)))
        .setAttribute('_aisbark', doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Float32Array(mergedBarkMask)))
        .setAttribute('COLOR_0', doc.createAccessor().setBuffer(buffer).setType('VEC4').setArray(new Float32Array(mergedColor)))
        .setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint32Array(mergedIndices)));

      mesh.addPrimitive(prim);
      scene.addChild(doc.createNode(`${mapping.dstName}_Node_LOD${lodIdx}`).setMesh(mesh));

      const transforms = [
        prune(),
        dedup()
      ];

      if (simplifyRatio < 0.99) {
        transforms.push(simplify({ simplifier: MeshoptSimplifier, ratio: simplifyRatio, error: simplifyError }));
      }

      transforms.push(
        reorder({ encoder: MeshoptEncoder }),
        quantize(),
        meshopt({ encoder: MeshoptEncoder, level: 'high' })
      );

      await doc.transform(...transforms);
      await io.write(outPath, doc);

      const stat = fs.statSync(outPath);
      const tris = doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
      return { sizeKb: (stat.size / 1024).toFixed(1), tris };
    }

    // Tier 1: Full detail, 1024 PNG
    const t1Res = await buildGlb(tier1AtlasBuf, 'image/png', path.join(t1Dir, `${mapping.dstName}_LOD${lodIdx}.glb`), 1.0);

    // Tier 2: Mobile Tuned (LOD0 100%, LOD1 30%, LOD2 10%), 1024 WebP
    const t2Ratio = lodIdx === 0 ? 1.0 : (lodIdx === 1 ? 0.35 : 0.08);
    const t2Error = lodIdx === 0 ? 0.01 : (lodIdx === 1 ? 0.03 : 0.12);
    const t2Res = await buildGlb(tier2AtlasBuf, 'image/webp', path.join(t2Dir, `${mapping.dstName}_LOD${lodIdx}.glb`), t2Ratio, t2Error);

    // Tier 3: Flight Ultra Low (LOD0 40%, LOD1 15%, LOD2 5%), 512 WebP
    const t3Ratio = lodIdx === 0 ? 0.40 : (lodIdx === 1 ? 0.15 : 0.04);
    const t3Error = lodIdx === 0 ? 0.03 : (lodIdx === 1 ? 0.08 : 0.20);
    const t3Res = await buildGlb(tier3AtlasBuf, 'image/webp', path.join(t3Dir, `${mapping.dstName}_LOD${lodIdx}.glb`), t3Ratio, t3Error);

    console.log(`  LOD${lodIdx}: T1(Desktop) ${t1Res.tris} tris (${t1Res.sizeKb} KB) | T2(Mobile) ${t2Res.tris} tris (${t2Res.sizeKb} KB) | T3(Flight) ${t3Res.tris} tris (${t3Res.sizeKb} KB)`);
  }

  // Tier 3 LOD3 Billboard Impostor (4 triangles)
  {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const scene = doc.createScene(`${mapping.dstName}_LOD3`);

    const atlasTex = doc.createTexture(`${mapping.dstName}_atlas`)
      .setImage(tier3AtlasBuf)
      .setMimeType('image/webp');

    const mat = doc.createMaterial(`${mapping.dstName}_Material`)
      .setBaseColorTexture(atlasTex)
      .setAlphaMode('MASK')
      .setAlphaCutoff(0.4)
      .setDoubleSided(true);

    const prim = createBillboardPrimitive(doc, buffer, mat, mapping.height, mapping.radius);
    const mesh = doc.createMesh(`${mapping.dstName}_Mesh_LOD3`).addPrimitive(prim);
    scene.addChild(doc.createNode(`${mapping.dstName}_Node_LOD3`).setMesh(mesh));

    await doc.transform(
      prune(),
      dedup(),
      reorder({ encoder: MeshoptEncoder }),
      quantize(),
      meshopt({ encoder: MeshoptEncoder, level: 'high' })
    );

    const lod3Path = path.join(t3Dir, `${mapping.dstName}_LOD3.glb`);
    await io.write(lod3Path, doc);
    const stat = fs.statSync(lod3Path);
    console.log(`  LOD3 (Billboard Impostor): 4 tris (${(stat.size / 1024).toFixed(1)} KB)`);
  }
}

async function run() {
  console.log('Generating 3 Quality Tiers for All Tree Species...');
  const start = Date.now();

  for (const mapping of treeMappings) {
    await processTreeSpecies(mapping);
  }

  console.log(`\n======================================================`);
  console.log(`All 3 Tiers generated successfully in ${((Date.now() - start) / 1000).toFixed(1)}s!`);
  console.log(`Tier 1 (Desktop HQ): ${outTier1Dir}`);
  console.log(`Tier 2 (Mobile Optimized): ${outTier2Dir}`);
  console.log(`Tier 3 (Flight Ultra): ${outTier3Dir}`);
  console.log(`======================================================`);
}

run().catch(console.error);
