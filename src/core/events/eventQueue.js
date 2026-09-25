/**
 * Fila de eventos de jogo — fatos tipados ("aconteceu"), nunca estado
 * ("é verdade agora"). Ver docs/rules/README.md, seção 7 ("Ao preencher a
 * fase de eventos").
 *
 * Ciclo (`view/loop/GameLoop.jsx`): systems do passo fixo EMITEM
 * (`context.events.emit`) — pode rodar 0 ou vários passos por frame; o
 * loop DRENA uma vez por frame, logo antes da fase de apresentação, e
 * entrega a lista pros systems de apresentação (`context.frameEvents`).
 * Ordem de emissão preservada. Sem consumidor, o evento simplesmente some
 * no próximo dreno — nada fica retido entre frames.
 */
export function createEventQueue() {
  let pending = []

  return {
    emit(event) {
      pending.push(event)
    },
    drain() {
      const drained = pending
      pending = []
      return drained
    },
  }
}
