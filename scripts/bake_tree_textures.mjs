import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcDir = 'E:/CLAUDE/extracted/stylized-assets/public/assets/tree_textures';
const outDir = 'E:/Z FUCK CLAUDE/public/assets/Trees/01/textures';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function bakeTextures() {
  console.log('--- Baking Real Stylized RGBA Tree Textures ---');

  // 1. Pine Leaves: Grayscale mask -> RGBA with lush stylized pine green gradient
  {
    const { data, info } = await sharp(path.join(srcDir, 'pine_leaves_alpha.webp'))
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const rgba = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      // gradient from top to bottom
      const t = y / height;
      // Bottom/Stem: Dark pine #1a3820 (26, 56, 32)
      // Top/Needle tips: Fresh vibrant pine #4e822e (78, 130, 46)
      const r = Math.round(26 * (1 - t) + 78 * t);
      const g = Math.round(56 * (1 - t) + 130 * t);
      const b = Math.round(32 * (1 - t) + 46 * t);

      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * info.channels;
        const dstIdx = (y * width + x) * 4;
        const maskVal = data[srcIdx]; // 0 to 255

        if (maskVal > 20) {
          // Add subtle texture variation from mask
          const intensity = maskVal / 255.0;
          rgba[dstIdx] = Math.min(255, Math.round(r * intensity));
          rgba[dstIdx + 1] = Math.min(255, Math.round(g * intensity));
          rgba[dstIdx + 2] = Math.min(255, Math.round(b * intensity));
          rgba[dstIdx + 3] = maskVal > 100 ? 255 : Math.round((maskVal / 100) * 255);
        } else {
          rgba[dstIdx] = 0;
          rgba[dstIdx + 1] = 0;
          rgba[dstIdx + 2] = 0;
          rgba[dstIdx + 3] = 0;
        }
      }
    }

    await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, 'pine_leaves_colored.png'));
    console.log('Created pine_leaves_colored.png');
  }

  // 2. Birch Leaves: Grayscale mask -> RGBA with lush stylized birch green
  {
    const { data, info } = await sharp(path.join(srcDir, 'birch_leaves_alpha.webp'))
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const rgba = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      const t = y / height;
      // Vibrant anime birch leaves #3b7d18 (59, 125, 24) to #78b820 (120, 184, 32)
      const r = Math.round(59 * (1 - t) + 120 * t);
      const g = Math.round(125 * (1 - t) + 184 * t);
      const b = Math.round(24 * (1 - t) + 32 * t);

      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * info.channels;
        const dstIdx = (y * width + x) * 4;
        const maskVal = data[srcIdx];

        if (maskVal > 20) {
          const intensity = maskVal / 255.0;
          rgba[dstIdx] = Math.min(255, Math.round(r * intensity));
          rgba[dstIdx + 1] = Math.min(255, Math.round(g * intensity));
          rgba[dstIdx + 2] = Math.min(255, Math.round(b * intensity));
          rgba[dstIdx + 3] = maskVal > 80 ? 255 : Math.round((maskVal / 80) * 255);
        } else {
          rgba[dstIdx] = 0;
          rgba[dstIdx + 1] = 0;
          rgba[dstIdx + 2] = 0;
          rgba[dstIdx + 3] = 0;
        }
      }
    }

    await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(path.join(outDir, 'birch_leaves_colored.png'));
    console.log('Created birch_leaves_colored.png');
  }

  // 3. Pine Trunk: Grayscale height map -> Stylized pine/cedar brown bark
  {
    const { data, info } = await sharp(path.join(srcDir, 'pine_trunk.webp'))
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const rgb = Buffer.alloc(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * info.channels;
      const dstIdx = i * 3;
      const gray = data[srcIdx] / 255.0; // 0.8 to 1.0 mostly

      // Base warm dark pine bark #4e3629 (78, 54, 41) tinted by detail
      rgb[dstIdx] = Math.min(255, Math.round(78 * gray));
      rgb[dstIdx + 1] = Math.min(255, Math.round(54 * gray));
      rgb[dstIdx + 2] = Math.min(255, Math.round(41 * gray));
    }

    await sharp(rgb, { raw: { width, height, channels: 3 } })
      .png()
      .toFile(path.join(outDir, 'pine_trunk_colored.png'));
    console.log('Created pine_trunk_colored.png');
  }

  // 4. Birch Trunk: Grayscale height/pattern -> Classic stylized birch tree bark (cream with dark knots)
  {
    const { data, info } = await sharp(path.join(srcDir, 'birch_trunk.webp'))
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const rgb = Buffer.alloc(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * info.channels;
      const dstIdx = i * 3;
      const val = data[srcIdx]; // 137 to 255

      // Birch bark: Light areas are cream/white #e8e2d5, darker areas are knots/rings #3e3328
      const factor = (val - 130) / (255 - 130); // 0 to 1
      const clamped = Math.max(0, Math.min(1, factor));

      const r = Math.round(62 * (1 - clamped) + 232 * clamped);
      const g = Math.round(51 * (1 - clamped) + 226 * clamped);
      const b = Math.round(40 * (1 - clamped) + 213 * clamped);

      rgb[dstIdx] = r;
      rgb[dstIdx + 1] = g;
      rgb[dstIdx + 2] = b;
    }

    await sharp(rgb, { raw: { width, height, channels: 3 } })
      .png()
      .toFile(path.join(outDir, 'birch_trunk_colored.png'));
    console.log('Created birch_trunk_colored.png');
  }

  console.log('Texture baking complete!');
}

bakeTextures().catch(console.error);
