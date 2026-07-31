/**
 * Teste de fumaça: sobe o servidor, exercita a biblioteca de quizzes
 * (criar, editar, excluir), joga uma partida inteira com três jogadores
 * e confere estado, pontuação, reconexão e remoção.
 *
 *   npm run teste
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as espera } from 'node:timers/promises';
import { WebSocket } from 'ws';

const PORTA = 4321;
const BASE = `http://127.0.0.1:${PORTA}`;
const CHAVE = 'teste-arraia';

let falhas = 0;
function conferir(descricao, condicao, detalhe = '') {
  if (condicao) {
    console.log(`  ok   ${descricao}`);
  } else {
    falhas++;
    console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** Cliente de teste: guarda o que chegou e resolve esperas por condição. */
function cliente() {
  const c = {
    ws: new WebSocket(`ws://127.0.0.1:${PORTA}/ws`),
    estado: null,
    eu: null,
    erro: null,
    erroCampo: null,
    salvoId: null,
    quizCheio: null,
    aguardando: [],
  };

  c.ws.on('message', (bruto) => {
    const m = JSON.parse(bruto);
    if (m.t === 'estado') c.estado = m;
    if (m.t === 'eu') c.eu = m;
    if (m.t === 'erro') { c.erro = m.erro; c.erroCampo = m.campo || null; }
    if (m.t === 'salvo') c.salvoId = m.id;
    if (m.t === 'quiz') c.quizCheio = m.quiz;
    c.aguardando = c.aguardando.filter(({ teste, ok }) => (teste(c) ? (ok(), false) : true));
  });

  c.envia = (m) => c.ws.send(JSON.stringify(m));
  c.aberto = () => new Promise((ok) => c.ws.once('open', ok));
  c.ate = (teste, rotulo = 'condição') =>
    new Promise((ok, falha) => {
      if (teste(c)) return ok();
      const t = setTimeout(() => falha(new Error(`timeout esperando ${rotulo}`)), 5000);
      c.aguardando.push({ teste, ok: () => { clearTimeout(t); ok(); } });
    });

  return c;
}

const QUIZ_TESTE = {
  titulo: 'Teste do Skee',
  emoji: '🧪',
  cores: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
  cartas: [
    {
      segundos: 20,
      correta: 2,
      pt: { enunciado: 'Primeira pergunta?', opcoes: ['a', 'b', 'c', 'd'], curiosidade: 'Pois é.' },
    },
    {
      segundos: 20,
      correta: 1,
      pt: { enunciado: 'Segunda pergunta?', opcoes: ['a', 'b', 'c', 'd'] },
      en: { enunciado: 'June test question two?', opcoes: ['a', 'b', 'c', 'd'] },
      es: { enunciado: '¿Segunda pregunta?', opcoes: ['a', 'b', 'c', 'd'] },
    },
  ],
};

let PIN = '';

const servidor = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(PORTA),
    CHAVE_HOST: CHAVE,
    DADOS_DIR: join(tmpdir(), 'quiz-teste-' + Date.now()),   // biblioteca zerada por rodada
    DATABASE_URL: '',
    ANTHROPIC_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});
servidor.stdout.on('data', () => {});

try {
  await espera(800);

  console.log('\nHTTP');
  const saude = await (await fetch(`${BASE}/api/saude`)).json();
  conferir('/api/saude responde', saude.ok === true);
  conferir('começa no menu', saude.fase === 'menu', `veio ${saude.fase}`);
  conferir('semente na biblioteca', saude.quizzes === 1, `veio ${saude.quizzes}`);
  conferir('sem PIN antes de abrir quiz', saude.pin === '', saude.pin);

  const negado = await fetch(`${BASE}/host?k=errada`);
  conferir('/host recusa chave errada', negado.status === 401, `status ${negado.status}`);
  const aceito = await fetch(`${BASE}/host?k=${CHAVE}`);
  conferir('/host aceita a chave certa', aceito.status === 200);
  conferir('/host não vaza a chave no HTML', !(await aceito.text()).includes('__CHAVE__'));

  const entrada = await (await fetch(`${BASE}/api/entrada`)).json();
  conferir('QR gerado como data URL', entrada.qr.startsWith('data:image/png;base64,'));

  console.log('\nBiblioteca');
  const host = cliente();
  await host.aberto();
  host.envia({ t: 'host', k: CHAVE });
  await host.ate((c) => c.estado, 'estado inicial do host');
  conferir('host começa no menu', host.estado.fase === 'menu');
  conferir('menu lista a semente com 15 perguntas',
           host.estado.quizzes.length === 1 && host.estado.quizzes[0].n === 15,
           JSON.stringify(host.estado.quizzes));

  host.envia({ t: 'salvarQuiz', quiz: { titulo: 'Quebrado', cartas: [{ correta: 0, pt: { enunciado: '', opcoes: ['a', 'b', 'c', 'd'] } }] } });
  await host.ate((c) => c.erro === 'invalido', 'recusa de quiz inválido');
  conferir('quiz sem enunciado é recusado', host.erroCampo === 'pergunta', host.erroCampo);
  host.erro = null;

  host.envia({ t: 'salvarQuiz', quiz: QUIZ_TESTE });
  await host.ate((c) => c.salvoId, 'salvamento');
  await host.ate((c) => c.estado.quizzes.length === 2, 'biblioteca com 2');
  conferir('quiz novo entra na biblioteca', host.estado.quizzes.some((q) => q.titulo === 'Teste do Skee'));

  const idTeste = host.salvoId;
  host.envia({ t: 'pegarQuiz', id: idTeste });
  await host.ate((c) => c.quizCheio, 'quiz completo pra edição');
  conferir('pegarQuiz devolve as cartas', host.quizCheio.cartas.length === 2);
  conferir('EN opcional preservado', !!host.quizCheio.cartas[1].en && !host.quizCheio.cartas[0].en);
  conferir('ES opcional preservado', !!host.quizCheio.cartas[1].es && !host.quizCheio.cartas[0].es);
  conferir('paleta personalizada preservada',
           JSON.stringify(host.quizCheio.cores) === JSON.stringify(['#ff0000', '#00ff00', '#0000ff', '#ffff00']),
           JSON.stringify(host.quizCheio.cores));

  host.envia({ t: 'salvarQuiz', quiz: { ...QUIZ_TESTE, titulo: 'Cor ruim', cores: ['nao-e-cor', '#fff', 'x', 'y'] } });
  await host.ate((c) => c.estado.quizzes.some((q) => q.titulo === 'Cor ruim'), 'quiz com cor inválida');
  const idCorRuim = host.salvoId;
  host.quizCheio = null;
  host.envia({ t: 'pegarQuiz', id: idCorRuim });
  await host.ate((c) => c.quizCheio, 'quiz de cor inválida');
  conferir('cor inválida cai no padrão pastel', host.quizCheio.cores[0] === '#fbcfdd', host.quizCheio.cores[0]);
  host.envia({ t: 'excluirQuiz', id: idCorRuim });
  await host.ate((c) => c.estado.quizzes.every((q) => q.id !== idCorRuim), 'limpeza');
  host.quizCheio = null;
  host.envia({ t: 'pegarQuiz', id: idTeste });
  await host.ate((c) => c.quizCheio, 'quiz de volta');

  host.envia({ t: 'salvarQuiz', quiz: { ...host.quizCheio, titulo: 'Teste do Skee v2' } });
  await host.ate((c) => c.estado.quizzes.some((q) => q.titulo === 'Teste do Skee v2'), 'edição salva');
  conferir('editar não duplica', host.estado.quizzes.length === 2, `veio ${host.estado.quizzes.length}`);

  console.log('\nEntrada exige sala aberta');
  const cedo = cliente();
  await cedo.aberto();
  cedo.envia({ t: 'entrar', nome: 'Cedo', pin: '000000' });
  await cedo.ate((c) => c.erro, 'recusa sem sala aberta');
  conferir('sem sala aberta ninguém entra', cedo.erro === 'sem-sala', cedo.erro);
  cedo.ws.close();

  console.log('\nLobby e PIN');
  host.envia({ t: 'abrirQuiz', id: idTeste });
  await host.ate((c) => c.estado.fase === 'lobby', 'lobby');
  conferir('abre o quiz escolhido', host.estado.quiz === 'Teste do Skee v2');
  conferir('paleta do quiz vai pro estado',
           JSON.stringify(host.estado.cores) === JSON.stringify(['#ff0000', '#00ff00', '#0000ff', '#ffff00']),
           JSON.stringify(host.estado.cores));
  PIN = host.estado.pin;
  conferir('PIN de 6 dígitos gerado', /^\d{6}$/.test(PIN), PIN);

  const entradaPin = await (await fetch(`${BASE}/api/entrada?pin=${PIN}`)).json();
  conferir('QR leva o PIN na URL', entradaPin.url.includes('pin=' + PIN), entradaPin.url);

  const errado = cliente();
  await errado.aberto();
  errado.envia({ t: 'entrar', nome: 'Chutador', pin: '999999' });
  await errado.ate((c) => c.erro, 'recusa de PIN errado');
  conferir('PIN errado é recusado', errado.erro === 'pin', errado.erro);
  errado.ws.close();

  const jogadores = [];
  for (const nome of ['Ana', 'Bento', 'Cida']) {
    const j = cliente();
    await j.aberto();
    j.envia({ t: 'entrar', nome, pin: PIN });
    await j.ate((c) => c.eu, `entrada de ${nome}`);
    jogadores.push(j);
  }
  await host.ate((c) => c.estado.jogadores.length === 3, 'roster com 3');
  conferir('três jogadores no roster', host.estado.jogadores.length === 3);

  const clone = cliente();
  await clone.aberto();
  clone.envia({ t: 'entrar', nome: 'ana', pin: PIN });
  await clone.ate((c) => c.erro, 'recusa de nome repetido');
  conferir('nome repetido é recusado', clone.erro === 'repetido');
  clone.ws.close();

  console.log('\nRodada 1');
  host.envia({ t: 'comecar' });
  await host.ate((c) => c.estado.fase === 'pergunta', 'abertura da pergunta');
  conferir('pergunta 1 aberta', host.estado.q === 0 && host.estado.total === 2);
  conferir('resposta certa fica escondida', host.estado.correta === null);
  conferir('jogador não recebe a curiosidade', jogadores[0].estado.curiosidade === '');

  jogadores[0].envia({ t: 'responder', q: 0, opcao: 2 });   // correta
  await espera(120);
  jogadores[1].envia({ t: 'responder', q: 0, opcao: 2 });   // correta, mais lento
  await espera(120);
  jogadores[2].envia({ t: 'responder', q: 0, opcao: 0 });   // errada

  await host.ate((c) => c.estado.fase === 'revelacao', 'revelação automática');
  conferir('revela sozinho quando todos respondem', host.estado.fase === 'revelacao');
  for (const j of jogadores) await j.ate((cl) => cl.estado.fase === 'revelacao', 'revelação nos jogadores');
  conferir('contagem por alternativa confere',
           host.estado.contagem[2] === 2 && host.estado.contagem[0] === 1,
           JSON.stringify(host.estado.contagem));
  conferir('curiosidade aparece na tela grande', host.estado.curiosidade === 'Pois é.');

  const [a, b, c3] = jogadores.map((j) => j.estado);
  conferir('quem acertou pontuou', a.pontos > 0 && b.pontos > 0);
  conferir('quem errou não pontuou', c3.pontos === 0, `fez ${c3.pontos}`);
  conferir('quem respondeu antes fez mais pontos', a.pontos > b.pontos, `${a.pontos} vs ${b.pontos}`);
  conferir('jogador vê sua posição', a.posicao === 1);
  conferir('acerto abre sequência', a.serie === 1, `serie ${a.serie}`);
  conferir('erro zera a sequência', c3.serie === 0, `serie ${c3.serie}`);
  conferir('primeiro acerto ainda não tem bônus de série', a.ganho <= 1000, `ganho ${a.ganho}`);

  jogadores[0].envia({ t: 'responder', q: 0, opcao: 1 });   // fora de fase, ignorada
  await espera(150);
  conferir('resposta depois da revelação é ignorada', jogadores[0].estado.pontos === a.pontos);

  host.envia({ t: 'placar' });
  await host.ate((cl) => cl.estado.fase === 'placar', 'placar');
  conferir('ranking ordenado', host.estado.ranking[0].pontos >= host.estado.ranking[1].pontos);
  conferir('líder é quem respondeu primeiro', host.estado.ranking[0].nome === 'Ana');

  console.log('\nIdioma e reconexão');
  host.envia({ t: 'idioma', v: 'en' });
  await host.ate((cl) => cl.estado.idioma === 'en', 'troca de idioma');
  await jogadores[0].ate((cl) => cl.estado.idioma === 'en', 'idioma no jogador');
  conferir('idioma trocou para o jogador', jogadores[0].estado.idioma === 'en');

  const token = jogadores[2].eu.token;
  const pontosAntes = jogadores[2].estado.pontos;
  jogadores[2].ws.close();
  await espera(200);
  const voltou = cliente();
  await voltou.aberto();
  voltou.envia({ t: 'voltar', token });
  await voltou.ate((cl) => cl.eu, 'reconexão');
  conferir('reconecta com o mesmo nome', voltou.eu.nome === 'Cida');
  await voltou.ate((cl) => cl.estado, 'estado após reconectar');
  conferir('mantém a pontuação ao reconectar', voltou.estado.pontos === pontosAntes);
  jogadores[2] = voltou;

  console.log('\nRodada 2, inglês com fallback e fim');
  host.envia({ t: 'proxima' });
  await host.ate((cl) => cl.estado.fase === 'pergunta' && cl.estado.q === 1, 'pergunta 2');
  conferir('pergunta 2 vem em inglês', host.estado.enunciado === 'June test question two?',
           host.estado.enunciado);

  host.envia({ t: 'idioma', v: 'es' });
  await host.ate((cl) => cl.estado.idioma === 'es', 'espanhol');
  conferir('pergunta 2 vem em espanhol', host.estado.enunciado === '¿Segunda pregunta?',
           host.estado.enunciado);
  await jogadores[0].ate((cl) => cl.estado.idioma === 'es', 'espanhol no jogador');
  conferir('espanhol chega no jogador', jogadores[0].estado.idioma === 'es');

  jogadores[0].envia({ t: 'responder', q: 1, opcao: 1 });   // Ana acerta de novo
  await espera(120);
  jogadores[2].envia({ t: 'responder', q: 1, opcao: 1 });   // correta
  await espera(120);
  host.envia({ t: 'revelar' });
  await host.ate((cl) => cl.estado.fase === 'revelacao', 'revelação manual');
  conferir('revelação manual funciona', host.estado.correta === 1);
  conferir('quem não respondeu não pontuou', jogadores[1].estado.ganho === 0);
  await jogadores[0].ate((cl) => cl.estado.fase === 'revelacao', 'revelação na Ana');
  conferir('sequência cresce no acerto seguido', jogadores[0].estado.serie === 2,
           `serie ${jogadores[0].estado.serie}`);
  conferir('bônus de série entra no ganho', jogadores[0].estado.ganho > 1000 - 500,
           `ganho ${jogadores[0].estado.ganho}`);

  host.envia({ t: 'encerrar' });
  await host.ate((cl) => cl.estado.fase === 'fim', 'fim');
  await jogadores[0].ate((cl) => cl.estado.fase === 'fim', 'fim no jogador');
  conferir('jogador recebe o pódio', Array.isArray(jogadores[0].estado.podio));

  console.log('\nJogar de novo e voltar ao menu');
  host.envia({ t: 'reiniciar' });
  await host.ate((cl) => cl.estado.fase === 'lobby', 'jogar de novo');
  conferir('jogar de novo mantém o quiz', host.estado.quiz === 'Teste do Skee v2');
  conferir('jogar de novo zera a pontuação', host.estado.ranking.every((r) => r.pontos === 0));
  conferir('jogar de novo mantém a sala', host.estado.jogadores.length === 3);
  conferir('jogar de novo gera PIN novo', /^\d{6}$/.test(host.estado.pin));
  await jogadores[0].ate((cl) => cl.estado.serie === 0, 'série zerada');
  conferir('jogar de novo zera a sequência', jogadores[0].estado.serie === 0);

  host.erro = null;
  host.envia({ t: 'excluirQuiz', id: idTeste });
  await host.ate((cl) => cl.erro === 'em-uso', 'bloqueio de exclusão');
  conferir('não exclui quiz em jogo', host.erro === 'em-uso');

  host.envia({ t: 'menu' });
  await host.ate((cl) => cl.estado.fase === 'menu', 'menu');
  conferir('menu limpa o quiz ativo', host.estado.quiz === '' && host.estado.total === 0);
  conferir('menu limpa o PIN', host.estado.pin === '', host.estado.pin);
  await jogadores[0].ate((cl) => cl.estado.fase === 'menu', 'menu no jogador');
  conferir('jogador volta pra espera do menu', jogadores[0].estado.fase === 'menu');

  host.envia({ t: 'duplicarQuiz', id: idTeste });
  await host.ate((cl) => cl.estado.quizzes.length === 3, 'duplicação');
  conferir('duplicar cria cópia com titulo marcado',
           host.estado.quizzes.some((q) => q.titulo === 'Teste do Skee v2 (cópia)'),
           JSON.stringify(host.estado.quizzes.map((q) => q.titulo)));

  host.envia({ t: 'excluirQuiz', id: idTeste });
  await host.ate((cl) => cl.estado.quizzes.length === 2, 'exclusão');
  conferir('exclui do menu', host.estado.quizzes.every((q) => q.id !== idTeste));

  console.log('\nTradução automática');
  const saudeT = await (await fetch(`${BASE}/api/saude`)).json();
  conferir('saúde informa estado da tradução', saudeT.traducao === false, String(saudeT.traducao));
  conferir('host sabe que a tradução está desligada', host.estado.podeTraduzir === false);
  host.erro = null;
  host.envia({ t: 'traduzir', idioma: 'es', cartas: QUIZ_TESTE.cartas });
  await host.ate((cl) => cl.erro === 'sem-traducao', 'aviso de tradução desligada');
  conferir('traduzir sem chave avisa em vez de quebrar', host.erro === 'sem-traducao');

  console.log('\nRemoção pelo apresentador');
  host.envia({ t: 'remover', nome: 'cida' });                // caixa não importa
  await host.ate((cl) => cl.estado.jogadores.length === 2, 'sala com 2');
  conferir('apresentador remove jogador pelo nome', host.estado.jogadores.length === 2);
  await jogadores[2].ate((cl) => cl.erro === 'desconhecido', 'aviso ao removido');
  conferir('removido é avisado e volta pra entrada', jogadores[2].erro === 'desconhecido');
  jogadores[2].envia({ t: 'remover', nome: 'Ana' });         // jogador não pode remover
  await espera(200);
  conferir('jogador não consegue remover ninguém', host.estado.jogadores.length === 2);

  console.log('\nComandos de jogador não movem a partida');
  jogadores[0].envia({ t: 'comecar' });
  jogadores[0].envia({ t: 'abrirQuiz', id: host.estado.quizzes[0].id });
  await espera(200);
  conferir('jogador não abre quiz nem começa partida', host.estado.fase === 'menu');

  for (const j of [host, ...jogadores]) j.ws.close();
} catch (err) {
  falhas++;
  console.log(`\nERRO: ${err.message}`);
} finally {
  servidor.kill();
}

console.log(falhas === 0 ? '\nTudo verde.\n' : `\n${falhas} verificação(ões) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
