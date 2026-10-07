import { afterEach, describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { attackUsed, creatureFainted } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { listSkills } from '@/core/data/skills'
import { WildCreature } from '@/core/traits'
import { battleLogStore } from '../registry/battleLogStore'
import { battleLogSystem } from './battleLogSystem'

const { MAX_LINES, IDLE_FADE_TIME } = GAME_CONFIG.FEEDBACK.BATTLE_LOG
const SKILL = listSkills()[0]

const worlds = []
afterEach(() => {
  battleLogStore.clear()
  while (worlds.length) worlds.pop().destroy()
})

function spawnWild() {
  const world = createWorld()
  worlds.push(world)
  return world.spawn(WildCreature({ speciesId: 'bulbasaur' }))
}

const used = (entity) =>
  attackUsed({ entity, attackId: SKILL.id, slot: 'secondary1' })

describe('battleLogSystem', () => {
  it('eventos viram linhas, na ordem, e o log aparece', () => {
    const wild = spawnWild()
    battleLogSystem({
      delta: 0,
      frameEvents: [used(wild), creatureFainted({ entity: wild })],
    })
    const { lines, visible } = battleLogStore.getSnapshot()
    expect(visible).toBe(true)
    expect(lines).toHaveLength(2)
    expect(lines[0].id).toBeLessThan(lines[1].id)
  })

  it('guarda só as MAX_LINES mais recentes', () => {
    const wild = spawnWild()
    const events = Array.from({ length: MAX_LINES + 3 }, () => used(wild))
    battleLogSystem({ delta: 0, frameEvents: events })
    expect(battleLogStore.getSnapshot().lines).toHaveLength(MAX_LINES)
  })

  it('apaga depois de IDLE_FADE_TIME sem mensagem, e volta com a próxima', () => {
    const wild = spawnWild()
    battleLogSystem({ delta: 0, frameEvents: [used(wild)] })
    const before = battleLogStore.getSnapshot()

    battleLogSystem({ delta: IDLE_FADE_TIME / 2, frameEvents: [] })
    // sem mudança visível, o snapshot é o mesmo (o HUD não re-renderiza)
    expect(battleLogStore.getSnapshot()).toBe(before)

    battleLogSystem({ delta: IDLE_FADE_TIME, frameEvents: [] })
    expect(battleLogStore.getSnapshot().visible).toBe(false)

    battleLogSystem({ delta: 0, frameEvents: [used(wild)] })
    expect(battleLogStore.getSnapshot().visible).toBe(true)
  })

  it('frame sem evento de combate não publica nada', () => {
    battleLogSystem({ delta: 0, frameEvents: [{ type: 'outro' }] })
    expect(battleLogStore.getSnapshot().lines).toEqual([])
  })
})
