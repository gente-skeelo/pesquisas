/* Confete de festa — canvas leve, sem dependências.
   Uso: const confete = Confete(canvas); confete.estourar(0.5, 0.4, 120); */

window.Confete = function (canvas) {
  const ctx = canvas.getContext('2d');
  const CORES = ['#ef476f', '#ffc93c', '#06d6a0', '#4cc9f0', '#ff6b35', '#fff6e5'];
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
