/**
 * Pokédex — item equipável (mão principal, ver `InventoryPanel.jsx`).
 * Categoria `scanner` (não mais `tool` — renomeada, pedido do usuário:
 * "uma câmera e uma pokédex vão ter a mesma funcionalidade", ver
 * docs/features/031-*.md) — SEGURAR o botão direito
 * (`input.secondaryHeld`, docs/features/033-*.md) liga o modo scanner
 * (`scannerModeSystem.js`): câmera em primeira pessoa + HUD trocada
 * pelo visor (`PokedexVisorHud.jsx`); soltar desliga e confirma o que
 * estiver na mira. Sem efeito nenhum no clique `primary` enquanto
 * segurando — `playerActionSystem.js` ignora categorias que não sejam
 * `throwable`/`consumable`, mesmo fallback gracioso de sempre.
 *
 * `sprite.path` — ícone de verdade no inventário/HUD (`SlotPreview.jsx`),
 * pedido do usuário: "quero a possibilidade de colocar img nos ícones
 * do inventário/hud, já deixei o do sprite da pokédex nos assets".
 *
 * `scanner.range` — alcance máximo (m) do raycast que acha a criatura
 * embaixo do retículo (`scannerModeSystem.js`) — pedido do usuário: "a
 * distância máxima de scan deve ser configurável no data do item
 * responsável pelo scan" (ver docs/features/033-*.md). Por item, não
 * mais um valor global fixo — uma câmera futura (mesma categoria
 * `scanner`) pode ter um alcance diferente da Pokédex.
 */
export const POKEDEX = {
  id: 'pokedex',
  category: 'scanner',
  sprite: { path: '/assets/sprites/itens/pokedex.png' },
  scanner: {
    range: 40,
  },
}
