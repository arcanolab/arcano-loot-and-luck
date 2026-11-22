// Arcano Loot & Luck — núcleo: idioma, pool de itens, raridades, sorteio e entrega.

export const ID = "gacha-magic-items";

/* ------------------------------------------------------------------ */
/*  Idioma do módulo (segue o Foundry ou é forçado na configuração)    */
/* ------------------------------------------------------------------ */

export const IDIOMAS = {auto: "AGACHA.Idioma.auto", en: "English", "pt-BR": "Português (Brasil)"};
let dicionario = null;

/** Traduz uma chave completa ("AGACHA.…") no idioma do módulo. */
export const traduzir = chave => {
  if ( dicionario ) {
    const v = foundry.utils.getProperty(dicionario, chave);
    if ( typeof v === "string" ) return v;
  }
  return game.i18n.localize(chave);
};

export const t = (chave, dados) => {
  let texto = traduzir(`AGACHA.${chave}`);
  for ( const [k, v] of Object.entries(dados ?? {}) ) texto = texto.replaceAll(`{${k}}`, v);
  return texto;
};

/** Carrega o idioma escolhido na configuração. Em "auto" não faz nada. */
export async function carregarIdioma() {
  const idioma = game.settings.get(ID, "idioma");
  if ( !(idioma in IDIOMAS) || (idioma === "auto") ) return;
  try {
    const resposta = await fetch(`modules/${ID}/lang/${idioma}.json`);
    dicionario = await resposta.json();
  } catch(e) { console.warn(`${ID} | não foi possível carregar o idioma ${idioma}`, e); }
}

export const esc = v => Handlebars.escapeExpression(v ?? "");

/* ------------------------------------------------------------------ */
/*  Raridades                                                          */
/* ------------------------------------------------------------------ */

/** Em ordem crescente. O peso é o padrão usado quando o item entra no pool. */
export const RARIDADES = {
  common:    {peso: 50, som: null},
  uncommon:  {peso: 30, som: "sounds/notify.wav"},
  rare:      {peso: 12, som: "sounds/lock.wav"},
  veryRare:  {peso: 5,  som: "sounds/drums.wav"},
  legendary: {peso: 2,  som: "sounds/combat/epic-turn-2hit.ogg"},
  artifact:  {peso: 1,  som: "sounds/combat/epic-start-3hit.ogg"}
};
export const ORDEM = Object.keys(RARIDADES);
export const nivel = raridade => Math.max(0, ORDEM.indexOf(raridade));
export const nomeRaridade = raridade => t(`Raridade.${raridade in RARIDADES ? raridade : "common"}`);

const APELIDOS = {
  "very-rare": "veryRare", veryrare: "veryRare", "very rare": "veryRare",
  unique: "artifact", mundane: "common", none: "common"
};

/** Raridade de um item (ou de uma entrada de índice). Null quando o item não tem raridade. */
export function raridadeDe(item) {
  let r = item?.system?.rarity ?? item?.system?.traits?.rarity ?? null;
  if ( (r !== null) && (typeof r === "object") ) r = r.value ?? null;
  if ( !r || (typeof r !== "string") ) return null;
  if ( r in RARIDADES ) return r;
  return APELIDOS[r.toLowerCase()] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Pool                                                               */
/* ------------------------------------------------------------------ */

const pesoValido = v => Math.clamp(Math.round(Number(v)) || 1, 1, 9999);

export function entrada({uuid, name, img, rarity, weight}) {
  const raridade = rarity in RARIDADES ? rarity : "common";
  return {
    uuid: String(uuid),
    name: String(name ?? "?"),
    img: img || "icons/svg/item-bag.svg",
    rarity: raridade,
    weight: pesoValido(weight ?? RARIDADES[raridade].peso)
  };
}

/* Baralhos: vários pools com nome, um deles ativo. Guardados em "baralhos" = {ativo, lista: [{id, nome, itens}]}.
   Quem vem da versão de um pool só ("itemPool") ganha um baralho com aqueles itens. */

/** Todos os baralhos (cópia), sempre com pelo menos um. */
export function lerBaralhos() {
  let dados = {};
  try { dados = foundry.utils.deepClone(game.settings.get(ID, "baralhos") ?? {}); } catch { dados = {}; }
  let lista = Array.isArray(dados.lista) ? dados.lista.filter(b => b?.id) : [];
  if ( !lista.length ) {
    let antigos = [];
    try { antigos = JSON.parse(game.settings.get(ID, "itemPool") || "[]"); } catch { antigos = []; }
    lista = [{id: "principal", nome: t("Baralho.Padrao"), itens: Array.isArray(antigos) ? antigos : []}];
  }
  for ( const b of lista ) {
    b.nome = String(b.nome ?? "?");
    b.itens = Array.isArray(b.itens) ? b.itens.filter(i => i?.uuid).map(entrada) : [];
  }
  const ativo = lista.some(b => b.id === dados.ativo) ? dados.ativo : lista[0].id;
  return {ativo, lista};
}

export async function salvarBaralhos(dados) {
  await game.settings.set(ID, "baralhos", {ativo: dados.ativo, lista: dados.lista});
}

/** Baralho em uso. */
export function baralhoAtivo() {
  const {ativo, lista} = lerBaralhos();
  return lista.find(b => b.id === ativo) ?? lista[0];
}

export async function ativarBaralho(id) {
  const dados = lerBaralhos();
  if ( !dados.lista.some(b => b.id === id) ) return;
  dados.ativo = id;
  await salvarBaralhos(dados);
}

/** Itens do baralho ativo (cópia). */
export function lerPool() {
  return baralhoAtivo().itens;
}

/** Grava os itens no baralho ativo. */
export async function salvarPool(lista) {
  const dados = lerBaralhos();
  const alvo = dados.lista.find(b => b.id === dados.ativo);
  alvo.itens = lista.map(entrada);
  await salvarBaralhos(dados);
}

/** Chance (0 a 100) de cada raridade sair numa carta. */
export function chancesPorRaridade(pool) {
  const total = pool.reduce((s, i) => s + i.weight, 0);
  const soma = Object.fromEntries(ORDEM.map(r => [r, 0]));
  for ( const i of pool ) soma[i.rarity] += i.weight;
  return ORDEM.filter(r => soma[r] > 0).map(r => ({raridade: r, chance: soma[r] / total * 100}));
}

export function porcento(v) {
  if ( v >= 10 ) return `${v.toFixed(0)}%`;
  if ( v >= 1 ) return `${v.toFixed(1)}%`;
  if ( v >= 0.01 ) return `${v.toFixed(2)}%`;
  return v > 0 ? "<0.01%" : "0%";
}

/* ------------------------------------------------------------------ */
/*  Sorteio                                                            */
/* ------------------------------------------------------------------ */

function sortearUm(pool) {
  const total = pool.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for ( const item of pool ) {
    r -= item.weight;
    if ( r <= 0 ) return item;
  }
  return pool.at(-1);
}

/**
 * Sorte da mesa (0 a 1) a partir dos d20 rolados: a média deles, onde 1 vale 0 e 20 vale 1.
 * Sem nenhum dado, a sorte é 0 e o sorteio usa só os pesos do pool.
 */
export function sorteDe(totais) {
  if ( !totais.length ) return 0;
  const media = totais.reduce((s, v) => s + v, 0) / totais.length;
  return Math.clamp((media - 1) / 19, 0, 1);
}

/**
 * Pool com os pesos puxados para as raridades altas. Cada degrau de raridade acima de Comum
 * multiplica o peso por (1 + sorte × forca). Com sorte 1 e força 1: Incomum ×2, Raro ×4,
 * Muito raro ×8, Lendário ×16, Artefato ×32.
 */
export function comSorte(pool, sorte, forca=1) {
  if ( !(sorte > 0) || !(forca > 0) ) return pool;
  const base = 1 + sorte * forca;
  return pool.map(i => ({...i, weight: i.weight * base ** nivel(i.rarity)}));
}

/**
 * Raridade que os dados da sorte garantem ("none" = nenhuma):
 * - critico: garantida quando alguém tira 20 natural;
 * - garante: garantida quando a média dos dados chega a `minimo`.
 * Vale a maior das duas.
 */
export function garantiaDosDados(totais, {critico="none", minimo=20, garante="none"}={}) {
  if ( !totais.length ) return "none";
  let melhor = "none";
  const sobe = r => { if ( (r in RARIDADES) && (nivel(r) > nivel(melhor)) ) melhor = r; };
  if ( totais.some(v => v >= 20) ) sobe(critico);
  const media = totais.reduce((s, v) => s + v, 0) / totais.length;
  if ( media >= minimo ) sobe(garante);
  return melhor;
}

/**
 * Faz valer uma garantia: se nenhuma carta alcança `raridade`, a mais fraca é trocada por um item
 * dessa raridade ou melhor (se o pool tiver algum).
 */
function garantir(saiu, pool, raridade) {
  const minimo = nivel(raridade);
  if ( !(raridade in RARIDADES) || (minimo <= 0) || saiu.some(i => nivel(i.rarity) >= minimo) ) return;
  const bons = pool.filter(i => nivel(i.rarity) >= minimo);
  if ( !bons.length ) return;
  const pior = Math.min(...saiu.map(i => nivel(i.rarity)));
  const posicoes = saiu.map((i, k) => (nivel(i.rarity) === pior ? k : -1)).filter(k => k >= 0);
  saiu[posicoes[Math.floor(Math.random() * posicoes.length)]] = sortearUm(bons);
}

/** Sorteios com esta quantidade de cartas (ou mais) recebem a garantia. */
export const GARANTIA_MINIMO = 5;

/**
 * Sorteia `quantidade` itens do pool.
 * - semRepeticao: o mesmo item não sai duas vezes no mesmo sorteio (enquanto houver itens diferentes).
 * - garantia: raridade mínima garantida em pelo menos uma carta nos sorteios de 5 ou mais.
 * - sorte (0 a 1) e forca: dados da sorte dos jogadores, ver comSorte().
 * - garantiaSorte: raridade mínima que os dados garantiram (vale para qualquer quantidade de cartas).
 */
export function sortear(pool, quantidade, {semRepeticao=false, garantia="none", sorte=0, forca=1, garantiaSorte="none",
  garantiaAcumulada="none"}={}) {
  if ( !pool.length ) return [];
  pool = comSorte(pool, sorte, forca);
  const saiu = [];
  let resto = [...pool];
  for ( let n = 0; n < quantidade; n++ ) {
    if ( !resto.length ) resto = [...pool];
    const item = sortearUm(resto);
    saiu.push(item);
    if ( semRepeticao ) resto = resto.filter(i => i !== item);
  }

  if ( quantidade >= GARANTIA_MINIMO ) garantir(saiu, pool, garantia);
  garantir(saiu, pool, garantiaSorte);
  garantir(saiu, pool, garantiaAcumulada);
  return saiu.map(i => entrada({...i, weight: Math.max(1, Math.round(i.weight))}));
}

/* ------------------------------------------------------------------ */
/*  Garantia acumulada, custo e histórico                              */
/* ------------------------------------------------------------------ */

/**
 * Garantia acumulada: depois de `n` sorteios seguidos sem `raridade` (ou melhor), o próximo garante.
 * @returns {{ligada: boolean, n: number, raridade: string, contador: number, faltam: number, garante: boolean}}
 */
export function garantiaAcumulada() {
  const n = Math.max(0, Math.round(Number(game.settings.get(ID, "acumuladaN")) || 0));
  const raridade = game.settings.get(ID, "acumuladaRaridade");
  const contador = Math.max(0, Math.round(Number(game.settings.get(ID, "acumuladaContador")) || 0));
  const ligada = (n > 0) && (raridade in RARIDADES) && (nivel(raridade) > 0);
  return {ligada, n, raridade, contador, faltam: Math.max(0, n - contador), garante: ligada && (contador >= n)};
}

/** Conta o sorteio que acabou: zera se saiu a raridade da garantia, senão soma um. */
export async function contarParaGarantia(ganhos) {
  const g = garantiaAcumulada();
  if ( !g.ligada ) return;
  const saiu = ganhos.some(i => nivel(i.rarity) >= nivel(g.raridade));
  await game.settings.set(ID, "acumuladaContador", saiu ? 0 : g.contador + 1);
}

/** Peças de ouro do personagem, ou null se a ficha não tem moedas (sistema sem `system.currency.gp`). */
export function ouroDe(actor) {
  const gp = actor?.system?.currency?.gp;
  return (typeof gp === "number") ? gp : null;
}

/** Desconta `valor` peças de ouro do personagem e avisa no chat. */
export async function cobrar(actor, valor) {
  await actor.update({"system.currency.gp": ouroDe(actor) - valor});
  await ChatMessage.create({
    content: `<div class="agacha-chat"><p class="agacha-chat-pago"><i class="fa-solid fa-coins"></i> ${
      t("Chat.Pagou", {nome: `<strong>${esc(actor.name)}</strong>`, valor})}</p></div>`,
    speaker: {alias: t("Nome")}
  });
}

/** Acrescenta uma linha (HTML) no topo do diário de histórico, criando o diário na primeira vez. */
export async function registrarHistorico(linha) {
  if ( !game.user.isGM || !game.settings.get(ID, "historico") ) return;
  let diario = game.journal.find(j => j.getFlag(ID, "historico"));
  if ( !diario ) {
    diario = await JournalEntry.create({
      name: t("Historico.Nome"),
      flags: {[ID]: {historico: true}},
      pages: [{name: t("Historico.Pagina"), type: "text", text: {content: "", format: 1}}]
    });
  }
  const pagina = diario.pages.contents[0];
  if ( !pagina ) return;
  const quando = new Date().toLocaleString(game.i18n.lang, {dateStyle: "short", timeStyle: "short"});
  await pagina.update({"text.content": `<p><strong>${quando}</strong> · ${linha}</p>${pagina.text.content ?? ""}`});
}

/** Lista de itens para o histórico e o chat: "@UUID[…]{Nome} (Raridade)". */
export const listaDeItens = itens => itens.map(i => `@UUID[${i.uuid}]{${esc(i.name)}} (${esc(nomeRaridade(i.rarity))})`).join(", ");

/* ------------------------------------------------------------------ */
/*  Entrega e chat                                                     */
/* ------------------------------------------------------------------ */

/**
 * Quem pode receber itens: todas as fichas de jogador (tipo "character") e qualquer outra ficha que
 * tenha um jogador como dono. As de jogadores vêm primeiro.
 */
export function destinatarios() {
  const visiveis = game.actors.filter(a => a.isOwner);
  const fichas = visiveis.filter(a => (a.type === "character") || a.hasPlayerOwner);
  return (fichas.length ? fichas : visiveis).sort((a, b) =>
    (Number(b.hasPlayerOwner) - Number(a.hasPlayerOwner)) || a.name.localeCompare(b.name));
}

/** Cria no personagem uma cópia do item sorteado e avisa no chat. */
export async function entregar(item, actor) {
  const doc = await fromUuid(item.uuid).catch(() => null);
  if ( !doc ) {
    ui.notifications.warn(t("Aviso.NaoEncontrado", {nome: item.name}));
    return null;
  }
  const dados = game.items.fromCompendium(doc);
  const [criado] = await actor.createEmbeddedDocuments("Item", [dados]);
  if ( !criado ) return null;
  await ChatMessage.create({
    content: `<div class="agacha-chat"><div class="agacha-chat-linha rar-${esc(item.rarity)}">
      <img src="${esc(criado.img)}" alt="">
      <div>${t("Chat.Recebeu", {nome: `<strong>${esc(actor.name)}</strong>`, item: `@UUID[${criado.uuid}]{${esc(criado.name)}}`})}
        <span class="agacha-chat-rar">${esc(nomeRaridade(item.rarity))}</span></div>
    </div></div>`,
    speaker: {alias: t("Nome")}
  });
  return criado;
}

/** Publica o resultado do sorteio no chat, com link para cada item. Uma linha por item, para caber dez. */
export function resultadoNoChat(itens) {
  const linhas = itens.map(i => `
    <li class="rar-${esc(i.rarity)}">
      <img src="${esc(i.img)}" alt="">
      <span class="agacha-chat-nome">@UUID[${i.uuid}]{${esc(i.name)}}</span>
      <span class="agacha-chat-rar">${esc(nomeRaridade(i.rarity))}</span>
    </li>`).join("");
  return ChatMessage.create({
    content: `<div class="agacha-chat"><h3>${esc(t("Chat.Titulo"))}</h3>
      <ol class="agacha-chat-lista">${linhas}</ol>
      <footer>${esc(t("Nome"))} · Arcano Lab</footer></div>`,
    speaker: {alias: t("Nome")}
  });
}
