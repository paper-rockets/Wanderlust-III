import { Document, NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { meshopt, quantize, reorder, weld, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression])
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder
  });

const srcBaseDir = 'E:/Z FUCK CLAUDE/public/assets/Trees/New folder';
const outBaseDir = 'E:/Z FUCK CLAUDE/public/assets/Trees/Optimized';

const treeMappings = [
  { srcName: 'Apen Large 2', dstName: 'Aspen_Large_2', displayName: 'Aspen Large 2' },
  { srcName: 'Aspen Large', dstName: 'Aspen_Large_1', displayName: 'Aspen Large 1' },
  { srcName: 'Ash Large', dstName: 'Ash_Large', displayName: 'Ash Large' },
  { srcName: 'Ash Medium', dstName: 'Ash_Medium', displayName: 'Ash Medium' },
  { srcName: 'Oak Large 1', dstName: 'Oak_Large_1', displayName: 'Oak Large 1' },
  { srcName: 'Oak Large 2', dstName: 'Oak_Large_2', displayName: 'Oak Large 2' },
  { srcName: 'Pine Large 1', dstName: 'Pine_Large_1', displayName: 'Pine Large 1' },
  { srcName: 'Pine Large 2', dstName: 'Pine_Large_2', displayName: 'Pine Large 2' },
  { srcName: 'Pine Medium', dstName: 'Pine_Medium', displayName: 'Pine Medium' }
];

// Helper: Dilate alpha edges of RGBA image buffer to prevent black fringes at dusk/twilight
async function dilateAlpha(buffer, width = 512, height = 1024) {
  const { data, info } = await sharp(buffer)
    .resize(width, height)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);

  // For any transparent or semi-transparent pixel, find nearest opaque neighbor color
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

async function processTree(mapping) {
  console.log(`\n========================================`);
  console.log(`Processing: ${mapping.displayName} (${mapping.srcName} -> ${mapping.dstName})`);
  console.log(`========================================`);

  const srcDir = path.join(srcBaseDir, mapping.srcName);
  const outDir = path.join(outBaseDir, mapping.dstName);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Read LOD0 to extract master textures and inspect UV bounds
  const lod0Path = path.join(srcDir, 'tree_LOD0.glb');
  if (!fs.existsSync(lod0Path)) {
    console.error(`Missing LOD0 file: ${lod0Path}`);
    return;
  }

  const sampleDoc = await io.read(lod0Path);
  const sampleRoot = sampleDoc.getRoot();

  let trunkMat = null, leafMat = null;
  let sampleTrunkPrim = null;

  for (const mesh of sampleRoot.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (!mat) continue;
      const matName = mat.getName().toLowerCase();
      if (matName.includes('branch') || matName.includes('trunk') || matName.includes('bark')) {
        trunkMat = mat;
        sampleTrunkPrim = prim;
      } else if (matName.includes('leaf') || matName.includes('leaves') || matName.includes('canopy')) {
        leafMat = mat;
      }
    }
  }

  if (!trunkMat || !leafMat) {
    const mats = sampleRoot.listMaterials();
    trunkMat = mats[0];
    leafMat = mats[1] || mats[0];
  }

  // Determine if trunk UV tiles horizontally
  let trunkTileX = 1;
  if (sampleTrunkPrim) {
    const uvArr = sampleTrunkPrim.getAttribute('TEXCOORD_0').getArray();
    let maxU = 1.0;
    for (let i = 0; i < uvArr.length; i += 2) {
      if (uvArr[i] > maxU) maxU = uvArr[i];
    }
    if (maxU > 1.2) {
      trunkTileX = Math.round(maxU);
      console.log(`Trunk UV wraps horizontally ${trunkTileX}x (max U: ${maxU.toFixed(2)}). Pre-tiling atlas.`);
    }
  }

  const trunkTex = trunkMat.getBaseColorTexture();
  const leafTex = leafMat.getBaseColorTexture();

  if (!trunkTex || !leafTex) {
    console.error(`Missing baseColor texture in ${mapping.srcName}`);
    return;
  }

  // 2. Build Atlas (1024x1024): Left 512x1024 Trunk (pre-tiled if needed), Right 512x1024 Leaves
  console.log('Generating unified 1024x1024 atlas with alpha edge dilation...');
  
  let trunkBuffer;
  if (trunkTileX > 1) {
    const singleW = Math.floor(512 / trunkTileX);
    const singleTile = await sharp(trunkTex.getImage()).resize(singleW, 1024).ensureAlpha().toBuffer();
    const composites = [];
    for (let i = 0; i < trunkTileX; i++) {
      composites.push({ input: singleTile, left: i * singleW, top: 0 });
    }
    trunkBuffer = await sharp({
      create: { width: 512, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
    }).composite(composites).png().toBuffer();
  } else {
    trunkBuffer = await sharp(trunkTex.getImage()).resize(512, 1024).ensureAlpha().toBuffer();
  }

  const leafDilated = await dilateAlpha(leafTex.getImage(), 512, 1024);

  const atlasPngBuffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite([
    { input: trunkBuffer, left: 0, top: 0 },
    { input: leafDilated, left: 512, top: 0 }
  ]).png({ quality: 90, compressionLevel: 9 }).toBuffer();

  const atlasSizeKb = (atlasPngBuffer.length / 1024).toFixed(1);
  console.log(`Atlas created: 1024x1024 PNG (${atlasSizeKb} KB)`);

  const atlasFileName = `${mapping.dstName}_atlas.png`;
  fs.writeFileSync(path.join(outDir, atlasFileName), atlasPngBuffer);

  // 3. Process each LOD level
  const srcLodFiles = ['tree_LOD0.glb', 'tree_LOD1.glb', 'tree_LOD2.glb'];

  for (let lodIdx = 0; lodIdx < srcLodFiles.length; lodIdx++) {
    const srcLodFileName = srcLodFiles[lodIdx];
    const srcLodFile = path.join(srcDir, srcLodFileName);
    if (!fs.existsSync(srcLodFile)) {
      console.warn(`File ${srcLodFile} not found, skipping.`);
      continue;
    }

    const dstGlbFileName = `${mapping.dstName}_LOD${lodIdx}.glb`;

    const srcDoc = await io.read(srcLodFile);
    const srcRoot = srcDoc.getRoot();

    let srcTrunkPrim = null;
    let srcLeafPrim = null;

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
      } else if (meshes.length === 1 && meshes[0].listPrimitives().length >= 2) {
        srcTrunkPrim = meshes[0].listPrimitives()[0];
        srcLeafPrim = meshes[0].listPrimitives()[1];
      }
    }

    if (!srcTrunkPrim || !srcLeafPrim) {
      console.error(`Could not locate trunk and leaf primitives for ${mapping.srcName} ${srcLodFileName}`);
      continue;
    }

    // Extract geometry arrays
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
    const mergedColor = new Float32Array(totalVerts * 4);

    // Copy Trunk Vertices
    mergedPos.set(trunkPos, 0);
    mergedNorm.set(trunkNorm, 0);
    for (let i = 0; i < trunkVertCount; i++) {
      // Remap UV to left half of atlas [0.0 - 0.5] accounting for horizontal tiling
      const uNorm = trunkTileX > 1 ? (trunkUV[i * 2] / trunkTileX) : trunkUV[i * 2];
      mergedUV[i * 2] = Math.max(0.0, Math.min(0.5, uNorm * 0.5));
      mergedUV[i * 2 + 1] = trunkUV[i * 2 + 1];
      mergedBarkMask[i] = 1.0; // 1.0 = Trunk / Bark
      mergedColor[i * 4] = 1.0;     // R
      mergedColor[i * 4 + 1] = 1.0; // G
      mergedColor[i * 4 + 2] = 1.0; // B
      mergedColor[i * 4 + 3] = 1.0; // A = Bark Flag
    }

    // Copy Leaf Vertices
    mergedPos.set(leafPos, trunkVertCount * 3);
    mergedNorm.set(leafNorm, trunkVertCount * 3);
    for (let i = 0; i < leafVertCount; i++) {
      const dstIdx = trunkVertCount + i;
      // Remap UV to right half of atlas [0.5 - 1.0]
      mergedUV[dstIdx * 2] = 0.5 + Math.max(0.0, Math.min(1.0, leafUV[i * 2])) * 0.5;
      mergedUV[dstIdx * 2 + 1] = leafUV[i * 2 + 1];
      mergedBarkMask[dstIdx] = 0.0; // 0.0 = Leaves / Foliage
      mergedColor[dstIdx * 4] = 1.0;     // R = 1.0
      mergedColor[dstIdx * 4 + 1] = 1.0; // G = 1.0
      mergedColor[dstIdx * 4 + 2] = 1.0; // B = 1.0
      mergedColor[dstIdx * 4 + 3] = 1.0; // A = 1.0
    }

    // Merged Indices
    const totalIndices = trunkIdx.length + leafIdx.length;
    const mergedIndices = new Uint32Array(totalIndices);
    mergedIndices.set(trunkIdx, 0);
    for (let i = 0; i < leafIdx.length; i++) {
      mergedIndices[trunkIdx.length + i] = leafIdx[i] + trunkVertCount;
    }

    // Ground centering (Y = 0)
    let minY = Infinity;
    for (let i = 1; i < mergedPos.length; i += 3) {
      if (mergedPos[i] < minY) minY = mergedPos[i];
    }
    if (Math.abs(minY) > 0.001) {
      for (let i = 1; i < mergedPos.length; i += 3) {
        mergedPos[i] -= minY;
      }
    }

    // Build fresh GLTF Document
    const outDoc = new Document();
    const buffer = outDoc.createBuffer();
    const scene = outDoc.createScene(`${mapping.dstName}_LOD${lodIdx}`);

    const atlasTex = outDoc.createTexture(`${mapping.dstName}_atlas`)
      .setImage(atlasPngBuffer)
      .setMimeType('image/png');

    const unifiedMat = outDoc.createMaterial(`${mapping.dstName}_Material`)
      .setBaseColorTexture(atlasTex)
      .setAlphaMode('MASK')
      .setAlphaCutoff(0.5)
      .setDoubleSided(true)
      .setRoughnessFactor(0.8)
      .setMetallicFactor(0.0);

    const outMesh = outDoc.createMesh(`${mapping.dstName}_Mesh_LOD${lodIdx}`);
    const outPrim = outDoc.createPrimitive()
      .setMode(4) // TRIANGLES
      .setMaterial(unifiedMat)
      .setAttribute('POSITION', outDoc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(mergedPos))
      .setAttribute('NORMAL', outDoc.createAccessor().setBuffer(buffer).setType('VEC3').setArray(mergedNorm))
      .setAttribute('TEXCOORD_0', outDoc.createAccessor().setBuffer(buffer).setType('VEC2').setArray(mergedUV))
      .setAttribute('_aisbark', outDoc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(mergedBarkMask))
      .setAttribute('COLOR_0', outDoc.createAccessor().setBuffer(buffer).setType('VEC4').setArray(mergedColor))
      .setIndices(outDoc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(mergedIndices));

    outMesh.addPrimitive(outPrim);
    const outNode = outDoc.createNode(`${mapping.dstName}_Node_LOD${lodIdx}`).setMesh(outMesh);
    scene.addChild(outNode);

    // Apply optimization and compression passes
    await outDoc.transform(
      prune(),
      dedup(),
      reorder({ encoder: MeshoptEncoder }),
      quantize(),
      meshopt({ encoder: MeshoptEncoder, level: 'high' })
    );

    const outGlbPath = path.join(outDir, dstGlbFileName);
    await io.write(outGlbPath, outDoc);

    // Remove legacy generic named file if exists
    const legacyPath = path.join(outDir, srcLodFileName);
    if (fs.existsSync(legacyPath) && legacyPath !== outGlbPath) {
      fs.unlinkSync(legacyPath);
    }

    const origStat = fs.statSync(srcLodFile);
    const newStat = fs.statSync(outGlbPath);
    const origMb = (origStat.size / 1024 / 1024).toFixed(2);
    const newKb = (newStat.size / 1024).toFixed(1);
    const ratio = ((1 - newStat.size / origStat.size) * 100).toFixed(1);

    console.log(`  [${dstGlbFileName}] ${totalVerts} verts, ${totalIndices / 3} tris | Size: ${origMb} MB -> ${newKb} KB (-${ratio}%)`);
  }

  // Remove legacy generic atlas if exists
  const legacyAtlas = path.join(outDir, 'tree_atlas.png');
  if (fs.existsSync(legacyAtlas) && legacyAtlas !== path.join(outDir, atlasFileName)) {
    fs.unlinkSync(legacyAtlas);
  }
}

async function run() {
  console.log('Starting Tree LOD Optimization & Atlasing Pipeline...');
  const startTime = Date.now();

  for (const mapping of treeMappings) {
    await processTree(mapping);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`All 9 Tree Packages processed in ${elapsed}s!`);
  console.log(`Output Directory: ${outBaseDir}`);
  console.log(`========================================`);
}

run().catch(console.error);
