import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, quantize, prune, dedup, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';

async function recompressTrees() {
    const inputDir = 'E:/Z/Assets/models/Original/';
    const targetDirs = [
        'E:/Z/Assets/models/trees_nano/',
        'E:/Z/Wanderlust/public/assets/models/trees_nano/',
        'E:/Z/Wanderlust/dist/assets/models/trees_nano/'
    ];

    console.log('Step 1: Deleting existing trees_nano from disk...');
    for (const dir of targetDirs) {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log('Deleted:', dir);
        }
        fs.mkdirSync(dir, { recursive: true });
        console.log('Recreated clean directory:', dir);
    }

    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': await draco3d.createDecoderModule(),
            'draco3d.encoder': await draco3d.createEncoderModule(),
        });

    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.glb'));
    console.log(`\nStep 2: Processing and recompressing ${files.length} tree models from Original...`);

    for (const f of files) {
        const inPath = path.join(inputDir, f);
        const origSize = fs.statSync(inPath).size;

        const doc = await io.read(inPath);
        const textures = doc.getRoot().listTextures();

        for (const tex of textures) {
            const rawImage = tex.getImage();
            const name = (tex.getName() || '').toLowerCase();

            let processed;
            if (name.includes('material.011') || name.includes('trunk') || name.includes('bark') || name.includes('wood')) {
                // Trunk texture
                processed = await sharp(rawImage)
                    .resize(128, 128, { fit: 'inside' })
                    .webp({ quality: 70, effort: 6 })
                    .toBuffer();
            } else {
                // Foliage texture: clean alpha channel to prevent card artifacting
                const img = sharp(rawImage).resize(256, 256, { fit: 'inside' });
                const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] < 140) {
                        data[i + 3] = 0;
                        data[i] = 0;
                        data[i + 1] = 0;
                        data[i + 2] = 0;
                    } else {
                        data[i + 3] = 255;
                    }
                }

                processed = await sharp(data, {
                    raw: { width: info.width, height: info.height, channels: 4 }
                })
                .webp({ quality: 80, alphaQuality: 100, effort: 6 })
                .toBuffer();
            }

            tex.setImage(new Uint8Array(processed));
            tex.setMimeType('image/webp');
        }

        // Set materials alpha mode and cutoff
        doc.getRoot().listMaterials().forEach(m => {
            const matName = (m.getName() || '').toLowerCase();
            if (matName.includes('material.011') || matName.includes('trunk') || matName.includes('bark')) {
                m.setAlphaMode('OPAQUE');
            } else {
                m.setAlphaMode('MASK');
                m.setAlphaCutoff(0.5);
            }
        });

        await doc.transform(
            weld({ tolerance: 0.0001 }),
            quantize({
                quantizePosition: 14,
                quantizeNormal: 10,
                quantizeTexcoord: 12
            }),
            prune(),
            dedup(),
            draco({
                quantizePosition: 14,
                quantizeNormal: 10,
                quantizeTexcoord: 12,
                quantizeGeneric: 8,
                encodeSpeed: 0,
                decodeSpeed: 5
            })
        );

        const outBuf = await io.writeBinary(doc);
        const newSize = outBuf.length;
        const reduction = ((1 - newSize / origSize) * 100).toFixed(1);

        for (const outDir of targetDirs) {
            fs.writeFileSync(path.join(outDir, f), outBuf);
        }

        console.log(`${f.padEnd(26)} : ${(origSize / 1024 / 1024).toFixed(2)} MB -> ${(newSize / 1024).toFixed(1)} KB (${reduction}% reduction)`);
    }

    console.log('\nAll tree models successfully cleaned and recompressed!');
}

recompressTrees().catch(console.error);
