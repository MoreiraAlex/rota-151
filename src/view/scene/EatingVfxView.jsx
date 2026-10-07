import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { world } from '@/core/world/world'
import { verticalClearance } from '@/core/physics/colliders'
import { CharacterController, Eating, Position } from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import {
  EAT_FOOD_TEXTURE_PATHS,
  buildBiteEmitters,
  buildHealEmitters,
  buildLandEmitters,
} from '@/view/vfx/eatFoodVfx'
import { drainFoodVfx } from '@/view/vfx/foodVfxQueue'
import { resolveItemTint } from '../itemTint'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

/**
 * Partículas de comer fruta (docs/features/042-itens-da-beta.md, ver
 * `view/vfx/eatFoodVfx.js`): o suco e os farelos de cada mordida e o
 * respingo da fruta caída (pedidos na fila `foodVfxQueue.js`), e os brilhos
 * de cura em volta de quem está comendo (um sistema contínuo por quem come,
 * que para de soltar quando o `Eating` sai). Só LÊ o ECS — `useFrame` aqui é
 * a exceção documentada de componente puramente visual, igual a
 * `JumpDustView`. `GAME_CONFIG.FEEDBACK.EAT_FOOD` liga/desliga e ajusta.
 */
export function EatingVfxView() {
  const textures = useTexture(EAT_FOOD_TEXTURE_PATHS)
  const rootRef = useRef()
  // Rajadas (mordida, respingo) e os brilhos de cura por quem come.
  const bursts = useRef(new Set())
  const heals = useRef(new Map())

  useEffect(() => {
    const root = rootRef.current
    const burstSet = bursts.current
    const healMap = heals.current
    return () => {
      for (const system of [...burstSet, ...healMap.values()]) {
        root?.remove(system.group)
        system.dispose()
      }
      burstSet.clear()
      healMap.clear()
    }
  }, [])

  useFrame((state, delta) => {
    const root = rootRef.current
    const config = GAME_CONFIG.FEEDBACK.EAT_FOOD
    const requests = drainFoodVfx()
    if (!root) return
    const step = Math.min(delta, MAX_STEP)

    if (config.ENABLED) {
      for (const request of requests) spawnBurst(request)
      updateHeals()
    }

    for (const system of [...bursts.current]) {
      system.update(step)
      if (system.isDone()) remove(bursts.current, system)
    }
    for (const [eater, system] of [...heals.current]) {
      system.update(step)
      if (system.emissionEnded && system.isDone()) {
        root.remove(system.group)
        system.dispose()
        heals.current.delete(eater)
      }
    }

    function spawnBurst({ kind, itemId, position }) {
      const color = resolveItemTint(itemId)
      const emitters =
        kind === 'land'
          ? buildLandEmitters({ color, count: config.LAND_JUICE_COUNT })
          : buildBiteEmitters({
              color,
              juice: config.JUICE_COUNT,
              crumbs: config.CRUMB_COUNT,
            })
      const system = createParticleSystem({
        emitters,
        textures,
        length: 0,
        radius: 0,
        scale: config.SCALE,
      })
      system.group.position.set(position[0], position[1], position[2])
      root.add(system.group)
      bursts.current.add(system)
    }

    // Um sistema contínuo por quem está comendo, seguindo os pés dele.
    function updateHeals() {
      const eating = new Set()
      world.query(Eating, Position).forEach((eater) => {
        eating.add(eater)
        let system = heals.current.get(eater)
        if (!system) {
          system = createParticleSystem({
            emitters: buildHealEmitters({ rate: config.HEAL_SPARKLE_RATE }),
            textures,
            length: 0,
            radius: 0,
            scale: config.SCALE,
          })
          root.add(system.group)
          heals.current.set(eater, system)
        }
        const pos = eater.get(Position)
        const body = eater.get(CharacterController)
        const clearance = body ? verticalClearance(body) : 0
        system.setFrame({
          origin: [pos.x, pos.y - clearance, pos.z],
          yaw: 0,
          height: clearance * 2,
        })
      })
      for (const [eater, system] of heals.current) {
        if (!eating.has(eater) && !system.emissionEnded) system.endEmission()
      }
    }

    function remove(set, system) {
      root.remove(system.group)
      system.dispose()
      set.delete(system)
    }
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(EAT_FOOD_TEXTURE_PATHS))
