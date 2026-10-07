import { registrarParticipante } from '../actions/experience'
import { resolveBurnDamage } from '../actions/burn'
import { burnDamaged } from '../events'
import { Burn, BurnedBy, Fainted, Vitals, applyDamage } from '../traits'

/**
 * Queimadura (docs/features/039-tipos-e-combate-classico.md, Parte 4): a cada
 * `interval` segundos, `Burn` tira `fraction` do HP máximo do alvo
 * (`resolveBurnDamage`, mínimo 1) e emite `burnDamaged` (número na tela,
 * log). O crédito do dano (divisão do XP) vai pra quem queimou (`BurnedBy`).
 * Apaga ao fim de `timeLeft`, ou na hora se o alvo desmaiar.
 *
 * Dano passivo, como a drenagem da semente: não provoca a selvagem (não sai
 * `attackResolved`) nem interrompe golpe de status.
 *
 * Dono de escrita: `Burn`/`BurnedBy` (conta e remove) e o `Vitals` do alvo
 * no tick. Fase: simulation, antes do `faintSystem` (quem a queimadura zerar
 * desmaia no mesmo tick).
 */
export function burnSystem(context) {
  const { world, delta, events } = context

  const extinguished = []
  world.query(Burn, Vitals).updateEach(([burn, vitals], target) => {
    if (target.has(Fainted) || vitals.hp <= 0) {
      extinguished.push(target)
      return
    }

    burn.timeLeft -= delta
    burn.tickTimer -= delta
    while (burn.tickTimer <= 0 && burn.interval > 0) {
      burn.tickTimer += burn.interval
      scorch(world, events, target, vitals, burn.fraction)
      if (vitals.hp <= 0) break
    }
    if (burn.timeLeft <= 0) extinguished.push(target)
  })

  // Fora do `updateEach`: remover trait muda a query iterada.
  for (const target of extinguished) {
    target.remove(Burn)
    target.remove(BurnedBy('*'))
  }
}

// `vitals` é o objeto do `updateEach` (alterado no lugar — um `target.set`
// aqui seria sobrescrito no fim da passada).
function scorch(world, events, target, vitals, fraction) {
  const damage = resolveBurnDamage(vitals, fraction)
  Object.assign(
    vitals,
    applyDamage(vitals, damage, vitals.hpRegenDelayAfterDamage),
  )
  const source = target.targetFor(BurnedBy) ?? null
  if (source) registrarParticipante(world, source, target)
  events?.emit(burnDamaged({ target, source, damage }))
}
