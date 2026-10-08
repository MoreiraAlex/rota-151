/**
 * As Pokébolas da mão no invocar/recolher (`HandBallView.jsx` →
 * `handBallViewSystem.js`, docs/features/043-captura.md): uma por tipo de
 * bola (id do item) — o grupo solto na cena e o tocador de clipe (`model`,
 * `mixer`, `clip`, ver `ballClipPlayer.js`). O modelo pode chegar antes do
 * grupo (efeito do filho roda antes). Estado de tela.
 */
import { setBallClipModel } from '../ballClipPlayer'

const entries = new Map()

function entryOf(itemId) {
  if (!entries.has(itemId)) {
    entries.set(itemId, { group: null, model: null, mixer: null, clip: null })
  }
  return entries.get(itemId)
}

export function registerHandBall(itemId, group) {
  entryOf(itemId).group = group
}

export function setHandBallModel(itemId, model) {
  if (!model && !entries.has(itemId)) return
  setBallClipModel(entryOf(itemId), model)
}

export function unregisterHandBall(itemId) {
  entries.get(itemId)?.mixer?.stopAllAction()
  entries.delete(itemId)
}

export function listHandBalls() {
  return entries
}
