import { Position, Rotation } from '@/core/traits'
import { getView } from '@/view/registry/viewRegistry'

/**
 * Ponte ECS → Three.js: copia Position/Rotation das entidades para os objetos
 * de cena registrados. Vive na camada view porque toca refs de renderer.
 *
 * Fase: presentation (passo variável). Só lê traits, nunca os escreve.
 */
export function syncTransformSystem(context) {
  const { world } = context

  world.query(Position, Rotation).forEach((entity) => {
    const object = getView(entity)
    if (!object) return

    const position = entity.get(Position)
    const rotation = entity.get(Rotation)

    object.position.set(position.x, position.y, position.z)
    object.rotation.set(rotation.x, rotation.y, rotation.z)
  })
}
