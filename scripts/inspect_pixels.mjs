import sharp from 'sharp';

async function inspect(filePath) {
  const meta = await sharp(filePath).metadata();
  console.log(`\nFile: ${filePath}`);
  console.log(`Dimensions: ${meta.width}x${meta.height}, Channels: ${meta.channels}, Format: ${meta.format}, hasAlpha: ${meta.hasAlpha}`);

  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0, minA = 255, maxA = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = info.channels === 4 ? data[i+3] : 255;
    if (a > 10) {
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
      if (a < minA) minA = a; if (a > maxA) maxA = a;
    }
  }
  console.log(`RGB Range (where A > 10): R=[${minR}, ${maxR}], G=[${minG}, ${maxG}], B=[${minB}, ${maxB}], A=[${minA}, ${maxA}]`);
}

async function main() {
  await inspect('E:/Z FUCK CLAUDE/public/assets/Trees/01/textures/pine_leaves_alpha.webp');
  await inspect('E:/Z FUCK CLAUDE/public/assets/Trees/01/textures/birch_leaves_alpha.webp');
  await inspect('E:/Z FUCK CLAUDE/public/assets/Trees/01/textures/pine_trunk.webp');
  await inspect('E:/Z FUCK CLAUDE/public/assets/Trees/01/textures/birch_trunk.webp');
}

main().catch(console.error);
