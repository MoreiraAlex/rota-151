import { trait } from 'koota'

/**
 * IVs (individual values, convenção clássica de Pokémon) desta ENTIDADE
 * específica — antes disso, `iv` vivia só na espécie
 * (`core/data/species/<id>/index.js`), sorteado uma vez quando o MÓDULO
 * carregava: todo `bulbasaur`, selvagem ou do time do treinador,
 * compartilhava os mesmos seis números. Este trait é o valor de
 * verdade POR INDIVÍDUO: gravado uma vez no spawn e nunca mais tocado
 * depois — nenhum system re-sorteia ou edita isto em nenhum outro
 * momento ("sorteado no spawn e congelado", pedido do usuário).
 *
 * Duas fontes, nos dois únicos lugares que criam uma entidade de
 * criatura:
 * - **Selvagens** (`wildCreatureSpawnSystem.js`) sorteiam via
 *   `gameplayRng` (`core/rng.js`) + `rollIndividualValues`
 *   (`core/data/species/stats.js`), dentro de
 *   `GAME_CONFIG.BATTLE.WILD_IV_MIN/MAX` — cada selvagem nasce com um
 *   IV diferente, mesmo sendo a mesma espécie.
 * - **Time do jogador** (`summonBallSystem.js`, `spawnCreature`) copia
 *   o `iv` literal que já existia em `species.stats.<key>.iv` (via
 *   `individualValuesFromSpecies`) — o mesmo número de sempre, definido
 *   à mão pelo jogador no arquivo da espécie, só que agora também
 *   exposto como estado de entidade, não apenas um literal estático.
 *
 * `resolveCreatureStats` (`core/data/species/stats.js`) combina isto
 * com `base`/`ev`/`level` da espécie pra chegar no `stat` de verdade
 * desta entidade. O `stat`/`cp` pré-calculados dentro de
 * `species.stats` continuam existindo — servem de valor de
 * REFERÊNCIA/fallback (preview sem entidade viva, ex.:
 * `PartyHud.jsx`/`tools/menu/pokedex/TeamTab.jsx` mostrando uma criatura do time que
 * não está summonada agora), não mais a fonte de verdade pra quem já
 * tem corpo no mundo.
 *
 * Dono de escrita: `wildCreatureSpawnSystem.js`, `summonBallSystem.js`
 * (só no instante do spawn). Ninguém mais escreve aqui.
 */
export const IndividualValues = trait({
  hp: 0,
  attack: 0,
  defense: 0,
  sp_atk: 0,
  sp_def: 0,
  speed: 0,
})
