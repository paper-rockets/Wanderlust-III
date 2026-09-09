import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const inputPath = 'E:/CLAUDE/extracted/stylized-assets/public/assets/trees-rocks.glb';

async function main() {
  const document = await io.read(inputPath);
  const root = document.getRoot();

  console.log('Materials:', root.listMaterials().map(m => m.getName()));
  console.log('Textures:', root.listTextures().map(t => `${t.getName()} (${t.getMimeType()}, ${t.getImage() ? t.getImage().length : 0} bytes)`));
  
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    let totalVerts = 0;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) totalVerts += pos.getCount();
    }
    console.log(`${node.getName()}: translation=[${node.getTranslation().join(', ')}], vertices=${totalVerts}`);
  }
}

main().catch(console.error);
