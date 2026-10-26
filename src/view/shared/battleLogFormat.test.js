import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import {
  attackFailed,
  attackResolved,
  attackUsed,
  berriesHarvested,
  conditionApplied,
  conditionTicked,
  creatureFainted,
  experienceGained,
  foragedNothing,
  inventoryFull,
  moveLearned,
  statStageChanged,
  worldItemPicked,
} from '@/core/events'
import { listItems } from '@/core/data/items'
import { listSkills } from '@/core/data/skills'
import { getCondition, listConditions } from '@/core/data/conditions'
import { Party, Pokemon, SummonedCreature, WildCreature } from '@/core/traits'
import { formatSpeciesName } from './formatName'
import {
  formatBattleLogEvent,
  formatCombatantName,
  formatMoveName,
  formatStatChangeLine,
} from './battleLogFormat'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const world = createWorld()
  worlds.push(world)
  const ally = world.spawn(
    SummonedCreature({ slot: 'slot1', speciesId: 'charmander' }),
  )
  const wild = world.spawn(WildCreature({ speciesId: 'bulbasaur' }))
  const trainer = world.spawn(Party)
  const pokemon = world.spawn(Pokemon({ speciesId: 'charmander' }))
  return { ally, wild, trainer, pokemon }
}

const SKILL = listSkills().find((skill) => skill.damage)

function resolved(attacker, target, extra = {}) {
  return attackResolved({
    attacker,
    target,
    attackId: SKILL.id,
    slot: 'secondary1',
    origin: { x: 0, y: 0, z: 0 },
    impactPoint: { x: 0, y: 0, z: 1 },
    damage: 7.4,
    critical: false,
    ...extra,
  })
}

const texts = (event) => formatBattleLogEvent(event).map((line) => line.text)

describe('formatCombatantName', () => {
  it('time pelo nome, selvagem com "selvagem", sem espécie = treinador', () => {
    const { ally, wild, trainer } = setup()
    expect(formatCombatantName(ally)).toBe(formatSpeciesName('charmander'))
    expect(formatCombatantName(wild)).toContain(formatSpeciesName('bulbasaur'))
    expect(formatCombatantName(wild)).toContain('selvagem')
    expect(formatCombatantName(trainer)).toBe('Treinador')
  })
})

describe('formatBattleLogEvent', () => {
  it('golpe usado: "<quem> usou <golpe>!"', () => {
    const { ally } = setup()
    const [text] = texts(
      attackUsed({ entity: ally, attackId: SKILL.id, slot: 'secondary1' }),
    )
    expect(text).toContain(formatCombatantName(ally))
    expect(text).toContain(formatMoveName(SKILL.id))
  })

  it('as repetições do treino nunca entram', () => {
    const { ally, wild } = setup()
    expect(
      texts(attackUsed({ entity: ally, attackId: SKILL.id, slot: 'training' })),
    ).toEqual([])
    expect(texts(resolved(ally, wild, { slot: 'training' }))).toEqual([])
  })

  it('acerto: o alvo e o dano arredondado, com crítico e efetividade', () => {
    const { ally, wild } = setup()
    const [plain] = texts(resolved(ally, wild))
    expect(plain).toContain(formatCombatantName(wild))
    expect(plain).toContain('7')

    const [strong] = texts(
      resolved(ally, wild, { critical: true, effectiveness: 'super' }),
    )
    expect(strong).not.toBe(plain)
    const [weak] = texts(resolved(ally, wild, { effectiveness: 'weak' }))
    expect(weak).not.toBe(plain)
  })

  it('imune, erro e golpe sem alvo têm a própria linha', () => {
    const { ally, wild } = setup()
    const immune = texts(resolved(ally, wild, { effectiveness: 'immune' }))
    const missed = texts(resolved(ally, wild, { missed: true }))
    const empty = texts(resolved(ally, null))
    for (const result of [immune, missed, empty]) {
      expect(result).toHaveLength(1)
    }
    expect(immune[0]).toContain(formatCombatantName(wild))
    expect(missed[0]).toContain(formatCombatantName(wild))
  })

  it('canalizado: uma linha só, no primeiro tick', () => {
    const { ally, wild } = setup()
    expect(
      texts(resolved(ally, wild, { channel: true, channelTick: 0 })),
    ).toHaveLength(1)
    expect(
      texts(resolved(ally, wild, { channel: true, channelTick: 3 })),
    ).toEqual([])
  })

  it('golpe de status não repete o que o atributo e a condição já dizem', () => {
    const { ally, wild } = setup()
    for (const statusSkill of listSkills().filter((skill) => !skill.damage)) {
      expect(
        texts(resolved(ally, wild, { attackId: statusSkill.id, status: true })),
      ).toEqual([])
    }
  })

  it('atributo, falha, desmaio, XP e golpe aprendido', () => {
    const { ally, wild, trainer, pokemon } = setup()
    expect(
      texts(
        statStageChanged({
          attacker: ally,
          target: wild,
          attackId: SKILL.id,
          stat: 'attack',
          delta: -1,
          stage: -1,
        }),
      ),
    ).toEqual([formatStatChangeLine('attack', -1, formatCombatantName(wild))])
    expect(
      texts(
        attackFailed({ entity: ally, attackId: SKILL.id, slot: 'secondary1' }),
      ),
    ).toHaveLength(1)
    expect(texts(creatureFainted({ entity: wild }))[0]).toContain(
      formatCombatantName(wild),
    )
    // na bola (sem `creature`): o nome vem do registro do Pokémon
    expect(
      texts(experienceGained({ trainer, pokemon, amount: 12.4 }))[0],
    ).toContain(formatSpeciesName('charmander'))
    const [learned] = texts(
      moveLearned({
        trainer,
        pokemon,
        creature: ally,
        moveId: SKILL.id,
        forgottenId: 'growl',
      }),
    )
    expect(learned).toContain(formatSpeciesName(SKILL.id))
    expect(learned).toContain(formatSpeciesName('growl'))
  })

  it('subir/cair muito usa outro texto que um estágio só', () => {
    expect(formatStatChangeLine('attack', -2, 'X')).not.toBe(
      formatStatChangeLine('attack', -1, 'X'),
    )
    expect(formatStatChangeLine('attack', 1, 'X')).not.toBe(
      formatStatChangeLine('attack', -1, 'X'),
    )
  })

  it.each(listConditions().map((condition) => condition.id))(
    'condição (%s): aplicada e cada tick, com o nome do alvo e o HP',
    (condition) => {
      const { ally, wild } = setup()
      const { feedback } = getCondition(condition)
      const applied = texts(
        conditionApplied({
          target: wild,
          source: ally,
          attackId: SKILL.id,
          condition,
        }),
      )
      const tick = texts(
        conditionTicked({ target: wild, source: ally, condition, damage: 3 }),
      )
      expect(applied).toHaveLength(feedback.applied ? 1 : 0)
      expect(tick).toHaveLength(feedback.tick ? 1 : 0)
      if (feedback.applied) {
        expect(applied[0]).toContain(formatCombatantName(wild))
      }
      if (feedback.tick) {
        expect(tick[0]).toContain(formatCombatantName(wild))
        expect(tick[0]).toContain('3')
      }
    },
  )

  it('condição aplicada num golpe de treino não entra', () => {
    const { ally, wild } = setup()
    expect(
      texts(
        conditionApplied({
          target: wild,
          source: ally,
          attackId: SKILL.id,
          slot: 'training',
          condition: 'burn',
        }),
      ),
    ).toEqual([])
  })

  it('evento desconhecido não entra', () => {
    expect(formatBattleLogEvent({ type: 'outro' })).toEqual([])
  })
})

describe('formatBattleLogEvent — itens no mundo (055)', () => {
  const [item] = listItems()
  const position = { x: 0, y: 0, z: 0 }

  it('pegar, colher e inventário cheio viram uma linha com o nome do item', () => {
    const events = [
      worldItemPicked({ itemId: item.id, amount: 1, position }),
      berriesHarvested({
        itemId: item.id,
        amount: 2,
        source: 'bush',
        position,
      }),
      inventoryFull({ itemId: item.id }),
    ]
    for (const event of events) {
      const lines = formatBattleLogEvent(event)
      expect(lines).toHaveLength(1)
      expect(lines[0].text).toContain(item.name)
    }
  })

  it('vasculhar sem achar nada vira uma linha', () => {
    const lines = formatBattleLogEvent(
      foragedNothing({ source: 'tree', position }),
    )
    expect(lines).toHaveLength(1)
  })
})
