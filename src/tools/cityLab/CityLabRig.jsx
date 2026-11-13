'use client'

import { useFrame, useThree } from '@react-three/fiber'

// Para onde a névoa vai (m): bem além de tudo que carrega. Tirar a névoa
// recompilaria todos os materiais; o jogo faz o mesmo dentro dos prédios.
const NO_FOG = { near: 1e4, far: 2e4 }

/**
 * O que o laboratório da cidade (docs/features/069-revisao-do-bioma-
 * cidade.md) faz a cada quadro dentro da cena: sem névoa, para ver a
 * cidade inteira (a borda do mundo carregado fica à vista). O `FogView`
 * volta a distância dela quando os chunks mudam; aqui ela vai para longe
 * de novo a cada quadro.
 *
 * `useFrame` aqui é ferramenta (fora das regras do jogo), só visual.
 */
export function CityLabRig() {
  const { scene } = useThree()
  useFrame(() => {
    if (!scene.fog) return
    scene.fog.near = NO_FOG.near
    scene.fog.far = NO_FOG.far
  })
  return null
}
