import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { world } from '@/core/world/world'
import { verticalClearance } from '@/core/physics/colliders'
import {
  Burn,
  CharacterController,
  Fainted,
  Position,
  Rotation,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { createFollowEffectManager } from '@/view/vfx/followEffectManager'
import { BURN_EMITTERS, BURN_TEXTURE_PATHS } from '@/view/vfx/burnVfx'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

/**
 * Efeitos das CONDIÇÕES de status em quem as tem (docs/features/039-tipos-e-combate-classico.md, Parte 4) — hoje o fogo da queimadura (`Burn`,
 * `burnVfx.js`), que acompanha a criatura enquanto ela estiver queimada e
 * para quando apaga ou ela desmaia.
 *
 * Só LÊ o ECS e deixa `createFollowEffectManager` criar, acompanhar e
 * encerrar cada efeito. `useFrame` aqui é a exceção documentada de
 * componente puramente visual, igual a `ContinuousAttackEffectsView`.
 */
export function StatusConditionEffectsView() {
  const textures = useTexture(BURN_TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  useEffect(() => {
    const manager = createFollowEffectManager({
      root: rootRef.current,
      createSystem: ({ radius }) =>
        createParticleSystem({
          emitters: BURN_EMITTERS,
          textures,
          length: 0,
          radius,
          scale: 1,
        }),
    })
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [textures])

  useFrame((state, delta) => {
    const manager = managerRef.current
    if (!manager) return

    const followers = []
    world
      .query(Burn, CharacterController, Position, Rotation)
      .forEach((entity) => {
        const body = entity.get(CharacterController)
        const pos = entity.get(Position)
        const clearance = verticalClearance(body)
        followers.push({
          key: `${entity}:burn`,
          active: !entity.has(Fainted),
          radius: body.capsuleRadius,
          // nos pés; o corpo se estende `2 * clearance` pra cima
          origin: [pos.x, pos.y - clearance, pos.z],
          yaw: entity.get(Rotation).y,
          height: clearance * 2,
        })
      })

    manager.update(followers, Math.min(delta, MAX_STEP), state.camera.position)
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(BURN_TEXTURE_PATHS))
