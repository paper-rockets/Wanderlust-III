const fs = require('fs');
const path = require('path');
const { NodeIO, Document } = require('@gltf-transform/core');

async function reexportAllTrees() {
  const io = new NodeIO();
  const srcGlbPath = path.join(__dirname, '../external/stylized-components/public/assets/grass-scene.glb');
  const doc = await io.read(srcGlbPath);
  const root = doc.getRoot();

  const outDirs = [
    path.join(__dirname, '../public/assets/models/trees'),
    path.join(__dirname, '../assets/models/trees')
  ];

  for (const dir of outDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  }

  // 4 Core Master Tree Variants from the original GLB
  const variants = [
    { name: 'pine_tree_01', trunk: 'Cylinder.002_0', foliage: 'Cylinder.002_1', scale: 0.1, offsetX: 0, offsetY: 0 },
    { name: 'pine_tree_02', trunk: 'Cylinder.005_0', foliage: 'Cylinder.005_1', scale: 0.1, offsetX: 0, offsetY: 0 },
    { name: 'pine_tree_03', trunk: 'Cylinder.001_0', foliage: 'Cylinder.001_1', scale: 0.1, offsetX: 0, offsetY: 0 },
    { name: 'pine_tree_04', trunk: 'Cylinder.000_0', foliage: 'Cylinder.000_1', scale: 0.1, offsetX: 2.43, offsetY: -1.75 },
    { name: 'pine_tree_05', trunk: 'Cylinder.001_0', foliage: 'Cylinder.001_1', scale: 0.15, offsetX: 0, offsetY: 0 },
    { name: 'pine_tree_06', trunk: 'Cylinder.005_0', foliage: 'Cylinder.005_1', scale: 0.18, offsetX: 0, offsetY: 0 },
    { name: 'pine_tree_07', trunk: 'Cylinder.002_0', foliage: 'Cylinder.002_1', scale: 0.05, offsetX: 0, offsetY: 0 },
    { name: 'pine_tree_08', trunk: 'Cylinder.000_0', foliage: 'Cylinder.000_1', scale: 0.035, offsetX: 2.43, offsetY: -1.75 }
  ];

  for (const v of variants) {
    const trunkMesh = root.listMeshes().find(m => m.getName() === v.trunk);
    const foliageMesh = root.listMeshes().find(m => m.getName() === v.foliage);

    if (!trunkMesh || !foliageMesh) {
      console.error(`Could not find meshes for variant ${v.name}`);
      continue;
    }

    const treeDoc = new Document();
    const treeRoot = treeDoc.getRoot();
    const treeBuffer = treeDoc.createBuffer('defaultBuffer');
    const treeScene = treeDoc.createScene(v.name);
    treeRoot.setDefaultScene(treeScene);

    const matMap = new Map();
    function copyMat(srcMat) {
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

    function exportSubmesh(srcMesh, nodeName, isFoliage) {
      const node = treeDoc.createNode(nodeName);
      treeScene.addChild(node);
      const newMesh = treeDoc.createMesh(nodeName);
      node.setMesh(newMesh);

      for (const srcPrim of srcMesh.listPrimitives()) {
        const newPrim = treeDoc.createPrimitive()
          .setMode(srcPrim.getMode())
          .setMaterial(copyMat(srcPrim.getMaterial()));

        // Transform POSITION: (x, y, z) -> ((x - offX)*scale, z*scale, -(y - offY)*scale)
        const posAcc = srcPrim.getAttribute('POSITION');
        const posArr = posAcc.getArray();
        const newPosArr = new Float32Array(posArr.length);
        const offX = isFoliage ? v.offsetX : 0;
        const offY = isFoliage ? v.offsetY : 0;

        for (let i = 0; i < posArr.length; i += 3) {
          const rawX = posArr[i];
          const rawY = posArr[i + 1];
          const rawZ = posArr[i + 2];

          newPosArr[i] = (rawX - offX) * v.scale;
          newPosArr[i + 1] = rawZ * v.scale;
          newPosArr[i + 2] = -(rawY - offY) * v.scale;
        }

        const newPosAcc = treeDoc.createAccessor(nodeName + '_POS')
          .setType('VEC3')
          .setArray(newPosArr)
          .setBuffer(treeBuffer);
        newPrim.setAttribute('POSITION', newPosAcc);

        // Transform NORMAL: (nx, ny, nz) -> (nx, nz, -ny)
        const normAcc = srcPrim.getAttribute('NORMAL');
        if (normAcc) {
          const normArr = normAcc.getArray();
          const newNormArr = new Float32Array(normArr.length);
          for (let i = 0; i < normArr.length; i += 3) {
            newNormArr[i] = normArr[i];
            newNormArr[i + 1] = normArr[i + 2];
            newNormArr[i + 2] = -normArr[i + 1];
          }
          const newNormAcc = treeDoc.createAccessor(nodeName + '_NORM')
            .setType('VEC3')
            .setArray(newNormArr)
            .setBuffer(treeBuffer);
          newPrim.setAttribute('NORMAL', newNormAcc);
        }

        // Copy TEXCOORD_0
        const uvAcc = srcPrim.getAttribute('TEXCOORD_0');
        if (uvAcc) {
          const newUvAcc = treeDoc.createAccessor(nodeName + '_UV')
            .setType('VEC2')
            .setArray(uvAcc.getArray().slice())
            .setBuffer(treeBuffer);
          newPrim.setAttribute('TEXCOORD_0', newUvAcc);
        }

        // Copy INDICES
        const indAcc = srcPrim.getIndices();
        if (indAcc) {
          const newIndAcc = treeDoc.createAccessor(nodeName + '_IND')
            .setType('SCALAR')
            .setArray(indAcc.getArray().slice())
            .setBuffer(treeBuffer);
          newPrim.setIndices(newIndAcc);
        }

        newMesh.addPrimitive(newPrim);
      }
    }

    exportSubmesh(trunkMesh, 'Trunk', false);
    exportSubmesh(foliageMesh, 'Foliage', true);

    const glbBuffer = await io.writeBinary(treeDoc);
    for (const dir of outDirs) {
      fs.writeFileSync(path.join(dir, `${v.name}.glb`), Buffer.from(glbBuffer));
    }
    console.log(`Exported ${v.name}.glb (${glbBuffer.byteLength} bytes)`);
  }

  // Export full cluster
  const clusterDoc = new Document();
  const clusterRoot = clusterDoc.getRoot();
  const clusterBuffer = clusterDoc.createBuffer('defaultBuffer');
  const clusterScene = clusterDoc.createScene('TreeCluster');
  clusterRoot.setDefaultScene(clusterScene);

  const clusterMatMap = new Map();
  function copyClusterMat(srcMat) {
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

  // Layout cluster trees in a nice natural grove
  const clusterLayout = [
    { variant: variants[0], x: 0, z: 0, rot: 0, s: 1.0 },
    { variant: variants[1], x: 3.5, z: 2.0, rot: 1.2, s: 1.1 },
    { variant: variants[2], x: -3.0, z: 1.5, rot: 2.5, s: 0.95 },
    { variant: variants[0], x: 2.0, z: -3.5, rot: 0.8, s: 0.85 },
    { variant: variants[1], x: -2.5, z: -2.5, rot: 3.1, s: 1.05 },
    { variant: variants[2], x: 5.0, z: -1.0, rot: 1.9, s: 0.75 },
    { variant: variants[3], x: -5.0, z: -0.5, rot: 0.4, s: 0.65 },
    { variant: variants[0], x: 0.5, z: 4.5, rot: 4.2, s: 0.8 }
  ];

  for (let idx = 0; idx < clusterLayout.length; idx++) {
    const item = clusterLayout[idx];
    const v = item.variant;
    const trunkMesh = root.listMeshes().find(m => m.getName() === v.trunk);
    const foliageMesh = root.listMeshes().find(m => m.getName() === v.foliage);

    const cosR = Math.cos(item.rot);
    const sinR = Math.sin(item.rot);

    function exportClusterSubmesh(srcMesh, nodeName, isFoliage) {
      const node = clusterDoc.createNode(nodeName);
      clusterScene.addChild(node);
      const newMesh = clusterDoc.createMesh(nodeName);
      node.setMesh(newMesh);

      for (const srcPrim of srcMesh.listPrimitives()) {
        const newPrim = clusterDoc.createPrimitive()
          .setMode(srcPrim.getMode())
          .setMaterial(copyClusterMat(srcPrim.getMaterial()));

        const posAcc = srcPrim.getAttribute('POSITION');
        const posArr = posAcc.getArray();
        const newPosArr = new Float32Array(posArr.length);
        const offX = isFoliage ? v.offsetX : 0;
        const offY = isFoliage ? v.offsetY : 0;

        for (let i = 0; i < posArr.length; i += 3) {
          const rawX = (posArr[i] - offX) * v.scale * item.s;
          const rawY = posArr[i + 2] * v.scale * item.s;
          const rawZ = -(posArr[i + 1] - offY) * v.scale * item.s;

          // Rotate by rot around Y and translate
          newPosArr[i] = rawX * cosR - rawZ * sinR + item.x;
          newPosArr[i + 1] = rawY;
          newPosArr[i + 2] = rawX * sinR + rawZ * cosR + item.z;
        }

        const newPosAcc = clusterDoc.createAccessor(`${nodeName}_POS`)
          .setType('VEC3')
          .setArray(newPosArr)
          .setBuffer(clusterBuffer);
        newPrim.setAttribute('POSITION', newPosAcc);

        const normAcc = srcPrim.getAttribute('NORMAL');
        if (normAcc) {
          const normArr = normAcc.getArray();
          const newNormArr = new Float32Array(normArr.length);
          for (let i = 0; i < normArr.length; i += 3) {
            const nx = normArr[i];
            const ny = normArr[i + 2];
            const nz = -normArr[i + 1];
            newNormArr[i] = nx * cosR - nz * sinR;
            newNormArr[i + 1] = ny;
            newNormArr[i + 2] = nx * sinR + nz * cosR;
          }
          const newNormAcc = clusterDoc.createAccessor(`${nodeName}_NORM`)
            .setType('VEC3')
            .setArray(newNormArr)
            .setBuffer(clusterBuffer);
          newPrim.setAttribute('NORMAL', newNormAcc);
        }

        const uvAcc = srcPrim.getAttribute('TEXCOORD_0');
        if (uvAcc) {
          const newUvAcc = clusterDoc.createAccessor(`${nodeName}_UV`)
            .setType('VEC2')
            .setArray(uvAcc.getArray().slice())
            .setBuffer(clusterBuffer);
          newPrim.setAttribute('TEXCOORD_0', newUvAcc);
        }

        const indAcc = srcPrim.getIndices();
        if (indAcc) {
          const newIndAcc = clusterDoc.createAccessor(`${nodeName}_IND`)
            .setType('SCALAR')
            .setArray(indAcc.getArray().slice())
            .setBuffer(clusterBuffer);
          newPrim.setIndices(newIndAcc);
        }

        newMesh.addPrimitive(newPrim);
      }
    }

    exportClusterSubmesh(trunkMesh, `Trunk_${idx}`, false);
    exportClusterSubmesh(foliageMesh, `Foliage_${idx}`, true);
  }

  const clusterBufferOut = await io.writeBinary(clusterDoc);
  for (const dir of outDirs) {
    fs.writeFileSync(path.join(dir, 'pine_forest_cluster.glb'), Buffer.from(clusterBufferOut));
  }
  console.log(`Exported pine_forest_cluster.glb (${clusterBufferOut.byteLength} bytes)`);
}

reexportAllTrees().catch(console.error);
