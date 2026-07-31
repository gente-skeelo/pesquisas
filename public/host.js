/* Tela do apresentador: central de quizzes, editor, condução e pódio. */

const FORMAS = ['▲', '◆', '●', '■'];

const T = {
  pt: {
    aponte: 'Aponte a câmera do celular',
    quem: 'Quem já chegou',
    vazio: 'Ninguém ainda. Mostre o QR na tela grande.',
    dicaRemover: 'Clique num nome pra tirar a pessoa da sala.',
    confirmaRemover: (n) => `Tirar ${n} da sala?`,
    pergunta: (i, t) => `Pergunta ${i} de ${t}`,
    responderam: (n, tot) => `${n} de ${tot} já responderam`,
    parcial: 'Placar parcial',
    lideres: 'Quem está na frente',
    fim: 'Fim de festa!',
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
    aponte: 'Point your phone camera',
    quem: 'Already here',
    vazio: 'Nobody yet. Put the QR on the big screen.',
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

const faixa = document.querySelector('.bandeirinhas');
for (let i = 0; i < 60; i++) faixa.appendChild(document.createElement('i'));

function mostrar(qual) {
  telas.forEach((t) => $('tela-' + t).classList.toggle('ativa', t === qual));
  $('barra-controle').classList.toggle('escondida', qual === 'menu' || qual === 'editor');
}

const enviar = (m) => ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

/* QR e URL de entrada */
fetch('/api/entrada')
  .then((r) => r.json())
  .then(({ url, qr }) => {
    $('qr').src = qr;
    $('url').textContent = url.replace(/^https?:\/\//, '');
  })
  .catch(() => { $('url').textContent = location.origin; });

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

  if (e.fase === 'menu') {
    pintarMenu(e);
    return mostrar('menu');
  }

  if (e.fase === 'lobby') {
    $('h-titulo').textContent = `${e.emoji || ''} ${e.quiz}`.trim();
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
      '<button class="botao perigo ac-excluir">✕</button></div>';
    card.querySelector('.emoji').textContent = q.emoji;
    card.querySelector('.titulo').textContent = q.titulo;
    card.querySelector('.discreto').textContent =
      q.n + (q.n === 1 ? ' pergunta' : ' perguntas');
    card.querySelector('.ac-jogar').onclick = () => enviar({ t: 'abrirQuiz', id: q.id });
    card.querySelector('.ac-editar').onclick = () => enviar({ t: 'pegarQuiz', id: q.id });
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

function blocoCarta(c) {
  const grupo = 'certa-' + radioSeq++;
  const f = document.createElement('fieldset');
  f.className = 'ed-carta';

  let ops = '';
  for (let i = 0; i < 4; i++) {
    ops +=
      `<div class="ed-op"><input type="radio" name="${grupo}" value="${i}" title="Correta">` +
      `<span class="forma">${FORMAS[i]}</span>` +
      `<input class="campo c-op" maxlength="160" placeholder="Alternativa ${i + 1}"></div>`;
  }
  let opsEn = '';
  for (let i = 0; i < 4; i++) {
    opsEn +=
      `<div class="ed-op"><span class="forma">${FORMAS[i]}</span>` +
      `<input class="campo c-en-op" maxlength="160" placeholder="Option ${i + 1}"></div>`;
  }

  f.innerHTML =
    '<legend></legend>' +
    '<textarea class="campo c-enun" maxlength="300" placeholder="Enunciado da pergunta"></textarea>' +
    '<p class="discreto" style="margin:.7rem 0 .2rem">Marque a bolinha da alternativa correta:</p>' +
    ops +
    '<div class="ed-linha" style="margin-top:.6rem">' +
    '<label>Tempo (s) <input type="number" class="campo campo-curto c-seg" min="5" max="120" value="20"></label>' +
    '</div>' +
    '<textarea class="campo c-cur" maxlength="500" placeholder="Curiosidade (opcional — aparece na revelação)" style="margin-top:.6rem"></textarea>' +
    '<details><summary>English (opcional)</summary>' +
    '<textarea class="campo c-en-enun" maxlength="300" placeholder="Question in English" style="margin-top:.6rem"></textarea>' +
    opsEn +
    '<textarea class="campo c-en-cur" maxlength="500" placeholder="Fun fact (optional)"></textarea>' +
    '</details>' +
    '<div class="ed-rodape"><span></span><button type="button" class="botao perigo c-remover">Remover pergunta</button></div>';

  if (c) {
    f.querySelector('.c-enun').value = c.pt.enunciado;
    f.querySelectorAll('.c-op').forEach((el, i) => { el.value = c.pt.opcoes[i] || ''; });
    f.querySelectorAll(`input[name="${grupo}"]`)[c.correta].checked = true;
    f.querySelector('.c-seg').value = c.segundos;
    f.querySelector('.c-cur').value = c.pt.curiosidade || '';
    if (c.en) {
      f.querySelector('details').open = true;
      f.querySelector('.c-en-enun').value = c.en.enunciado;
      f.querySelectorAll('.c-en-op').forEach((el, i) => { el.value = c.en.opcoes[i] || ''; });
      f.querySelector('.c-en-cur').value = c.en.curiosidade || '';
    }
  }

  f.querySelector('.c-remover').onclick = () => {
    if ($('ed-cartas').children.length === 1) return;
    f.remove();
    renumerar();
  };
  return f;
}

function renumerar() {
  [...$('ed-cartas').children].forEach((f, i) => {
    f.querySelector('legend').textContent = 'Pergunta ' + (i + 1);
  });
}

function serializarEditor() {
  const cartas = [...$('ed-cartas').children].map((f) => {
    const marcada = f.querySelector('input[type="radio"]:checked');
    const en = {
      enunciado: f.querySelector('.c-en-enun').value,
      opcoes: [...f.querySelectorAll('.c-en-op')].map((el) => el.value),
      curiosidade: f.querySelector('.c-en-cur').value,
    };
    return {
      segundos: Number(f.querySelector('.c-seg').value),
      correta: marcada ? Number(marcada.value) : -1,
      pt: {
        enunciado: f.querySelector('.c-enun').value,
        opcoes: [...f.querySelectorAll('.c-op')].map((el) => el.value),
        curiosidade: f.querySelector('.c-cur').value,
      },
      en,
    };
  });
  return {
    id: $('ed-titulo').dataset.id || undefined,
    titulo: $('ed-titulo').value,
    emoji: $('ed-emoji').value,
    cartas,
  };
}

$('ed-add').onclick = () => {
  $('ed-cartas').appendChild(blocoCarta(null));
  renumerar();
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
