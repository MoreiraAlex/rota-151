import { trait } from 'koota'

/**
 * Itens no mundo (docs/features/055-itens-no-mundo.md).
 */

/**
 * O que o jogador já mexeu nos itens do mundo — trait do MUNDO, e a fonte
 * autoritativa (as entidades `GroundItem` saem dela e da seed). Só guarda o
 * que mudou: chunk em que ninguém mexeu sai da seed de novo.
 *
 * - `chunks[chave do chunk]`: `{ items, lastRefill, nextIndex }` — os itens
 *   que restam no chão (`WorldItem`, `core/worldItems/worldItems.js`), a
 *   hora do mundo (dias) da última reposição (conta o tempo da próxima) e o
 *   número do próximo item reposto (o id dele).
 * - `foraged[id do arbusto ou árvore]`: o dia de jogo em que foi colhido —
 *   nesse dia ele não dá mais nada (no dia seguinte, sorteia de novo).
 *
 * Trait AoS (objetos). Dono de escrita: as actions de
 * `core/actions/worldItems.js` (e o save, `restoreWorldItems`).
 */
export const WorldItemsMemory = trait(() => ({ chunks: {}, foraged: {} }))

/**
 * Os chunks cujos itens do chão já viraram entidade — trait do MUNDO,
 * derivado dos chunks carregados.
 *
 * - `loaded`: chave → chunk (os systems leem daqui, sem montar chave nem
 *   copiar a lista de chunks a cada passo).
 * - `checkedAt[chave]`: a hora do mundo (dias) da última verificação da
 *   reposição de um chunk que ninguém mexeu (não está na memória; começa
 *   quando ele carrega e não vai para o save).
 * - `revision`: a revisão do relevo (`terrain.getRevision`) que o streaming
 *   já seguiu — sem mudança nos chunks, ele não faz nada (`-1` = refazer).
 * - `refillTimer`: segundos até a reposição conferir os chunks de novo
 *   (`WORLD_ITEMS.REFILL_CHECK_SECONDS`).
 *
 * Dono de escrita: as actions de `core/actions/worldItems.js` (carregar,
 * descarregar e verificar o teto), o `worldItemsStreamingSystem`
 * (`revision`), o `worldItemRefillSystem` (`refillTimer`) e o save (`restoreWorldItems`, que manda refazer).
 */
export const WorldItemChunks = trait(() => ({
  loaded: new Map(),
  checkedAt: new Map(),
  revision: -1,
  refillTimer: 0,
}))

/**
 * Um item no chão (com `Position`): `worldId` é o id dele na memória e na
 * seed, `chunkKey` o chunk de onde ele é. Nasce com o chunk e morre com ele
 * ou ao ser pego.
 *
 * Dono de escrita: as actions de `core/actions/worldItems.js`.
 */
export const GroundItem = trait({
  worldId: '',
  itemId: '',
  chunkKey: '',
})

/**
 * O que F pega ou vasculha agora (o mais perto do treinador, ao alcance) —
 * trait do MUNDO, para a HUD mostrar o aviso. `kind`: `'item'` (um
 * `GroundItem`, `itemId` dele), `'bush'` ou `'tree'` (sem `itemId`: nada diz
 * se tem fruta); `null` sem nada. `worldId`: o id do item ou do lugar;
 * `x`/`y`/`z`: onde está.
 *
 * Dono de escrita: `interactionSystem`.
 */
export const InteractionTarget = trait({
  kind: null,
  worldId: '',
  itemId: '',
  x: 0,
  y: 0,
  z: 0,
})
