/**
 * Fila de eventos de jogo — fatos tipados ("aconteceu"), nunca estado
 * ("é verdade agora"). Ver docs/rules/README.md, seção 7 ("Ao preencher a
 * fase de eventos").
 *
 * Dois leitores, cada evento visto UMA vez por cada um:
 * - **gameplay** (systems da fase `events` do passo fixo): leem
 *   `stepEvents()` — só o que foi emitido NESTE passo. O loop chama
 *   `beginStep()` antes de cada passo fixo.
 * - **apresentação** (efeitos visuais/sonoros): o loop chama `drain()` uma
 *   vez por frame, logo antes da fase de apresentação — tudo que foi
 *   emitido nos 0..N passos fixos do frame — e entrega como
 *   `context.frameEvents`.
 *
 * Ordem de emissão preservada. Sem consumidor, o evento some no próximo
 * `beginStep`/`drain` — nada fica retido.
 */
export function createEventQueue() {
  let frame = []
  let step = []

  return {
    emit(event) {
      frame.push(event)
      step.push(event)
    },
    beginStep() {
      step = []
    },
    stepEvents() {
      return step
    },
    drain() {
      const drained = frame
      frame = []
      return drained
    },
  }
}
