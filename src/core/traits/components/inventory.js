import { trait } from 'koota'

/**
 * Itens que o jogador carrega — lista simples de ids de
 * `core/data/items/`, com repetição servindo de "quantidade" (duas
 * poções = `['potion', 'potion']`), sem contador separado. Trait AoS (o
 * schema é uma função, não um objeto — koota exige isso pra campo que não é
 * primitivo, como um array): `get`/`set` leem/escrevem o objeto inteiro, não
 * campo por campo.
 *
 * Sem sistema de coleta/loja ainda — começa com um kit de teste (todos os
 * itens de `core/data/items/`), só pra validar o menu de equipamento/
 * inventário (ver docs/features/015-menu-de-pausa-e-configuracoes.md,
 * docs/features/017-inventario-em-grade.md) sem depender de outra feature
 * primeiro. `pebble` vem numa pilha grande (20) de propósito, pra dar pra
 * testar o consumo de verdade — arremessar várias vezes seguidas, ver a
 * contagem cair a cada uma, e o item sumir do inventário quando chega a
 * zero — sem só 1 unidade sumindo no primeiro arremesso. `pokedex`
 * (categoria `tool`, ver docs/features/029-*.md) vem numa unidade só —
 * não é algo que se empilha, é um dispositivo.
 *
 * Dono de escrita: `playerActionSystem` (remove um item da lista ao
 * arremessar/usar, o consumo de verdade do "estoque"); o menu de
 * equipamento só lê pra montar as opções do seletor de mão principal.
 */
export const Inventory = trait(() => ({
  itemIds: [
    ...Array(20).fill('pebble'),
    ...Array(50).fill('rock'),
    ...Array(5).fill('potion'),
    ...Array(3).fill('elixir'),
    'pokedex',
  ],
}))
