import { chromium } from 'playwright';
import { WebSocket } from 'ws';
const dir = process.argv[2];
const host = new WebSocket('ws://127.0.0.1:4477/ws');
const idQuiz = await new Promise((ok) => {
  host.on('open', () => {
    host.send(JSON.stringify({ t: 'host', k: 'foto' }));
    host.send(JSON.stringify({ t: 'salvarQuiz', quiz: { titulo: 'Som', emoji: '🎵',
      cartas: [{ segundos: 8, correta: 0, pt: { enunciado: 'Toca música?', opcoes: ['Sim','Não','Talvez','Quem sabe'], curiosidade: '' } }] } }));
  });
  host.on('message', (m) => { const d = JSON.parse(m); if (d.t === 'salvo') ok(d.id); });
});

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const erros = [];
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => erros.push(e.message));

// conta cada som agendado, antes da página rodar
await p.addInitScript(() => {
  window.__sons = 0;
  const AC = window.AudioContext || window.webkitAudioContext;
  const osc = AC.prototype.createOscillator;
  const buf = AC.prototype.createBufferSource;
  AC.prototype.createOscillator = function () { window.__sons++; return osc.call(this); };
  AC.prototype.createBufferSource = function () { window.__sons++; return buf.call(this); };
});

await p.goto('http://127.0.0.1:4477/host?k=foto', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
host.send(JSON.stringify({ t: 'abrirQuiz', id: idQuiz }));
await p.waitForTimeout(700);
const pin = await p.textContent('#pin-grande');

const j = new WebSocket('ws://127.0.0.1:4477/ws');
await new Promise((ok) => { j.on('open', () => { j.send(JSON.stringify({ t: 'entrar', nome: 'Ana', pin })); ok(); }); });
await p.waitForTimeout(600);

const conta = () => p.evaluate(() => window.__sons);
await p.click('#bt-principal');                              // clique = gesto que libera o áudio
const c0 = await conta();
await p.waitForTimeout(3000);
const cPergunta = await conta();
await p.waitForTimeout(6500);                                // tempo acaba: tiques + revelação
const cRevela = await conta();
await p.click('#bt-principal');                              // mostrar o pódio
await p.waitForTimeout(9800);
const cPodio = await conta();
await p.screenshot({ path: dir + '/som-podio.png' });

const rot1 = (await p.textContent('#bt-som')).trim();
await p.click('#bt-som');                                    // muta
const rot2 = (await p.textContent('#bt-som')).trim();
const mudo = await p.evaluate(() => Musica.estaLigado());

console.log(`sons agendados — pergunta: ${cPergunta - c0} · +revelação/tiques: ${cRevela - cPergunta} · +pódio: ${cPodio - cRevela}`);
console.log(`botão: "${rot1}" -> "${rot2}" (ligado=${mudo})`);
console.log(erros.length ? 'ERROS: ' + erros.join(' | ') : 'sem erros de página');
j.close(); host.close(); await b.close();
