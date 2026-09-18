import { trait } from 'koota'

/**
 * Marca uma entidade como criatura selvagem — spawnada uma vez por
 * `wildCreatureSpawnSystem` a partir de `TEST_LEVEL.wildCreatures`, vagando
 * sozinha (`wildWanderSystem`), sem pertencer ao time do treinador.
 * Deliberadamente SEPARADO de `SummonedCreature` (que significa "invocada
 * de um slot do `Party`", com dono/slot/ciclo de vida próprios via
 * `partySummonSystem`) — usar o mesmo trait faria uma criatura selvagem
 * entrar na query de `creatureFollowSystem.js` e ser puxada pro treinador,
 * o oposto do comportamento desejado (ver docs/features/020-fox-selvagens-
 * cena-e-texturas.md).
 *
 * `speciesId` guarda a espécie de `core/data/species` — `WildCreaturesView`
 * (view) usa isso pra saber qual modelo renderizar, mesmo papel de
 * `SummonedCreature.speciesId`.
 *
 * Dono de escrita: `wildCreatureSpawnSystem` (só cria, nunca destrói —
 * criaturas selvagens não são recolhidas); `wildWanderSystem`/
 * `WildCreaturesView` só leem.
 */
export const WildCreature = trait({
  speciesId: null,
})
