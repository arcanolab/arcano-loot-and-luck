# Arcano Loot & Luck

*by [Arcano Lab](https://www.patreon.com/arcanolab) · Foundry VTT v14*

Turn loot into a moment. Build a pool of magic items, press Draw, and the whole table watches the cards land face down and flip one by one, each glowing in the colour of its rarity.

## Features
- **Card reveal for everyone** — when the GM draws, the card window opens for every connected player with the same animation. Can be turned off for secret draws.
- **Rarity is a show** — rare cards shake and glow before flipping, then burst into sparks; Legendary and Artifact light up the whole stage. Each rarity has its own sound.
- **Nibbles the Mimic** — a treasure-chest cub who hosts the show: he welcomes the table on a cover screen, asks for 1d10 to decide how many cards, shuffles them with his tongue, spits them onto the table and reacts to every reveal (he breathes, sways, hops when he talks and jumps for a Legendary).
- **You decide what the dice are worth** — a window shows, for your current deck, the odds of each rarity for every dice result, lets you set the strength, and lets you guarantee a rarity on a natural 20 or on a dice average.
- **Players at the table** — choose who plays: that player flips the cards on their own screen. In Pick mode only the cards they flip count, and the rest are shown greyed out.
- **Decks, cost and history** — keep several decks and switch on the fly, charge gold per round from the playing character, and log every draw and delivery to a journal.
- **Pity guarantee** — after N rounds without a rarity, the next round guarantees it.
- **The GM holds the suspense** — cards land face down; click one to flip it, or press Reveal all. Legendary and Artifact set off full-screen fireworks.
- **Luck dice** — ask the players for 1d20 before a draw. The average of the dice (1 = nothing, 20 = maximum) multiplies the weight of every rarity step above Common, and the window shows the new odds.
- **Draw 1, 3, 5 or 10** — with "Reveal all" to skip the animation.
- **Weighted pool** — every item has a weight; the pool window shows the chance of each item and of each rarity.
- **Fill the pool fast** — import a whole compendium filtered by rarity, or drag items and item folders from the sidebar or a compendium.
- **Hand it over** — pick a character under a revealed card and the item goes to their sheet, with a chat line. Or drag the card onto any sheet. Click a card to open the item.
- **Send to chat** — the result with a link to each item.
- **House rules** — no repeated items in the same draw; rarity guarantee on draws of 5 or more.
- **Sounds** by rarity, can be turned off per user. All sounds were synthesized for this module.
- **Module language** — follow Foundry, English or Português (Brasil).

## Ready-made NPC: Zarabim and Mordisco
On D&D 5e the module ships a compendium, **Arcano Loot & Luck: Zarabim e Mordisco**. Open it, click the adventure and import: you get Zarabim Trocafado, a mad gnome fortune-seller, his mimic partner Mordisco (the same Mordisco as the module mascot), both tokens, and a journal with his act, a price list tied to the module's modes, ready lines and story hooks. The texts are in Portuguese.

## How to use
1. As GM, press the Arcano Lab button in the scene controls and then the wand (with Arcano Lab Hub active; otherwise the wand is in the token controls), or **Alt + G**.
2. Open **Configure pool**, import a compendium or drag items in, and save.
3. Press **Draw**.

## Macro
```js
const api = game.modules.get("gacha-magic-items").api;
api.abrir();        // open the draw window
api.sortear(5);     // open and draw 5 cards
api.configurar();   // open the pool window
api.pool();         // the saved pool
```

## Install
In Foundry, **Add-on Modules → Install Module**, paste this manifest URL:

`https://github.com/arcanolab/arcano-loot-and-luck/releases/latest/download/module.json`

## Requirements
- Foundry VTT v14. Works with any game system; item rarity is read automatically on D&D 5e.

---

## Português
Transforme o tesouro num momento da sessão. Monte um pool de itens mágicos, aperte Sortear e a mesa inteira vê as cartas chegarem viradas e abrirem uma a uma, cada uma brilhando na cor da raridade. Importe um compêndio inteiro por raridade, entregue o item direto na ficha do personagem e mande o resultado para o chat. Idioma do módulo: seguir o Foundry, English ou Português (Brasil).

© Arcano Lab — see LICENSE.
