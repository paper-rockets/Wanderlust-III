import puppeteer from 'puppeteer';

async function testViewer() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('file:///C:/Users/macie/OneDrive/Desktop/Multi_GLB_Viewer%20-%20Copy.html');
  await new Promise(r => setTimeout(r, 1000));

  const inputUploadHandle = await page.$('input[type="file"]');
  const testGlbPath = 'E:/Z/Tree Test Gemini/Toon_Baked_Models/Version_1_Double_Sided/Tier_1_200_300KB/pine_tree_01.glb';
  await inputUploadHandle.uploadFile(testGlbPath);

  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'E:/Z/Tree Test Gemini/multi_viewer_toon_test.png' });
  console.log('Screenshot saved to E:/Z/Tree Test Gemini/multi_viewer_toon_test.png');

  await browser.close();
}
testViewer();
