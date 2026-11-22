// Arcano Loot & Luck — fogos de artifício na tela inteira (Lendário e Artefato).
// Um <canvas> por cima de tudo, que não recebe cliques e some sozinho no fim.

const OURO = [255, 214, 130];
const PALETAS = {
  legendary: {
    cores: [[255, 147, 38], [255, 200, 80], [255, 96, 64], [255, 240, 190], [255, 70, 120]],
    foguetes: 22, duracao: 5000, chuva: 0
  },
  artifact: {
    cores: [[242, 217, 138], [255, 255, 255], [169, 139, 240], [255, 170, 60], [110, 220, 255], [255, 110, 200]],
    foguetes: 40, duracao: 7500, chuva: 260
  }
};

let emCurso = null;
const sorte = (a, b) => a + Math.random() * (b - a);
const umDe = lista => lista[Math.floor(Math.random() * lista.length)];

/**
 * Solta os fogos. Chamar de novo enquanto ainda estão no ar soma foguetes ao mesmo show.
 * @param {"legendary"|"artifact"} raridade
 */
export function soltarFogos(raridade) {
  const paleta = PALETAS[raridade] ?? PALETAS.legendary;
  if ( emCurso ) return emCurso.somar(paleta);

  const tela = document.createElement("canvas");
  tela.className = "agacha-fogos";
  const escala = Math.min(window.devicePixelRatio || 1, 2);
  const L = window.innerWidth;
  const A = window.innerHeight;
  tela.width = L * escala;
  tela.height = A * escala;
  document.body.append(tela);
  const ctx = tela.getContext("2d");
  ctx.scale(escala, escala);

  const foguetes = [];
  const fagulhas = [];
  const claroes = [];
  let agenda = [];      // lançamentos e chuva de ouro, por instante (ms)
  let fim = 0;
  const inicio = performance.now();

  const agendar = (p, desde) => {
    for ( let k = 0; k < p.foguetes; k++ ) {
      // Uma salva cerrada logo de saída, o grosso espalhado, e um final de novo cerrado.
      let quando;
      if ( k < 6 ) quando = k * 70;
      else if ( k >= p.foguetes - 7 ) quando = p.duracao - 1900 + (k - (p.foguetes - 7)) * 90;
      else quando = sorte(450, p.duracao - 2200);
      agenda.push({quando: desde + quando, foguete: p.cores});
    }
    for ( let k = 0; k < p.chuva; k++ ) agenda.push({quando: desde + sorte(300, p.duracao - 1200), chuva: true});
    agenda.sort((a, b) => a.quando - b.quando);
    fim = Math.max(fim, desde + p.duracao);
  };
  agendar(paleta, 0);

  const lancar = cores => {
    foguetes.push({
      x: L * sorte(0.06, 0.94), y: A + 10,
      vx: sorte(-70, 70),
      vy: -A * sorte(1.0, 1.5),
      alvo: A * sorte(0.1, 0.45),
      cor: umDe(cores), cores
    });
  };

  /** Gota da chuva de ouro (Artefato): cai devagar do alto, piscando. */
  const chover = () => {
    fagulhas.push({
      x: sorte(0, L), y: -10, vx: sorte(-20, 20), vy: sorte(60, 150),
      vida: sorte(2.5, 4), idade: 0, cor: OURO, tam: sorte(1.4, 2.8),
      pisca: true, freio: 1, peso: 30
    });
  };

  const explodir = f => {
    const tipo = Math.random();
    const forca = sorte(260, 460);
    const outra = umDe(f.cores);
    const brotar = (n, velocidade, opcoes) => {
      for ( let k = 0; k < n; k++ ) {
        const ang = (Math.PI * 2 * k) / n + sorte(-0.06, 0.06);
        const vel = velocidade(k);
        fagulhas.push({
          x: f.x, y: f.y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, idade: 0,
          vida: sorte(1.1, 1.9), cor: f.cor, tam: sorte(1.8, 3.4), pisca: Math.random() < 0.3,
          freio: 0.1, peso: 170, ...opcoes?.(k)
        });
      }
    };
    if ( tipo < 0.22 ) {
      // Anel: todas na mesma velocidade, com um segundo anel menor de outra cor
      brotar(90, () => forca);
      brotar(50, () => forca * 0.55, () => ({cor: outra}));
    } else if ( tipo < 0.44 ) {
      // Salgueiro: dourado, cai devagar deixando rastro comprido
      brotar(110, () => forca * sorte(0.3, 0.8), () => ({cor: OURO, vida: sorte(2.2, 3.2), freio: 0.22, peso: 110, pisca: true}));
    } else {
      // Peônia: bola cheia, às vezes em duas cores
      const duas = Math.random() < 0.5;
      brotar(150, () => forca * sorte(0.25, 1), k => ((duas && (k % 2)) ? {cor: outra} : {}));
    }
    claroes.push({x: f.x, y: f.y, cor: f.cor, idade: 0, vida: 0.35, raio: forca * 0.7});
  };

  let anterior = inicio;
  let quadro = 0;
  const desenhar = agora => {
    const t = agora - inicio;
    const dt = Math.min(0.05, (agora - anterior) / 1000);
    anterior = agora;

    while ( agenda.length && (agenda[0].quando <= t) ) {
      const proximo = agenda.shift();
      if ( proximo.chuva ) chover();
      else lancar(proximo.foguete);
    }

    // Rastro: apaga um pouco o quadro anterior, sem escurecer a tela de baixo.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fillRect(0, 0, L, A);
    ctx.globalCompositeOperation = "lighter";

    // Clarão de cada explosão ilumina a tela em volta
    for ( let k = claroes.length - 1; k >= 0; k-- ) {
      const c = claroes[k];
      c.idade += dt;
      if ( c.idade >= c.vida ) { claroes.splice(k, 1); continue; }
      const alfa = 0.3 * (1 - c.idade / c.vida);
      const luz = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.raio);
      luz.addColorStop(0, `rgba(255, 255, 255, ${alfa.toFixed(3)})`);
      luz.addColorStop(0.25, `rgba(${c.cor[0]}, ${c.cor[1]}, ${c.cor[2]}, ${(alfa * 0.6).toFixed(3)})`);
      luz.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = luz;
      ctx.fillRect(c.x - c.raio, c.y - c.raio, c.raio * 2, c.raio * 2);
    }

    for ( let k = foguetes.length - 1; k >= 0; k-- ) {
      const f = foguetes[k];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 380 * dt;
      ctx.fillStyle = `rgba(${f.cor[0]}, ${f.cor[1]}, ${f.cor[2]}, 0.95)`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
      ctx.fill();
      if ( (f.y <= f.alvo) || (f.vy >= -60) ) {
        explodir(f);
        foguetes.splice(k, 1);
      }
    }

    for ( let k = fagulhas.length - 1; k >= 0; k-- ) {
      const p = fagulhas[k];
      p.idade += dt;
      if ( p.idade >= p.vida ) { fagulhas.splice(k, 1); continue; }
      const freio = Math.pow(p.freio, dt);
      p.vx *= freio;
      p.vy = p.vy * freio + p.peso * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      let alfa = 1 - (p.idade / p.vida) ** 2;
      if ( p.pisca && (p.idade > p.vida * 0.45) && ((quadro + k) % 4 < 2) ) alfa *= 0.2;
      const cor = `${p.cor[0]}, ${p.cor[1]}, ${p.cor[2]}`;
      ctx.fillStyle = `rgba(${cor}, ${(alfa * 0.22).toFixed(3)})`;      // halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.tam * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${cor}, ${alfa.toFixed(3)})`;               // miolo
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.tam, 0, Math.PI * 2);
      ctx.fill();
    }

    quadro++;
    if ( (t < fim) || foguetes.length || fagulhas.length ) emCurso.quadro = requestAnimationFrame(desenhar);
    else encerrar();
  };

  const encerrar = () => {
    if ( !emCurso ) return;
    cancelAnimationFrame(emCurso.quadro);
    clearTimeout(emCurso.limite);
    tela.remove();
    emCurso = null;
  };

  emCurso = {
    quadro: 0,
    // Com a aba em segundo plano os quadros param: o relógio garante que a tela não fique presa.
    limite: setTimeout(encerrar, paleta.duracao + 6000),
    somar: p => {
      const agora = performance.now() - inicio;
      agendar(p, agora);
      clearTimeout(emCurso.limite);
      emCurso.limite = setTimeout(encerrar, (fim - agora) + 6000);
    }
  };
  emCurso.quadro = requestAnimationFrame(desenhar);
}
