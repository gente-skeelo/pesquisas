/**
 * Quiz do Skee: Festas Juninas pelo mundo — servidor
 *
 * Um processo, uma sala, estado em memória. O apresentador abre /host?k=CHAVE
 * numa tela grande; a galera entra pela raiz no celular. Tudo em tempo real por
 * WebSocket: o servidor é a fonte da verdade do relógio e da pontuação.
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import express from 'express';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';

import { BARALHO } from './baralho.js';

const RAIZ = dirname(fileURLToPath(import.meta.url));

const PORTA         = Number(process.env.PORT || 3000);
const CHAVE_HOST    = process.env.CHAVE_HOST || 'arraia';
const URL_PUBLICA   = process.env.URL_PUBLICA || '';
const PONTOS_BASE   = 500;   // por acertar
const PONTOS_RAPIDEZ = 500;  // extra proporcional ao tempo que sobrou
const PAUSA_FIM     = 700;   // respiro antes de revelar quando todos já responderam

/* ---------- estado da partida ---------- */

const jogo = {
  fase: 'lobby',        // lobby | pergunta | revelacao | placar | fim
  idioma: 'pt',
  q: -1,
  abertaEm: 0,
  relogio: null,
  jogadores: new Map(), // token -> { token, nome, pontos, ganho, conectado }
  respostas: new Map(), // indice da pergunta -> Map(token -> { opcao, ms })
};

const carta = () => (jogo.q >= 0 && jogo.q < BARALHO.length ? BARALHO[jogo.q] : null);
const texto = () => {
  const c = carta();
  return c ? c[jogo.idioma] : null;
};

function ranking() {
  return [...jogo.jogadores.values()]
    .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt'))
    .map((j, i) => ({ pos: i + 1, token: j.token, nome: j.nome, pontos: j.pontos, ganho: j.ganho }));
}

function restanteMs() {
  const c = carta();
  if (jogo.fase !== 'pergunta' || !c) return 0;
  return Math.max(0, jogo.abertaEm + c.segundos * 1000 - Date.now());
}

function base() {
  const c = carta();
  const t = texto();
  const revelando = jogo.fase === 'revelacao' || jogo.fase === 'placar';
  return {
    fase: jogo.fase,
    idioma: jogo.idioma,
    q: jogo.q,
    total: BARALHO.length,
    enunciado: t ? t.enunciado : '',
    opcoes: t ? t.opcoes : [],
    duracao: c ? c.segundos * 1000 : 0,
    restante: restanteMs(),
    correta: revelando ? c.correta : null,
    curiosidade: jogo.fase === 'revelacao' ? t.curiosidade : '',
  };
}

function estadoApresentador() {
  const dadas = jogo.respostas.get(jogo.q) || new Map();
  const contagem = [0, 0, 0, 0];
  for (const r of dadas.values()) if (r.opcao >= 0 && r.opcao < 4) contagem[r.opcao]++;

  return {
    ...base(),
    jogadores: [...jogo.jogadores.values()].map((j) => ({ nome: j.nome, conectado: j.conectado })),
    responderam: dadas.size,
    contagem: jogo.fase === 'lobby' || jogo.fase === 'pergunta' ? null : contagem,
    ranking: ranking().slice(0, 10),
  };
}

function estadoJogador(token) {
  const eu = jogo.jogadores.get(token);
  const dadas = jogo.respostas.get(jogo.q) || new Map();
  const minha = dadas.get(token);
  const lista = ranking();
  const posicao = lista.findIndex((r) => r.token === token) + 1;

  return {
    ...base(),
    curiosidade: '',                     // a curiosidade fica na tela grande
    nome: eu ? eu.nome : '',
    pontos: eu ? eu.pontos : 0,
    ganho: eu ? eu.ganho : 0,
    escolha: minha ? minha.opcao : null,
    posicao,
    jogadores: jogo.jogadores.size,
    podio: jogo.fase === 'fim' ? lista.slice(0, 3).map((r) => ({ nome: r.nome, pontos: r.pontos })) : null,
  };
}

/* ---------- transmissão ---------- */

let wss;

function transmitir() {
  if (!wss) return;
  const paraHost = JSON.stringify({ t: 'estado', ...estadoApresentador() });
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    if (ws.papel === 'host') ws.send(paraHost);
    else if (ws.token) ws.send(JSON.stringify({ t: 'estado', ...estadoJogador(ws.token) }));
  }
}

/* ---------- máquina de estados ---------- */

function abrirPergunta(i) {
  if (i < 0 || i >= BARALHO.length) return encerrar();
  clearTimeout(jogo.relogio);
  jogo.q = i;
  jogo.fase = 'pergunta';
  jogo.abertaEm = Date.now();
  jogo.respostas.set(i, new Map());
  for (const j of jogo.jogadores.values()) j.ganho = 0;
  jogo.relogio = setTimeout(revelar, BARALHO[i].segundos * 1000);
  transmitir();
}

function revelar() {
  if (jogo.fase !== 'pergunta') return;
  clearTimeout(jogo.relogio);

  const c = carta();
  const dadas = jogo.respostas.get(jogo.q) || new Map();

  for (const j of jogo.jogadores.values()) {
    const r = dadas.get(j.token);
    if (r && r.opcao === c.correta) {
      const sobra = Math.max(0, 1 - r.ms / (c.segundos * 1000));
      j.ganho = PONTOS_BASE + Math.round(PONTOS_RAPIDEZ * sobra);
      j.pontos += j.ganho;
    } else {
      j.ganho = 0;
    }
  }

  jogo.fase = 'revelacao';
  transmitir();
}

function mostrarPlacar() {
  if (jogo.fase !== 'revelacao') return;
  jogo.fase = 'placar';
  transmitir();
}

function proxima() {
  if (jogo.q + 1 >= BARALHO.length) return encerrar();
  abrirPergunta(jogo.q + 1);
}

function encerrar() {
  clearTimeout(jogo.relogio);
  jogo.fase = 'fim';
  transmitir();
}

function reiniciar() {
  clearTimeout(jogo.relogio);
  jogo.fase = 'lobby';
  jogo.q = -1;
  jogo.abertaEm = 0;
  jogo.respostas.clear();
  for (const j of jogo.jogadores.values()) {
    j.pontos = 0;
    j.ganho = 0;
  }
  transmitir();
}

function responder(token, q, opcao) {
  if (jogo.fase !== 'pergunta' || q !== jogo.q) return;
  if (!jogo.jogadores.has(token)) return;
  if (!(opcao >= 0 && opcao < 4)) return;

  const dadas = jogo.respostas.get(jogo.q);
  if (dadas.has(token)) return;                       // primeira resposta vale
  dadas.set(token, { opcao, ms: Date.now() - jogo.abertaEm });

  const ativos = [...jogo.jogadores.values()].filter((j) => j.conectado).length;
  if (ativos > 0 && dadas.size >= ativos) setTimeout(revelar, PAUSA_FIM);

  transmitir();
}

function entrar(nomeBruto) {
  const nome = String(nomeBruto || '').trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!nome) return { erro: 'nome' };

  const repetido = [...jogo.jogadores.values()].some(
    (j) => j.conectado && j.nome.toLowerCase() === nome.toLowerCase(),
  );
  if (repetido) return { erro: 'repetido' };

  const token = randomUUID();
  jogo.jogadores.set(token, { token, nome, pontos: 0, ganho: 0, conectado: true });
  return { token, nome };
}

/* ---------- HTTP ---------- */

const app = express();
const publico = join(RAIZ, 'public');
const htmlHost = readFileSync(join(RAIZ, 'views', 'host.html'), 'utf8');

app.use(express.static(publico, { maxAge: '1h' }));

app.get('/host', (req, res) => {
  if ((req.query.k || '') !== CHAVE_HOST) {
    return res.status(401).type('html').send(
      '<meta charset="utf-8"><body style="font:16px/1.5 system-ui;background:#1b1030;color:#fff;padding:3rem">' +
        '<h1>Chave inválida</h1><p>O modo apresentador precisa de <code>?k=SUA_CHAVE</code>.</p></body>',
    );
  }
  res.type('html').send(htmlHost.replace('__CHAVE__', encodeURIComponent(CHAVE_HOST)));
});

app.get('/api/entrada', async (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = URL_PUBLICA || `${proto}://${req.get('host')}/`;
  res.json({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 512 }) });
});

app.get('/api/saude', (req, res) => {
  res.json({ ok: true, fase: jogo.fase, jogadores: jogo.jogadores.size, perguntas: BARALHO.length });
});

/* ---------- WebSocket ---------- */

const servidor = createServer(app);
wss = new WebSocketServer({ server: servidor, path: '/ws' });

wss.on('connection', (ws) => {
  ws.papel = null;
  ws.token = null;
  ws.vivo = true;
  ws.on('pong', () => { ws.vivo = true; });

  ws.on('message', (bruto) => {
    let m;
    try {
      m = JSON.parse(bruto);
    } catch {
      return;
    }

    /* apresentador */
    if (m.t === 'host') {
      if (m.k !== CHAVE_HOST) return ws.send(JSON.stringify({ t: 'erro', erro: 'chave' }));
      ws.papel = 'host';
      return ws.send(JSON.stringify({ t: 'estado', ...estadoApresentador() }));
    }

    if (ws.papel === 'host') {
      if (m.t === 'comecar') abrirPergunta(0);
      else if (m.t === 'revelar') revelar();
      else if (m.t === 'placar') mostrarPlacar();
      else if (m.t === 'proxima') proxima();
      else if (m.t === 'encerrar') encerrar();
      else if (m.t === 'reiniciar') reiniciar();
      else if (m.t === 'idioma' && (m.v === 'pt' || m.v === 'en')) {
        jogo.idioma = m.v;
        transmitir();
      }
      return;
    }

    /* jogador */
    if (m.t === 'entrar') {
      const r = entrar(m.nome);
      if (r.erro) return ws.send(JSON.stringify({ t: 'erro', erro: r.erro }));
      ws.papel = 'jogador';
      ws.token = r.token;
      ws.send(JSON.stringify({ t: 'eu', token: r.token, nome: r.nome }));
      return transmitir();
    }

    if (m.t === 'voltar') {
      const j = jogo.jogadores.get(m.token);
      if (!j) return ws.send(JSON.stringify({ t: 'erro', erro: 'desconhecido' }));
      j.conectado = true;
      ws.papel = 'jogador';
      ws.token = j.token;
      ws.send(JSON.stringify({ t: 'eu', token: j.token, nome: j.nome }));
      return transmitir();
    }

    if (m.t === 'responder' && ws.token) responder(ws.token, m.q, m.opcao);
  });

  ws.on('close', () => {
    const j = ws.token && jogo.jogadores.get(ws.token);
    if (j) {
      j.conectado = false;
      transmitir();
    }
  });
});

/* derruba conexões zumbis, que em PaaS com proxy acontecem bastante */
const batida = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.vivo) {
      ws.terminate();
      continue;
    }
    ws.vivo = false;
    ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(batida));

/* relógio de tela: mantém o contador dos clientes em sincronia */
setInterval(() => {
  if (jogo.fase === 'pergunta') transmitir();
}, 1000);

servidor.listen(PORTA, () => {
  console.log(`quiz no ar em http://localhost:${PORTA}  ·  apresentador em /host?k=${CHAVE_HOST}`);
});

export { servidor, jogo };
