import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Pool de tamanho FIXO dos números de dano na tela — regra de efeito
 * visual frequente (docs/rules/README.md, seção 7): nada nasce/morre por
 * número, os `size` slots são reaproveitados em rodízio; com o pool cheio,
 * o número mais antigo dá lugar ao novo.
 *
 * Estado só da view: quem escreve é `damageNumberSystem.js` (spawn +
 * idade), quem lê é `DamageNumbersView.jsx` (desenha). `serial` muda a
 * cada spawn — a view usa pra saber que o slot virou outro número e
 * trocar o texto uma vez só, sem re-render do React por frame.
 */
export function createDamageNumberPool(size) {
  const slots = Array.from({ length: size }, () => ({
    active: false,
    serial: 0,
    age: 0,
    lifetime: 0,
    x: 0,
    y: 0,
    z: 0,
    text: '',
    critical: false,
  }))
  let next = 0
  let serial = 0

  return {
    slots,
    spawn({ position, text, critical, lifetime }) {
      const slot = slots[next]
      next = (next + 1) % size
      serial += 1
      slot.active = true
      slot.serial = serial
      slot.age = 0
      slot.lifetime = lifetime
      slot.x = position.x
      slot.y = position.y
      slot.z = position.z
      slot.text = text
      slot.critical = critical
      return slot
    },
    advance(delta) {
      for (const slot of slots) {
        if (!slot.active) continue
        slot.age += delta
        if (slot.age >= slot.lifetime) slot.active = false
      }
    },
  }
}

export const damageNumberPool = createDamageNumberPool(
  GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER.POOL_SIZE,
)
