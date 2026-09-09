const fs = require('fs');
const path = require('path');
const { NodeIO, Document } = require('@gltf-transform/core');

function quatToMat4(q, t, s) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;

  const sx = s ? s[0] : 1;
  const sy = s ? s[1] : 1;
  const sz = s ? s[2] : 1;

  const tx = t ? t[0] : 0;
  const ty = t ? t[1] : 0;
  const tz = t ? t[2] : 0;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1
  ];
}

function multiplyMat4(a, b) {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r * 4 + c] = 
        a[r * 4 + 0] * b[0 * 4 + c] +
        a[r * 4 + 1] * b[1 * 4 + c] +
        a[r * 4 + 2] * b[2 * 4 + c] +
        a[r * 4 + 3] * b[3 * 4 + c];
    }
  }
  return out;
}

function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

function transformVector(m, v) {
  const x = v[0], y = v[1], z = v[2];
  let rx = m[0] * x + m[4] * y + m[8] * z;
  let ry = m[1] * x + m[5] * y + m[9] * z;
  let rz = m[2] * x + m[6] * y + m[10] * z;
  const len = Math.hypot(rx, ry, rz) || 1;
  return [rx / len, ry / len, rz / len];
}

async function extractIndividualTrees() {
  const io = new NodeIO();
  const doc = await io.read('external/stylized-components/public/assets/grass-scene.glb');
  const root = doc.getRoot();

  const sketchfabModel = root.listNodes().find(n => n.getName() === 'Sketchfab_model.001');
  const mOrient = quatToMat4(sketchfabModel.getRotation(), sketchfabModel.getTranslation(), sketchfabModel.getScale());

  const groups = [
    'Cylinder.000', 'Cylinder.001', 'Cylinder.002', 'Cylinder.003',
    'Cylinder.004', 'Cylinder.005', 'Cylinder.007', 'Cylinder.009'
  ];

  const treePairs = [];

  for (const groupName of groups) {
    const gNode = root.listNodes().find(n => n.getName() === groupName);
    const mGroupLocal = quatToMat4(gNode.getRotation(), gNode.getTranslation(), gNode.getScale());
    const mGroupWorld = multiplyMat4(mOrient, mGroupLocal);

    const children = gNode.listChildren();
    const subGroups = new Map();
    for (const c of children) {
      const name = c.getName();
      const match = name.match(/Cylinder\.\d+_(\d)(?:\.(\d+))?/);
      if (!match) continue;
      const type = match[1];
      const suffix = match[2] || 'base';
      if (!subGroups.has(suffix)) subGroups.set(suffix, {});
      subGroups.get(suffix)[type] = c;
    }

    for (const [suffix, pair] of subGroups.entries()) {
      if (pair['0'] && pair['1']) {
        treePairs.push({
          groupName,
          suffix,
          trunkNode: pair['0'],
          foliageNode: pair['1'],
          mGroupWorld
        });
      }
    }
  }

  console.log('Found total standalone tree instances:', treePairs.length);

  const outDir = 'public/assets/models/trees';
  fs.mkdirSync(outDir, { recursive: true });

  for (let idx = 0; idx < treePairs.length; idx++) {
    const { groupName, suffix, trunkNode, foliageNode, mGroupWorld } = treePairs[idx];

    const mTrunkLocal = quatToMat4(trunkNode.getRotation(), trunkNode.getTranslation(), trunkNode.getScale());
    const mTrunkWorld = multiplyMat4(mGroupWorld, mTrunkLocal);

    const mFoliageLocal = quatToMat4(foliageNode.getRotation(), foliageNode.getTranslation(), foliageNode.getScale());
    const mFoliageWorld = multiplyMat4(mGroupWorld, mFoliageLocal);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const trunkMesh = trunkNode.getMesh();
    const trunkPrim = trunkMesh.listPrimitives()[0];
    const trunkPos = trunkPrim.getAttribute('POSITION').getArray();
    for (let k = 0; k < trunkPos.length; k += 3) {
      const pt = transformPoint(mTrunkWorld, [trunkPos[k], trunkPos[k+1], trunkPos[k+2]]);
      minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
      minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]);
      minZ = Math.min(minZ, pt[2]); maxZ = Math.max(maxZ, pt[2]);
    }

    const foliageMesh = foliageNode.getMesh();
    const foliagePrim = foliageMesh.listPrimitives()[0];
    const foliagePos = foliagePrim.getAttribute('POSITION').getArray();
    for (let k = 0; k < foliagePos.length; k += 3) {
      const pt = transformPoint(mFoliageWorld, [foliagePos[k], foliagePos[k+1], foliagePos[k+2]]);
      minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
      minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]);
      minZ = Math.min(minZ, pt[2]); maxZ = Math.max(maxZ, pt[2]);
    }

    const centerX = (minX + maxX) / 2;
    const baseGroundY = minY;
    const centerZ = (minZ + maxZ) / 2;
    const treeHeight = maxY - minY;

    console.log('Tree #' + (idx + 1) + ' (' + groupName + '_' + suffix + ') | Height: ' + treeHeight.toFixed(2) + 'm');

    const treeDoc = new Document();
    const treeRoot = treeDoc.getRoot();
    const treeBuffer = treeDoc.createBuffer('defaultBuffer');
    const treeScene = treeDoc.createScene('TreeScene');
    treeRoot.setDefaultScene(treeScene);

    const matMap = new Map();
    function copyMaterial(srcMat) {
      if (!srcMat) return null;
      if (matMap.has(srcMat)) return matMap.get(srcMat);
      const newMat = treeDoc.createMaterial(srcMat.getName())
        .setRoughnessFactor(srcMat.getRoughnessFactor())
        .setMetallicFactor(srcMat.getMetallicFactor())
        .setAlphaCutoff(srcMat.getAlphaCutoff())
        .setAlphaMode(srcMat.getAlphaMode())
        .setDoubleSided(srcMat.getDoubleSided());
      const baseColorTex = srcMat.getBaseColorTexture();
      if (baseColorTex) {
        const newTex = treeDoc.createTexture(baseColorTex.getName())
          .setImage(baseColorTex.getImage())
          .setMimeType(baseColorTex.getMimeType());
        newMat.setBaseColorTexture(newTex);
      }
      matMap.set(srcMat, newMat);
      return newMat;
    }

    function bakeMesh(srcMesh, matrix, meshName) {
      const newNode = treeDoc.createNode(meshName);
      treeScene.addChild(newNode);

      const newMesh = treeDoc.createMesh(meshName);
      newNode.setMesh(newMesh);

      for (const srcPrim of srcMesh.listPrimitives()) {
        const newPrim = treeDoc.createPrimitive()
          .setMode(srcPrim.getMode())
          .setMaterial(copyMaterial(srcPrim.getMaterial()));

        const posAcc = srcPrim.getAttribute('POSITION');
        const posArr = posAcc.getArray();
        const newPosArr = new Float32Array(posArr.length);
        for (let k = 0; k < posArr.length; k += 3) {
          const pt = transformPoint(matrix, [posArr[k], posArr[k+1], posArr[k+2]]);
          newPosArr[k] = pt[0] - centerX;
          newPosArr[k+1] = pt[1] - baseGroundY;
          newPosArr[k+2] = pt[2] - centerZ;
        }
        const newPosAcc = treeDoc.createAccessor(meshName + '_POSITION')
          .setType('VEC3')
          .setArray(newPosArr)
          .setBuffer(treeBuffer);
        newPrim.setAttribute('POSITION', newPosAcc);

        const normAcc = srcPrim.getAttribute('NORMAL');
        if (normAcc) {
          const normArr = normAcc.getArray();
          const newNormArr = new Float32Array(normArr.length);
          for (let k = 0; k < normArr.length; k += 3) {
            const nv = transformVector(matrix, [normArr[k], normArr[k+1], normArr[k+2]]);
            newNormArr[k] = nv[0];
            newNormArr[k+1] = nv[1];
            newNormArr[k+2] = nv[2];
          }
          const newNormAcc = treeDoc.createAccessor(meshName + '_NORMAL')
            .setType('VEC3')
            .setArray(newNormArr)
            .setBuffer(treeBuffer);
          newPrim.setAttribute('NORMAL', newNormAcc);
        }

        const uvAcc = srcPrim.getAttribute('TEXCOORD_0');
        if (uvAcc) {
          const newUvAcc = treeDoc.createAccessor(meshName + '_TEXCOORD_0')
            .setType('VEC2')
            .setArray(uvAcc.getArray().slice())
            .setBuffer(treeBuffer);
          newPrim.setAttribute('TEXCOORD_0', newUvAcc);
        }

        const indAcc = srcPrim.getIndices();
        if (indAcc) {
          const newIndAcc = treeDoc.createAccessor(meshName + '_INDICES')
            .setType('SCALAR')
            .setArray(indAcc.getArray().slice())
            .setBuffer(treeBuffer);
          newPrim.setIndices(newIndAcc);
        }

        newMesh.addPrimitive(newPrim);
      }
    }

    bakeMesh(trunkMesh, mTrunkWorld, 'Trunk');
    bakeMesh(foliageMesh, mFoliageWorld, 'Foliage');

    const numStr = (idx + 1).toString().padStart(2, '0');
    const filename = 'pine_tree_' + numStr + '.glb';
    const outPath = path.join(outDir, filename);
    const glbBuffer = await io.writeBinary(treeDoc);
    fs.writeFileSync(outPath, Buffer.from(glbBuffer));
    console.log('Saved ' + filename + ' (' + glbBuffer.byteLength + ' bytes)');
  }

  // 2. Save full cluster of all trees in world positions centered at ground origin
  const clusterDoc = new Document();
  const clusterRoot = clusterDoc.getRoot();
  const clusterBuffer = clusterDoc.createBuffer('defaultBuffer');
  const clusterScene = clusterDoc.createScene('TreeCluster');
  clusterRoot.setDefaultScene(clusterScene);

  const clusterMatMap = new Map();
  function copyClusterMaterial(srcMat) {
    if (!srcMat) return null;
    if (clusterMatMap.has(srcMat)) return clusterMatMap.get(srcMat);
    const newMat = clusterDoc.createMaterial(srcMat.getName())
      .setRoughnessFactor(srcMat.getRoughnessFactor())
      .setMetallicFactor(srcMat.getMetallicFactor())
      .setAlphaCutoff(srcMat.getAlphaCutoff())
      .setAlphaMode(srcMat.getAlphaMode())
      .setDoubleSided(srcMat.getDoubleSided());
    const baseColorTex = srcMat.getBaseColorTexture();
    if (baseColorTex) {
      const newTex = clusterDoc.createTexture(baseColorTex.getName())
        .setImage(baseColorTex.getImage())
        .setMimeType(baseColorTex.getMimeType());
      newMat.setBaseColorTexture(newTex);
    }
    clusterMatMap.set(srcMat, newMat);
    return newMat;
  }

  let clusterMinX = Infinity, clusterMaxX = -Infinity;
  let clusterMinY = Infinity, clusterMaxY = -Infinity;
  let clusterMinZ = Infinity, clusterMaxZ = -Infinity;

  for (const pair of treePairs) {
    const { trunkNode, foliageNode, mGroupWorld } = pair;
    const mTrunkWorld = multiplyMat4(mGroupWorld, quatToMat4(trunkNode.getRotation(), trunkNode.getTranslation(), trunkNode.getScale()));
    const mFoliageWorld = multiplyMat4(mGroupWorld, quatToMat4(foliageNode.getRotation(), foliageNode.getTranslation(), foliageNode.getScale()));

    const trunkPos = pair.trunkNode.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray();
    for (let k = 0; k < trunkPos.length; k += 3) {
      const pt = transformPoint(mTrunkWorld, [trunkPos[k], trunkPos[k+1], trunkPos[k+2]]);
      clusterMinX = Math.min(clusterMinX, pt[0]); clusterMaxX = Math.max(clusterMaxX, pt[0]);
      clusterMinY = Math.min(clusterMinY, pt[1]); clusterMaxY = Math.max(clusterMaxY, pt[1]);
      clusterMinZ = Math.min(clusterMinZ, pt[2]); clusterMaxZ = Math.max(clusterMaxZ, pt[2]);
    }
  }

  const clCenterX = (clusterMinX + clusterMaxX) / 2;
  const clCenterY = clusterMinY;
  const clCenterZ = (clusterMinZ + clusterMaxZ) / 2;

  function bakeClusterMesh(srcMesh, matrix, meshName) {
    const newNode = clusterDoc.createNode(meshName);
    clusterScene.addChild(newNode);

    const newMesh = clusterDoc.createMesh(meshName);
    newNode.setMesh(newMesh);

    for (const srcPrim of srcMesh.listPrimitives()) {
      const newPrim = clusterDoc.createPrimitive()
        .setMode(srcPrim.getMode())
        .setMaterial(copyClusterMaterial(srcPrim.getMaterial()));

      const posAcc = srcPrim.getAttribute('POSITION');
      const posArr = posAcc.getArray();
      const newPosArr = new Float32Array(posArr.length);
      for (let k = 0; k < posArr.length; k += 3) {
        const pt = transformPoint(matrix, [posArr[k], posArr[k+1], posArr[k+2]]);
        newPosArr[k] = pt[0] - clCenterX;
        newPosArr[k+1] = pt[1] - clCenterY;
        newPosArr[k+2] = pt[2] - clCenterZ;
      }
      const newPosAcc = clusterDoc.createAccessor(meshName + '_POSITION')
        .setType('VEC3')
        .setArray(newPosArr)
        .setBuffer(clusterBuffer);
      newPrim.setAttribute('POSITION', newPosAcc);

      const normAcc = srcPrim.getAttribute('NORMAL');
      if (normAcc) {
        const normArr = normAcc.getArray();
        const newNormArr = new Float32Array(normArr.length);
        for (let k = 0; k < normArr.length; k += 3) {
          const nv = transformVector(matrix, [normArr[k], normArr[k+1], normArr[k+2]]);
          newNormArr[k] = nv[0];
          newNormArr[k+1] = nv[1];
          newNormArr[k+2] = nv[2];
        }
        const newNormAcc = clusterDoc.createAccessor(meshName + '_NORMAL')
          .setType('VEC3')
          .setArray(newNormArr)
          .setBuffer(clusterBuffer);
        newPrim.setAttribute('NORMAL', newNormAcc);
      }

      const uvAcc = srcPrim.getAttribute('TEXCOORD_0');
      if (uvAcc) {
        const newUvAcc = clusterDoc.createAccessor(meshName + '_TEXCOORD_0')
          .setType('VEC2')
          .setArray(uvAcc.getArray().slice())
          .setBuffer(clusterBuffer);
        newPrim.setAttribute('TEXCOORD_0', newUvAcc);
      }

      const indAcc = srcPrim.getIndices();
      if (indAcc) {
        const newIndAcc = clusterDoc.createAccessor(meshName + '_INDICES')
          .setType('SCALAR')
          .setArray(indAcc.getArray().slice())
          .setBuffer(clusterBuffer);
        newPrim.setIndices(newIndAcc);
      }

      newMesh.addPrimitive(newPrim);
    }
  }

  for (let idx = 0; idx < treePairs.length; idx++) {
    const pair = treePairs[idx];
    const mTrunkWorld = multiplyMat4(pair.mGroupWorld, quatToMat4(pair.trunkNode.getRotation(), pair.trunkNode.getTranslation(), pair.trunkNode.getScale()));
    const mFoliageWorld = multiplyMat4(pair.mGroupWorld, quatToMat4(pair.foliageNode.getRotation(), pair.foliageNode.getTranslation(), pair.foliageNode.getScale()));
    bakeClusterMesh(pair.trunkNode.getMesh(), mTrunkWorld, 'Trunk_' + idx);
    bakeClusterMesh(pair.foliageNode.getMesh(), mFoliageWorld, 'Foliage_' + idx);
  }

  const clusterOutPath = path.join(outDir, 'pine_forest_cluster.glb');
  const clusterBufferOut = await io.writeBinary(clusterDoc);
  fs.writeFileSync(clusterOutPath, Buffer.from(clusterBufferOut));
  console.log('Saved pine_forest_cluster.glb (' + clusterBufferOut.byteLength + ' bytes)');
}

extractIndividualTrees().catch(console.error);
