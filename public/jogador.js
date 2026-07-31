/* Tela do jogador: entra, responde, vê quanto fez. */

const FORMAS = ['▲', '◆', '●', '■'];

const T = {
  pt: {
    titulo: 'Festas Juninas pelo mundo',
    sub: 'Digite seu nome pra entrar no arraiá.',
    rotNome: 'Seu nome',
    entrar: 'Entrar',
    ola: (n) => `Beleza, ${n}!`,
    espera: 'Aguarde o apresentador começar.',
    naSala: (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'} no arraiá`,
    pergunta: (i, t) => `Pergunta ${i} de ${t}`,
    respondeu: 'Resposta enviada. Segura a ansiedade.',
    acertou: 'Acertou!',
    errou: 'Dessa vez não.',
    passou: 'Você não respondeu.',
    posicao: (p, n) => `${p}º lugar de ${n}`,
    total: (p) => `${p} pontos no total`,
    fim: 'Fim de festa!',
    resumo: (p, pos) => `Você fez ${p} pontos e ficou em ${pos}º.`,
    erroNome: 'Escreva um nome.',
    erroRepetido: 'Esse nome já está na sala. Escolha outro.',
    caiu: 'Conexão caiu. Reconectando…',
    rodape: 'Quiz do Skee · Festas Juninas pelo mundo',
  },
  en: {
    titulo: 'June festivals around the world',
    sub: 'Type your name to join the party.',
    rotNome: 'Your name',
    entrar: 'Join',
    ola: (n) => `You're in, ${n}!`,
    espera: 'Wait for the host to start.',
    naSala: (n) => `${n} ${n === 1 ? 'person' : 'people'} in the room`,
    pergunta: (i, t) => `Question ${i} of ${t}`,
    respondeu: 'Answer locked in. Hold tight.',
    acertou: 'Correct!',
    errou: 'Not this time.',
    passou: "You didn't answer.",
    posicao: (p, n) => `${p} of ${n}`,
    total: (p) => `${p} points in total`,
    fim: "That's a wrap!",
    resumo: (p, pos) => `You scored ${p} points and finished ${pos}.`,
    erroNome: 'Type a name.',
    erroRepetido: 'That name is taken. Pick another.',
    caiu: 'Connection dropped. Reconnecting…',
    rodape: 'Quiz do Skee · June festivals around the world',
  },
};

const $ = (id) => document.getElementById(id);
const telas = ['entrar', 'espera', 'pergunta', 'feedback', 'fim'];

let ws = null;
let token = localStorage.getItem('quiz-token') || '';
let meuNome = localStorage.getItem('quiz-nome') || '';
let idioma = 'pt';
let ultimaQ = -1;
let estado = null;
let festejei = false;
const confete = Confete(document.getElementById('confete'));

/* bandeirinhas */
const faixa = document.querySelector('.bandeirinhas');
for (let i = 0; i < 40; i++) faixa.appendChild(document.createElement('i'));

function mostrar(qual) {
  telas.forEach((t) => $('tela-' + t).classList.toggle('ativa', t === qual));
}

function conectar() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => {
    $('erro-entrar').textContent = '';
    if (token) ws.send(JSON.stringify({ t: 'voltar', token }));
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

  document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : 'en';
  $('tit-entrar').textContent = t.titulo;
  $('sub-entrar').textContent = t.sub;
  $('rot-nome').textContent = t.rotNome;
  $('bt-entrar').textContent = t.entrar;
  $('rodape').textContent = t.rodape;

  if (!token) return mostrar('entrar');

  if (e.fase !== 'fim') festejei = false;

  if (e.fase === 'lobby') {
    $('ola').textContent = t.ola(e.nome || meuNome);
    $('txt-espera').textContent = t.espera;
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
    $('situacao').textContent = `${t.total(e.pontos)} · ${t.posicao(e.posicao, e.jogadores)}`;
    return mostrar('feedback');
  }

  if (e.fase === 'fim') {
    $('emoji-fim').textContent = ['🏆', '🥈', '🥉'][e.posicao - 1] || '🌽';
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

$('form-entrar').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('nome').value.trim();
  if (!nome) return;
  $('bt-entrar').disabled = true;
  $('erro-entrar').textContent = '';
  ws.send(JSON.stringify({ t: 'entrar', nome }));
});

if (meuNome) $('nome').value = meuNome;
conectar();
