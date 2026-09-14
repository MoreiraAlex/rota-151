import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { playerEntity } from '@/core/world/world'
import { getSpecies, PLAYER_SPECIES_ID } from '@/core/data/species'
import { resolveBones } from '@/core/animation/resolveBones'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
} from '../registry/animationRegistry'

// PLAYER_SPECIES_ID mora em core/data/species/index.js — único lugar que
// define isso, também usado por core/world/world.js (corpo físico +
// movimento). Trocar só aqui deixaria o modelo visual e a física apontando
// pra espécies diferentes, como já aconteceu.
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
        position={PLAYER_SPECIES.body.modelOffset}
      />
    </group>
  )
}

useGLTF.preload(PLAYER_SPECIES.model.path)
