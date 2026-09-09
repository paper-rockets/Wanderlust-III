import { Document, NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const inputPath = 'E:/CLAUDE/extracted/stylized-assets/public/assets/trees-rocks.glb';
const outputDir = 'E:/Z FUCK CLAUDE/public/assets/Trees/01';
const texturesDir = path.join(outputDir, 'textures');

const birchTrunkImg = fs.readFileSync(path.join(texturesDir, 'birch_trunk_colored.png'));
const birchLeavesImg = fs.readFileSync(path.join(texturesDir, 'birch_leaves_colored.png'));
const pineTrunkImg = fs.readFileSync(path.join(texturesDir, 'pine_trunk_colored.png'));
const pineLeavesImg = fs.readFileSync(path.join(texturesDir, 'pine_leaves_colored.png'));

async function extractTrees() {
  const treeDefinitions = [
    {
      name: 'tree_birch_01',
      displayName: 'Birch Tree 01',
      type: 'birch',
      baseTranslation: [2.0, 0.0, 0.0],
      nodes: [
        { name: 'Trunk', sourceNodeName: 'IL3DN_Tree_Birch_01_Branch_LOD1', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Birch_01_Leaves_LOD1', isLeaves: true }
      ],
      allLodNodes: [
        { name: 'Trunk_LOD1', sourceNodeName: 'IL3DN_Tree_Birch_01_Branch_LOD1', isTrunk: true },
        { name: 'Trunk_LOD2', sourceNodeName: 'IL3DN_Tree_Birch_01_Branch_LOD2', isTrunk: true },
        { name: 'Trunk_LOD3', sourceNodeName: 'IL3DN_Tree_Birch_01_Branch_LOD3', isTrunk: true },
        { name: 'Canopy_LOD1', sourceNodeName: 'IL3DN_Tree_Birch_01_Leaves_LOD1', isLeaves: true },
        { name: 'Canopy_LOD2', sourceNodeName: 'IL3DN_Tree_Birch_01_Leaves_LOD2', isLeaves: true },
        { name: 'Canopy_LOD3', sourceNodeName: 'IL3DN_Tree_Birch_01_Leaves_LOD3', isLeaves: true }
      ]
    },
    {
      name: 'tree_birch_02',
      displayName: 'Birch Tree 02',
      type: 'birch',
      baseTranslation: [-6.0, 0.0, 0.0],
      nodes: [
        { name: 'Trunk', sourceNodeName: 'IL3DN_Tree_Birch_02_Branch_LOD1', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Birch_02_Leaves_LOD1', isLeaves: true }
      ],
      allLodNodes: [
        { name: 'Trunk_LOD1', sourceNodeName: 'IL3DN_Tree_Birch_02_Branch_LOD1', isTrunk: true },
        { name: 'Trunk_LOD2', sourceNodeName: 'IL3DN_Tree_Birch_02_Branch_LOD2', isTrunk: true },
        { name: 'Trunk_LOD3', sourceNodeName: 'IL3DN_Tree_Birch_02_Branch_LOD3', isTrunk: true },
        { name: 'Canopy_LOD1', sourceNodeName: 'IL3DN_Tree_Birch_02_Leaves_LOD1', isLeaves: true },
        { name: 'Canopy_LOD2', sourceNodeName: 'IL3DN_Tree_Birch_02_Leaves_LOD2', isLeaves: true },
        { name: 'Canopy_LOD3', sourceNodeName: 'IL3DN_Tree_Birch_02_Leaves_LOD3', isLeaves: true }
      ]
    },
    {
      name: 'tree_birch_03',
      displayName: 'Birch Tree 03',
      type: 'birch',
      baseTranslation: [-14.0, 0.0, 0.0],
      nodes: [
        { name: 'Trunk', sourceNodeName: 'IL3DN_Tree_Birch_03_Branch_LOD1', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Birch_03_Leaves_LOD1', isLeaves: true }
      ],
      allLodNodes: [
        { name: 'Trunk_LOD1', sourceNodeName: 'IL3DN_Tree_Birch_03_Branch_LOD1', isTrunk: true },
        { name: 'Trunk_LOD2', sourceNodeName: 'IL3DN_Tree_Birch_03_Branch_LOD2', isTrunk: true },
        { name: 'Trunk_LOD3', sourceNodeName: 'IL3DN_Tree_Birch_03_Branch_LOD3', isTrunk: true },
        { name: 'Canopy_LOD1', sourceNodeName: 'IL3DN_Tree_Birch_03_Leaves_LOD1', isLeaves: true },
        { name: 'Canopy_LOD2', sourceNodeName: 'IL3DN_Tree_Birch_03_Leaves_LOD2', isLeaves: true },
        { name: 'Canopy_LOD3', sourceNodeName: 'IL3DN_Tree_Birch_03_Leaves_LOD3', isLeaves: true }
      ]
    },
    {
      name: 'tree_pine_01',
      displayName: 'Pine Tree 01',
      type: 'pine',
      baseTranslation: [2.0, 0.0, 14.693550109863281],
      nodes: [
        { name: 'Trunk', sourceNodeName: 'IL3DN_Tree_Pine_01_Branch_LOD0', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Pine_01_Leaves', isLeaves: true }
      ],
      allLodNodes: [
        { name: 'Trunk_LOD0', sourceNodeName: 'IL3DN_Tree_Pine_01_Branch_LOD0', isTrunk: true },
        { name: 'Trunk_LOD1', sourceNodeName: 'IL3DN_Tree_Pine_01_Branch_LOD1', isTrunk: true },
        { name: 'Trunk_LOD2', sourceNodeName: 'IL3DN_Tree_Pine_01_Branch_LOD2', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Pine_01_Leaves', isLeaves: true }
      ]
    },
    {
      name: 'tree_pine_02',
      displayName: 'Pine Tree 02',
      type: 'pine',
      baseTranslation: [-6.0, 0.0, 14.693550109863281],
      nodes: [
        { name: 'Trunk', sourceNodeName: 'IL3DN_Tree_Pine_02_Branch_LOD0', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Pine_02_Leaves', isLeaves: true }
      ],
      allLodNodes: [
        { name: 'Trunk_LOD0', sourceNodeName: 'IL3DN_Tree_Pine_02_Branch_LOD0', isTrunk: true },
        { name: 'Trunk_LOD1', sourceNodeName: 'IL3DN_Tree_Pine_02_Branch_LOD1', isTrunk: true },
        { name: 'Trunk_LOD2', sourceNodeName: 'IL3DN_Tree_Pine_02_Branch_LOD2', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Pine_02_Leaves', isLeaves: true }
      ]
    },
    {
      name: 'tree_pine_03',
      displayName: 'Pine Tree 03',
      type: 'pine',
      baseTranslation: [-14.0, 0.0, 14.693550109863281],
      nodes: [
        { name: 'Trunk', sourceNodeName: 'IL3DN_Tree_Pine_03_Branch_LOD0', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Pine_03_Leaves', isLeaves: true }
      ],
      allLodNodes: [
        { name: 'Trunk_LOD0', sourceNodeName: 'IL3DN_Tree_Pine_03_Branch_LOD0', isTrunk: true },
        { name: 'Trunk_LOD1', sourceNodeName: 'IL3DN_Tree_Pine_03_Branch_LOD1', isTrunk: true },
        { name: 'Trunk_LOD2', sourceNodeName: 'IL3DN_Tree_Pine_03_Branch_LOD2', isTrunk: true },
        { name: 'Canopy', sourceNodeName: 'IL3DN_Tree_Pine_03_Leaves', isLeaves: true }
      ]
    }
  ];

  for (const treeDef of treeDefinitions) {
    await exportTree(treeDef, false);
    await exportTree(treeDef, true);
  }

  console.log('All trees successfully re-exported with full color textures!');
}

async function exportTree(treeDef, includeAllLods) {
  const srcDoc = await io.read(inputPath);
  const srcRoot = srcDoc.getRoot();

  const outDoc = new Document();
  const buffer = outDoc.createBuffer();
  const scene = outDoc.createScene(treeDef.name);

  // Materials & Textures setup
  let trunkMat, leavesMat;
  if (treeDef.type === 'birch') {
    const trunkTex = outDoc.createTexture('birch_trunk')
      .setImage(birchTrunkImg)
      .setMimeType('image/png');
    trunkMat = outDoc.createMaterial('Birch_Trunk')
      .setBaseColorTexture(trunkTex)
      .setRoughnessFactor(0.8)
      .setMetallicFactor(0.0)
      .setDoubleSided(false);

    const leavesTex = outDoc.createTexture('birch_leaves')
      .setImage(birchLeavesImg)
      .setMimeType('image/png');
    leavesMat = outDoc.createMaterial('Birch_Leaves')
      .setBaseColorTexture(leavesTex)
      .setAlphaMode('MASK')
      .setAlphaCutoff(0.3)
      .setDoubleSided(true)
      .setRoughnessFactor(0.5)
      .setMetallicFactor(0.0);
  } else {
    const trunkTex = outDoc.createTexture('pine_trunk')
      .setImage(pineTrunkImg)
      .setMimeType('image/png');
    trunkMat = outDoc.createMaterial('Pine_Trunk')
      .setBaseColorTexture(trunkTex)
      .setRoughnessFactor(0.8)
      .setMetallicFactor(0.0)
      .setDoubleSided(false);

    const leavesTex = outDoc.createTexture('pine_leaves')
      .setImage(pineLeavesImg)
      .setMimeType('image/png');
    leavesMat = outDoc.createMaterial('Pine_Leaves')
      .setBaseColorTexture(leavesTex)
      .setAlphaMode('MASK')
      .setAlphaCutoff(0.3)
      .setDoubleSided(true)
      .setRoughnessFactor(0.5)
      .setMetallicFactor(0.0);
  }

  // Parent root node for the tree
  const treeRootNode = outDoc.createNode(treeDef.displayName);
  scene.addChild(treeRootNode);

  const nodeList = includeAllLods ? treeDef.allLodNodes : treeDef.nodes;

  for (const nodeInfo of nodeList) {
    const srcNode = srcRoot.listNodes().find(n => n.getName() === nodeInfo.sourceNodeName);
    if (!srcNode) {
      console.warn(`Could not find source node: ${nodeInfo.sourceNodeName}`);
      continue;
    }

    const srcMesh = srcNode.getMesh();
    if (!srcMesh) continue;

    const outMesh = outDoc.createMesh(nodeInfo.name);

    for (const srcPrim of srcMesh.listPrimitives()) {
      const outPrim = outDoc.createPrimitive();
      outPrim.setMode(srcPrim.getMode());

      // Copy attributes
      for (const sem of srcPrim.listSemantics()) {
        const srcAttr = srcPrim.getAttribute(sem);
        const outAttr = outDoc.createAccessor()
          .setBuffer(buffer)
          .setType(srcAttr.getType())
          .setArray(srcAttr.getArray())
          .setName(srcAttr.getName());
        outPrim.setAttribute(sem, outAttr);
      }

      // Copy indices
      const srcIndices = srcPrim.getIndices();
      if (srcIndices) {
        const outIndices = outDoc.createAccessor()
          .setBuffer(buffer)
          .setType(srcIndices.getType())
          .setArray(srcIndices.getArray())
          .setName(srcIndices.getName());
        outPrim.setIndices(outIndices);
      }

      // Assign Material
      if (nodeInfo.isTrunk) {
        outPrim.setMaterial(trunkMat);
      } else if (nodeInfo.isLeaves) {
        outPrim.setMaterial(leavesMat);
      }

      outMesh.addPrimitive(outPrim);
    }

    const outNode = outDoc.createNode(nodeInfo.name).setMesh(outMesh);

    // Calculate relative translation (recenter to origin (0, 0, 0))
    const srcTrans = srcNode.getTranslation();
    const relX = srcTrans[0] - treeDef.baseTranslation[0];
    const relY = srcTrans[1] - treeDef.baseTranslation[1];
    const relZ = srcTrans[2] - treeDef.baseTranslation[2];
    outNode.setTranslation([relX, relY, relZ]);

    treeRootNode.addChild(outNode);
  }

  await outDoc.transform(prune(), dedup());

  const filename = includeAllLods ? `${treeDef.name}_all_lods.glb` : `${treeDef.name}.glb`;
  const outPath = path.join(outputDir, filename);
  await io.write(outPath, outDoc);
  console.log(`Saved: ${filename} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

extractTrees().catch(console.error);
