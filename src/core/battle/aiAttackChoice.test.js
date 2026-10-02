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
    // A 6m só o Ember (alcance 8) alcança: 40 × bônus = 50, contra 40 do
    // Tackle; o Growl (25, fora do alcance) fica fora do sorteio. Ordem dos
    // slots: Tackle (E) antes do Ember (R).
    const plan = planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0.99)
    expect(plan.attack.id).toBe('ember')
    expect(plan.reach).toBeGreaterThan(6)
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0).attack.id,
    ).toBe('tackle')
  })

  it('golpe em cooldown ou sem stamina fica de fora; nada pronto → null', () => {
    const { wild, trainer } = spawnCharmanders()
    wild.set(AttackCooldowns, { secondary1: 5, secondary2: 5, secondary3: 5 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0).slot,
    ).toBe('primary')
    wild.set(Vitals, { stamina: 0 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], null, () => 0),
    ).toBeNull()
  })

  it('mantém o golpe planejado enquanto ele continua pronto', () => {
    const { wild, trainer } = spawnCharmanders()
    const plan = planAiAttack(wild, CHARMANDER, trainer, [], 'primary', () => 0)
    expect(plan.slot).toBe('primary')
    wild.set(AttackCooldowns, { primary: 1 })
    expect(
      planAiAttack(wild, CHARMANDER, trainer, [], 'primary', () => 0).slot,
    ).not.toBe('primary')
  })

  it('espécie sem habilidades: só o básico', () => {
    const FOX = getSpecies('fox')
    const { wild, trainer } = spawnCharmanders()
    expect(planAiAttack(wild, FOX, trainer, [], null, () => 0.99).slot).toBe(
      'primary',
    )
  })

  it('energia baixa: golpes mais caros que o mais barato ficam de fora (reserva)', () => {
    const { wild, trainer } = spawnCharmanders()
    const { maxStamina } = wild.get(Vitals)
    wild.set(Vitals, {
      stamina: GAME_CONFIG.AI_ENERGY.SKILL_RESERVE_FRACTION * maxStamina,
    })
    // Growl (2) e Ember (4) não cabem; o básico e o Tackle deste Charmander
    // custam o mesmo 0.25 (o mais barato) e continuam.
    const cheap = ['primary', 'secondary2']
    for (const roll of [0, 0.5, 0.99]) {
      expect(cheap).toContain(
        planAiAttack(wild, CHARMANDER, trainer, [], null, () => roll).slot,
      )
    }
    // Plano numa habilidade que deixou de caber na reserva é descartado.
    expect(cheap).toContain(
      planAiAttack(wild, CHARMANDER, trainer, [], 'secondary3', () => 0).slot,
    )
  })
})
