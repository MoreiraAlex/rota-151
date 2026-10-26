import { isAttackCharging } from './attackTelegraph'
import { isChargeAttack } from './channelAttack'

/**
 * O golpe em andamento pode ser INTERROMPIDO por dano agora? Só o de carga
 * (`execution: 'charge'` — decisão do usuário, docs/features/061-revisao-das-
 * skills.md), e só durante a CARGA — do disparo até o instante do efeito
 * (`isAttackCharging`, a mesma janela em que o aviso no chão enche). Depois
 * disso o efeito já foi aplicado e não volta.
 */
export function isInterruptible(action, attack) {
  return isChargeAttack(attack) && isAttackCharging(action, attack)
}
