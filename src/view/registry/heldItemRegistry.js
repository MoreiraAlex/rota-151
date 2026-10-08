/**
 * O item na mão do jogador (`HeldItemView.jsx` → `heldItemViewSystem.js`):
 * o grupo com o modelo do item, solto na cena, que o system põe no osso da
 * mão a cada frame. Um só (só o jogador desta máquina segura item). Estado
 * de tela.
 */
let held = null

export function registerHeldItemView(group, itemId) {
  held = { group, itemId }
}

export function unregisterHeldItemView(group) {
  if (held?.group === group) held = null
}

export function getHeldItemView() {
  return held
}
