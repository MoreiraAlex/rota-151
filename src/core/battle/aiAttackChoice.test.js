import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import {
  ActionState,
  AttackCooldowns,
  CharacterController,
  IndividualValues,
  LeechSeed,
  Party,
  Position,
  Vitals,
  WildCreature,
  vitalsFromSpecies,
} from '../traits'
import {
  pickAiAttack,
  planAiAttack,
  resolveReachFor,
  scoreAiAttack,
} from './aiAttackChoice'
import { resolveAttackForEntity } from './attackCasting'
import { resolveStab } from './calculateDamage'
import { resolveTypeEffectiveness } from '../data/types'

const {
  IN_REACH_BONUS,
  NEAR_BEST_FRACTION,
  STAT_STAGE_VALUE,
  LEECH_SEED_VALUE,
} = GAME_CONFIG.AI_ATTACK
const BODY = { capsuleRadius: 0.3, capsuleHalfHeight: 0.3 }

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  const attacker = world.spawn(Position({ x: 0, y: 0, z: 0 }))
  const spawnEnemy = (x, z) =>
    world.spawn(Position({ x, y: 0, z }), CharacterController(BODY))
  return { world, attacker, spawnEnemy }
}

function situation(attacker, target, enemies = []) {
  return {
    attacker,
    attackerPos: attacker.get(Position),
    target,
    targetPos: target.get(Position),
    targetBody: target.get(CharacterController),
    enemies: enemies.map((entity) => ({ entity, pos: entity.get(Position) })),
  }
}

// Golpes de teste feitos só de campos — a IA nunca olha o id.
const HIT = { id: 'x', range: 1, radius: 0.3, damage: { power: 40 } }
const CONE_HIT = { ...HIT, range: 3, radius: 1.5, area: 'cone' }
const DEBUFF = {
  id: 'z',
  range: 3,
  radius: 1.5,
  area: 'cone',
  damage: null,
  effects: [{ type: 'statStage', stat: 'attack', stages: -1, duration: 60 }],
}
const SEED = {
  id: 'w',
  range: 5,
  radius: 0.4,
  damage: null,
  effects: [{ type: 'leechSeed', fraction: 1 / 16, interval: 2, duration: 6 }],
}
const SELF_BUFF = {
  id: 'v',
  range: 0,
  radius: 0.5,
  area: 'self',
  damage: null,
  effects: [{ type: 'statStage', stat: 'attack', stages: 1, duration: 60 }],
}

describe('resolveReachFor', () => {
  it('range + radius + corpo do alvo; golpe em si mesmo não tem limite', () => {
    expect(resolveReachFor(HIT, BODY)).toBeCloseTo(1.6)
    expect(resolveReachFor(SELF_BUFF, BODY)).toBe(Infinity)
  })
})

describe('scoreAiAttack — só pelos campos da definição', () => {
  it('dano: o poder, com bônus quando já alcança o alvo', () => {
    const { attacker, spawnEnemy } = setup()
    const near = spawnEnemy(0, 1)
    const far = spawnEnemy(0, 5)
    expect(scoreAiAttack(HIT, situation(attacker, near))).toBe(
      40 * IN_REACH_BONUS,
    )
    expect(scoreAiAttack(HIT, situation(attacker, far))).toBe(40)
  })

  it('cone: soma cada inimigo dentro da área', () => {
    const { attacker, spawnEnemy } = setup()
    const target = spawnEnemy(0, 2)
    const beside = spawnEnemy(0.5, 2.2)
    const behind = spawnEnemy(0, -2)
    const score = scoreAiAttack(
      CONE_HIT,
      situation(attacker, target, [target, beside, behind]),
    )
    expect(score).toBe(40 * 2 * IN_REACH_BONUS)
  })

  it('efeitos: soma o avaliador de cada efeito (debuff e semente)', () => {
    const { attacker, spawnEnemy } = setup()
    const target = spawnEnemy(0, 2)
    expect(scoreAiAttack(DEBUFF, situation(attacker, target))).toBe(
      STAT_STAGE_VALUE * IN_REACH_BONUS,
    )
    expect(scoreAiAttack(SEED, situation(attacker, target))).toBe(
      LEECH_SEED_VALUE * IN_REACH_BONUS,
    )
    target.add(LeechSeed({ timeLeft: 5 }))
    expect(scoreAiAttack(SEED, situation(attacker, target))).toBe(0)
  })

  it('em si mesmo: avalia em quem usou, e vale 0 com inimigo perto', () => {
    const { attacker, spawnEnemy } = setup()
    const far = spawnEnemy(0, 6)
    expect(scoreAiAttack(SELF_BUFF, situation(attacker, far, [far]))).toBe(
      STAT_STAGE_VALUE * IN_REACH_BONUS,
    )
    const near = spawnEnemy(0, 2)
    expect(
      scoreAiAttack(SELF_BUFF, situation(attacker, far, [far, near])),
    ).toBe(0)
  })

  it('tipo: multiplica o dano por STAB × efetividade contra o alvo', () => {
    const { attacker, spawnEnemy } = setup()
    const attackerSpecies = getSpecies('charmander')
    const targetSpecies = getSpecies('bulbasaur')
    attacker.add(WildCreature({ speciesId: attackerSpecies.id }))
    const target = spawnEnemy(0, 5)
    target.add(WildCreature({ speciesId: targetSpecies.id }))
    const type = attackerSpecies.types[0]
    const expected =
      40 *
      resolveStab(type, attackerSpecies.types) *
      resolveTypeEffectiveness(type, targetSpecies.types).multiplier
    expect(scoreAiAttack({ ...HIT, type }, situation(attacker, target))).toBe(
      expected,
    )
  })

  it('tipo: golpe de status que não pega no tipo do alvo vale 0', () => {
    const { attacker, spawnEnemy } = setup()
    const targetSpecies = getSpecies('bulbasaur')
    const target = spawnEnemy(0, 2)
    target.add(WildCreature({ speciesId: targetSpecies.id }))
    expect(
      scoreAiAttack(
        { ...SEED, immuneTypes: [targetSpecies.types[0]] },
        situation(attacker, target),
      ),
    ).toBe(0)
  })

  it('`ai.weight` multiplica a nota', () => {
    const { attacker, spawnEnemy } = setup()
    const far = spawnEnemy(0, 5)
    expect(
      scoreAiAttack({ ...HIT, ai: { weight: 0.5 } }, situation(attacker, far)),
    ).toBe(20)
  })
})

describe('pickAiAttack — sorteio entre os melhores', () => {
  const candidates = [
    { slot: 'a', score: 100 },
    { slot: 'b', score: 70 },
    { slot: 'c', score: 100 * NEAR_BEST_FRACTION - 1 },
    { slot: 'd', score: 0 },
  ]

  it('só entram os próximos da melhor, com chance proporcional à nota', () => {
    expect(pickAiAttack(candidates, () => 0).slot).toBe('a')
    expect(pickAiAttack(candidates, () => 0.99).slot).toBe('b')
    // 100 / 170 ≈ 0.588: logo acima disso já é o 'b'.
    expect(pickAiAttack(candidates, () => 0.6).slot).toBe('b')
  })

  it('sem nota positiva, nada', () => {
    expect(pickAiAttack([{ slot: 'd', score: 0 }], () => 0)).toBeNull()
    expect(pickAiAttack([], () => 0)).toBeNull()
  })
})

describe('planAiAttack — com uma espécie de verdade', () => {
  const CHARMANDER = getSpecies('charmander')

  function spawnCharmanders() {
    const world = createWorld()
    worlds.push(world)
    const wild = world.spawn(
      WildCreature({ speciesId: 'charmander' }),
      Position({ x: 0, y: 0, z: 0 }),
      CharacterController(CHARMANDER.body),
      ActionState,
      AttackCooldowns,
      IndividualValues,
      vitalsFromSpecies(CHARMANDER),
    )
    const trainer = world.spawn(
      Party,
      Position({ x: 0, y: 0, z: 6 }),
      CharacterController(CHARMANDER.body),
      Vitals,
    )
    return { wild, trainer }
  }

  it('alvo longe: o golpe à distância (já alcança) tem a maior chance', () => {
    const { wild, trainer } = spawnCharmanders()
    // A 6m só o Ember (alcance 8) alcança e ainda tem STAB (Charmander é de
    // Fogo): a nota dele é a maior, então o sorteio no topo cai nele.
    const plan = planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0.99)
    expect(plan.attack.id).toBe('ember')
    expect(plan.reach).toBeGreaterThan(6)
  })

  it('golpe em cooldown ou sem stamina fica de fora; nada pronto → null', () => {
    const { wild, trainer } = spawnCharmanders()
    wild.set(AttackCooldowns, { secondary1: 5, secondary2: 5, secondary3: 5 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0),
    ).toBeNull()

    wild.set(AttackCooldowns, { secondary2: 0 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0).slot,
    ).toBe('secondary2')
    wild.set(Vitals, { stamina: 0 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0),
    ).toBeNull()
  })

  it('mantém o golpe planejado enquanto ele continua pronto', () => {
    const { wild, trainer } = spawnCharmanders()
    const plan = planAiAttack(
      wild,
      CHARMANDER,
      trainer,
      [],
      'secondary2',
      () => 0,
    )
    expect(plan.slot).toBe('secondary2')
    wild.set(AttackCooldowns, { secondary2: 1 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], 'secondary2', () => 0)?.slot,
    ).not.toBe('secondary2')
  })

  it('espécie sem golpes: nada a planejar', () => {
    const noSkills = { ...CHARMANDER, skills: {} }
    const { wild, trainer } = spawnCharmanders()
    expect(
      planAiAttack(wild, noSkills, trainer, [], null, () => 0.99),
    ).toBeNull()
  })

  it('energia baixa: golpes mais caros que o mais barato só se sobrar a reserva', () => {
    const { wild, trainer } = spawnCharmanders()
    const { maxStamina } = wild.get(Vitals)
    const stamina = GAME_CONFIG.AI_ENERGY.SKILL_RESERVE_FRACTION * maxStamina
    wild.set(Vitals, { stamina })
    const costs = ['secondary1', 'secondary2', 'secondary3']
      .map((slot) =>
        resolveAttackForEntity(CHARMANDER, slot, wild.get(IndividualValues)),
      )
      .filter((attack) => attack && attack.staminaCost <= stamina)
      .map((attack) => attack.staminaCost)
    const cheapest = Math.min(...costs)

    for (const roll of [0, 0.5, 0.99]) {
      const plan = planAiAttack(wild, CHARMANDER, trainer, [], null, () => roll)
      if (!plan) continue
      expect(plan.attack.staminaCost).toBeLessThanOrEqual(cheapest)
    }
  })
})
