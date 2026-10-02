import { isChannelAttack } from './channelAttack'

/**
 * Instante (segundos desde o disparo) em que o golpe em andamento ACONTECE —
 * o `effectAt` real da ENTIDADE. O básico tem `duration`/`effectAt`
 * escalados pelo `speed` (`creatureAttackSystem.js`), sempre na mesma
 * proporção — então basta a razão da definição (`effectAt / duration`)
 * aplicada à duração real da ação (`1 / ActionState.animationSpeed`).
 *
 * É o fim da CARGA: o aviso no chão enche até aqui, e um golpe de status
 * ainda pode ser interrompido antes disso (`core/battle/attackInterrupt.js`).
 * `null` fora de ataque, sem definição ou sem instante de efeito.
 */
export function resolveAttackHitTime(action, attack) {
  if (!action || action.current !== 'attack' || !attack) return null
  if (!(attack.duration > 0) || !(attack.effectAt > 0)) return null

  const actionDuration = 1 / (action.animationSpeed || 1)
  return (attack.effectAt / attack.duration) * actionDuration
}

/**
 * Progresso (0-1) do aviso de golpe — o leque que se preenche no chão
 * enquanto um ataque está sendo executado (`view/scene/
 * AttackTelegraphView.jsx`), pra quem está na área poder desviar. Sempre
 * ligado, pra todo atacante (time e selvagens). Golpe em si mesmo
 * (`area: 'self'`, Growth) também tem: um círculo nos pés, mostrando a
 * carga que ainda pode ser interrompida.
 *
 * Completa (1) no instante do DANO (`effectAt`, `resolveAttackHitTime`), não
 * no fim da `duration`: o aviso só serve pra esquiva se "cheio" significar
 * "acertou agora". Depois do dano devolve `null` (o leque some — o VFX
 * assume). Vale também pro ataque CANALIZADO (`damageMode: 'channel'`): o
 * leque some assim que enche, mesmo com o canal continuando (pedido do
 * usuário).
 *
 * `null` fora de ataque, sem definição ou sem instante de dano.
 */
export function resolveAttackTelegraphProgress(action, attack) {
  const hitAt = resolveAttackHitTime(action, attack)
  if (hitAt === null || action.elapsed >= hitAt) return null
  return Math.max(0, action.elapsed / hitAt)
}

/**
 * A criatura está CARREGANDO o golpe agora — do disparo até o instante do
 * efeito (a mesma janela do aviso no chão)? É quando tocam o visual e o som
 * de carga (`visual.chargeGroup`/`audio.chargeGroup` da skill) e quando um
 * golpe de status ainda pode ser interrompido. Interrompido, a ação acaba e
 * a carga também.
 */
export function isAttackCharging(action, attack) {
  return resolveAttackTelegraphProgress(action, attack) !== null
}

/**
 * O canal do golpe está RODANDO agora — golpe canalizado (`damageMode:
 * 'channel'`), já passado o instante do efeito (a carga acabou) e a ação ainda
 * em andamento (soltar o botão encerra a ação)? É quando roda o visual de canal
 * (`visual.channelGroup` — ex.: o jato do Water Gun seguindo a mira).
 */
export function isAttackChanneling(action, attack) {
  return isChannelAttack(attack) && isAttackPastEffect(action, attack)
}

/**
 * O golpe já passou do instante do efeito (`effectAt`) e a ação ainda está em
 * andamento? Qualquer golpe — é quando roda o visual da ação
 * (`visual.actionGroup` — ex.: a abanada do Tail Whip).
 */
export function isAttackPastEffect(action, attack) {
  const hitAt = resolveAttackHitTime(action, attack)
  return hitAt !== null && action.elapsed >= hitAt
}
