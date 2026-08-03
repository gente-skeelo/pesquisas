/**
 * Quiz do Skee — servidor do centralizador de quizzes da Skeelo.
 *
 * Um processo, uma sala ao vivo, biblioteca de quizzes persistida (Postgres
 * via DATABASE_URL, ou arquivo local). O apresentador abre /host?k=CHAVE,
 * escolhe (ou monta) um quiz no menu e conduz; a galera entra pela raiz.
 * Partida em andamento vive em memória; os quizzes, não.
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

import express from 'express';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';

import * as armazem from './armazem.js';
import * as traducao from './traducao.js';

const RAIZ = dirname(fileURLToPath(import.meta.url));

const PORTA          = Number(process.env.PORT || 3000);
const CHAVE_HOST     = process.env.CHAVE_HOST || 'arraia';
const URL_PUBLICA    = process.env.URL_PUBLICA || '';
const PONTOS_BASE    = 500;   // por acertar
const PONTOS_RAPIDEZ = 500;   // extra proporcional ao tempo que sobrou
const PAUSA_FIM      = 700;   // respiro antes de revelar quando todos já responderam
const BONUS_SERIE    = 100;   // por acerto seguido, acumulando
const BONUS_SERIE_MAX = 500;  // teto do bonus de sequencia

const novoPin = () => String(Math.floor(100000 + Math.random() * 900000));

const IDIOMAS = ['pt', 'en', 'es'];
const CORES_PADRAO = ['#e8455f', '#2196f3', '#f5a623', '#00b871'];
const ehHex = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));

/* ---------- estado da partida ---------- */

const jogo = {
  fase: 'menu',         // menu | lobby | pergunta | revelacao | placar | fim
  idioma: 'pt',
  pin: '',              // PIN de 6 digitos que a galera digita pra entrar
  baralho: [],          // cartas do quiz escolhido
  quizId: null,
  quizTitulo: '',
  quizEmoji: '',
  cores: CORES_PADRAO,
  q: -1,
  abertaEm: 0,
  relogio: null,
  jogadores: new Map(), // token -> { token, nome, pontos, ganho, serie, conectado }
  respostas: new Map(), // indice da pergunta -> Map(token -> { opcao, ms })
};

const carta = () => (jogo.q >= 0 && jogo.q < jogo.baralho.length ? jogo.baralho[jogo.q] : null);
const texto = () => {
  const c = carta();
  return c ? c[jogo.idioma] || c.pt : null;   // sem tradução, cai no português
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
    quiz: jogo.quizTitulo,
    emoji: jogo.quizEmoji,
    cores: jogo.cores,
    q: jogo.q,
    total: jogo.baralho.length,
    enunciado: t ? t.enunciado : '',
    opcoes: t ? t.opcoes : [],
    duracao: c ? c.segundos * 1000 : 0,
    restante: restanteMs(),
    correta: revelando && c ? c.correta : null,
    curiosidade: jogo.fase === 'revelacao' && t ? t.curiosidade || '' : '',
  };
}

function estadoApresentador(lista = ranking()) {
  const dadas = jogo.respostas.get(jogo.q) || new Map();
  const contagem = [0, 0, 0, 0];
  for (const r of dadas.values()) if (r.opcao >= 0 && r.opcao < 4) contagem[r.opcao]++;

  return {
    ...base(),
    pin: jogo.pin,
    podeTraduzir: traducao.traducaoDisponivel(),
    quizzes: armazem.listar(),
    jogadores: [...jogo.jogadores.values()].map((j) => ({ nome: j.nome, conectado: j.conectado })),
    responderam: dadas.size,
    contagem: jogo.fase === 'revelacao' || jogo.fase === 'placar' ? contagem : null,
    ranking: lista.slice(0, 10),
  };
}

function estadoJogador(token, lista = ranking(), posicoes = null) {
  const eu = jogo.jogadores.get(token);
  const dadas = jogo.respostas.get(jogo.q) || new Map();
  const minha = dadas.get(token);
  const posicao = posicoes ? (posicoes.get(token) || 0)
                           : lista.findIndex((r) => r.token === token) + 1;

  return {
    ...base(),
    curiosidade: '',                     // a curiosidade fica na tela grande
    nome: eu ? eu.nome : '',
    pontos: eu ? eu.pontos : 0,
    ganho: eu ? eu.ganho : 0,
    escolha: minha ? minha.opcao : null,
    serie: eu ? eu.serie : 0,
    posicao,
    jogadores: jogo.jogadores.size,
    podio: jogo.fase === 'fim' ? lista.slice(0, 3).map((r) => ({ nome: r.nome, pontos: r.pontos })) : null,
  };
}

/* ---------- transmissão ---------- */

let wss;

function transmitir() {
  if (!wss) return;
  clearTimeout(agendada);
  agendada = null;

  /* O ranking é o mesmo pra todo mundo: ordena uma vez por transmissão,
     não uma vez por jogador — senão o custo vira quadrático na sala cheia. */
  const lista = ranking();
  const posicoes = new Map(lista.map((r, i) => [r.token, i + 1]));
  const paraHost = JSON.stringify({ t: 'estado', ...estadoApresentador(lista) });

  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    if (ws.papel === 'host') ws.send(paraHost);
    else if (ws.token) {
      ws.send(JSON.stringify({ t: 'estado', ...estadoJogador(ws.token, lista, posicoes) }));
    }
  }
}

/* Rajada de respostas vira uma transmissão só: sem isso, 300 pessoas
   respondendo ao mesmo tempo geram 300 transmissões para 300 pessoas. */
let agendada = null;
function agendarTransmissao(atraso = 120) {
  if (agendada) return;
  agendada = setTimeout(transmitir, atraso);
}

/* ---------- biblioteca ---------- */

/** Normaliza e valida um quiz vindo do editor. PT obrigatório; EN opcional. */
function validarQuiz(bruto) {
  if (!bruto || typeof bruto !== 'object') return { erro: 'quiz' };
  const titulo = String(bruto.titulo || '').trim().slice(0, 60);
  if (!titulo) return { erro: 'titulo' };
  if (!Array.isArray(bruto.cartas) || !bruto.cartas.length) return { erro: 'cartas' };

  const cartas = [];
  for (const c of bruto.cartas) {
    const pt = (c && c.pt) || {};
    const enunciado = String(pt.enunciado || '').trim().slice(0, 300);
    const opcoes = (Array.isArray(pt.opcoes) ? pt.opcoes : [])
      .map((o) => String(o || '').trim().slice(0, 160));
    if (!enunciado || opcoes.length !== 4 || opcoes.some((o) => !o)) return { erro: 'pergunta' };

    const correta = Number(c.correta);
    if (!Number.isInteger(correta) || correta < 0 || correta > 3) return { erro: 'correta' };

    const nova = {
      segundos: Math.min(120, Math.max(5, Math.round(Number(c.segundos) || 20))),
      correta,
      pt: { enunciado, opcoes, curiosidade: String(pt.curiosidade || '').trim().slice(0, 500) },
    };

    for (const lang of ['en', 'es']) {
      const t = (c && c[lang]) || {};
      const enun = String(t.enunciado || '').trim().slice(0, 300);
      const ops = (Array.isArray(t.opcoes) ? t.opcoes : [])
        .map((o) => String(o || '').trim().slice(0, 160));
      if (enun && ops.length === 4 && ops.every(Boolean)) {
        nova[lang] = {
          enunciado: enun,
          opcoes: ops,
          curiosidade: String(t.curiosidade || '').trim().slice(0, 500),
        };
      }
    }
    cartas.push(nova);
  }

  const cores = Array.isArray(bruto.cores) && bruto.cores.length === 4 && bruto.cores.every(ehHex)
    ? bruto.cores.map((c) => c.toLowerCase())
    : CORES_PADRAO;

  return {
    quiz: {
      id: typeof bruto.id === 'string' && bruto.id ? bruto.id : undefined,
      titulo,
      emoji: String(bruto.emoji || '').trim().slice(0, 4) || '🎯',
      cores,
      cartas,
    },
  };
}

/* ---------- máquina de estados ---------- */

function abrirQuiz(id) {
  const quiz = armazem.pegar(id);
  if (!quiz) return;
  clearTimeout(jogo.relogio);
  jogo.baralho = quiz.cartas;
  jogo.quizId = quiz.id;
  jogo.quizTitulo = quiz.titulo;
  jogo.quizEmoji = quiz.emoji || '🎯';
  jogo.cores = Array.isArray(quiz.cores) && quiz.cores.length === 4 ? quiz.cores : CORES_PADRAO;
  jogo.fase = 'lobby';
  jogo.pin = novoPin();
  jogo.q = -1;
  jogo.abertaEm = 0;
  jogo.respostas.clear();
  for (const j of jogo.jogadores.values()) {
    j.pontos = 0;
    j.ganho = 0;
    j.serie = 0;
  }
  transmitir();
}

function irMenu() {
  clearTimeout(jogo.relogio);
  jogo.fase = 'menu';
  jogo.pin = '';
  jogo.baralho = [];
  jogo.quizId = null;
  jogo.quizTitulo = '';
  jogo.quizEmoji = '';
  jogo.cores = CORES_PADRAO;
  jogo.q = -1;
  jogo.respostas.clear();
  for (const j of jogo.jogadores.values()) {
    j.pontos = 0;
    j.ganho = 0;
    j.serie = 0;
  }
  transmitir();
}

function abrirPergunta(i) {
  if (i < 0 || i >= jogo.baralho.length) return encerrar();
  clearTimeout(jogo.relogio);
  jogo.q = i;
  jogo.fase = 'pergunta';
  jogo.abertaEm = Date.now();
  jogo.respostas.set(i, new Map());
  for (const j of jogo.jogadores.values()) j.ganho = 0;
  jogo.relogio = setTimeout(revelar, jogo.baralho[i].segundos * 1000);
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
      const bonus = Math.min(BONUS_SERIE_MAX, j.serie * BONUS_SERIE);   // serie anterior
      j.serie += 1;
      j.ganho = PONTOS_BASE + Math.round(PONTOS_RAPIDEZ * sobra) + bonus;
      j.pontos += j.ganho;
    } else {
      j.serie = 0;
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
  if (jogo.q + 1 >= jogo.baralho.length) return encerrar();
  abrirPergunta(jogo.q + 1);
}

function encerrar() {
  clearTimeout(jogo.relogio);
  jogo.fase = 'fim';
  transmitir();
}

function reiniciar() {
  if (!jogo.quizId) return irMenu();
  abrirQuiz(jogo.quizId);        // mesmo quiz, sala mantida, pontos zerados
}

function removerJogador(nome) {
  const alvo = [...jogo.jogadores.values()].find(
    (j) => j.nome.toLowerCase() === String(nome || '').toLowerCase(),
  );
  if (!alvo) return;
  jogo.jogadores.delete(alvo.token);
  for (const dadas of jogo.respostas.values()) dadas.delete(alvo.token);
  for (const ws of wss.clients) {
    if (ws.token === alvo.token) {
      ws.token = null;
      ws.papel = null;
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: 'erro', erro: 'desconhecido' }));
    }
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

  agendarTransmissao();
}

function entrar(nomeBruto, pinBruto) {
  if (!jogo.pin) return { erro: 'sem-sala' };
  if (String(pinBruto || '').trim() !== jogo.pin) return { erro: 'pin' };

  const nome = String(nomeBruto || '').trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!nome) return { erro: 'nome' };

  const repetido = [...jogo.jogadores.values()].some(
    (j) => j.conectado && j.nome.toLowerCase() === nome.toLowerCase(),
  );
  if (repetido) return { erro: 'repetido' };

  const token = randomUUID();
  jogo.jogadores.set(token, { token, nome, pontos: 0, ganho: 0, serie: 0, conectado: true });
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
      '<meta charset="utf-8"><body style="font:16px/1.5 system-ui;background:#07160f;color:#fff;padding:3rem">' +
        '<h1>Chave inválida</h1><p>O modo apresentador precisa de <code>?k=SUA_CHAVE</code>.</p></body>',
    );
  }
  res.type('html').send(htmlHost.replace('__CHAVE__', encodeURIComponent(CHAVE_HOST)));
});

app.get('/api/entrada', async (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const raiz = URL_PUBLICA || `${proto}://${req.get('host')}/`;
  const pin = String(req.query.pin || '').replace(/\D/g, '').slice(0, 6);
  const url = pin ? `${raiz}?pin=${pin}` : raiz;      // QR já entra com o PIN preenchido
  res.json({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 512 }) });
});

app.get('/api/saude', (req, res) => {
  res.json({
    ok: true,
    fase: jogo.fase,
    quiz: jogo.quizTitulo,
    pin: jogo.pin,
    jogadores: jogo.jogadores.size,
    quizzes: armazem.listar().length,
    traducao: traducao.traducaoDisponivel(),
  });
});

/* ---------- WebSocket ---------- */

const servidor = createServer(app);
wss = new WebSocketServer({ server: servidor, path: '/ws' });

wss.on('connection', (ws) => {
  ws.papel = null;
  ws.token = null;
  ws.vivo = true;
  ws.on('pong', () => { ws.vivo = true; });

  ws.on('message', async (bruto) => {
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
      if (m.t === 'abrirQuiz') abrirQuiz(m.id);
      else if (m.t === 'menu') irMenu();
      else if (m.t === 'comecar') { if (jogo.baralho.length) abrirPergunta(0); }
      else if (m.t === 'revelar') revelar();
      else if (m.t === 'placar') mostrarPlacar();
      else if (m.t === 'proxima') proxima();
      else if (m.t === 'encerrar') encerrar();
      else if (m.t === 'reiniciar') reiniciar();
      else if (m.t === 'remover') removerJogador(m.nome);
      else if (m.t === 'idioma' && IDIOMAS.includes(m.v)) {
        jogo.idioma = m.v;
        transmitir();
      } else if (m.t === 'pegarQuiz') {
        ws.send(JSON.stringify({ t: 'quiz', quiz: armazem.pegar(m.id) }));
      } else if (m.t === 'salvarQuiz') {
        const v = validarQuiz(m.quiz);
        if (v.erro) return ws.send(JSON.stringify({ t: 'erro', erro: 'invalido', campo: v.erro }));
        const salvo = await armazem.salvar(v.quiz);
        ws.send(JSON.stringify({ t: 'salvo', id: salvo.id }));
        transmitir();
      } else if (m.t === 'traduzir') {
        if (!traducao.traducaoDisponivel()) {
          return ws.send(JSON.stringify({ t: 'erro', erro: 'sem-traducao' }));
        }
        const v = validarQuiz({ titulo: 'rascunho', cartas: m.cartas });
        if (v.erro) return ws.send(JSON.stringify({ t: 'erro', erro: 'invalido', campo: v.erro }));
        try {
          const cartas = await traducao.traduzir(v.quiz.cartas, m.idioma);
          ws.send(JSON.stringify({ t: 'traduzido', idioma: m.idioma, cartas }));
        } catch (err) {
          ws.send(JSON.stringify({ t: 'erro', erro: 'traducao', detalhe: err.message }));
        }
      } else if (m.t === 'duplicarQuiz') {
        const orig = armazem.pegar(m.id);
        if (orig) {
          await armazem.salvar({
            titulo: (orig.titulo + ' (cópia)').slice(0, 60),
            emoji: orig.emoji,
            cartas: orig.cartas,
          });
          transmitir();
        }
      } else if (m.t === 'excluirQuiz') {
        if (m.id === jogo.quizId && jogo.fase !== 'menu') {
          return ws.send(JSON.stringify({ t: 'erro', erro: 'em-uso' }));
        }
        await armazem.excluir(m.id);
        transmitir();
      }
      return;
    }

    /* jogador */
    if (m.t === 'entrar') {
      const r = entrar(m.nome, m.pin);
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

const persistencia = await armazem.iniciar();
servidor.listen(PORTA, () => {
  console.log(
    `quiz no ar em http://localhost:${PORTA}  ·  apresentador em /host?k=${CHAVE_HOST}` +
      `  ·  quizzes: ${armazem.listar().length} (${persistencia})`,
  );
});

export { servidor, jogo };
