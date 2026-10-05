import { trait } from 'koota'
import { createMovesState } from '../../data/species/moves'

/**
 * Golpes DESTA criatura (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md): os 3 slots (Q/E/R) com o id e o domínio de cada golpe, e o
 * progresso de treino dos golpes que ela ainda não sabe (`training`, por id,
 * fração até aprender — inclui o que sobrou de um golpe esquecido). Formato
 * em `core/data/species/moves.js` (`createMovesState`).
 *
 * Só a criatura do time tem; a selvagem usa o kit da espécie, dominado
 * (fallback de `resolveEntityMoves`).
 *
 * Donos de escrita: `summonBallSystem.js` (copia de `PartyMoves` ao invocar)
 * e as actions de `core/actions/moves.js`.
 */
export const CreatureMoves = trait(() => ({
  slots: { 1: null, 2: null, 3: null },
  training: {},
}))

/**
 * Golpes de cada criatura do TIME, por slot, no treinador — fonte de verdade
 * da do time (a invocada é destruída/recriada a cada recolher/invocar). Mesmo
 * formato de `PartyProgress`: `null` (slot vazio) ou o estado de golpes.
 *
 * Donos de escrita: `equiparCriatura` (kit da espécie ao trocar a criatura do
 * slot) e as actions de `core/actions/moves.js`.
 */
export const PartyMoves = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})

/**
 * Pedido pendente de "esquecer qual golpe?": o treino de `moveId` terminou na
 * criatura do `slot` do time, mas os 3 slots dela estão ocupados. `null` =
 * nada pendente. No treinador.
 *
 * Donos de escrita: `progredirTreino`/`pedirAprendizado` (abrem),
 * `aprenderGolpe`/`adiarAprendizado` (fecham) — `core/actions/moves.js`.
 */
export const MoveLearnRequest = trait({
  slot: null,
  moveId: null,
})

/**
 * Golpes de uma entidade: o `CreatureMoves` dela; sem ele (selvagem,
 * treinador, testes antigos), o kit da espécie, dominado. Todo leitor de
 * "qual golpe está no slot" passa por aqui, nunca pelo `species.skills`.
 */
export function resolveEntityMoves(entity, species) {
  if (entity?.has?.(CreatureMoves)) return entity.get(CreatureMoves)
  return createMovesState(species)
}
