'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { GAME_CONFIG } from '@/core/gameConfig'
import { cameraEntity } from '@/core/world/world'
import { labState } from './labState'
import { girarCameraDoLab } from './labWorld'

/**
 * O que o laboratório de biomas (docs/features/066-revisao-dos-biomas.md)
 * faz a cada quadro dentro da cena: a volta da câmera em torno do
 * treinador e o começo da névoa ao vivo (`FOG.START_FRACTION` — no jogo
 * ele só vale quando os chunks mudam).
 *
 * `useFrame` aqui é ferramenta (fora das regras do jogo), só visual.
 */
export function BiomeLabRig() {
  const { scene } = useThree()
  useFrame((_, delta) => {
    if (labState.orbit) {
      girarCameraDoLab(cameraEntity, labState.orbitSpeed * delta)
    }
    if (scene.fog)
      scene.fog.near = scene.fog.far * GAME_CONFIG.FOG.START_FRACTION
  })
  return null
}
