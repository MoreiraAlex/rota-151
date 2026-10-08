import { afterEach, describe, expect, it } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import { listItems } from '../data/items'
import { listSpecies } from '../data/species'
import { adicionarItem } from '../actions/inventory'
import {
  HeldItem,
  Inventory,
  PokedexEntries,
  Position,
  Rotation,
  ScanHistory,
} from '../traits'
import { TEST_LEVEL } from '../data/testLevel'
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
