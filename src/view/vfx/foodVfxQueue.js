/**
 * Pedidos de partícula de fruta (docs/features/042-itens-da-beta.md): quem
 * percebe o momento (`eatingFoodViewSystem` — a mordida; `droppedFoodView
 * System` — a fruta caída batendo no chão) só empilha aqui; o
 * `EatingVfxView.jsx` drena a cada frame e cria as partículas. Estado de
 * tela, fora do ECS — mesmo espírito dos registros da view.
 *
 * Pedido: `{ kind: 'bite' | 'land', itemId, position: [x, y, z] }` (mundo).
 */
const pending = []

export function requestFoodVfx(request) {
  pending.push(request)
}

/** Devolve os pedidos acumulados e esvazia a fila. */
export function drainFoodVfx() {
  return pending.splice(0, pending.length)
}
