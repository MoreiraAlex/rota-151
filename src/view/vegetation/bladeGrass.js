import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createRng } from '@/core/rng'
import { createToonMaterial } from './toonMaterial'

/**
 * Grama em fios (docs/features/066-revisao-dos-biomas.md): um tufo de
 * lâminas finas gerado por código, no lugar dos modelos de folha larga do
 * Let's Go — o tapete de grama dos jogos atuais (Scarlet/Violet). Entra na
 * vegetação como um modelo a mais (`BLADE_GRASS_ID`, categoria
 * `tall-grass`): o bioma escolhe nos `models` da grama, como os do LGPE.
 *
 * Usa o mesmo material toon das plantas (vento, abrir ao passar, base
 * escura). Como no stylized-scene, o tufo não vira para a câmera: fica de
 * pé, parado, no giro sorteado da instância, e as lâminas apontam cada uma
 * para um lado (uma moita, que aparece de qualquer ângulo); a curva vem só
 * do vento, para o mesmo lado do mundo em todo tufo (`vegGrassSway`). As
 * normais apontam para cima (a luz é a do chão, igual dos dois lados da
 * lâmina) e a cor por vértice clareia da raiz para a ponta, com cada
 * lâmina num tom. A cor base é
 * `GRASS_BLADES.COLOR`, ao vivo (`applyToonLook`); a forma do tufo é
 * refeita ao pedir (`refazerGramaEmFios`).
 */

export const BLADE_GRASS_ID = 'blade-grass'

/** A entrada do manifesto (o painel lista, a vegetação monta). */
export function bladeGrassProp(params = GAME_CONFIG.GRASS_BLADES) {
  return {
    label: 'Grama em fios (gerada)',
    category: 'tall-grass',
    size: [params.RADIUS * 2, params.HEIGHT, params.RADIUS * 2],
    materials: { blades: { maps: {}, cutoff: null, doubleSided: true } },
    procedural: true,
  }
}

/** O manifesto com os modelos gerados por código (a grama em fios). */
export function withProceduralProps(manifest) {
  if (manifest.props?.[BLADE_GRASS_ID]) return manifest
  return {
    ...manifest,
    props: { ...manifest.props, [BLADE_GRASS_ID]: bladeGrassProp() },
  }
}

/** O id é de um modelo gerado por código (sem arquivo)? */
export const isProceduralProp = (manifest, id) =>
  Boolean(manifest.props?.[id]?.procedural)

/**
 * O tufo: `COUNT` lâminas espalhadas num disco de `RADIUS` (mais juntas no
 * meio), cada uma uma tira reta virada para um lado sorteado, afinando até
 * a ponta, em `SEGMENTS` partes (a curva do vento), de altura sorteada em
 * volta de `HEIGHT` (`HEIGHT_VARIATION`), com o tom indo de `ROOT_SHADE` a
 * `TIP_SHADE`. Base em y = 0.
 *
 * @returns {THREE.BufferGeometry}
 */
export function createBladeTuftGeometry(params = GAME_CONFIG.GRASS_BLADES) {
  const {
    COUNT,
    RADIUS,
    HEIGHT,
    HEIGHT_VARIATION,
    WIDTH,
    SEGMENTS,
    ROOT_SHADE,
    TIP_SHADE,
  } = params
  const random = createRng(params.SEED ?? 7)
  const positions = []
  const colors = []
  const indices = []
  for (let blade = 0; blade < COUNT; blade++) {
    const distance = Math.sqrt(random()) * RADIUS
    const angle = random() * Math.PI * 2
    const baseX = Math.cos(angle) * distance
    const baseZ = Math.sin(angle) * distance
    const height = HEIGHT * (1 + (random() * 2 - 1) * HEIGHT_VARIATION)
    const width = WIDTH * (0.7 + random() * 0.6)
    const tone = 0.85 + random() * 0.3
    // O lado para onde a lâmina vira (a largura vai no eixo girado).
    const turn = random() * Math.PI * 2
    const acrossX = Math.cos(turn)
    const acrossZ = -Math.sin(turn)
    const first = positions.length / 3
    for (let step = 0; step <= SEGMENTS; step++) {
      const t = step / SEGMENTS
      const y = height * t
      const half = (width / 2) * (1 - t * 0.92)
      const shade = tone * (ROOT_SHADE + (TIP_SHADE - ROOT_SHADE) * t)
      positions.push(
        baseX - acrossX * half,
        y,
        baseZ - acrossZ * half,
        baseX + acrossX * half,
        y,
        baseZ + acrossZ * half,
      )
      colors.push(shade, shade, shade, shade, shade, shade)
    }
    for (let step = 0; step < SEGMENTS; step++) {
      const a = first + step * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return geometry
}

/**
 * O modelo da grama em fios no formato da vegetação (`VegetationModel`):
 * uma parte, sem sombra própria (planta baixa), no material toon.
 */
export function buildBladeGrassModel(disposables) {
  const params = GAME_CONFIG.GRASS_BLADES
  const geometry = createBladeTuftGeometry(params)
  const material = createToonMaterial({
    map: null,
    cutoff: null,
    doubleSided: true,
    vertexColors: true,
    rimColor: null,
    rim: null,
    sway: 'plant',
    push: 'grass',
    billboard: false,
    fade: true,
    height: params.HEIGHT,
  })
  material.userData.bladeGrass = true
  material.color.set(params.COLOR)
  disposables.push(geometry, material)
  return {
    name: BLADE_GRASS_ID,
    category: 'tall-grass',
    parts: [{ kind: 'toon-low', geometry, material, materialName: 'blades' }],
  }
}

// A forma do tufo muda ao pedir: quem monta os modelos ouve a revisão.
let revision = 0
const listeners = new Set()

/** Refaz o tufo com os números de agora (`GRASS_BLADES`). */
export function refazerGramaEmFios() {
  revision += 1
  for (const listener of listeners) listener()
}

export const getBladeGrassRevision = () => revision

export function subscribeBladeGrass(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
