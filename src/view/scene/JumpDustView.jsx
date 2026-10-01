import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { verticalClearance } from '@/core/physics/colliders'
import {
  CharacterController,
  Grounded,
  Position,
  Velocity,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import {
  buildJumpDustEmitters,
  JUMP_DUST_TEXTURE_PATHS,
} from '@/view/vfx/jumpDustVfx'
import { createJumpDustManager } from '@/view/vfx/jumpDustManager'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

/**
 * Poeira de pulo de TODA criatura (jogador, time, selvagens): um anel no chão
 * na decolagem de um pulo e na aterrissagem de qualquer queda (ver
 * `view/vfx/jumpDustVfx.js`). Só LÊ o ECS (`Grounded` + `Velocity`) e deixa
 * `createJumpDustManager` decidir quando soltar e com que força — `useFrame`
 * aqui é a exceção documentada de componente puramente visual, igual a
 * `DashEffectsView`. `GAME_CONFIG.FEEDBACK.JUMP_DUST` liga/desliga e ajusta.
 */
export function JumpDustView() {
  const {
    ENABLED,
    SCALE,
    MIN_FALL_SPEED,
    MAX_FALL_SPEED,
    TAKEOFF_COUNT,
    LANDING_COUNT_MIN,
    LANDING_COUNT_MAX,
  } = GAME_CONFIG.FEEDBACK.JUMP_DUST
  const textures = useTexture(JUMP_DUST_TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  useEffect(() => {
    const manager = createJumpDustManager({
      root: rootRef.current,
      minSpeed: MIN_FALL_SPEED,
      maxSpeed: MAX_FALL_SPEED,
      createSystem: ({ kind, strength }) =>
        createParticleSystem({
          emitters: buildJumpDustEmitters({
            count:
              kind === 'takeoff'
                ? TAKEOFF_COUNT
                : Math.round(
                    LANDING_COUNT_MIN +
                      (LANDING_COUNT_MAX - LANDING_COUNT_MIN) * strength,
                  ),
            // queda forte: espalha mais rápido e as nuvens são maiores
            speed: 1.2 + strength * 1.2,
            size: 0.35 + strength * 0.25,
          }),
          textures,
          length: 0,
          radius: 0,
          scale: SCALE,
        }),
    })
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [
    textures,
    SCALE,
    MIN_FALL_SPEED,
    MAX_FALL_SPEED,
    TAKEOFF_COUNT,
    LANDING_COUNT_MIN,
    LANDING_COUNT_MAX,
  ])

  useFrame((state, delta) => {
    const manager = managerRef.current
    if (!manager || !ENABLED) return

    const creatures = []
    world.query(Position, Velocity, CharacterController).forEach((entity) => {
      const pos = entity.get(Position)
      const clearance = verticalClearance(entity.get(CharacterController))
      creatures.push({
        entity,
        grounded: entity.has(Grounded),
        vy: entity.get(Velocity).y,
        // nos pés
        position: [pos.x, pos.y - clearance, pos.z],
      })
    })

    manager.update(creatures, Math.min(delta, MAX_STEP))
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(JUMP_DUST_TEXTURE_PATHS))
