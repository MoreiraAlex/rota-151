'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getTownMap, townMapCollidersOf } from '@/core/data/townMaps'
import { useOnTownMap } from '@/view/hooks/useOnTownMap'
import {
  buildLgpeModels,
  lgpeTextureNames,
  prepareLgpeTexture,
} from '@/view/vegetation/lgpeModels'
import { reflectedSky } from '@/view/water/WaterView'
import { SHORE_REACH } from '@/view/water/shoreWave'
import {
  applyWaterLook,
  createWaterMaterial,
  updateWater,
} from '@/view/water/waterMaterial'
import { buildTownMapWaterGeometry } from './townMapWater'

const TOWN_MAP_DIR = '/assets/town-maps/lgpe'
const MANIFEST_PATH = `${TOWN_MAP_DIR}/manifest.json`
const modelPath = (id) => `${TOWN_MAP_DIR}/props/${id}.glb`
const texturePath = (name) => `${TOWN_MAP_DIR}/textures/${name}.png`
// Quanto (m do modelo) o mar passa da borda sul do mapa, até o horizonte.
const SEA_REACH = 120

/**
 * O mapa da cidade copiada em que o treinador está (docs/features/069-
 * revisao-do-bioma-cidade.md — Pallet): o modelo do Let's Go
 * (`public/assets/town-maps/lgpe/`) com o material toon dos prédios — o
 * chão misturado (grama, terra, barranco) pela camada do manifesto — posto
 * onde o `OnTownMap` diz, e o mar no material dos rios.
 *
 * Só monta com o treinador lá (os arquivos são grandes e o mapa, por
 * enquanto, só se abre pelo F2).
 */
export function TownMapView() {
  const onTownMap = useOnTownMap()
  const townMap = onTownMap ? getTownMap(onTownMap.mapId) : null
  if (!townMap) return null
  return (
    <TownMapScene townMap={townMap} place={onTownMap} seaReach={SEA_REACH} />
  )
}

/**
 * Um mapa de cidade copiada posto em `place` (`{ x, y, z, scale }`): o
 * modelo e a água dele — o mar até `seaReach` m além da borda sul (zero:
 * só a água de dentro do mapa). Usado pelo lugar à parte (Pallet).
 */
export function TownMapScene({ townMap, place, seaReach }) {
  return (
    <Suspense fallback={null}>
      <group position={[place.x, place.y, place.z]} scale={place.scale}>
        <TownMapModel townMap={townMap} />
        <TownMapSea townMap={townMap} scale={place.scale} seaReach={seaReach} />
      </group>
    </Suspense>
  )
}

function TownMapModel({ townMap }) {
  const manifestText = useLoader(THREE.FileLoader, MANIFEST_PATH)
  const manifest = useMemo(() => JSON.parse(manifestText), [manifestText])
  const id = townMap.model
  const gltf = useGLTF(modelPath(id))
  const names = useMemo(() => lgpeTextureNames(manifest, [id]), [manifest, id])
  const textures = useTexture(names.map(texturePath))

  const built = useMemo(() => {
    const byName = new Map(
      names.map((name, index) => [
        name,
        prepareLgpeTexture(textures[index], manifest.textures[name]),
      ]),
    )
    const { models, disposables } = buildLgpeModels(
      manifest,
      { [id]: gltf.scene },
      (name) => byName.get(name) ?? null,
    )
    const materials = manifest.props[id].materials
    // O modelo foi gravado com o centro no meio e a base em zero; a
    // colisão (e o lugar) usam o mesmo espaço.
    const parts = models[id].parts.map((part) => ({
      ...part,
      // O chão misturado só recebe sombra.
      castShadow: !materials[part.materialName]?.layer,
    }))
    return { parts, disposables }
  }, [manifest, id, gltf, names, textures])

  useEffect(
    () => () => {
      for (const item of built.disposables) item.dispose()
    },
    [built],
  )

  return built.parts.map((part, index) => (
    <mesh
      key={index}
      geometry={part.geometry}
      material={part.material}
      castShadow={part.castShadow}
      receiveShadow
    />
  ))
}

/**
 * A água do mapa (`buildTownMapWaterGeometry`), no material dos rios —
 * `useFrame` só visual (as ondinhas e o céu refletido), como no
 * `WaterView`.
 */
function TownMapSea({ townMap, scale, seaReach }) {
  const [material] = useState(createWaterMaterial)
  useEffect(() => () => material.dispose(), [material])
  const geometry = useMemo(
    () =>
      buildTownMapWaterGeometry(
        townMapCollidersOf(townMap),
        scale,
        SHORE_REACH,
        seaReach,
        GAME_CONFIG.WATER.DEEP_DEPTH,
      ),
    [townMap, scale, seaReach],
  )
  useEffect(() => () => geometry?.dispose(), [geometry])
  useFrame((_, delta) => {
    applyWaterLook(material)
    updateWater(material, delta, reflectedSky())
  })
  if (!geometry) return null
  return <mesh geometry={geometry} material={material} receiveShadow />
}
