import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { world } from '@/core/world/world'
import { verticalClearance } from '@/core/physics/colliders'
import { resolveBodyExtent } from '@/core/physics/capsule'
import { listActiveConditions } from '@/core/actions/conditions'
import { getCondition } from '@/core/data/conditions'
import {
  BeingCaptured,
  CharacterController,
  Conditions,
  Fainted,
  Position,
  Rotation,
} from '@/core/traits'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { createFollowEffectManager } from '@/view/vfx/followEffectManager'
import { BURN_EMITTERS, BURN_TEXTURE_PATHS } from '@/view/vfx/burnVfx'
import {
  STRING_SHOT_TEXTURE_PATHS,
  STRING_SHOT_WEB_EMITTERS,
} from '@/view/vfx/stringShotVfx'
import {
  POISON_BODY_EMITTERS,
  POISON_TEXTURE_PATHS,
} from '@/view/vfx/poisonVfx'
import { FOCUS_BODY_EMITTERS, FOCUS_TEXTURE_PATHS } from '@/view/vfx/focusVfx'
import { WRAP_BODY_EMITTERS, WRAP_TEXTURE_PATHS } from '@/view/vfx/wrapVfx'
import {
  GLARE_TEXTURE_PATHS,
  PARALYSIS_BODY_EMITTERS,
} from '@/view/vfx/glareVfx'

// Passo máximo da simulação — um frame longo não pode virar um salto das partículas.
const MAX_STEP = 1 / 20

// O efeito no corpo de cada grupo (`visual.body` da condição, docs/features/
// 061-revisao-das-skills.md): o fogo da queimadura, a teia do String Shot e
// as bolhas do veneno e as faíscas do Focado, estas no tamanho do corpo
// (`body` do seguidor).
const BODY_EFFECTS = {
  burn: { emitters: BURN_EMITTERS, textures: 'burn' },
  'string-shot': { emitters: STRING_SHOT_WEB_EMITTERS, textures: 'stringShot' },
  poison: { emitters: POISON_BODY_EMITTERS, textures: 'poison' },
  focus: { emitters: FOCUS_BODY_EMITTERS, textures: 'focus' },
  // os anéis do Preso (o Wrap)
  wrap: { emitters: WRAP_BODY_EMITTERS, textures: 'wrap' },
  // as faíscas da paralisia (o Glare)
  paralysis: { emitters: PARALYSIS_BODY_EMITTERS, textures: 'glare' },
}

// Os grupos de efeito no corpo das condições ativas de `entity`.
function listBodyEffects(entity) {
  return listActiveConditions(entity)
    .map((id) => getCondition(id)?.visual?.body)
    .filter((group) => BODY_EFFECTS[group])
}

/**
 * Efeitos das CONDIÇÕES no corpo de quem as tem (docs/features/039-tipos-e-combate-classico.md, Parte 4) — o grupo do `visual.body` de cada
 * condição ativa: o fogo da queimadura (`burnVfx.js`), a teia do Enredado
 * (`stringShotVfx.js`), as bolhas do veneno (`poisonVfx.js`) e as faíscas
 * do Focado (`focusVfx.js`), que
 * acompanham a criatura enquanto duram e param quando acabam ou ela desmaia.
 *
 * Só LÊ o ECS e deixa `createFollowEffectManager` criar, acompanhar e
 * encerrar cada efeito. `useFrame` aqui é a exceção documentada de
 * componente puramente visual, igual a `ContinuousAttackEffectsView`.
 */
export function StatusConditionEffectsView() {
  const burnTextures = useTexture(BURN_TEXTURE_PATHS)
  const stringShotTextures = useTexture(STRING_SHOT_TEXTURE_PATHS)
  const poisonTextures = useTexture(POISON_TEXTURE_PATHS)
  const focusTextures = useTexture(FOCUS_TEXTURE_PATHS)
  const wrapTextures = useTexture(WRAP_TEXTURE_PATHS)
  const glareTextures = useTexture(GLARE_TEXTURE_PATHS)
  const rootRef = useRef()
  const managerRef = useRef(null)

  useEffect(() => {
    const textureSets = {
      burn: burnTextures,
      stringShot: stringShotTextures,
      poison: poisonTextures,
      focus: focusTextures,
      wrap: wrapTextures,
      glare: glareTextures,
    }
    const manager = createFollowEffectManager({
      root: rootRef.current,
      createSystem: ({ effect, radius }) => {
        const { emitters, textures } = BODY_EFFECTS[effect]
        return createParticleSystem({
          emitters,
          textures: textureSets[textures],
          length: 0,
          radius,
          scale: 1,
        })
      },
    })
    managerRef.current = manager
    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [
    burnTextures,
    stringShotTextures,
    poisonTextures,
    focusTextures,
    wrapTextures,
    glareTextures,
  ])

  useFrame((state, delta) => {
    const manager = managerRef.current
    if (!manager) return

    const followers = []
    world
      .query(Conditions, CharacterController, Position, Rotation)
      .forEach((entity) => {
        const effects = listBodyEffects(entity)
        if (effects.length === 0) return
        const body = entity.get(CharacterController)
        const pos = entity.get(Position)
        const clearance = verticalClearance(body)
        for (const effect of effects) {
          followers.push({
            key: `${entity}:${effect}`,
            effect,
            // Dentro de uma Pokébola (043) o efeito não aparece: ele está na bola.
            active: !entity.has(Fainted) && !entity.has(BeingCaptured),
            radius: body.capsuleRadius,
            // nos pés; o corpo se estende `2 * clearance` pra cima
            origin: [pos.x, pos.y - clearance, pos.z],
            yaw: entity.get(Rotation).y,
            height: clearance * 2,
            body: resolveBodyExtent(body),
          })
        }
      })

    manager.update(followers, Math.min(delta, MAX_STEP), state.camera.position)
  })

  return <group ref={rootRef} />
}

useTexture.preload(Object.values(BURN_TEXTURE_PATHS))
useTexture.preload(Object.values(STRING_SHOT_TEXTURE_PATHS))
useTexture.preload(Object.values(POISON_TEXTURE_PATHS))
useTexture.preload(Object.values(FOCUS_TEXTURE_PATHS))
useTexture.preload(Object.values(WRAP_TEXTURE_PATHS))
useTexture.preload(Object.values(GLARE_TEXTURE_PATHS))
