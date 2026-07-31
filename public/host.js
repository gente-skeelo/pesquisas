/* Tela do apresentador: QR, rodadas, revelação e placar. */

const FORMAS = ['▲', '◆', '●', '■'];

const T = {
  pt: {
    titulo: 'Festas Juninas pelo mundo',
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
    reiniciar: 'Reiniciar',
    naSala: (n) => `${n} na sala`,
    confirmaReinicio: 'Zerar a pontuação de todo mundo e voltar ao lobby?',
    caiu: 'Conexão caiu. Reconectando…',
  },
  en: {
    titulo: 'June festivals around the world',
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
    reiniciar: 'Reset',
    naSala: (n) => `${n} in the room`,
    confirmaReinicio: "Reset everyone's score and go back to the lobby?",
    caiu: 'Connection dropped. Reconnecting…',
  },
};

const $ = (id) => document.getElementById(id);
const telas = ['lobby', 'jogo', 'placar', 'fim'];

let ws = null;
let idioma = 'pt';
let ultimaQ = -1;

const faixa = document.querySelector('.bandeirinhas');
for (let i = 0; i < 60; i++) faixa.appendChild(document.createElement('i'));

function mostrar(qual) {
  telas.forEach((t) => $('tela-' + t).classList.toggle('ativa', t === qual));
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
  };
  ws.onclose = () => {
    $('situacao').textContent = T[idioma].caiu;
    setTimeout(conectar, 1500);
  };
}

function pintar(e) {
  idioma = e.idioma;
  const t = T[idioma];

  document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : 'en';
  $('bt-pt').classList.toggle('on', idioma === 'pt');
  $('bt-en').classList.toggle('on', idioma === 'en');
  $('h-titulo').textContent = t.titulo;
  $('h-aponte').textContent = t.aponte;
  $('h-quem').firstChild.textContent = t.quem + ' ';
  $('h-parcial').textContent = t.parcial;
  $('h-lideres').textContent = t.lideres;
  $('h-fim').textContent = t.fim;
  $('bt-reiniciar').textContent = t.reiniciar;
  $('situacao').textContent = t.naSala(e.jogadores.length);

  const principal = $('bt-principal');
  principal.disabled = false;

  if (e.fase === 'lobby') {
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
      const n = b.querySelector('.n');
      n.textContent = revelando && e.contagem ? e.contagem[i] : '';
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
    pintarLista($('podio'), e.ranking, true);
    principal.textContent = t.reiniciar;
    principal.onclick = () => enviar({ t: 'reiniciar' });
    return mostrar('fim');
  }
}

function pintarLista(ol, lista, medalhas = false) {
  ol.innerHTML = '';
  lista.forEach((r, i) => {
    const li = document.createElement('li');
    if (medalhas && i < 3) li.style.background = 'rgba(255,201,60,.16)';
    li.innerHTML = '<span class="pos"></span><span></span><span class="pontos"></span>';
    li.children[0].textContent = medalhas ? ['🥇', '🥈', '🥉'][i] || r.pos : r.pos;
    li.children[1].textContent = r.nome;
    li.children[2].textContent = r.pontos;
    ol.appendChild(li);
  });
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

$('bt-pt').onclick = () => enviar({ t: 'idioma', v: 'pt' });
$('bt-en').onclick = () => enviar({ t: 'idioma', v: 'en' });
$('bt-reiniciar').onclick = () => {
  if (confirm(T[idioma].confirmaReinicio)) enviar({ t: 'reiniciar' });
};

document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'INPUT') return;
  if (ev.code === 'Space' || ev.code === 'Enter') {
    ev.preventDefault();
    if (!$('bt-principal').disabled) $('bt-principal').click();
  }
});

conectar();
