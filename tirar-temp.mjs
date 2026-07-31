import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.screenshot({ path: process.argv[2] + '/menu.png' });
// abre o editor pelo card "Novo quiz"
await p.click('.card-novo');
await p.waitForTimeout(500);
await p.screenshot({ path: process.argv[2] + '/editor.png', fullPage: false });
// marca uma alternativa como correta pra ver o estado
await p.fill('.c-enun', 'Qual é a capital da Austrália?');
const ops = await p.$$('.ed-alt .c-op');
const textos = ['Sydney', 'Camberra', 'Melbourne', 'Perth'];
for (let i = 0; i < 4; i++) await ops[i].fill(textos[i]);
await p.click('.ed-alt[data-i="1"] .marcar');
await p.waitForTimeout(300);
await p.screenshot({ path: process.argv[2] + '/editor-preenchido.png' });
await b.close();
