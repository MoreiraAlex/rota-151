import { describe, expect, it } from 'vitest'
import { GAME_CONFIG } from '../gameConfig'
import { createRng } from '../rng'
import {
  baseLevelAt,
  cityLevel,
  levelFromStart,
  levelParams,
  rollLevelAround,
} from './wildLevel'

// O nível das selvagens pelas cidades (docs/features/062-spawn-estilo-
// cobblemon.md). Cidades só com o que a regra lê (célula e id).

const params = levelParams()
const SEED = 1234

const cityOf = (cellX, cellZ) => ({ id: `${cellX},${cellZ}`, cellX, cellZ })
const FIRST = cityOf(0, 0)
const OTHERS = Array.from({ length: 40 }, (_, i) => cityOf(i + 1, -i))

describe('cityLevel', () => {
  it('a primeira cidade tem o nível do começo', () => {
    expect(cityLevel(SEED, FIRST)).toBe(params.FIRST_CITY)
  })

  it('as outras sorteiam entre a primeira (a mais fraca) e o teto, sempre o mesmo para a mesma seed', () => {
    for (const city of OTHERS) {
      const level = cityLevel(SEED, city)
      expect(level).toBeGreaterThanOrEqual(params.FIRST_CITY)
      expect(level).toBeLessThanOrEqual(params.CAP)
      expect(cityLevel(SEED, city)).toBe(level)
    }
  })

  it('não é sempre subindo: entre vizinhas, há nível que desce', () => {
    const levels = OTHERS.map((city) => cityLevel(SEED, city))
    const goesDown = levels.some((level, i) => i > 0 && level < levels[i - 1])
    expect(goesDown).toBe(true)
  })
})

describe('baseLevelAt', () => {
  const other = OTHERS.find(
    (city) => cityLevel(SEED, city) !== params.FIRST_CITY,
  )
  const otherLevel = cityLevel(SEED, other)

  it('no centro de uma cidade, o nível dela', () => {
    const nearest = [
      { city: FIRST, distance: 0 },
      { city: other, distance: 100 },
    ]
    expect(baseLevelAt(SEED, nearest)).toBe(params.FIRST_CITY)
  })

  it('a meio caminho, a média das duas', () => {
    const nearest = [
      { city: FIRST, distance: 50 },
      { city: other, distance: 50 },
    ]
    expect(baseLevelAt(SEED, nearest)).toBeCloseTo(
      (params.FIRST_CITY + otherLevel) / 2,
    )
  })

  it('vai mudando aos poucos de uma até a outra', () => {
    // Andando da primeira (distância 0 dela) até a outra.
    const levels = [0, 25, 50, 75, 100].map((walked) =>
      baseLevelAt(SEED, [
        { city: FIRST, distance: walked },
        { city: other, distance: 100 - walked },
      ]),
    )
    expect(levels[0]).toBe(params.FIRST_CITY)
    expect(levels.at(-1)).toBeCloseTo(otherLevel)
    const sign = Math.sign(otherLevel - params.FIRST_CITY)
    for (let i = 1; i < levels.length; i++) {
      expect(Math.sign(levels[i] - levels[i - 1])).toBe(sign)
    }
  })

  it('sem cidade, o nível do começo', () => {
    expect(baseLevelAt(SEED, [])).toBe(params.FIRST_CITY)
  })
})

// Só a cidade inicial no mundo (`CITIES.ONLY_FIRST`, docs/features/069-
// revisao-do-bioma-cidade.md): o nível sobe com a distância dela.
describe('levelFromStart (só a cidade inicial)', () => {
  const START = { ...FIRST, radius: 80 }
  const at = (distance) => baseLevelAt(SEED, [{ city: START, distance }])

  it('dentro dela e na borda, o nível do começo', () => {
    expect(at(0)).toBe(params.FIRST_CITY)
    expect(at(START.radius)).toBe(params.FIRST_CITY)
  })

  it('da borda para fora sobe sem voltar, até o teto a CAP_DISTANCE m da borda', () => {
    const steps = 20
    let previous = at(START.radius)
    for (let i = 1; i <= steps; i++) {
      const level = at(START.radius + (params.CAP_DISTANCE * i) / steps)
      expect(level).toBeGreaterThan(previous)
      previous = level
    }
    expect(previous).toBeCloseTo(params.CAP, 9)
  })

  it('além, fica no teto', () => {
    expect(at(START.radius + params.CAP_DISTANCE * 3)).toBe(params.CAP)
  })

  it('é o que baseLevelAt usa com a cidade inicial sozinha', () => {
    const nearest = { city: START, distance: START.radius + 100 }
    expect(baseLevelAt(SEED, [nearest])).toBe(levelFromStart(nearest))
  })
})

describe('rollLevelAround', () => {
  it('fica a até a variação do nível base, entre 1 e o teto da versão', () => {
    const rng = createRng(9)
    const base = (params.FIRST_CITY + params.CAP) / 2
    for (let i = 0; i < 200; i++) {
      const level = rollLevelAround(rng, base)
      expect(Math.abs(level - Math.round(base))).toBeLessThanOrEqual(
        params.SPREAD,
      )
    }
    expect(rollLevelAround(rng, -100)).toBe(1)
    expect(rollLevelAround(rng, params.CAP * 2)).toBe(params.CAP)
  })
})

describe('levelParams', () => {
  it('o teto é o da versão, nunca acima do oficial', () => {
    expect(params.CAP).toBeLessThanOrEqual(GAME_CONFIG.EXPERIENCE.MAX_LEVEL)
    expect(params.CAP).toBeLessThanOrEqual(GAME_CONFIG.EXPERIENCE.LEVEL_CAP)
  })
})
