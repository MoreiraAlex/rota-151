import { GAME_CONFIG } from '@/core/gameConfig'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import { getFlightLiftEntries } from '@/view/registry/flightLiftRegistry'

/**
 * Voo rasante (`species.body.flightHeight`, docs/features/059-as-10-
 * especies.md, Parte 16): andando ou correndo, o modelo sobe até a altura de
 * voo; nos outros estados, volta ao chão. O andar e o correr do Spearow são
 * o voo do Let's Go trazido até o chão pelo conversor
 * (`scripts/blender/convert-pokemon-lgpe.py`), e esta altura é ajustada aqui,
 * no jogo, sem reconverter o modelo.
 *
 * Só a view (o modelo): a cápsula, a colisão e o alcance dos golpes não
 * mudam. Lê o estado EXIBIDO (`stateId` do `animationRegistry`), não o
 * lógico, pra subir e descer junto da animação que está na tela.
 *
 * Fase: presentation, depois do `animationSystem`.
 */

const FLIGHT_STATES = new Set(['walk', 'run'])

/**
 * Próximo `lift`: aproxima-se da altura de voo (andando/correndo) ou de
 * zero (resto), sem passar do alvo.
 */
export function resolveFlightLift(
  lift,
  height,
  stateId,
  delta,
  speed = GAME_CONFIG.ANIMATION.FLIGHT_LIFT_SPEED,
) {
  const target = FLIGHT_STATES.has(stateId) ? height : 0
  const step = Math.min(1, speed * delta)
  return lift + (target - lift) * step
}

export function flightLiftSystem(context) {
  for (const [entity, entry] of getFlightLiftEntries()) {
    const stateId = getAnimatedBonesEntry(entity)?.stateId ?? null
    entry.lift = resolveFlightLift(
      entry.lift,
      entry.height,
      stateId,
      context.delta,
    )
    entry.object.position.y = entry.baseY + entry.lift
  }
}
