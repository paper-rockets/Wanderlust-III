const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const devices = [
    {
        name: 'samsung_galaxy_s25_ultra',
        displayName: 'Samsung Galaxy S25 Ultra',
        viewport: {
            width: 916,
            height: 412,
            deviceScaleFactor: 3.4,
            isMobile: true,
            hasTouch: true,
            isLandscape: true
        },
        nativeRes: '3120 x 1440 px (QHD+ Dynamic AMOLED 2X)'
    },
    {
        name: 'apple_iphone_16_pro_max',
        displayName: 'Apple iPhone 16 Pro Max',
        viewport: {
            width: 932,
            height: 430,
            deviceScaleFactor: 3.0,
            isMobile: true,
            hasTouch: true,
            isLandscape: true
        },
        nativeRes: '2868 x 1320 px (Super Retina XDR OLED)'
    },
    {
        name: 'samsung_galaxy_tab_s6_lite',
        displayName: 'Samsung Galaxy Tab S6 Lite',
        viewport: {
            width: 1200,
            height: 720,
            deviceScaleFactor: 1.66,
            isMobile: true,
            hasTouch: true,
            isLandscape: true
        },
        nativeRes: '2000 x 1200 px (WUXGA+ TFT)'
    }
];

const outDir = path.join(__dirname, '..', 'public', 'previews');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
    console.log('Starting Mobile & Tablet High-Resolution Capture...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--enable-webgl',
            '--use-gl=angle',
            '--use-angle=default',
            '--ignore-gpu-blocklist'
        ]
    });

    for (const dev of devices) {
        console.log(`\nCapturing [${dev.displayName}] at Max Native Resolution (${dev.nativeRes})...`);
        const page = await browser.newPage();
        await page.setViewport(dev.viewport);

        try {
            await page.goto('http://localhost:3000/?webgl=1', {
                waitUntil: 'networkidle2',
                timeout: 15000
            });
            // Wait 4 seconds for terrain and assets to settle
            await new Promise(r => setTimeout(r, 4000));

            const filePath = path.join(outDir, `${dev.name}.png`);
            await page.screenshot({ path: filePath, type: 'png' });
            console.log(`Saved screenshot: ${filePath}`);
        } catch (err) {
            console.error(`Error capturing ${dev.displayName}: ${err.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log('\nAll device previews captured successfully.');
})();
