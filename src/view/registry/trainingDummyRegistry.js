/**
 * Registro boneco de treino (`TrainingObject`) → o grupo que inclina no
 * balanço (`TrainingDummiesView.jsx`, pivô na base do boneco), e o balanço
 * em andamento de cada um (`elapsed`, `axis` — o eixo no chão em volta do
 * qual inclina), pro `trainingDummyWobbleSystem.js` (docs/features/067-
 * campo-de-treino-e-avisos-de-nivel.md). Estado de tela. Mesmo padrão de
 * `viewRegistry.js`.
 */
const tilts = new Map()
const wobbles = new Map()

export function registerTrainingDummy(entity, tilt) {
  tilts.set(entity, tilt)
}

export function unregisterTrainingDummy(entity) {
  tilts.delete(entity)
  wobbles.delete(entity)
}

export function getTrainingDummyTilt(entity) {
  return tilts.get(entity) ?? null
}

/** Começa (ou recomeça) o balanço do boneco, inclinando em volta de `axis`. */
export function startTrainingDummyWobble(entity, axis) {
  if (!tilts.has(entity)) return
  wobbles.set(entity, { elapsed: 0, axis })
}

/** Os balanços em andamento (`[entity, { elapsed, axis }]`). */
export function trainingDummyWobbles() {
  return wobbles
}
