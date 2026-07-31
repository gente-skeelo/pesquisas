/**
 * Trilha do Quiz do Skee — sintetizada na hora com WebAudio.
 *
 * Sem arquivo de áudio: tudo sai de osciladores, então não pesa no carregamento
 * e não depende de licença de música. Toca só na tela do apresentador, que é
 * quem está ligada na caixa de som; os celulares ficam mudos de propósito.
 *
 * O navegador só libera áudio depois de um clique, então `acordar()` é chamado
 * em qualquer interação e o resto espera por isso.
 */

window.Musica = (function () {
  let ctx = null;
  let mestre = null;
  let ligado = localStorage.getItem('quiz-som') !== 'off';
  let laco = null;             // { parar() } do loop atual
  let cenaAtual = '';

  const ESCALA = [0, 2, 4, 7, 9];                     // pentatônica maior, sempre agradável
  const nota = (grau, oitava = 0) =>
    261.63 * Math.pow(2, oitava + (ESCALA[((grau % 5) + 5) % 5] + 12 * Math.floor(grau / 5)) / 12);

  function acordar() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      mestre = ctx.createGain();
      mestre.gain.value = ligado ? 0.32 : 0;
      mestre.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Uma nota com envelope suave — sem clique no ataque nem no corte. */
  function toca(freq, quando, dur, { tipo = 'triangle', vol = 0.5, glide = 0 } = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, quando);
    if (glide) osc.frequency.exponentialRampToValueAtTime(freq * glide, quando + dur);
    g.gain.setValueAtTime(0.0001, quando);
    g.gain.exponentialRampToValueAtTime(vol, quando + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
    osc.connect(g).connect(mestre);
    osc.start(quando);
    osc.stop(quando + dur + 0.05);
  }

  /** Percussão: um estalo de ruído filtrado. */
  function batida(quando, dur = 0.06, { corte = 6000, vol = 0.35 } = {}) {
    if (!ctx) return;
    const amostras = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, amostras, ctx.sampleRate);
    const dados = buf.getChannelData(0);
    for (let i = 0; i < amostras; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / amostras);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = corte;
    const g = ctx.createGain();
    g.gain.value = vol;
    fonte.connect(filtro).connect(g).connect(mestre);
    fonte.start(quando);
  }

  /** Agenda compassos adiante, pra não depender da precisão do setInterval. */
  function fazerLaco(passoSeg, aoPasso) {
    let n = 0;
    let proximo = ctx.currentTime + 0.06;
    const relogio = setInterval(() => {
      while (proximo < ctx.currentTime + 0.25) {
        aoPasso(n++, proximo);
        proximo += passoSeg;
      }
    }, 60);
    return { parar: () => clearInterval(relogio) };
  }

  function pararLaco() {
    if (laco) laco.parar();
    laco = null;
  }

  /* ---------- cenas ---------- */

  const cenas = {
    /** Lobby: arpejo leve e arejado, dá clima sem competir com a conversa. */
    lobby() {
      laco = fazerLaco(0.4, (n, t) => {
        const passo = n % 8;
        if (passo === 0) toca(nota(0, -2), t, 1.4, { tipo: 'sine', vol: 0.22 });
        toca(nota([0, 2, 4, 6, 4, 2, 3, 1][passo], 0), t, 0.5,
             { tipo: 'triangle', vol: passo % 2 ? 0.10 : 0.16 });
        if (passo === 4) toca(nota(4, 1), t, 0.7, { tipo: 'sine', vol: 0.08 });
      });
    },

    /** Pergunta: pulso constante que vai apertando conforme o tempo cai. */
    pergunta() {
      laco = fazerLaco(0.25, (n, t) => {
        const compasso = n % 8;
        if (compasso % 2 === 0) toca(nota(0, -2), t, 0.22, { tipo: 'sawtooth', vol: 0.13 });
        if (compasso === 4) toca(nota(3, -2), t, 0.22, { tipo: 'sawtooth', vol: 0.13 });
        batida(t, 0.03, { corte: compasso % 4 === 0 ? 2400 : 7000, vol: 0.12 });
        if (compasso === 6) toca(nota(4, 0), t, 0.3, { tipo: 'triangle', vol: 0.09 });
      });
    },

    /** Placar parcial: motivo curto e otimista. */
    placar() {
      const t = ctx.currentTime + 0.02;
      [0, 2, 4].forEach((g, i) => toca(nota(g, 0), t + i * 0.11, 0.4, { vol: 0.3 }));
    },
  };

  /* ---------- eventos pontuais ---------- */

  function revelacao() {
    pararLaco();
    const t = ctx.currentTime + 0.02;
    [0, 4, 7].forEach((semi, i) =>
      toca(261.63 * Math.pow(2, semi / 12) * 2, t + i * 0.07, 0.5, { vol: 0.26 }));
    batida(t, 0.12, { corte: 1800, vol: 0.28 });
  }

  /** Últimos segundos: tique agudo, um por segundo. */
  function tique(restantes) {
    if (!ctx || !ligado) return;
    toca(880 + (5 - restantes) * 90, ctx.currentTime + 0.01, 0.09,
         { tipo: 'square', vol: 0.17 });
  }

  /** Rufar de tambores enquanto o lugar não é revelado. */
  function rufar(segundos = 1.2) {
    if (!ctx) return;
    pararLaco();
    const inicio = ctx.currentTime + 0.02;
    for (let t = 0; t < segundos; t += 0.045) {
      batida(inicio + t, 0.035, { corte: 1500, vol: 0.09 + (t / segundos) * 0.16 });
    }
  }

  /** Fanfarra do pódio: discreta no bronze, generosa no ouro. */
  function fanfarra(posicao) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.03;
    const graus = posicao === 0 ? [0, 2, 4, 5, 7] : posicao === 1 ? [0, 2, 4] : [0, 2];
    graus.forEach((g, i) =>
      toca(nota(g, posicao === 0 ? 1 : 0), t + i * 0.1, 0.55,
           { vol: posicao === 0 ? 0.34 : 0.26 }));
    batida(t, 0.16, { corte: 1400, vol: 0.3 });
    if (posicao === 0) {                                  // acorde final sustentado
      [0, 4, 7, 12].forEach((semi, i) =>
        toca(261.63 * Math.pow(2, semi / 12) * 2, t + 0.55 + i * 0.02, 1.8,
             { tipo: 'triangle', vol: 0.2 }));
    }
  }

  /* ---------- controle ---------- */

  /** Troca a trilha de fundo. Repetir a mesma cena não reinicia o loop. */
  function cena(nome) {
    if (!acordar() || cenaAtual === nome) return;
    cenaAtual = nome;
    pararLaco();
    if (cenas[nome]) cenas[nome]();
  }

  function parar() {
    cenaAtual = '';
    pararLaco();
  }

  function alternar() {
    ligado = !ligado;
    localStorage.setItem('quiz-som', ligado ? 'on' : 'off');
    if (mestre) mestre.gain.setTargetAtTime(ligado ? 0.32 : 0, ctx.currentTime, 0.05);
    return ligado;
  }

  const estaLigado = () => ligado;

  /* qualquer clique libera o áudio do navegador */
  addEventListener('pointerdown', acordar, { once: false, passive: true });
  addEventListener('keydown', acordar, { passive: true });

  return { acordar, cena, parar, revelacao, tique, rufar, fanfarra, alternar, estaLigado };
})();
