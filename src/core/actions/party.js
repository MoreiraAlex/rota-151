import { getSpecies } from '../data/species'
import { rollIndividualValues } from '../data/species/stats'
import { createLevelState } from '../data/species/experience'
import { createMovesState } from '../data/species/moves'
import { gameplayRng } from '../rng'
import { GAME_CONFIG } from '../gameConfig'
import {
  Party,
  PartyFaint,
  PartyIndividualValues,
  PartyMoves,
  PartyProgress,
  PartyVitals,
} from '../traits'

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
 * Sem sorteio pra espécie sem `stats.hp.base` (não migrada, ou id
 * desconhecido) — `PartyIndividualValues[slot]` fica
 * `null`, mesmo fallback gracioso de sempre (`resolveCreatureStats`
 * já trata isso).
 *
 * Mesmo motivo pro desmaio (`PartyFaint`) e pra vida/energia guardadas
 * na bola (`PartyVitals`): criatura nova no slot não herda nada da
 * anterior — sai cheia. E pro nível (`PartyProgress`): começa no nível
 * inicial da espécie (`species.level`), com o XP do começo dele. E pros
 * golpes (`PartyMoves`): o kit da espécie, dominado, sem treino nenhum.
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
  if (trainer.has(PartyProgress)) {
    trainer.set(PartyProgress, {
      [slot]: species ? createLevelState(species, species.level ?? 1) : null,
    })
  }
  if (trainer.has(PartyMoves)) {
    trainer.set(PartyMoves, {
      [slot]: species ? createMovesState(species) : null,
    })
  }
  if (trainer.has(PartyFaint)) trainer.set(PartyFaint, { [slot]: null })
  if (trainer.has(PartyVitals)) trainer.set(PartyVitals, { [slot]: null })
}
