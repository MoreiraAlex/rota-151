import {
  resolveRenderPosition,
  resolveRenderRotation,
} from './renderInterpolation'

const entityViews = new Map()
const position = {}
const rotation = {}

/**
 * Liga a entidade ao objeto da cena que a desenha (o `syncTransformSystem`
 * move ele a cada frame). Já põe o objeto na posição/giro de agora da
 * entidade: sem isso, ele ficava na origem da cena até o próximo
 * `syncTransformSystem` — e quem registra no `useEffect` (que roda depois de
 * o R3F já ter desenhado um quadro) aparecia um instante lá (o invocar
 * mostrava o feixe e a luz da criatura na origem — docs/features/043-
 * captura.md). Registre num `useLayoutEffect` (antes do primeiro quadro).
 */
export function registerView(entity, mesh) {
  entityViews.set(entity, mesh)
  placeAtEntity(mesh, entity)
}

/**
 * Põe o objeto na posição/giro de agora da entidade, sem registrar — pra
 * quem registra mais tarde mas não pode aparecer na origem antes
 * (`useAnimatedModel`).
 */
export function placeAtEntity(mesh, entity) {
  if (!mesh?.position || typeof entity?.get !== 'function') return
  if (resolveRenderPosition(entity, position)) {
    mesh.position.set(position.x, position.y, position.z)
  }
  if (resolveRenderRotation(entity, rotation)) {
    mesh.rotation.set(rotation.x, rotation.y, rotation.z)
  }
}

export function unregisterView(entity) {
  entityViews.delete(entity)
}

export function getView(entity) {
  return entityViews.get(entity)
}
