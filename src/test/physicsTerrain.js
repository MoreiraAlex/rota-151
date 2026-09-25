import { quaternionFromAxisAngle } from '@/core/math'
import {
  getRapier,
  getRapierWorld,
  initPhysics,
  stepPhysics,
} from '@/core/physics/physicsWorld'

/**
 * Terreno sob medida pra testes de combate 2.5D (rampa, parede, terraço),
 * sem depender do `TEST_LEVEL` do jogo. Chamar `disposePhysics()` no
 * `afterEach`.
 */
export async function initTestTerrain() {
  await initPhysics()
  // Chão plano grande, topo em y = 0.
  addStaticBox({ center: [0, -0.5, 0], halfExtents: [50, 0.5, 50] })
}

/** Caixa fixa; `rotation` opcional: `{ axis: 'x'|'y'|'z', angle }`. */
export function addStaticBox({ center, halfExtents, rotation }) {
  const RAPIER = getRapier()
  const world = getRapierWorld()
  let desc = RAPIER.RigidBodyDesc.fixed().setTranslation(...center)
  if (rotation) {
    desc = desc.setRotation(
      quaternionFromAxisAngle(rotation.axis, rotation.angle),
    )
  }
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(...halfExtents),
    world.createRigidBody(desc),
  )
}

/**
 * Collider novo só entra no raycast depois de um `step()` (ver docstring
 * de `castRay`) — chamar depois de montar o terreno.
 */
export function settleTerrain() {
  stepPhysics()
}
