import { getSpecies } from '../data/species'
import {
  IndividualValues,
  PokedexEntries,
  ScanHistory,
  pushScanHistoryEntry,
  resolveCreatureSpeciesId,
} from '../traits'

/**
 * Registra um scan bem-sucedido — pedido do usuário: "ao realizar o
 * scan com sucesso, registrar o pokémon no histórico" (ver
 * docs/features/033-*.md). Única mutação de `PokedexEntries`/
 * `ScanHistory` no projeto — as duas sempre juntas, nunca uma sem a
 * outra (mesmo raciocínio de `equiparCriatura`,
 * `core/actions/party.js`, com `Party`/`PartyIndividualValues`).
 *
 * `trainer` é quem escaneou (sempre o treinador — só ele tem `HeldItem`
 * de verdade equipado, ver `scannerModeSystem.js`); `creature` é a
 * entidade escaneada (`Targeting`/`Scanned` confirmados, selvagem ou do
 * time — `resolveCreatureSpeciesId`, `core/traits/
 * resolveCreatureSpeciesId.js`). Sem espécie resolvível (entidade
 * inválida, id desconhecido), não faz nada — mesmo fallback gracioso
 * de sempre.
 */
export function registrarScan(trainer, creature) {
  const speciesId = resolveCreatureSpeciesId(creature)
  if (!speciesId) return

  const species = getSpecies(speciesId)
  const individualValues = creature.get(IndividualValues)

  const dex = trainer.get(PokedexEntries)
  if (!dex.speciesIds.includes(speciesId)) {
    trainer.set(PokedexEntries, { speciesIds: [...dex.speciesIds, speciesId] })
  }

  const history = trainer.get(ScanHistory)
  trainer.set(ScanHistory, {
    entries: pushScanHistoryEntry(history.entries, {
      speciesId,
      individualValues,
      level: species?.level ?? null,
    }),
  })
}
