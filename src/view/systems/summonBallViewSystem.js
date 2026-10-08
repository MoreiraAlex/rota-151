import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem, resolveItemAnimations } from '@/core/data/items'
import {
  Party,
  Position,
  SummonBall,
  SummonBallOpen,
  Velocity,
} from '@/core/traits'
import { getBallView } from '../registry/ballViewRegistry'
import { playBallClip } from '../ballClipPlayer'
import { resolveVanishScale } from '../captureBallMotion'

/**
 * Anima as Pokébolas do invocar (docs/features/043-captura.md) com os
 * clipes do `.glb` (`item.model.animations`, ou os herdados por
 * `clipsFrom`):
 *
 * - em voo (`SummonBall`): o clipe de voo (`flying`) repetindo, virada pra
 *   onde vai;
 * - abrindo depois de pousar (`SummonBallOpen`): virada pro treinador, dá um
 *   pulinho (`SUMMON_BALL.HOP_*`), toca o `summon` encaixado em
 *   `SUMMON_BALL.OPEN_DURATION` e some encolhendo
 *   (`SUMMON_BALL.VANISH_DURATION`).
 *
 * Fase: presentation.
 */
export function summonBallViewSystem(context) {
  const { world, delta = 0 } = context

  world.query(SummonBall, Velocity).readEach(([, vel], entity) => {
    const entry = getBallView(entity)
    const spin = entry?.spinRef?.current
    if (!spin) return
    const clips = resolveItemAnimations(getItem(entry.itemId))
    playBallClip(
      entry,
      clips?.flying
        ? { key: 'flying', name: clips.flying, loop: true, fitTo: null }
        : null,
    )
    entry.mixer?.update(delta)
    spin.rotation.set(0, Math.atan2(vel.x, vel.z), 0)
  })

  const { HOP_HEIGHT, HOP_TIME, OPEN_DURATION, VANISH_DURATION } =
    GAME_CONFIG.SUMMON_BALL
  world.query(SummonBallOpen, Position).readEach(([open, pos], entity) => {
    const entry = getBallView(entity)
    const spin = entry?.spinRef?.current
    if (!spin) return
    const clips = resolveItemAnimations(getItem(open.itemId))
    playBallClip(
      entry,
      clips?.summon
        ? {
            key: 'summon',
            name: clips.summon,
            loop: false,
            fitTo: OPEN_DURATION,
          }
        : null,
    )
    entry.mixer?.update(delta)

    entry.yaw ??= resolveYawToTrainer(world, pos)
    const hop = HOP_TIME > 0 ? Math.min(1, open.elapsed / HOP_TIME) : 1
    spin.position.y = HOP_HEIGHT * (1 - (1 - hop) * (1 - hop))
    spin.rotation.set(0, entry.yaw, 0)
    const scale = resolveVanishScale(
      open.elapsed,
      OPEN_DURATION + VANISH_DURATION,
      VANISH_DURATION,
    )
    spin.scale.setScalar(Math.max(scale, 1e-4))
  })
}

/** Giro pra bola aberta encarar o treinador (o que invocou). */
function resolveYawToTrainer(world, pos) {
  const target = world.queryFirst(Party, Position)?.get(Position)
  return target ? Math.atan2(target.x - pos.x, target.z - pos.z) : 0
}
