import { GAME_CONFIG } from '../gameConfig'
import { ActionState } from '../traits'

/**
 * Quanto dura o atordoamento (a ação `'hit'`) de uma espécie:
 * `species.actions.hit.duration`, ou o padrão `GAME_CONFIG.BATTLE.
 * HIT_STUN_DURATION`.
 */
export function resolveHitStunDuration(species) {
  return species?.actions?.hit?.duration ?? GAME_CONFIG.BATTLE.HIT_STUN_DURATION
}

/**
 * Põe a criatura na ação `'hit'` (atordoada) — hoje quando um golpe de status
 * é interrompido por dano (`creatureAttackSystem.js`). Enquanto dura, toca a
 * animação de hit e a criatura não faz nada: quem a moveria, atacaria ou
 * faria outra ação já respeita `ActionState.current !== null`, e o pulo
 * respeita `isHitStunned`. `animationSpeed` segue a regra de toda ação
 * (`1 / duration`). Quem avança e encerra é `creatureHitStunSystem.js`.
 *
 * Recebe o objeto do `ActionState` e o altera no lugar (quem chama grava).
 */
export function iniciarAtordoamento(action, species) {
  const duration = resolveHitStunDuration(species)
  action.current = 'hit'
  action.elapsed = 0
  action.animationSpeed = duration > 0 ? 1 / duration : 1
  action.animationFrames = null
  action.animationKey = null
  action.pendingSlot = null
}

/**
 * Põe a criatura atordoada por uma CONDIÇÃO (a ação `'stunned'`, ex.: a
 * paralisia do Glare): interrompe o que estiver fazendo e fica parada até a
 * condição acabar — quem encerra é `creatureHitStunSystem.js`, pela condição,
 * não por uma duração. Mesmo efeito da `'hit'`: nada anda, ataca, pula nem
 * voa enquanto dura.
 */
export function iniciarAtordoamentoPorCondicao(action) {
  action.current = 'stunned'
  action.elapsed = 0
  action.animationSpeed = 1
  action.animationFrames = null
  action.animationKey = null
  action.pendingSlot = null
}

/**
 * A criatura está atordoada agora — pelo acerto (ação `'hit'`) ou por uma
 * condição (`'stunned'`)?
 */
export function isHitStunned(entity) {
  if (!entity.has(ActionState)) return false
  const { current } = entity.get(ActionState)
  return current === 'hit' || current === 'stunned'
}
