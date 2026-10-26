import { registrarParticipante } from '../actions/experience'
import { resolveConditionTick } from '../actions/conditions'
import { getCondition } from '../data/conditions'
import { conditionTicked } from '../events'
import {
  AttackEffect,
  Conditions,
  Fainted,
  Position,
  Rotation,
  Vitals,
  applyDamage,
  applyHeal,
  conditionSource,
} from '../traits'

/**
 * Condições (docs/features/061-revisao-das-skills.md, "Condições
 * padronizadas"), todas pelo mesmo laço: a cada `interval` segundos o tick
 * tira `fraction` do HP máximo do alvo (`resolveConditionTick`, mínimo 1);
 * com `to: 'source'`, cura quem aplicou o mesmo valor — se ainda existe e não
 * está desmaiado. O crédito do dano (divisão do XP) vai pra quem aplicou.
 * Cada tick emite `conditionTicked` (números, log) e solta o visual do tick
 * da condição (`visual.tick`), se tiver. A condição acaba ao fim de
 * `timeLeft`; todas acabam na hora se o alvo desmaiar.
 *
 * Dano passivo: não provoca a selvagem (não sai `attackResolved`) nem
 * interrompe golpe.
 *
 * Dono de escrita: `Conditions` e as relações de quem aplicou (conta e
 * remove) e o `Vitals` do alvo e de quem cura no tick. Fase: simulation,
 * antes do `faintSystem` (quem o tick zerar desmaia no mesmo tick).
 */
export function conditionSystem(context) {
  const { world, delta, events } = context

  const ended = []
  world.query(Conditions, Vitals).updateEach(([conditions, vitals], target) => {
    if (target.has(Fainted) || vitals.hp <= 0) {
      ended.push({ target, ids: conditions.list.map((item) => item.id) })
      return
    }

    const over = []
    for (const item of conditions.list) {
      item.timeLeft -= delta
      item.tickTimer -= delta
      while (item.tickTimer <= 0 && item.interval > 0 && vitals.hp > 0) {
        item.tickTimer += item.interval
        tick(world, events, target, vitals, item)
      }
      if (item.timeLeft <= 0) over.push(item.id)
    }
    if (over.length) ended.push({ target, ids: over })
  })

  // Fora do `updateEach`: tirar trait/relação muda a query iterada.
  for (const { target, ids } of ended) {
    for (const id of ids) target.remove(conditionSource(id)('*'))
    const list = target
      .get(Conditions)
      .list.filter((item) => !ids.includes(item.id))
    if (list.length) target.set(Conditions, { list })
    else target.remove(Conditions)
  }
}

// `vitals` é o objeto do `updateEach` (alterado no lugar — um `target.set`
// aqui seria sobrescrito no fim da passada).
function tick(world, events, target, vitals, item) {
  const damage = resolveConditionTick(vitals, item.fraction)
  Object.assign(
    vitals,
    applyDamage(vitals, damage, vitals.hpRegenDelayAfterDamage),
  )

  const source = target.targetFor(conditionSource(item.id)) ?? null
  if (source) registrarParticipante(world, source, target)
  let healed = 0
  if (
    item.to === 'source' &&
    source?.isAlive() &&
    source.has(Vitals) &&
    !source.has(Fainted)
  ) {
    const before = source.get(Vitals)
    const after = applyHeal(before, damage)
    healed = after.hp - before.hp
    source.set(Vitals, after)
  }

  events?.emit(
    conditionTicked({ target, source, condition: item.id, damage, healed }),
  )
  spawnTickEffect(world, target, source, getCondition(item.id)?.visual?.tick)
}

/**
 * O visual do tick: nasce no alvo, com +Z apontando de quem aplicou pro alvo
 * (a convenção de `AttackEffect`: "a criatura" fica em (0, 0, -length) —
 * aqui, quem aplicou). Sem quem aplicou em campo, o `soloGroup`.
 */
function spawnTickEffect(world, target, source, visual) {
  if (!visual || !target.has(Position)) return
  const at = target.get(Position)
  const from =
    source?.isAlive() && source.has(Position) ? source.get(Position) : null
  const dx = from ? at.x - from.x : 0
  const dz = from ? at.z - from.z : 0
  const length = Math.hypot(dx, dz)
  const effectGroup = from ? visual.group : visual.soloGroup
  if (!effectGroup) return
  world.spawn(
    Position({ x: at.x, y: at.y, z: at.z }),
    Rotation({ y: length > 1e-6 ? Math.atan2(dx, dz) : 0 }),
    AttackEffect({
      lifetime: visual.duration,
      radius: 0.5,
      effectGroup,
      impactType: '',
      visualScale: 1,
      length,
    }),
  )
}
