import { afterEach, describe, expect, it } from 'vitest'
import { givePokemon, makeWorld } from '@/test/makeWorld'
import { ITEM_CATEGORY_ORDER, getItem, listItems } from '../data/items'
import { getSpecies } from '../data/species'
import { HeldItem, Inventory, InventoryCell, Pokemon } from '../traits'
import {
  adicionarItem,
  countItem,
  desequiparMao,
  equiparNaMao,
  gastarItem,
  moverNoInventario,
  organizarInventario,
  resolveInventoryCells,
} from './inventory'
import { colocarNoTime, tirarDoTime } from './pokemon'

// Itens com quantidade numa grade de posição livre, dividida com os Pokémon
// fora do time (docs/features/041-inventario-de-itens-e-pokemon.md). Itens e
// espécies são só dado de teste: qualquer um do registro serve.
const [ITEM_ID, OTHER_ITEM_ID] = listItems().map((item) => item.id)
const SPECIES_ID = 'charmander'

const worlds = []
afterEach(() => {
  while (worlds.length) worlds.pop().destroy()
})

function setup() {
  const { world, player } = makeWorld()
  worlds.push(world)
  return { world, player }
}

/** Índice → descrição curta da entrada, pra comparar a grade inteira. */
function describeCells(world, player) {
  const cells = {}
  for (const [index, entry] of resolveInventoryCells(world, player)) {
    cells[index] = entry.kind === 'item' ? entry.id : entry.pokemon
  }
  return cells
}

describe('quantidade', () => {
  it('começa vazio no treinador de teste', () => {
    const { player } = setup()
    expect(player.get(Inventory).counts).toEqual({})
    expect(countItem(player, ITEM_ID)).toBe(0)
  })

  it('adicionar soma na quantidade, sem limite', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID)
    adicionarItem(world, player, ITEM_ID, 1000)
    expect(countItem(player, ITEM_ID)).toBe(1001)
  })

  it('gastar tira uma unidade; zerou, o item sai do mapa e da grade', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID, 2)

    expect(gastarItem(player, ITEM_ID)).toBe(1)
    expect(gastarItem(player, ITEM_ID)).toBe(0)
    expect(player.get(Inventory).counts).not.toHaveProperty(ITEM_ID)
    expect(player.get(Inventory).positions).not.toHaveProperty(ITEM_ID)
  })

  it('gastar o que não tem não muda nada', () => {
    const { player } = setup()
    expect(gastarItem(player, ITEM_ID)).toBe(null)
    expect(player.get(Inventory).counts).toEqual({})
  })
})

describe('grade', () => {
  it('cada coisa nova entra na primeira célula livre, itens e Pokémon juntos', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID)
    const pokemon = givePokemon(world, player, SPECIES_ID)
    adicionarItem(world, player, OTHER_ITEM_ID)

    expect(describeCells(world, player)).toEqual({
      0: ITEM_ID,
      1: pokemon,
      2: OTHER_ITEM_ID,
    })
  })

  it('mover pra uma célula vazia deixa buraco na de origem', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID)

    moverNoInventario(world, player, { kind: 'item', id: ITEM_ID }, 7)

    expect(describeCells(world, player)).toEqual({ 7: ITEM_ID })
  })

  it('mover sobre uma célula ocupada troca as duas de lugar', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID)
    const pokemon = givePokemon(world, player, SPECIES_ID)

    moverNoInventario(world, player, { kind: 'creature', pokemon }, 0)

    expect(describeCells(world, player)).toEqual({ 0: pokemon, 1: ITEM_ID })
  })

  it('a única unidade na mão some da grade e volta ao desequipar', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID)

    expect(equiparNaMao(world, player, ITEM_ID)).toBe(true)
    expect(player.get(HeldItem).itemId).toBe(ITEM_ID)
    expect(describeCells(world, player)).toEqual({})

    desequiparMao(world, player, 4)
    expect(player.get(HeldItem).itemId).toBe(null)
    expect(describeCells(world, player)).toEqual({ 4: ITEM_ID })
  })

  it('com mais de uma unidade, o item continua na grade com a mão cheia', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID, 2)
    equiparNaMao(world, player, ITEM_ID)
    expect(describeCells(world, player)).toEqual({ 0: ITEM_ID })
  })

  it('trocar o item da mão devolve o anterior pra grade', () => {
    const { world, player } = setup()
    adicionarItem(world, player, ITEM_ID)
    adicionarItem(world, player, OTHER_ITEM_ID)
    equiparNaMao(world, player, ITEM_ID)

    equiparNaMao(world, player, OTHER_ITEM_ID)

    const cells = Object.values(describeCells(world, player))
    expect(cells).toEqual([ITEM_ID])
  })

  it('não equipa o que não tem', () => {
    const { world, player } = setup()
    expect(equiparNaMao(world, player, ITEM_ID)).toBe(false)
    expect(player.get(HeldItem).itemId).toBe(null)
  })

  it('Pokémon que entra no time larga a célula; o que sai pega uma', () => {
    const { world, player } = setup()
    const pokemon = givePokemon(world, player, SPECIES_ID)

    colocarNoTime(player, pokemon, 'slot1')
    expect(pokemon.has(InventoryCell)).toBe(false)

    tirarDoTime(world, player, pokemon, 3)
    expect(describeCells(world, player)).toEqual({ 3: pokemon })
  })

  it('soltar um do time sobre um Pokémon da grade troca os dois', () => {
    const { world, player } = setup()
    const inTeam = givePokemon(world, player, SPECIES_ID, 'slot1')
    const inGrid = givePokemon(world, player, SPECIES_ID)
    const cell = inGrid.get(InventoryCell).index

    tirarDoTime(world, player, inTeam, cell)

    expect(describeCells(world, player)).toEqual({ [cell]: inTeam })
    expect(inGrid.has(InventoryCell)).toBe(false)
  })

  it('organizar fecha os buracos: itens por categoria, depois Pokémon por número da Pokédex', () => {
    const { world, player } = setup()
    for (const item of listItems()) adicionarItem(world, player, item.id)
    const species = ['squirtle', 'bulbasaur', 'charmander']
    for (const id of species) givePokemon(world, player, id)
    moverNoInventario(world, player, { kind: 'item', id: ITEM_ID }, 40)

    organizarInventario(world, player)

    const cells = [...resolveInventoryCells(world, player).entries()].sort(
      ([a], [b]) => a - b,
    )
    expect(cells.map(([index]) => index)).toEqual(cells.map((_, i) => i))

    const entries = cells.map(([, entry]) => entry)
    const items = entries.filter((entry) => entry.kind === 'item')
    const pokemon = entries.filter((entry) => entry.kind === 'creature')
    expect(entries).toEqual([...items, ...pokemon])

    const ranks = items.map((entry) =>
      ITEM_CATEGORY_ORDER.indexOf(getItem(entry.id).category),
    )
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))

    const dex = pokemon.map(
      (entry) => getSpecies(entry.pokemon.get(Pokemon).speciesId).dexNumber,
    )
    expect(dex).toEqual([...dex].sort((a, b) => a - b))
  })
})
