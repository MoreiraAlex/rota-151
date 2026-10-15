import { getItem } from '../data/items'
import { getSpecies } from '../data/species'
import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/capsule'
import { shoreNear, wadeLimit } from '../terrain/water'
import { levelWaterDepthAt } from '../actions/water'
import {
  CharacterController,
  HeldItem,
  Inventory,
  PokedexEntries,
  Position,
  Rotation,
  ScanHistory,
  restoreScanHistoryEntries,
} from '../traits'

/**
 * O treinador no save (docs/features/044-salvar-o-jogo.md) — forma em
 * `trainerSaveSchema` (`saveFormat.js`): posição e direção, item na mão,
 * inventário de itens e Pokédex. Os Pokémon são salvos à parte (`pokemonSave.js`).
 */

// Altura do centro do corpo com os pés no chão em `(x, z)`.
function standingY(trainer, x, z) {
  const ground = TEST_LEVEL.terrain.heightAt(x, z)
  const body = trainer.get(CharacterController)
  return body ? ground + verticalClearance(body) : ground
}

// Passo (m) da busca por um lugar livre em volta da posição salva, e
// quantas direções cada volta testa.
const FREE_SPOT_STEP = 1
const FREE_SPOT_DIRECTIONS = 16

/**
 * `(x, z)`, ou — se o corpo (de raio `radius`) ficou dentro de um objeto
 * sólido que agora existe ali (um prédio de cidade nova, docs/features/
 * 058-ajuste-dos-biomas.md) — o lugar livre mais perto, em voltas cada vez
 * maiores até `reach` m. Sem lugar livre, fica onde está.
 */
export function freeSpotNear(footprintsAround, x, z, radius, reach) {
  const circles = footprintsAround(x, z, reach + radius)
  const isFree = (px, pz) =>
    circles.every(
      (circle) =>
        Math.hypot(px - circle.x, pz - circle.z) >= circle.radius + radius,
    )
  if (isFree(x, z)) return { x, z }
  for (
    let distance = FREE_SPOT_STEP;
    distance <= reach;
    distance += FREE_SPOT_STEP
  ) {
    for (let i = 0; i < FREE_SPOT_DIRECTIONS; i++) {
      const angle = (i / FREE_SPOT_DIRECTIONS) * Math.PI * 2
      const px = x + Math.cos(angle) * distance
      const pz = z + Math.sin(angle) * distance
      if (isFree(px, pz)) return { x: px, z: pz }
    }
  }
  return { x, z }
}

// A posição salva, ou — se ela ficou dentro do relevo — a mesma x/z com os
// pés acima do chão (cai até pousar, como ao entrar no mundo). Em água funda
// além de onde o corpo entra (docs/features/057-lagos-e-rios.md), vai para
// a margem mais perto; dentro de um prédio que agora existe ali, para fora
// dele (`freeSpotNear`).
function liftAboveGround(trainer, saved) {
  const body = trainer.get(CharacterController)
  const limit = body ? wadeLimit(verticalClearance(body) * 2) : undefined
  const shore = shoreNear(levelWaterDepthAt, saved.x, saved.z, limit)
  const { terrain } = TEST_LEVEL
  const { x, z } = terrain.footprintsAround
    ? freeSpotNear(
        terrain.footprintsAround,
        shore.x,
        shore.z,
        body?.capsuleRadius ?? 0,
        GAME_CONFIG.SAVE.FREE_SPOT_REACH,
      )
    : shore
  const y = x === saved.x && z === saved.z ? saved.y : -Infinity
  const lowest = standingY(trainer, x, z)
  if (y >= lowest) return { x, y, z }
  return { x, y: lowest + GAME_CONFIG.TERRAIN.SPAWN_HEIGHT, z }
}

/** O `trainer` como objeto salvo. */
export function serializeTrainer(trainer) {
  const { counts, positions } = trainer.get(Inventory)
  const { speciesIds } = trainer.get(PokedexEntries)
  const { entries } = trainer.get(ScanHistory)
  const { x, y, z } = trainer.get(Position)
  return {
    position: { x, y, z, yaw: trainer.get(Rotation).y },
    heldItemId: trainer.get(HeldItem)?.itemId ?? null,
    inventory: { counts: { ...counts }, positions: { ...positions } },
    pokedex: {
      speciesIds: [...speciesIds],
      history: entries.map(({ speciesId, individualValues, level }) => ({
        speciesId,
        individualValues: { ...individualValues },
        level,
      })),
    },
  }
}

/**
 * Devolve ao `trainer` o estado salvo. Item ou espécie que não existe mais
 * fica de fora; o item na mão só volta se ainda há unidade dele. Volta na
 * posição salva exata — ela vem da física, então não está dentro do chão (salvo
 * no meio de um pulo, só cai); sem posição salva, fica no ponto inicial. Se o
 * relevo mudou e a posição ficou dentro dele (save do chão plano, antes da
 * docs/features/045-terreno-de-um-chunk.md), sobe para a superfície; se
 * ficou em água funda (docs/features/057-lagos-e-rios.md), vai para a
 * margem.
 */
export function restoreTrainer(trainer, saved) {
  if (saved.position) {
    const { yaw } = saved.position
    trainer.set(Position, liftAboveGround(trainer, saved.position))
    trainer.set(Rotation, { ...trainer.get(Rotation), y: yaw })
  }

  const counts = {}
  const positions = {}
  for (const [id, amount] of Object.entries(saved.inventory.counts)) {
    if (!getItem(id) || amount <= 0) continue
    counts[id] = amount
    if (saved.inventory.positions[id] != null) {
      positions[id] = saved.inventory.positions[id]
    }
  }
  trainer.set(Inventory, { counts, positions })

  const heldItemId =
    saved.heldItemId && counts[saved.heldItemId] > 0 ? saved.heldItemId : null
  trainer.set(HeldItem, { itemId: heldItemId })

  const knownSpecies = (speciesId) => !!getSpecies(speciesId)
  trainer.set(PokedexEntries, {
    speciesIds: saved.pokedex.speciesIds.filter(knownSpecies),
  })
  trainer.set(ScanHistory, {
    entries: restoreScanHistoryEntries(
      saved.pokedex.history.filter((entry) => knownSpecies(entry.speciesId)),
    ),
  })
}
