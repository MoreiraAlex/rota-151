/**
 * Pedidos de partícula da Pokébola (docs/features/043-captura.md): quem
 * percebe o momento (`pokeballFeedbackSystem`) empilha aqui; o
 * `PokeballVfxView.jsx` drena a cada frame e cria as partículas. Estado de
 * tela — mesmo padrão de `foodVfxQueue.js`.
 *
 * Pedido: `{ kind: 'sendOut' | 'capture', itemId, position: { x, y, z } }`.
 */
const pending = []

export function requestPokeballVfx(request) {
  pending.push(request)
}

/** Devolve os pedidos acumulados e esvazia a fila. */
export function drainPokeballVfx() {
  return pending.splice(0, pending.length)
}
