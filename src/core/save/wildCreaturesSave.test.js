import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { listSpecies } from '../data/species'
import { nascerSelvagem } from '../actions/wildSpawn'
import { desmaiar } from '../actions/faint'
import {
  BeingCaptured,
  CreatureLevel,
  Fainted,
  IndividualValues,
  Position,
  Vitals,
  WildBehavior,
  WildCreature,
  WildSpawnInfo,
} from '../traits'
import { wildCreatureSaveSchema } from './saveFormat'
import {
  restoreWildCreatures,
  serializeWildCreatures,
} from './wildCreaturesSave'

// As selvagens no save (docs/features/062-spawn-estilo-cobblemon.md).
// Espécies só como dado de teste.

const [FIRST, SECOND] = listSpecies().filter((species) => species.spawn)

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world } = makeWorld()
  worlds.push(world)
  return world
}

const spawnAt = (world, species, position) =>
  nascerSelvagem(world, null, { speciesId: species.id, position })

describe('wildCreaturesSave', () => {
  it('ida e volta: a selvagem volta como estava', () => {
    const source = setup()
    const wild = spawnAt(source, FIRST, { x: 5, y: 1, z: -3 })
    wild.set(Vitals, { hp: 1 })
    wild.set(WildSpawnInfo, { age: 42 })
    desmaiar(source, wild)

    const saved = serializeWildCreatures(source)
    for (const entry of saved) {
      expect(wildCreatureSaveSchema.safeParse(entry).success).toBe(true)
    }

    const target = setup()
    restoreWildCreatures(target, saved)

    const [back] = target.query(WildCreature)
    expect(back.get(WildCreature).speciesId).toBe(FIRST.id)
    expect(back.get(Position)).toMatchObject({ x: 5, y: 1, z: -3 })
    expect(back.get(CreatureLevel)).toEqual(wild.get(CreatureLevel))
    expect(back.get(IndividualValues)).toEqual(wild.get(IndividualValues))
    expect(back.get(WildBehavior).temperament).toBe(
      wild.get(WildBehavior).temperament,
    )
    expect(back.get(Vitals).hp).toBe(wild.get(Vitals).hp)
    expect(back.get(WildSpawnInfo).age).toBe(42)
    expect(back.get(Fainted).timeLeft).toBe(wild.get(Fainted).timeLeft)
  })

  it('quem está dentro de uma Pokébola não vai para o save', () => {
    const world = setup()
    spawnAt(world, FIRST, { x: 0, y: 1, z: 0 })
    spawnAt(world, SECOND, { x: 1, y: 1, z: 0 }).add(BeingCaptured)

    const saved = serializeWildCreatures(world)

    expect(saved.map((entry) => entry.speciesId)).toEqual([FIRST.id])
  })

  it('o restore troca as selvagens que já tinham nascido pelas salvas', () => {
    const source = setup()
    spawnAt(source, SECOND, { x: 0, y: 1, z: 0 })
    const saved = serializeWildCreatures(source)

    const target = setup()
    const early = spawnAt(target, FIRST, { x: 9, y: 1, z: 9 })
    restoreWildCreatures(target, saved)

    expect(early.isAlive()).toBe(false)
    const ids = target
      .query(WildCreature)
      .map((entity) => entity.get(WildCreature).speciesId)
    expect(ids).toEqual([SECOND.id])
  })

  it('espécie que não existe mais fica de fora', () => {
    const source = setup()
    spawnAt(source, FIRST, { x: 0, y: 1, z: 0 })
    const [entry] = serializeWildCreatures(source)

    const target = setup()
    restoreWildCreatures(target, [{ ...entry, speciesId: 'nada' }])

    expect(target.query(WildCreature).length).toBe(0)
  })
})
