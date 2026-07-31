/* Confete de festa — canvas leve, sem dependências.
   Uso: const confete = Confete(canvas); confete.estourar(0.5, 0.4, 120); */

window.Confete = function (canvas) {
  const ctx = canvas.getContext('2d');
  const CORES = ['#ffb3c1', '#ffd76a', '#3ddc97', '#a5dcf5', '#ffa87c', '#00b871'];
  let pecas = [];
  let rodando = false;

  function ajustar() {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
  }
  window.addEventListener('resize', ajustar);

  function passo() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pecas = pecas.filter((p) => p.vida > 0 && p.y < canvas.height + 30);
    for (const p of pecas) {
      p.vx *= 0.99;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.vida--;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.vida / 40);
      ctx.fillStyle = p.cor;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (pecas.length) {
      requestAnimationFrame(passo);
    } else {
      rodando = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* nx/ny em fração da tela (0 a 1) */
  function estourar(nx = 0.5, ny = 0.4, quantidade = 90) {
    ajustar();
    const x = nx * canvas.width;
    const y = ny * canvas.height;
    for (let i = 0; i < quantidade; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = (2 + Math.random() * 7) * devicePixelRatio;
      pecas.push({
        x, y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel - 4 * devicePixelRatio,
        g: 0.12 * devicePixelRatio,
        w: (4 + Math.random() * 5) * devicePixelRatio,
        h: (2 + Math.random() * 3) * devicePixelRatio,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        cor: CORES[(Math.random() * CORES.length) | 0],
        vida: 140 + Math.random() * 80,
      });
    }
    if (!rodando) {
      rodando = true;
      requestAnimationFrame(passo);
    }
  }

  return { estourar, parar: () => { pecas = []; } };
};

/* Glitter ambiente: estrelinhas cintilando espalhadas pela tela.
   Roda sozinho em qualquer página que carregue este arquivo. */
(function glitter() {
  const camada = document.createElement('div');
  camada.className = 'glitter';
  camada.setAttribute('aria-hidden', 'true');

  const SIMBOLOS = ['✦', '✧', '✨', '·'];
  const CORES = ['#00b871', '#eda60a', '#3ddc97', '#59c3ea'];

  for (let i = 0; i < 28; i++) {
    const s = document.createElement('i');
    s.textContent = SIMBOLOS[(Math.random() * SIMBOLOS.length) | 0];
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.fontSize = 6 + Math.random() * 12 + 'px';
    s.style.color = CORES[(Math.random() * CORES.length) | 0];
    s.style.setProperty('--d', (2.4 + Math.random() * 3.6).toFixed(2) + 's');
    s.style.setProperty('--a', (Math.random() * 5).toFixed(2) + 's');
    s.style.setProperty('--o', (0.35 + Math.random() * 0.45).toFixed(2));
    camada.appendChild(s);
  }
  document.body.appendChild(camada);
})();
