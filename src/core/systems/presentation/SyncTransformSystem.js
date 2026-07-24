import { Position, Rotation } from '@/core/traits/components/Transform'
import { world } from '@/core/world/world'
import { getView } from '@/view/registry/viewRegistry'

export function SyncTransformSystem() {
  world.query(Position, Rotation).every((entity) => {
    const mesh = getView(entity)
    if (!mesh) return entity

    const position = entity.get(Position)
    const rotation = entity.get(Rotation)

    mesh.position.set(position.x, position.y, position.z)
    mesh.rotation.set(rotation.x, rotation.y, rotation.z)

    return entity
  })
}
