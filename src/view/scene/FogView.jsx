import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { fogRange } from '@/view/terrain/fogRange'

// Névoa pela DISTÂNCIA até a câmera, não pela profundidade (o padrão do
// Three, `-mvPosition.z`): pela profundidade, o que fica de lado na tela
// conta como mais perto e enevoa menos — a borda do mundo carregado
// apareceria nos cantos. Troca o trecho de shader de todos os materiais com
// névoa; vale a partir de quando este módulo é importado (antes de qualquer
// material compilar).
THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
	vFogDepth = length( mvPosition.xyz );
#endif`

// Altura (px) da textura do céu — só um degradê vertical.
const SKY_TEXTURE_HEIGHT = 256

/**
 * Céu como fundo da cena: degradê do alto (`SKY_TOP_COLOR`) até o horizonte
 * na cor da névoa, e a cor da névoa abaixo dele — o relevo enevoado some no
 * céu sem recorte.
 */
function createSkyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = SKY_TEXTURE_HEIGHT
  const context = canvas.getContext('2d')
  const gradient = context.createLinearGradient(0, 0, 0, SKY_TEXTURE_HEIGHT)
  gradient.addColorStop(0, GAME_CONFIG.FOG.SKY_TOP_COLOR)
  gradient.addColorStop(0.5, GAME_CONFIG.FOG.COLOR)
  gradient.addColorStop(1, GAME_CONFIG.FOG.COLOR)
  context.fillStyle = gradient
  context.fillRect(0, 0, 1, SKY_TEXTURE_HEIGHT)

  const texture = new THREE.CanvasTexture(canvas)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Névoa e céu (docs/features/046-sistema-de-chunks.md): esconde o chunk
 * nascendo ou sumindo na borda do mundo carregado. A distância acompanha o
 * raio de carregar e o lado do chunk (`fogRange`) — recalculada quando o
 * conjunto de chunks muda (que é o que acontece quando o raio ou o chunk
 * mudam no painel de ajuste).
 */
export function FogView() {
  useTerrainChunks()
  const { near, far } = fogRange({
    loadRadius: GAME_CONFIG.TERRAIN.LOAD_RADIUS,
    chunkSize: TEST_LEVEL.terrain.chunkSize(),
    cameraMaxDistance: GAME_CONFIG.CAMERA.MAX_DISTANCE,
    startFraction: GAME_CONFIG.FOG.START_FRACTION,
    minDistance: GAME_CONFIG.FOG.MIN_DISTANCE,
  })

  const sky = useMemo(createSkyTexture, [])
  useEffect(() => () => sky.dispose(), [sky])

  return (
    <>
      <fog attach="fog" args={[GAME_CONFIG.FOG.COLOR, near, far]} />
      <primitive attach="background" object={sky} />
    </>
  )
}
