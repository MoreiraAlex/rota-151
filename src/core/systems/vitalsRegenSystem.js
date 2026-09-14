import { Vitals } from '../traits'

/**
 * Regenera HP e stamina com o tempo, a uma taxa (% do máximo por segundo)
 * definida por espécie (`Vitals.hpRegenPercent`/`staminaRegenPercent`).
 *
 * HP tem um delay pós-dano (`Vitals.hpRegenDelay`, em segundos, contado pra
 * baixo aqui): enquanto não chega a zero, HP não regenera. Stamina tem o
 * mesmo princípio (`Vitals.staminaRegenDelay`), mas contado a partir do
 * último uso (correr, dash ou pulo) em vez de dano — quem drena stamina
 * reseta o delay, este system só conta pra baixo e libera a regeneração
 * quando chega a zero.
 *
 * Headless. Fase: simulation, antes de movementSystem/playerActionSystem/
 * characterPhysicsSystem — o dreno de stamina desses systems desconta por
 * cima da regeneração já aplicada neste mesmo tick (e reseta o delay de
 * novo, então um uso contínuo, como segurar corrida, nunca deixa a
 * regeneração entrar no meio).
 */
export function vitalsRegenSystem(context) {
  const { world, delta } = context

  world.query(Vitals).updateEach(([vitals]) => {
    if (vitals.hpRegenDelay > 0) {
      vitals.hpRegenDelay = Math.max(0, vitals.hpRegenDelay - delta)
    } else if (vitals.hp < vitals.maxHp) {
      const regen = vitals.maxHp * (vitals.hpRegenPercent / 100) * delta
      vitals.hp = Math.min(vitals.maxHp, vitals.hp + regen)
    }

    if (vitals.staminaRegenDelay > 0) {
      vitals.staminaRegenDelay = Math.max(0, vitals.staminaRegenDelay - delta)
    } else if (vitals.stamina < vitals.maxStamina) {
      const regen =
        vitals.maxStamina * (vitals.staminaRegenPercent / 100) * delta
      vitals.stamina = Math.min(vitals.maxStamina, vitals.stamina + regen)
    }
  })
}
