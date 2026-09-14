import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { playerEntity } from '@/core/world/world'
import { getSpecies } from '@/core/data/species'
import { resolveBones } from '@/core/animation/resolveBones'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
} from '../registry/animationRegistry'

// Modelo temporário do jogador (ver core/data/species/fox). Troca aqui quando
// o modelo definitivo do treinador estiver pronto — nada mais neste arquivo
// muda, contanto que a nova espécie tenha os mesmos ids de clipe.
const PLAYER_SPECIES_ID = 'fox'
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

/**
 * Wrapper fino: renderiza o modelo do jogador e registra a ref de cena
 * (syncTransformSystem) e os ossos resolvidos + clipes (animationSystem).
 * Sem lógica de jogo, sem useFrame — quem decide o estado é o
 * animationStateSystem (headless); aqui só se aplica o clipe escolhido.
 */
export function PlayerView() {
  const groupRef = useRef()
  const { scene } = useGLTF(PLAYER_SPECIES.model.path)
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
    registerView(playerEntity, groupRef.current)

    let skeleton = null
    cloned.traverse((child) => {
      if (child.isSkinnedMesh) skeleton = child.skeleton
    })
    if (skeleton) {
      registerAnimatedBones(playerEntity, {
        bones: resolveBones(skeleton),
        clips: PLAYER_SPECIES.clips,
      })
    }

    return () => {
      unregisterView(playerEntity)
      unregisterAnimatedBones(playerEntity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned])

  return (
    <group ref={groupRef}>
      <primitive
        object={cloned}
        scale={PLAYER_SPECIES.model.scale}
        position={PLAYER_SPECIES.model.position}
      />
    </group>
  )
}

useGLTF.preload(PLAYER_SPECIES.model.path)
