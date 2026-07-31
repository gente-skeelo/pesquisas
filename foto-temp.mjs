import { chromium } from 'playwright';
import { WebSocket } from 'ws';
const dir = process.argv[2];

// cria um quiz de 1 pergunta pelo WS do host
const host = new WebSocket('ws://127.0.0.1:4477/ws');
const idQuiz = await new Promise((ok) => {
  host.on('open', () => {
    host.send(JSON.stringify({ t: 'host', k: 'foto' }));
    host.send(JSON.stringify({ t: 'salvarQuiz', quiz: {
      titulo: 'Final', emoji: '🏁',
      cores: ['#e8455f', '#2196f3', '#f5a623', '#00b871'],
      cartas: [{ segundos: 20, correta: 0,
        pt: { enunciado: 'Qual é a última pergunta?', opcoes: ['Esta', 'Aquela', 'Nenhuma', 'Todas'], curiosidade: '' } }],
    } }));
  });
  host.on('message', (m) => { const d = JSON.parse(m); if (d.t === 'salvo') ok(d.id); });
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const erros = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => erros.push(e.message));
await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(1100);
host.send(JSON.stringify({ t: 'abrirQuiz', id: idQuiz }));
await p.waitForTimeout(700);
const pin = await p.textContent('#pin-grande');

const entrar = (nome) => new Promise((ok) => {
  const ws = new WebSocket('ws://127.0.0.1:4477/ws');
  ws.on('open', () => ws.send(JSON.stringify({ t: 'entrar', nome, pin })));
  ws.on('message', (m) => { if (JSON.parse(m).t === 'eu') ok(ws); });
});
const j = [];
for (const n of ['Matilde', 'Carolina', 'Clara', 'Bruno']) j.push(await entrar(n));
await p.waitForTimeout(500);

await p.click('#bt-principal');                      // começa
await p.waitForTimeout(600);
j[0].send(JSON.stringify({ t: 'responder', q: 0, opcao: 0 }));
await p.waitForTimeout(200);
j[1].send(JSON.stringify({ t: 'responder', q: 0, opcao: 0 }));
await p.waitForTimeout(200);
j[2].send(JSON.stringify({ t: 'responder', q: 0, opcao: 0 }));
await p.waitForTimeout(200);
j[3].send(JSON.stringify({ t: 'responder', q: 0, opcao: 1 }));
await p.waitForTimeout(1600);
await p.screenshot({ path: dir + '/p-revelacao.png' });
const rotulo = await p.textContent('#bt-principal');
console.log('botão na última pergunta:', rotulo.trim());

await p.click('#bt-principal');                      // mostrar o pódio
await p.waitForTimeout(2400);
await p.screenshot({ path: dir + '/p-bronze.png' });
await p.waitForTimeout(3100);
await p.screenshot({ path: dir + '/p-prata.png' });
await p.waitForTimeout(3400);
await p.screenshot({ path: dir + '/p-ouro.png' });
await p.waitForTimeout(2600);
await p.screenshot({ path: dir + '/p-final.png' });

console.log(erros.length ? 'ERROS: ' + erros.join(' | ') : 'sem erros de página');
j.forEach((w) => w.close()); host.close(); await b.close();
