/**
 * Teste de carga: sobe o servidor, conecta N jogadores de verdade por WebSocket,
 * roda uma pergunta e mede quanto o servidor demora pra transmitir estado a todos.
 *
 *   node teste/carga.mjs 200
 */
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as espera } from 'node:timers/promises';
import { WebSocket } from 'ws';

const N = Number(process.argv[2] || 100);
const PORTA = 4500 + (N % 100);
const CHAVE = 'carga';

const servidor = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORTA), CHAVE_HOST: CHAVE,
         DADOS_DIR: join(tmpdir(), 'carga-' + Date.now()), DATABASE_URL: '', ANTHROPIC_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
servidor.stdout.on('data', () => {});
await espera(900);

const abrir = () => new Promise((ok) => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORTA}/ws`);
  ws.on('open', () => ok(ws));
});

// apresentador cria e abre um quiz de 1 pergunta longa
const host = await abrir();
const idQuiz = await new Promise((ok) => {
  host.send(JSON.stringify({ t: 'host', k: CHAVE }));
  host.send(JSON.stringify({ t: 'salvarQuiz', quiz: { titulo: 'Carga', emoji: '⚡',
    cartas: [{ segundos: 30, correta: 0,
      pt: { enunciado: 'Aguenta?', opcoes: ['a', 'b', 'c', 'd'], curiosidade: '' } }] } }));
  host.on('message', (m) => { const d = JSON.parse(m); if (d.t === 'salvo') ok(d.id); });
});
const pin = await new Promise((ok, falha) => {
  const t = setTimeout(() => falha(new Error('não veio PIN')), 5000);
  const h = (m) => {
    const d = JSON.parse(m);
    if (d.t === 'estado' && d.pin) { clearTimeout(t); host.off('message', h); ok(d.pin); }
  };
  host.on('message', h);
  host.send(JSON.stringify({ t: 'abrirQuiz', id: idQuiz }));
});
console.error('  pin', pin);

// conecta os jogadores
const t0 = Date.now();
const jogadores = [];
for (let i = 0; i < N; i++) {
  const ws = await abrir();
  ws.__recebidos = 0;
  ws.__ultimo = 0;
  ws.on('message', (m) => {
    const d = JSON.parse(m);
    if (d.t === 'estado') { ws.__recebidos++; ws.__ultimo = Date.now(); }
  });
  ws.send(JSON.stringify({ t: 'entrar', nome: 'Jogador' + i, pin }));
  jogadores.push(ws);
}
await espera(1500);
const tEntrada = Date.now() - t0;
console.error('  conectados', jogadores.length);

const naSala = await new Promise((ok) => {
  const h = (m) => { const d = JSON.parse(m); if (d.t === 'estado') { host.off('message', h); ok(d.jogadores.length); } };
  host.on('message', h);
  host.send(JSON.stringify({ t: 'idioma', v: 'pt' }));
});

// abre a pergunta e mede a rajada de respostas simultâneas
jogadores.forEach((w) => { w.__recebidos = 0; });
const tAbre = Date.now();
host.send(JSON.stringify({ t: 'comecar' }));
await espera(700);
const tPrimeiro = Math.max(...jogadores.map((w) => w.__ultimo)) - tAbre;

const tResp = Date.now();
jogadores.forEach((w, i) => w.send(JSON.stringify({ t: 'responder', q: 0, opcao: i % 4 })));
await espera(2500);
const tTodos = Math.max(...jogadores.map((w) => w.__ultimo)) - tResp;

// segunda rodada: mede a pergunta ABERTA, quando o relógio transmite a cada segundo
host.send(JSON.stringify({ t: 'placar' }));
await espera(300);
host.send(JSON.stringify({ t: 'reiniciar' }));
await espera(600);
host.send(JSON.stringify({ t: 'comecar' }));
await espera(600);
jogadores.forEach((w) => { w.__recebidos = 0; });
const tRelogio = Date.now();
await espera(5000);
const msgsPorJogador = jogadores.reduce((a, w) => a + w.__recebidos, 0) / N;
const atrasoRelogio = Date.now() - tRelogio - 5000;

const mem = await (await fetch(`http://127.0.0.1:${PORTA}/api/saude`)).json();
console.log(JSON.stringify({
  jogadores: N,
  entraramNoRoster: naSala,
  msEntradaTotal: tEntrada,
  msAteTodosVeremAPergunta: tPrimeiro,
  msAteTodosVeremARevelacao: tTodos,
  ticsDoRelogioEm5s: Number(msgsPorJogador.toFixed(1)),
  fase: mem.fase,
}));

jogadores.forEach((w) => w.close());
host.close();
servidor.kill();
process.exit(0);
