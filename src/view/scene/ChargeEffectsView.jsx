import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { world } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { verticalClearance } from '@/core/physics/colliders'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { isAttackCharging } from '@/core/battle/attackTelegraph'
import {
  ActionState,
  CharacterController,
  Position,
  Rotation,
  resolveCreatureSpeciesId,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { createFollowEffectManager } from '@/view/vfx/followEffectManager'
import {
  ABSORB_CHARGE_EMITTERS,
  ABSORB_CHARGE_TEXTURE_PATHS,
} from '@/view/vfx/absorbChargeVfx'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

/**
 * Grupos de CARGA (`visual.chargeGroup` da skill) → emissores. As texturas de
 * todos os grupos são carregadas juntas (as chaves não podem colidir).
 */
const CHARGE_EFFECTS = {
  absorb: ABSORB_CHARGE_EMITTERS,
}
const CHARGE_TEXTURE_PATHS = { ...ABSORB_CHARGE_TEXTURE_PATHS }

/**
 * Visual de CARGA de golpe: enquanto uma criatura carrega um golpe que tem
 * `visual.chargeGroup` (do disparo até o `effectAt` — `isAttackCharging`, a
 * mesma janela do aviso no chão), o efeito do grupo roda em volta dela; acaba
 * no efeito do golpe ou quando ele é interrompido (a ação some). Hoje: o
 * Growth com `'absorb'` (`view/vfx/absorbChargeVfx.js`). O som de carga é do
 * `attackAudioSystem`.
 *
 * Só LÊ o ECS: a cada frame decide quem está carregando e deixa
 * `createFollowEffectManager` criar, acompanhar e encerrar o efeito de cada
 * um — o quadro fica nos pés da criatura, girado pelo `Rotation.y`. O raio e a
 * escala vêm da skill (`radius`, `visual.scale`). `useFrame` aqui é a exceção
 * documentada de componente puramente visual, igual a `DashEffectsView`.
 */
export function ChargeEffectsView() {
  const textures = useTexture(CHARGE_TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  useEffect(() => {
    const manager = createFollowEffectManager({
      root: rootRef.current,
      createSystem: ({ group, radius, scale }) =>
        createParticleSystem({
          emitters: CHARGE_EFFECTS[group],
          textures,
          length: 0,
          radius,
          scale,
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

    const chargers = []
    world
      .query(ActionState, CharacterController, Position, Rotation)
      .forEach((entity) => {
        const action = entity.get(ActionState)
        const pos = entity.get(Position)
        const clearance = verticalClearance(entity.get(CharacterController))
        const attack =
          action.current === 'attack'
            ? resolveCreatureAttack(
                getSpecies(resolveCreatureSpeciesId(entity)),
                action.pendingSlot,
              )
            : null
        const group = attack?.visual?.chargeGroup
        chargers.push({
          key: entity,
          active: !!CHARGE_EFFECTS[group] && isAttackCharging(action, attack),
          group,
          radius: attack?.radius ?? 0,
          scale: attack?.visual?.scale ?? 1,
          // nos pés; o corpo se estende `2 * clearance` pra cima
          origin: [pos.x, pos.y - clearance, pos.z],
          yaw: entity.get(Rotation).y,
          height: clearance * 2,
        })
      })

    manager.update(chargers, Math.min(delta, MAX_STEP), state.camera.position)
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(CHARGE_TEXTURE_PATHS))
