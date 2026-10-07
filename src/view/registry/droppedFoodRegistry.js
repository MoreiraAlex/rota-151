/**
 * Registro fruta caída → o que gira quando ela rola (`DroppedFoodView.jsx`),
 * pro `droppedFoodViewSystem.js` fazer ela rolar e respingar
 * (docs/features/042-itens-da-beta.md). Gira no pivô — o do modelo (`model`,
 * de `ItemModel.jsx`: centro do corpo da fruta) ou o da esfera
 * (`spherePivotRef`). `landings` é o último pulso de quique visto
 * (`DroppedFood.landings`). Mesmo padrão de `viewRegistry.js`.
 */
const entries = new Map()

function entryOf(entity) {
  if (!entries.has(entity)) {
    entries.set(entity, { spherePivotRef: null, model: null, landings: 0 })
  }
  return entries.get(entity)
}

export function registerDroppedFood(entity, spherePivotRef, landings = 0) {
  const entry = entryOf(entity)
  entry.spherePivotRef = spherePivotRef
  entry.landings = landings
}

export function setDroppedFoodModel(entity, model) {
  if (!model && !entries.has(entity)) return
  entryOf(entity).model = model
}

export function unregisterDroppedFood(entity) {
  entries.delete(entity)
}

export function getDroppedFood(entity) {
  return entries.get(entity)
}

/** O que gira quando a fruta rola: o pivô do modelo ou o da esfera. */
export function resolveDroppedFoodPivot(entry) {
  return entry.model?.pivot ?? entry.spherePivotRef?.current ?? null
}
