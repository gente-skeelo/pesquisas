import { chromium } from 'playwright';
const dir = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1100, height: 260 } });
await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const temLogo = await p.evaluate(() => {
  const img = document.querySelector('.logo-skeelo img');
  return img ? { carregou: img.complete && img.naturalWidth > 0, w: img.naturalWidth, h: img.naturalHeight,
                 textoEscondido: document.querySelector('.logo-skeelo .palavra').hidden } : null;
});
console.log('logo:', JSON.stringify(temLogo));
await p.screenshot({ path: dir + '/logo-barra.png', clip: { x: 0, y: 0, width: 1100, height: 120 } });
await b.close();
