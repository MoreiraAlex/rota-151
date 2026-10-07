import { relation, trait } from 'koota'
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
 * Também é o trait dos golpes no registro do Pokémon (`Pokemon`), fonte de
 * verdade de quem está fora de campo.
 *
 * Donos de escrita: `criarPokemon` (kit da espécie), `summonBallSystem.js`
 * (copia do registro ao invocar) e as actions de `core/actions/moves.js`
 * (escrevem no registro e na criatura em campo).
 */
export const CreatureMoves = trait(() => ({
  slots: { 1: null, 2: null, 3: null },
  training: {},
}))

/**
 * Pedido pendente de "esquecer qual golpe?": o treino de `moveId` terminou no
 * Pokémon alvo (o registro, `Pokemon`), mas os 3 slots dele estão ocupados.
 * Relação exclusiva do TREINADOR pro registro — um pedido aberto por vez;
 * sem ela, nada pendente.
 *
 * Donos de escrita: `progredirTreino`/`pedirAprendizado` (abrem),
 * `aprenderGolpe`/`adiarAprendizado` (fecham) — `core/actions/moves.js`.
 */
export const MoveLearnRequest = relation({
  exclusive: true,
  store: { moveId: null },
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
