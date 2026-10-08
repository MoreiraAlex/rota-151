import {
  BeingCaptured,
  Fainted,
  StoredFaint,
  StoredVitals,
  Vitals,
} from '../traits'

/**
 * Um tick de regeneração num objeto com os campos de `Vitals` (muta ele):
 * HP e stamina sobem a uma taxa (% do máximo por segundo) definida por
 * espécie (`hpRegenPercent`/`staminaRegenPercent`), cada um só depois do
 * próprio delay zerar (`hpRegenDelay` pós-dano, `staminaRegenDelay` pós-
 * uso — contados pra baixo aqui). Devolve se mudou algo.
 *
 * Exportada: a MESMA regra vale pra criatura em campo (`Vitals`) e pra
 * Pokémon fora de campo, no time ou no inventário (`StoredVitals`).
 */
export function regenerateVitals(vitals, delta) {
  let changed = false

  if (vitals.hpRegenDelay > 0) {
    vitals.hpRegenDelay = Math.max(0, vitals.hpRegenDelay - delta)
    changed = true
  } else if (vitals.hp < vitals.maxHp) {
    const regen = vitals.maxHp * (vitals.hpRegenPercent / 100) * delta
    vitals.hp = Math.min(vitals.maxHp, vitals.hp + regen)
    changed = true
  }

  if (vitals.staminaRegenDelay > 0) {
    vitals.staminaRegenDelay = Math.max(0, vitals.staminaRegenDelay - delta)
    changed = true
  } else if (vitals.stamina < vitals.maxStamina) {
    const regen = vitals.maxStamina * (vitals.staminaRegenPercent / 100) * delta
    vitals.stamina = Math.min(vitals.maxStamina, vitals.stamina + regen)
    changed = true
  }

  return changed
}

/**
 * Regenera HP e stamina com o tempo (`regenerateVitals`) de toda entidade
 * com `Vitals` e de cada Pokémon fora de campo, no time ou no inventário
 * (`StoredVitals`) — fora de campo ele continua exatamente como se estivesse
 * fora da bola. Desmaiado não regenera, em campo (`Fainted`) nem fora
 * (`StoredFaint`).
 *
 * HP tem um delay pós-dano: enquanto não chega a zero, HP não regenera.
 * Stamina tem o mesmo princípio, mas contado a partir do último uso
 * (correr, dash ou pulo) em vez de dano — quem drena stamina reseta o
 * delay, este system só conta pra baixo e libera a regeneração quando
 * chega a zero.
 *
 * Headless. Fase: simulation, antes de movementSystem/playerActionSystem/
 * characterPhysicsSystem — o dreno de stamina desses systems desconta por
 * cima da regeneração já aplicada neste mesmo tick (e reseta o delay de
 * novo, então um uso contínuo, como segurar corrida, nunca deixa a
 * regeneração entrar no meio).
 */
export function vitalsRegenSystem(context) {
  const { world, delta } = context

  world.query(Vitals).updateEach(([vitals], entity) => {
    // Desmaiada não regenera nada (acorda com HP fixo, ver `acordar`); dentro
    // de uma Pokébola sendo capturada também não (docs/features/043-captura.md).
    if (entity.has(Fainted) || entity.has(BeingCaptured)) return
    regenerateVitals(vitals, delta)
  })

  world.query(StoredVitals).updateEach(([stored], pokemon) => {
    if (!stored.vitals || pokemon.has(StoredFaint)) return
    // Objeto novo (não muta o guardado): a HUD só percebe a troca.
    const next = { ...stored.vitals }
    if (regenerateVitals(next, delta)) stored.vitals = next
  })
}
