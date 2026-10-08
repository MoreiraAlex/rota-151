import { afterEach, describe, expect, it } from 'vitest'
import { givePokemon, makeWorld } from '@/test/makeWorld'
import { snapshotSave } from '../save'
import { listOwnedPokemon, resolvePartySlot } from './pokemon'
import {
  Inventory,
  InventoryCell,
  Pokemon,
  SaveRequested,
  TrainerReady,
  WorldClock,
} from '../traits'
import { aplicarSave, pedirSave, prepararTreinador } from './save'
import { TEST_LEVEL } from '../data/testLevel'
import { GAME_CONFIG } from '../gameConfig'
import { definirHorario } from './environment'

// Salvar e carregar (docs/features/044-salvar-o-jogo.md). Espécies só como
// dado de teste.
const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

// Acima do chão da origem: abaixo dele o save sobe o treinador para a
// superfície (docs/features/045-terreno-de-um-chunk.md).
function setup() {
  const { world, player } = makeWorld({
    playerPosition: { x: 0, y: TEST_LEVEL.terrain.heightAt(0, 0) + 5, z: 0 },
  })
  worlds.push(world)
  return { world, player }
}

function placeOf(trainer, pokemon) {
  return resolvePartySlot(trainer, pokemon) ?? pokemon.get(InventoryCell).index
}

describe('prepararTreinador', () => {
  it('sem save: dá o kit inicial e já pede um save', () => {
    const { world, player } = setup()

    expect(prepararTreinador(world, player, null)).toBe(true)

    expect(listOwnedPokemon(world, player).length).toBeGreaterThan(0)
    expect(Object.keys(player.get(Inventory).counts).length).toBeGreaterThan(0)
    expect(player.has(SaveRequested)).toBe(true)
    expect(player.has(TrainerReady)).toBe(true)
  })

  it('com save: volta como estava, sem o kit', () => {
    const source = setup()
    prepararTreinador(source.world, source.player, null)
    const save = snapshotSave(source.world, source.player)

    const { world, player } = setup()
    prepararTreinador(world, player, save)

    expect(snapshotSave(world, player)).toEqual(save)
    expect(player.has(SaveRequested)).toBe(false)
  })

  it('só prepara uma vez', () => {
    const { world, player } = setup()
    prepararTreinador(world, player, null)
    const count = listOwnedPokemon(world, player).length

    expect(prepararTreinador(world, player, null)).toBe(false)
    expect(listOwnedPokemon(world, player).length).toBe(count)
  })
})

describe('horário do mundo no save (docs/features/048-*.md)', () => {
  it('o horário vai no save e volta ao carregar', () => {
    const source = setup()
    prepararTreinador(source.world, source.player, null)
    definirHorario(source.world, 3.6)
    const save = snapshotSave(source.world, source.player)
    expect(save.trainer.worldTime).toBe(3.6)

    const { world, player } = setup()
    prepararTreinador(world, player, save)
    expect(world.get(WorldClock).time).toBe(3.6)
  })

  it('save sem horário (antigo) começa no horário inicial', () => {
    const source = setup()
    prepararTreinador(source.world, source.player, null)
    const save = snapshotSave(source.world, source.player)
    delete save.trainer.worldTime

    const { world, player } = setup()
    prepararTreinador(world, player, save)
    expect(world.get(WorldClock).time).toBe(GAME_CONFIG.DAY_CYCLE.START_TIME)
  })
})

describe('aplicarSave', () => {
  it('cada Pokémon volta no lugar salvo, inclusive com células fora de ordem', () => {
    const source = setup()
    const a = givePokemon(source.world, source.player, 'charmander')
    const b = givePokemon(source.world, source.player, 'bulbasaur')
    const c = givePokemon(source.world, source.player, 'squirtle', 'slot2')
    a.set(InventoryCell, { index: 4 })
    b.set(InventoryCell, { index: 0 })
    const save = snapshotSave(source.world, source.player)

    const { world, player } = setup()
    aplicarSave(world, player, save)

    const byUid = new Map(
      listOwnedPokemon(world, player).map((p) => [p.get(Pokemon).uid, p]),
    )
    for (const original of [a, b, c]) {
      const restored = byUid.get(original.get(Pokemon).uid)
      expect(placeOf(player, restored)).toBe(placeOf(source.player, original))
    }
  })
})

describe('pedirSave', () => {
  it('põe o pedido e não acumula', () => {
    const { player } = setup()
    pedirSave(player)
    pedirSave(player)
    expect(player.has(SaveRequested)).toBe(true)
  })
})
