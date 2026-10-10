import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { SHARED_TEXTURES, VEGETATION_MODELS } from './vegetationAssets'
import { MODEL_NAMES, buildVegetationModels } from './useVegetationModels'

// Sem carregar nada: só as funções puras de montar os modelos.
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(() => ({}), { preload: () => {} }),
  useTexture: () => ({}),
}))

const [sharedMaterial] = Object.keys(SHARED_TEXTURES)
const CROPPED_MATERIAL = 'Flowers'

// Uma cena de `.glb` falsa: uma malha com o material `name` e uma textura
// própria.
function sceneWith(name) {
  const material = new THREE.MeshStandardMaterial({
    name,
    map: new THREE.Texture(),
  })
  const scene = new THREE.Group()
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material))
  return scene
}

describe('buildVegetationModels — texturas', () => {
  it('textura recortada é a do próprio modelo, mesmo com o mesmo nome de material', () => {
    const scenes = MODEL_NAMES.map(() => sceneWith(CROPPED_MATERIAL))
    const { kinds } = buildVegetationModels(scenes)
    const maps = VEGETATION_MODELS.flower.map(
      (_, index) => kinds.flower[index].parts[0].material.map,
    )
    expect(new Set(maps).size).toBe(maps.length)
  })

  it('seixo usa o material da pedra (cor e sombra do `ROCKS`)', () => {
    const scenes = MODEL_NAMES.map(() => sceneWith('PathRocks'))
    const { kinds } = buildVegetationModels(scenes)
    const [part] = kinds.pebble[0].parts
    expect(part.kind).toBe('pebble')
    expect(part.material.customProgramCacheKey()).toBe('vegetation-mossy-rock')
  })

  it('arquivo dividido vira uma textura só', () => {
    const scenes = MODEL_NAMES.map(() => sceneWith(sharedMaterial))
    const { kinds } = buildVegetationModels(scenes)
    const maps = Object.values(kinds)
      .flat()
      .map(({ parts }) => parts[0].material.map)
    expect(new Set(maps).size).toBe(1)
  })
})
