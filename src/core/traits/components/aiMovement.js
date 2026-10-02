import { trait } from 'koota'

/**
 * Estado do movimento da IA NA LUTA — selvagem perseguindo e criatura do time
 * lutando (`core/battle/aiMovement.js`, chamado por `wildBehaviorSystem.js` e
 * `partyBehaviorSystem.js`). Posto no spawn junto de `WildBehavior`
 * (`wildCreatureSpawnSystem.js`) e de `PartyBehavior` (`summonBallSystem.js`).
 *
 * - `mode`: o que fez neste tick — `'approach'` (corre até o alcance),
 *   `'dodge'` (saindo do aviso de um golpe), `'retreat'` (recuando, golpe à
 *   distância com o alvo perto), `'strafe'` (rodeando o alvo), `'dash'`, `'aim'`
 *   (parada, virando pro alvo antes de pedir o golpe) ou `null` (parada,
 *   virada pro alvo). Lido pelos systems (não pedem golpe em
 *   `'dodge'`/`'dash'`/`'aim'`) e pelo debug (F2).
 * - `dodgeAttacker` / `dodgeReact`: o golpe vindo nela já sorteado (quem está
 *   carregando) e se ela decidiu reagir — sorteio UMA vez por golpe
 *   (`AI_MOVEMENT.DODGE_CHANCE`); sem golpe vindo, volta a `null`.
 * - `strafeSign` / `strafeTimer`: sentido em que rodeia o alvo (1 ou -1) e
 *   quanto falta pra trocar.
 * - `dashTimer` (s): quanto falta pra poder dar outro dash.
 *
 * Dono de escrita: `core/battle/aiMovement.js`.
 */
export const AiMovement = trait({
  mode: null,
  dodgeAttacker: null,
  dodgeReact: false,
  strafeSign: 1,
  strafeTimer: 0,
  dashTimer: 0,
})
