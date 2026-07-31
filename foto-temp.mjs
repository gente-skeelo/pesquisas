import { chromium } from 'playwright';
import { WebSocket } from 'ws';
const dir = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);                       // deixa a fonte carregar
await p.screenshot({ path: dir + '/menu.png' });
await p.click('.ac-jogar');
await p.waitForTimeout(700);
const pin = await p.textContent('#pin-grande');
const entrar = (nome) => new Promise((ok) => {
  const ws = new WebSocket('ws://127.0.0.1:4477/ws');
  ws.on('open', () => ws.send(JSON.stringify({ t: 'entrar', nome, pin })));
  ws.on('message', (m) => { if (JSON.parse(m).t === 'eu') ok(ws); });
});
const a = await entrar('Andressa'); const c = await entrar('Bruno');
await p.waitForTimeout(500);
await p.screenshot({ path: dir + '/lobby.png' });
await p.click('#bt-principal');
await p.waitForTimeout(900);
await p.screenshot({ path: dir + '/jogo.png' });
a.close(); c.close(); await b.close();
