import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeWorld, givePokemon } from '@/test/makeWorld'
import { spawnWild } from '@/test/spawnWild'
import { getCondition, listConditions } from '@/core/data/conditions'
import { getSkill, listSkills } from '@/core/data/skills'
import { listSpecies } from '@/core/data/species'
import { resolveSpeciesTypes } from '@/core/data/types'
import {
  ActionState,
  Conditions,
  StoredConditions,
  conditionSource,
} from '@/core/traits'
import {
  aplicarCondicao,
  avancarCondicaoGuardada,
  devolverCondicoes,
  guardarCondicoes,
  listActiveConditions,
  readCondition,
  readConditionModifier,
  readConditionModifiers,
  removerCondicoes,
  resolveConditionTick,
} from './conditions'
import { isDashReady } from './dash'
import { isHitStunned } from './hitStun'

// Os efeitos de verdade dos golpes (sem fixar valores do conteúdo).
const BURN = getSkill('ember').effects.find(
  (effect) => effect.condition === 'burn',
)
const SEED = getSkill('leech-seed').effects.find(
  (effect) => effect.condition === 'leech-seed',
)
const BURN_DATA = getCondition('burn')
const ALWAYS = () => 0
const NEVER = () => 0.999999

const immuneSpecies = listSpecies().find((species) =>
  resolveSpeciesTypes(species).some((type) =>
    BURN_DATA.immuneTypes.includes(type),
  ),
)
const vulnerableSpecies = listSpecies().find(
  (species) =>
    species.kind === 'pokemon' &&
    !resolveSpeciesTypes(species).some((type) =>
      BURN_DATA.immuneTypes.includes(type),
    ),
)

let world
let player
const worlds = []
beforeEach(() => {
  ;({ world, player } = makeWorld())
  worlds.push(world)
})
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function spawnTarget(species = vulnerableSpecies) {
  return spawnWild(world, { speciesId: species.id })
}

describe('aplicarCondicao', () => {
  it('efeito de outro tipo: null, nada muda', () => {
    const target = spawnTarget()
    expect(aplicarCondicao(target, player, { type: 'statStage' }, ALWAYS)).toBe(
      null,
    )
    expect(target.has(Conditions)).toBe(false)
  })

  it('sorteia a chance: pegou aplica (com crédito pra quem aplicou), errou não', () => {
    const target = spawnTarget()
    expect(aplicarCondicao(target, player, BURN, NEVER)).toBe(false)
    expect(target.has(Conditions)).toBe(false)

    expect(aplicarCondicao(target, player, BURN, ALWAYS)).toBe(true)
    expect(readCondition(target, 'burn')).toMatchObject({
      timeLeft: BURN_DATA.duration,
      fraction: BURN_DATA.tick.fraction,
      interval: BURN_DATA.tick.interval,
      modifiers: BURN_DATA.modifiers,
    })
    expect(target.targetFor(conditionSource('burn'))).toBe(player)
  })

  it('tipo imune não pega', () => {
    if (!immuneSpecies) return
    const target = spawnTarget(immuneSpecies)
    expect(aplicarCondicao(target, player, BURN, ALWAYS)).toBe(false)
    expect(target.has(Conditions)).toBe(false)
  })

  it('aplicar de novo renova o tempo, mantém o ritmo do próximo tick e troca quem aplicou', () => {
    const target = spawnTarget()
    const other = spawnWild(world)
    aplicarCondicao(target, player, BURN, ALWAYS)
    Object.assign(readCondition(target, 'burn'), {
      timeLeft: 1,
      tickTimer: 0.5,
    })

    aplicarCondicao(target, other, BURN, ALWAYS)

    expect(readCondition(target, 'burn')).toMatchObject({
      timeLeft: BURN_DATA.duration,
      tickTimer: 0.5,
    })
    expect(target.targetFor(conditionSource('burn'))).toBe(other)
  })

  it('condições diferentes somam, cada uma com quem aplicou', () => {
    const target = spawnTarget()
    const other = spawnWild(world)
    aplicarCondicao(target, player, BURN, ALWAYS)
    aplicarCondicao(target, other, SEED, ALWAYS)

    expect(listActiveConditions(target)).toEqual(['burn', 'leech-seed'])
    expect(target.targetFor(conditionSource('burn'))).toBe(player)
    expect(target.targetFor(conditionSource('leech-seed'))).toBe(other)
  })

  it('o golpe troca valores da condição só pra ele', () => {
    const target = spawnTarget()
    const duration = BURN_DATA.duration + 1
    const fraction = BURN_DATA.tick.fraction / 2
    aplicarCondicao(
      target,
      player,
      { ...BURN, duration, tick: { fraction } },
      ALWAYS,
    )
    expect(readCondition(target, 'burn')).toMatchObject({
      timeLeft: duration,
      fraction,
      interval: BURN_DATA.tick.interval,
    })
  })

  it('removerCondicoes tira todas e quem aplicou', () => {
    const target = spawnTarget()
    aplicarCondicao(target, player, BURN, ALWAYS)
    aplicarCondicao(target, player, SEED, ALWAYS)
    removerCondicoes(target)
    expect(target.has(Conditions)).toBe(false)
    expect(target.has(conditionSource('burn')('*'))).toBe(false)
    expect(target.has(conditionSource('leech-seed')('*'))).toBe(false)
  })
})

describe('modificadores', () => {
  it('sem condição, 1; com ela, o da condição; somando, o produto', () => {
    const target = spawnTarget()
    expect(readConditionModifier(target, 'attack')).toBe(1)
    expect(readConditionModifier(null, 'attack')).toBe(1)

    aplicarCondicao(target, player, BURN, ALWAYS)
    const attack = BURN_DATA.modifiers.attack
    expect(readConditionModifier(target, 'attack')).toBe(attack)
    expect(readConditionModifiers(target)).toEqual(BURN_DATA.modifiers)

    aplicarCondicao(
      target,
      player,
      { type: 'condition', condition: 'leech-seed', modifiers: { attack } },
      ALWAYS,
    )
    expect(readConditionModifier(target, 'attack')).toBe(attack * attack)
  })
})

describe('resolveConditionTick', () => {
  const fraction = BURN_DATA.tick.fraction

  it('fração do HP máximo, mínimo 1, nunca mais que o HP que sobra', () => {
    const maxHp = 1000
    expect(resolveConditionTick({ hp: maxHp, maxHp }, fraction)).toBe(
      Math.floor(maxHp * fraction),
    )
    expect(resolveConditionTick({ hp: 1, maxHp: 1 }, fraction)).toBe(1)
    expect(resolveConditionTick({ hp: 1, maxHp }, fraction)).toBe(1)
  })
})

describe('guardar e devolver condições', () => {
  it('a que fica na bola vai pro registro e volta pra criatura com o tempo que falta; a que não fica, não', () => {
    const creature = spawnTarget()
    aplicarCondicao(creature, player, BURN, ALWAYS)
    aplicarCondicao(creature, player, SEED, ALWAYS)
    readCondition(creature, 'burn').timeLeft = 4
    const pokemon = givePokemon(world, player, 'charmander')

    guardarCondicoes(creature, pokemon)
    const stored = pokemon.get(StoredConditions).list.map((item) => item.id)
    for (const id of ['burn', 'leech-seed']) {
      expect(stored.includes(id)).toBe(getCondition(id).keepsInBall)
    }

    const next = spawnTarget()
    devolverCondicoes(pokemon, next)
    expect(readCondition(next, 'burn').timeLeft).toBe(4)
    expect(next.has(conditionSource('burn')('*'))).toBe(false)
    expect(pokemon.has(StoredConditions)).toBe(false)
  })

  it('sem condição, o registro fica sem nada guardado', () => {
    const creature = spawnTarget()
    const pokemon = givePokemon(world, player, 'charmander')
    pokemon.add(StoredConditions({ list: [{ id: 'burn', timeLeft: 1 }] }))

    guardarCondicoes(creature, pokemon)

    expect(pokemon.has(StoredConditions)).toBe(false)
  })
})

describe('avancarCondicaoGuardada', () => {
  const vitals = { hp: 30, maxHp: 30 }
  const entry = {
    id: 'burn',
    timeLeft: 10,
    tickTimer: 1,
    fraction: 0.1,
    interval: 1,
    to: null,
    modifiers: {},
  }

  it('tira o tick a cada intervalo, como em campo', () => {
    const next = avancarCondicaoGuardada(entry, vitals, 1)
    expect(next.vitals.hp).toBe(
      vitals.hp - resolveConditionTick(vitals, entry.fraction),
    )
    expect(next.entry.timeLeft).toBe(entry.timeLeft - 1)
  })

  it('antes do intervalo, só conta o tempo', () => {
    const next = avancarCondicaoGuardada(entry, vitals, 0.5)
    expect(next.vitals).toBe(vitals)
    expect(next.entry.tickTimer).toBe(0.5)
  })

  it('acaba o tempo: a condição sai', () => {
    const next = avancarCondicaoGuardada(
      { ...entry, timeLeft: 0.5 },
      vitals,
      0.5,
    )
    expect(next.entry).toBe(null)
  })

  it('zerou a vida: para', () => {
    const next = avancarCondicaoGuardada(entry, { hp: 1, maxHp: 30 }, 1)
    expect(next.vitals.hp).toBe(0)
    expect(next.entry).toBe(null)
  })
})

describe('condição que freia o passo (modificador `movement`)', () => {
  // A condição com modificador de passo e um golpe que a aplica.
  const condition = listConditions().find(
    (item) => item.modifiers?.movement !== undefined,
  )
  const effect = listSkills()
    .flatMap((skill) => skill.effects ?? [])
    .find((item) => item.condition === condition?.id)

  it('existe e algum golpe aplica', () => {
    expect(condition).toBeDefined()
    expect(effect).toBeDefined()
  })

  it('aplicada, o passo de quem está com ela muda pelo modificador', () => {
    const target = spawnTarget()
    expect(readConditionModifier(target, 'movement')).toBe(1)
    aplicarCondicao(target, player, effect, ALWAYS)
    expect(readConditionModifier(target, 'movement')).toBeCloseTo(
      condition.modifiers.movement,
    )
  })

  it('de novo não acumula: o modificador continua o mesmo', () => {
    const target = spawnTarget()
    aplicarCondicao(target, player, effect, ALWAYS)
    aplicarCondicao(target, player, effect, ALWAYS)
    expect(readConditionModifier(target, 'movement')).toBeCloseTo(
      condition.modifiers.movement,
    )
  })
})

describe('condição que prende (passo zerado)', () => {
  // A condição de um golpe que zera o passo (o Wrap), sem fixar qual.
  const effect = listSkills()
    .flatMap((skill) => skill.effects ?? [])
    .find(
      (item) =>
        item.type === 'condition' &&
        getCondition(item.condition)?.modifiers?.movement === 0,
    )

  it('existe e algum golpe aplica', () => {
    expect(effect).toBeDefined()
  })

  it('preso: o passo zera e o dash não sai', () => {
    const target = spawnTarget()
    expect(isDashReady(target)).toBe(true)
    aplicarCondicao(target, player, effect, ALWAYS)
    expect(readConditionModifier(target, 'movement')).toBe(0)
    expect(isDashReady(target)).toBe(false)
  })
})

describe('condição que interrompe (o recuo)', () => {
  const effect = listSkills()
    .flatMap((skill) => skill.effects ?? [])
    .find(
      (item) =>
        item.type === 'condition' && getCondition(item.condition)?.interrupt,
    )

  it('existe e algum golpe aplica', () => {
    expect(effect).toBeDefined()
  })

  it('pegou: o alvo para o que fazia e fica atordoado, sem entrar na lista', () => {
    const target = spawnTarget()
    target.set(ActionState, { current: 'attack', elapsed: 0.2 })
    expect(
      aplicarCondicao(target, player, { ...effect, chance: 1 }, ALWAYS),
    ).toBe(true)
    expect(isHitStunned(target)).toBe(true)
    expect(listActiveConditions(target)).toEqual([])
  })
})
