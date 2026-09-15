import { useGLTF } from '@react-three/drei'

import { playerEntity } from '@/core/world/world'
import { getSpecies, PLAYER_SPECIES_ID } from '@/core/data/species'
import { useAnimatedModel } from '../hooks/useAnimatedModel'

// PLAYER_SPECIES_ID mora em core/data/species/index.js — único lugar que
// define isso, também usado por core/world/world.js (corpo físico +
// movimento). Trocar só aqui deixaria o modelo visual e a física apontando
// pra espécies diferentes, como já aconteceu.
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

/**
 * Wrapper fino: renderiza o modelo do jogador via `useAnimatedModel`
 * (carrega o GLTF, registra a ref de cena pro `syncTransformSystem` e os
 * ossos/clipes pro `animationSystem`). Sem lógica de jogo, sem useFrame —
 * quem decide o estado é o `animationStateSystem` (headless); aqui só se
 * aplica o clipe escolhido.
 */
export function PlayerView() {
  const { groupRef, cloned } = useAnimatedModel(playerEntity, PLAYER_SPECIES)

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
