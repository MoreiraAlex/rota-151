// Cor por categoria de item — fundo do ícone padrão de quem não tem sprite
// (`tools/shared/ItemFallbackIcon.jsx`). Fica em `view/`, mesmo raciocínio
// de `creatureTints.js`: compartilhado entre o HUD sempre visível
// (`tools/hud/PartyHud.jsx`) e a tela de inventário
// (`tools/menu/InventoryPanel.jsx`) — uma cor só, não duas divergindo.
export const ITEM_COLORS = {
  throwable: '#d97706',
  consumable: '#7c3aed',
  scanner: '#dc2626',
  pokeball: '#e11d48',
  berry: '#16a34a',
}

// Cor própria de um item (ex.: a fruta caída no chão,
// `view/scene/DroppedFoodView.jsx`) — sem entrada, a da categoria.
export const ITEM_TINTS = {
  'razz-berry': '#be123c',
  'nanab-berry': '#facc15',
  'pinap-berry': '#eab308',
}
