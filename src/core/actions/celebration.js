import { GAME_CONFIG } from '../gameConfig'
import { getSpecies } from '../data/species'
import { ActionState, PendingCelebration, SummonedCreature } from '../traits'

/**
 * Comemoração ao subir de nível (docs/features/067-campo-de-treino-e-avisos-
 * de-nivel.md): a criatura do time em campo toca a animação happy (a ação
 * `'happy'`, pelo tempo de `species.actions.happy.duration`). Toca em
 * qualquer lugar, em combate também, mas qualquer ação do jogador corta
 * (`isPlayerActing`), assim como tomar dano e desmaiar.
 *
 * - `pedirComemoracao` — subiu de nível: espera ficar livre pra começar
 *   (`PendingCelebration`, até `EXPERIENCE.CELEBRATION_WAIT`).
 * - `comecarComemoracao` — entra na ação `'happy'` (chamada pelo
 *   `creatureCelebrationSystem` quando ela fica livre).
 * - `pararComemoracao` — corta a ação e o pedido.
 *
 * As que mexem no `ActionState` recebem o objeto opcionalmente (`action`),
 * pra quem chama de dentro de um `updateEach` que já itera `ActionState`.
 */

// Flags do input que são AÇÃO do jogador — tudo menos câmera e zoom.
const ACTING_FLAGS = [
  'forward',
  'back',
  'left',
  'right',
  'run',
  'ascend',
  'descend',
  'jump',
  'dash',
  'primary',
  'secondary',
  'secondaryHeld',
  'secondary1',
  'secondary2',
  'secondary3',
  'secondary1Held',
  'secondary2Held',
  'secondary3Held',
  'switchSlot1',
  'switchSlot2',
  'switchSlot3',
  'returnToBot',
  'interact',
  'fly',
]

/** O jogador fez alguma coisa neste tick (andar, golpe, pulo, troca...)? */
export function isPlayerActing(input) {
  if (!input) return false
  return ACTING_FLAGS.some((flag) => !!input[flag])
}

/** Quanto dura a comemoração da espécie (s); 0 = a espécie não comemora. */
export function resolveCelebrationDuration(speciesId) {
  return getSpecies(speciesId)?.actions?.happy?.duration ?? 0
}

/**
 * A criatura em campo `creature` subiu de nível: comemora assim que estiver
 * livre. Espécie sem `actions.happy` não comemora.
 */
export function pedirComemoracao(creature) {
  if (!creature?.isAlive?.() || !creature.has(SummonedCreature)) return false
  const { speciesId } = creature.get(SummonedCreature)
  if (!(resolveCelebrationDuration(speciesId) > 0)) return false
  const timeLeft = GAME_CONFIG.EXPERIENCE.CELEBRATION_WAIT
  if (creature.has(PendingCelebration)) {
    creature.set(PendingCelebration, { timeLeft })
  } else {
    creature.add(PendingCelebration({ timeLeft }))
  }
  return true
}

/** Entra na ação `'happy'` (quem chama já conferiu que ela está livre). */
export function comecarComemoracao(creature, action) {
  const { speciesId } = creature.get(SummonedCreature)
  const duration = resolveCelebrationDuration(speciesId)
  if (!(duration > 0)) return false
  action.current = 'happy'
  action.elapsed = 0
  action.animationSpeed = 1 / duration
  action.pendingSlot = null
  return true
}

/** Está comemorando agora (a ação `'happy'`)? */
export function isCelebrating(entity) {
  return entity?.get?.(ActionState)?.current === 'happy'
}

/**
 * Corta a comemoração de `creature` — a ação `'happy'` em andamento e o
 * pedido que ainda esperava. Devolve se havia algo pra cortar.
 */
export function pararComemoracao(creature, action = null) {
  if (!creature?.isAlive?.()) return false
  let stopped = false
  if (creature.has(PendingCelebration)) {
    creature.remove(PendingCelebration)
    stopped = true
  }
  const current = action ?? creature.get(ActionState)
  if (current?.current === 'happy') {
    if (action) {
      action.current = null
    } else {
      creature.set(ActionState, { current: null, elapsed: 0 })
    }
    stopped = true
  }
  return stopped
}
