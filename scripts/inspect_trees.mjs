import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const inputPath = 'E:/CLAUDE/extracted/stylized-assets/public/assets/trees-rocks.glb';

async function main() {
  const document = await io.read(inputPath);
  const root = document.getRoot();

  console.log('--- SCENES ---');
  for (const scene of root.listScenes()) {
    console.log(`Scene: ${scene.getName()}`);
    for (const child of scene.listChildren()) {
      printNode(child, 1);
    }
  }

  console.log('\n--- NODES ---');
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    const translation = node.getTranslation();
    const scale = node.getScale();
    const rotation = node.getRotation();
    console.log(`Node: "${node.getName()}", Mesh: "${mesh ? mesh.getName() : 'none'}", Parent: "${node.getParentNode() ? node.getParentNode().getName() : 'root'}"`);
    console.log(`  Translation: [${translation.map(v => v.toFixed(2)).join(', ')}]`);
  }

  console.log('\n--- MESHES ---');
  for (const mesh of root.listMeshes()) {
    console.log(`Mesh: "${mesh.getName()}", Primitives: ${mesh.listPrimitives().length}`);
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      console.log(`  Prim Mode: ${prim.getMode()}, Material: "${mat ? mat.getName() : 'none'}"`);
    }
  }
}

function printNode(node, depth) {
  const indent = '  '.repeat(depth);
  const mesh = node.getMesh();
  console.log(`${indent}Node: "${node.getName()}" (Mesh: "${mesh ? mesh.getName() : 'none'}")`);
  for (const child of node.listChildren()) {
    printNode(child, depth + 1);
  }
}

main().catch(err => console.error(err));
