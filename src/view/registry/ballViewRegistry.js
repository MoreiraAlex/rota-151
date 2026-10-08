/**
 * Registro das Pokébolas do invocar (`SummonBall` em voo e `SummonBallOpen`
 * abrindo, docs/features/043-captura.md) → o que a view anima: `spinRef` (o
 * grupo do modelo) e o tocador de clipe (`model`, `mixer`, `clip` — ver
 * `ballClipPlayer.js`). O modelo pode chegar antes das refs (efeito do
 * filho roda antes), então as duas entradas criam a entrada.
 */
import { setBallClipModel } from '../ballClipPlayer'

const entries = new Map()

function entryOf(entity) {
  if (!entries.has(entity)) {
    entries.set(entity, {
      spinRef: null,
      itemId: null,
      yaw: null,
      model: null,
      mixer: null,
      clip: null,
    })
  }
  return entries.get(entity)
}

export function registerBallView(entity, spinRef, itemId) {
  const entry = entryOf(entity)
  entry.spinRef = spinRef
  entry.itemId = itemId
}

export function setBallViewModel(entity, model) {
  if (!model && !entries.has(entity)) return
  setBallClipModel(entryOf(entity), model)
}

export function unregisterBallView(entity) {
  entries.get(entity)?.mixer?.stopAllAction()
  entries.delete(entity)
}

export function getBallView(entity) {
  return entries.get(entity)
}
