/**
 * Quiz do Skee: Festas Juninas pelo mundo — servidor
 * Google Apps Script · web app
 *
 * Sala única, baralho fixo. Quem abre o link normal só joga.
 * Quem abre com ?k=CHAVE_HOST apresenta.
 */

const CHAVE_HOST  = 'arraia';   // troque se quiser um link de apresentador menos óbvio
const SALA        = 'ARRAIA';
const TTL         = 21600;      // 6 horas, o teto do CacheService
const PLANILHA_ID = '';         // opcional: ID de uma planilha para gravar o resultado final

const cache   = () => CacheService.getScriptCache();
const kGame   = ()        => 'g:' + SALA;
const kRoster = (s)       => 'r:' + SALA + ':' + s;
const kAns    = (s, q, p) => 'a:' + SALA + ':' + s + ':' + q + ':' + p;

/* ---------- entrega da pagina ---------- */
function doGet(e) {
  const chave = (e && e.parameter && e.parameter.k) || '';
  const t = HtmlService.createTemplateFromFile('Index');
  t.modo = (chave === CHAVE_HOST) ? 'host' : 'jogador';
  return t.evaluate()
    .setTitle('Quiz do Skee: Festas Juninas pelo mundo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Nome de quem abriu, quando o app roda dentro do dominio. Vazio se o acesso for publico. */
function meuNome() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return '';
    return email.split('@')[0]
      .replace(/[._\-]+/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); })
      .slice(0, 18);
  } catch (err) {
    return '';
  }
}

/** URL publica do app, usada para gerar o QR code. */
function srvUrlJogador() {
  try { return ScriptApp.getService().getUrl(); } catch (err) { return ''; }
}

/* ---------- apresentador ---------- */
function srvAbrir(sid, estadoJson) {
  cache().remove(kRoster(sid));
  cache().put(kGame(), estadoJson, TTL);
  return 'ok';
}

function srvPublicar(estadoJson) {
  cache().put(kGame(), estadoJson, TTL);
  return 'ok';
}

function srvRoster(sid) {
  return cache().get(kRoster(sid)) || '[]';
}

/** Todas as respostas de uma pergunta numa unica chamada. */
function srvRespostas(sid, q) {
  const lista = JSON.parse(cache().get(kRoster(sid)) || '[]');
  if (!lista.length) return '[]';

  const chaves = lista.map(function (p) { return kAns(sid, q, p.pid); });
  const achado = cache().getAll(chaves);
  const saida = [];

  lista.forEach(function (p) {
    const bruto = achado[kAns(sid, q, p.pid)];
    if (!bruto) return;
    const parte = bruto.split('|');
    saida.push({ pid: p.pid, nome: p.nome, e: Number(parte[0]), ms: Number(parte[1]) });
  });
  return JSON.stringify(saida);
}

/* ---------- jogador ---------- */
function srvEntrar(nome) {
  const bruto = cache().get(kGame());
  if (!bruto) return JSON.stringify({ erro: 'sala' });

  const jogo = JSON.parse(bruto);
  const limpo = String(nome || '').trim().slice(0, 18);
  if (!limpo) return JSON.stringify({ erro: 'nome' });

  const pid = limpo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 24)
              || 'convidado';

  const trava = LockService.getScriptLock();
  try {
    trava.waitLock(10000);
  } catch (err) {
    return JSON.stringify({ erro: 'ocupado' });
  }

  try {
    const rk = kRoster(jogo.sid);
    const lista = JSON.parse(cache().get(rk) || '[]');
    const existe = lista.some(function (x) { return x.pid === pid; });
    if (!existe) lista.push({ pid: pid, nome: limpo });
    cache().put(rk, JSON.stringify(lista), TTL);
    return JSON.stringify({ sid: jogo.sid, pid: pid, nome: limpo });
  } finally {
    trava.releaseLock();
  }
}

function srvEstado() {
  return cache().get(kGame()) || '';
}

function srvResponder(sid, q, escolha, ms, pid) {
  cache().put(kAns(sid, q, pid), escolha + '|' + ms, TTL);
  return 'ok';
}

/* ---------- registro opcional em planilha ---------- */
function srvSalvarResultado(lbJson) {
  if (!PLANILHA_ID) return 'sem planilha';
  try {
    const aba = SpreadsheetApp.openById(PLANILHA_ID).getSheets()[0];
    if (aba.getLastRow() === 0) aba.appendRow(['Data', 'Posicao', 'Nome', 'Pontos']);
    const quando = new Date();
    JSON.parse(lbJson).forEach(function (r, i) { aba.appendRow([quando, i + 1, r.n, r.s]); });
    return 'ok';
  } catch (err) {
    return 'erro: ' + err.message;
  }
}
