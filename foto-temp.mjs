import { chromium } from 'playwright';
const dir = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 900, height: 420 } });
// as três nozes lado a lado, grandes, pra conferir o desenho
await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.evaluate(() => {
  document.body.innerHTML =
    '<div style="display:flex;gap:60px;justify-content:center;padding:40px;background:#f2faf1">' +
    [0, 1, 2].map((i) => `<div style="width:160px">${noz(i)}</div>`).join('') + '</div>';
  document.querySelectorAll('.noz').forEach((n) => { n.style.width = '160px'; });
});
await p.waitForTimeout(400);
await p.screenshot({ path: dir + '/nozes.png' });
await b.close();
