import { Position, PhysicsBody, CharacterController } from '../traits'
import {
  isPhysicsReady,
  isLevelBuilt,
  markLevelBuilt,
} from '../physics/physicsWorld'
import { createStaticLevel, createCharacterBody } from '../physics/colliders'

/**
 * Cria os colliders do mundo e o corpo do personagem assim que o WASM do Rapier
 * termina de carregar. Enquanto isso, faz early-return (os demais systems de
 * física também).
 *
 * Reconstrói tudo se o world for descartado (isLevelBuilt volta a false em
 * disposePhysics) — cobre o hot-reload do Next.
 *
 * Headless. Fase: simulation, primeiro system.
 */
export function physicsBootstrapSystem(context) {
  if (!isPhysicsReady() || isLevelBuilt()) return
  const { world } = context

  createStaticLevel()

  world.query(CharacterController, PhysicsBody).updateEach(([body], entity) => {
    const position = entity.get(Position)
    const handles = createCharacterBody(position)
    body.bodyHandle = handles.bodyHandle
    body.colliderHandle = handles.colliderHandle
  })

  markLevelBuilt()
}
