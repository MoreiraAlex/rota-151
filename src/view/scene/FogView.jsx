import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { lightingAt } from '@/core/time/dayCycle'
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

// Cor de antes do primeiro frame: o horizonte do horário inicial.
const INITIAL_COLOR = new THREE.Color().setRGB(
  ...lightingAt(GAME_CONFIG.DAY_CYCLE.START_TIME).horizon,
  THREE.SRGBColorSpace,
)

/**
 * Névoa (docs/features/046-sistema-de-chunks.md): esconde o chunk nascendo
 * ou sumindo na borda do mundo carregado. A distância acompanha o raio de
 * carregar e o lado do chunk (`fogRange`) — recalculada quando o conjunto
 * de chunks muda (que é o que acontece quando o raio ou o chunk mudam no
 * painel de ajuste). A cor é a do horizonte da hora, e quem a muda a cada
 * frame é o `DayNightView` (docs/features/048-dia-noite-e-clima.md), junto
 * com o céu.
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

  return <fog attach="fog" args={[INITIAL_COLOR, near, far]} />
}
