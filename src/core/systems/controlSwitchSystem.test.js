import { describe, it, expect } from 'vitest'
import { givePartyPokemon, makeWorld, ownedByPlayer } from '@/test/makeWorld'
import { findPartyPokemon } from '@/core/actions/pokemon'
import { comecarAComer } from '@/core/actions/eating'
import { listItems } from '@/core/data/items'
import {
  ActionState,
  CameraTarget,
  InputControlled,
  PARTY_SLOT_IDS,
  Party,
  SummonedCreature,
  Vitals,
} from '@/core/traits'
import { controlSwitchSystem } from './controlSwitchSystem'

function tick(world, input = {}) {
  controlSwitchSystem({ world, input })
}

function spawnCreature(world, slot) {
  return world.spawn(
    SummonedCreature({ slot, speciesId: 'bulbasaur' }),
    ...ownedByPlayer(world),
  )
}

describe('controlSwitchSystem', () => {
  it('switchSlot1 com a criatura do slot1 invocada troca InputControlled/CameraTarget pra ela', () => {
    const { world, player } = makeWorld()
    const creature = spawnCreature(world, 'slot1')

    tick(world, { switchSlot1: true })

    expect(player.has(InputControlled)).toBe(false)
    expect(player.has(CameraTarget)).toBe(false)
    expect(creature.has(InputControlled)).toBe(true)
    expect(creature.has(CameraTarget)).toBe(true)
  })

  it('switchSlot com slot vazio (nenhuma criatura invocada) é no-op', () => {
    const { world, player } = makeWorld()

    tick(world, { switchSlot2: true })

    expect(player.has(InputControlled)).toBe(true)
    expect(player.has(CameraTarget)).toBe(true)
  })

  it('de uma criatura controlada, switchSlot de OUTRA criatura invocada troca direto, sem passar pelo treinador', () => {
    const { world, player } = makeWorld()
    const creatureA = spawnCreature(world, 'slot1')
    const creatureB = spawnCreature(world, 'slot2')
    creatureA.add(InputControlled, CameraTarget)
    player.remove(InputControlled, CameraTarget)

    tick(world, { switchSlot2: true })

    expect(creatureA.has(InputControlled)).toBe(false)
    expect(creatureA.has(CameraTarget)).toBe(false)
    expect(creatureB.has(InputControlled)).toBe(true)
    expect(creatureB.has(CameraTarget)).toBe(true)
    expect(player.has(InputControlled)).toBe(false)
  })

  it('returnToBot com uma criatura controlada devolve InputControlled/CameraTarget pro treinador', () => {
    const { world, player } = makeWorld()
    const creature = spawnCreature(world, 'slot1')
    creature.add(InputControlled, CameraTarget)
    player.remove(InputControlled, CameraTarget)

    tick(world, { returnToBot: true })

    expect(player.has(InputControlled)).toBe(true)
    expect(player.has(CameraTarget)).toBe(true)
    expect(creature.has(InputControlled)).toBe(false)
    expect(creature.has(CameraTarget)).toBe(false)
  })

  it('returnToBot já com o treinador no controle é no-op', () => {
    const { world, player } = makeWorld()

    tick(world, { returnToBot: true })

    expect(player.has(InputControlled)).toBe(true)
    expect(player.has(CameraTarget)).toBe(true)
  })

  it('switchSlot pro slot da própria criatura já controlada é no-op', () => {
    const { world, player } = makeWorld()
    const creature = spawnCreature(world, 'slot1')
    creature.add(InputControlled, CameraTarget)
    player.remove(InputControlled, CameraTarget)

    tick(world, { switchSlot1: true })

    expect(creature.has(InputControlled)).toBe(true)
    expect(creature.has(CameraTarget)).toBe(true)
    expect(player.has(InputControlled)).toBe(false)
  })

  it('trocar de controle não mexe no time nem cria/destrói nenhuma entidade', () => {
    const { world, player } = makeWorld()
    const party = givePartyPokemon(world, player, { slot1: 'charmander' })
    spawnCreature(world, 'slot1')
    const countBefore = world.query(SummonedCreature).length

    tick(world, { switchSlot1: true })

    for (const slot of PARTY_SLOT_IDS) {
      expect(findPartyPokemon(player, slot)).toBe(party[slot] ?? null)
    }
    expect(world.query(SummonedCreature).length).toBe(countBefore)
  })

  it('sem input nenhum, não troca nada', () => {
    const { world, player } = makeWorld()
    spawnCreature(world, 'slot1')

    tick(world, {})

    expect(player.has(InputControlled)).toBe(true)
  })

  it('sem treinador no world (nenhum Party), não quebra', () => {
    const { world } = makeWorld()
    world.queryFirst(Party).destroy()

    expect(() => tick(world, { switchSlot1: true })).not.toThrow()
  })

  it('o treinador comendo não troca o controle (docs/features/042-itens-da-beta.md)', () => {
    const { world, player } = makeWorld()
    const creature = spawnCreature(world, 'slot1')
    const vitals = player.get(Vitals)
    player.set(Vitals, { ...vitals, hp: vitals.maxHp / 2 })
    comecarAComer(
      player,
      listItems().find((item) => item.category === 'berry'),
    )

    tick(world, { switchSlot1: true })

    expect(player.has(InputControlled)).toBe(true)
    expect(creature.has(InputControlled)).toBe(false)
  })

  it('a criatura comendo devolve o controle pro treinador, mas não troca pra outra criatura', () => {
    const { world, player } = makeWorld()
    const eater = spawnCreature(world, 'slot1')
    const other = spawnCreature(world, 'slot2')
    eater.add(ActionState({ current: 'eat' }))
    eater.add(InputControlled, CameraTarget)
    player.remove(InputControlled, CameraTarget)

    tick(world, { switchSlot2: true })
    expect(eater.has(InputControlled)).toBe(true)
    expect(other.has(InputControlled)).toBe(false)

    tick(world, { returnToBot: true })
    expect(player.has(InputControlled)).toBe(true)
    expect(eater.has(InputControlled)).toBe(false)
  })
})
