import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { getTownMap, townMapCollidersOf } from '../data/townMaps'
import {
  createTownMapColliders,
  destroyTownMapColliders,
  hasRigidBody,
} from '../physics/colliders'
import { isPhysicsReady } from '../physics/physicsWorld'
import { setActiveTownMap } from '../townMap/activeTownMap'
import {
  isInsideTownMap,
  townMapArrival,
  townMapGroundAt,
  townMapPlace,
} from '../townMap/townMapPlacement'
import {
  aimCamera,
  clearanceOf,
  guardarTimeNaHora,
  isIndoors,
  isPassingDoor,
  moveTrainer,
  requestSave,
} from './interior'
import { OnTownMap, Position, Rotation } from '../traits'

/**
 * Ir e vir do mapa de uma cidade copiada inteira do Let's Go
 * (docs/features/069-revisao-do-bioma-cidade.md — Pallet, a cidade
 * tutorial). Por enquanto pelo F2 (`irParaMapaDaCidade`/`sairDoMapaDaCidade`), na hora.
 *
 * Lá: o mapa fica bem acima de onde o treinador estava
 * (`townMapPlace`) com a colisão dele (`createTownMapColliders`), o
 * treinador ganha `OnTownMap` (as selvagens lá de baixo não o alcançam, o
 * mundo procedural some da tela; o céu e o clima ficam), a água e o chão
 * das consultas do nível passam a ser os do mapa (`setActiveTownMap`) e o
 * time fica na bola — quem estava em campo volta na hora.
 */

/** O treinador está no mapa de uma cidade? */
export function isOnTownMap(entity) {
  return Boolean(entity?.isAlive?.() && entity.has(OnTownMap))
}

// O mapa e a colisão dele, para as consultas do nível.
function activate(townMap, place) {
  setActiveTownMap({ colliders: townMapCollidersOf(townMap), place })
}

/**
 * Leva o `trainer` para o mapa `mapId`, à frente da porta da casa do
 * jogador, virado para fora, com a câmera atrás. Já num mapa, dentro de um
 * prédio, passando por uma porta ou mapa desconhecido: nada (devolve
 * `false`).
 */
export function irParaMapaDaCidade(world, trainer, mapId) {
  const townMap = getTownMap(mapId)
  if (!townMap || !trainer?.has(Position)) return false
  if (isOnTownMap(trainer) || isIndoors(trainer)) return false
  if (isPassingDoor(world)) return false
  guardarTimeNaHora(world, trainer)

  const { x, y, z } = trainer.get(Position)
  const from = { x, y, z, yaw: trainer.get(Rotation)?.y ?? 0 }
  const place = townMapPlace(from, TEST_LEVEL.terrain.heightAt(x, z))
  const colliders = townMapCollidersOf(townMap)
  const bodyHandle = createTownMapColliders(colliders, place)
  trainer.add(OnTownMap({ mapId: townMap.id, ...place, from, bodyHandle }))
  activate(townMap, place)

  const arrival = townMapArrival(colliders, place)
  moveTrainer(
    trainer,
    { x: arrival.x, y: arrival.y + clearanceOf(trainer), z: arrival.z },
    arrival.yaw,
  )
  aimCamera(world, arrival.yaw)
  requestSave(trainer)
  return true
}

/**
 * Tira o `trainer` do mapa: a colisão some e ele volta para onde estava
 * antes de ir (em pé no relevo), com a câmera atrás.
 */
export function sairDoMapaDaCidade(world, trainer) {
  if (!isOnTownMap(trainer)) return false
  const { from, bodyHandle } = trainer.get(OnTownMap)
  destroyTownMapColliders(bodyHandle)
  trainer.remove(OnTownMap)
  setActiveTownMap(null)
  guardarTimeNaHora(world, trainer)

  const ground = TEST_LEVEL.terrain.heightAt(from.x, from.z)
  moveTrainer(
    trainer,
    {
      x: from.x,
      y: ground + clearanceOf(trainer) + GAME_CONFIG.TERRAIN.SPAWN_HEIGHT,
      z: from.z,
    },
    from.yaw,
  )
  aimCamera(world, from.yaw)
  requestSave(trainer)
  return true
}

/**
 * O que vai no save sobre o mapa (`townMap`, saveFormat.js): o mapa, o
 * lugar dele e de onde o `trainer` veio — ou `null`, fora. A posição salva
 * é a de dentro do mapa.
 */
export function townMapSaveOf(trainer) {
  if (!isOnTownMap(trainer)) return null
  const { mapId, x, y, z, scale, from } = trainer.get(OnTownMap)
  return { mapId, place: { x, y, z, scale }, from: { ...from } }
}

/**
 * Ao carregar o jogo: o `trainer` volta para o mapa salvo (`saved`, a
 * forma de `townMapSaveOf`), em `position` — ou na chegada, se ela não cai
 * no mapa. A colisão chega quando a física estiver pronta
 * (`garantirColisaoDoMapa`). Sem mapa salvo (ou um que não existe mais):
 * fora de todos (devolve `false`).
 */
export function voltarParaOMapa(trainer, saved, position) {
  const townMap = getTownMap(saved?.mapId)
  if (!townMap) {
    if (trainer.has(OnTownMap)) trainer.remove(OnTownMap)
    setActiveTownMap(null)
    return false
  }
  const place = { ...saved.place }
  const value = {
    mapId: townMap.id,
    ...place,
    from: { ...saved.from },
    bodyHandle: -1,
  }
  if (trainer.has(OnTownMap)) trainer.set(OnTownMap, value)
  else trainer.add(OnTownMap(value))
  activate(townMap, place)

  const colliders = townMapCollidersOf(townMap)
  const isOnMap =
    position &&
    isInsideTownMap(colliders, place, position.x, position.z) &&
    position.y >= townMapGroundAt(colliders, place, position.x, position.z)
  const arrival = townMapArrival(colliders, place)
  trainer.set(
    Position,
    isOnMap
      ? { x: position.x, y: position.y, z: position.z }
      : { x: arrival.x, y: arrival.y + clearanceOf(trainer), z: arrival.z },
  )
  return true
}

/**
 * A colisão do mapa de quem está nele, se ela ainda não existe: ao carregar
 * o jogo no mapa (a física fica pronta depois) ou com o mundo da física
 * refeito. Sem física ainda, espera. Devolve se criou.
 */
export function garantirColisaoDoMapa(trainer) {
  if (!isOnTownMap(trainer) || !isPhysicsReady()) return false
  const onTownMap = trainer.get(OnTownMap)
  if (hasRigidBody(onTownMap.bodyHandle)) return false
  const townMap = getTownMap(onTownMap.mapId)
  if (!townMap) return false
  const bodyHandle = createTownMapColliders(
    townMapCollidersOf(townMap),
    onTownMap,
  )
  trainer.set(OnTownMap, { ...onTownMap, bodyHandle })
  return bodyHandle >= 0
}
