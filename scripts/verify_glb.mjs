import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

async function check(filename) {
  const doc = await io.read(`E:/Z FUCK CLAUDE/public/assets/Trees/01/${filename}`);
  const root = doc.getRoot();
  console.log(`\nChecking ${filename}:`);
  for (const mat of root.listMaterials()) {
    const tex = mat.getBaseColorTexture();
    console.log(`  Material: "${mat.getName()}", alphaMode: "${mat.getAlphaMode()}", alphaCutoff: ${mat.getAlphaCutoff()}, doubleSided: ${mat.getDoubleSided()}`);
    if (tex) {
      console.log(`    Texture: "${tex.getName()}", size: ${tex.getImage().length} bytes, mime: "${tex.getMimeType()}"`);
    }
  }
}

async function main() {
  await check('tree_pine_01.glb');
  await check('tree_birch_01.glb');
}

main().catch(console.error);
