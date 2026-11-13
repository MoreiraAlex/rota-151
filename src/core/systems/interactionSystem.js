import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { pegarItemDoMundo, vasculhar } from '../actions/worldItems'
import {
  abrirPorta,
  isIndoors,
  isPassingDoor,
  pedirSaida,
} from '../actions/interior'
import { isOnTownMap } from '../actions/townMap'
import { getInterior } from '../data/interiors'
import { interiorExitPoint, nearestDoor } from '../interior/interiorPlacement'
import { chunkCoordAt, chunkKey } from '../terrain/terrainChunk'
import {
  ActionState,
  GroundItem,
  Indoors,
  InputControlled,
  InteractionTarget,
  Inventory,
  Position,
  WorldClock,
  WorldItemChunks,
} from '../traits'
import { forageSpotsOf } from '../worldItems/worldItems'

const NO_TARGET = { kind: null, worldId: '', itemId: '', x: 0, y: 0, z: 0 }

/**
 * Pegar item do chão e vasculhar arbusto e árvore com F (docs/features/055-
 * itens-no-mundo.md). A cada passo, guarda em `InteractionTarget` o mais
 * perto do treinador ao alcance (`INTERACT_RADIUS`, da borda do arbusto ou
 * do tronco), para a HUD mostrar o aviso. Com o pulso `interact`, pega ou
 * vasculha esse.
 *
 * Só o treinador, e só controlado por quem joga: pilotando uma criatura,
 * nada. No meio de uma ação (arremesso, comendo...), mostra mas não pega.
 *
 * As portas dos prédios com sala por dentro (docs/features/068-interior-
 * dos-predios.md) também: perto da porta, o F entra (`abrirPorta`); dentro
 * da sala, só o tapete da entrada vale (o F sai, `pedirSaida`) — os itens
 * e arbustos lá embaixo, no mesmo lugar do mapa, ficam de fora. Passando
 * por uma porta, nada.
 *
 * Headless. Fase: simulation, depois do `worldItemsStreamingSystem` (os
 * itens deste tick já existem).
 */
export function interactionSystem(context) {
  const { world, events } = context
  if (!world.has(InteractionTarget)) return
  const input = context.input ?? {}
  const trainer = world.queryFirst(InputControlled, Inventory, Position)
  const found =
    trainer && !isPassingDoor(world) ? findTarget(world, trainer) : null

  // Só grava quando muda (a HUD assina).
  const next = found ? targetOf(found) : NO_TARGET
  const current = world.get(InteractionTarget)
  if (current.kind !== next.kind || current.worldId !== next.worldId) {
    world.set(InteractionTarget, next)
  }
  if (!found) return

  const busy = trainer.get(ActionState)?.current != null
  if (!input.interact || busy) return

  if (found.door) {
    abrirPorta(world, trainer, found.door)
    return
  }
  if (found.exit) {
    pedirSaida(world, trainer)
    return
  }
  const now = world.get(WorldClock)?.time ?? 0
  if (found.entity) {
    const { chunkKey: key } = found.entity.get(GroundItem)
    const chunk = world.get(WorldItemChunks)?.loaded.get(key) ?? null
    pegarItemDoMundo(world, trainer, found.entity, { chunk, now, events })
  } else {
    vasculhar(world, trainer, found.spot, { chunk: found.chunk, now, events })
  }
}

const targetOf = ({ entity, spot, door, exit }) => {
  if (door) {
    const { x, y, z, interiorId } = door
    const worldId = `door:${x.toFixed(2)},${z.toFixed(2)}`
    return { kind: 'door', worldId, itemId: interiorId, x, y, z }
  }
  if (exit) {
    const { x, y, z } = exit.point
    return { kind: 'exit', worldId: 'exit', itemId: exit.interiorId, x, y, z }
  }
  if (entity) {
    const { worldId, itemId } = entity.get(GroundItem)
    const { x, y, z } = entity.get(Position)
    return { kind: 'item', worldId, itemId, x, y, z }
  }
  const { source, id, x, y, z } = spot
  return { kind: source, worldId: id, itemId: '', x, y, z }
}

// O que o F alcança agora: dentro de um prédio, o tapete de saída
// (`{ exit }`); fora, o mais perto entre os itens e a vegetação
// (`nearestInReach`) e a porta de um prédio (`{ door }`).
function findTarget(world, trainer) {
  const from = trainer.get(Position)
  if (isIndoors(trainer)) return exitInReach(trainer.get(Indoors), from)
  // No mapa de uma cidade copiada (Pallet, docs/features/069-revisao-do-
  // bioma-cidade.md) as portas ainda não abrem, e os itens e arbustos lá
  // embaixo (mesmo XZ) ficam de fora.
  if (isOnTownMap(trainer)) return null
  const item = nearestInReach(world, from)
  const { DOOR_REACH } = GAME_CONFIG.INTERIOR
  const door = nearestDoor(
    buildingsNear(from, DOOR_REACH),
    from,
    item ? Math.min(DOOR_REACH, item.distance) : DOOR_REACH,
  )
  return door ? { door: door.door } : item
}

// O tapete de saída da sala, se `from` está ao alcance dele.
function exitInReach(indoors, from) {
  const interior = getInterior(indoors.interiorId)
  if (!interior) return null
  const point = interiorExitPoint(interior, indoors)
  const distance = Math.hypot(point.x - from.x, point.z - from.z)
  if (distance > GAME_CONFIG.INTERIOR.EXIT_REACH) return null
  return { exit: { point, interiorId: interior.id } }
}

// Folga (m) além do alcance ao procurar prédios: a porta fica na frente
// do prédio, longe do centro dele (o ponto que decide o chunk).
const BUILDING_SEARCH_MARGIN = 12

// Os prédios dos chunks carregados que encostam em `from` ± o alcance.
function buildingsNear(from, reach) {
  const margin = reach + BUILDING_SEARCH_MARGIN
  const found = []
  for (const chunk of TEST_LEVEL.terrain.loadedChunks()) {
    const buildings = chunk.solids?.buildings
    if (!buildings?.length) continue
    const isNear =
      from.x + margin >= chunk.minX &&
      from.x - margin <= chunk.minX + chunk.size &&
      from.z + margin >= chunk.minZ &&
      from.z - margin <= chunk.minZ + chunk.size
    if (isNear) found.push(...buildings)
  }
  return found
}

// O item do chão, arbusto ou árvore mais perto de `from` (no plano), ao
// alcance: `{ entity, distance }` (item) ou `{ spot, chunk, distance }`
// (vegetação).
function nearestInReach(world, from) {
  const { INTERACT_RADIUS } = GAME_CONFIG.WORLD_ITEMS
  let best = null
  let bestDistance = INTERACT_RADIUS
  const consider = (candidate, x, z, reach) => {
    const distance = Math.hypot(x - from.x, z - from.z) - reach
    if (distance > bestDistance) return
    best = { ...candidate, distance }
    bestDistance = distance
  }
  world.query(GroundItem, Position).forEach((entity) => {
    const { x, z } = entity.get(Position)
    consider({ entity }, x, z, 0)
  })
  for (const chunk of chunksNear(world, from, INTERACT_RADIUS * 4)) {
    for (const spot of forageSpotsOf(chunk)) {
      consider({ spot, chunk }, spot.x, spot.z, spot.reach)
    }
  }
  return best
}

// Os chunks carregados a menos de `margin` m de `from` (os de até um
// vizinho em cada eixo, pela chave — sem varrer a lista de chunks).
function chunksNear(world, from, margin) {
  const loaded = world.get(WorldItemChunks)?.loaded
  if (!loaded) return []
  const size = TEST_LEVEL.terrain.chunkSize()
  const found = []
  const xs = new Set([
    chunkCoordAt(from.x - margin, size),
    chunkCoordAt(from.x + margin, size),
  ])
  const zs = new Set([
    chunkCoordAt(from.z - margin, size),
    chunkCoordAt(from.z + margin, size),
  ])
  for (const chunkX of xs) {
    for (const chunkZ of zs) {
      const chunk = loaded.get(chunkKey(chunkX, chunkZ))
      if (chunk) found.push(chunk)
    }
  }
  return found
}
