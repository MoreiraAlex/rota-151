import { trait } from 'koota'

/**
 * Vida (HP) e fôlego (stamina) da entidade — vem de `core/data/species/<id>/
 * index.js` (`vitals`), copiado no spawn; cada entidade pode ter seus
 * próprios máximos/taxas de regeneração. Current e máximo ficam juntos no
 * mesmo trait (diferente de `MovementStats`, que é só config): toda
 * operação que mexe num lê o outro (regenerar, drenar, exibir), então
 * separar só adicionaria indireção.
 *
 * `hpRegenDelay` conta em segundos quanto falta pra HP voltar a regenerar
 * depois de tomar dano — zero quando pode regenerar normalmente.
 * `staminaRegenDelay` é o mesmo princípio pro fôlego: quanto falta pra
 * stamina voltar a regenerar depois do último uso (correr, dash ou pulo) —
 * cada dreno reseta o delay, igual dano reseta o de HP.
 *
 * Dono de escrita: vitalsRegenSystem (regeneração + contagem dos delays);
 * movementSystem/playerActionSystem/characterPhysicsSystem (dreno de
 * stamina, cada um resetando `staminaRegenDelay` ao drenar); qualquer fonte
 * de dano, via `applyDamage` (só o botão de debug por enquanto).
 */
export const Vitals = trait({
  hp: 100,
  maxHp: 100,
  hpRegenPercent: 2,
  hpRegenDelay: 0,
  stamina: 100,
  maxStamina: 100,
  staminaRegenPercent: 10,
  staminaRegenDelay: 0,
})

/**
 * Desconta HP (nunca abaixo de zero) e reseta o delay de regeneração —
 * contrato único pra qualquer fonte de dano (hoje só o botão de debug do
 * `DebugPanel`; uma fonte de dano de jogo de verdade, quando existir, usa
 * a mesma função em vez de escrever em `hp` direto e arriscar esquecer o
 * delay).
 */
export function applyDamage(vitals, amount, delayAfterDamage) {
  return {
    hp: Math.max(0, vitals.hp - amount),
    hpRegenDelay: delayAfterDamage,
  }
}
