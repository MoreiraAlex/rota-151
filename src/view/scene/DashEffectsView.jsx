import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { verticalClearance } from '@/core/physics/colliders'
import {
  ActionState,
  CharacterController,
  Flying,
  Position,
  Rotation,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { buildDashEmitters, DASH_TEXTURE_PATHS } from '@/view/vfx/dashVfx'
import { createFollowEffectManager } from '@/view/vfx/followEffectManager'
import { levelWaterDepthAt } from '@/core/actions/water'
import { addFootRipple } from '@/view/water/footRipples'

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
 * A poeira da saída é a do pulo (do tamanho dela, `JUMP_DUST.SCALE`); com os
 * pés na água no começo do dash, o respingo na superfície
 * (docs/features/057-lagos-e-rios.md). Voando (`Flying`, docs/features/060-
 * ajustes-por-especie.md), sem chão: só as linhas, inclinadas na direção do
 * dash (`pitch`), e as ondas de ar (`DASH_EFFECT.AIR_WAVES`).
 */
export function DashEffectsView() {
  const {
    ENABLED,
    SCALE,
    LINE_RATE,
    LINE_LENGTH,
    LINE_THICKNESS,
    DUST_COUNT,
    AIR_WAVES,
  } = GAME_CONFIG.FEEDBACK.DASH_EFFECT
  const textures = useTexture(DASH_TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  const JUMP_SCALE = GAME_CONFIG.FEEDBACK.JUMP_DUST.SCALE

  useEffect(() => {
    const options = {
      lineRate: LINE_RATE,
      lineLength: LINE_LENGTH,
      lineThickness: LINE_THICKNESS,
      dustCount: DUST_COUNT,
      groundScale: JUMP_SCALE / SCALE,
    }
    const dry = buildDashEmitters(options)
    const wet = buildDashEmitters({ ...options, water: true })
    const air = buildDashEmitters({
      ...options,
      air: true,
      airWaves: AIR_WAVES,
    })
    const manager = createFollowEffectManager({
      root: rootRef.current,
      createSystem: ({ water, flying, origin }) => {
        // Na água, um anel na superfície junto do respingo.
        if (water && !flying) {
          addFootRipple(
            origin[0],
            GAME_CONFIG.TERRAIN.WATER_LEVEL,
            origin[2],
            GAME_CONFIG.FEEDBACK.WATER_SPLASH.RING_SIZE,
          )
        }
        return createParticleSystem({
          emitters: flying ? air : water ? wet : dry,
          textures,
          length: 0,
          radius: 0,
          scale: SCALE,
        })
      },
    })
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [
    textures,
    SCALE,
    JUMP_SCALE,
    LINE_RATE,
    LINE_LENGTH,
    LINE_THICKNESS,
    DUST_COUNT,
    AIR_WAVES,
  ])

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
      const flying = entity.has(Flying)
      const water = !flying && levelWaterDepthAt(pos.x, pos.z) > 0
      const feetY = pos.y - clearance
      dashers.push({
        key: entity,
        active: action.current === 'dash',
        water,
        flying,
        // nos pés (na água, na superfície); o corpo se estende
        // `2 * clearance` pra cima
        origin: [
          pos.x,
          water ? Math.max(feetY, GAME_CONFIG.TERRAIN.WATER_LEVEL) : feetY,
          pos.z,
        ],
        // pra onde o dash VAI (travada no disparo), não pra onde o corpo olha agora
        yaw: Math.atan2(action.dirX, action.dirZ),
        // no ar o dash pode subir ou descer (`dirY`); no chão é sempre reto
        pitch: flying
          ? Math.atan2(action.dirY, Math.hypot(action.dirX, action.dirZ))
          : 0,
        height: clearance * 2,
      })
    })

    manager.update(dashers, Math.min(delta, MAX_STEP), state.camera.position)
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(DASH_TEXTURE_PATHS))
