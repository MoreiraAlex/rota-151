import { trait } from 'koota'

/**
 * Item que a entidade está segurando — `itemId` de `core/data/items/`, ou
 * `null` de mãos vazias. Começa vazio: sem sistema de coleta ainda, só o
 * seletor de debug (`DebugPanel`) equipa algo, pra validar o mecanismo
 * (ver docs/features/012-mecanismo-de-item.md).
 *
 * Ninguém lê isso pra decidir uma ação ainda — `primary` (botão de item, ver
 * docs/features/011-slots-de-acao.md) continua sem comportamento até a
 * próxima feature.
 */
export const HeldItem = trait({
  itemId: null,
})
