import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import draco3d from 'draco3d';

const TARGET_ROOT = 'E:/Z/Tree Test Gemini';

const TREE_FILES = [
  'pine_tree_01.glb',
  'pine_tree_02.glb',
  'pine_tree_03.glb',
  'pine_tree_04.glb',
  'pine_tree_05.glb',
  'pine_tree_06.glb',
  'pine_tree_07.glb'
];

const VERSIONS = [
  { dir: 'Version_1_Double_Sided', doubleSided: true },
  { dir: 'Version_2_Single_Sided', doubleSided: false }
];

const TIERS = [
  { dir: 'Tier_1_200_300KB', minKb: 200.0, maxKb: 300.0 },
  { dir: 'Tier_2_100_200KB', minKb: 100.0, maxKb: 200.0 },
  { dir: 'Tier_3_60_100KB', minKb: 60.0, maxKb: 100.0 },
  { dir: 'Tier_4_30_60KB', minKb: 30.0, maxKb: 60.0 }
];

async function verifyAll() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  let totalChecked = 0;
  let totalPassed = 0;
  let failures = [];

  console.log('================================================================');
  console.log('Starting Verification for All 56 Tree GLB Models');
  console.log('Target Root:', TARGET_ROOT);
  console.log('================================================================\n');

  for (const ver of VERSIONS) {
    for (const tier of TIERS) {
      for (const fn of TREE_FILES) {
        totalChecked++;
        const filePath = path.join(TARGET_ROOT, ver.dir, tier.dir, fn);

        if (!fs.existsSync(filePath)) {
          failures.push(`Missing file: ${filePath}`);
          continue;
        }

        const stat = fs.statSync(filePath);
        const sizeKb = stat.size / 1024;
        const sizeValid = sizeKb >= tier.minKb && sizeKb <= tier.maxKb;

        const doc = await io.read(filePath);
        const root = doc.getRoot();
        const extensionsUsed = doc.getRoot().listExtensionsUsed().map(e => e.extensionName);
        const hasDraco = extensionsUsed.includes('KHR_draco_mesh_compression');

        const meshes = root.listMeshes();
        const isSingleMesh = meshes.length === 1;
        const prims = meshes.length > 0 ? meshes[0].listPrimitives() : [];
        const isSinglePrim = prims.length === 1;

        let matDoubleSidedValid = false;
        let alphaModeValid = false;
        let alphaCutoffValid = false;
        let attributesValid = false;
        let groundedValid = false;
        let vertCount = 0;
        let triCount = 0;

        if (isSinglePrim) {
          const prim = prims[0];
          const mat = prim.getMaterial();
          if (mat) {
            matDoubleSidedValid = mat.getDoubleSided() === ver.doubleSided;
            alphaModeValid = mat.getAlphaMode() === 'MASK';
            alphaCutoffValid = Math.abs(mat.getAlphaCutoff() - 0.55) < 0.01;
          }

          const semantics = prim.listSemantics();
          const hasPos = semantics.includes('POSITION');
          const hasNorm = semantics.includes('NORMAL');
          const hasUV = semantics.includes('TEXCOORD_0');
          const hasColor = semantics.includes('COLOR_0');
          const hasBark = !!prim.getAttribute('_aisbark');
          attributesValid = hasPos && hasNorm && hasUV && hasColor && hasBark;

          await doc.transform(dequantize());

          const posAcc = prim.getAttribute('POSITION');
          if (posAcc) {
            vertCount = posAcc.getCount();
            const posArr = posAcc.getArray();
            let minY = Infinity;
            for (let i = 1; i < posArr.length; i += 3) {
              if (posArr[i] < minY) minY = posArr[i];
            }
            groundedValid = Math.abs(minY) < 0.02;
          }

          const indAcc = prim.getIndices();
          if (indAcc) {
            triCount = indAcc.getCount() / 3;
          }
        }

        const checks = {
          sizeValid,
          hasDraco,
          isSingleMesh,
          isSinglePrim,
          matDoubleSidedValid,
          alphaModeValid,
          alphaCutoffValid,
          attributesValid,
          groundedValid
        };

        const allPass = Object.values(checks).every(Boolean);

        if (allPass) {
          totalPassed++;
          console.log(`[PASS] ${ver.dir.padEnd(23)} | ${tier.dir.padEnd(18)} | ${fn.padEnd(16)} : ${sizeKb.toFixed(1).padStart(5)} KB | ${vertCount} verts | ${triCount} tris | 1 Mesh/1 Prim | Draco: OK | DoubleSided: ${ver.doubleSided}`);
        } else {
          failures.push({
            file: `${ver.dir}/${tier.dir}/${fn}`,
            sizeKb: sizeKb.toFixed(1),
            checks
          });
          console.log(`[FAIL] ${ver.dir}/${tier.dir}/${fn} :`, checks);
        }
      }
    }
  }

  console.log('\n================================================================');
  console.log(`Verification Summary: ${totalPassed} / ${totalChecked} PASSED`);
  if (failures.length === 0) {
    console.log('ALL 56 MODELS PASSED 100% OF TECHNICAL AND SPECIFICATION CHECKS!');
  } else {
    console.log(`FAILURES (${failures.length}):`, JSON.stringify(failures, null, 2));
  }
  console.log('================================================================');
}

verifyAll().catch(console.error);
