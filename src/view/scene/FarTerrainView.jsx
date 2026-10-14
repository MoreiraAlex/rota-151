import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  createFarTerrainGrid,
  farTerrainCenter,
  fillFarTerrainGrid,
} from '@/core/terrain/farTerrain'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { buildFarTerrainGeometry } from '@/view/terrain/farTerrainGeometry'
import {
  createFarTerrainMaterial,
  createLoadedMask,
  fillLoadedMask,
} from '@/view/terrain/farTerrainMaterial'

// Lado da máscara de chunks carregados (em chunks): cobre os chunks que
// ainda podem estar carregados (`UNLOAD_RADIUS`) com a câmera longe do
// centro da malha — até duas vezes o `RECENTER_DISTANCE` (anda enquanto a
// malha nova monta).
function maskSize() {
  const { TERRAIN, FAR_TERRAIN } = GAME_CONFIG
  const drift = Math.ceil(
    (FAR_TERRAIN.RECENTER_DISTANCE * 2) / TERRAIN.CHUNK_SIZE,
  )
  return (TERRAIN.UNLOAD_RADIUS + drift + 1) * 2 + 1
}

// Os números da cor da malha agora (`GAME_CONFIG`).
function farTerrainLook(recipe) {
  const { FAR_TERRAIN, VEGETATION_ALTITUDE, WATER } = GAME_CONFIG
  return {
    waterLevel: recipe.terrain.WATER_LEVEL,
    sink: FAR_TERRAIN.SINK,
    canopyStrength: FAR_TERRAIN.CANOPY_STRENGTH,
    brightness: FAR_TERRAIN.BRIGHTNESS,
    altitudeFade: VEGETATION_ALTITUDE.FADE,
    solids: recipe.solids,
    water: {
      shallow: WATER.SHALLOW_COLOR,
      deep: WATER.DEEP_COLOR,
      depth: WATER.DEEP_DEPTH,
    },
  }
}

/**
 * Relevo distante (docs/features/051-montanha.md): a malha grossa do
 * relevo da seed até o horizonte, além dos chunks carregados. Montada aos
 * poucos (`FAR_TERRAIN.SAMPLES_PER_FRAME` pontos por quadro, grade do core
 * `core/terrain/farTerrain.js`) em volta da câmera; quando a câmera se
 * afasta `RECENTER_DISTANCE` do centro (ou a receita do relevo muda — F2),
 * monta outra e troca quando ficar pronta. A malha velha é liberada na
 * troca (regra 5.3). A máscara dos chunks carregados acompanha cada
 * carga/descarga.
 *
 * `useFrame` aqui é a exceção das regras (3.4): componente só visual, que
 * só LÊ o relevo.
 */
export function FarTerrainView() {
  const revision = useTerrainChunks()
  const meshRef = useRef(null)
  const state = useRef({ shown: null, building: null })
  const { mask, material } = useMemo(() => {
    const loadedMask = createLoadedMask(maskSize())
    return {
      mask: loadedMask,
      material: createFarTerrainMaterial(loadedMask),
    }
  }, [])

  useEffect(
    () => () => {
      material.dispose()
      mask.dispose()
      meshRef.current?.geometry.dispose()
    },
    [material, mask],
  )

  // A máscara do centro mostrado agora, com os chunks carregados.
  const updateMask = () => {
    const shown = state.current.shown
    if (!shown) return
    const uniforms = material.userData.farUniforms
    fillLoadedMask(
      mask,
      TEST_LEVEL.terrain.loadedChunks(),
      uniforms.uMaskOrigin.value.x,
      uniforms.uMaskOrigin.value.y,
    )
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(updateMask, [revision])

  useFrame(({ camera }) => {
    const { FAR_TERRAIN } = GAME_CONFIG
    const terrain = TEST_LEVEL.terrain
    const recipe = terrain.recipe()
    const chunkSize = recipe.terrain.CHUNK_SIZE
    const current = state.current

    if (current.building && current.building.recipe !== recipe) {
      current.building = null
    }
    if (!current.building) {
      const { shown } = current
      const isStale =
        !shown ||
        shown.recipe !== recipe ||
        Math.hypot(
          camera.position.x - shown.grid.centerX,
          camera.position.z - shown.grid.centerZ,
        ) > FAR_TERRAIN.RECENTER_DISTANCE
      if (!isStale) return
      const center = farTerrainCenter(
        camera.position.x,
        camera.position.z,
        chunkSize,
      )
      current.building = {
        recipe,
        grid: createFarTerrainGrid({
          centerX: center.x,
          centerZ: center.z,
          radius: FAR_TERRAIN.RADIUS,
          cell: FAR_TERRAIN.CELL,
          biomeCount: recipe.biomeList.length,
        }),
      }
    }

    const { building } = current
    const isDone = fillFarTerrainGrid(
      building.grid,
      terrain.sample,
      FAR_TERRAIN.SAMPLES_PER_FRAME,
    )
    if (!isDone || !meshRef.current) return

    const geometry = buildFarTerrainGeometry(
      building.grid,
      recipe.biomeList,
      farTerrainLook(recipe),
    )
    meshRef.current.geometry.dispose()
    meshRef.current.geometry = geometry
    meshRef.current.visible = true

    const uniforms = material.userData.farUniforms
    const { centerX, centerZ } = building.grid
    const half = (uniforms.uMaskSize.value - 1) / 2
    uniforms.uCenter.value.set(centerX, centerZ)
    uniforms.uRadius.value = FAR_TERRAIN.RADIUS
    uniforms.uChunkSize.value = chunkSize
    // O chunk cujo canto mínimo é o centro da malha, no meio da máscara.
    uniforms.uMaskOrigin.value.set(
      centerX / chunkSize + 0.5 - half,
      centerZ / chunkSize + 0.5 - half,
    )
    current.shown = building
    current.building = null
    updateMask()
  })

  return (
    <mesh
      ref={meshRef}
      material={material}
      visible={false}
      frustumCulled={false}
    />
  )
}
