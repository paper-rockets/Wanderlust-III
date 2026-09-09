import fs from 'fs';
import path from 'path';

// Let's check the size and see if we can bake beautiful diffuse colors into the textures!
const texturesDir = 'E:/Z FUCK CLAUDE/public/assets/Trees/01/textures';
for (const file of fs.readdirSync(texturesDir)) {
  const stat = fs.statSync(path.join(texturesDir, file));
  console.log(`${file}: ${stat.size} bytes`);
}
