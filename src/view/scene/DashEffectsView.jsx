import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { verticalClearance } from '@/core/physics/colliders'
import {
  ActionState,
  CharacterController,
  Position,
  Rotation,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { buildDashEmitters, DASH_TEXTURE_PATHS } from '@/view/vfx/dashVfx'
import { createFollowEffectManager } from '@/view/vfx/followEffectManager'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

/**
 * Efeito de dash de TODA criatura que dá dash (o treinador, as criaturas
 * controladas): linhas de velocidade enquanto o dash dura e poeira no chão na
 * saída (ver `view/vfx/dashVfx.js`). Só LÊ o ECS: a cada frame olha quem está
 * com `ActionState.current === 'dash'` e deixa `createFollowEffectManager`
 * criar, acompanhar e encerrar o efeito de cada um — `useFrame` aqui é a
 * exceção documentada de componente puramente visual, igual ao
 * `AttackTelegraphView`.
 *
 * O efeito vive no espaço do MUNDO (o `<group>` está na raiz da cena): as
 * partículas nascem na posição da criatura naquele instante e ficam pra trás
 * conforme ela corre. `GAME_CONFIG.FEEDBACK.DASH_EFFECT` liga/desliga e escala.
 */
export function DashEffectsView() {
  const { ENABLED, SCALE, LINE_RATE, LINE_LENGTH, LINE_THICKNESS, DUST_COUNT } =
    GAME_CONFIG.FEEDBACK.DASH_EFFECT
  const textures = useTexture(DASH_TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  useEffect(() => {
    const emitters = buildDashEmitters({
      lineRate: LINE_RATE,
      lineLength: LINE_LENGTH,
      lineThickness: LINE_THICKNESS,
      dustCount: DUST_COUNT,
    })
    const manager = createFollowEffectManager({
      root: rootRef.current,
      createSystem: () =>
        createParticleSystem({
          emitters,
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
  }, [textures, SCALE, LINE_RATE, LINE_LENGTH, LINE_THICKNESS, DUST_COUNT])

  useFrame((state, delta) => {
    const manager = managerRef.current
    if (!manager || !ENABLED) return

    const dashers = []
    world.query(ActionState, Position, Rotation).forEach((entity) => {
      const action = entity.get(ActionState)
      const pos = entity.get(Position)
      const body = entity.has(CharacterController)
        ? entity.get(CharacterController)
        : null
      const clearance = body ? verticalClearance(body) : 0
      dashers.push({
        key: entity,
        active: action.current === 'dash',
        // nos pés; o corpo se estende `2 * clearance` pra cima
        origin: [pos.x, pos.y - clearance, pos.z],
        // pra onde o dash VAI (travada no disparo), não pra onde o corpo olha agora
        yaw: Math.atan2(action.dirX, action.dirZ),
        height: clearance * 2,
      })
    })

    manager.update(dashers, Math.min(delta, MAX_STEP), state.camera.position)
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(DASH_TEXTURE_PATHS))
