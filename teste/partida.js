/**
 * Teste de fumaça: sobe o servidor, conecta um apresentador e três jogadores,
 * joga duas rodadas inteiras e confere estado, pontuação e reconexão.
 *
 *   npm run teste
 */

import { spawn } from 'node:child_process';
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

/** Cliente de teste: guarda o último estado recebido e resolve esperas por condição. */
function cliente() {
  const c = {
    ws: new WebSocket(`ws://127.0.0.1:${PORTA}/ws`),
    estado: null,
    eu: null,
    erro: null,
    aguardando: [],
  };

  c.ws.on('message', (bruto) => {
    const m = JSON.parse(bruto);
    if (m.t === 'estado') c.estado = m;
    if (m.t === 'eu') c.eu = m;
    if (m.t === 'erro') c.erro = m.erro;
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

const servidor = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORTA), CHAVE_HOST: CHAVE },
  stdio: ['ignore', 'pipe', 'inherit'],
});
servidor.stdout.on('data', () => {});

try {
  await espera(700);

  console.log('\nHTTP');
  const saude = await (await fetch(`${BASE}/api/saude`)).json();
  conferir('/api/saude responde', saude.ok === true);
  conferir('baralho com 15 perguntas', saude.perguntas === 15, `veio ${saude.perguntas}`);

  const negado = await fetch(`${BASE}/host?k=errada`);
  conferir('/host recusa chave errada', negado.status === 401, `status ${negado.status}`);
  const aceito = await fetch(`${BASE}/host?k=${CHAVE}`);
  conferir('/host aceita a chave certa', aceito.status === 200);
  conferir('/host não vaza a chave no HTML', !(await aceito.text()).includes('__CHAVE__'));

  const entrada = await (await fetch(`${BASE}/api/entrada`)).json();
  conferir('QR gerado como data URL', entrada.qr.startsWith('data:image/png;base64,'));

  console.log('\nLobby');
  const host = cliente();
  await host.aberto();
  host.envia({ t: 'host', k: CHAVE });
  await host.ate((c) => c.estado, 'estado inicial do host');
  conferir('host começa no lobby', host.estado.fase === 'lobby');

  const intruso = cliente();
  await intruso.aberto();
  intruso.envia({ t: 'host', k: 'chute' });
  await intruso.ate((c) => c.erro, 'recusa do WebSocket');
  conferir('WebSocket recusa chave errada', intruso.erro === 'chave');
  intruso.ws.close();

  const nomes = ['Ana', 'Bento', 'Cida'];
  const jogadores = [];
  for (const nome of nomes) {
    const j = cliente();
    await j.aberto();
    j.envia({ t: 'entrar', nome });
    await j.ate((c) => c.eu, `entrada de ${nome}`);
    jogadores.push(j);
  }
  await host.ate((c) => c.estado.jogadores.length === 3, 'roster com 3');
  conferir('três jogadores no roster', host.estado.jogadores.length === 3);

  const clone = cliente();
  await clone.aberto();
  clone.envia({ t: 'entrar', nome: 'ana' });
  await clone.ate((c) => c.erro, 'recusa de nome repetido');
  conferir('nome repetido é recusado', clone.erro === 'repetido');
  clone.ws.close();

  console.log('\nRodada 1');
  host.envia({ t: 'comecar' });
  await host.ate((c) => c.estado.fase === 'pergunta', 'abertura da pergunta');
  conferir('pergunta 1 aberta', host.estado.q === 0);
  conferir('quatro alternativas', host.estado.opcoes.length === 4);
  conferir('resposta certa fica escondida', host.estado.correta === null);
  conferir('jogador não recebe a curiosidade', jogadores[0].estado.curiosidade === '');

  jogadores[0].envia({ t: 'responder', q: 0, opcao: 1 });   // correta da carta 1 (origem pagã)
  await espera(120);
  jogadores[1].envia({ t: 'responder', q: 0, opcao: 1 });
  await espera(120);
  jogadores[2].envia({ t: 'responder', q: 0, opcao: 0 });   // errada

  await host.ate((c) => c.estado.fase === 'revelacao', 'revelação automática');
  conferir('revela sozinho quando todos respondem', host.estado.fase === 'revelacao');
  conferir('revelação traz a correta', host.estado.correta === 1);
  conferir('contagem por alternativa confere', host.estado.contagem[1] === 2 && host.estado.contagem[0] === 1,
           JSON.stringify(host.estado.contagem));

  for (const j of jogadores) await j.ate((cl) => cl.estado.fase === 'revelacao', 'revelação no jogador');
  const [a, b, c3] = jogadores.map((j) => j.estado);
  conferir('quem acertou pontuou', a.pontos > 0 && b.pontos > 0);
  conferir('quem errou não pontuou', c3.pontos === 0, `fez ${c3.pontos}`);
  conferir('quem respondeu antes fez mais pontos', a.pontos > b.pontos, `${a.pontos} vs ${b.pontos}`);
  conferir('jogador vê sua posição', a.posicao === 1);

  console.log('\nSegunda resposta e placar');
  jogadores[0].envia({ t: 'responder', q: 0, opcao: 1 });   // fora de fase, deve ser ignorada
  await espera(150);
  conferir('resposta depois da revelação é ignorada', jogadores[0].estado.pontos === a.pontos);

  host.envia({ t: 'placar' });
  await host.ate((cl) => cl.estado.fase === 'placar', 'placar');
  conferir('ranking ordenado', host.estado.ranking[0].pontos >= host.estado.ranking[1].pontos);
  conferir('líder é quem respondeu primeiro', host.estado.ranking[0].nome === 'Ana');

  console.log('\nIdioma e reconexão');
  host.envia({ t: 'idioma', v: 'en' });
  await host.ate((cl) => cl.estado.idioma === 'en', 'troca de idioma');
  conferir('idioma trocou para o host', host.estado.idioma === 'en');
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

  console.log('\nRodada 2 e encerramento');
  host.envia({ t: 'proxima' });
  await host.ate((cl) => cl.estado.fase === 'pergunta' && cl.estado.q === 1, 'pergunta 2');
  conferir('avança para a pergunta 2', host.estado.q === 1);
  conferir('enunciado veio em inglês', /related to/.test(host.estado.enunciado), host.estado.enunciado);

  jogadores[2].envia({ t: 'responder', q: 1, opcao: 1 });   // correta da carta 2 (mês de junho)
  await espera(120);
  host.envia({ t: 'revelar' });
  await host.ate((cl) => cl.estado.fase === 'revelacao', 'revelação manual');
  conferir('revelação manual funciona', host.estado.correta === 1);
  conferir('quem não respondeu não pontuou', jogadores[0].estado.ganho === 0);

  host.envia({ t: 'encerrar' });
  await host.ate((cl) => cl.estado.fase === 'fim', 'fim');
  conferir('encerra a partida', host.estado.fase === 'fim');
  await jogadores[0].ate((cl) => cl.estado.fase === 'fim', 'fim no jogador');
  conferir('jogador recebe o pódio', Array.isArray(jogadores[0].estado.podio));

  host.envia({ t: 'reiniciar' });
  await host.ate((cl) => cl.estado.fase === 'lobby', 'reinício');
  conferir('reiniciar volta ao lobby', host.estado.fase === 'lobby');
  conferir('reiniciar zera a pontuação', host.estado.ranking.every((r) => r.pontos === 0));
  conferir('reiniciar mantém quem está na sala', host.estado.jogadores.length === 3);

  console.log('\nRemoção pelo apresentador');
  host.envia({ t: 'remover', nome: 'cida' });                // caixa não importa
  await host.ate((cl) => cl.estado.jogadores.length === 2, 'sala com 2');
  conferir('apresentador remove jogador pelo nome', host.estado.jogadores.length === 2);
  conferir('removido some do ranking', host.estado.ranking.every((r) => r.nome !== 'Cida'));
  await jogadores[2].ate((cl) => cl.erro === 'desconhecido', 'aviso ao removido');
  conferir('removido é avisado e volta pra entrada', jogadores[2].erro === 'desconhecido');
  jogadores[2].envia({ t: 'remover', nome: 'Ana' });         // jogador não pode remover
  await espera(200);
  conferir('jogador não consegue remover ninguém', host.estado.jogadores.length === 2);

  console.log('\nComandos de jogador não movem a partida');
  jogadores[0].envia({ t: 'comecar' });
  await espera(200);
  conferir('jogador não consegue começar a partida', host.estado.fase === 'lobby');

  for (const j of [host, ...jogadores]) j.ws.close();
} catch (err) {
  falhas++;
  console.log(`\nERRO: ${err.message}`);
} finally {
  servidor.kill();
}

console.log(falhas === 0 ? '\nTudo verde.\n' : `\n${falhas} verificação(ões) falharam.\n`);
process.exit(falhas === 0 ? 0 : 1);
