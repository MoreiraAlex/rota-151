import { trait } from 'koota'

/**
 * Tag: personagem parado porque o chunk debaixo dele não está carregado
 * (docs/features/046-sistema-de-chunks.md) — sem colisor de relevo ali, ele
 * cairia. Enquanto isso não tem física nem IA: fica onde estava e segue
 * de lá quando o chunk volta.
 *
 * Dono de escrita: `congelarPorChunk`/`descongelarPorChunk`
 * (`core/actions/chunks.js`), chamadas pelo `chunkFreezeSystem`.
 * Leem: `characterPhysicsSystem` e as IAs de movimento
 * (`creatureFollowSystem`, `wildBehaviorSystem`, `wildWanderSystem`,
 * `partyBehaviorSystem`).
 */
export const ChunkFrozen = trait()
