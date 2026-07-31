import { chromium } from 'playwright';
const dir = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
await p.click('.ac-jogar');
await p.waitForTimeout(700);
const pin = await p.textContent('#pin-grande');

// celular entra ANTES de começar
const c = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await c.goto('http://127.0.0.1:4477/?pin=' + pin, { waitUntil: 'networkidle' });
await c.waitForTimeout(800);
await c.fill('#nome', 'Bruno');
await c.click('#bt-entrar');
await c.waitForTimeout(800);

await p.click('#bt-principal');           // começa a partida
await p.waitForTimeout(1000);
await c.screenshot({ path: dir + '/r-celular-pergunta.png' });
await b.close();
