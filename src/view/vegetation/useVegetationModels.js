import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import {
  LGPE_MANIFEST_PATH,
  buildLgpeModels,
  mergeLgpeManifests,
  withBorrowedLeaves,
  lgpePropPath,
  lgpeTextureNames,
  lgpeTexturePath,
  prepareLgpeTexture,
  usedLgpeIds,
} from './lgpeModels'
import { getReadyLgpeIds, subscribeLgpeChoices } from './lgpeChoices'
import {
  BLADE_GRASS_ID,
  getBladeGrassRevision,
  isProceduralProp,
  subscribeBladeGrass,
  withProceduralProps,
} from './bladeGrass'

/**
 * Modelos e materiais da vegetação, prontos para as malhas instanciadas:
 * os do Pokémon Let's Go (docs/features/052-assets-do-lgpe-e-floresta.md)
 * que os biomas usam. Carrega os `.glb` e as texturas (o drei guarda no
 * cache e suspende até chegarem), monta as partes com o material toon e
 * os libera ao desmontar. O que é do cache do drei (geometrias e texturas
 * dos `.glb`) não é liberado aqui.
 *
 * @typedef {object} ModelPart
 * @property {'toon' | 'toon-low'} kind - com e sem sombra
 * @property {THREE.BufferGeometry} geometry
 * @property {THREE.Material} material
 * @property {string} [materialName] - o material do jogo original
 *
 * @typedef {{ name: string, category?: string, parts: ModelPart[],
 *   far?: VegetationModel }} VegetationModel
 */

// Os modelos do LGPE que os biomas usam (`models` das entradas).
const LGPE_IDS = usedLgpeIds()

// Libera ao desmontar o que `build` criou (`disposables`).
function useOwned(build, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(build, deps)
  useEffect(
    () => () => {
      for (const item of value.disposables) item.dispose()
    },
    [value],
  )
  return value
}

export function useLgpeManifest() {
  const manifestText = useLoader(THREE.FileLoader, LGPE_MANIFEST_PATH)
  // Com os pacotes de fora, se houver (`registerExtraLgpePack`,
  // docs/features/066-revisao-dos-biomas.md) — as árvores deles com as
  // folhas do LGPE (`withBorrowedLeaves`) —, e os gerados por código (a
  // grama em fios, bladeGrass.js).
  return useMemo(
    () =>
      withProceduralProps(
        withBorrowedLeaves(mergeLgpeManifests(JSON.parse(manifestText))),
      ),
    [manifestText],
  )
}

// Os `.glb` e as texturas dos modelos `allIds` (suspende até chegarem); os
// gerados por código não têm arquivo e ficam de fora (`ids`: os com).
export function useLgpeFiles(manifest, allIds) {
  const ids = useMemo(
    () => allIds.filter((id) => !isProceduralProp(manifest, id)),
    [manifest, allIds],
  )
  const gltfs = useGLTF(ids.map(lgpePropPath))
  const names = useMemo(() => lgpeTextureNames(manifest, ids), [manifest, ids])
  const textures = useTexture(names.map(lgpeTexturePath))
  return { gltfs, names, textures, ids }
}

/**
 * Os modelos do LGPE (docs/features/052-assets-do-lgpe-e-floresta.md) que
 * os biomas usam, mais os que o painel pediu e já carregaram
 * (`lgpeChoices.js`): o manifesto, os `.glb` e as texturas deles, montados
 * com o material toon (`lgpeModels.js`).
 */
function useLgpeModels() {
  const manifest = useLgpeManifest()
  const readyIds = useSyncExternalStore(
    subscribeLgpeChoices,
    getReadyLgpeIds,
    getReadyLgpeIds,
  )
  // A grama em fios se refaz quando a forma do tufo muda (o lab pede).
  const bladeRevision = useSyncExternalStore(
    subscribeBladeGrass,
    getBladeGrassRevision,
    getBladeGrassRevision,
  )
  const allIds = useMemo(
    () => [...new Set([...LGPE_IDS, ...readyIds])],
    [readyIds],
  )
  const { gltfs, names, textures, ids } = useLgpeFiles(manifest, allIds)
  // Os gerados por código entram sem mudar os arquivos: contam à parte.
  const proceduralKey = allIds
    .filter((id) => isProceduralProp(manifest, id))
    .join(',')
  return useOwned(() => {
    const byName = new Map(
      names.map((name, index) => [
        name,
        prepareLgpeTexture(textures[index], manifest.textures[name]),
      ]),
    )
    return buildLgpeModels(
      manifest,
      Object.fromEntries(ids.map((id, index) => [id, gltfs[index].scene])),
      (name) => byName.get(name) ?? null,
      proceduralKey ? proceduralKey.split(',') : [],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, gltfs, textures, bladeRevision, proceduralKey])
}

/**
 * @returns {{ lgpe: Record<string, VegetationModel>,
 *   lgpeMaterials: THREE.Material[] }}
 */
export function useVegetationModels() {
  const lgpe = useLgpeModels()

  // O mesmo objeto enquanto os modelos não mudam: as malhas de grama e de
  // chunk dependem dele, e um objeto novo a cada render remontava a
  // vegetação inteira a cada bloco de grama ou chunk que entrava.
  return useMemo(
    () => ({ lgpe: lgpe.models, lgpeMaterials: lgpe.materials }),
    [lgpe],
  )
}

/**
 * Pede de antemão os `.glb` dos modelos que os biomas usam. Chamar depois
 * de registrar os pacotes de fora (`loadVegetationPacks`): antes, os
 * modelos deles seriam pedidos na pasta do LGPE (e dariam 404).
 */
export function preloadVegetationModels() {
  useGLTF.preload(
    LGPE_IDS.filter((id) => id !== BLADE_GRASS_ID).map(lgpePropPath),
  )
}
