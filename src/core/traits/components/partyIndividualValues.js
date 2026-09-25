import { trait } from 'koota'

/**
 * IV congelado de cada criatura do TIME do jogador, por slot — vive no
 * TREINADOR (mesma entidade de `Party`), não na `SummonedCreature`
 * (que é destruída/recriada a cada recolher/invocar, ver
 * `partySummonSystem.js`/`summonBallSystem.js`). Sem isto, sortear o IV
 * de novo toda vez que `summonBallSystem.js` recria a entidade faria a
 * MESMA criatura do jogador nascer com stats diferentes cada vez que
 * ele tira ela da bola — errado: "congelado por indivíduo", não por
 * entidade-instância (pedido do usuário, confirmado explicitamente).
 *
 * Cada campo é `null` (slot vazio) ou um objeto `{ hp, attack, defense,
 * sp_atk, sp_def, speed }` — mesmo formato de `IndividualValues`
 * (`core/traits/components/individualValues.js`), só que por SLOT em
 * vez de por entidade.
 *
 * Sorteado (`rollIndividualValues`, `core/data/species/stats.js`, via
 * `gameplayRng`) sempre que uma espécie NOVA entra num slot — nunca
 * quando a MESMA espécie continua ali. Dono de escrita: `equiparCriatura`
 * (`core/actions/party.js`) — o único lugar que escreve `Party`
 * também escreve isto, junto, pra nunca desincronizar (ver docstring
 * da action).
 *
 * `summonBallSystem.js` lê daqui (não sorteia) pra dar à
 * `SummonedCreature` recém-criada o `IndividualValues` de verdade
 * desta criatura. `PartyHud.jsx`/`tools/menu/pokedex/TeamTab.jsx` também leem daqui
 * pra mostrar o status real mesmo com a criatura fora de campo (sem
 * `SummonedCreature` nenhuma viva pra ler).
 */
export const PartyIndividualValues = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})
