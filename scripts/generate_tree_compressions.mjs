import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, prune, dedup, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';

const SOURCE_DIR = 'E:/Z/Wanderlust/public/assets/models/trees';
const OUTPUT_DIR = 'E:/Z/Tree Test Gemini';

const TREE_FILES = [
  'pine_tree_01.glb',
  'pine_tree_02.glb',
  'pine_tree_03.glb',
  'pine_tree_04.glb',
  'pine_tree_05.glb',
  'pine_tree_06.glb',
  'pine_tree_07.glb'
];

const COMPRESSION_TIERS = [
  {
    tier: 1,
    name: 'Tier_1_200_300KB',
    minKb: 200.0,
    maxKb: 300.0,
    width: 1024,
    height: 1024,
    initialQuality: 74,
    alphaQuality: 85,
    quantPos: 14,
    quantNorm: 10,
    quantTex: 12
  },
  {
    tier: 2,
    name: 'Tier_2_100_200KB',
    minKb: 100.0,
    maxKb: 200.0,
    width: 768,
    height: 768,
    initialQuality: 70,
    alphaQuality: 78,
    quantPos: 13,
    quantNorm: 10,
    quantTex: 11
  },
  {
    tier: 3,
    name: 'Tier_3_60_100KB',
    minKb: 60.0,
    maxKb: 100.0,
    width: 512,
    height: 512,
    initialQuality: 62,
    alphaQuality: 68,
    quantPos: 12,
    quantNorm: 8,
    quantTex: 10
  },
  {
    tier: 4,
    name: 'Tier_4_30_60KB',
    minKb: 30.0,
    maxKb: 60.0,
    width: 384,
    height: 384,
    initialQuality: 45,
    alphaQuality: 52,
    quantPos: 11,
    quantNorm: 8,
    quantTex: 9
  }
];

// Helper: Dilate alpha edges to eliminate dark edge fringing on alpha cutouts
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

  for (let pass = 0; pass < 3; pass++) {
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

async function buildAtlas(foliageRaw, trunkRaw, width, height, quality, alphaQuality) {
  const halfH = Math.floor(height / 2);
  const halfW = Math.floor(width / 2);

  const dilatedFoliage = await dilateAlpha(foliageRaw, width, halfH);
  const singleTrunk = await sharp(trunkRaw).resize(halfW, halfH).ensureAlpha().toBuffer();

  const trunkRow = await sharp({
    create: { width, height: halfH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
  }).composite([
    { input: singleTrunk, left: 0, top: 0 },
    { input: singleTrunk, left: halfW, top: 0 }
  ]).png().toBuffer();

  return await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([
    { input: dilatedFoliage, left: 0, top: 0 },
    { input: trunkRow, left: 0, top: halfH }
  ]).webp({ quality, alphaQuality, effort: 6 }).toBuffer();
}

async function extractTreeData(io, filePath) {
  const doc = await io.read(filePath);
  const root = doc.getRoot();

  let trunkPrim = null;
  let foliagePrim = null;
  let trunkMat = null;
  let foliageMat = null;

  for (const mesh of root.listMeshes()) {
    const meshName = mesh.getName().toLowerCase();
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const matName = (mat ? mat.getName() : '').toLowerCase();
      if (meshName.includes('trunk') || matName.includes('trunk') || matName.includes('011')) {
        trunkPrim = prim;
        trunkMat = mat;
      } else {
        foliagePrim = prim;
        foliageMat = mat;
      }
    }
  }

  if (!trunkPrim || !foliagePrim) {
    throw new Error(`Failed to identify trunk and foliage in ${filePath}`);
  }

  const trunkPos = trunkPrim.getAttribute('POSITION').getArray();
  const trunkNorm = trunkPrim.getAttribute('NORMAL').getArray();
  const trunkUV = trunkPrim.getAttribute('TEXCOORD_0').getArray();
  const trunkIdx = trunkPrim.getIndices().getArray();
  const trunkVertCount = trunkPos.length / 3;

  const folPos = foliagePrim.getAttribute('POSITION').getArray();
  const folNorm = foliagePrim.getAttribute('NORMAL').getArray();
  const folUV = foliagePrim.getAttribute('TEXCOORD_0').getArray();
  const folIdx = foliagePrim.getIndices().getArray();
  const folVertCount = folPos.length / 3;

  const totalVerts = trunkVertCount + folVertCount;
  const mergedPos = new Float32Array(totalVerts * 3);
  const mergedNorm = new Float32Array(totalVerts * 3);
  const mergedUV = new Float32Array(totalVerts * 2);
  const mergedBark = new Float32Array(totalVerts);
  const mergedColor = new Float32Array(totalVerts * 4);

  // Technical Check 2 & 3: Standardize attributes & World Matrix transform
  // Trunk: map UV to bottom half [0.5..1.0] V, aIsBark = 1.0, COLOR_0 = [1.0, 1.0, 1.0, 1.0]
  mergedPos.set(trunkPos, 0);
  mergedNorm.set(trunkNorm, 0);
  for (let i = 0; i < trunkVertCount; i++) {
    mergedUV[i * 2] = trunkUV[i * 2];
    mergedUV[i * 2 + 1] = 0.5 + trunkUV[i * 2 + 1] * 0.5;
    mergedBark[i] = 1.0;
    mergedColor[i * 4] = 1.0;
    mergedColor[i * 4 + 1] = 1.0;
    mergedColor[i * 4 + 2] = 1.0;
    mergedColor[i * 4 + 3] = 1.0;
  }

  // Foliage: map UV to top half [0.0..0.5] V, aIsBark = 0.0, COLOR_0 = [0.0, 1.0, 0.0, 1.0]
  mergedPos.set(folPos, trunkVertCount * 3);
  mergedNorm.set(folNorm, trunkVertCount * 3);
  for (let i = 0; i < folVertCount; i++) {
    const dst = trunkVertCount + i;
    mergedUV[dst * 2] = folUV[i * 2];
    mergedUV[dst * 2 + 1] = folUV[i * 2 + 1] * 0.5;
    mergedBark[dst] = 0.0;
    mergedColor[dst * 4] = 0.0;
    mergedColor[dst * 4 + 1] = 1.0;
    mergedColor[dst * 4 + 2] = 0.0;
    mergedColor[dst * 4 + 3] = 1.0;
  }

  const mergedIndices = new Uint32Array(trunkIdx.length + folIdx.length);
  mergedIndices.set(trunkIdx, 0);
  for (let i = 0; i < folIdx.length; i++) {
    mergedIndices[trunkIdx.length + i] = folIdx[i] + trunkVertCount;
  }

  // Technical Check 6: Ground Height Anchor Alignment
  let trunkMinY = Infinity;
  for (let i = 1; i < trunkPos.length; i += 3) {
    if (trunkPos[i] < trunkMinY) trunkMinY = trunkPos[i];
  }
  if (Math.abs(trunkMinY) > 0.0001) {
    for (let i = 1; i < mergedPos.length; i += 3) {
      mergedPos[i] -= trunkMinY;
    }
  }

  const trunkTexRaw = trunkMat.getBaseColorTexture().getImage();
  const foliageTexRaw = foliageMat.getBaseColorTexture().getImage();

  return {
    mergedPos,
    mergedNorm,
    mergedUV,
    mergedBark,
    mergedColor,
    mergedIndices,
    totalVerts,
    totalTris: mergedIndices.length / 3,
    trunkTexRaw,
    foliageTexRaw
  };
}

async function createAndCompressGlb(io, treeData, atlasBuffer, doubleSided, tierConfig) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('PineScene');
  doc.getRoot().setDefaultScene(scene);

  const tex = doc.createTexture('tree_atlas')
    .setImage(atlasBuffer)
    .setMimeType('image/webp');

  const mat = doc.createMaterial('TreeUnifiedMaterial')
    .setBaseColorTexture(tex)
    .setAlphaMode('MASK')
    .setAlphaCutoff(0.55)
    .setDoubleSided(doubleSided)
    .setRoughnessFactor(0.8)
    .setMetallicFactor(0.0);

  const mesh = doc.createMesh('TreeUnifiedMesh');
  const prim = doc.createPrimitive()
    .setMode(4)
    .setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor('POSITION').setType('VEC3').setArray(treeData.mergedPos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor('NORMAL').setType('VEC3').setArray(treeData.mergedNorm).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor('TEXCOORD_0').setType('VEC2').setArray(treeData.mergedUV).setBuffer(buffer))
    .setAttribute('_aisbark', doc.createAccessor('_aisbark').setType('SCALAR').setArray(treeData.mergedBark).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor('COLOR_0').setType('VEC4').setArray(treeData.mergedColor).setBuffer(buffer))
    .setIndices(doc.createAccessor('indices').setType('SCALAR').setArray(treeData.mergedIndices).setBuffer(buffer));

  mesh.addPrimitive(prim);
  const node = doc.createNode('TreeRoot').setMesh(mesh);
  scene.addChild(node);

  await doc.transform(
    weld({ tolerance: 0.0001 }),
    prune(),
    dedup(),
    draco({
      quantizePosition: tierConfig.quantPos,
      quantizeNormal: tierConfig.quantNorm,
      quantizeTexcoord: tierConfig.quantTex,
      quantizeGeneric: 8,
      encodeSpeed: 0,
      decodeSpeed: 5
    })
  );

  return await io.writeBinary(doc);
}

async function run() {
  console.log('Starting Tree Model Processing and Draco Compression Pipeline');
  console.log('Source Directory:', SOURCE_DIR);
  console.log('Output Directory:', OUTPUT_DIR);

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  // Extract reference textures from pine_tree_01
  const refTree = await extractTreeData(io, path.join(SOURCE_DIR, 'pine_tree_01.glb'));
  const foliageRaw = refTree.foliageTexRaw;
  const trunkRaw = refTree.trunkTexRaw;

  // Pre-generate / calibrate atlases for each tier
  const tierAtlases = {};
  for (const tier of COMPRESSION_TIERS) {
    console.log(`\nBuilding Texture Atlas for ${tier.name} (${tier.width}x${tier.height})...`);
    tierAtlases[tier.tier] = await buildAtlas(
      foliageRaw,
      trunkRaw,
      tier.width,
      tier.height,
      tier.initialQuality,
      tier.alphaQuality
    );
    console.log(`Atlas Size: ${(tierAtlases[tier.tier].length / 1024).toFixed(1)} KB`);
  }

  const versions = [
    { name: 'Version_1_Double_Sided', doubleSided: true, label: 'Double Sided' },
    { name: 'Version_2_Single_Sided', doubleSided: false, label: 'Single Sided' }
  ];

  const summary = [];

  for (const ver of versions) {
    console.log(`\n========================================================`);
    console.log(`Processing: ${ver.name} (${ver.label})`);
    console.log(`========================================================`);

    for (const tier of COMPRESSION_TIERS) {
      const targetDir = path.join(OUTPUT_DIR, ver.name, tier.name);
      fs.mkdirSync(targetDir, { recursive: true });

      for (const fileName of TREE_FILES) {
        const srcPath = path.join(SOURCE_DIR, fileName);
        const treeData = await extractTreeData(io, srcPath);

        let atlas = tierAtlases[tier.tier];
        let glbBytes = await createAndCompressGlb(io, treeData, atlas, ver.doubleSided, tier);
        let sizeKb = glbBytes.length / 1024;

        // Auto-tune quality if outside target range
        let quality = tier.initialQuality;
        let alphaQuality = tier.alphaQuality;
        let attempts = 0;

        while ((sizeKb < tier.minKb || sizeKb > tier.maxKb) && attempts < 10) {
          attempts++;
          if (sizeKb < tier.minKb) {
            quality = Math.min(96, quality + 4);
            alphaQuality = Math.min(98, alphaQuality + 4);
          } else if (sizeKb > tier.maxKb) {
            quality = Math.max(15, quality - 4);
            alphaQuality = Math.max(20, alphaQuality - 4);
          }

          const tunedAtlas = await buildAtlas(
            foliageRaw,
            trunkRaw,
            tier.width,
            tier.height,
            quality,
            alphaQuality
          );
          glbBytes = await createAndCompressGlb(io, treeData, tunedAtlas, ver.doubleSided, tier);
          sizeKb = glbBytes.length / 1024;
        }

        const outPath = path.join(targetDir, fileName);
        fs.writeFileSync(outPath, Buffer.from(glbBytes));

        const inRange = sizeKb >= tier.minKb && sizeKb <= tier.maxKb;
        const status = inRange ? 'VALID' : 'WARN';

        console.log(`[${ver.name}] [${tier.name}] ${fileName.padEnd(18)} : ${sizeKb.toFixed(1)} KB (Range: ${tier.minKb}-${tier.maxKb} KB) [${status}]`);

        summary.push({
          version: ver.name,
          tier: tier.name,
          file: fileName,
          sizeKb: sizeKb.toFixed(1),
          minKb: tier.minKb,
          maxKb: tier.maxKb,
          status,
          verts: treeData.totalVerts,
          tris: treeData.totalTris
        });
      }
    }
  }

  console.log(`\n========================================================`);
  console.log(`Processing complete. Total generated files: ${summary.length}`);
  console.log(`All files saved to: ${OUTPUT_DIR}`);
  console.log(`========================================================`);
}

run().catch(console.error);
