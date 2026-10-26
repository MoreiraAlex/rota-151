import { trait } from 'koota'

/**
 * Arrancada do golpe em andamento (`lunge` da skill, docs/features/061-
 * revisao-das-skills.md — o Quick Attack): quanto ela vai andar (`distance`,
 * m, já parando antes do primeiro alvo no caminho), quanto já andou
 * (`travelled`) e o `ActionState.elapsed` do último tick (`lastElapsed` —
 * voltar pra trás é golpe novo, a arrancada é planejada de novo).
 *
 * Dono de escrita: `attackLungeSystem` (adiciona no começo do golpe, tira
 * quando ele acaba).
 */
export const AttackLunge = trait({ distance: 0, travelled: 0, lastElapsed: 0 })
