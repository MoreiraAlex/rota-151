import { FOX } from '../fox'

/**
 * Placeholder de criatura de time — clone de `fox` (mesmo model/clips/body/
 * movement), só com `id` diferente. Serve pra equipar em `Party.slot2`
 * (ver docs/features/013-criaturas-de-time.md), não é conteúdo de jogo de
 * verdade. Sem tint de cor ainda — nada é renderizado no mundo nesta versão.
 */
export const FOX_GREEN = {
  ...FOX,
  id: 'fox-green',
}
