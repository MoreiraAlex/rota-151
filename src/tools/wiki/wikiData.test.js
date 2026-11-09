import { describe, expect, it } from 'vitest'
import { MUSIC_FREQUENCIES } from '@/core/data/audio/musicTracks'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listBiomes } from '@/core/data/biomes'
import { listSkills } from '@/core/data/skills'
import { listItems } from '@/core/data/items'
import { resolvePartyTuning } from '@/core/battle/aiTuning'
import { buildWikiData } from './wikiData'
import { listWikiSpecies } from './speciesEntry'

/** Todo valor folha do objeto, com o caminho até ele. */
function leaves(value, path = 'data') {
  if (value === null || typeof value !== 'object') return [[path, value]]
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, `${path}.${key}`),
  )
}

describe('buildWikiData', () => {
  const data = buildWikiData()

  it('é um retrato simples: sobrevive a JSON sem perder nada', () => {
    expect(JSON.parse(JSON.stringify(data))).toEqual(data)
  })

  it('não tem valor indefinido nem número inválido', () => {
    for (const [path, value] of leaves(data)) {
      expect(value, path).not.toBeUndefined()
      if (typeof value === 'number') {
        expect(Number.isNaN(value), path).toBe(false)
      }
    }
  })

  it('traz toda criatura e todo golpe do jogo', () => {
    expect(data.species.map((entry) => entry.id)).toEqual(
      listWikiSpecies().map((entry) => entry.id),
    )
    expect(data.skills).toHaveLength(listSkills().length)
  })

  it('traz todo item do jogo, com o que cada categoria faz', () => {
    expect(data.items.map((item) => item.id).sort()).toEqual(
      listItems()
        .map((item) => item.id)
        .sort(),
    )
    for (const item of data.items) {
      if (item.category === 'berry') {
        expect(item.berryHeal).toBeGreaterThan(0)
        expect(item.berryDuration).toBeGreaterThan(0)
      }
      if (item.category === 'pokeball') {
        expect(item.captureMultiplier).toBeGreaterThan(0)
      }
    }
  })

  it('números de regra saem da config do jogo', () => {
    expect(data.battle.criticalChance).toBe(
      GAME_CONFIG.BATTLE.CRITICAL_HIT_CHANCE,
    )
    expect(data.cost.divisor).toBe(GAME_CONFIG.ACTION_COST.COST_DIVISOR)
    expect(data.faint.minutes).toBe(GAME_CONFIG.FAINT.DURATION_MINUTES)
  })

  it('mundo: dia e clima saem da config e dos biomas (048)', () => {
    const { DAY_CYCLE } = GAME_CONFIG
    expect(data.world.dayMinutes).toBeCloseTo(DAY_CYCLE.DAY_LENGTH / 60)
    const visible = listBiomes().filter(
      ({ id }) => !GAME_CONFIG.BIOMES.HIDDEN.includes(id),
    )
    expect(data.world.biomes.map(({ name }) => name)).toEqual(
      visible.map(({ name }) => name),
    )
    for (const { chances } of data.world.biomes) {
      const total = Object.values(chances).reduce((sum, c) => sum + c, 0)
      expect(total).toBeCloseTo(1)
    }
    const configured = Object.values(
      GAME_CONFIG.WEATHER.MOVE_TYPE_MULTIPLIER,
    ).reduce((sum, byType) => sum + Object.keys(byType).length, 0)
    expect(data.world.moveEffects).toHaveLength(configured)
  })

  it('mundo: o silêncio entre as músicas sai das frequências (065)', () => {
    expect(data.world.musicSilence.map(({ id }) => id)).toEqual(
      Object.keys(MUSIC_FREQUENCIES),
    )
    for (const { id, min, max } of data.world.musicSilence) {
      expect({ min, max }).toEqual(MUSIC_FREQUENCIES[id])
    }
  })

  it('tabela de níveis de efeito vai de −limite a +limite, com o 0 neutro', () => {
    const { limit, rows } = data.stages
    expect(rows).toHaveLength(limit * 2 + 1)
    const neutral = rows.find((row) => row.stage === 0)
    expect(neutral.stat).toBe(1)
    expect(neutral.accuracy).toBe(1)
  })

  it('selvagens: percepção e fuga vêm da config (063)', () => {
    const { PERCEPTION, DEFAULT_FLEE_CHANCE } = GAME_CONFIG.WILD_BEHAVIOR
    expect(data.wild.viewDistance).toBe(PERCEPTION.VIEW_DISTANCE)
    expect(data.wild.nearRadius).toBe(PERCEPTION.NEAR_RADIUS)
    expect(data.wild.alertTime).toBe(PERCEPTION.ALERT_TIME)
    expect(data.wild.fleeChance).toBe(DEFAULT_FLEE_CHANCE)
    expect(data.wild.nearRadius).toBeLessThan(data.wild.viewDistance)
  })

  it('selvagens lutam pela dificuldade: nunca mais afiadas que o time (063)', () => {
    const { ai, wildAi } = data
    expect(wildAi.dodgeChance).toBeLessThanOrEqual(ai.dodgeChance)
    expect(wildAi.dodgeReaction).toBeGreaterThanOrEqual(ai.dodgeReaction)
    expect(wildAi.nearBest).toBeLessThanOrEqual(ai.nearBest)
    expect(wildAi.aimError).toBeGreaterThanOrEqual(0)
  })

  it('o time luta pela dificuldade dele (064)', () => {
    const tuning = resolvePartyTuning()
    expect(data.partyAi.attackInterval).toBe(tuning.ATTACK_INTERVAL)
    expect(data.partyAi.dodgeChance).toBe(tuning.DODGE_CHANCE)
    expect(data.partyAi.nearBest).toBe(tuning.NEAR_BEST_FRACTION)
  })

  it('posturas e quem fica para trás vêm da config (064)', () => {
    const { DEFAULT_POSTURE, PERCEPTION, FOLLOW_LIMIT } =
      GAME_CONFIG.PARTY_BEHAVIOR
    expect(data.party.defaultPosture).toBe(DEFAULT_POSTURE)
    expect(data.party.viewDistance).toBe(PERCEPTION.VIEW_DISTANCE)
    expect(data.party.nearRadius).toBe(PERCEPTION.NEAR_RADIUS)
    expect(data.party.recallDistance).toBe(FOLLOW_LIMIT.RECALL_DISTANCE)
    expect(data.party.warnDistance).toBe(FOLLOW_LIMIT.WARN_DISTANCE)
    expect(data.party.warningTime).toBe(FOLLOW_LIMIT.WARNING_TIME)
  })

  it('temperamento de cada espécie: o próprio ou o padrão (063)', () => {
    const { DEFAULT_HOSTILE_CHANCE, DEFAULT_FLEE_CHANCE } =
      GAME_CONFIG.WILD_BEHAVIOR
    const byId = new Map(listWikiSpecies().map((entry) => [entry.id, entry]))
    for (const entry of data.species) {
      const wild = byId.get(entry.id).wild
      expect(entry.temperament.hostileChance).toBe(
        wild?.hostileChance ?? DEFAULT_HOSTILE_CHANCE,
      )
      expect(entry.temperament.fleeChance).toBe(
        wild?.fleeChance ?? DEFAULT_FLEE_CHANCE,
      )
    }
  })

  it('captura: regras da config; menos vida e bola melhor dão mais chance', () => {
    const { capture } = data
    expect(capture.shakeCount).toBe(GAME_CONFIG.CAPTURE.SHAKE_COUNT)
    expect(capture.xpFraction).toBe(GAME_CONFIG.CAPTURE.XP_FRACTION)
    for (let i = 1; i < capture.rows.length; i++) {
      capture.rows[i].chances.forEach((chance, ball) => {
        expect(chance).toBeGreaterThanOrEqual(capture.rows[i - 1].chances[ball])
      })
    }
    for (const row of capture.rows) {
      expect(row.chances).toHaveLength(capture.balls.length)
      for (const chance of row.chances) {
        expect(chance).toBeGreaterThanOrEqual(0)
        expect(chance).toBeLessThanOrEqual(1)
      }
    }
    expect(capture.speciesRates.length).toBe(listWikiSpecies().length)
  })

  it('onde encontrar: quem tem spawn traz biomas, raridade e condições; quem não tem, nada', () => {
    const species = listWikiSpecies()
    const biomeNames = new Set(listBiomes().map((biome) => biome.name))
    for (const entry of data.species) {
      const source = species.find((candidate) => candidate.id === entry.id)
      if (!source.spawn) {
        expect(entry.spawn, entry.id).toBeNull()
        continue
      }
      expect(entry.spawn.rarity).toBe(source.spawn.rarity)
      expect(entry.spawn.biomes.length, entry.id).toBeGreaterThan(0)
      for (const name of entry.spawn.biomes)
        expect(biomeNames.has(name)).toBe(true)
      expect(entry.spawn.phases).toEqual(
        Object.entries(source.spawn.phases ?? {}).map(([key, factor]) => ({
          key,
          factor,
        })),
      )
      expect(entry.spawn.weather).toEqual(
        Object.entries(source.spawn.weather ?? {}).map(([key, factor]) => ({
          key,
          factor,
        })),
      )
    }
  })

  it('spawn das selvagens e teto de nível vêm da config', () => {
    const { WILD_SPAWN, EXPERIENCE } = GAME_CONFIG
    expect(data.wildSpawn.maxPerPlayer).toBe(WILD_SPAWN.MAX_PER_PLAYER)
    expect(data.wildSpawn.rarityChances).toEqual(WILD_SPAWN.RARITY_CHANCES)
    expect(data.wildSpawn.nearRadius).toBeLessThan(data.wildSpawn.farRadius)
    expect(data.wildSpawn.levelCap).toBe(EXPERIENCE.LEVEL_CAP)
    expect(data.experience.levelCap).toBe(EXPERIENCE.LEVEL_CAP)
    expect(data.experience.levelCap).toBeLessThanOrEqual(
      data.experience.maxLevel,
    )
  })
})
