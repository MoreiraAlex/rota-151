import { Position, Rotation } from '@/core/traits'
import { getView } from '@/view/registry/viewRegistry'
import {
  resolveRenderPosition,
  resolveRenderRotation,
} from '@/view/registry/renderInterpolation'

const position = {}
const rotation = {}

/**
 * Ponte ECS → Three.js: copia Position/Rotation das entidades para os objetos
 * de cena registrados. Vive na camada view porque toca refs de renderer.
 * Interpolado entre o passo fixo anterior e o atual
 * (`view/registry/renderInterpolation.js`) — Position crua anda em degraus
 * do passo fixo, fora do ritmo do render.
 *
 * Fase: presentation (passo variável). Só lê traits, nunca os escreve.
 */
export function syncTransformSystem(context) {
  const { world } = context

  world.query(Position, Rotation).forEach((entity) => {
    const object = getView(entity)
    if (!object) return

    resolveRenderPosition(entity, position)
    resolveRenderRotation(entity, rotation)

    object.position.set(position.x, position.y, position.z)
    object.rotation.set(rotation.x, rotation.y, rotation.z)
  })
}
