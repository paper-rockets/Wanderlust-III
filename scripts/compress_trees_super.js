import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, quantize, prune, dedup, draco } from '@gltf-transform/functions';
import draco3d from 'draco3d';

async function compressAllTrees() {
    const inputDir = 'E:/Z/Assets/models/trees_nano/';
    const targetDirs = [
        'E:/Z/Assets/models/trees_nano/',
        'E:/Z/Wanderlust/public/assets/models/trees_nano/',
        'E:/Z/Wanderlust/dist/assets/models/trees_nano/'
    ];

    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': await draco3d.createDecoderModule(),
            'draco3d.encoder': await draco3d.createEncoderModule(),
        });

    const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.glb'));
    console.log(`Found ${files.length} tree models to compress.`);

    for (const f of files) {
        const inPath = path.join(inputDir, f);
        const origSize = fs.statSync(inPath).size;
        
        const doc = await io.read(inPath);

        await doc.transform(
            weld({ tolerance: 0.0005 }),
            quantize({
                quantizePosition: 14,
                quantizeNormal: 8,
                quantizeTexcoord: 10
            }),
            prune(),
            dedup(),
            draco({
                quantizePosition: 14,
                quantizeNormal: 8,
                quantizeTexcoord: 10,
                quantizeGeneric: 8,
                encodeSpeed: 0,
                decodeSpeed: 5
            })
        );

        const outBuf = await io.writeBinary(doc);
        const newSize = outBuf.length;
        const reduction = ((1 - newSize / origSize) * 100).toFixed(1);

        for (const outDir of targetDirs) {
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(path.join(outDir, f), outBuf);
        }

        console.log(`${f.padEnd(26)} : ${(origSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB (${reduction}% reduction)`);
    }

    console.log('\nAll tree models successfully super-compressed.');
}

compressAllTrees().catch(console.error);
