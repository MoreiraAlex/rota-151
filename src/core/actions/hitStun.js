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

/** A criatura está atordoada (ação `'hit'`) agora? */
export function isHitStunned(entity) {
  return entity.has(ActionState) && entity.get(ActionState).current === 'hit'
}
