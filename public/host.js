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
    certasDe: (c, n) => `${c} de ${n} acertaram`,
    parcial: 'Placar parcial',
    lideres: 'Quem está na frente',
    fim: 'Fim de jogo!',
    comecar: 'Começar',
    revelar: 'Revelar resposta',
    placar: 'Ver placar',
    proxima: 'Próxima pergunta',
    encerrar: 'Encerrar e premiar',
    mostrarPodio: '🏆 Mostrar o pódio',
    tambores: 'E o pódio é…',
    chamada: (p) => `${p}º lugar…`,
    campeao: 'Campeã(o)!',
    demais: 'Restante do placar',
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
    certasDe: (c, n) => `${c} of ${n} got it right`,
    parcial: 'Standings',
    lideres: 'Who is ahead',
    fim: "That's a wrap!",
    comecar: 'Start',
    revelar: 'Reveal answer',
    placar: 'Show standings',
    proxima: 'Next question',
    encerrar: 'Finish and crown',
    mostrarPodio: '🏆 Show the podium',
    tambores: 'And the podium is…',
    chamada: (p) => `In ${p}${p === 1 ? 'st' : p === 2 ? 'nd' : 'rd'} place…`,
    campeao: 'Champion!',
    demais: 'Rest of the leaderboard',
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
let coresEditor = [];   // preenchido ao abrir o editor (PALETAS é declarado adiante)
let podeTraduzir = false;
let traduzindo = null;
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
    else if (m.t === 'traduzido') receberTraducao(m.idioma, m.cartas);
    else if (m.t === 'erro' && m.erro === 'sem-traducao') {
      destravarTraducao('Tradução automática desligada: falta ANTHROPIC_API_KEY no servidor.');
    } else if (m.t === 'erro' && m.erro === 'traducao') {
      destravarTraducao('Não deu pra traduzir: ' + (m.detalhe || 'erro desconhecido'));
    }
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
  ['pt', 'en', 'es'].forEach((v) => $('bt-' + v).classList.toggle('on', idioma === v));
  $('h-aponte').textContent = t.aponte;
  $('h-parcial').textContent = t.parcial;
  $('h-lideres').textContent = t.lideres;
  $('h-fim').textContent = t.fim;
  $('bt-menu').textContent = t.menu;
  $('situacao').textContent = t.naSala(e.jogadores.length);

  const principal = $('bt-principal');
  principal.disabled = false;

  if (e.pin !== qrDoPin) carregarEntrada(e.pin);
  podeTraduzir = !!e.podeTraduzir;
  aplicarCores(e.cores);
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
    $('respondidos').textContent = revelando
      ? t.certasDe(e.contagem ? e.contagem[e.correta] : 0, e.responderam)
      : t.responderam(e.responderam, e.jogadores.length);

    [...$('opcoes').children].forEach((b, i) => {
      b.classList.toggle('certa', revelando && i === e.correta);
      b.classList.toggle('apagada', revelando && i !== e.correta);
      b.querySelector('.n').textContent = revelando && e.contagem ? e.contagem[i] : '';
    });

    $('curiosidade').hidden = !revelando || !e.curiosidade;
    $('curiosidade').textContent = e.curiosidade || '';

    const ultima = e.q + 1 >= e.total;
    if (!revelando) {
      principal.textContent = t.revelar;
      principal.onclick = () => enviar({ t: 'revelar' });
    } else if (ultima) {
      principal.textContent = t.mostrarPodio;
      principal.onclick = () => enviar({ t: 'encerrar' });
    } else {
      principal.textContent = t.placar;
      principal.onclick = () => enviar({ t: 'placar' });
    }
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
    $('h-demais').textContent = t.demais;
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
  $('ed-erro').textContent = '';
  $('ed-status').textContent = '';
  coresEditor = (quiz && Array.isArray(quiz.cores) && quiz.cores.length === 4)
    ? quiz.cores.slice()
    : PALETAS[0].cores.slice();
  montarPaleta();
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

function montarPaleta() {
  const presets = $('ed-presets');
  presets.innerHTML = '';
  PALETAS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.title = p.nome;
    b.innerHTML = p.cores.map((c) => `<i style="background:${c}"></i>`).join('') +
                  `<span>${p.nome}</span>`;
    b.onclick = () => {
      coresEditor = p.cores.slice();
      montarPaleta();
    };
    presets.appendChild(b);
  });

  const livres = $('ed-cores');
  livres.innerHTML = '';
  coresEditor.forEach((cor, i) => {
    const cx = document.createElement('label');
    cx.className = 'cor-livre';
    cx.innerHTML = `<span class="forma">${FORMAS[i]}</span><input type="color" value="${cor}">`;
    cx.querySelector('input').oninput = (ev) => {
      coresEditor[i] = ev.target.value;
      cx.style.setProperty('--previa', ev.target.value);
      $('ed-previa').children[i].style.background = ev.target.value;
    };
    cx.style.setProperty('--previa', cor);
    livres.appendChild(cx);
  });

  const previa = $('ed-previa');
  previa.innerHTML = '';
  coresEditor.forEach((cor, i) => {
    const d = document.createElement('div');
    d.className = 'previa-alt';
    d.style.background = cor;
    d.style.color = contraste(cor);
    d.textContent = `${FORMAS[i]}  Alternativa ${i + 1}`;
    previa.appendChild(d);
  });
}

function fecharEditor() {
  visao = null;
  if (ultimoEstado) pintar(ultimoEstado);
}

const TEMPOS = [10, 15, 20, 30, 45, 60, 90, 120];

const IDIOMAS_EXTRA = [
  { cod: 'en', rotulo: 'English', dica: 'Question in English', op: 'Option', cur: 'Fun fact (optional)' },
  { cod: 'es', rotulo: 'Español', dica: 'Pregunta en español', op: 'Opción', cur: 'Dato curioso (opcional)' },
];

const PALETAS = [
  { nome: 'Pastel',   cores: ['#fbcfdd', '#c7e2fb', '#fde6a8', '#bdf0d4'] },
  { nome: 'Vibrante', cores: ['#e8455f', '#2196f3', '#f5a623', '#00b871'] },
  { nome: 'Skeelo',   cores: ['#00c853', '#0c3221', '#8ee9b6', '#146c43'] },
  { nome: 'Doce',     cores: ['#ffb5a7', '#b8c0ff', '#ffd6a5', '#caffbf'] },
  { nome: 'Noturna',  cores: ['#5f4b8b', '#1f6f8b', '#c06014', '#2d6a4f'] },
];

/** Texto escuro ou claro conforme o fundo, pra alternativa nunca ficar ilegível. */
function contraste(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return '#0d2818';
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luz > 0.42 ? '#0d2818' : '#ffffff';
}

/** Aplica a paleta do quiz nas variáveis que as alternativas usam. */
function aplicarCores(cores) {
  const lista = Array.isArray(cores) && cores.length === 4 ? cores : PALETAS[0].cores;
  const raiz = document.documentElement;
  lista.forEach((c, i) => {
    raiz.style.setProperty(`--op${i}`, c);
    raiz.style.setProperty(`--tinta-op${i}`, contraste(c));
  });
}

function blocoCarta(c) {
  const grupo = 'certa-' + radioSeq++;
  const f = document.createElement('fieldset');
  f.className = 'ed-carta';

  const alt = (i, lang) =>
    `<div class="ed-alt" data-i="${i}">` +
      `<span class="forma">${FORMAS[i]}</span>` +
      `<input class="campo ${lang ? 'c-' + lang + '-op' : 'c-op'}" maxlength="160" ` +
        `placeholder="${lang ? IDIOMAS_EXTRA.find((x) => x.cod === lang).op : 'Alternativa'} ${i + 1}">` +
      (lang ? '' :
        `<label class="marcar" title="Marcar como correta">` +
          `<input type="radio" name="${grupo}" value="${i}">✓</label>`) +
    '</div>';

  const secaoIdioma = (L) =>
    `<details data-lang="${L.cod}"><summary>${L.rotulo} (opcional)` +
      `<button type="button" class="bt-traduzir" data-lang="${L.cod}">✨ Traduzir</button>` +
    '</summary>' +
      `<textarea class="campo c-${L.cod}-enun" maxlength="300" placeholder="${L.dica}" ` +
        'style="margin-top:.7rem"></textarea>' +
      `<div class="ed-en-grade">${alt(0, L.cod)}${alt(1, L.cod)}${alt(2, L.cod)}${alt(3, L.cod)}</div>` +
      `<textarea class="campo c-${L.cod}-cur" maxlength="500" placeholder="${L.cur}" ` +
        'style="margin-top:.7rem"></textarea>' +
    '</details>';

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
    IDIOMAS_EXTRA.map(secaoIdioma).join('');

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
      f.querySelector('.c-seg').add(new Option(c.segundos + ' segundos', c.segundos));
    }
    f.querySelector('.c-seg').value = c.segundos;
    f.querySelector('.c-cur').value = c.pt.curiosidade || '';
    IDIOMAS_EXTRA.forEach((L) => {
      const t = c[L.cod];
      if (!t) return;
      f.querySelector(`details[data-lang="${L.cod}"]`).open = true;
      f.querySelector(`.c-${L.cod}-enun`).value = t.enunciado;
      f.querySelectorAll(`.c-${L.cod}-op`).forEach((el, i) => { el.value = t.opcoes[i] || ''; });
      f.querySelector(`.c-${L.cod}-cur`).value = t.curiosidade || '';
    });
  } else {
    f.querySelector('.c-seg').value = 20;
  }
  marcarLinha();

  f.querySelectorAll('.bt-traduzir').forEach((bt) => {
    bt.onclick = (ev) => {
      ev.preventDefault();
      traduzirPerguntas(bt.dataset.lang, f);
    };
  });

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
  const carta = {
    segundos: Number(f.querySelector('.c-seg').value),
    correta: marcada ? Number(marcada.value) : -1,
    pt: {
      enunciado: f.querySelector('.c-enun').value,
      opcoes: [...f.querySelectorAll('.c-op')].map((el) => el.value),
      curiosidade: f.querySelector('.c-cur').value,
    },
  };
  IDIOMAS_EXTRA.forEach((L) => {
    carta[L.cod] = {
      enunciado: f.querySelector(`.c-${L.cod}-enun`).value,
      opcoes: [...f.querySelectorAll(`.c-${L.cod}-op`)].map((el) => el.value),
      curiosidade: f.querySelector(`.c-${L.cod}-cur`).value,
    };
  });
  return carta;
}

const NOME_IDIOMA = { en: 'inglês', es: 'espanhol' };

/** Traduz uma pergunta ou o quiz inteiro. `alvo` pode ser 'en', 'es' ou 'ambos'. */
function traduzirPerguntas(alvo, apenas) {
  if (!podeTraduzir) {
    $('ed-erro').textContent =
      'Tradução automática desligada: falta a variável ANTHROPIC_API_KEY no servidor.';
    return;
  }
  const blocos = apenas ? [apenas] : [...$('ed-cartas').children];
  const cartas = blocos.map(lerCarta);
  if (cartas.some((c) => !c.pt.enunciado.trim() || c.pt.opcoes.some((o) => !o.trim()))) {
    $('ed-erro').textContent = 'Escreva a pergunta e as 4 alternativas em português antes de traduzir.';
    return;
  }

  $('ed-erro').textContent = '';
  travarTraducao(true);
  traduzindo = { fila: alvo === 'ambos' ? ['en', 'es'] : [alvo], blocos, cartas, feitos: [] };
  pedirProximaTraducao();
}

/** Manda o próximo idioma da fila — os dois idiomas vão em sequência, não juntos. */
function pedirProximaTraducao() {
  const idioma = traduzindo.fila[0];
  const total = traduzindo.fila.length + traduzindo.feitos.length;
  const passo = traduzindo.feitos.length + 1;
  $('ed-status').textContent = total > 1
    ? `Traduzindo para ${NOME_IDIOMA[idioma]}… (${passo} de ${total})`
    : `Traduzindo para ${NOME_IDIOMA[idioma]}…`;
  enviar({ t: 'traduzir', idioma, cartas: traduzindo.cartas });
}

function travarTraducao(travado) {
  document.querySelectorAll('.bt-traduzir, #ed-traduzir-tudo').forEach((b) => {
    b.disabled = travado;
  });
}

function destravarTraducao(msg) {
  traduzindo = null;
  travarTraducao(false);
  $('ed-status').textContent = '';
  $('ed-erro').textContent = msg;
}

function receberTraducao(idioma, cartas) {
  if (!traduzindo || traduzindo.fila[0] !== idioma) return;

  traduzindo.blocos.forEach((f, i) => {
    const t = cartas[i];
    if (!t) return;
    f.querySelector(`details[data-lang="${idioma}"]`).open = true;
    f.querySelector(`.c-${idioma}-enun`).value = t.enunciado || '';
    f.querySelectorAll(`.c-${idioma}-op`).forEach((el, j) => { el.value = t.opcoes[j] || ''; });
    f.querySelector(`.c-${idioma}-cur`).value = t.curiosidade || '';
  });

  traduzindo.feitos.push(traduzindo.fila.shift());

  if (traduzindo.fila.length) return pedirProximaTraducao();

  const nomes = traduzindo.feitos.map((c) => NOME_IDIOMA[c]).join(' e ');
  traduzindo = null;
  travarTraducao(false);
  $('ed-status').textContent = `Tradução para ${nomes} pronta — revise antes de salvar.`;
}

function serializarEditor() {
  return {
    id: $('ed-titulo').dataset.id || undefined,
    titulo: $('ed-titulo').value,
    emoji: $('ed-emoji').value,
    cores: coresEditor,
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
$('ed-traduzir-tudo').onclick = () => {
  const idioma = $('ed-idioma-alvo').value;
  traduzirPerguntas(idioma, null);
};

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

/** Noz de premiação em ouro, prata ou bronze — gordinha, redonda e sorridente. */
function noz(idx) {
  const tom = [
    { cupula: '#c98a00', aba: '#e0a300', corpo: '#ffd04d', luz: '#fff6cf' },  // ouro
    { cupula: '#8e99a6', aba: '#a9b4c0', corpo: '#e6ecf3', luz: '#ffffff' },  // prata
    { cupula: '#8f4f1d', aba: '#a95f24', corpo: '#dd9257', luz: '#f8d4ae' },  // bronze
  ][idx];
  return (
    '<svg class="noz" viewBox="0 0 88 100" aria-hidden="true">' +
      // cabinho
      `<path d="M44 2 C49 2 52 7 50 13 L38 13 C36 7 39 2 44 2 Z" fill="${tom.cupula}"/>` +
      // corpo bem redondo, com a barriguinha passando da cúpula
      `<circle cx="44" cy="62" r="32" fill="${tom.corpo}"/>` +
      `<path d="M44 90 C48 90 50 95 44 98 C38 95 40 90 44 90 Z" fill="${tom.corpo}"/>` +
      // brilho do corpo
      `<ellipse cx="31" cy="56" rx="8" ry="12" fill="${tom.luz}" opacity=".5" ` +
        'transform="rotate(-18 31 56)"/>' +
      `<circle cx="58" cy="76" r="4" fill="${tom.luz}" opacity=".3"/>` +
      // cúpula fofa, abaulada e com aba arredondada
      `<path d="M9 42 C9 22 24 11 44 11 C64 11 79 22 79 42 C79 47 75 50 70 50 ` +
        `L18 50 C13 50 9 47 9 42 Z" fill="${tom.cupula}"/>` +
      `<path d="M9 42 C9 22 24 11 44 11 C64 11 79 22 79 42 C79 44 78 45 76 46 ` +
        `C74 28 61 19 44 19 C27 19 14 28 12 46 C10 45 9 44 9 42 Z" fill="${tom.aba}"/>` +
      `<ellipse cx="32" cy="27" rx="13" ry="6" fill="#fff" opacity=".26" ` +
        'transform="rotate(-14 32 27)"/>' +
      // número na barriga
      `<text x="44" y="76" text-anchor="middle" font-size="27" font-weight="700" ` +
        `font-family="Fredoka, sans-serif" fill="#fff" opacity=".95">${idx + 1}</text>` +
    '</svg>'
  );
}

/* Pódio com suspense: cada lugar é chamado, sobe e só então revela o nome. */
function montarFesta(e) {
  if (festaMontada) return;
  festaMontada = true;

  const t = T[idioma];
  const palco = $('podio-palco');
  palco.innerHTML = '';
  const top = e.ranking.slice(0, 3);

  $('h-fim').textContent = t.tambores;
  $('podio').innerHTML = '';
  $('podio-resto').hidden = true;

  [1, 0, 2].forEach((idx) => {                       // exibição: 2º | 1º | 3º
    if (!top[idx]) return;
    const col = document.createElement('div');
    col.className = 'coluna c' + (idx + 1);
    col.innerHTML =
      '<div class="coroa">👑</div>' +
      `<div class="medalha">${noz(idx)}</div>` +
      '<div class="quem"></div>' +
      '<div class="qtd">0</div>' +
      '<div class="bloco"><span class="interrog">?</span></div>';
    col.querySelector('.quem').textContent = top[idx].nome;
    col.querySelector('.qtd').dataset.alvo = top[idx].pontos;
    palco.appendChild(col);
  });

  const revelar = (idx) => {
    const col = palco.querySelector('.c' + (idx + 1));
    if (!col) return;
    $('h-fim').textContent = idx === 0 ? t.campeao : t.chamada(idx + 1);
    col.classList.add('sobe');
    contarAte(col.querySelector('.qtd'));

    if (idx === 0) {
      confete.estourar(0.5, 0.45, 200);
      confete.chover(9);                              // papelzinhos caindo na tela
      timersFesta.push(setTimeout(() => confete.estourar(0.16, 0.32, 110), 420));
      timersFesta.push(setTimeout(() => confete.estourar(0.84, 0.32, 110), 820));
      timersFesta.push(setTimeout(() => {
        $('h-fim').textContent = t.fim;
        if (e.ranking.length > 3) {
          pintarLista($('podio'), e.ranking.slice(3));
          $('podio-resto').hidden = false;
        }
      }, 2600));
    } else {
      confete.estourar({ 1: 0.3, 2: 0.7 }[idx], 0.5, 80);
    }
  };

  /* chamada → suspense → revelação, do bronze ao ouro */
  timersFesta.push(setTimeout(() => { $('h-fim').textContent = t.chamada(3); }, 500));
  timersFesta.push(setTimeout(() => revelar(2), 1800));
  timersFesta.push(setTimeout(() => { $('h-fim').textContent = t.chamada(2); }, 3600));
  timersFesta.push(setTimeout(() => revelar(1), 4900));
  timersFesta.push(setTimeout(() => { $('h-fim').textContent = t.chamada(1); }, 6700));
  timersFesta.push(setTimeout(() => revelar(0), 8200));
}

function desmontarFesta() {
  if (!festaMontada) return;
  festaMontada = false;
  timersFesta.forEach(clearTimeout);
  timersFesta = [];
  confete.parar();
  $('podio-resto').hidden = true;
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

['pt', 'en', 'es'].forEach((v) => { $('bt-' + v).onclick = () => enviar({ t: 'idioma', v }); });
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
