/**
 * Pedidos de nuvem de poeira avulsa (fora do pulo), feitos pela simulação da
 * view e soltos pela `JumpDustView.jsx` no próximo quadro — hoje, a selvagem
 * que fugiu e sumiu do mapa (`wildFledDustSystem.js`, docs/features/063-
 * revisao-da-ia-selvagem.md). Fila simples de módulo: a view só tem uma
 * `JumpDustView`.
 */
const queue = []

/** Pede uma nuvem nos pés, em `position` (`{ x, y, z }`). */
export function requestDustPuff(position) {
  queue.push({ x: position.x, y: position.y, z: position.z })
}

/** Tira e devolve todos os pedidos pendentes. */
export function drainDustPuffs() {
  return queue.splice(0, queue.length)
}
