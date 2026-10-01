import { isAttackCharging } from './attackTelegraph'

/**
 * Golpe de STATUS: sem dano, só `effects` (Growl, Smokescreen, Growth).
 */
export function isStatusAttack(attack) {
  return !attack?.damage && (attack?.effects?.length ?? 0) > 0
}

/**
 * O golpe em andamento pode ser INTERROMPIDO por dano agora? Só golpe de
 * status (decisão do usuário: os de dano seguem como estão), e só durante a
 * CARGA — do disparo até o instante do efeito (`isAttackCharging`, a mesma
 * janela em que o aviso no chão enche). Depois disso o efeito já foi
 * aplicado e não volta.
 *
 * Vale igual pro status negativo (a carga é o aviso em cone) e pro golpe em
 * si mesmo (a carga é o círculo nos pés).
 */
export function isInterruptible(action, attack) {
  return isStatusAttack(attack) && isAttackCharging(action, attack)
}
