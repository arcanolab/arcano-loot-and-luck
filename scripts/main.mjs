// Arcano Loot & Luck — configurações, tecla, botão nos controles de cena, soquete e API.

import * as nucleo from "./nucleo.mjs";
import {GachaApp, PoolConfig, SorteConfig, assinarConfiguracoes} from "./janelas.mjs";

const {ID, t} = nucleo;

const GARANTIAS = ["none", "uncommon", "rare", "veryRare", "legendary"];
const opcoesGarantia = () => Object.fromEntries(GARANTIAS.map(g =>
  [g, g === "none" ? t("Garantia.none") : t("Garantia.ouMelhor", {raridade: nucleo.nomeRaridade(g)})]));

/** Traduz nome, dica e opções das configurações, do menu e da tecla no idioma do módulo. */
function renomearConfiguracoes() {
  const renomear = (item, campos) => {
    item._agOriginal ??= Object.fromEntries(campos.map(c => [c, item[c]]));
    for ( const c of campos ) if ( item._agOriginal[c] ) item[c] = nucleo.traduzir(item._agOriginal[c]);
  };
  for ( const [id, cfg] of game.settings.settings ) if ( id.startsWith(`${ID}.`) ) renomear(cfg, ["name", "hint"]);
  for ( const [id, menu] of game.settings.menus ) if ( id.startsWith(`${ID}.`) ) renomear(menu, ["name", "hint", "label"]);
  for ( const [id, tecla] of game.keybindings.actions ) if ( id.startsWith(`${ID}.`) ) renomear(tecla, ["name", "hint"]);
  const garantia = game.settings.settings.get(`${ID}.garantia`);
  if ( garantia ) garantia.choices = opcoesGarantia();
  const mascote = game.settings.settings.get(`${ID}.mascote`);
  if ( mascote ) mascote.choices = {boneco: t("Config.MascoteBoneco"), pintura: t("Config.MascotePintura")};
  const idioma = game.settings.settings.get(`${ID}.idioma`);
  if ( idioma ) idioma.choices = {...nucleo.IDIOMAS, auto: t("Idioma.auto")};
}

Hooks.once("init", () => {
  // Pool de itens: texto JSON, igual à versão 1.0.0, para o pool antigo continuar valendo.
  game.settings.register(ID, "itemPool", {scope: "world", config: false, type: String, default: "[]"});
  // Baralhos: {ativo, lista: [{id, nome, itens}]}. Vazio = usa o pool antigo como primeiro baralho.
  game.settings.register(ID, "baralhos", {scope: "world", config: false, type: Object, default: {}});
  // Mesa: quem joga, modo (revelar todas / escolher), quantas escolhas e custo por rodada.
  game.settings.register(ID, "mesa", {scope: "world", config: false, type: Object, default: {}});
  // Garantia acumulada (ajustada na janela dos dados da sorte) e o contador dela.
  game.settings.register(ID, "acumuladaN", {scope: "world", config: false, type: Number, default: 0});
  game.settings.register(ID, "acumuladaRaridade", {scope: "world", config: false, type: String, default: "rare"});
  game.settings.register(ID, "acumuladaContador", {scope: "world", config: false, type: Number, default: 0});

  game.settings.registerMenu(ID, "pool", {
    name: "AGACHA.Config.Pool",
    hint: "AGACHA.Config.PoolDica",
    label: "AGACHA.ConfigurarPool",
    icon: "fa-solid fa-layer-group",
    type: PoolConfig,
    restricted: true
  });
  game.settings.register(ID, "idioma", {
    name: "AGACHA.Config.Idioma",
    hint: "AGACHA.Config.IdiomaDica",
    scope: "client",
    config: true,
    type: String,
    default: "auto",
    choices: nucleo.IDIOMAS,
    requiresReload: true
  });
  game.settings.register(ID, "mostrarJogadores", {
    name: "AGACHA.Config.MostrarJogadores",
    hint: "AGACHA.Config.MostrarJogadoresDica",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(ID, "semRepeticao", {
    name: "AGACHA.Config.SemRepeticao",
    hint: "AGACHA.Config.SemRepeticaoDica",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(ID, "garantia", {
    name: "AGACHA.Config.Garantia",
    hint: "AGACHA.Config.GarantiaDica",
    scope: "world",
    config: true,
    type: String,
    default: "none",
    choices: Object.fromEntries(GARANTIAS.map(g => [g, g]))
  });
  game.settings.register(ID, "revelarAuto", {
    name: "AGACHA.Config.RevelarAuto",
    hint: "AGACHA.Config.RevelarAutoDica",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  // Dados da sorte: tudo isto é ajustado na janela "Ajustar os dados da sorte".
  game.settings.registerMenu(ID, "sorte", {
    name: "AGACHA.Config.Sorte",
    hint: "AGACHA.Config.SorteDica",
    label: "AGACHA.Sorte.Ajustar",
    icon: "fa-solid fa-dice-d20",
    type: SorteConfig,
    restricted: true
  });
  game.settings.register(ID, "dadosSorte", {scope: "world", config: false, type: Boolean, default: true});
  game.settings.register(ID, "forcaSorte", {scope: "world", config: false, type: Number, default: 1});
  game.settings.register(ID, "sorteCritico", {scope: "world", config: false, type: String, default: "none"});
  game.settings.register(ID, "sorteMinimo", {scope: "world", config: false, type: Number, default: 20});
  game.settings.register(ID, "sorteGarante", {scope: "world", config: false, type: String, default: "none"});
  game.settings.register(ID, "historico", {
    name: "AGACHA.Config.Historico",
    hint: "AGACHA.Config.HistoricoDica",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(ID, "mascote", {
    name: "AGACHA.Config.Mascote",
    hint: "AGACHA.Config.MascoteDica",
    scope: "world",
    config: true,
    type: String,
    default: "boneco",
    choices: {boneco: "AGACHA.Config.MascoteBoneco", pintura: "AGACHA.Config.MascotePintura"}
  });
  game.settings.register(ID, "musica", {
    name: "AGACHA.Config.Musica",
    hint: "AGACHA.Config.MusicaDica",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(ID, "fogos", {
    name: "AGACHA.Config.Fogos",
    hint: "AGACHA.Config.FogosDica",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(ID, "som", {
    name: "AGACHA.Config.Som",
    hint: "AGACHA.Config.SomDica",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.keybindings.register(ID, "abrir", {
    name: "AGACHA.Tecla.Abrir",
    editable: [{key: "KeyG", modifiers: ["Alt"]}],
    restricted: true,
    onDown: () => { GachaApp.abrir(); return true; }
  });

  const api = {
    /** Abre a janela do sorteio (só o mestre). */
    abrir: () => GachaApp.abrir(),
    /** Abre a janela do pool (só o mestre). */
    configurar: () => PoolConfig.abrir(),
    /** Abre a janela de ajuste dos dados da sorte (só o mestre). */
    ajustarSorte: () => SorteConfig.abrir(),
    /** Abre a janela e sorteia `quantidade` cartas. Devolve os itens sorteados. */
    sortear: (quantidade=1) => GachaApp.abrir()?.sortear(quantidade) ?? [],
    /** Pool salvo no mundo: [{uuid, name, img, rarity, weight}]. */
    pool: () => nucleo.lerPool()
  };
  game.modules.get(ID).api = api;
  // Nome usado pela macro da versão 1.0.0.
  game.gachaMagicItems = {open: api.abrir};
});

Hooks.once("i18nInit", async () => {
  renomearConfiguracoes();
  await nucleo.carregarIdioma();
  renomearConfiguracoes();
});

Hooks.once("ready", () => {
  game.socket.on(`module.${ID}`, dados => {
    try { Promise.resolve(GachaApp.receber(dados)).catch(e => console.error(`${ID} |`, e)); }
    catch(e) { console.error(`${ID} |`, e); }
  });
});

/* Botão do mestre nos controles de cena: dentro do grupo Arcano Lab (módulo Arcano Lab Hub);
   sem o Hub ativo, fica nos controles de token. */
let noGrupoArcano = false;

Hooks.once("setup", () => {
  const hub = game.modules.get("arcano-hub");
  if ( !hub?.active || (typeof hub.api?.registerTool !== "function") ) return;
  // A marca vem antes: registrar pode remontar a barra na mesma hora.
  noGrupoArcano = true;
  noGrupoArcano = hub.api.registerTool({
    name: "agacha",
    title: () => t("Abrir"),
    icon: "modules/arcano-hub/assets/tools/chest.svg",
    visible: () => game.user.isGM,
    onClick: () => GachaApp.abrir()
  });
});

Hooks.on("getSceneControlButtons", controles => {
  if ( noGrupoArcano ) return;
  const tokens = controles.tokens;
  if ( !tokens?.tools ) return;
  tokens.tools.agacha = {
    name: "agacha",
    title: t("Abrir"),
    icon: "fa-solid fa-wand-sparkles",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => GachaApp.abrir()
  };
});

Hooks.on("renderSettingsConfig", assinarConfiguracoes);
