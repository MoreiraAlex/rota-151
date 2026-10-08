import { getItem } from '../data/items'
import { getSpecies } from '../data/species'
import {
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
 * no meio de um pulo, só cai); sem posição salva, fica no ponto inicial.
 */
export function restoreTrainer(trainer, saved) {
  if (saved.position) {
    const { x, y, z, yaw } = saved.position
    trainer.set(Position, { x, y, z })
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
