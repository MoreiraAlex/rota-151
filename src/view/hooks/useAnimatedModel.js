import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { resolveBones } from '@/core/animation/resolveBones'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
} from '../registry/animationRegistry'

/**
 * Carrega o modelo de uma espécie, clona o esqueleto (uma cópia por
 * entidade — instâncias não compartilham pose) e registra a entidade no
 * `viewRegistry` (`syncTransformSystem`) e, se houver esqueleto, no
 * `animationRegistry` (`animationSystem`). Extraído de `PlayerView.jsx`
 * (v0.0.14) pra ser reaproveitado por qualquer entidade renderizada
 * dinamicamente (`CreatureView`, ver docs/features/014-arremessar-usar-e-
 * invocar.md) — mesma lógica, um lugar só.
 *
 * **Materiais não são clonados aqui** (`SkeletonUtils.clone` os reusa por
 * referência, só geometria/esqueleto são únicos por clone) — quem precisar
 * tingir uma instância sem afetar as outras que carregam o mesmo `.glb`
 * precisa clonar o material antes de mudar a cor (ver `CreatureView.jsx`).
 *
 * Retorna `{ groupRef, cloned }`: `groupRef` vai no `<group ref>` que o
 * `syncTransformSystem` move; `cloned` é a cena pra renderizar via
 * `<primitive object={cloned} .../>`.
 */
export function useAnimatedModel(entity, species) {
  const groupRef = useRef()
  const { scene } = useGLTF(species.model.path)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])

  useEffect(() => {
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [cloned])

  useEffect(() => {
    registerView(entity, groupRef.current)

    let skeleton = null
    cloned.traverse((child) => {
      if (child.isSkinnedMesh) skeleton = child.skeleton
    })
    if (skeleton) {
      registerAnimatedBones(entity, {
        bones: resolveBones(skeleton),
        clips: species.clips,
      })
    }

    return () => {
      unregisterView(entity)
      unregisterAnimatedBones(entity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, entity])

  return { groupRef, cloned }
}
