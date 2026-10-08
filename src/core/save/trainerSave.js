import { getItem } from '../data/items'
import { getSpecies } from '../data/species'
import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { verticalClearance } from '../physics/capsule'
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

// A posição salva, ou — se ela ficou dentro do relevo — a mesma x/z com os
// pés acima do chão (cai até pousar, como ao entrar no mundo).
function liftAboveGround(trainer, { x, y, z }) {
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
 * docs/features/045-terreno-de-um-chunk.md), sobe para a superfície.
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
