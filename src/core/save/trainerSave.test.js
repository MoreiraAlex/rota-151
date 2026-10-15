import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { listItems } from '../data/items'
import { listSpecies } from '../data/species'
import { adicionarItem } from '../actions/inventory'
import {
  CharacterController,
  HeldItem,
  Inventory,
  PokedexEntries,
  Position,
  Rotation,
  ScanHistory,
} from '../traits'
import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { wadeLimit } from '../terrain/water'
import { verticalClearance } from '../physics/capsule'
import { trainerSaveSchema } from './saveFormat'
import { restoreTrainer, serializeTrainer } from './trainerSave'

// O treinador no save (docs/features/044-salvar-o-jogo.md). Itens e espécies
// só como dado de teste.
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return { world, player }
}

function fillTrainer(world, player) {
  const [item, other] = listItems()
  const [species] = listSpecies()
  adicionarItem(world, player, item.id, 3)
  adicionarItem(world, player, other.id, 1)
  player.set(HeldItem, { itemId: item.id })
  player.set(PokedexEntries, { speciesIds: [species.id] })
  player.set(ScanHistory, {
    entries: [
      { id: 99, speciesId: species.id, individualValues: { hp: 1 }, level: 2 },
    ],
  })
  return { item, other, species }
}

describe('serializeTrainer / restoreTrainer', () => {
  it('ida e volta: inventário, item na mão e Pokédex', () => {
    const { world, player } = setup()
    fillTrainer(world, player)
    const saved = serializeTrainer(player)
    expect(trainerSaveSchema.safeParse(saved).success).toBe(true)

    const target = setup()
    restoreTrainer(target.player, saved)

    expect(target.player.get(Inventory)).toEqual(player.get(Inventory))
    expect(target.player.get(HeldItem)).toEqual(player.get(HeldItem))
    expect(target.player.get(PokedexEntries)).toEqual(
      player.get(PokedexEntries),
    )
    const strip = ({ speciesId, individualValues, level }) => ({
      speciesId,
      individualValues,
      level,
    })
    expect(target.player.get(ScanHistory).entries.map(strip)).toEqual(
      player.get(ScanHistory).entries.map(strip),
    )
  })

  it('volta na posição e direção salvas', () => {
    const { player } = setup()
    const position = { x: 3, y: TEST_LEVEL.terrain.heightAt(3, -4) + 5, z: -4 }
    player.set(Position, position)
    player.set(Rotation, { ...player.get(Rotation), y: 1.2 })
    const saved = serializeTrainer(player)

    const target = setup()
    restoreTrainer(target.player, saved)

    expect(target.player.get(Position)).toEqual(position)
    expect(target.player.get(Rotation).y).toBe(1.2)
  })

  it('posição salva dentro do relevo sobe para a superfície', () => {
    const { player } = setup()
    const ground = TEST_LEVEL.terrain.heightAt(3, -4)
    player.set(Position, { x: 3, y: ground - 2, z: -4 })
    const saved = serializeTrainer(player)

    const target = setup()
    restoreTrainer(target.player, saved)

    const { x, y, z } = target.player.get(Position)
    expect({ x, z }).toEqual({ x: 3, z: -4 })
    expect(y).toBeGreaterThan(ground)
  })

  // docs/features/057-lagos-e-rios.md
  const { WATER_LEVEL } = GAME_CONFIG.TERRAIN
  const depthAt = (x, z) => WATER_LEVEL - TEST_LEVEL.terrain.heightAt(x, z)
  const trainerLimit = (player) =>
    wadeLimit(verticalClearance(player.get(CharacterController)) * 2)
  // Um ponto do mundo da seed com a profundidade entre `min` e `max`.
  const waterPoint = (min, max) => {
    for (let x = 100; x < 3000; x += 3) {
      for (let z = -1500; z < 1500; z += 3) {
        const depth = depthAt(x, z)
        if (depth > min && depth < max) return { x, z }
      }
    }
    return null
  }
  const restoreAt = (point) => {
    const { player } = setup()
    player.set(Position, { x: point.x, y: WATER_LEVEL, z: point.z })
    const saved = serializeTrainer(player)
    const target = setup()
    restoreTrainer(target.player, saved)
    return target.player
  }

  it('posição salva além de onde o treinador entra vai para a margem (057)', () => {
    const limit = trainerLimit(setup().player)
    const deep = waterPoint(limit * 1.5, Infinity)
    expect(deep).not.toBeNull()

    const player = restoreAt(deep)
    const { x, y, z } = player.get(Position)
    expect(depthAt(x, z)).toBeLessThanOrEqual(0)
    expect(y).toBeGreaterThan(TEST_LEVEL.terrain.heightAt(x, z))
  })

  it('posição salva na água onde o treinador entra fica onde está (057)', () => {
    const limit = trainerLimit(setup().player)
    const shallow = waterPoint(limit * 0.3, limit * 0.8)
    expect(shallow).not.toBeNull()

    const { x, z } = restoreAt(shallow).get(Position)
    expect({ x, z }).toEqual(shallow)
  })

  it('save sem posição (de antes dela entrar) fica no ponto inicial', () => {
    const { player } = setup()
    const saved = serializeTrainer(player)
    delete saved.position
    expect(trainerSaveSchema.safeParse(saved).success).toBe(true)

    const target = setup()
    const start = { ...target.player.get(Position) }
    restoreTrainer(target.player, saved)

    expect(target.player.get(Position)).toEqual(start)
  })

  it('item que não existe mais fica de fora', () => {
    const { world, player } = setup()
    fillTrainer(world, player)
    const saved = serializeTrainer(player)
    saved.inventory.counts['nao-existe'] = 2
    saved.inventory.positions['nao-existe'] = 40

    const target = setup()
    restoreTrainer(target.player, saved)

    expect(target.player.get(Inventory).counts['nao-existe']).toBeUndefined()
    expect(target.player.get(Inventory).positions['nao-existe']).toBeUndefined()
  })

  it('save com poção (saíram na 055) carrega sem ela, nem na mão', () => {
    const { world, player } = setup()
    fillTrainer(world, player)
    const saved = serializeTrainer(player)
    // Os ids que os saves de antes da 055 guardavam.
    const oldPotions = ['potion', 'super-potion', 'hyper-potion']
    oldPotions.forEach((id, index) => {
      saved.inventory.counts[id] = 2
      saved.inventory.positions[id] = 40 + index
    })
    saved.heldItemId = 'potion'

    const target = setup()
    restoreTrainer(target.player, saved)

    for (const id of oldPotions) {
      expect(target.player.get(Inventory).counts[id]).toBeUndefined()
    }
    expect(target.player.get(HeldItem).itemId).toBe(null)
  })

  it('item na mão sem unidade no inventário não volta pra mão', () => {
    const { world, player } = setup()
    const { item } = fillTrainer(world, player)
    const saved = serializeTrainer(player)
    delete saved.inventory.counts[item.id]

    const target = setup()
    restoreTrainer(target.player, saved)

    expect(target.player.get(HeldItem).itemId).toBe(null)
  })
})
