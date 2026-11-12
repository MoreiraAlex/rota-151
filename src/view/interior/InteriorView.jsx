'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { interiorCollidersOf, listInteriors } from '@/core/data/interiors'
import { useIndoors } from '@/view/hooks/useIndoors'
import {
  buildLgpeModels,
  lgpeTextureNames,
  prepareLgpeTexture,
} from '@/view/vegetation/lgpeModels'
import {
  INTERIOR_MANIFEST_PATH,
  applyInteriorBlend,
  castsInteriorShadow,
  interiorModelPath,
  interiorTexturePath,
} from './interiorModels'

/**
 * As salas por dentro dos prédios (docs/features/068-interior-dos-
 * predios.md): o modelo do Let's Go (`public/assets/interiors/lgpe/`) com
 * o mesmo material toon dos prédios da cidade, posto onde a sala fica no
 * mundo (`Indoors`: origem e escala), com os objetos soltos dela (a
 * máquina de cura do Pokécenter, `props` da colisão).
 *
 * Todas ficam montadas desde o começo, escondidas — os arquivos já chegam
 * antes do primeiro F numa porta —, e só a sala em que o treinador está
 * aparece.
 */
export function InteriorView() {
  const indoors = useIndoors()
  return listInteriors().map((interior) => (
    <Suspense key={interior.id} fallback={null}>
      <InteriorRoom
        interior={interior}
        place={indoors?.interiorId === interior.id ? indoors : null}
      />
    </Suspense>
  ))
}

function InteriorRoom({ interior, place }) {
  const manifestText = useLoader(THREE.FileLoader, INTERIOR_MANIFEST_PATH)
  const manifest = useMemo(() => JSON.parse(manifestText), [manifestText])
  // A sala e os objetos soltos dela (a máquina de cura), cada um onde o
  // `interiorColliders.json` diz.
  const placements = useMemo(
    () => [
      { model: interior.model, x: 0, y: 0, z: 0 },
      ...(interiorCollidersOf(interior).props ?? []),
    ],
    [interior],
  )
  const ids = useMemo(
    () => [...new Set(placements.map(({ model }) => model))],
    [placements],
  )
  const gltfs = useGLTF(ids.map(interiorModelPath))
  const names = useMemo(() => lgpeTextureNames(manifest, ids), [manifest, ids])
  const textures = useTexture(names.map(interiorTexturePath))

  const room = useMemo(() => {
    const byName = new Map(
      names.map((name, index) => [
        name,
        prepareLgpeTexture(textures[index], manifest.textures[name]),
      ]),
    )
    const { models, disposables } = buildLgpeModels(
      manifest,
      Object.fromEntries(ids.map((id, index) => [id, gltfs[index].scene])),
      (name) => byName.get(name) ?? null,
    )
    const partsOf = (id) => {
      const materials = manifest.props[id].materials
      return models[id].parts.map((part) => {
        const entry = materials[part.materialName] ?? {}
        applyInteriorBlend(part.material, entry)
        return { ...part, castShadow: castsInteriorShadow(part, entry) }
      })
    }
    const parts = Object.fromEntries(ids.map((id) => [id, partsOf(id)]))
    return { parts, disposables }
  }, [manifest, ids, gltfs, names, textures])

  useEffect(
    () => () => {
      for (const item of room.disposables) item.dispose()
    },
    [room],
  )

  return (
    <group
      visible={Boolean(place)}
      position={place ? [place.x, place.y, place.z] : [0, 0, 0]}
      scale={place?.scale ?? 1}
    >
      {placements.map(({ model, x, y, z }, placementIndex) => (
        <group key={placementIndex} position={[x, y, z]}>
          {room.parts[model].map((part, index) => (
            <mesh
              key={index}
              geometry={part.geometry}
              material={part.material}
              castShadow={part.castShadow}
              receiveShadow
            />
          ))}
        </group>
      ))}
    </group>
  )
}
