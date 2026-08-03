/* Tela do jogador: entra, responde, vê quanto fez. */

const FORMAS = ['▲', '◆', '●', '■'];

const T = {
  pt: {
    titulo: 'Quiz do Skee',
    sub: 'Digite o PIN da sala e seu nome.',
    rotPin: 'PIN da sala',
    rotNome: 'Seu nome',
    entrar: 'Entrar',
    ola: (n) => `Tudo certo, ${n}!`,
    escolhendo: 'O apresentador está escolhendo o quiz…',
    espera: 'Aguarde o apresentador começar.',
    naSala: (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'} na sala`,
    pergunta: (i, t) => `Pergunta ${i} de ${t}`,
    respondeu: 'Resposta enviada. Aguarde.',
    acertou: 'Acertou!',
    errou: 'Dessa vez não.',
    passou: 'Você não respondeu.',
    serie: (n) => `🔥 ${n} acertos seguidos`,
    posicao: (p, n) => `${p}º lugar de ${n}`,
    total: (p) => `${p} pontos no total`,
    fim: 'Fim de jogo!',
    resumo: (p, pos) => `Você fez ${p} pontos e ficou em ${pos}º.`,
    erroNome: 'Escreva um nome.',
    erroPin: 'PIN incorreto. Confira na tela do apresentador.',
    erroSemSala: 'Nenhuma sala aberta no momento.',
    erroRepetido: 'Esse nome já está na sala. Escolha outro.',
    caiu: 'Conexão caiu. Reconectando…',
    rodape: 'Quiz do Skee · skeelo',
  },
  en: {
    titulo: 'Quiz do Skee',
    sub: 'Enter the room PIN and your name.',
    rotPin: 'Room PIN',
    rotNome: 'Your name',
    entrar: 'Join',
    ola: (n) => `You're in, ${n}!`,
    escolhendo: 'The host is picking the quiz…',
    espera: 'Wait for the host to start.',
    naSala: (n) => `${n} ${n === 1 ? 'person' : 'people'} in the room`,
    pergunta: (i, t) => `Question ${i} of ${t}`,
    respondeu: 'Answer locked in. Hold tight.',
    acertou: 'Correct!',
    errou: 'Not this time.',
    passou: "You didn't answer.",
    serie: (n) => `🔥 ${n} in a row`,
    posicao: (p, n) => `${p} of ${n}`,
    total: (p) => `${p} points in total`,
    fim: "That's a wrap!",
    resumo: (p, pos) => `You scored ${p} points and finished ${pos}.`,
    erroNome: 'Type a name.',
    erroPin: "Wrong PIN. Check the host's screen.",
    erroSemSala: 'No room open right now.',
    erroRepetido: 'That name is taken. Pick another.',
    caiu: 'Connection dropped. Reconnecting…',
    rodape: 'Quiz do Skee · skeelo',
  },
  es: {
    titulo: 'Quiz do Skee',
    sub: 'Escribe el PIN de la sala y tu nombre.',
    rotPin: 'PIN de la sala',
    rotNome: 'Tu nombre',
    entrar: 'Entrar',
    ola: (n) => `¡Listo, ${n}!`,
    escolhendo: 'El presentador está eligiendo el quiz…',
    espera: 'Espera a que el presentador empiece.',
    naSala: (n) => `${n} ${n === 1 ? 'persona' : 'personas'} en la sala`,
    pergunta: (i, t) => `Pregunta ${i} de ${t}`,
    respondeu: 'Respuesta enviada. Espera.',
    acertou: '¡Correcto!',
    errou: 'Esta vez no.',
    passou: 'No respondiste.',
    serie: (n) => `🔥 ${n} aciertos seguidos`,
    posicao: (p, n) => `${p}º lugar de ${n}`,
    total: (p) => `${p} puntos en total`,
    fim: '¡Fin del juego!',
    resumo: (p, pos) => `Hiciste ${p} puntos y quedaste en ${pos}º.`,
    erroNome: 'Escribe un nombre.',
    erroPin: 'PIN incorrecto. Míralo en la pantalla del presentador.',
    erroSemSala: 'No hay ninguna sala abierta ahora.',
    erroRepetido: 'Ese nombre ya está en la sala. Elige otro.',
    caiu: 'Se cayó la conexión. Reconectando…',
    rodape: 'Quiz do Skee · skeelo',
  },
};

const $ = (id) => document.getElementById(id);

/** Texto escuro ou claro conforme o fundo da alternativa. */
function contraste(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(n)) return '#0d2818';
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? '#0d2818' : '#ffffff';
}

function aplicarCores(cores) {
  if (!Array.isArray(cores) || cores.length !== 4) return;
  const raiz = document.documentElement;
  cores.forEach((c, i) => {
    raiz.style.setProperty(`--op${i}`, c);
    raiz.style.setProperty(`--tinta-op${i}`, contraste(c));
  });
}
const telas = ['entrar', 'espera', 'pergunta', 'feedback', 'fim'];

let ws = null;
let token = localStorage.getItem('quiz-token') || '';
let meuNome = localStorage.getItem('quiz-nome') || '';
let idioma = 'pt';
let meuIdioma = localStorage.getItem('quiz-idioma') || '';   // vazio = acompanha a sala
let ultimaQ = -1;
let estado = null;
let festejei = false;
const confete = Confete(document.getElementById('confete'));
document.body.classList.add('festa');

function mostrar(qual) {
  telas.forEach((t) => $('tela-' + t).classList.toggle('ativa', t === qual));
}

function conectar() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => {
    $('erro-entrar').textContent = '';
    if (token) {
      ws.send(JSON.stringify({ t: 'voltar', token }));
      if (meuIdioma) ws.send(JSON.stringify({ t: 'meuIdioma', v: meuIdioma }));
    }
  };

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);

    if (m.t === 'eu') {
      token = m.token;
      meuNome = m.nome;
      localStorage.setItem('quiz-token', token);
      localStorage.setItem('quiz-nome', meuNome);
      return;
    }

    if (m.t === 'erro') {
      if (m.erro === 'desconhecido') {           // servidor reiniciou: entra de novo
        localStorage.removeItem('quiz-token');
        token = '';
        mostrar('entrar');
      } else if (m.erro === 'repetido') {
        $('erro-entrar').textContent = T[idioma].erroRepetido;
        $('bt-entrar').disabled = false;
      } else if (m.erro === 'nome') {
        $('erro-entrar').textContent = T[idioma].erroNome;
        $('bt-entrar').disabled = false;
      } else if (m.erro === 'pin') {
        $('erro-entrar').textContent = T[idioma].erroPin;
        $('bt-entrar').disabled = false;
      } else if (m.erro === 'sem-sala') {
        $('erro-entrar').textContent = T[idioma].erroSemSala;
        $('bt-entrar').disabled = false;
      }
      return;
    }

    if (m.t === 'estado') pintar(m);
  };

  ws.onclose = () => {
    $('rodape').textContent = T[idioma].caiu;
    setTimeout(conectar, 1500);
  };
}

function pintar(e) {
  estado = e;
  idioma = e.idioma;
  const t = T[idioma];

  document.documentElement.lang = { pt: 'pt-BR', en: 'en', es: 'es' }[idioma] || 'pt-BR';
  marcarIdioma(e.proprioIdioma ? idioma : '');
  aplicarCores(e.cores);
  $('tit-entrar').textContent = e.quiz ? `${e.emoji || ''} ${e.quiz}`.trim() : 'Quiz do Skee';
  $('sub-entrar').textContent = t.sub;
  $('rot-pin').textContent = t.rotPin;
  $('rot-nome').textContent = t.rotNome;
  $('bt-entrar').textContent = t.entrar;
  $('rodape').textContent = t.rodape;

  if (!token) return mostrar('entrar');

  if (e.fase !== 'fim') festejei = false;

  if (e.fase === 'menu') {
    $('emoji-espera').textContent = '🍿';
    $('ola').textContent = t.ola(e.nome || meuNome);
    $('txt-espera').textContent = t.escolhendo;
    $('contagem-jogadores').textContent = t.naSala(e.jogadores);
    return mostrar('espera');
  }

  if (e.fase === 'lobby') {
    $('emoji-espera').textContent = e.emoji || '🎯';
    $('ola').textContent = t.ola(e.nome || meuNome);
    $('txt-espera').textContent = e.quiz ? `${e.quiz} — ${t.espera}` : t.espera;
    $('contagem-jogadores').textContent = t.naSala(e.jogadores);
    return mostrar('espera');
  }

  if (e.fase === 'pergunta') {
    if (e.q !== ultimaQ) {
      ultimaQ = e.q;
      montarOpcoes(e);
    }
    $('idx-pergunta').textContent = t.pergunta(e.q + 1, e.total);
    $('enunciado').textContent = e.enunciado;
    $('barra').style.width = `${e.duracao ? (e.restante / e.duracao) * 100 : 0}%`;

    const respondi = e.escolha !== null && e.escolha !== undefined;
    [...$('opcoes').children].forEach((b, i) => {
      b.disabled = respondi;
      b.classList.toggle('apagada', respondi && i !== e.escolha);
    });
    return mostrar('pergunta');
  }

  if (e.fase === 'revelacao' || e.fase === 'placar') {
    const respondeu = e.escolha !== null && e.escolha !== undefined;
    const acertou = respondeu && e.escolha === e.correta;
    $('emoji-feedback').textContent = acertou ? '🎉' : respondeu ? '😅' : '⏰';
    $('veredito').textContent = acertou ? t.acertou : respondeu ? t.errou : t.passou;
    $('ganho').textContent = acertou ? `+${e.ganho}` : '';
    $('sequencia').textContent = acertou && e.serie >= 2 ? t.serie(e.serie) : '';
    $('situacao').textContent = `${t.total(e.pontos)} · ${t.posicao(e.posicao, e.jogadores)}`;
    return mostrar('feedback');
  }

  if (e.fase === 'fim') {
    $('emoji-fim').textContent = ['🏆', '🥈', '🥉'][e.posicao - 1] || '🎯';
    $('tit-fim').textContent = t.fim;
    $('resumo-fim').textContent = t.resumo(e.pontos, e.posicao);
    if (!festejei) {
      festejei = true;
      if (e.posicao >= 1 && e.posicao <= 3) {
        confete.estourar(0.5, 0.35, 110);
        setTimeout(() => confete.estourar(0.25, 0.3, 60), 500);
        setTimeout(() => confete.estourar(0.75, 0.3, 60), 1000);
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      }
    }
    const ol = $('podio');
    ol.innerHTML = '';
    (e.podio || []).forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</span>` +
                     `<span></span><span class="pontos"></span>`;
      li.children[1].textContent = p.nome;
      li.children[2].textContent = p.pontos;
      ol.appendChild(li);
    });
    return mostrar('fim');
  }
}

function montarOpcoes(e) {
  const caixa = $('opcoes');
  caixa.innerHTML = '';
  e.opcoes.forEach((texto, i) => {
    const b = document.createElement('button');
    b.className = 'opcao';
    b.dataset.i = i;
    b.innerHTML = `<span class="forma">${FORMAS[i]}</span><span></span>`;
    b.lastChild.textContent = texto;
    b.onclick = () => {
      ws.send(JSON.stringify({ t: 'responder', q: e.q, opcao: i }));
      [...caixa.children].forEach((o, j) => {
        o.disabled = true;
        o.classList.toggle('apagada', j !== i);
      });
      if (navigator.vibrate) navigator.vibrate(20);
    };
    caixa.appendChild(b);
  });
}

/** Destaca o idioma escolhido; sem escolha própria, segue a sala sem destaque fixo. */
function marcarIdioma(escolhido) {
  document.querySelectorAll('#seletor-idioma button').forEach((b) => {
    b.classList.toggle('on', escolhido ? b.dataset.lang === escolhido : b.dataset.lang === idioma);
  });
}

document.querySelectorAll('#seletor-idioma button').forEach((b) => {
  b.onclick = () => {
    meuIdioma = b.dataset.lang;
    localStorage.setItem('quiz-idioma', meuIdioma);
    marcarIdioma(meuIdioma);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'meuIdioma', v: meuIdioma }));
    }
    if (!token) {                       // ainda na tela de entrada: traduz na hora
      idioma = meuIdioma;
      const t = T[idioma];
      $('sub-entrar').textContent = t.sub;
      $('rot-pin').textContent = t.rotPin;
      $('rot-nome').textContent = t.rotNome;
      $('bt-entrar').textContent = t.entrar;
    }
  };
});
marcarIdioma(meuIdioma);
if (meuIdioma && T[meuIdioma]) {         // aplica a escolha guardada antes de conectar
  idioma = meuIdioma;
  const t = T[idioma];
  $('sub-entrar').textContent = t.sub;
  $('rot-pin').textContent = t.rotPin;
  $('rot-nome').textContent = t.rotNome;
  $('bt-entrar').textContent = t.entrar;
}

$('form-entrar').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('nome').value.trim();
  const pin = $('pin').value.trim();
  if (!nome || !pin) return;
  $('bt-entrar').disabled = true;
  $('erro-entrar').textContent = '';
  ws.send(JSON.stringify({ t: 'entrar', nome, pin, idioma: meuIdioma || undefined }));
});

/* PIN na URL (?pin=123456 ou o QR do apresentador) já vem preenchido */
const pinDaUrl = new URLSearchParams(location.search).get('pin');
if (pinDaUrl) $('pin').value = pinDaUrl.replace(/\D/g, '').slice(0, 6);
$('pin').addEventListener('input', (ev) => {
  ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 6);
});
if (meuNome) $('nome').value = meuNome;
if (pinDaUrl && meuNome) $('nome').focus();
conectar();
