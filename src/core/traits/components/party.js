import { trait } from 'koota'

/**
 * Criatura (id de espécie) equipada em cada slot secundário do treinador —
 * `secondary1/2/3` (ver docs/features/011-slots-de-acao.md). Mesmo nível de
 * indireção que `HeldItem.itemId`: guarda o id da espécie, não uma
 * referência de entidade — não existe entidade de criatura nenhuma ainda
 * (invocar/recolher de verdade é feature futura).
 *
 * Começa toda vazia — sem sistema de captura ainda, só o seletor de debug
 * (`DebugPanel`) equipa algo, pra validar o mecanismo (ver
 * docs/features/013-criaturas-de-time.md).
 */
export const Party = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})
