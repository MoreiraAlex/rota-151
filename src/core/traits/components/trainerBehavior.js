import { trait } from 'koota'

/**
 * Como o TREINADOR se move numa luta quando NÃO está no controle (o jogador
 * pilota uma criatura) — `trainerBattleSystem.js`
 * (docs/features/034-ia-de-batalha.md, Parte 4):
 *
 * - `'follow'`: sem luta (ou no controle) — segue quem está no controle,
 *   como sempre (`creatureFollowSystem.js`).
 * - `'safe'`: indo/ficando na posição segura, atrás da criatura controlada,
 *   longe das selvagens.
 * - `'toTeam'`: uma selvagem está mirando ele — corre pra perto das criaturas
 *   do time.
 * - `'dodge'`: saindo do aviso vermelho de um golpe.
 *
 * Fora de `'follow'`, o `creatureFollowSystem` não move o treinador.
 *
 * `hasSafePoint`/`safeX`/`safeZ`: o ponto seguro escolhido, GUARDADO até
 * chegar ou ele ficar ruim — recalcular todo tick fazia o ponto girar junto
 * com a selvagem rodeando a criatura (Parte 2), e o treinador andava em
 * círculos atrás dele.
 *
 * Dono de escrita: `trainerBattleSystem.js`.
 */
export const TrainerBehavior = trait({
  state: 'follow',
  hasSafePoint: false,
  safeX: 0,
  safeZ: 0,
})
