import { GAME_CONFIG } from '../gameConfig'
import { WorldClock } from '../traits'

/**
 * Relógio do mundo (docs/features/048-dia-noite-e-clima.md), fase
 * `simulation`: anda `delta / DAY_LENGTH` dias de jogo por passo, vezes a
 * velocidade (`speed`). Como é passo fixo, pausado ele para.
 *
 * Escreve `WorldClock` (trait do mundo).
 */
export function worldClockSystem({ world, delta }) {
  if (!world.has(WorldClock)) return
  const clock = world.get(WorldClock)
  if (clock.speed === 0) return
  world.set(WorldClock, {
    ...clock,
    time: clock.time + (delta / GAME_CONFIG.DAY_CYCLE.DAY_LENGTH) * clock.speed,
  })
}
