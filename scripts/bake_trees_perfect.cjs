const fs = require('fs');
const path = require('path');
const { NodeIO, Document } = require('@gltf-transform/core');
const THREE = require('three');

function getNodeLocalMatrix(node) {
  const t = node.getTranslation();
  const r = node.getRotation();
  const s = node.getScale();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3(t[0], t[1], t[2]);
  const quat = new THREE.Quaternion(r[0], r[1], r[2], r[3]);
  const scale = new THREE.Vector3(s[0], s[1], s[2]);
  m.compose(pos, quat, scale);
  return m;
}

function getNodeWorldMatrix(node) {
  const chain = [];
  let curr = node;
  while (curr) {
    chain.unshift(curr);
    curr = curr.getParentNode();
  }
  const worldMat = new THREE.Matrix4();
  for (const n of chain) {
    const localMat = getNodeLocalMatrix(n);
    worldMat.multiply(localMat);
  }
  return worldMat;
}

async function bakePerfectTrees() {
  const io = new NodeIO();
  const doc = await io.read('external/stylized-components/public/assets/grass-scene.glb');
  const root = doc.getRoot();

  const outDir = 'public/assets/models/trees';
  fs.mkdirSync(outDir, { recursive: true });

  // 13 complete tree pairs (trunk node name, canopy node name)
  const treePairs = [
    { name: 'pine_tree_01', trunk: 'Cylinder.000_0', canopy: 'Cylinder.000_1' },
    { name: 'pine_tree_02', trunk: 'Cylinder.000_0.001', canopy: 'Cylinder.000_1.001' },
    { name: 'pine_tree_03', trunk: 'Cylinder.000_0.003', canopy: 'Cylinder.000_1.003' },
    { name: 'pine_tree_04', trunk: 'Cylinder.001_0', canopy: 'Cylinder.001_1' },
    { name: 'pine_tree_05', trunk: 'Cylinder.001_0.001', canopy: 'Cylinder.001_1.001' },
    { name: 'pine_tree_06', trunk: 'Cylinder.001_0.002', canopy: 'Cylinder.001_1.002' },
    { name: 'pine_tree_07', trunk: 'Cylinder.002_0', canopy: 'Cylinder.002_1' },
    { name: 'pine_tree_08', trunk: 'Cylinder.003_0', canopy: 'Cylinder.003_1' },
    { name: 'pine_tree_09', trunk: 'Cylinder.004_0', canopy: 'Cylinder.004_1' },
    { name: 'pine_tree_10', trunk: 'Cylinder.005_0', canopy: 'Cylinder.005_1' },
    { name: 'pine_tree_11', trunk: 'Cylinder.005_0.001', canopy: 'Cylinder.005_1.001' },
    { name: 'pine_tree_12', trunk: 'Cylinder.007_0', canopy: 'Cylinder.007_1' },
    { name: 'pine_tree_13', trunk: 'Cylinder.009_0', canopy: 'Cylinder.009_1' },
  ];

  // Helper to copy and bake mesh with matrix
  function addTransformedMesh(targetDoc, targetScene, targetBuffer, matMap, srcNode, transformMatrix) {
    const srcMesh = srcNode.getMesh();
    if (!srcMesh) return null;

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(transformMatrix);
    const newNode = targetDoc.createNode(srcNode.getName());
    const newMesh = targetDoc.createMesh(srcMesh.getName());

    for (const srcPrim of srcMesh.listPrimitives()) {
      const srcMat = srcPrim.getMaterial();
      let newMat = null;
      if (srcMat) {
        if (matMap.has(srcMat)) {
          newMat = matMap.get(srcMat);
        } else {
          newMat = targetDoc.createMaterial(srcMat.getName())
            .setRoughnessFactor(srcMat.getRoughnessFactor())
            .setMetallicFactor(srcMat.getMetallicFactor())
            .setAlphaCutoff(srcMat.getAlphaCutoff())
            .setAlphaMode(srcMat.getAlphaMode())
            .setDoubleSided(srcMat.getDoubleSided());

          const baseColorTex = srcMat.getBaseColorTexture();
          if (baseColorTex) {
            const newTex = targetDoc.createTexture(baseColorTex.getName())
              .setImage(baseColorTex.getImage())
              .setMimeType(baseColorTex.getMimeType());
            newMat.setBaseColorTexture(newTex);
          }
          matMap.set(srcMat, newMat);
        }
      }

      const newPrim = targetDoc.createPrimitive()
        .setMode(srcPrim.getMode())
        .setMaterial(newMat);

      // Transform POSITION
      const posAcc = srcPrim.getAttribute('POSITION');
      if (posAcc) {
        const rawPos = posAcc.getArray();
        const bakedPos = new Float32Array(rawPos.length);
        const v = new THREE.Vector3();
        for (let i = 0; i < rawPos.length; i += 3) {
          v.set(rawPos[i], rawPos[i + 1], rawPos[i + 2]).applyMatrix4(transformMatrix);
          bakedPos[i] = v.x;
          bakedPos[i + 1] = v.y;
          bakedPos[i + 2] = v.z;
        }
        const newPosAcc = targetDoc.createAccessor('POSITION')
          .setType('VEC3')
          .setArray(bakedPos)
          .setBuffer(targetBuffer);
        newPrim.setAttribute('POSITION', newPosAcc);
      }

      // Transform NORMAL
      const normAcc = srcPrim.getAttribute('NORMAL');
      if (normAcc) {
        const rawNorm = normAcc.getArray();
        const bakedNorm = new Float32Array(rawNorm.length);
        const n = new THREE.Vector3();
        for (let i = 0; i < rawNorm.length; i += 3) {
          n.set(rawNorm[i], rawNorm[i + 1], rawNorm[i + 2]).applyMatrix3(normalMatrix).normalize();
          bakedNorm[i] = n.x;
          bakedNorm[i + 1] = n.y;
          bakedNorm[i + 2] = n.z;
        }
        const newNormAcc = targetDoc.createAccessor('NORMAL')
          .setType('VEC3')
          .setArray(bakedNorm)
          .setBuffer(targetBuffer);
        newPrim.setAttribute('NORMAL', newNormAcc);
      }

      // Copy other attributes (TEXCOORD_0, etc.)
      for (const sem of srcPrim.listSemantics()) {
        if (sem === 'POSITION' || sem === 'NORMAL') continue;
        const attrAcc = srcPrim.getAttribute(sem);
        if (attrAcc) {
          const newAcc = targetDoc.createAccessor(attrAcc.getName())
            .setType(attrAcc.getType())
            .setArray(attrAcc.getArray())
            .setNormalized(attrAcc.getNormalized())
            .setBuffer(targetBuffer);
          newPrim.setAttribute(sem, newAcc);
        }
      }

      const indicesAcc = srcPrim.getIndices();
      if (indicesAcc) {
        const newIndices = targetDoc.createAccessor(indicesAcc.getName())
          .setType(indicesAcc.getType())
          .setArray(indicesAcc.getArray())
          .setBuffer(targetBuffer);
        newPrim.setIndices(newIndices);
      }

      newMesh.addPrimitive(newPrim);
    }

    newNode.setMesh(newMesh);
    targetScene.addChild(newNode);
    return newNode;
  }

  // 1. Export each individual tree, origin-centered at (0, 0, 0) with base at Y=0
  for (const pair of treePairs) {
    const trunkNode = root.listNodes().find(n => n.getName() === pair.trunk);
    const canopyNode = root.listNodes().find(n => n.getName() === pair.canopy);
    if (!trunkNode || !canopyNode) continue;

    const trunkWorldMat = getNodeWorldMatrix(trunkNode);
    const canopyWorldMat = getNodeWorldMatrix(canopyNode);

    // Compute base center of the trunk
    const trunkPrim = trunkNode.getMesh().listPrimitives()[0];
    const trunkPos = trunkPrim.getAttribute('POSITION').getArray();
    const trunkBoundsMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const trunkBoundsMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const tempV = new THREE.Vector3();
    for (let i = 0; i < trunkPos.length; i += 3) {
      tempV.set(trunkPos[i], trunkPos[i + 1], trunkPos[i + 2]).applyMatrix4(trunkWorldMat);
      trunkBoundsMin.min(tempV);
      trunkBoundsMax.max(tempV);
    }

    const baseCenter = new THREE.Vector3(
      (trunkBoundsMin.x + trunkBoundsMax.x) / 2,
      trunkBoundsMin.y,
      (trunkBoundsMin.z + trunkBoundsMax.z) / 2
    );

    // Center offset matrix
    const offsetMatrix = new THREE.Matrix4().makeTranslation(-baseCenter.x, -baseCenter.y, -baseCenter.z);
    const finalTrunkMat = new THREE.Matrix4().multiplyMatrices(offsetMatrix, trunkWorldMat);
    const finalCanopyMat = new THREE.Matrix4().multiplyMatrices(offsetMatrix, canopyWorldMat);

    const treeDoc = new Document();
    const treeBuffer = treeDoc.createBuffer('defaultBuffer');
    const treeScene = treeDoc.createScene(pair.name);
    treeDoc.getRoot().setDefaultScene(treeScene);
    const matMap = new Map();

    addTransformedMesh(treeDoc, treeScene, treeBuffer, matMap, trunkNode, finalTrunkMat);
    addTransformedMesh(treeDoc, treeScene, treeBuffer, matMap, canopyNode, finalCanopyMat);

    const glbBuffer = await io.writeBinary(treeDoc);
    const outPath = path.join(outDir, `${pair.name}.glb`);
    fs.writeFileSync(outPath, Buffer.from(glbBuffer));
    console.log(`Saved ${pair.name}.glb (${glbBuffer.byteLength} bytes)`);
  }

  // 2. Export full forest cluster with all 13 verified pairs (no orphan trunks!)
  const clusterDoc = new Document();
  const clusterBuffer = clusterDoc.createBuffer('defaultBuffer');
  const clusterScene = clusterDoc.createScene('TreeCluster');
  clusterDoc.getRoot().setDefaultScene(clusterScene);
  const clusterMatMap = new Map();

  for (const pair of treePairs) {
    const trunkNode = root.listNodes().find(n => n.getName() === pair.trunk);
    const canopyNode = root.listNodes().find(n => n.getName() === pair.canopy);
    if (!trunkNode || !canopyNode) continue;

    const trunkWorldMat = getNodeWorldMatrix(trunkNode);
    const canopyWorldMat = getNodeWorldMatrix(canopyNode);

    addTransformedMesh(clusterDoc, clusterScene, clusterBuffer, clusterMatMap, trunkNode, trunkWorldMat);
    addTransformedMesh(clusterDoc, clusterScene, clusterBuffer, clusterMatMap, canopyNode, canopyWorldMat);
  }

  const clusterGlb = await io.writeBinary(clusterDoc);
  const clusterOutPath = path.join(outDir, 'pine_forest_cluster.glb');
  fs.writeFileSync(clusterOutPath, Buffer.from(clusterGlb));
  console.log(`Saved pine_forest_cluster.glb (${clusterGlb.byteLength} bytes)`);
}

bakePerfectTrees().catch(console.error);
