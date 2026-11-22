// Arcano Loot & Luck — janela do sorteio (cartas), janela do pool e assinatura Arcano Lab.

import {
  ID, t, esc, RARIDADES, ORDEM, nivel, nomeRaridade, raridadeDe, entrada, lerPool, salvarPool,
  chancesPorRaridade, porcento, sortear, sorteDe, comSorte, garantiaDosDados, destinatarios, entregar,
  resultadoNoChat, lerBaralhos, salvarBaralhos, ativarBaralho, baralhoAtivo, garantiaAcumulada, contarParaGarantia,
  ouroDe, cobrar, registrarHistorico, listaDeItens
} from "./nucleo.mjs";
import {soltarFogos} from "./fogos.mjs";
import {bonecoSVG, GESTOS} from "./boneco.mjs";

const {ApplicationV2, DialogV2} = foundry.applications.api;

/* ------------------------------------------------------------------ */
/*  Assinatura Arcano Lab                                              */
/* ------------------------------------------------------------------ */

const PATREON = "https://www.patreon.com/arcanolab";
const LOGO = `modules/${ID}/assets/arcanolab.svg`;

/** Assinatura Arcano Lab com link do Patreon (janelas do módulo e configurações). */
export const assinaturaHTML = () => `
  <footer class="agacha-assinatura">
    <div class="agacha-marca">
      <img src="${LOGO}" alt="Arcano Lab">
      <div>
        <strong>${esc(t("Nome"))}</strong>
        <span>${esc(t("Assinatura.by"))}</span>
        <em>${esc(t("Assinatura.tagline"))}</em>
      </div>
    </div>
    <a class="agacha-patreon" href="${PATREON}" target="_blank" rel="noopener">
      <i class="fa-brands fa-patreon"></i> ${esc(t("Assinatura.cta"))}
    </a>
  </footer>`;

export function assinarConfiguracoes(app, elemento) {
  const raiz = elemento instanceof HTMLElement ? elemento : elemento?.[0];
  const campo = raiz?.querySelector(`[name="${ID}.idioma"]`);
  if ( !campo ) return;
  const caixa = campo.closest(".tab[data-tab]") ?? campo.closest("section") ?? campo.closest(".form-group")?.parentElement;
  if ( !caixa || caixa.querySelector(".agacha-assinatura") ) return;
  const div = document.createElement("div");
  div.className = "agacha agacha-cfg-assinatura";
  div.innerHTML = assinaturaHTML();
  caixa.append(div);
}

async function abrirItem(uuid) {
  const doc = await fromUuid(uuid).catch(() => null);
  if ( !doc ) return ui.notifications.warn(t("Aviso.NaoEncontrado", {nome: uuid}));
  if ( !doc.testUserPermission(game.user, "LIMITED") ) return ui.notifications.warn(t("Aviso.SemPermissao"));
  doc.sheet.render(true);
}

/* ------------------------------------------------------------------ */
/*  Janela do sorteio                                                  */
/* ------------------------------------------------------------------ */

const QUANTIDADES = [1, 3, 5, 10];
const EMBARALHAR_MS = 1700; // o mago embaralha antes de distribuir
const ENTRADA_MS = 420;     // intervalo entre as cartas chegando à mesa (o Mordisco cospe uma por vez)
const VIRADA_MS = 600;      // duração do giro da carta (igual à transição do CSS)

/**
 * Espetáculo de cada raridade.
 * suspense: tempo que a carta fica "carregando" antes de virar (ms); pausa: tempo até a próxima carta
 * na revelação em sequência; faiscas: quantas saem na revelação; clarao: clarão no palco;
 * fogos: fogos de artifício na tela inteira.
 */
const EFEITOS = {
  common:    {suspense: 0,    pausa: 520,  faiscas: 0,  clarao: false, fogos: false},
  uncommon:  {suspense: 0,    pausa: 620,  faiscas: 8,  clarao: false, fogos: false},
  rare:      {suspense: 450,  pausa: 800,  faiscas: 14, clarao: false, fogos: false},
  veryRare:  {suspense: 800,  pausa: 1000, faiscas: 22, clarao: false, fogos: false},
  legendary: {suspense: 1300, pausa: 2600, faiscas: 34, clarao: true,  fogos: true},
  artifact:  {suspense: 1800, pausa: 3600, faiscas: 46, clarao: true,  fogos: true}
};

const SONS = `modules/${ID}/sounds`;
// Cartas, moedas, fogos e música são gravações CC0 (ver sounds/CREDITS.md). O suspense e as revelações
// são sintetizados (ferramentas/gerar_sons.py e gerar_revelacoes.py): harpa e caixinha de música com eco.
const SOM = {
  carta: `${SONS}/carta.ogg`,
  virar: `${SONS}/virar.ogg`,
  entrega: `${SONS}/entrega.ogg`,
  fogos: `${SONS}/fogos.ogg`,
  embaralhar: `${SONS}/embaralhar.ogg`,
  musica: `${SONS}/musica.mp3`,
  suspense: r => (["veryRare", "legendary", "artifact"].includes(r) ? `${SONS}/suspense-${r}.wav` : null),
  revelar: r => `${SONS}/revelar-${r in RARIDADES ? r : "common"}.wav`
};
const DESTAQUE_MS = 450;   // a carta rara voa ao centro do palco, e depois volta

/* O mascote (Mordisco, o filhote de mímico): três poses e as falas dele (quantas variações de cada fala
   existem no idioma). */
const HUMORES = ["capa", "embaralha", "revela"];
const mago = humor => `modules/${ID}/assets/mascote-${humor}.webp`;
const FALAS = {
  boasVindas: 3, vazio: 1, espera: 2, pedeDado: 1, quantidade: 2, embaralha: 3, mesa: 2, fim: 2, sorte: 2,
  common: 2, uncommon: 2, rare: 2, veryRare: 2, legendary: 2, artifact: 2
};

export class GachaApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "agacha-sorteio",
    classes: ["agacha", "agacha-sorteio"],
    window: {icon: "agacha-icone", resizable: false},
    position: {width: 1120, height: "auto"},
    actions: {
      sortear: GachaApp.#aoSortear,
      rolarQuantidade: GachaApp.#aoRolarQuantidade,
      pool: GachaApp.#aoAbrirPool,
      revelarTudo: GachaApp.#aoRevelarTudo,
      pular: GachaApp.#aoPular,
      chat: GachaApp.#aoChat,
      capa: GachaApp.#aoVoltarCapa,
      carta: GachaApp.#aoClicarCarta,
      entregarTudo: GachaApp.#aoEntregarTudo,
      pedirSorte: GachaApp.#aoPedirSorte,
      rolarSorte: GachaApp.#aoRolarSorte,
      limparSorte: GachaApp.#aoLimparSorte,
      ajustarSorte: GachaApp.#aoAjustarSorte
    }
  };

  static #instancia = null;
  static get instancia() { return (this.#instancia ??= new this()); }

  /** Itens da mesa, na ordem das cartas. */
  itens = [];
  /** "parado" (capa) | "embaralhando" | "mesa" (cartas viradas para baixo) | "animando" (em sequência) | "pronto" */
  fase = "parado";
  /** Quem fez o sorteio, quando esta janela só assiste. */
  mestre = null;
  /** Índices das cartas já reveladas. */
  reveladas = new Set();
  /** índice da carta → nome de quem recebeu */
  entregues = {};
  /** Dados da sorte (mestre): id do usuário → {nome, total}. Valem para o próximo sorteio. */
  rolagens = new Map();
  /** O mestre já pediu os dados aos jogadores? */
  sortePedida = false;
  /** Sorte (0 a 1) usada no sorteio que está na mesa. */
  sorteUsada = 0;
  /** Jogador: o mestre pediu um dado e eu ainda não rolei / quanto tirei. */
  pedido = false;
  minhaRolagem = null;
  /** Pose e fala do mago. */
  humor = "capa";
  fala = "";

  /** Mesa (mestre): {jogador, modo, escolhas, custo}. Lida da configuração "mesa" na primeira vez. */
  mesa = null;
  /** O sorteio que está na mesa: quem joga, modo ("todas" | "escolher") e quantas cartas escolhe. */
  jogadorAtual = "";
  modoAtual = "todas";
  escolhasAtual = 1;
  /** Índices das cartas que ficaram de fora no modo "escolher". */
  descartadas = new Set();

  #relogios = [];
  #rodada = 0;
  #ocupadas = new Set();
  #chegando = false;
  #fechada = false;
  #musica = null;
  #calar = null;
  #vida = null;
  #fimEmocao = null;
  #ultimoGesto = Date.now();
  #proximoGesto = 5000;
  #ultimoMovimento = Date.now();

  get title() { return t("Titulo"); }

  /** Configuração da mesa (mestre). */
  get cfgMesa() {
    if ( !this.mesa ) {
      const salvo = game.settings.get(ID, "mesa") ?? {};
      this.mesa = {
        jogador: game.users.get(salvo.jogador) ? salvo.jogador : "",
        modo: salvo.modo === "escolher" ? "escolher" : "todas",
        escolhas: Math.clamp(Math.round(Number(salvo.escolhas)) || 1, 1, 9),
        custo: Math.max(0, Math.round(Number(salvo.custo)) || 0)
      };
    }
    return this.mesa;
  }

  /** Nesta janela, sou eu quem vira as cartas? (o jogador escolhido pelo mestre) */
  get jogando() { return this.assistindo && (this.jogadorAtual === game.user.id); }

  /** Cartas que valem: todas as reveladas que não foram descartadas. */
  get ganhos() { return this.itens.filter((_, i) => this.reveladas.has(i) && !this.descartadas.has(i)); }

  /** Já foram reveladas todas as cartas que este sorteio pede? */
  get #completo() {
    if ( this.modoAtual === "escolher" ) return this.reveladas.size >= this.escolhasAtual;
    return this.reveladas.size >= this.itens.length;
  }

  get assistindo() { return this.mestre !== null; }

  /** Sorte acumulada dos dados (0 a 1). */
  get sorte() { return sorteDe(this.#totais); }

  get #totais() { return Array.from(this.rolagens.values(), r => r.total); }

  /** Raridade que os dados já garantem no próximo sorteio ("none" = nenhuma). */
  get garantiaDosDados() {
    return garantiaDosDados(this.#totais, {
      critico: game.settings.get(ID, "sorteCritico"),
      minimo: game.settings.get(ID, "sorteMinimo"),
      garante: game.settings.get(ID, "sorteGarante")
    });
  }

  get #publico() { return !this.assistindo && game.settings.get(ID, "mostrarJogadores"); }

  #emitir(dados) {
    if ( this.#publico ) game.socket.emit(`module.${ID}`, dados);
  }

  /* ---------- Entradas ---------- */

  /** Abre a janela do mestre na capa (e a capa dos jogadores, se o sorteio for público). */
  static abrir() {
    if ( !game.user.isGM ) return ui.notifications.warn(t("Aviso.SoMestre"));
    const app = this.instancia;
    if ( app.assistindo && !["embaralhando", "mesa", "animando"].includes(app.fase) ) app.#limpar();
    if ( !app.rendered && (app.fase === "parado") ) {
      app.#escolherFala(lerPool().length ? "boasVindas" : "vazio");
      app.#emitir({acao: "capa", mestre: game.user.name});
    }
    app.render({force: true});
    return app;
  }

  /** Mensagens que chegam dos outros usuários pelo soquete. */
  static receber(dados) {
    const app = this.instancia;
    const jogador = !game.user.isGM;
    switch ( dados?.acao ) {
      case "capa": return jogador ? app.#capaDoJogador(dados) : null;
      case "fechar":
        if ( jogador && app.rendered && app.assistindo ) app.close();
        return null;
      case "sorteio": return app.#assistir(dados);
      case "revelar": return app.assistindo ? app.#revelarCarta(Number(dados.i)) : null;
      case "querRevelar":   // o jogador da vez clicou numa carta: quem vira (e avisa a todos) é o mestre
        if ( !jogador && !app.assistindo && (dados.userId === app.jogadorAtual) ) app.revelar(Number(dados.i));
        return null;
      case "revelarTudo": return app.assistindo ? app.#sequencia() : null;
      case "pular": return app.assistindo ? app.#pular() : null;
      case "entrega":
        if ( app.rendered && app.assistindo && app.itens[dados.i] ) app.#marcarEntrega(Number(dados.i), String(dados.nome ?? ""));
        return null;
      case "pedirSorte": return jogador ? app.#pedidoDeSorte(dados) : null;
      case "sorte": return jogador ? null : app.#registrarSorte(dados);
      case "sorteFim":
        if ( jogador && app.pedido ) { app.pedido = false; app.minhaRolagem = null; if ( app.rendered ) app.render(); }
        return null;
    }
  }

  /** Jogador: o mestre abriu a tenda do mago. */
  async #capaDoJogador({mestre}) {
    if ( this.fase !== "parado" ) return;
    this.mestre = String(mestre ?? "");
    this.#escolherFala("espera");
    await this.render({force: true});
  }

  async #assistir({itens, mestre, sorte, jogador, modo, escolhas}) {
    if ( !Array.isArray(itens) || !itens.length ) return;
    this.#pararRelogios();
    this.itens = itens.map(entrada);
    this.mestre = String(mestre ?? "");
    this.sorteUsada = Number(sorte) || 0;
    this.entregues = {};
    this.reveladas = new Set();
    this.descartadas = new Set();
    this.jogadorAtual = String(jogador ?? "");
    this.modoAtual = modo === "escolher" ? "escolher" : "todas";
    this.escolhasAtual = Math.max(1, Number(escolhas) || 1);
    this.pedido = false;
    await this.#entrar();
  }

  /** Sorteia: o mago embaralha e distribui as cartas viradas para baixo. Devolve os itens sorteados. */
  async sortear(quantidade) {
    const pool = lerPool();
    if ( !pool.length ) { ui.notifications.warn(t("Aviso.PoolVazio")); return []; }
    if ( ["embaralhando", "animando"].includes(this.fase) ) return [];
    // Custo da rodada: sai do ouro do personagem de quem joga.
    const mesa = this.cfgMesa;
    if ( mesa.custo > 0 ) {
      const pagador = game.users.get(mesa.jogador)?.character;
      if ( !pagador ) { ui.notifications.warn(t("Aviso.SemPagador")); return []; }
      const ouro = ouroDe(pagador);
      if ( ouro === null ) { ui.notifications.warn(t("Aviso.SemMoedas", {nome: pagador.name})); return []; }
      if ( ouro < mesa.custo ) {
        ui.notifications.warn(t("Aviso.SemOuro", {nome: pagador.name, tem: ouro, custo: mesa.custo}));
        return [];
      }
      await cobrar(pagador, mesa.custo);
    }

    this.#pararRelogios();
    this.mestre = null;
    this.entregues = {};
    this.reveladas = new Set();
    this.descartadas = new Set();
    this.#fechada = false;
    this.sorteUsada = this.sorte;
    const acumulada = garantiaAcumulada();
    this.itens = sortear(pool, quantidade, {
      semRepeticao: game.settings.get(ID, "semRepeticao"),
      garantia: game.settings.get(ID, "garantia"),
      sorte: this.sorteUsada,
      forca: game.settings.get(ID, "forcaSorte"),
      garantiaSorte: this.garantiaDosDados,
      garantiaAcumulada: acumulada.garante ? acumulada.raridade : "none"
    });
    this.jogadorAtual = mesa.jogador;
    // "Escolher" só faz sentido com mais cartas na mesa do que escolhas.
    this.modoAtual = (mesa.modo === "escolher") && (this.itens.length > mesa.escolhas) ? "escolher" : "todas";
    this.escolhasAtual = mesa.escolhas;
    // Os dados valem para um sorteio só.
    this.rolagens = new Map();
    this.sortePedida = false;
    this.#emitir({
      acao: "sorteio", itens: this.itens, mestre: game.user.name, sorte: this.sorteUsada,
      jogador: this.jogadorAtual, modo: this.modoAtual, escolhas: this.escolhasAtual
    });
    await this.#entrar();
    return this.itens;
  }

  /** Revela uma carta (mestre). */
  revelar(i) {
    if ( this.assistindo || (this.fase !== "mesa") || this.reveladas.has(i) ) return;
    this.#emitir({acao: "revelar", i});
    return this.#revelarCarta(i);
  }

  /** Revela em sequência as cartas que faltam (mestre). */
  revelarTudo() {
    if ( this.assistindo || (this.fase !== "mesa") ) return;
    this.#emitir({acao: "revelarTudo"});
    return this.#sequencia();
  }

  #limpar() {
    this.#pararRelogios();
    this.itens = [];
    this.entregues = {};
    this.reveladas = new Set();
    this.descartadas = new Set();
    this.jogadorAtual = "";
    this.modoAtual = "todas";
    this.mestre = null;
    this.sorteUsada = 0;
    this.pedido = false;
    this.minhaRolagem = null;
    this.humor = "capa";
    this.fase = "parado";
  }

  /* ---------- O mago ---------- */

  #escolherFala(tipo, dados) {
    const n = FALAS[tipo] ?? 1;
    this.fala = t(`Fala.${tipo}${1 + Math.floor(Math.random() * n)}`, dados);
  }

  /** Troca a fala (e, se pedido, a pose) do mago sem redesenhar a janela. */
  #falar(tipo, dados, humor) {
    this.#escolherFala(tipo, dados);
    if ( humor ) this.humor = humor;
    const caixa = this.element?.querySelector(".agacha-mago");
    if ( !caixa ) return;
    const balao = caixa.querySelector(".agacha-fala");
    balao.textContent = this.fala;
    balao.classList.remove("nova");
    void balao.offsetWidth;
    balao.classList.add("nova");
    caixa.querySelectorAll("img[data-humor]").forEach(img => img.classList.toggle("on", img.dataset.humor === this.humor));
    for ( const h of HUMORES ) caixa.classList.toggle(`humor-${h}`, h === this.humor);
    // Um pulinho a cada fala nova; o boneco também bate a tampa como quem fala.
    const pulo = caixa.querySelector(".agacha-mascote-pulo");
    const boneco = caixa.querySelector(".agacha-boneco");
    if ( boneco ) {
      for ( const h of HUMORES ) boneco.classList.toggle(`bn-${h}`, h === this.humor);
      boneco.classList.remove("falando");
      void boneco.getBoundingClientRect();
      boneco.classList.add("falando");
      clearTimeout(this.#calar);
      this.#calar = setTimeout(() => boneco.classList.remove("falando"), 1400);
    } else if ( pulo ) {
      pulo.classList.remove("pulando");
      void pulo.offsetWidth;
      pulo.classList.add("pulando");
    }
  }

  #magoHTML() {
    const brilhos = [[14, 16, 0], [80, 10, 0.7], [90, 44, 1.5], [8, 52, 2.1], [70, 70, 0.4], [24, 78, 1.2], [50, 4, 1.9]];
    return `
      <aside class="agacha-mago humor-${this.humor} ${game.settings.get(ID, "mascote") === "boneco" ? "com-boneco" : ""}">
        <div class="agacha-mascote">
          <div class="agacha-mascote-pulo">
            ${game.settings.get(ID, "mascote") === "boneco" ? bonecoSVG(this.humor) : HUMORES.map(h =>
              `<img data-humor="${h}" class="${h === this.humor ? "on" : ""}" src="${mago(h)}" alt=""
                    draggable="false" onerror="this.remove()">`).join("")}
          </div>
          ${brilhos.map(([x, y, d]) => `<i class="agacha-brilho" style="--x:${x}%; --y:${y}%; --d:${d}s"></i>`).join("")}
        </div>
        <div class="agacha-balao">
          <div class="agacha-mago-nome">${esc(t("Mago.Nome"))}</div>
          <p class="agacha-fala nova">${esc(this.fala)}</p>
        </div>
      </aside>`;
  }

  /* ---------- Reações do boneco ---------- */

  get #boneco() { return this.element?.querySelector(".agacha-boneco") ?? null; }

  /** Emoção passageira: "ansioso", "meh", "feliz", "uau" ou "guloso". */
  #emocao(nome, ms=1700) {
    const b = this.#boneco;
    if ( !b ) return;
    this.#ultimoMovimento = Date.now();
    for ( const c of [...b.classList] ) {
      if ( c.startsWith("em-") || c.startsWith("gesto-") || (c === "dormindo") ) b.classList.remove(c);
    }
    void b.getBoundingClientRect();
    b.classList.add(`em-${nome}`);
    clearTimeout(this.#fimEmocao);
    this.#fimEmocao = setTimeout(() => b.classList.remove(`em-${nome}`), ms);
    this.#ultimoGesto = Date.now();
  }

  /** Liga uma classe por um instante (ex.: "cuspindo" a cada carta distribuída). */
  #pulso(classe, ms) {
    const b = this.#boneco;
    if ( !b ) return;
    b.classList.remove(classe);
    void b.getBoundingClientRect();
    b.classList.add(classe);
    setTimeout(() => b.classList.remove(classe), ms);
  }

  /** Como ele reage a cada raridade revelada (Lendário e Artefato já têm a pose de festa). */
  #reagir(raridade) {
    if ( raridade === "common" ) this.#emocao("meh", 1900);
    else if ( raridade === "uncommon" ) this.#emocao("feliz", 1500);
    else if ( raridade === "rare" ) this.#emocao("feliz", 2000);
    else if ( raridade === "veryRare" ) this.#emocao("uau", 2400);
  }

  /** Uma vez por segundo: cochila se ninguém mexe na janela; senão, de vez em quando faz uma mania. */
  #vidaPropria() {
    const b = this.#boneco;
    if ( !b || !this.rendered ) return;
    const agora = Date.now();
    const quieto = ["parado", "mesa", "pronto"].includes(this.fase);
    const ocupado = [...b.classList].some(c => c.startsWith("em-") || c.startsWith("gesto-") || (c === "falando"));
    if ( !quieto || ocupado ) return;
    if ( agora - this.#ultimoMovimento > 40000 ) { b.classList.add("dormindo"); return; }
    if ( b.classList.contains("dormindo") || (agora - this.#ultimoGesto < this.#proximoGesto) ) return;
    const nomes = Object.keys(GESTOS);
    const gesto = nomes[Math.floor(Math.random() * nomes.length)];
    b.classList.add(gesto);
    setTimeout(() => b.classList.remove(gesto), GESTOS[gesto]);
    this.#ultimoGesto = agora;
    this.#proximoGesto = 4500 + Math.random() * 5000;
  }

  /* ---------- Desenho ---------- */

  #sorteHTML() {
    if ( !game.settings.get(ID, "dadosSorte") ) return "";
    const fichas = Array.from(this.rolagens.values(), r =>
      `<span class="agacha-ficha ${r.total >= 20 ? "critico" : ""}">${esc(r.nome)} <b>${r.total}</b></span>`);
    if ( this.sortePedida ) {
      for ( const u of game.users.filter(u => u.active && !u.isGM && !this.rolagens.has(u.id)) ) {
        fichas.push(`<span class="agacha-ficha esperando">${esc(u.name)} <b>…</b></span>`);
      }
    }
    const garante = this.garantiaDosDados;
    const valor = this.rolagens.size
      ? `<span class="agacha-sorte-valor">${esc(t("Sorte.Valor", {p: Math.round(this.sorte * 100)}))}</span>
         ${garante !== "none" ? `<span class="agacha-sorte-garante rar-${garante}">${
           esc(t("Sorte.Garante", {raridade: nomeRaridade(garante)}))}</span>` : ""}`
      : `<span class="agacha-sorte-dica">${esc(t("Sorte.Dica"))}</span>`;
    return `
      <div class="agacha-sorte">
        <span class="agacha-sorte-titulo"><i class="fa-solid fa-dice-d20" inert></i> ${esc(t("Sorte.Titulo"))}</span>
        <span class="agacha-fichas">${fichas.join("")}</span>
        ${valor}
        <span class="agacha-sorte-botoes">
          <button type="button" class="agacha-botao agacha-discreto agacha-mini" data-action="pedirSorte"
                  data-tooltip-text="${esc(t("Sorte.PedirDica"))}">
            <i class="fa-solid fa-bullhorn" inert></i> ${esc(t("Sorte.Pedir"))}
          </button>
          <button type="button" class="agacha-botao agacha-discreto agacha-mini" data-action="rolarSorte"
                  data-tooltip-text="${esc(t("Sorte.RolarMestreDica"))}">
            <i class="fa-solid fa-dice-d20" inert></i> ${esc(t("Sorte.RolarMestre"))}
          </button>
          ${this.rolagens.size || this.sortePedida ? `
          <button type="button" class="agacha-botao agacha-discreto agacha-mini" data-action="limparSorte"
                  data-tooltip-text="${esc(t("Sorte.Limpar"))}" aria-label="${esc(t("Sorte.Limpar"))}">
            <i class="fa-solid fa-xmark" inert></i>
          </button>` : ""}
          <button type="button" class="agacha-botao agacha-discreto agacha-mini" data-action="ajustarSorte"
                  data-tooltip-text="${esc(t("Sorte.Ajustar"))}" aria-label="${esc(t("Sorte.Ajustar"))}">
            <i class="fa-solid fa-sliders" inert></i>
          </button>
        </span>
      </div>`;
  }

  /** Faixa da mesa (mestre): baralho, quem joga, modo e custo da rodada. */
  #mesaHTML() {
    const mesa = this.cfgMesa;
    const {ativo, lista} = lerBaralhos();
    const jogadores = game.users.filter(u => !u.isGM);
    return `
      <div class="agacha-mesa-cfg">
        <label data-tooltip-text="${esc(t("Mesa.BaralhoDica"))}">
          <i class="fa-solid fa-layer-group" inert></i> ${esc(t("Mesa.Baralho"))}
          <select data-mesa="baralho">
            ${lista.map(b => `<option value="${esc(b.id)}" ${b.id === ativo ? "selected" : ""}>${esc(b.nome)} (${b.itens.length})</option>`).join("")}
          </select>
        </label>
        <label data-tooltip-text="${esc(t("Mesa.JogadorDica"))}">
          <i class="fa-solid fa-user" inert></i> ${esc(t("Mesa.Jogador"))}
          <select data-mesa="jogador">
            <option value="">${esc(t("Mesa.Mestre"))}</option>
            ${jogadores.map(u => `<option value="${u.id}" ${u.id === mesa.jogador ? "selected" : ""}>${esc(u.name)}${
              u.character ? ` (${esc(u.character.name)})` : ""}${u.active ? "" : " ·"}</option>`).join("")}
          </select>
        </label>
        <label data-tooltip-text="${esc(t("Mesa.ModoDica"))}">
          <i class="fa-solid fa-hand-pointer" inert></i> ${esc(t("Mesa.Modo"))}
          <select data-mesa="modo">
            <option value="todas" ${mesa.modo === "todas" ? "selected" : ""}>${esc(t("Mesa.ModoTodas"))}</option>
            <option value="escolher" ${mesa.modo === "escolher" ? "selected" : ""}>${esc(t("Mesa.ModoEscolher"))}</option>
          </select>
          ${mesa.modo === "escolher" ? `<input type="number" data-mesa="escolhas" min="1" max="9" step="1" value="${mesa.escolhas}"
               aria-label="${esc(t("Mesa.Escolhas"))}" data-tooltip-text="${esc(t("Mesa.Escolhas"))}">` : ""}
        </label>
        <label data-tooltip-text="${esc(t("Mesa.CustoDica"))}">
          <i class="fa-solid fa-coins" inert></i> ${esc(t("Mesa.Custo"))}
          <input type="number" data-mesa="custo" min="0" step="1" value="${mesa.custo}"> ${esc(t("Mesa.Po"))}
        </label>
      </div>`;
  }

  async #aoMudarMesa(campo) {
    const mesa = this.cfgMesa;
    const qual = campo.dataset.mesa;
    if ( qual === "baralho" ) await ativarBaralho(campo.value);
    else {
      if ( qual === "jogador" ) mesa.jogador = campo.value;
      else if ( qual === "modo" ) mesa.modo = campo.value === "escolher" ? "escolher" : "todas";
      else if ( qual === "escolhas" ) mesa.escolhas = Math.clamp(Math.round(Number(campo.value)) || 1, 1, 9);
      else if ( qual === "custo" ) mesa.custo = Math.max(0, Math.round(Number(campo.value)) || 0);
      await game.settings.set(ID, "mesa", {...mesa});
    }
    if ( ["parado", "pronto"].includes(this.fase) ) return this.render();
    const faixa = this.element.querySelector(".agacha-mesa-cfg");
    if ( faixa ) faixa.outerHTML = this.#mesaHTML();
    this.#ligarMesa();
  }

  #ligarMesa() {
    this.element.querySelectorAll("[data-mesa]").forEach(campo => {
      campo.addEventListener("change", () => this.#aoMudarMesa(campo));
    });
  }

  /** Capa do mestre: título, números do pool, chances (já com a sorte) e o dado de quantas cartas. */
  #capaHTML(pool) {
    if ( !pool.length ) return `
      <div class="agacha-capa">
        ${tituloCapa()}
        <p class="agacha-alerta">${esc(t("PoolVazio"))}</p>
        <button type="button" class="agacha-botao agacha-ouro agacha-grande" data-action="pool">
          <i class="fa-solid fa-layer-group" inert></i> ${esc(t("ConfigurarPool"))}
        </button>
      </div>`;
    const comDados = comSorte(pool, this.sorte, game.settings.get(ID, "forcaSorte"));
    const chances = chancesPorRaridade(comDados);
    const maior = Math.max(...chances.map(c => c.chance));
    const barras = chances.map(c => `
      <li class="rar-${c.raridade}">
        <span>${esc(nomeRaridade(c.raridade))}</span>
        <i><b style="width:${(c.chance / maior * 100).toFixed(1)}%"></b></i>
        <em>${porcento(c.chance)}</em>
      </li>`).join("");
    const garante = this.garantiaDosDados;
    return `
      <div class="agacha-capa">
        ${tituloCapa()}
        <div class="agacha-quadros">
          <div class="agacha-quadro">
            <b>${pool.length}</b><span>${esc(t("Capa.Itens"))}</span>
          </div>
          <div class="agacha-quadro">
            <b>${Math.round(this.sorte * 100)}%</b><span>${esc(t("Capa.Sorte"))}</span>
            ${garante !== "none" ? `<small class="rar-${garante}">${esc(t("Sorte.Garante", {raridade: nomeRaridade(garante)}))}</small>` : ""}
          </div>
          <ul class="agacha-quadro agacha-barras" data-tooltip-text="${esc(t("Capa.ChancesDica"))}">${barras}</ul>
        </div>
        ${this.#avisosCapa()}
        <button type="button" class="agacha-botao agacha-ouro agacha-grande" data-action="rolarQuantidade">
          <i class="fa-solid fa-dice-d10" inert></i> ${esc(t("Capa.RolarQuantidade"))}
        </button>
        <p class="agacha-dica">${esc(t("Capa.OuEscolha"))}</p>
      </div>`;
  }

  /** Linha da capa com o que vale nesta rodada: garantia acumulada, quem joga, modo e custo. */
  #avisosCapa() {
    const mesa = this.cfgMesa;
    const avisos = [];
    const g = garantiaAcumulada();
    if ( g.ligada ) avisos.push(`<span class="rar-${g.raridade}"><i class="fa-solid fa-shield-heart" inert></i> ${
      esc(g.garante ? t("Capa.AcumuladaAgora", {raridade: nomeRaridade(g.raridade)})
        : t("Capa.AcumuladaFaltam", {n: g.faltam, raridade: nomeRaridade(g.raridade)}))}</span>`);
    const jogador = game.users.get(mesa.jogador);
    if ( jogador ) avisos.push(`<span><i class="fa-solid fa-user" inert></i> ${esc(t("Capa.Joga", {nome: jogador.name}))}</span>`);
    if ( mesa.modo === "escolher" ) avisos.push(`<span><i class="fa-solid fa-hand-pointer" inert></i> ${
      esc(t("Capa.Escolhe", {n: mesa.escolhas}))}</span>`);
    if ( mesa.custo > 0 ) avisos.push(`<span><i class="fa-solid fa-coins" inert></i> ${esc(t("Capa.Custa", {valor: mesa.custo}))}</span>`);
    return avisos.length ? `<p class="agacha-avisos">${avisos.join("")}</p>` : "";
  }

  /** Capa de quem assiste: espera o mestre, ou rola o dado da sorte quando ele pede. */
  #capaJogadorHTML() {
    const pedido = !this.pedido ? "" : (this.minhaRolagem === null
      ? `<p class="agacha-pedido">${esc(t("Sorte.Pedido", {nome: this.mestre ?? ""}))}</p>
         <button type="button" class="agacha-botao agacha-ouro agacha-grande" data-action="rolarSorte">
           <i class="fa-solid fa-dice-d20" inert></i> ${esc(t("Sorte.Rolar"))}
         </button>`
      : `<p class="agacha-tirou">${t("Sorte.Tirou", {total: `<b>${this.minhaRolagem}</b>`})}</p>`);
    return `
      <div class="agacha-capa">
        ${tituloCapa()}
        ${pedido || `<p class="agacha-dica">${esc(t("Aguardando"))}</p>`}
      </div>`;
  }

  async _renderHTML() {
    const mestre = game.user.isGM && !this.assistindo;
    const pool = mestre ? lerPool() : [];
    const ocupado = ["embaralhando", "animando"].includes(this.fase);
    if ( !this.fala ) this.#escolherFala(mestre ? (pool.length ? "boasVindas" : "vazio") : "espera");

    const barra = mestre ? `
      <div class="agacha-barra">
        ${QUANTIDADES.map(n => `
          <button type="button" class="agacha-botao agacha-sortear" data-action="sortear" data-quantidade="${n}"
                  ${pool.length && !ocupado ? "" : "disabled"}>
            <i class="agacha-icone" inert></i> ${esc(t("Sortear", {n}))}
          </button>`).join("")}
        <label class="agacha-publico" data-tooltip-text="${esc(t("Config.MostrarJogadoresDica"))}">
          <input type="checkbox" data-publico ${game.settings.get(ID, "mostrarJogadores") ? "checked" : ""}>
          ${esc(t("MostrarJogadores"))}
        </label>
        <button type="button" class="agacha-botao agacha-discreto" data-action="pool">
          <i class="fa-solid fa-layer-group" inert></i> ${esc(t("ConfigurarPool"))}
        </button>
      </div>
      ${this.#sorteHTML()}
      ${this.#mesaHTML()}` : `
      <div class="agacha-barra agacha-aviso">${esc(t(this.itens.length ? "Assistindo" : "Convidado", {nome: this.mestre ?? ""}))}${
        this.sorteUsada > 0 ? ` · ${esc(t("Sorte.Valor", {p: Math.round(this.sorteUsada * 100)}))}` : ""}</div>`;

    let palco;
    if ( this.fase === "parado" ) palco = mestre ? this.#capaHTML(pool) : this.#capaJogadorHTML();
    else if ( this.fase === "embaralhando" ) palco = `
      <div class="agacha-baralho">${Array.from({length: 8}, (_, k) =>
        `<i style="--k:${k}"><img src="${LOGO}" alt="" draggable="false"></i>`).join("")}</div>`;
    else {
      const pessoas = mestre ? destinatarios() : [];
      const opcoes = pessoas.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("");
      const cartas = this.itens.map((item, i) => {
        const entregue = this.entregues[i];
        const entrega = entregue ? entregueHTML(entregue) : !mestre ? "" : `
          <select class="agacha-entregar" data-i="${i}" aria-label="${esc(t("Entregar"))}">
            <option value="">${esc(t("Entregar"))}</option>
            ${opcoes}
          </select>`;
        return `
          <div class="agacha-vaga rar-${esc(item.rarity)} ${this.descartadas.has(i) ? "descartada" : ""}" data-i="${i}"
               style="--atraso:${(i * ENTRADA_MS / 1000).toFixed(2)}s; --inclina:${(i % 2 ? 1 : -1) * (8 + (i * 5) % 9)}deg">
            <div class="agacha-voo">
            <div class="agacha-raios"></div>
            <div class="agacha-aura"></div>
            <div class="agacha-carta ${this.reveladas.has(i) || this.descartadas.has(i) ? "revelada" : ""}" data-action="carta"
                 data-i="${i}" draggable="true">
              <div class="agacha-giro">
                <div class="agacha-verso">
                  <img src="${LOGO}" alt="" draggable="false">
                  <span>Arcano Lab</span>
                </div>
                <div class="agacha-frente" data-tooltip-text="${esc(t("AbrirItem"))}">
                  <div class="agacha-selo">${esc(nomeRaridade(item.rarity))}</div>
                  <div class="agacha-arte"><img src="${esc(item.img)}" alt="" draggable="false"></div>
                  <div class="agacha-nome">${esc(item.name)}</div>
                </div>
              </div>
            </div>
            </div>
            <div class="agacha-entrega">${entrega}</div>
          </div>`;
      }).join("");
      palco = `<div class="agacha-mesa cartas-${this.itens.length}">${cartas}</div>`;
    }

    const caixa = document.createElement("div");
    caixa.className = `agacha-corpo fase-${this.fase} modo-${this.modoAtual} ${mestre ? "do-mestre" : ""} ${
      this.jogando ? "do-jogador" : ""} ${this.#chegando ? "chegando" : ""}`;
    this.#chegando = false;
    caixa.innerHTML = `
      ${barra}
      <div class="agacha-cena">
        ${this.#magoHTML()}
        <div class="agacha-palco">${palco}</div>
      </div>
      ${this.#rodapeHTML(mestre)}
      ${assinaturaHTML()}`;
    return caixa;
  }

  #rodapeHTML(mestre) {
    if ( !this.itens.length ) return "";
    const escolher = this.modoAtual === "escolher";
    const dica = escolher ? t("DicaEscolher", {n: this.escolhasAtual}) : t("DicaRevelar");
    if ( !mestre ) return this.jogando ? `
      <div class="agacha-rodape"><span class="agacha-dica agacha-sua-vez so-mesa">${esc(t("SuaVez"))} ${esc(dica)}</span></div>` : "";
    const personagem = game.users.get(this.jogadorAtual)?.character;
    return `
      <div class="agacha-rodape">
        <span class="agacha-dica so-mesa">${esc(dica)}</span>
        ${escolher ? "" : `
        <button type="button" class="agacha-botao agacha-ouro so-mesa" data-action="revelarTudo">
          <i class="fa-solid fa-wand-sparkles" inert></i> ${esc(t("RevelarTudo"))}
        </button>`}
        <button type="button" class="agacha-botao agacha-discreto so-animando" data-action="pular">
          <i class="fa-solid fa-forward" inert></i> ${esc(t("Pular"))}
        </button>
        ${personagem ? `
        <button type="button" class="agacha-botao agacha-ouro so-pronto" data-action="entregarTudo">
          <i class="fa-solid fa-gift" inert></i> ${esc(t("EntregarTudo", {nome: personagem.name}))}
        </button>` : ""}
        <button type="button" class="agacha-botao ${personagem ? "agacha-discreto" : "agacha-ouro"} so-pronto" data-action="chat">
          <i class="fa-solid fa-comment" inert></i> ${esc(t("EnviarChat"))}
        </button>
        <button type="button" class="agacha-botao agacha-discreto so-pronto" data-action="capa">
          <i class="fa-solid fa-rotate-left" inert></i> ${esc(t("NovaRodada"))}
        </button>
      </div>`;
  }

  _replaceHTML(resultado, conteudo) {
    conteudo.replaceChildren(resultado);
    this.#ligarMesa();
    conteudo.querySelector("[data-publico]")?.addEventListener("change", ev => {
      game.settings.set(ID, "mostrarJogadores", ev.currentTarget.checked);
    });
    conteudo.querySelectorAll(".agacha-entregar").forEach(sel => {
      sel.addEventListener("change", () => this.#aoEntregar(sel));
    });
    conteudo.querySelectorAll(".agacha-carta").forEach(carta => {
      carta.addEventListener("dragstart", ev => {
        const item = this.itens[Number(carta.dataset.i)];
        if ( !item || !carta.classList.contains("revelada") ) return ev.preventDefault();
        ev.dataTransfer.setData("text/plain", JSON.stringify({type: "Item", uuid: item.uuid}));
      });
    });
  }

  _onFirstRender(contexto, opcoes) {
    super._onFirstRender?.(contexto, opcoes);
    // Os olhos do boneco acompanham o ponteiro.
    this.element.addEventListener("pointermove", ev => {
      const boneco = this.element.querySelector(".agacha-boneco");
      if ( !boneco ) return;
      this.#ultimoMovimento = Date.now();
      if ( boneco.classList.contains("dormindo") ) this.#emocao("uau", 800);   // acorda no susto
      const r = boneco.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height * 0.3);
      const d = Math.hypot(dx, dy) || 1;
      const alcance = Math.min(1, d / 220) * 7;
      boneco.style.setProperty("--ox", `${(dx / d * alcance).toFixed(1)}px`);
      boneco.style.setProperty("--oy", `${(dy / d * alcance).toFixed(1)}px`);
    });
    this.#vida = setInterval(() => this.#vidaPropria(), 1000);
    if ( !game.settings.get(ID, "som") ) return;
    // Deixa os sons prontos para a primeira carta não atrasar.
    const arquivos = [SOM.carta, SOM.virar, SOM.entrega, SOM.fogos, SOM.embaralhar,
      ...ORDEM.flatMap(r => [SOM.suspense(r), SOM.revelar(r)])].filter(Boolean);
    for ( const src of arquivos ) foundry.audio.AudioHelper.preloadSound(src).catch(() => {});
    // Música de fundo da tenda, baixinha, enquanto a janela está aberta.
    if ( game.settings.get(ID, "musica") ) {
      this.#musica = foundry.audio.AudioHelper.play(
        {src: SOM.musica, volume: 0.22, autoplay: true, loop: true, channel: "environment"}, false);
    }
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    Promise.resolve(this.#musica).then(som => som?.stop?.()).catch(() => {});
    this.#musica = null;
    clearInterval(this.#vida);
    this.#vida = null;
    if ( !this.assistindo && game.user.isGM ) this.#emitir({acao: "fechar"});
    this.#limpar();
    this.fala = "";
  }

  /** Dados da sorte mudaram: na capa redesenha tudo; com cartas na mesa troca só a faixa. */
  #atualizarSorte() {
    if ( !this.rendered ) return;
    if ( this.fase === "parado" ) return this.render();
    const faixa = this.element.querySelector(".agacha-sorte");
    if ( faixa ) faixa.outerHTML = this.#sorteHTML();
  }

  #definirFase(fase) {
    this.fase = fase;
    const corpo = this.element?.querySelector(".agacha-corpo");
    if ( !corpo ) return;
    for ( const f of ["parado", "embaralhando", "mesa", "animando", "pronto"] ) corpo.classList.toggle(`fase-${f}`, f === fase);
  }

  /* ---------- Animação ---------- */
  // O mago embaralha, as cartas voam para a mesa viradas para baixo e esperam. O mestre vira uma a uma
  // com um clique, ou manda revelar todas em sequência. As raras "carregam" antes (aura, tremor, som de
  // suspense) e explodem em faíscas ao virar; Lendário e Artefato soltam fogos na tela inteira.

  #pararRelogios() {
    this.#rodada++;
    for ( const r of this.#relogios ) clearTimeout(r);
    this.#relogios = [];
    this.#ocupadas.clear();
  }

  #depois(ms, fn) {
    this.#relogios.push(setTimeout(fn, ms));
  }

  #esperar(ms) {
    return new Promise(pronto => this.#depois(ms, pronto));
  }

  /** O mago embaralha e depois distribui as cartas (mestre e quem assiste passam por aqui). */
  async #entrar() {
    const rodada = this.#rodada;
    this.fase = "embaralhando";
    this.humor = "embaralha";
    this.#escolherFala("embaralha");
    await this.render({force: true});
    this.#tocar(SOM.embaralhar, 0.6);
    await this.#esperar(EMBARALHAR_MS);
    if ( rodada !== this.#rodada ) return;

    this.fase = "mesa";
    this.humor = "capa";
    this.#escolherFala(this.assistindo ? "espera" : "mesa");
    this.#chegando = true;
    await this.render();
    const n = this.itens.length;
    for ( let i = 0; i < n; i++ ) this.#depois(i * ENTRADA_MS, () => {
      this.#tocar(SOM.carta, 0.5);
      this.#pulso("cuspindo", 400);
    });
    this.#depois(n * ENTRADA_MS + 500, () => {
      this.element?.querySelector(".agacha-corpo")?.classList.remove("chegando");
      if ( !this.assistindo && game.settings.get(ID, "revelarAuto") ) this.revelarTudo();
    });
  }

  /** Suspense (se a raridade tiver), giro e estouro de uma carta. */
  async #revelarCarta(i, {emSequencia=false}={}) {
    const vaga = this.element?.querySelector(`.agacha-vaga[data-i="${i}"]`);
    if ( !vaga || !this.itens[i] || this.reveladas.has(i) || this.#ocupadas.has(i) ) return;
    const rodada = this.#rodada;
    const vale = () => (rodada === this.#rodada) && vaga.isConnected;
    const raridade = this.itens[i].rarity;
    const fx = EFEITOS[raridade] ?? EFEITOS.common;

    this.#ocupadas.add(i);
    // Carta rara em diante: voa para o centro do palco, cresce, revela lá e depois volta.
    const destaque = fx.suspense > 0;
    if ( destaque ) {
      this.#emocao("ansioso", DESTAQUE_MS + fx.suspense + 500);
      this.#destacar(vaga, true);
      await this.#esperar(DESTAQUE_MS);
      if ( !vale() ) return;
    }
    if ( fx.suspense ) {
      vaga.classList.add("carregando");
      this.#tocar(SOM.suspense(raridade), 0.7);
      await this.#esperar(fx.suspense);
      if ( !vale() ) return;
      vaga.classList.remove("carregando");
    }
    const carta = vaga.querySelector(".agacha-carta");
    carta.classList.add("virando", "revelada");
    this.reveladas.add(i);
    this.#tocar(SOM.virar, 0.55);
    this.#depois(VIRADA_MS / 2, () => {
      this.#tocar(SOM.revelar(raridade), 0.8);
      this.#estourar(vaga, raridade);
      this.#falar(raridade, {item: this.itens[i].name}, fx.fogos ? "revela" : "capa");
      this.#reagir(raridade);
    });
    this.#depois(VIRADA_MS + 250, () => carta.classList.remove("virando"));

    if ( destaque ) {
      await this.#esperar(VIRADA_MS + (fx.fogos ? 1900 : 1000));
      if ( !vale() ) return;
      this.#destacar(vaga, false);
      await this.#esperar(DESTAQUE_MS);
    }
    else await this.#esperar(emSequencia ? fx.pausa : VIRADA_MS + 300);
    if ( !vale() ) return;
    this.#ocupadas.delete(i);
    if ( !emSequencia && (this.fase === "mesa") && this.#completo && !this.#ocupadas.size ) this.#terminar();
  }

  /** Leva a carta ao centro do palco (ou devolve), escurecendo as outras. */
  #destacar(vaga, ligar) {
    const palco = this.element?.querySelector(".agacha-palco");
    const voo = vaga.querySelector(".agacha-voo");
    if ( !palco || !voo ) return;
    if ( ligar ) {
      const p = palco.getBoundingClientRect();
      const c = vaga.querySelector(".agacha-carta").getBoundingClientRect();
      voo.style.setProperty("--dx", `${(p.left + p.width / 2 - (c.left + c.width / 2)).toFixed(0)}px`);
      voo.style.setProperty("--dy", `${(p.top + p.height / 2 - (c.top + c.height / 2)).toFixed(0)}px`);
      voo.style.setProperty("--esc", Math.clamp((p.height - 40) / c.height, 1.15, 1.9).toFixed(2));
    }
    vaga.classList.toggle("destaque", ligar);
    palco.classList.toggle("com-destaque", !!palco.querySelector(".agacha-vaga.destaque"));
  }

  /** Revela em sequência as cartas que ainda estão viradas para baixo. */
  async #sequencia() {
    if ( this.fase !== "mesa" ) return;
    const rodada = this.#rodada;
    const vale = () => (rodada === this.#rodada) && this.element?.isConnected;
    this.#definirFase("animando");
    for ( let i = 0; i < this.itens.length; i++ ) {
      while ( this.#ocupadas.has(i) ) {      // carta que o mestre clicou e ainda está virando
        await this.#esperar(150);
        if ( !vale() ) return;
      }
      if ( this.reveladas.has(i) ) continue;
      if ( this.#completo ) break;
      await this.#revelarCarta(i, {emSequencia: true});
      if ( !vale() ) return;
    }
    this.#terminar();
  }

  /** Faíscas saindo da carta, anel de luz, clarão no palco e fogos na tela, conforme a raridade. */
  #estourar(vaga, raridade) {
    const fx = EFEITOS[raridade] ?? EFEITOS.common;
    if ( !fx.faiscas ) return;
    const caixa = document.createElement("div");
    caixa.className = "agacha-estouro";
    let html = `<i class="agacha-anel"></i>`;
    for ( let k = 0; k < fx.faiscas; k++ ) {
      const angulo = (360 / fx.faiscas) * k + Math.random() * 18;
      const alcance = vaga.offsetWidth * (0.7 + Math.random() * 1.1);
      const duracao = 0.7 + Math.random() * 0.7;
      const tamanho = 4 + Math.random() * 7;
      html += `<i class="agacha-faisca" style="--ang:${angulo.toFixed(0)}deg; --alc:${alcance.toFixed(0)}px;`
        + ` --dur:${duracao.toFixed(2)}s; --tam:${tamanho.toFixed(1)}px"></i>`;
    }
    caixa.innerHTML = html;
    (vaga.querySelector(".agacha-voo") ?? vaga).append(caixa);
    setTimeout(() => caixa.remove(), 1800);

    if ( fx.clarao ) {
      const palco = this.element.querySelector(".agacha-palco");
      const clarao = document.createElement("div");
      clarao.className = `agacha-clarao rar-${raridade}`;
      palco.append(clarao);
      palco.classList.remove("tremendo");
      void palco.offsetWidth;
      palco.classList.add("tremendo");
      setTimeout(() => clarao.remove(), 1000);
    }
    if ( fx.fogos && game.settings.get(ID, "fogos") ) {
      soltarFogos(raridade);
      this.#tocar(SOM.fogos, 0.6);
    }
  }

  #terminar() {
    this.#pararRelogios();
    this.#definirFase("pronto");
    const corpo = this.element?.querySelector(".agacha-corpo");
    if ( !corpo ) return;
    // No modo "escolher", as cartas que ninguém escolheu viram apagadas: dá para ver o que ficou para trás.
    if ( this.modoAtual === "escolher" ) {
      for ( const i of this.itens.keys() ) if ( !this.reveladas.has(i) ) this.descartadas.add(i);
    }
    else this.reveladas = new Set(this.itens.keys());
    corpo.querySelector(".agacha-palco")?.classList.remove("com-destaque");
    corpo.querySelectorAll(".agacha-vaga").forEach(v => {
      v.classList.remove("carregando", "destaque");
      v.classList.toggle("descartada", this.descartadas.has(Number(v.dataset.i)));
    });
    corpo.querySelectorAll(".agacha-carta").forEach(c => {
      c.classList.add("revelada");
      c.classList.remove("virando");
    });
    this.#fecharRodada();
    corpo.querySelectorAll(".agacha-sortear").forEach(b => { b.disabled = false; });
    // A fala da última carta fica um instante antes da despedida.
    setTimeout(() => { if ( this.fase === "pronto" ) this.#falar("fim", {}, "capa"); }, 2600);
  }

  /** Mestre, uma vez por sorteio: conta para a garantia acumulada e escreve no histórico. */
  async #fecharRodada() {
    if ( this.#fechada || this.assistindo || !game.user.isGM ) return;
    this.#fechada = true;
    const ganhos = this.ganhos;
    try {
      await contarParaGarantia(ganhos);
      const quem = game.users.get(this.jogadorAtual)?.name ?? game.user.name;
      const custo = this.cfgMesa.custo > 0 ? ` · ${t("Historico.Custo", {valor: this.cfgMesa.custo})}` : "";
      await registrarHistorico(`${t("Historico.Sorteio", {nome: esc(quem), baralho: esc(baralhoAtivo().nome)})}${custo}: ${listaDeItens(ganhos)}`);
    } catch(e) { console.error(`${ID} |`, e); }
  }

  /** Termina na hora a revelação em sequência; a melhor carta que faltava ainda ganha o seu estouro. */
  #pular() {
    if ( this.fase !== "animando" ) return;
    const faltam = Array.from(this.element.querySelectorAll(".agacha-vaga"))
      .filter(v => !v.querySelector(".agacha-carta.revelada"))
      .map(v => ({vaga: v, i: Number(v.dataset.i), raridade: this.itens[Number(v.dataset.i)]?.rarity ?? "common"}))
      .sort((a, b) => nivel(b.raridade) - nivel(a.raridade));
    this.#terminar();
    this.#tocar(SOM.virar, 0.55);
    const melhor = faltam[0];
    if ( !melhor ) return;
    this.#tocar(SOM.revelar(melhor.raridade), 0.8);
    this.#estourar(melhor.vaga, melhor.raridade);
    this.#falar(melhor.raridade, {item: this.itens[melhor.i]?.name ?? ""}, EFEITOS[melhor.raridade]?.fogos ? "revela" : "capa");
  }

  #tocar(src, volume=0.7) {
    if ( !src || !game.settings.get(ID, "som") ) return;
    foundry.audio.AudioHelper.play({src, volume, autoplay: true, loop: false, channel: "interface"}, false);
  }

  #marcarEntrega(i, nome) {
    this.entregues[i] = nome;
    const caixa = this.element?.querySelector(`.agacha-vaga[data-i="${i}"] .agacha-entrega`);
    if ( caixa ) caixa.innerHTML = entregueHTML(nome);
    this.#tocar(SOM.entrega, 0.7);
    this.#emocao("guloso", 2100);
  }

  /* ---------- Dados da sorte ---------- */

  /** Jogador: o mestre pediu um dado. */
  async #pedidoDeSorte({mestre}) {
    if ( this.fase !== "parado" ) return;
    this.mestre = String(mestre ?? "");
    this.pedido = true;
    this.minhaRolagem = null;
    this.#escolherFala("pedeDado");
    await this.render({force: true});
  }

  /** Mestre: chegou o dado de alguém. */
  #registrarSorte({userId, nome, total}) {
    total = Math.clamp(Math.round(Number(total)) || 1, 1, 20);
    this.rolagens.set(String(userId), {nome: String(nome ?? "?"), total});
    this.#escolherFala("sorte", {nome: String(nome ?? "?"), total});
    this.#atualizarSorte();
    if ( this.fase !== "parado" ) this.#falar("sorte", {nome: String(nome ?? "?"), total});
    setTimeout(() => this.#emocao(total >= 15 ? "uau" : total <= 5 ? "meh" : "feliz", 1900), 150);
  }

  static #aoPedirSorte() {
    this.sortePedida = true;
    game.socket.emit(`module.${ID}`, {acao: "pedirSorte", mestre: game.user.name});
    ui.notifications.info(t("Sorte.Pedida"));
    this.#escolherFala("pedeDado");
    this.#atualizarSorte();
  }

  /** Rola 1d20 no chat. Jogador: manda o resultado ao mestre. Mestre: conta como um dado da mesa. */
  static async #aoRolarSorte(evento, alvo) {
    alvo.disabled = true;
    const rolagem = await new Roll("1d20").evaluate();
    const msg = await rolagem.toMessage({flavor: t("Sorte.Sabor"), speaker: ChatMessage.getSpeaker()});
    await game.dice3d?.waitFor3DAnimationByMessageID?.(msg?.id);
    if ( game.user.isGM && !this.assistindo ) {
      this.#registrarSorte({userId: game.user.id, nome: game.user.name, total: rolagem.total});
      return;
    }
    this.minhaRolagem = rolagem.total;
    game.socket.emit(`module.${ID}`, {acao: "sorte", userId: game.user.id, nome: game.user.name, total: rolagem.total});
    if ( this.rendered && (this.fase === "parado") ) this.render();
  }

  static #aoLimparSorte() {
    this.rolagens = new Map();
    this.sortePedida = false;
    game.socket.emit(`module.${ID}`, {acao: "sorteFim"});
    this.#atualizarSorte();
  }

  static #aoAjustarSorte() {
    return SorteConfig.abrir();
  }

  /* ---------- Ações ---------- */

  static #aoSortear(evento, alvo) {
    return this.sortear(Number(alvo.dataset.quantidade) || 1);
  }

  /** O mago pede 1d10: o resultado é a quantidade de cartas. */
  static async #aoRolarQuantidade(evento, alvo) {
    if ( this.assistindo || (this.fase !== "parado") ) return;
    alvo.disabled = true;
    this.#emocao("ansioso", 2600);
    const rolagem = await new Roll("1d10").evaluate();
    const msg = await rolagem.toMessage({flavor: t("Capa.SaborQuantidade"), speaker: {alias: t("Mago.Nome")}});
    await game.dice3d?.waitFor3DAnimationByMessageID?.(msg?.id);
    this.#falar("quantidade", {n: rolagem.total});
    await new Promise(pronto => setTimeout(pronto, 900));
    return this.sortear(rolagem.total);
  }

  static #aoAbrirPool() {
    return PoolConfig.abrir();
  }

  static #aoRevelarTudo() {
    return this.revelarTudo();
  }

  static #aoPular() {
    if ( this.assistindo || (this.fase !== "animando") ) return;
    this.#emitir({acao: "pular"});
    this.#pular();
  }

  static async #aoChat(evento, alvo) {
    if ( !this.itens.length ) return;
    alvo.disabled = true;
    await resultadoNoChat(this.ganhos);
  }

  /** Tira as cartas da mesa e volta à capa (os jogadores voltam junto). */
  static #aoVoltarCapa() {
    if ( this.assistindo || (this.fase !== "pronto") ) return;
    this.#limpar();
    this.#escolherFala("boasVindas");
    this.#emitir({acao: "fechar"});
    this.#emitir({acao: "capa", mestre: game.user.name});
    return this.render();
  }

  /** Carta virada para baixo: o mestre revela. Carta revelada: abre o item. */
  static #aoClicarCarta(evento, alvo) {
    const i = Number(alvo.dataset.i);
    if ( !alvo.classList.contains("revelada") ) {
      if ( this.jogando && (this.fase === "mesa") ) {
        game.socket.emit(`module.${ID}`, {acao: "querRevelar", i, userId: game.user.id});
        return;
      }
      return this.revelar(i);
    }
    if ( this.descartadas.has(i) && !game.user.isGM ) return;
    if ( alvo.classList.contains("virando") ) return;
    const item = this.itens[i];
    if ( item ) return abrirItem(item.uuid);
  }

  async #aoEntregar(sel) {
    const i = Number(sel.dataset.i);
    const item = this.itens[i];
    const actor = game.actors.get(sel.value);
    if ( !item || !actor ) return;
    sel.disabled = true;
    const criado = await entregar(item, actor).catch(e => { console.error(`${ID} |`, e); return null; });
    if ( !criado ) { sel.disabled = false; sel.value = ""; return; }
    this.#marcarEntrega(i, actor.name);
    this.#emitir({acao: "entrega", i, nome: actor.name});
    registrarHistorico(t("Historico.Entrega", {nome: esc(actor.name), item: `@UUID[${criado.uuid}]{${esc(criado.name)}}`}))
      .catch(e => console.error(`${ID} |`, e));
  }

  /** Entrega ao personagem de quem jogou todas as cartas que valem e ainda não foram entregues. */
  static async #aoEntregarTudo(evento, alvo) {
    const personagem = game.users.get(this.jogadorAtual)?.character;
    if ( !personagem ) return;
    alvo.disabled = true;
    for ( const sel of this.element.querySelectorAll(".agacha-vaga:not(.descartada) .agacha-entregar") ) {
      sel.value = personagem.id;
      await this.#aoEntregar(sel);
    }
  }
}

const entregueHTML = nome =>
  `<span class="agacha-entregue"><i class="fa-solid fa-check" inert></i> ${esc(nome)}</span>`;

const tituloCapa = () => `
  <h2 class="agacha-capa-titulo">
    <i class="agacha-icone" inert></i>
    <em>Arcano</em>
    <span>Loot &amp; Luck</span>
    <small>${esc(t("Capa.Subtitulo"))}</small>
  </h2>`;

/* ------------------------------------------------------------------ */
/*  Janela de ajuste dos dados da sorte                                */
/* ------------------------------------------------------------------ */

const MEDIAS = [1, 5, 10, 15, 20];
const GARANTIAS_SORTE = ["none", "uncommon", "rare", "veryRare", "legendary", "artifact"];

export class SorteConfig extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "agacha-sorte-config",
    classes: ["agacha", "agacha-sorte-config"],
    window: {icon: "fa-solid fa-dice-d20", resizable: false},
    position: {width: 760, height: "auto"},
    actions: {salvar: SorteConfig.#aoSalvar}
  };

  static #instancia = null;

  static abrir() {
    if ( !game.user.isGM ) return ui.notifications.warn(t("Aviso.SoMestre"));
    const app = (this.#instancia ??= new this());
    app.render({force: true});
    return app;
  }

  get title() { return t("Ajuste.Titulo"); }

  /** Linhas da tabela: chance de cada raridade por carta, para cada média dos dados. */
  #tabela(forca) {
    const pool = lerPool();
    if ( !pool.length ) return `<p class="agacha-vazio">${esc(t("Ajuste.SemPool"))}</p>`;
    const presentes = ORDEM.filter(r => pool.some(i => i.rarity === r));
    const linha = (rotulo, sorte, classe="") => {
      const chances = Object.fromEntries(chancesPorRaridade(comSorte(pool, sorte, forca)).map(c => [c.raridade, c.chance]));
      const alto = ((chances.legendary ?? 0) + (chances.artifact ?? 0)) / 100;
      return `
        <tr class="${classe}">
          <th>${rotulo}</th>
          <td>${Math.round(sorte * 100)}%</td>
          ${presentes.map(r => `<td class="rar-${r}">${porcento(chances[r] ?? 0)}</td>`).join("")}
          <td class="agacha-destaque">${porcento((1 - (1 - alto) ** 5) * 100)}</td>
        </tr>`;
    };
    return `
      <table class="agacha-tabela">
        <thead>
          <tr>
            <th>${esc(t("Ajuste.Media"))}</th>
            <th>${esc(t("Ajuste.Sorte"))}</th>
            ${presentes.map(r => `<th class="rar-${r}">${esc(nomeRaridade(r))}</th>`).join("")}
            <th data-tooltip-text="${esc(t("Ajuste.EmCincoDica"))}">${esc(t("Ajuste.EmCinco"))}</th>
          </tr>
        </thead>
        <tbody>
          ${linha(esc(t("Ajuste.SemDados")), 0, "agacha-base")}
          ${MEDIAS.map(m => linha(m, sorteDe([m]))).join("")}
        </tbody>
      </table>`;
  }

  async _renderHTML() {
    const cfg = k => game.settings.get(ID, k);
    const opcoes = atual => GARANTIAS_SORTE.map(g => `<option value="${g}" ${g === atual ? "selected" : ""}>${
      esc(g === "none" ? t("Ajuste.Nenhuma") : nomeRaridade(g))}</option>`).join("");
    const caixa = document.createElement("div");
    caixa.className = "agacha-corpo standard-form";
    caixa.innerHTML = `
      <div class="form-group">
        <label>${esc(t("Config.DadosSorte"))}</label>
        <div class="form-fields"><input type="checkbox" name="dadosSorte" ${cfg("dadosSorte") ? "checked" : ""}></div>
        <p class="hint">${esc(t("Ajuste.Como"))}</p>
      </div>
      <div class="form-group">
        <label>${esc(t("Config.ForcaSorte"))}</label>
        <div class="form-fields">
          <input type="range" name="forcaSorte" min="0" max="3" step="0.25" value="${cfg("forcaSorte")}">
          <output class="agacha-forca"></output>
        </div>
        <p class="hint">${esc(t("Ajuste.ForcaDica"))}</p>
      </div>
      <h3>${esc(t("Ajuste.TabelaTitulo"))}</h3>
      <div class="agacha-tabela-caixa"></div>
      <p class="hint">${esc(t("Ajuste.TabelaDica"))}</p>
      <fieldset>
        <legend>${esc(t("Ajuste.Garantias"))}</legend>
        <div class="form-group">
          <label>${esc(t("Ajuste.Critico"))}</label>
          <div class="form-fields"><select name="sorteCritico">${opcoes(cfg("sorteCritico"))}</select></div>
        </div>
        <div class="form-group">
          <label>${esc(t("Ajuste.MediaMinima"))}</label>
          <div class="form-fields">
            <input type="number" name="sorteMinimo" min="1" max="20" step="1" value="${cfg("sorteMinimo")}">
            <select name="sorteGarante">${opcoes(cfg("sorteGarante"))}</select>
          </div>
        </div>
        <p class="hint">${esc(t("Ajuste.GarantiasDica"))}</p>
        <div class="form-group">
          <label>${esc(t("Ajuste.Acumulada"))}</label>
          <div class="form-fields">
            <input type="number" name="acumuladaN" min="0" max="99" step="1" value="${cfg("acumuladaN")}">
            <select name="acumuladaRaridade">${GARANTIAS_SORTE.filter(g => g !== "none").map(g =>
              `<option value="${g}" ${g === cfg("acumuladaRaridade") ? "selected" : ""}>${esc(nomeRaridade(g))}</option>`).join("")}</select>
          </div>
        </div>
        <p class="hint">${esc(t("Ajuste.AcumuladaDica", {n: cfg("acumuladaContador")}))}</p>
      </fieldset>
      <footer class="form-footer">
        <button type="button" class="agacha-salvar" data-action="salvar">
          <i class="fa-solid fa-floppy-disk" inert></i> ${esc(t("Ajuste.Salvar"))}
        </button>
      </footer>
      ${assinaturaHTML()}`;
    return caixa;
  }

  _replaceHTML(resultado, conteudo) {
    conteudo.replaceChildren(resultado);
    const forca = conteudo.querySelector('[name="forcaSorte"]');
    const atualizar = () => {
      const f = Number(forca.value);
      conteudo.querySelector(".agacha-forca").textContent = t("Ajuste.ForcaValor", {x: (1 + f).toLocaleString(game.i18n.lang)});
      conteudo.querySelector(".agacha-tabela-caixa").innerHTML = this.#tabela(f);
    };
    forca.addEventListener("input", atualizar);
    atualizar();
  }

  static async #aoSalvar() {
    const campo = nome => this.element.querySelector(`[name="${nome}"]`);
    await game.settings.set(ID, "dadosSorte", campo("dadosSorte").checked);
    await game.settings.set(ID, "forcaSorte", Math.clamp(Number(campo("forcaSorte").value) || 0, 0, 3));
    await game.settings.set(ID, "sorteCritico", campo("sorteCritico").value);
    await game.settings.set(ID, "sorteMinimo", Math.clamp(Math.round(Number(campo("sorteMinimo").value)) || 20, 1, 20));
    await game.settings.set(ID, "sorteGarante", campo("sorteGarante").value);
    await game.settings.set(ID, "acumuladaN", Math.clamp(Math.round(Number(campo("acumuladaN").value)) || 0, 0, 99));
    await game.settings.set(ID, "acumuladaRaridade", campo("acumuladaRaridade").value);
    ui.notifications.info(t("Ajuste.Salvo"));
    await this.close();
    const sorteio = GachaApp.instancia;
    if ( sorteio.rendered && ["parado", "pronto"].includes(sorteio.fase) ) sorteio.render();
  }
}

/* ------------------------------------------------------------------ */
/*  Janela do pool                                                     */
/* ------------------------------------------------------------------ */

export class PoolConfig extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "agacha-pool",
    classes: ["agacha", "agacha-pool"],
    window: {icon: "agacha-icone", resizable: true},
    position: {width: 720, height: 640},
    actions: {
      baralhoNovo: PoolConfig.#aoBaralhoNovo,
      baralhoRenomear: PoolConfig.#aoBaralhoRenomear,
      baralhoApagar: PoolConfig.#aoBaralhoApagar,
      importar: PoolConfig.#aoImportar,
      pesos: PoolConfig.#aoPesosPadrao,
      limpar: PoolConfig.#aoLimpar,
      remover: PoolConfig.#aoRemover,
      item: PoolConfig.#aoAbrirItem,
      salvar: PoolConfig.#aoSalvar
    }
  };

  static #instancia = null;

  static abrir() {
    if ( !game.user.isGM ) return ui.notifications.warn(t("Aviso.SoMestre"));
    const app = (this.#instancia ??= new this());
    app.render({force: true});
    return app;
  }

  /** Cópia de trabalho; só vai para o mundo em Salvar. */
  itens = null;
  filtro = "";

  get title() { return t("Pool.Titulo"); }

  /* ---------- Desenho ---------- */

  async _renderHTML() {
    this.itens ??= lerPool();
    const total = this.itens.reduce((s, i) => s + i.weight, 0);
    const linhas = this.itens.map((item, i) => `
      <li class="agacha-linha rar-${esc(item.rarity)}" data-i="${i}" data-nome="${esc(item.name.toLowerCase())}">
        <a class="agacha-item" data-action="item" data-tooltip-text="${esc(t("Pool.AbrirItem"))}">
          <img src="${esc(item.img)}" alt="">
          <span>${esc(item.name)}</span>
        </a>
        <select data-campo="rarity" aria-label="${esc(t("Pool.Raridade"))}">
          ${ORDEM.map(r => `<option value="${r}" ${r === item.rarity ? "selected" : ""}>${esc(nomeRaridade(r))}</option>`).join("")}
        </select>
        <input type="number" data-campo="weight" min="1" max="9999" step="1" value="${item.weight}"
               aria-label="${esc(t("Pool.Peso"))}">
        <span class="agacha-chance">${porcento(item.weight / total * 100)}</span>
        <button type="button" class="icon fa-solid fa-xmark" data-action="remover"
                data-tooltip aria-label="${esc(t("Pool.Remover"))}"></button>
      </li>`).join("");

    const caixa = document.createElement("div");
    caixa.className = "agacha-corpo";
    const baralhos = lerBaralhos();
    caixa.innerHTML = `
      <div class="agacha-baralhos">
        <label>${esc(t("Mesa.Baralho"))}</label>
        <select data-baralho>
          ${baralhos.lista.map(b => `<option value="${esc(b.id)}" ${b.id === baralhos.ativo ? "selected" : ""}>${esc(b.nome)}</option>`).join("")}
        </select>
        <button type="button" data-action="baralhoNovo"><i class="fa-solid fa-plus" inert></i> ${esc(t("Baralho.Novo"))}</button>
        <button type="button" data-action="baralhoRenomear" data-tooltip-text="${esc(t("Baralho.Renomear"))}"
                aria-label="${esc(t("Baralho.Renomear"))}"><i class="fa-solid fa-pen" inert></i></button>
        <button type="button" data-action="baralhoApagar" data-tooltip-text="${esc(t("Baralho.Apagar"))}"
                aria-label="${esc(t("Baralho.Apagar"))}"><i class="fa-solid fa-trash" inert></i></button>
      </div>
      <p class="hint agacha-instrucoes">${esc(t("Pool.Instrucoes"))}</p>
      <div class="agacha-ferramentas">
        <input type="search" data-filtro placeholder="${esc(t("Pool.Filtrar"))}" value="${esc(this.filtro)}">
        <button type="button" data-action="importar">
          <i class="fa-solid fa-book-atlas" inert></i> ${esc(t("Pool.Importar"))}
        </button>
        <button type="button" data-action="pesos" data-tooltip-text="${esc(t("Pool.PesosPadraoDica"))}">
          <i class="fa-solid fa-scale-balanced" inert></i> ${esc(t("Pool.PesosPadrao"))}
        </button>
        <button type="button" data-action="limpar" ${this.itens.length ? "" : "disabled"}>
          <i class="fa-solid fa-trash" inert></i> ${esc(t("Pool.Limpar"))}
        </button>
      </div>
      <div class="agacha-cabecalho">
        <span>${esc(t("Pool.Item"))}</span><span>${esc(t("Pool.Raridade"))}</span>
        <span>${esc(t("Pool.Peso"))}</span><span>${esc(t("Pool.Chance"))}</span><span></span>
      </div>
      <ol class="agacha-lista">
        ${linhas || `<li class="agacha-vazio"><i class="agacha-icone" inert></i>${esc(t("Pool.Vazio"))}</li>`}
      </ol>
      <p class="agacha-resumo"></p>
      <footer class="form-footer">
        <button type="button" class="agacha-salvar" data-action="salvar">
          <i class="fa-solid fa-floppy-disk" inert></i> ${esc(t("Pool.Salvar"))}
        </button>
      </footer>
      ${assinaturaHTML()}`;
    return caixa;
  }

  _replaceHTML(resultado, conteudo) {
    const rolagem = conteudo.querySelector(".agacha-lista")?.scrollTop ?? 0;
    conteudo.replaceChildren(resultado);
    const seletor = conteudo.querySelector("[data-baralho]");
    seletor.addEventListener("change", () => this.#trocarBaralho(seletor.value));
    const lista = conteudo.querySelector(".agacha-lista");
    lista.scrollTop = rolagem;

    lista.addEventListener("change", ev => {
      const campo = ev.target.dataset.campo;
      const linha = ev.target.closest(".agacha-linha");
      const item = this.itens[Number(linha?.dataset.i)];
      if ( !campo || !item ) return;
      if ( campo === "weight" ) {
        item.weight = entrada({...item, weight: ev.target.value}).weight;
        ev.target.value = item.weight;
      } else {
        linha.classList.replace(`rar-${item.rarity}`, `rar-${ev.target.value}`);
        item.rarity = ev.target.value;
      }
      this.#atualizarChances();
    });

    const filtro = conteudo.querySelector("[data-filtro]");
    filtro.addEventListener("input", () => { this.filtro = filtro.value; this.#filtrar(); });

    lista.addEventListener("dragover", ev => { ev.preventDefault(); lista.classList.add("soltar"); });
    lista.addEventListener("dragleave", () => lista.classList.remove("soltar"));
    lista.addEventListener("drop", ev => { lista.classList.remove("soltar"); this.#aoSoltar(ev); });

    this.#filtrar();
    this.#atualizarChances();
  }

  _onClose(opcoes) {
    super._onClose(opcoes);
    this.itens = null;
    this.filtro = "";
  }

  #filtrar() {
    const termo = this.filtro.trim().toLowerCase();
    this.element.querySelectorAll(".agacha-linha").forEach(li => {
      li.hidden = !!termo && !li.dataset.nome.includes(termo);
    });
  }

  #atualizarChances() {
    const total = this.itens.reduce((s, i) => s + i.weight, 0);
    this.element.querySelectorAll(".agacha-linha").forEach(li => {
      const item = this.itens[Number(li.dataset.i)];
      li.querySelector(".agacha-chance").textContent = porcento(item.weight / total * 100);
    });
    const resumo = chancesPorRaridade(this.itens).map(c =>
      `<span class="rar-${c.raridade}">${esc(nomeRaridade(c.raridade))} ${porcento(c.chance)}</span>`).join("");
    this.element.querySelector(".agacha-resumo").innerHTML =
      `<b>${esc(t("PoolResumo", {n: this.itens.length}))}</b>${resumo}`;
  }

  /* ---------- Entrada de itens ---------- */

  /** Junta itens ao pool, pulando os que já estão. Devolve quantos entraram. */
  #juntar(novos) {
    const tem = new Set(this.itens.map(i => i.uuid));
    let entraram = 0;
    for ( const novo of novos ) {
      if ( !novo.uuid || tem.has(novo.uuid) ) continue;
      tem.add(novo.uuid);
      this.itens.push(entrada(novo));
      entraram++;
    }
    // Do mais raro ao mais comum, e por nome dentro da raridade.
    this.itens.sort((a, b) => (nivel(b.rarity) - nivel(a.rarity)) || a.name.localeCompare(b.name));
    ui.notifications.info(t("Pool.Adicionados", {n: entraram, rep: novos.length - entraram}));
    return entraram;
  }

  async #aoSoltar(evento) {
    evento.preventDefault();
    let dados;
    try { dados = JSON.parse(evento.dataTransfer.getData("text/plain")); }
    catch { return; }
    const doc = dados?.uuid ? await fromUuid(dados.uuid).catch(() => null) : null;

    let novos = null;
    if ( (dados?.type === "Item") && doc ) {
      novos = [{uuid: doc.uuid, name: doc.name, img: doc.img, rarity: raridadeDe(doc) ?? "common"}];
    }
    else if ( (dados?.type === "Folder") && (doc?.type === "Item") ) novos = await itensDaPasta(doc);
    if ( !novos ) return ui.notifications.warn(t("Aviso.SoItem"));
    if ( this.#juntar(novos) ) this.render();
  }

  static async #aoImportar() {
    const pacotes = game.packs.filter(p => (p.documentName === "Item") && p.visible)
      .sort((a, b) => a.title.localeCompare(b.title));
    if ( !pacotes.length ) return ui.notifications.warn(t("Importar.Nenhum"));

    const escolha = await DialogV2.wait({
      window: {title: t("Importar.Titulo"), icon: "agacha-icone"},
      classes: ["agacha", "agacha-importar"],
      position: {width: 460},
      rejectClose: false,
      content: `
        <div class="form-group">
          <label>${esc(t("Importar.Compendio"))}</label>
          <div class="form-fields">
            <select name="pacote">
              ${pacotes.map(p => `<option value="${esc(p.collection)}">${esc(p.title)}</option>`).join("")}
            </select>
          </div>
        </div>
        <fieldset>
          <legend>${esc(t("Importar.Raridades"))}</legend>
          <div class="agacha-marcas">
            ${ORDEM.map(r => `
              <label class="rar-${r}"><input type="checkbox" name="rar.${r}" checked> ${esc(nomeRaridade(r))}</label>`).join("")}
          </div>
          <label class="agacha-sem-raridade">
            <input type="checkbox" name="semRaridade"> ${esc(t("Importar.SemRaridade"))}
          </label>
        </fieldset>`,
      buttons: [
        {
          action: "importar", default: true, icon: "fa-solid fa-book-atlas", label: t("Importar.Botao"),
          callback: (ev, botao) => new foundry.applications.ux.FormDataExtended(botao.form).object
        },
        {action: "cancelar", icon: "fa-solid fa-xmark", label: t("Cancelar")}
      ]
    });
    if ( !escolha || (typeof escolha !== "object") ) return;

    const pacote = game.packs.get(escolha.pacote);
    const novos = (await itensDoPacote(pacote)).filter(i => i.rarity
      ? escolha[`rar.${i.rarity}`]
      : escolha.semRaridade);
    if ( this.#juntar(novos.map(i => ({...i, rarity: i.rarity ?? "common"}))) ) this.render();
  }

  /* ---------- Ações ---------- */

  /* ---------- Baralhos ---------- */

  /** Guarda o que está na tela no baralho atual antes de mexer na lista de baralhos. */
  async #guardar() {
    if ( this.itens ) await salvarPool(this.itens);
  }

  async #depoisDeMexer() {
    this.itens = null;
    this.filtro = "";
    await this.render();
    const sorteio = GachaApp.instancia;
    if ( sorteio.rendered && ["parado", "pronto"].includes(sorteio.fase) ) sorteio.render();
  }

  async #trocarBaralho(id) {
    await this.#guardar();
    await ativarBaralho(id);
    return this.#depoisDeMexer();
  }

  static async #aoBaralhoNovo() {
    const nome = await pedirNome(t("Baralho.Novo"));
    if ( !nome ) return;
    await this.#guardar();
    const dados = lerBaralhos();
    const id = foundry.utils.randomID();
    dados.lista.push({id, nome, itens: []});
    dados.ativo = id;
    await salvarBaralhos(dados);
    return this.#depoisDeMexer();
  }

  static async #aoBaralhoRenomear() {
    const atual = baralhoAtivo();
    const nome = await pedirNome(t("Baralho.Renomear"), atual.nome);
    if ( !nome ) return;
    await this.#guardar();
    const dados = lerBaralhos();
    dados.lista.find(b => b.id === dados.ativo).nome = nome;
    await salvarBaralhos(dados);
    return this.#depoisDeMexer();
  }

  static async #aoBaralhoApagar() {
    const dados = lerBaralhos();
    if ( dados.lista.length < 2 ) return ui.notifications.warn(t("Baralho.Ultimo"));
    const atual = dados.lista.find(b => b.id === dados.ativo);
    const sim = await DialogV2.confirm({
      window: {title: t("Baralho.Apagar"), icon: "agacha-icone"},
      content: `<p>${esc(t("Baralho.ApagarConfirma", {nome: atual.nome, n: atual.itens.length}))}</p>`,
      rejectClose: false
    });
    if ( !sim ) return;
    dados.lista = dados.lista.filter(b => b.id !== atual.id);
    dados.ativo = dados.lista[0].id;
    await salvarBaralhos(dados);
    return this.#depoisDeMexer();
  }

  static #aoPesosPadrao() {
    for ( const item of this.itens ) item.weight = RARIDADES[item.rarity].peso;
    return this.render();
  }

  static async #aoLimpar() {
    const sim = await DialogV2.confirm({
      window: {title: t("Pool.Limpar"), icon: "agacha-icone"},
      content: `<p>${esc(t("Pool.LimparConfirma", {n: this.itens.length}))}</p>`,
      rejectClose: false
    });
    if ( !sim ) return;
    this.itens = [];
    return this.render();
  }

  static #aoRemover(evento, alvo) {
    this.itens.splice(Number(alvo.closest(".agacha-linha").dataset.i), 1);
    return this.render();
  }

  static #aoAbrirItem(evento, alvo) {
    const item = this.itens[Number(alvo.closest(".agacha-linha").dataset.i)];
    if ( item ) return abrirItem(item.uuid);
  }

  static async #aoSalvar() {
    await salvarPool(this.itens);
    ui.notifications.info(t("Pool.Salvo", {n: this.itens.length}));
    await this.close();
    const sorteio = GachaApp.instancia;
    if ( sorteio.rendered && ["parado", "pronto"].includes(sorteio.fase) ) sorteio.render();
  }
}

/** Pergunta um nome (de baralho). Devolve o texto, ou null se a pessoa desistir. */
async function pedirNome(titulo, valor="") {
  const nome = await DialogV2.prompt({
    window: {title: titulo, icon: "agacha-icone"},
    classes: ["agacha"],
    rejectClose: false,
    content: `
      <div class="form-group">
        <label>${esc(t("Baralho.Nome"))}</label>
        <div class="form-fields"><input type="text" name="nome" value="${esc(valor)}" autofocus></div>
      </div>`,
    ok: {label: t("Baralho.Ok"), callback: (ev, botao) => botao.form.elements.nome.value.trim()}
  });
  return (typeof nome === "string") && nome ? nome : null;
}

/* ------------------------------------------------------------------ */
/*  Leitura de compêndios e pastas                                     */
/* ------------------------------------------------------------------ */

const CAMPOS_INDICE = ["system.rarity", "system.traits.rarity"];
const doIndice = e => ({uuid: e.uuid, name: e.name, img: e.img, rarity: raridadeDe(e)});

/** Todos os itens de um compêndio, com a raridade (null quando o item não tem). */
async function itensDoPacote(pacote) {
  if ( !pacote ) return [];
  const indice = await pacote.getIndex({fields: CAMPOS_INDICE});
  return indice.map(doIndice);
}

/** Itens de uma pasta e das subpastas (pasta do mundo ou de compêndio). */
async function itensDaPasta(pasta) {
  const pastas = [pasta, ...pasta.getSubfolders(true)];
  if ( pasta.pack ) {
    const ids = new Set(pastas.map(p => p.id));
    const indice = await game.packs.get(pasta.pack).getIndex({fields: CAMPOS_INDICE});
    return indice.filter(e => ids.has(e.folder)).map(e => ({...doIndice(e), rarity: raridadeDe(e) ?? "common"}));
  }
  return pastas.flatMap(p => p.contents).map(i => ({
    uuid: i.uuid, name: i.name, img: i.img, rarity: raridadeDe(i) ?? "common"
  }));
}
