import { sairDeCombate } from '../actions/combat'
import { CombatMode } from '../traits'

/**
 * Conta o tempo do modo combate (`CombatMode.timeLeft`) e tira a criatura
 * dele quando zera (`sairDeCombate` — olho volta pra `'awake'`). Quem
 * renova o tempo é cada ataque lançado (`entrarEmCombate`, chamado por
 * `creatureAttackSystem.js`).
 *
 * Headless. Fase: simulation, depois do `creatureAttackSystem` (um ataque
 * no mesmo tick renova antes de contar).
 */
export function combatModeSystem(context) {
  const { world, delta } = context
  const expired = []

  world.query(CombatMode).updateEach(([combat], entity) => {
    combat.timeLeft -= delta
    if (combat.timeLeft <= 0) expired.push(entity)
  })

  // Fora do `updateEach`: remover trait muda a própria query iterada.
  for (const entity of expired) sairDeCombate(entity)
}
