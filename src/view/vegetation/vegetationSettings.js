/**
 * O que o debug (F2, painel "Vegetação") mexe na vegetação
 * (docs/features/049-vegetacao-e-floresta.md): ligar e desligar grama,
 * flores, árvores, sub-bosque (arbustos, samambaias, plantas, cogumelos) e
 * pedras com troncos caídos (para medir o FPS) e refazer os blocos de grama
 * e flores depois de mudar densidade, cores ou qualidade no `GAME_CONFIG`.
 * Os números de material (vento, cor da folha) o `VegetationView` lê a cada
 * quadro e não precisam disto.
 */
let state = {
  grass: true,
  flowers: true,
  trees: true,
  undergrowth: true,
  rocks: true,
  revision: 0,
}
const listeners = new Set()

const notify = () => {
  for (const listener of listeners) listener()
}

export const getVegetationSettings = () => state

/**
 * Liga ou desliga uma parte (`grass`, `flowers`, `trees`, `undergrowth`,
 * `rocks`).
 */
export function setVegetationVisible(part, isVisible) {
  state = { ...state, [part]: isVisible }
  notify()
}

/** Refaz a vegetação só visual com o `GAME_CONFIG` de agora. */
export function rebuildVegetation() {
  state = { ...state, revision: state.revision + 1 }
  notify()
}

export function subscribeVegetationSettings(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
