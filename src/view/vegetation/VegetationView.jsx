'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useFrame } from '@react-three/fiber'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { chunkCoordAt, chunkKey } from '@/core/terrain/terrainChunk'
import { lightingAt } from '@/core/time/dayCycle'
import { LocalWeather, WorldClock } from '@/core/traits'
import { windStrengthOf } from '@/core/weather/wind'
import { world } from '@/core/world/world'
import { useTerrainChunks } from '@/view/hooks/useTerrainChunks'
import { resolveSkyLook } from '@/view/weather/skyLook'
import { applyCanopyLook } from './canopyMaterial'
import {
  buildLogMeshes,
  buildRockMeshes,
  buildTreeMeshes,
  buildUndergrowthMeshes,
} from './chunkMeshes'
import { applyGrassLook } from './grassMaterial'
import { disposeVegetationMesh, setShadowsEnabled } from './instancing'
import { applyBarkLook, applyFoliageLook, applyRockLook } from './propMaterials'
import {
  applyPartColor,
  materialsOfKind,
  useVegetationModels,
} from './useVegetationModels'
import { buildFlowerMeshes, buildGrassMesh } from './vegetationMeshes'
import { tilesAround } from './vegetationScatter'
import {
  getVegetationSettings,
  subscribeVegetationSettings,
} from './vegetationSettings'
import { vegetationUniforms } from './windShader'

// Blocos de grama novos montados por quadro (cada um custa alguns ms) — o
// resto entra nos quadros seguintes, do mais perto ao mais longe.
const NEW_TILES_PER_FRAME = 2

/**
 * Monta e tira as malhas que `build` devolve: uma malha, `{ mesh,
 * sharedGeometry }` (a malha usa a geometria do modelo direto — não liberar
 * ela), uma lista delas ou `null`. `castShadows`: liga a sombra das que
 * podem fazer (`allowShadow`).
 */
function MeshesOf({ build, castShadows = true }) {
  const built = useMemo(build, [build])
  const meshes = useMemo(
    () =>
      (Array.isArray(built) ? built : [built])
        .filter(Boolean)
        .map((item) => (item.isObject3D ? { mesh: item } : item)),
    [built],
  )
  useEffect(
    () => () => {
      for (const { mesh, sharedGeometry } of meshes) {
        disposeVegetationMesh(mesh, { sharedGeometry })
      }
    },
    [meshes],
  )
  // Sombra pela distância: liga e desliga sem remontar.
  useEffect(() => {
    for (const { mesh } of meshes) setShadowsEnabled(mesh, castShadows)
  }, [meshes, castShadows])
  return meshes.map(({ mesh }) => <primitive key={mesh.uuid} object={mesh} />)
}

/**
 * Malhas com LOD (`buildLodKindMeshes` — árvores, sub-bosque): monta,
 * registra o `setNear` no `lod` com a distância de perto (`distanceOf`, lida
 * a cada atualização — o debug mexe) e tira ao desmontar.
 */
function LodMeshesOf({ build, castShadows, lod, distanceOf }) {
  const built = useMemo(build, [build])
  useEffect(() => {
    lod.add(built.setNear, distanceOf)
    return () => {
      lod.remove(built.setNear)
      for (const mesh of built.meshes) disposeVegetationMesh(mesh)
    }
  }, [built, lod, distanceOf])
  useEffect(() => {
    for (const mesh of built.meshes) setShadowsEnabled(mesh, castShadows)
  }, [built, castShadows])
  return built.meshes.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)
}

function GrassTile({ chunk, tile, models, showGrass, showFlowers }) {
  const buildGrass = useMemo(
    () => () => buildGrassMesh(chunk, tile, models.grass),
    [chunk, tile, models],
  )
  const buildFlowers = useMemo(
    () => () => buildFlowerMeshes(chunk, tile, models.kinds.flower),
    [chunk, tile, models],
  )
  return (
    <>
      {showGrass && <MeshesOf build={buildGrass} />}
      {showFlowers && <MeshesOf build={buildFlowers} />}
    </>
  )
}

/**
 * A vegetação de um bloco de sólidos (`loadedBlocks` do conjunto de chunks,
 * `SOLIDS_BLOCK_SIZE` m — vários chunks, para não multiplicar as malhas):
 * árvores, troncos caídos e pedras (os do core) e o sub-bosque (arbustos,
 * samambaias, plantas, cogumelos, seixos), sorteados sobre o relevo do
 * bloco inteiro (`ground`). Pela distância da câmera
 * (`VEGETATION_QUALITY`): `showSolids` (até `treeDistance`), `showDetail`
 * (sub-bosque, até `detailRing`) e `castShadows` (até `shadowRing`) — ligar
 * e desligar não refaz o que já foi montado.
 */
function BlockVegetation({
  ground: chunk,
  models,
  settings,
  castCanopyShadow,
  showSolids,
  showDetail,
  castShadows,
  lod,
}) {
  const builds = useMemo(() => {
    const options = { ...models, castCanopyShadow }
    const undergrowth = (kind) => () =>
      buildUndergrowthMeshes(chunk, kind, options)
    return {
      trees: () => buildTreeMeshes(chunk, options),
      bushes: undergrowth('bush'),
      ferns: undergrowth('fern'),
      plants: undergrowth('leafy-plant'),
      mushrooms: undergrowth('mushroom'),
      pebbles: undergrowth('pebble'),
      rocks: () => buildRockMeshes(chunk, options),
      // O cilindro do tronco caído é um só para todos (não liberar).
      logs: () =>
        buildLogMeshes(chunk, options).map((mesh) => ({
          mesh,
          sharedGeometry: true,
        })),
    }
  }, [chunk, models, castCanopyShadow])

  if (!showSolids) return null
  return (
    <>
      {settings.trees && (
        <LodMeshesOf
          build={builds.trees}
          castShadows={castShadows}
          lod={lod}
          distanceOf={treeLodDistance}
        />
      )}
      {settings.undergrowth && showDetail && (
        <>
          {['bushes', 'ferns', 'plants', 'mushrooms', 'pebbles'].map((name) => (
            <LodMeshesOf
              key={name}
              build={builds[name]}
              castShadows={castShadows}
              lod={lod}
              distanceOf={detailDistance}
            />
          ))}
        </>
      )}
      {settings.rocks && (
        <>
          <MeshesOf build={builds.rocks} castShadows={castShadows} />
          <MeshesOf build={builds.logs} castShadows={castShadows} />
        </>
      )}
    </>
  )
}

// Quanto (m) a câmera anda antes de refazer o LOD das árvores.
const LOD_STEP = 2

// Distância de perto (m) de cada LOD: árvore inteira e sub-bosque.
const treeLodDistance = () => GAME_CONFIG.TREES.LOD_DISTANCE
const detailDistance = () => {
  const { VEGETATION_QUALITY } = GAME_CONFIG
  return VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT].detailDistance
}

/**
 * Os `setNear` dos chunks montados (`LodMeshesOf`), cada um com a distância
 * de perto dele. `update` com a posição da câmera divide cada instância
 * entre perto e longe — só quando a câmera andou `LOD_STEP` m ou entrou um
 * chunk novo.
 */
function createLodRegistry() {
  const controllers = new Map()
  let last = null
  let isDirty = true
  return {
    add(setNear, distanceOf) {
      controllers.set(setNear, distanceOf)
      isDirty = true
    },
    remove(setNear) {
      controllers.delete(setNear)
    },
    update({ x, z }) {
      const hasMoved = !last || Math.hypot(x - last.x, z - last.z) > LOD_STEP
      if (!isDirty && !hasMoved) return
      last = { x, z }
      isDirty = false
      for (const [setNear, distanceOf] of controllers) {
        const distance = distanceOf()
        setNear((item) => Math.hypot(item.x - x, item.z - z) < distance)
      }
    },
  }
}

const chunkOfTile = (tile, { GRASS, TERRAIN }) => [
  chunkCoordAt(tile.tileX * GRASS.TILE_SIZE, TERRAIN.CHUNK_SIZE),
  chunkCoordAt(tile.tileZ * GRASS.TILE_SIZE, TERRAIN.CHUNK_SIZE),
]

/**
 * A vegetação do mundo (docs/features/049-vegetacao-e-floresta.md), no
 * estilo do stylized-scene:
 *
 * - **grama e flores** em blocos de `GRASS.TILE_SIZE` m em volta da câmera
 *   até onde a névoa fecha (dali em diante não se vê nada — a grama não
 *   encolhe nem some antes), cada bloco montado quando entra no raio
 *   (poucos por quadro) e tirado quando sai;
 * - por **bloco de sólidos** carregado (`SOLIDS_BLOCK_SIZE` m, vários
 *   chunks): árvores, troncos caídos e pedras (os do core) e o sub-bosque
 *   (arbustos, samambaias, plantas, cogumelos, seixos) — o que aparece e o
 *   que faz sombra pela distância do bloco da câmera
 *   (`VEGETATION_QUALITY`: `treeDistance`, `detailRing`, `shadowRing`);
 * - o **vento** (força pelo clima, `windStrengthOf`) e a luz do sol na
 *   folha, nos uniforms compartilhados (`vegetationUniforms`).
 *
 * `useFrame` aqui é a exceção das regras (3.4): componente só visual, que
 * só LÊ o ECS.
 */
export function VegetationView() {
  useTerrainChunks()
  const settings = useSyncExternalStore(
    subscribeVegetationSettings,
    getVegetationSettings,
    getVegetationSettings,
  )
  const models = useVegetationModels()
  const materials = useMemo(
    () => ({
      canopy: materialsOfKind(models.kinds, 'canopy'),
      foliage: materialsOfKind(models.kinds, 'foliage'),
      bark: materialsOfKind(models.kinds, 'bark'),
      rock: [
        ...materialsOfKind(models.kinds, 'rock'),
        ...materialsOfKind(models.kinds, 'pebble'),
      ],
      log: models.log.materials,
    }),
    [models],
  )

  const chunksByKey = new Map(
    TEST_LEVEL.terrain
      .loadedChunks()
      .map((chunk) => [chunkKey(chunk.chunkX, chunk.chunkZ), chunk]),
  )

  // Blocos montados agora.
  const [tiles, setTiles] = useState([])
  const tilesRef = useRef(tiles)
  // LOD das árvores e do sub-bosque: o `setNear` de cada chunk montado;
  // refeito quando a câmera anda `LOD_STEP` m ou entra um chunk novo.
  const lod = useMemo(() => createLodRegistry(), [])
  // Bloco de sólidos onde está a câmera (a distância de cada bloco sai
  // dele).
  const [cameraBlock, setCameraBlock] = useState({ x: 0, z: 0 })
  const cameraBlockRef = useRef(cameraBlock)

  useFrame(({ camera, scene }, delta) => {
    updateUniforms(delta, models.grass.material, materials)
    lod.update(camera.position)

    const { SOLIDS_BLOCK_SIZE } = GAME_CONFIG.TERRAIN
    const nextBlock = {
      x: chunkCoordAt(camera.position.x, SOLIDS_BLOCK_SIZE),
      z: chunkCoordAt(camera.position.z, SOLIDS_BLOCK_SIZE),
    }
    const lastBlock = cameraBlockRef.current
    if (nextBlock.x !== lastBlock.x || nextBlock.z !== lastBlock.z) {
      cameraBlockRef.current = nextBlock
      setCameraBlock(nextBlock)
    }

    const wanted = tilesAround(
      camera.position.x,
      camera.position.z,
      scene.fog?.far ?? GAME_CONFIG.FOG.MIN_DISTANCE,
      GAME_CONFIG.GRASS.TILE_SIZE,
    ).filter((tile) =>
      TEST_LEVEL.terrain.isLoaded(...chunkOfTile(tile, GAME_CONFIG)),
    )

    const current = new Set(tilesRef.current.map(({ key }) => key))
    let added = 0
    const next = wanted.filter((tile) => {
      if (current.has(tile.key)) return true
      added += 1
      return added <= NEW_TILES_PER_FRAME
    })
    // A ordem muda andando; o que importa é quais blocos estão montados.
    const isSame =
      next.length === current.size && next.every(({ key }) => current.has(key))
    if (isSame) return
    // Mantém o objeto de quem já estava (não remonta o bloco).
    const byKey = new Map(tilesRef.current.map((tile) => [tile.key, tile]))
    tilesRef.current = next.map((tile) => byKey.get(tile.key) ?? tile)
    setTiles(tilesRef.current)
  })

  const { VEGETATION_QUALITY } = GAME_CONFIG
  const quality = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]

  return (
    <>
      {(settings.grass || settings.flowers) &&
        tiles.map((tile) => {
          const chunk = chunksByKey.get(
            chunkKey(...chunkOfTile(tile, GAME_CONFIG)),
          )
          if (!chunk) return null
          return (
            <GrassTile
              key={`${tile.key}:${settings.revision}`}
              chunk={chunk}
              tile={tile}
              models={models}
              showGrass={settings.grass}
              showFlowers={settings.flowers}
            />
          )
        })}
      {TEST_LEVEL.terrain.loadedBlocks().map((block) => {
        const dx = block.blockX - cameraBlock.x
        const dz = block.blockZ - cameraBlock.z
        const ring = Math.max(Math.abs(dx), Math.abs(dz))
        const distance =
          Math.hypot(dx, dz) * GAME_CONFIG.TERRAIN.SOLIDS_BLOCK_SIZE
        return (
          <BlockVegetation
            key={`${block.key}:${settings.revision}`}
            ground={block.ground}
            models={models}
            settings={settings}
            castCanopyShadow={quality.canopyShadow}
            showSolids={distance <= quality.treeDistance}
            showDetail={ring <= quality.detailRing}
            castShadows={ring <= quality.shadowRing}
            lod={lod}
          />
        )
      })}
    </>
  )
}

// Vento e sol: uma vez por quadro, nos uniforms de todos; e os
// números de material que o painel do debug mexe ao vivo.
function updateUniforms(delta, grassMaterial, materials) {
  const { WIND } = GAME_CONFIG
  const clock = world.get(WorldClock)
  const weather = world.get(LocalWeather)
  const uniforms = vegetationUniforms

  uniforms.uWindTime.value += delta
  uniforms.uWindSpeed.value = WIND.SPEED
  uniforms.uWindAngle.value = WIND.DIRECTION
  uniforms.uGustScale.value = WIND.GUST_SCALE
  uniforms.uTurbulence.value = WIND.TURBULENCE
  uniforms.uFlutter.value = WIND.FLUTTER
  if (weather) uniforms.uWindStrength.value = windStrengthOf(weather)
  if (clock && weather) {
    const look = resolveSkyLook(lightingAt(clock.time), weather)
    uniforms.uSunDirection.value.set(look.sun.x, look.sun.y, look.sun.z)
    uniforms.uSunGlow.value = look.shadowIntensity
  }

  applyGrassLook(grassMaterial)
  // A cor antes do preenchimento da sombra (que segue a cor).
  for (const material of [...materials.canopy, ...materials.bark]) {
    applyPartColor(material)
  }
  applyPartColor(materials.log[0])
  for (const material of materials.canopy) applyCanopyLook(material)
  for (const material of materials.foliage) applyFoliageLook(material)
  for (const material of materials.bark) applyBarkLook(material)
  for (const material of materials.rock) applyRockLook(material)
}
