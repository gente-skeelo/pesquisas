import { chromium } from 'playwright';
import { WebSocket } from 'ws';
const dir = process.argv[2];
const host = new WebSocket('ws://127.0.0.1:4477/ws');
const idQuiz = await new Promise((ok) => {
  host.on('open', () => {
    host.send(JSON.stringify({ t: 'host', k: 'foto' }));
    host.send(JSON.stringify({ t: 'salvarQuiz', quiz: {
      titulo: 'Idiomas', emoji: '🌎',
      cartas: [{ segundos: 60, correta: 0,
        pt: { enunciado: 'Qual é a capital do Peru?', opcoes: ['Lima', 'Quito', 'La Paz', 'Bogotá'], curiosidade: '' },
        en: { enunciado: 'What is the capital of Peru?', opcoes: ['Lima', 'Quito', 'La Paz', 'Bogotá'], curiosidade: '' },
        es: { enunciado: '¿Cuál es la capital de Perú?', opcoes: ['Lima', 'Quito', 'La Paz', 'Bogotá'], curiosidade: '' } }],
    } }));
  });
  host.on('message', (m) => { const d = JSON.parse(m); if (d.t === 'salvo') ok(d.id); });
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const erros = [];
const h = await b.newPage({ viewport: { width: 1280, height: 800 } });
h.on('pageerror', (e) => erros.push('host: ' + e.message));
await h.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await h.waitForTimeout(900);
host.send(JSON.stringify({ t: 'abrirQuiz', id: idQuiz }));
await h.waitForTimeout(600);
const pin = await h.textContent('#pin-grande');

const c = await b.newPage({ viewport: { width: 420, height: 780 } });
c.on('pageerror', (e) => erros.push('jogador: ' + e.message));
await c.goto('http://127.0.0.1:4477/?pin=' + pin, { waitUntil: 'networkidle' });
await c.waitForTimeout(600);
await c.fill('#nome', 'Ana');
await c.click('#bt-entrar');
await c.waitForTimeout(700);
await h.click('#bt-principal');
await h.waitForTimeout(800);

for (const [lang, arquivo] of [['es', 'i-es'], ['en', 'i-en'], ['pt', 'i-pt']]) {
  await h.click('#bt-' + lang);
  await h.waitForTimeout(900);
  const enunH = (await h.textContent('#enunciado')).trim();
  const enunC = (await c.textContent('#enunciado')).trim();
  const idx = (await h.textContent('#idx')).trim();
  const resp = (await h.textContent('#respondidos')).trim();
  const bt = (await h.textContent('#bt-principal')).trim();
  console.log(`[${lang}] host: "${idx}" · "${resp}" · botão "${bt}"`);
  console.log(`     enunciado host: "${enunH}" | jogador: "${enunC}"`);
  if (lang === 'es') await h.screenshot({ path: dir + '/' + arquivo + '.png' });
}
console.log(erros.length ? 'ERROS: ' + erros.join(' | ') : 'sem erros de página');
host.close(); await b.close();
