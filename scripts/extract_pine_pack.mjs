import { Document, NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, prune, dedup, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import draco3d from 'draco3d';
import fs from 'fs';
import path from 'path';

async function extractPinePack() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const decoder = await draco3d.createDecoderModule();

  const io = new NodeIO()
    .registerExtensions([...KHRONOS_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression])
    .registerDependencies({
      'draco3d.decoder': decoder,
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder
    });

  const srcPath = 'public/assets/Trees/pine_trees.glb';
  if (!fs.existsSync(srcPath)) {
    console.error('File not found:', srcPath);
    return;
  }

  console.log('Reading pine_trees.glb...');
  const srcDoc = await io.read(srcPath);
  const root = srcDoc.getRoot();

  const outBase = 'public/assets/Trees/Pines_Pack';
  if (!fs.existsSync(outBase)) fs.mkdirSync(outBase, { recursive: true });

  const treeGroups = [
    { name: 'Pine_Tall_01', lods: ['SM_Pine01', 'SM_Pine01_lod1', 'SM_Pine01_lod2', 'SM_Pine01_lod3'] },
    { name: 'Pine_Tall_02', lods: ['SM_Pine02', 'SM_Pine02_lod1', 'SM_Pine02_lod2', 'SM_Pine02_lod3'] },
    { name: 'Pine_Tall_03', lods: ['SM_Pine03', 'SM_Pine03_lod1', 'SM_Pine03_lod2', 'SM_Pine03_lod3'] },
    { name: 'Pine_Mid_01',  lods: ['SM_PineMedium01', 'SM_PineMedium01_lod1', 'SM_PineMedium01_lod2', 'SM_PineMedium01_lod3'] },
    { name: 'Pine_Mid_02',  lods: ['SM_PineMedium02', 'SM_PineMedium02_lod1', 'SM_PineMedium02_lod2', 'SM_PineMedium02_lod3'] },
    { name: 'Pine_Small_01', lods: ['SM_PineSmall01', 'SM_PineSmall01_lod1', 'SM_PineSmall01_lod2', 'SM_PineSmall01_lod3'] },
    { name: 'Pine_Dead_01', lods: ['SM_PineDead01', 'SM_PineDead01_lod1', 'SM_PineDead01_lod2', 'SM_PineDead01_lod3'] },
    { name: 'Pine_Dead_02', lods: ['SM_PineDead02', 'SM_PineDead02_lod1', 'SM_PineDead02_lod2', 'SM_PineDead02_lod3'] },
    { name: 'Pine_Dead_03', lods: ['SM_PineDead03', 'SM_PineDead03_lod1', 'SM_PineDead03_lod2', 'SM_PineDead03_lod3'] }
  ];

  // Helper to find a node by name or substring
  function findNode(name) {
    return root.listNodes().find(n => n.getName() === name || n.getName().startsWith(name));
  }

  // Collect all meshes under a node (recursively)
  function getMeshesUnderNode(node) {
    const list = [];
    if (!node) return list;
    if (node.getMesh()) list.push({ mesh: node.getMesh(), node });
    node.listChildren().forEach(child => {
      list.push(...getMeshesUnderNode(child));
    });
    return list;
  }

  for (const group of treeGroups) {
    const groupDir = path.join(outBase, group.name);
    if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });

    console.log(`Processing tree group: ${group.name}`);

    for (let lodIdx = 0; lodIdx < group.lods.length; lodIdx++) {
      const lodNodeName = group.lods[lodIdx];
      const targetNode = findNode(lodNodeName);
      if (!targetNode) {
        console.warn(`  LOD node not found: ${lodNodeName}`);
        continue;
      }

      const targetMeshes = getMeshesUnderNode(targetNode);
      if (targetMeshes.length === 0) {
        // Maybe the node itself has a mesh directly or in siblings
        console.warn(`  No meshes found under: ${lodNodeName}`);
        continue;
      }

      // Create a clean new Document for this specific LOD
      const doc = new Document();
      const docRoot = doc.getRoot();
      const scene = doc.createScene(group.name + `_LOD${lodIdx}`);
      docRoot.setDefaultScene(scene);

      const buffer = doc.createBuffer();
      const matMap = new Map();

      const combinedNode = doc.createNode(group.name + `_LOD${lodIdx}`);
      scene.addChild(combinedNode);

      for (const { mesh: srcMesh, node: srcNode } of targetMeshes) {
        const destMesh = doc.createMesh(srcMesh.getName());
        combinedNode.setMesh(destMesh);

        for (const srcPrim of srcMesh.listPrimitives()) {
          const destPrim = doc.createPrimitive();
          destPrim.setMode(srcPrim.getMode());

          // Clone attributes
          for (const sem of srcPrim.listSemantics()) {
            const srcAttr = srcPrim.getAttribute(sem);
            if (srcAttr) {
              const destAttr = doc.createAccessor()
                .setArray(srcAttr.getArray().slice())
                .setType(srcAttr.getType())
                .setNormalized(srcAttr.getNormalized())
                .setBuffer(buffer);
              destPrim.setAttribute(sem, destAttr);
            }
          }

          // Clone indices
          const srcIdx = srcPrim.getIndices();
          if (srcIdx) {
            const destIdx = doc.createAccessor()
              .setArray(srcIdx.getArray().slice())
              .setType(srcIdx.getType())
              .setBuffer(buffer);
            destPrim.setIndices(destIdx);
          }

          // Clone Material & Textures
          const srcMat = srcPrim.getMaterial();
          if (srcMat) {
            if (!matMap.has(srcMat)) {
              const destMat = doc.createMaterial(srcMat.getName())
                .setAlphaMode(srcMat.getAlphaMode())
                .setAlphaCutoff(srcMat.getAlphaCutoff())
                .setDoubleSided(true)
                .setRoughnessFactor(srcMat.getRoughnessFactor())
                .setMetallicFactor(srcMat.getMetallicFactor())
                .setBaseColorFactor(srcMat.getBaseColorFactor());

              const srcTex = srcMat.getBaseColorTexture();
              if (srcTex) {
                const destTex = doc.createTexture(srcTex.getName())
                  .setImage(srcTex.getImage())
                  .setMimeType(srcTex.getMimeType());
                destMat.setBaseColorTexture(destTex);
              }
              matMap.set(srcMat, destMat);
            }
            destPrim.setMaterial(matMap.get(srcMat));
          }

          destMesh.addPrimitive(destPrim);
        }
      }

      await doc.transform(
        weld(),
        prune(),
        dedup()
      );

      const outGlbPath = path.join(groupDir, `${group.name}_LOD${lodIdx}.glb`);
      const glbBytes = await io.writeBinary(doc);
      fs.writeFileSync(outGlbPath, Buffer.from(glbBytes));
      console.log(`  Saved: ${outGlbPath} (${(glbBytes.byteLength / 1024).toFixed(1)} KB)`);
    }
  }

  console.log('Pine pack extraction complete!');
}

extractPinePack().catch(console.error);
