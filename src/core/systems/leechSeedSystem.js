import { registrarParticipante } from '../actions/experience'
import { resolveLeechDrain } from '../actions/leechSeed'
import { leechSeedDrained } from '../events'
import { GAME_CONFIG } from '../gameConfig'
import {
  AttackEffect,
  Fainted,
  LeechSeed,
  Position,
  Rotation,
  SeededBy,
  Vitals,
  applyDamage,
  applyHeal,
} from '../traits'

/**
 * Leech Seed (ver docs/features/033-skills-de-combate-e-vfx.md, Parte 9): a
 * cada `interval` segundos, a semente (`LeechSeed`) drena `fraction` do HP
 * máximo do alvo (`resolveLeechDrain`, mínimo 1) e cura quem plantou
 * (`SeededBy`) o mesmo valor — se quem plantou ainda existe e não está
 * desmaiado; senão só drena. Cada drenagem emite `leechSeedDrained` (números
 * na tela) e solta o visual `'leech-drain'` (um `AttackEffect` no alvo,
 * orientado de quem plantou pro alvo, `length` = a distância entre os dois:
 * os orbes viajam do alvo até ele). A semente seca ao fim de `timeLeft`, ou
 * na hora se o alvo desmaiar.
 *
 * A drenagem é dano, mas passiva: não provoca a selvagem (não sai
 * `attackResolved`) nem interrompe golpe de status (isso é do
 * `creatureAttackSystem`).
 *
 * Dono de escrita: `LeechSeed`/`SeededBy` (conta e remove) e o `Vitals` dos
 * dois na drenagem. Fase: simulation, antes do `faintSystem` (quem a
 * drenagem zerar desmaia no mesmo tick).
 */
export function leechSeedSystem(context) {
  const { world, delta, events } = context

  const dried = []
  world
    .query(LeechSeed, Vitals, Position)
    .updateEach(([seed, vitals], target) => {
      if (target.has(Fainted) || vitals.hp <= 0) {
        dried.push(target)
        return
      }

      seed.timeLeft -= delta
      seed.tickTimer -= delta
      while (seed.tickTimer <= 0 && seed.interval > 0) {
        seed.tickTimer += seed.interval
        drain(world, events, target, vitals, seed.fraction)
        if (vitals.hp <= 0) break
      }
      if (seed.timeLeft <= 0) dried.push(target)
    })

  // Fora do `updateEach`: remover trait muda a query iterada.
  for (const target of dried) {
    target.remove(LeechSeed)
    target.remove(SeededBy('*'))
  }
}

// `vitals` é o objeto do `updateEach` (alterado no lugar — um `target.set`
// aqui seria sobrescrito no fim da passada).
function drain(world, events, target, vitals, fraction) {
  const damage = resolveLeechDrain(vitals, fraction)
  Object.assign(
    vitals,
    applyDamage(vitals, damage, vitals.hpRegenDelayAfterDamage),
  )

  const source = target.targetFor(SeededBy) ?? null
  // a drenagem é dano de quem plantou: conta pra divisão do XP
  if (source) registrarParticipante(world, source, target)
  let healed = 0
  if (source?.isAlive() && source.has(Vitals) && !source.has(Fainted)) {
    const before = source.get(Vitals)
    const after = applyHeal(before, damage)
    healed = after.hp - before.hp
    source.set(Vitals, after)
  }

  events.emit(leechSeedDrained({ target, source, damage, healed }))
  spawnDrainEffect(world, target, source)
}

/**
 * O visual da drenagem: nasce no alvo, com +Z apontando de quem plantou pro
 * alvo (a convenção de `AttackEffect`: "a criatura" fica em (0, 0, -length) —
 * aqui, quem plantou). Sem quem plantou, o grupo `'leech-drain-solo'` (só o
 * estouro e os brotos no alvo).
 */
function spawnDrainEffect(world, target, source) {
  const at = target.get(Position)
  const from =
    source?.isAlive() && source.has(Position) ? source.get(Position) : null
  const dx = from ? at.x - from.x : 0
  const dz = from ? at.z - from.z : 0
  const length = Math.hypot(dx, dz)
  world.spawn(
    Position({ x: at.x, y: at.y, z: at.z }),
    Rotation({ y: length > 1e-6 ? Math.atan2(dx, dz) : 0 }),
    AttackEffect({
      lifetime: GAME_CONFIG.BATTLE.LEECH_DRAIN_EFFECT_DURATION,
      radius: 0.5,
      // sem quem plantou, não há pra onde os orbes viajarem
      effectGroup: from ? 'leech-drain' : 'leech-drain-solo',
      impactType: '',
      visualScale: 1,
      length,
    }),
  )
}
