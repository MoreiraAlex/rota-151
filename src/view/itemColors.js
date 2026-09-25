// Cor por categoria de item — placeholder cosmético, sem ícone/modelo de
// verdade ainda (ver docs/features/017-inventario-em-grade.md). Fica em
// `view/`, mesmo raciocínio de `creatureTints.js`: compartilhado entre o
// HUD sempre visível (`tools/hud/PartyHud.jsx`) e a tela de inventário
// (`tools/menu/InventoryPanel.jsx`) — uma cor só, não duas divergindo.
export const ITEM_COLORS = {
  throwable: '#d97706',
  consumable: '#0d9488',
  scanner: '#dc2626',
}
