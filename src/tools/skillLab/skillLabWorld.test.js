import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listSpecies, getSpecies } from '@/core/data/species'
import {
  listLearnset,
  resolveSpeciesMoveReference,
} from '@/core/data/species/moves'
import { resolveSkill } from '@/core/data/skills'
import { readStatStages } from '@/core/battle/statStages'
import { isChannelAttack, isSelfAttack } from '@/core/battle/channelAttack'
import {
  resolveHitTrigger,
  resolveTriggerFrontEdge,
} from '@/core/battle/hitTrigger'
import { createEventQueue, EVENT_TYPES } from '@/core/events'
import { initPhysics, disposePhysics } from '@/core/physics/physicsWorld'
import { levelWaterDepthAt } from '@/core/actions/water'
import {
  ActionState,
  StatStages,
  Vitals,
  CreatureLevel,
  IndividualValues,
  SummonedCreature,
  Position,
  Rotation,
  Flying,
  WildCreature,
  AttackEffect,
  CharacterController,
} from '@/core/traits'
import { resolveBodyExtent } from '@/core/physics/capsule'
import { makeWorld } from '@/test/makeWorld'
import { castRay } from '@/core/physics/raycast'
import { verticalClearance } from '@/core/physics/colliders'
import { reliefHeightAt } from './labRelief'
import { resolveAttackForEntity } from '@/core/battle/attackCasting'
import { resolveEntityMoveSet } from '@/core/battle/creatureAttack'
import {
  LAB_GROUND,
  LAB_SLOT,
  LabActor,
  desmontarLab,
  listLabTargets,
  montarLab,
  resolveLabAttack,
  resolveLabRelief,
  resolveTargetZForGap,
  readLabGap,
  runLabFixedStep,
} from './skillLabWorld'

const { FIXED_TIMESTEP } = GAME_CONFIG.LOOP

// Um golpe de dano comum (impacto único, num alvo) de alguma espécie.
function findDamageMove() {
  for (const species of listSpecies()) {
    for (const { id } of listLearnset(species)) {
      const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
      if (attack.damage && !isChannelAttack(attack) && !isSelfAttack(attack)) {
        return { species, attack }
      }
    }
  }
  return null
}

// Um golpe que sobe estágio de quem usa (em si mesmo).
function findSelfStageMove() {
  for (const species of listSpecies()) {
    for (const { id } of listLearnset(species)) {
      const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
      if (
        isSelfAttack(attack) &&
        attack.effects?.some((effect) => effect.type === 'statStage')
      ) {
        return { species, attack }
      }
    }
  }
  return null
}

// Um golpe de alguma espécie que cumpre `rule`.
function findMove(rule) {
  for (const species of listSpecies()) {
    for (const { id } of listLearnset(species)) {
      const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
      if (rule(attack)) return { species, attack }
    }
  }
  return null
}

// Um golpe de dano em área (cone ou círculo).
function findAreaDamageMove() {
  for (const species of listSpecies()) {
    for (const { id } of listLearnset(species)) {
      const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
      if (attack.damage && ['cone', 'circle'].includes(attack.area)) {
        return { species, attack }
      }
    }
  }
  return null
}

// Um alvo da espécie à frente do atacante, com `gap` de vão entre os
// triggers.
function targetAt(species, gap, changes = {}) {
  return {
    key: 1,
    speciesId: species.id,
    level: species.level ?? 1,
    x: 0,
    y: 0,
    z: resolveTargetZForGap(species, species, gap),
    ...changes,
  }
}

function labFor({ species, attack }, overrides = {}) {
  const { gap = attack.range / 2, ...rest } = overrides
  return {
    attackerId: species.id,
    moveId: attack.id,
    targets: [targetAt(species, gap)],
    aimAt: 0,
    interval: FIXED_TIMESTEP,
    attackerLevel: species.level ?? 1,
    mastery: 1,
    resetBetween: true,
    ...rest,
  }
}

// Um golpe de dano com arrancada (`lunge`).
function findLungeMove() {
  for (const species of listSpecies()) {
    for (const { id } of listLearnset(species)) {
      const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
      if (attack.damage && attack.lunge?.distance > 0) {
        return { species, attack }
      }
    }
  }
  return null
}

// Um golpe com efeito no corpo de cada alvo (`targetEffectGroup`).
function findTargetEffectMove() {
  for (const species of listSpecies()) {
    for (const { id } of listLearnset(species)) {
      const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
      if (attack.visual?.targetEffectGroup) return { species, attack }
    }
  }
  return null
}

const hitTargets = (events) =>
  new Set(
    events
      .filter(
        (event) =>
          event.type === EVENT_TYPES.ATTACK_RESOLVED &&
          event.target?.has(LabActor),
      )
      .map((event) => event.target.get(LabActor).index),
  )

function run(world, lab, seconds) {
  const events = createEventQueue()
  const seen = []
  const steps = Math.ceil(seconds / FIXED_TIMESTEP)
  for (let i = 0; i < steps; i++) {
    events.beginStep()
    runLabFixedStep({ world, delta: FIXED_TIMESTEP, events, lab })
    seen.push(...events.drain())
  }
  return seen
}

function actor(world, role) {
  for (const entity of world.query(LabActor)) {
    if (entity.get(LabActor).role === role) return entity
  }
  return null
}

let world
beforeEach(async () => {
  await initPhysics()
  world = makeWorld().world
})
afterEach(() => {
  desmontarLab(world)
  world.destroy()
  disposePhysics()
})

describe('laboratório de golpes', () => {
  it('a área do chão é seca (sem água freando quem anda)', () => {
    const half = LAB_GROUND.size / 2
    for (let x = -half; x <= half; x += 1) {
      for (let z = -half; z <= half; z += 1) {
        expect(levelWaterDepthAt(x, z)).toBeLessThanOrEqual(0)
      }
    }
  })

  it('relança o golpe em loop e acerta o alvo', () => {
    const move = findDamageMove()
    const lab = labFor(move)
    montarLab(world, lab)

    const hits = run(world, lab, move.attack.duration * 4).filter(
      (event) =>
        event.type === EVENT_TYPES.ATTACK_RESOLVED &&
        event.attackId === move.attack.id &&
        event.target === actor(world, 'target'),
    )
    expect(hits.length).toBeGreaterThan(1)
  })

  it('o alvo não fica sem vida', () => {
    const move = findDamageMove()
    const lab = labFor(move, {
      attackerLevel: GAME_CONFIG.EXPERIENCE.MAX_LEVEL,
    })
    montarLab(world, lab)
    run(world, lab, move.attack.duration * 4)
    expect(actor(world, 'target').get(Vitals).hp).toBeGreaterThan(0)
  })

  it('sem alvo, o golpe sai no vazio', () => {
    const move = findDamageMove()
    const lab = labFor(move, { targets: [], aimAt: null })
    montarLab(world, lab)
    run(world, lab, FIXED_TIMESTEP * 2)
    expect(actor(world, 'target')).toBeNull()
    expect(actor(world, 'attacker').get(ActionState).current).toBe('attack')
  })

  it('zerando entre golpes, o estágio não acumula; sem zerar, acumula', () => {
    const move = findSelfStageMove()
    const effect = move.attack.effects.find((e) => e.type === 'statStage')
    const stageOf = (entity) =>
      entity.has(StatStages) ? entity.get(StatStages)[`${effect.stat}Stage`] : 0

    const cycles = (move.attack.duration + FIXED_TIMESTEP * 4) * 3

    const resetting = labFor(move, { targets: [], aimAt: null })
    montarLab(world, resetting)
    run(world, resetting, cycles)
    expect(Math.abs(stageOf(actor(world, 'attacker')))).toBeLessThanOrEqual(
      Math.abs(effect.stages),
    )

    const stacking = { ...resetting, resetBetween: false }
    montarLab(world, stacking)
    run(world, stacking, cycles)
    expect(Math.abs(stageOf(actor(world, 'attacker')))).toBeGreaterThan(
      Math.abs(effect.stages),
    )
  })

  it('o golpe que a página mostra é o que o atacante lança', () => {
    const move = findDamageMove()
    const lab = labFor(move, { mastery: 0.5 })
    montarLab(world, lab)
    run(world, lab, FIXED_TIMESTEP)

    const attacker = actor(world, 'attacker')
    const species = getSpecies(attacker.get(SummonedCreature).speciesId)
    const cast = resolveAttackForEntity(
      species,
      LAB_SLOT,
      attacker.get(IndividualValues),
      attacker.get(CreatureLevel).level,
      resolveEntityMoveSet(attacker, species),
    )
    expect(resolveLabAttack(lab)).toEqual(cast)
  })

  it('o chão da física é o relevo escolhido', () => {
    const move = findDamageMove()
    for (const kind of ['hill', 'step', 'ramp']) {
      const lab = labFor(move, {
        relief: { kind, height: 1, center: 0.5, length: move.attack.range },
      })
      montarLab(world, lab)
      run(world, lab, FIXED_TIMESTEP * 2)
      const relief = resolveLabRelief(lab)
      const reach = lab.targets[0].z
      for (const z of [-1, 0, reach / 3, reach / 2, reach + 1]) {
        const x = LAB_GROUND.size / 4
        // como o golpe vê (só o que é fixo) e como o aviso no chão vê (só o
        // relevo)
        for (const filter of [{ terrainOnly: true }, { groundOnly: true }]) {
          const hit = castRay(
            { x, y: 10, z },
            { x: 0, y: -1, z: 0 },
            20,
            filter,
          )
          expect(hit.point.y).toBeCloseTo(reliefHeightAt(relief, z), 1)
        }
      }
    }
  })

  it('no degrau, o alvo fica em pé lá em cima', () => {
    const move = findDamageMove()
    const lab = labFor(move, {
      relief: { kind: 'step', height: 1, center: 0.5, length: 1 },
    })
    montarLab(world, lab)
    run(world, lab, 1)
    const target = actor(world, 'target')
    const species = getSpecies(target.get(WildCreature).speciesId)
    expect(target.get(Position).y).toBeCloseTo(
      lab.relief.height + verticalClearance(species.body),
      1,
    )
  })

  it('a distância é até o trigger do alvo: no range acerta, além erra', () => {
    const move = findDamageMove()
    const hitsAt = (gap) => {
      const lab = labFor(move, { gap })
      montarLab(world, lab)
      return run(world, lab, move.attack.duration * 2).some(
        (event) =>
          event.type === EVENT_TYPES.ATTACK_RESOLVED &&
          event.target === actor(world, 'target'),
      )
    }
    expect(hitsAt(move.attack.range - 0.02)).toBe(true)
    expect(hitsAt(move.attack.range + 0.05)).toBe(false)
  })

  it('o Z do alvo pelo vão soma as bordas da frente dos dois triggers', () => {
    const { species } = findDamageMove()
    const frontEdge = resolveTriggerFrontEdge(resolveHitTrigger(species.body))
    expect(resolveTargetZForGap(species, species, 1)).toBeCloseTo(
      frontEdge + 1 + frontEdge,
    )
  })

  it('vários alvos: cada um no x/z pedido, todos virados pro atacante', () => {
    const move = findDamageMove()
    const base = targetAt(move.species, move.attack.range)
    const lab = labFor(move, {
      targets: [
        base,
        { ...base, key: 2, x: 2, z: base.z + 1 },
        { ...base, key: 3, x: -3, z: -1 },
      ],
    })
    montarLab(world, lab)
    run(world, lab, FIXED_TIMESTEP * 2)

    const targets = listLabTargets(world)
    expect(targets).toHaveLength(lab.targets.length)
    targets.forEach((target, index) => {
      const pos = target.get(Position)
      expect(pos.x).toBeCloseTo(lab.targets[index].x, 1)
      expect(pos.z).toBeCloseTo(lab.targets[index].z, 1)
      // a frente (sin yaw, cos yaw) aponta pra origem
      const yaw = target.get(Rotation).y
      const toAttacker = Math.hypot(pos.x, pos.z)
      expect(Math.sin(yaw)).toBeCloseTo(-pos.x / toAttacker, 2)
      expect(Math.cos(yaw)).toBeCloseTo(-pos.z / toAttacker, 2)
    })
  })

  it('golpe em área acerta todos os alvos dentro dele', () => {
    const move = findAreaDamageMove()
    const base = targetAt(move.species, 0)
    const lab = labFor(move, {
      targets: [
        base,
        { ...base, key: 2, x: 0.3 },
        { ...base, key: 3, x: -0.3 },
      ],
    })
    montarLab(world, lab)
    const hit = hitTargets(run(world, lab, move.attack.duration * 2))
    expect([...hit].sort()).toEqual([0, 1, 2])
  })

  it('golpe de um alvo só acerta o primeiro no caminho', () => {
    const move = findDamageMove()
    const near = targetAt(move.species, 0)
    const lab = labFor(move, {
      targets: [near, { ...near, key: 2, z: near.z + 0.5 }],
    })
    montarLab(world, lab)
    const hit = hitTargets(run(world, lab, move.attack.duration * 2))
    expect([...hit]).toEqual([0])
  })

  it('alvo acima do chão fica no ar, como quem voa', () => {
    const move = findDamageMove()
    const height = 1
    const lab = labFor(move)
    lab.targets[0].y = height
    montarLab(world, lab)
    run(world, lab, 1)
    const target = actor(world, 'target')
    const species = getSpecies(target.get(WildCreature).speciesId)
    expect(target.has(Flying)).toBe(true)
    expect(target.get(Position).y).toBeCloseTo(
      height + verticalClearance(species.body),
      1,
    )
  })

  it('mexer na posição do alvo leva ele pro lugar novo na hora', () => {
    const move = findDamageMove()
    const lab = labFor(move, { interval: 10 })
    montarLab(world, lab)
    run(world, lab, FIXED_TIMESTEP * 2)
    const moved = {
      ...lab,
      targets: [{ ...lab.targets[0], x: 2, z: lab.targets[0].z + 1 }],
    }
    run(world, moved, FIXED_TIMESTEP)
    const pos = actor(world, 'target').get(Position)
    expect(pos.x).toBeCloseTo(moved.targets[0].x, 1)
    expect(pos.z).toBeCloseTo(moved.targets[0].z, 1)
  })

  it('o efeito no corpo do alvo nasce virado como ele e com o tamanho dele', () => {
    const move = findTargetEffectMove()
    const base = targetAt(move.species, 0)
    const lab = labFor(move, {
      targets: [base, { ...base, key: 2, x: 0.4 }],
      // sem sorteio de erro atrapalhando
      mastery: 1,
    })
    montarLab(world, lab)
    const effects = []
    const events = createEventQueue()
    const steps = Math.ceil((move.attack.duration * 3) / FIXED_TIMESTEP)
    for (let i = 0; i < steps && effects.length === 0; i++) {
      events.beginStep()
      runLabFixedStep({ world, delta: FIXED_TIMESTEP, events, lab })
      events.drain()
      for (const entity of world.query(AttackEffect)) {
        const effect = entity.get(AttackEffect)
        if (effect.effectGroup === move.attack.visual.targetEffectGroup) {
          effects.push({ effect, yaw: entity.get(Rotation).y })
        }
      }
    }
    expect(effects.length).toBeGreaterThan(0)
    const target = actor(world, 'target')
    const extent = resolveBodyExtent(target.get(CharacterController))
    for (const { effect, yaw } of effects) {
      expect(effect.bodyWidth).toBeCloseTo(extent.width)
      expect(effect.bodyLength).toBeCloseTo(extent.length)
      expect(effect.bodyHeight).toBeCloseTo(extent.height)
      const yaws = listLabTargets(world).map((t) => t.get(Rotation).y)
      expect(yaws.some((targetYaw) => Math.abs(targetYaw - yaw) < 1e-6)).toBe(
        true,
      )
    }
  })

  it('arrancada: acerta além do alcance do corpo a corpo, sem entrar no alvo', () => {
    const move = findLungeMove()
    const { range, lunge } = move.attack
    const gap = range + lunge.distance / 2
    const lab = labFor(move, { gap, interval: 10 })
    montarLab(world, lab)
    const startZ = actor(world, 'attacker').get(Position).z
    const hits = hitTargets(run(world, lab, move.attack.duration))
    expect([...hits]).toEqual([0])
    // andou na direção do alvo e parou antes de encostar nele
    const moved = actor(world, 'attacker').get(Position).z - startZ
    expect(moved).toBeGreaterThan(0)
    expect(moved).toBeLessThan(gap)
  })

  it('arrancada: parada até o effectAt, o acerto vem quando chega', () => {
    const move = findLungeMove()
    const { range, lunge } = move.attack
    const lab = labFor(move, { gap: range + lunge.distance / 2, interval: 10 })
    montarLab(world, lab)
    // o effectAt que o atacante usa (escalado pela velocidade dele)
    const { effectAt } = resolveLabAttack(lab)
    const attacker = () => actor(world, 'attacker')
    const startZ = attacker().get(Position).z
    const events = createEventQueue()
    let movedBeforeEffect = 0
    let hitAt = null
    const steps = Math.ceil(move.attack.duration / FIXED_TIMESTEP)
    for (let i = 0; i < steps; i++) {
      events.beginStep()
      runLabFixedStep({ world, delta: FIXED_TIMESTEP, events, lab })
      const { elapsed, current } = attacker().get(ActionState)
      if (current === 'attack' && elapsed < effectAt) {
        movedBeforeEffect = Math.max(
          movedBeforeEffect,
          Math.abs(attacker().get(Position).z - startZ),
        )
      }
      const hit = events
        .drain()
        .find((e) => e.type === EVENT_TYPES.ATTACK_RESOLVED && e.target)
      if (hit && hitAt === null) hitAt = elapsed
    }
    expect(movedBeforeEffect).toBeLessThan(0.01)
    expect(hitAt).not.toBeNull()
    expect(hitAt).toBeGreaterThan(effectAt)
  })

  it('arrancada sem alvo: corre a distância toda', () => {
    const move = findLungeMove()
    const lab = labFor(move, { targets: [], aimAt: null, interval: 10 })
    montarLab(world, lab)
    const startZ = actor(world, 'attacker').get(Position).z
    run(world, lab, move.attack.duration)
    const moved = actor(world, 'attacker').get(Position).z - startZ
    expect(moved).toBeCloseTo(move.attack.lunge.distance, 0)
  })

  it('vários acertos: os seguintes vão no mesmo alvo, numerados', () => {
    const move = findMove((attack) => attack.multiHit)
    const lab = labFor(move)
    montarLab(world, lab)
    const hits = run(world, lab, resolveLabAttack(lab).duration * 6).filter(
      (event) =>
        event.type === EVENT_TYPES.ATTACK_RESOLVED &&
        event.attackId === move.attack.id &&
        event.target,
    )
    expect(hits.some((event) => event.hitIndex > 0)).toBe(true)
    for (const event of hits) {
      expect(event.target).toBe(actor(world, 'target'))
      expect(event.hitIndex).toBeLessThan(event.hitCount)
      if (!event.missed) {
        expect(move.attack.multiHit.counts).toContain(event.hitCount)
      }
    }
  })

  it('poder maior contra quem apanhou há pouco: só acumulando', () => {
    const move = findMove((attack) => attack.damage?.recentDamageBoost)
    const boosted = (resetBetween) => {
      const lab = labFor(move, { resetBetween })
      montarLab(world, lab)
      const events = run(world, lab, resolveLabAttack(lab).duration * 3)
      desmontarLab(world)
      return events.some(
        (event) => event.type === EVENT_TYPES.ATTACK_RESOLVED && event.boosted,
      )
    }
    expect(boosted(true)).toBe(false)
    expect(boosted(false)).toBe(true)
  })

  it('o que o golpe dá a quem usa só vale quando ele acerta alguém', () => {
    const move = findMove((attack) =>
      attack.selfEffects?.some((effect) => effect.type === 'statStage'),
    )
    const { stat } = move.attack.selfEffects.find(
      (effect) => effect.type === 'statStage',
    )
    const stageAfter = (overrides) => {
      const lab = labFor(move, { interval: 10, ...overrides })
      montarLab(world, lab)
      run(world, lab, resolveLabAttack(lab).duration)
      const stage = readStatStages(actor(world, 'attacker'))[stat]
      desmontarLab(world)
      return stage
    }
    expect(stageAfter({})).toBeGreaterThan(0)
    expect(stageAfter({ targets: [], aimAt: null })).toBe(0)
  })

  it('desmontar tira tudo do laboratório', () => {
    montarLab(world, labFor(findDamageMove()))
    desmontarLab(world)
    expect(world.query(LabActor).length).toBe(0)
  })
})

describe('laboratório de golpes — distância real', () => {
  let labWorld
  beforeEach(async () => {
    await initPhysics()
    labWorld = makeWorld().world
  })
  afterEach(() => {
    desmontarLab(labWorld)
    labWorld.destroy()
    disposePhysics()
  })

  it('no plano, a distância real é a pedida, e no range exato acerta', () => {
    const move = findDamageMove()
    const lab = labFor(move, { gap: move.attack.range })
    montarLab(labWorld, lab)
    const events = run(labWorld, lab, move.attack.duration * 2)
    expect(readLabGap(labWorld)).toBeCloseTo(move.attack.range, 2)
    expect(
      events.some(
        (event) =>
          event.type === EVENT_TYPES.ATTACK_RESOLVED &&
          event.target === actor(labWorld, 'target'),
      ),
    ).toBe(true)
  })
})
