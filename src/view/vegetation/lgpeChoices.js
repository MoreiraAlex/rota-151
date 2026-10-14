/**
 * Os modelos do LGPE que o painel (F2) pediu além dos que os biomas usam
 * (docs/features/053-planicie-com-assets-do-lgpe.md): marcar um modelo
 * ainda não carregado no "Modelos" de um tipo pede ele aqui. O
 * `LgpeChoiceLoader` carrega os pedidos fora da vegetação (com o próprio
 * `<Suspense>`, sem parar a cena) e só então eles ficam prontos — aí a
 * vegetação monta com eles, já no cache, sem suspender.
 */
let requested = []
let ready = []
const listeners = new Set()

const notify = () => {
  for (const listener of listeners) listener()
}

/** Pede os modelos `ids` (os já pedidos ficam). */
export function requestLgpeModels(ids) {
  const fresh = ids.filter((id) => !requested.includes(id))
  if (fresh.length === 0) return
  requested = [...requested, ...fresh]
  notify()
}

/** Os pedidos de agora já carregaram (chamado pelo `LgpeChoiceLoader`). */
export function markLgpeModelsReady(ids) {
  if (ids.every((id) => ready.includes(id))) return
  ready = [...new Set([...ready, ...ids])]
  notify()
}

export const getRequestedLgpeIds = () => requested
export const getReadyLgpeIds = () => ready

export function subscribeLgpeChoices(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
