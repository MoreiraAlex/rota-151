import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { pegarItemDoMundo, vasculhar } from '../actions/worldItems'
import { chunkCoordAt, chunkKey } from '../terrain/terrainChunk'
import {
  ActionState,
  GroundItem,
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
 * Headless. Fase: simulation, depois do `worldItemsStreamingSystem` (os
 * itens deste tick já existem).
 */
export function interactionSystem(context) {
  const { world, events } = context
  if (!world.has(InteractionTarget)) return
  const input = context.input ?? {}
  const trainer = world.queryFirst(InputControlled, Inventory, Position)
  const found = trainer ? nearestInReach(world, trainer.get(Position)) : null

  // Só grava quando muda (a HUD assina).
  const next = found ? targetOf(found) : NO_TARGET
  const current = world.get(InteractionTarget)
  if (current.kind !== next.kind || current.worldId !== next.worldId) {
    world.set(InteractionTarget, next)
  }
  if (!found) return

  const busy = trainer.get(ActionState)?.current != null
  if (!input.interact || busy) return

  const now = world.get(WorldClock)?.time ?? 0
  if (found.entity) {
    const { chunkKey: key } = found.entity.get(GroundItem)
    const chunk = world.get(WorldItemChunks)?.loaded.get(key) ?? null
    pegarItemDoMundo(world, trainer, found.entity, { chunk, now, events })
  } else {
    vasculhar(world, trainer, found.spot, { chunk: found.chunk, now, events })
  }
}

const targetOf = ({ entity, spot }) => {
  if (entity) {
    const { worldId, itemId } = entity.get(GroundItem)
    const { x, y, z } = entity.get(Position)
    return { kind: 'item', worldId, itemId, x, y, z }
  }
  const { source, id, x, y, z } = spot
  return { kind: source, worldId: id, itemId: '', x, y, z }
}

// O item do chão, arbusto ou árvore mais perto de `from` (no plano), ao
// alcance: `{ entity }` (item) ou `{ spot, chunk }` (vegetação).
function nearestInReach(world, from) {
  const { INTERACT_RADIUS } = GAME_CONFIG.WORLD_ITEMS
  let best = null
  let bestDistance = INTERACT_RADIUS
  const consider = (candidate, x, z, reach) => {
    const distance = Math.hypot(x - from.x, z - from.z) - reach
    if (distance > bestDistance) return
    best = candidate
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
