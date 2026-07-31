/* Tela do apresentador: central de quizzes, editor, condução e pódio. */

const FORMAS = ['▲', '◆', '●', '■'];

const T = {
  pt: {
    aponte: 'Ou aponte a câmera do celular',
    rotPin: 'PIN da sala',
    duplicar: 'Duplicar',
    copiaDe: (t) => `Duplicar "${t}"?`,
    quem: 'Quem já chegou',
    vazio: 'Ninguém ainda. Mostre o PIN e o QR na tela grande.',
    dicaRemover: 'Clique num nome pra tirar a pessoa da sala.',
    confirmaRemover: (n) => `Tirar ${n} da sala?`,
    pergunta: (i, t) => `Pergunta ${i} de ${t}`,
    responderam: (n, tot) => `${n} de ${tot} já responderam`,
    parcial: 'Placar parcial',
    lideres: 'Quem está na frente',
    fim: 'Fim de jogo!',
    comecar: 'Começar',
    revelar: 'Revelar resposta',
    placar: 'Ver placar',
    proxima: 'Próxima pergunta',
    encerrar: 'Encerrar e premiar',
    jogarDeNovo: 'Jogar de novo',
    menu: 'Menu',
    naSala: (n) => `${n} na sala`,
    confirmaMenu: 'Voltar ao menu? A partida atual é encerrada.',
    caiu: 'Conexão caiu. Reconectando…',
  },
  en: {
    aponte: 'Or point your phone camera',
    rotPin: 'Room PIN',
    duplicar: 'Duplicate',
    copiaDe: (t) => `Duplicate "${t}"?`,
    quem: 'Already here',
    vazio: 'Nobody yet. Show the PIN and QR on the big screen.',
    dicaRemover: 'Click a name to remove that person.',
    confirmaRemover: (n) => `Remove ${n} from the room?`,
    pergunta: (i, t) => `Question ${i} of ${t}`,
    responderam: (n, tot) => `${n} of ${tot} have answered`,
    parcial: 'Standings',
    lideres: 'Who is ahead',
    fim: "That's a wrap!",
    comecar: 'Start',
    revelar: 'Reveal answer',
    placar: 'Show standings',
    proxima: 'Next question',
    encerrar: 'Finish and crown',
    jogarDeNovo: 'Play again',
    menu: 'Menu',
    naSala: (n) => `${n} in the room`,
    confirmaMenu: 'Back to the menu? The current game ends.',
    caiu: 'Connection dropped. Reconnecting…',
  },
};

const $ = (id) => document.getElementById(id);
const telas = ['menu', 'editor', 'lobby', 'jogo', 'placar', 'fim'];

let ws = null;
let idioma = 'pt';
let ultimaQ = -1;
let visao = null;              // null = segue a fase do servidor; 'editor' = tela local
let ultimoEstado = null;
let festaMontada = false;
let timersFesta = [];
let radioSeq = 0;
const confete = Confete($('confete'));

function mostrar(qual) {
  telas.forEach((t) => $('tela-' + t).classList.toggle('ativa', t === qual));
  $('barra-controle').classList.toggle('escondida', qual === 'menu' || qual === 'editor');
}

const enviar = (m) => ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

/* QR e URL de entrada */
let urlBase = '';
let qrDoPin = '';

function carregarEntrada(pin) {
  const alvo = '/api/entrada' + (pin ? '?pin=' + encodeURIComponent(pin) : '');
  fetch(alvo)
    .then((r) => r.json())
    .then(({ url, qr }) => {
      urlBase = url;
      qrDoPin = pin || '';
      $('qr').src = qr;
      $('url').textContent = url.replace(/^https?:\/\//, '');
    })
    .catch(() => { $('url').textContent = location.origin; });
}
carregarEntrada('');

function conectar() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onopen = () => enviar({ t: 'host', k: window.CHAVE });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'estado') pintar(m);
    else if (m.t === 'quiz' && m.quiz) abrirEditor(m.quiz);
    else if (m.t === 'salvo') fecharEditor();
    else if (m.t === 'erro' && m.erro === 'invalido') {
      $('ed-erro').textContent = {
        titulo: 'Dê um título ao quiz.',
        cartas: 'Inclua pelo menos uma pergunta.',
        pergunta: 'Toda pergunta precisa de enunciado e 4 alternativas preenchidas.',
        correta: 'Marque a alternativa correta em todas as perguntas.',
      }[m.campo] || 'Não deu pra salvar. Revise o quiz.';
    } else if (m.t === 'erro' && m.erro === 'em-uso') {
      alert('Esse quiz está em jogo agora. Volte ao menu antes de excluir.');
    }
  };
  ws.onclose = () => {
    $('situacao').textContent = T[idioma].caiu;
    setTimeout(conectar, 1500);
  };
}

/* ---------- pintura por fase ---------- */

function pintar(e) {
  ultimoEstado = e;
  idioma = e.idioma;
  const t = T[idioma];
  if (e.fase !== 'fim') desmontarFesta();
  if (visao === 'editor') return;          // não sai do editor no meio da digitação

  document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : 'en';
  $('bt-pt').classList.toggle('on', idioma === 'pt');
  $('bt-en').classList.toggle('on', idioma === 'en');
  $('h-aponte').textContent = t.aponte;
  $('h-parcial').textContent = t.parcial;
  $('h-lideres').textContent = t.lideres;
  $('h-fim').textContent = t.fim;
  $('bt-menu').textContent = t.menu;
  $('situacao').textContent = t.naSala(e.jogadores.length);

  const principal = $('bt-principal');
  principal.disabled = false;

  if (e.pin !== qrDoPin) carregarEntrada(e.pin);
  document.body.classList.toggle('festa', e.fase !== 'menu');

  if (e.fase === 'menu') {
    pintarMenu(e);
    return mostrar('menu');
  }

  if (e.fase === 'lobby') {
    $('h-titulo').textContent = `${e.emoji || ''} ${e.quiz}`.trim();
    $('h-rotpin').textContent = t.rotPin;
    $('pin-grande').textContent = e.pin || '——————';
    $('h-quem').firstChild.textContent = t.quem + ' ';
    $('n-jogadores').textContent = e.jogadores.length ? `(${e.jogadores.length})` : '';
    $('h-vazio').textContent = e.jogadores.length ? t.dicaRemover : t.vazio;
    const caixa = $('fichas');
    caixa.innerHTML = '';
    e.jogadores.forEach((j) => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'ficha' + (j.conectado ? '' : ' fora');
      s.textContent = j.nome;
      s.title = t.confirmaRemover(j.nome);
      s.onclick = () => {
        if (confirm(t.confirmaRemover(j.nome))) enviar({ t: 'remover', nome: j.nome });
      };
      caixa.appendChild(s);
    });
    principal.textContent = t.comecar;
    principal.disabled = e.jogadores.length === 0;
    principal.onclick = () => enviar({ t: 'comecar' });
    return mostrar('lobby');
  }

  if (e.fase === 'pergunta' || e.fase === 'revelacao') {
    if (e.q !== ultimaQ) {
      ultimaQ = e.q;
      montarOpcoes(e);
    }
    $('idx').textContent = t.pergunta(e.q + 1, e.total);
    $('enunciado').textContent = e.enunciado;

    const revelando = e.fase === 'revelacao';
    $('barra').style.width = `${revelando ? 0 : e.duracao ? (e.restante / e.duracao) * 100 : 0}%`;
    $('relogio').textContent = revelando ? '' : Math.ceil(e.restante / 1000);
    $('respondidos').textContent = t.responderam(e.responderam, e.jogadores.length);

    [...$('opcoes').children].forEach((b, i) => {
      b.classList.toggle('certa', revelando && i === e.correta);
      b.classList.toggle('apagada', revelando && i !== e.correta);
      b.querySelector('.n').textContent = revelando && e.contagem ? e.contagem[i] : '';
    });

    $('curiosidade').hidden = !revelando || !e.curiosidade;
    $('curiosidade').textContent = e.curiosidade || '';

    principal.textContent = revelando ? t.placar : t.revelar;
    principal.onclick = () => enviar({ t: revelando ? 'placar' : 'revelar' });
    return mostrar('jogo');
  }

  if (e.fase === 'placar') {
    pintarLista($('placar'), e.ranking);
    const ultima = e.q + 1 >= e.total;
    principal.textContent = ultima ? t.encerrar : t.proxima;
    principal.onclick = () => enviar({ t: ultima ? 'encerrar' : 'proxima' });
    return mostrar('placar');
  }

  if (e.fase === 'fim') {
    montarFesta(e);
    principal.textContent = t.jogarDeNovo;
    principal.onclick = () => enviar({ t: 'reiniciar' });
    return mostrar('fim');
  }
}

/* ---------- menu ---------- */

function pintarMenu(e) {
  const grade = $('grade-quizzes');
  grade.innerHTML = '';

  e.quizzes.forEach((q) => {
    const card = document.createElement('div');
    card.className = 'card-quiz';
    card.innerHTML =
      '<div class="emoji"></div><div class="titulo"></div><div class="discreto"></div>' +
      '<div class="acoes"><button class="botao ac-jogar">▶ Apresentar</button>' +
      '<button class="botao fantasma ac-editar">Editar</button>' +
      '<button class="botao fantasma ac-duplicar"></button>' +
      '<button class="botao perigo ac-excluir">✕</button></div>';
    card.querySelector('.emoji').textContent = q.emoji;
    card.querySelector('.titulo').textContent = q.titulo;
    card.querySelector('.discreto').textContent =
      q.n + (q.n === 1 ? ' pergunta' : ' perguntas');
    card.querySelector('.ac-jogar').onclick = () => enviar({ t: 'abrirQuiz', id: q.id });
    card.querySelector('.ac-editar').onclick = () => enviar({ t: 'pegarQuiz', id: q.id });
    const btDup = card.querySelector('.ac-duplicar');
    btDup.textContent = T[idioma].duplicar;
    btDup.onclick = () => {
      if (confirm(T[idioma].copiaDe(q.titulo))) enviar({ t: 'duplicarQuiz', id: q.id });
    };
    card.querySelector('.ac-excluir').onclick = () => {
      if (confirm(`Excluir "${q.titulo}"? Não dá pra desfazer.`)) enviar({ t: 'excluirQuiz', id: q.id });
    };
    grade.appendChild(card);
  });

  const novo = document.createElement('div');
  novo.className = 'card-quiz card-novo';
  novo.innerHTML = '<div class="mais">＋</div><div>Novo quiz</div>';
  novo.onclick = () => abrirEditor(null);
  grade.appendChild(novo);
}

/* ---------- editor ---------- */

function abrirEditor(quiz) {
  visao = 'editor';
  document.body.classList.remove('festa');
  $('ed-erro').textContent = '';
  $('ed-cabecalho').textContent = quiz ? 'Editar quiz' : 'Novo quiz';
  $('ed-titulo').value = quiz ? quiz.titulo : '';
  $('ed-emoji').value = quiz ? quiz.emoji || '' : '';
  $('ed-titulo').dataset.id = quiz ? quiz.id : '';
  $('ed-cartas').innerHTML = '';
  (quiz ? quiz.cartas : [null]).forEach((c) => $('ed-cartas').appendChild(blocoCarta(c)));
  renumerar();
  mostrar('editor');
  window.scrollTo(0, 0);
}

function fecharEditor() {
  visao = null;
  if (ultimoEstado) pintar(ultimoEstado);
}

const TEMPOS = [10, 15, 20, 30, 45, 60, 90, 120];

function blocoCarta(c) {
  const grupo = 'certa-' + radioSeq++;
  const f = document.createElement('fieldset');
  f.className = 'ed-carta';

  const alt = (i, en) =>
    `<div class="ed-alt" data-i="${i}">` +
      `<span class="forma">${FORMAS[i]}</span>` +
      `<input class="campo ${en ? 'c-en-op' : 'c-op'}" maxlength="160" ` +
        `placeholder="${en ? 'Option' : 'Alternativa'} ${i + 1}">` +
      (en ? '' :
        `<label class="marcar" title="Marcar como correta">` +
          `<input type="radio" name="${grupo}" value="${i}">✓</label>`) +
    '</div>';

  f.innerHTML =
    '<div class="ed-topo">' +
      '<span class="ed-num"></span>' +
      '<span class="ed-titulo-q">Pergunta</span>' +
      '<span class="ed-ferramentas">' +
        '<button type="button" class="sobe" title="Mover para cima">↑</button>' +
        '<button type="button" class="desce" title="Mover para baixo">↓</button>' +
        '<button type="button" class="dup" title="Duplicar pergunta">⧉</button>' +
        '<button type="button" class="rem" title="Remover pergunta">✕</button>' +
      '</span>' +
    '</div>' +
    '<textarea class="campo c-enun" maxlength="300" placeholder="Escreva a pergunta"></textarea>' +
    `<div class="ed-alts">${alt(0)}${alt(1)}${alt(2)}${alt(3)}</div>` +
    '<p class="discreto" style="margin:.55rem 0 0;font-size:.85rem">Clique no ✓ para marcar a alternativa correta.</p>' +
    '<div class="ed-linha">' +
      '<div><label class="ed-rot">Tempo de resposta</label>' +
        '<select class="campo campo-curto c-seg">' +
          TEMPOS.map((t) => `<option value="${t}">${t} segundos</option>`).join('') +
        '</select></div>' +
      '<div style="flex:1;min-width:240px"><label class="ed-rot">Curiosidade (opcional)</label>' +
        '<textarea class="campo c-cur" maxlength="500" ' +
          'placeholder="Aparece na tela grande quando a resposta é revelada"></textarea></div>' +
    '</div>' +
    '<details><summary>Versão em inglês (opcional)</summary>' +
      '<textarea class="campo c-en-enun" maxlength="300" placeholder="Question in English" ' +
        'style="margin-top:.7rem"></textarea>' +
      `<div class="ed-en-grade">${alt(0, true)}${alt(1, true)}${alt(2, true)}${alt(3, true)}</div>` +
      '<textarea class="campo c-en-cur" maxlength="500" placeholder="Fun fact (optional)" ' +
        'style="margin-top:.7rem"></textarea>' +
    '</details>';

  /* marcar a correta pinta a linha inteira */
  const marcarLinha = () => {
    f.querySelectorAll('.ed-alts .ed-alt').forEach((linha) => {
      linha.classList.toggle('correta', linha.querySelector('input[type="radio"]').checked);
    });
  };
  f.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener('change', marcarLinha));

  if (c) {
    f.querySelector('.c-enun').value = c.pt.enunciado;
    f.querySelectorAll('.c-op').forEach((el, i) => { el.value = c.pt.opcoes[i] || ''; });
    f.querySelectorAll(`input[name="${grupo}"]`)[c.correta].checked = true;
    if (!TEMPOS.includes(c.segundos)) {
      const extra = new Option(c.segundos + ' segundos', c.segundos);
      f.querySelector('.c-seg').add(extra);
    }
    f.querySelector('.c-seg').value = c.segundos;
    f.querySelector('.c-cur').value = c.pt.curiosidade || '';
    if (c.en) {
      f.querySelector('details').open = true;
      f.querySelector('.c-en-enun').value = c.en.enunciado;
      f.querySelectorAll('.c-en-op').forEach((el, i) => { el.value = c.en.opcoes[i] || ''; });
      f.querySelector('.c-en-cur').value = c.en.curiosidade || '';
    }
  } else {
    f.querySelector('.c-seg').value = 20;
  }
  marcarLinha();

  f.querySelector('.rem').onclick = () => {
    if ($('ed-cartas').children.length === 1) return;
    f.remove();
    renumerar();
  };
  f.querySelector('.dup').onclick = () => {
    const copia = blocoCarta(lerCarta(f));
    f.after(copia);
    renumerar();
    copia.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  f.querySelector('.sobe').onclick = () => {
    if (f.previousElementSibling) f.previousElementSibling.before(f);
    renumerar();
  };
  f.querySelector('.desce').onclick = () => {
    if (f.nextElementSibling) f.nextElementSibling.after(f);
    renumerar();
  };
  return f;
}

function renumerar() {
  const cartas = [...$('ed-cartas').children];
  cartas.forEach((f, i) => {
    f.querySelector('.ed-num').textContent = i + 1;
    f.querySelector('.sobe').disabled = i === 0;
    f.querySelector('.desce').disabled = i === cartas.length - 1;
    f.querySelector('.rem').disabled = cartas.length === 1;
  });
  $('ed-contagem').textContent =
    cartas.length + (cartas.length === 1 ? ' pergunta' : ' perguntas');
}

/** Lê um bloco do editor de volta pro formato de carta. */
function lerCarta(f) {
  const marcada = f.querySelector('input[type="radio"]:checked');
  return {
    segundos: Number(f.querySelector('.c-seg').value),
    correta: marcada ? Number(marcada.value) : -1,
    pt: {
      enunciado: f.querySelector('.c-enun').value,
      opcoes: [...f.querySelectorAll('.c-op')].map((el) => el.value),
      curiosidade: f.querySelector('.c-cur').value,
    },
    en: {
      enunciado: f.querySelector('.c-en-enun').value,
      opcoes: [...f.querySelectorAll('.c-en-op')].map((el) => el.value),
      curiosidade: f.querySelector('.c-en-cur').value,
    },
  };
}

function serializarEditor() {
  return {
    id: $('ed-titulo').dataset.id || undefined,
    titulo: $('ed-titulo').value,
    emoji: $('ed-emoji').value,
    cartas: [...$('ed-cartas').children].map(lerCarta),
  };
}

$('ed-add').onclick = () => {
  const nova = blocoCarta(null);
  $('ed-cartas').appendChild(nova);
  renumerar();
  nova.scrollIntoView({ behavior: 'smooth', block: 'center' });
  nova.querySelector('.c-enun').focus();
};
$('ed-salvar').onclick = () => {
  $('ed-erro').textContent = '';
  enviar({ t: 'salvarQuiz', quiz: serializarEditor() });
};
$('ed-cancelar').onclick = fecharEditor;

/* ---------- listas e pódio ---------- */

function pintarLista(ol, lista) {
  ol.innerHTML = '';
  lista.forEach((r) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="pos"></span><span></span><span class="pontos"></span>';
    li.children[0].textContent = r.pos;
    li.children[1].textContent = r.nome;
    li.children[2].textContent = r.pontos;
    ol.appendChild(li);
  });
}

/* pódio estilo Kahoot: 3º sobe, depois 2º, depois 1º com coroa e confete */
function montarFesta(e) {
  if (festaMontada) return;
  festaMontada = true;

  const palco = $('podio-palco');
  palco.innerHTML = '';
  const top = e.ranking.slice(0, 3);

  [1, 0, 2].forEach((idx) => {                       // exibição: 2º | 1º | 3º
    if (!top[idx]) return;
    const col = document.createElement('div');
    col.className = 'coluna c' + (idx + 1);
    col.innerHTML =
      '<div class="coroa">👑</div><div class="avatar"></div><div class="quem"></div>' +
      '<div class="qtd">0</div><div class="bloco"></div>';
    if (idx !== 0) col.querySelector('.coroa').textContent = '';
    col.querySelector('.avatar').textContent = top[idx].nome.trim().charAt(0).toUpperCase();
    col.querySelector('.quem').textContent = top[idx].nome;
    col.querySelector('.qtd').dataset.alvo = top[idx].pontos;
    col.querySelector('.bloco').textContent = idx + 1;
    palco.appendChild(col);
  });

  pintarLista($('podio'), e.ranking.slice(3));       // do 4º em diante

  const revelar = (idx) => {
    const col = palco.querySelector('.c' + (idx + 1));
    if (!col) return;
    col.classList.add('sobe');
    contarAte(col.querySelector('.qtd'));
    confete.estourar({ 0: 0.5, 1: 0.32, 2: 0.68 }[idx], 0.45, idx === 0 ? 170 : 70);
    if (idx === 0) {
      timersFesta.push(setTimeout(() => confete.estourar(0.15, 0.3, 90), 450));
      timersFesta.push(setTimeout(() => confete.estourar(0.85, 0.3, 90), 900));
    }
  };
  timersFesta.push(setTimeout(() => revelar(2), 500));
  timersFesta.push(setTimeout(() => revelar(1), 1700));
  timersFesta.push(setTimeout(() => revelar(0), 3100));
}

function desmontarFesta() {
  if (!festaMontada) return;
  festaMontada = false;
  timersFesta.forEach(clearTimeout);
  timersFesta = [];
  confete.parar();
}

function contarAte(el) {
  const alvo = Number(el.dataset.alvo || 0);
  const inicio = performance.now();
  (function tique(agora) {
    const f = Math.min(1, (agora - inicio) / 900);
    el.textContent = Math.round(alvo * (2 - f) * f);   // desacelera no final
    if (f < 1) requestAnimationFrame(tique);
  })(inicio);
}

function montarOpcoes(e) {
  const caixa = $('opcoes');
  caixa.innerHTML = '';
  e.opcoes.forEach((texto, i) => {
    const b = document.createElement('button');
    b.className = 'opcao contagem';
    b.dataset.i = i;
    b.disabled = true;
    b.innerHTML = '<span class="forma"></span><span></span><span class="n"></span>';
    b.children[0].textContent = FORMAS[i];
    b.children[1].textContent = texto;
    caixa.appendChild(b);
  });
}

/* ---------- barra ---------- */

$('bt-pt').onclick = () => enviar({ t: 'idioma', v: 'pt' });
$('bt-en').onclick = () => enviar({ t: 'idioma', v: 'en' });
$('bt-menu').onclick = () => {
  if (confirm(T[idioma].confirmaMenu)) enviar({ t: 'menu' });
};

document.addEventListener('keydown', (ev) => {
  const tag = ev.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (visao === 'editor') return;
  if (ev.code === 'Space' || ev.code === 'Enter') {
    const barra = $('barra-controle');
    if (barra.classList.contains('escondida')) return;
    ev.preventDefault();
    if (!$('bt-principal').disabled) $('bt-principal').click();
  }
});

conectar();
