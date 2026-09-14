'use client'

import { useTrait, useTag } from 'koota/react'
import { playerEntity, cameraEntity } from '@/core/world/world'
import {
  Position,
  Velocity,
  AnimationState,
  Grounded,
  OrbitCamera,
  CharacterController,
  MovementStats,
} from '@/core/traits'

/**
 * Painel de texto com estado ao vivo do jogador/câmera + config relevante
 * pra tunar. Lê via hooks do koota (fora do Canvas — o WorldProvider cobre a
 * página inteira). Ferramenta de debug: só monta quando o toggle está ligado
 * (ver src/app/(auth)/page.js), nunca requisito de gameplay.
 */
export function DebugPanel() {
  const position = useTrait(playerEntity, Position)
  const velocity = useTrait(playerEntity, Velocity)
  const anim = useTrait(playerEntity, AnimationState)
  const grounded = useTag(playerEntity, Grounded)
  const orbit = useTrait(cameraEntity, OrbitCamera)
  const body = useTrait(playerEntity, CharacterController)
  const movement = useTrait(playerEntity, MovementStats)

  if (!position || !velocity || !anim || !orbit || !body || !movement) {
    return null
  }

  const speed = Math.hypot(velocity.x, velocity.z)
  const capsuleHeight = 2 * (body.capsuleRadius + body.capsuleHalfHeight)

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 space-y-1 rounded bg-black/70 p-3 font-mono text-xs text-white">
      <p>
        pos: {position.x.toFixed(2)}, {position.y.toFixed(2)},{' '}
        {position.z.toFixed(2)}
      </p>
      <p>
        speed: {speed.toFixed(2)} u/s · {grounded ? 'no chão' : 'no ar'}
      </p>
      <p>anim: {anim.id}</p>
      <p>
        câmera: yaw {orbit.yaw.toFixed(2)} · pitch {orbit.pitch.toFixed(2)} ·
        dist {orbit.distance.toFixed(1)}
      </p>
      <hr className="border-white/20" />
      <p>
        cápsula: r={body.capsuleRadius} h={body.capsuleHalfHeight} (altura total{' '}
        {capsuleHeight.toFixed(2)})
      </p>
      <p>
        walk/run: {movement.walkSpeed}/{movement.runSpeed} u/s
      </p>
    </div>
  )
}
