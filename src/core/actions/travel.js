import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/capsule'
import { teleportCharacterBody } from '../physics/colliders'
import {
  CameraSnap,
  CharacterController,
  OrbitCamera,
  PhysicsBody,
  Position,
  Velocity,
} from '../traits'
import { guardarTimeNaHora, isIndoors } from './interior'
import { isOnTownMap } from './townMap'

/**
 * O ponto de chegada numa cidade da seed (`city`, core/town/citySites.js):
 * na rua mais perto do meio dela — a linha da grade dos quarteirões
 * (`town.blockSize`), onde nunca há prédio. Na cidade fixa (Viridian,
 * `core/town/fixedTown.js`), onde o treinador nasce.
 */
export function cityArrivalPoint(city, town) {
  if (city.fixedTown) {
    const { x, z } = city.fixedTown.spawn
    return { x, z }
  }
  return {
    x: Math.round(city.x / town.blockSize) * town.blockSize,
    z: city.z,
  }
}

/**
 * Leva o `trainer` para `(x, z)` na hora — ferramenta do F2, para avaliar
 * as cidades sem correr até elas (docs/features/069-revisao-do-bioma-
 * cidade.md). O time volta para a bola, o treinador cai em pé no relevo
 * (a física segura ele parado até o chunk de lá carregar) e a câmera vai
 * junto, sem a suavização. Dentro de um prédio ou no mapa de uma cidade
 * copiada (Pallet), nada (devolve `false`).
 */
export function irPara(world, trainer, x, z) {
  if (!trainer?.has(Position) || isIndoors(trainer)) return false
  if (isOnTownMap(trainer)) return false
  guardarTimeNaHora(world, trainer)
  const clearance = trainer.has(CharacterController)
    ? verticalClearance(trainer.get(CharacterController))
    : 0
  const position = {
    x,
    y:
      TEST_LEVEL.terrain.heightAt(x, z) +
      clearance +
      GAME_CONFIG.TERRAIN.SPAWN_HEIGHT,
    z,
  }
  trainer.set(Position, position)
  if (trainer.has(Velocity)) trainer.set(Velocity, { x: 0, y: 0, z: 0 })
  if (trainer.has(PhysicsBody)) {
    teleportCharacterBody(trainer.get(PhysicsBody).bodyHandle, position)
  }
  const camera = world.queryFirst(OrbitCamera)
  if (camera && !camera.has(CameraSnap)) camera.add(CameraSnap)
  return true
}
