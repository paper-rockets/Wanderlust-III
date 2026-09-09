const fs = require('fs');
const path = require('path');
const { NodeIO, Document } = require('@gltf-transform/core');

async function extractTrees() {
  const io = new NodeIO();
  const doc = await io.read('external/stylized-components/public/assets/grass-scene.glb');
  const root = doc.getRoot();

  const outDir = path.join(__dirname, '../public/assets/models/trees');
  fs.mkdirSync(outDir, { recursive: true });

  // Copy bark textures
  const texSrcDir = path.join(__dirname, '../external/stylized-components/public/assets/textures/bark');
  const texDstDir = path.join(__dirname, '../public/assets/textures/bark');
  fs.mkdirSync(texDstDir, { recursive: true });
  fs.readdirSync(texSrcDir).forEach(file => {
    fs.copyFileSync(path.join(texSrcDir, file), path.join(texDstDir, file));
  });
  console.log('Bark textures copied to public/assets/textures/bark');

  // Also copy flower textures for when we need them later
  const flowerSrcA = path.join(__dirname, '../external/stylized-components/public/assets/textures/flower');
  const flowerDstA = path.join(__dirname, '../public/assets/textures/flower');
  fs.mkdirSync(flowerDstA, { recursive: true });
  fs.readdirSync(flowerSrcA).forEach(file => {
    fs.copyFileSync(path.join(flowerSrcA, file), path.join(flowerDstA, file));
  });
  const flowerSrcB = path.join(__dirname, '../external/stylized-components/public/assets/textures/flower3');
  const flowerDstB = path.join(__dirname, '../public/assets/textures/flower3');
  fs.mkdirSync(flowerDstB, { recursive: true });
  fs.readdirSync(flowerSrcB).forEach(file => {
    fs.copyFileSync(path.join(flowerSrcB, file), path.join(flowerDstB, file));
  });
  console.log('Flower textures copied to public/assets/textures/');

  const treeNodeNames = [
    'Cylinder.000', 'Cylinder.001', 'Cylinder.002', 'Cylinder.003',
    'Cylinder.004', 'Cylinder.005', 'Cylinder.007', 'Cylinder.009'
  ];

  for (let i = 0; i < treeNodeNames.length; i++) {
    const nodeName = treeNodeNames[i];
    const sourceNode = root.listNodes().find(n => n.getName() === nodeName);
    if (!sourceNode) {
      console.warn('Could not find node:', nodeName);
      continue;
    }

    const treeDoc = new Document();
    const treeRoot = treeDoc.getRoot();
    const treeScene = treeDoc.createScene(nodeName);
    treeRoot.setDefaultScene(treeScene);

    const matMap = new Map();
    function getOrCopyMaterial(srcMat) {
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

    function cloneHierarchy(src, parentTreeNode, isRoot = false) {
      const newNode = treeDoc.createNode(src.getName());
      if (isRoot) {
        // Center the tree at (0,0,0)
        newNode.setScale(src.getScale());
        newNode.setRotation(src.getRotation());
        newNode.setTranslation([0, 0, 0]);
      } else {
        newNode.setTranslation(src.getTranslation());
        newNode.setRotation(src.getRotation());
        newNode.setScale(src.getScale());
      }

      const srcMesh = src.getMesh();
      if (srcMesh) {
        const newMesh = treeDoc.createMesh(srcMesh.getName());
        for (const srcPrim of srcMesh.listPrimitives()) {
          const newPrim = treeDoc.createPrimitive()
            .setMode(srcPrim.getMode())
            .setMaterial(getOrCopyMaterial(srcPrim.getMaterial()));

          for (const sem of srcPrim.listSemantics()) {
            const srcAcc = srcPrim.getAttribute(sem);
            if (srcAcc) {
              const newAcc = treeDoc.createAccessor(srcAcc.getName())
                .setType(srcAcc.getType())
                .setArray(srcAcc.getArray())
                .setNormalized(srcAcc.getNormalized());
              newPrim.setAttribute(sem, newAcc);
            }
          }
          const srcIndices = srcPrim.getIndices();
          if (srcIndices) {
            const newIndices = treeDoc.createAccessor(srcIndices.getName())
              .setType(srcIndices.getType())
              .setArray(srcIndices.getArray());
            newPrim.setIndices(newIndices);
          }
          newMesh.addPrimitive(newPrim);
        }
        newNode.setMesh(newMesh);
      }

      if (parentTreeNode) {
        parentTreeNode.addChild(newNode);
      } else {
        treeScene.addChild(newNode);
      }

      for (const child of src.listChildren()) {
        cloneHierarchy(child, newNode, false);
      }
      return newNode;
    }

    cloneHierarchy(sourceNode, null, true);

    const filename = 'pine_tree_0' + (i + 1) + '.glb';
    const outPath = path.join(outDir, filename);
    const glbBuffer = await io.writeBinary(treeDoc);
    fs.writeFileSync(outPath, Buffer.from(glbBuffer));
    console.log('Saved ' + filename + ' (' + glbBuffer.byteLength + ' bytes)');
  }
}

extractTrees().catch(console.error);
