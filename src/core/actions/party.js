import { getSpecies } from '../data/species'
import { rollIndividualValues } from '../data/species/stats'
import { gameplayRng } from '../rng'
import { GAME_CONFIG } from '../gameConfig'
import { Party, PartyIndividualValues } from '../traits'

/**
 * Equipa (ou desequipa, com `speciesId: null`) a criatura de um slot do
 * time — única mutação de `Party`, no projeto inteiro (`DebugPanel.jsx`,
 * `InventoryPanel.jsx`) — pra nunca deixar `Party` e
 * `PartyIndividualValues` (`core/traits/components/
 * partyIndividualValues.js`) desincronizarem: toda vez que a ESPÉCIE de
 * um slot muda, o IV daquele slot é sorteado de novo (nova criatura,
 * novo indivíduo) e congelado ali — trocar de volta pra mesma espécie
 * mais tarde sorteia outra vez (o jogo ainda não tem identidade de
 * criatura persistente pra saber "é a mesma de antes", ver
 * docs/features/029-*.md).
 *
 * Sem sorteio pra espécie sem `stats.hp.base` (`fox`/`wolf` ainda não
 * migrados, ou id desconhecido) — `PartyIndividualValues[slot]` fica
 * `null`, mesmo fallback gracioso de sempre (`resolveCreatureStats`
 * já trata isso).
 */
export function equiparCriatura(trainer, slot, speciesId) {
  const species = speciesId ? getSpecies(speciesId) : null
  const individualValues =
    species?.stats?.hp?.base != null
      ? rollIndividualValues(gameplayRng, {
          min: GAME_CONFIG.BATTLE.IV_MIN,
          max: GAME_CONFIG.BATTLE.IV_MAX,
        })
      : null

  trainer.set(Party, { [slot]: speciesId ?? null })
  trainer.set(PartyIndividualValues, { [slot]: individualValues })
}
