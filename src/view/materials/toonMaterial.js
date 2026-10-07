import * as THREE from 'three'

import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Visual toon (estilo Zelda BotW): luz cortada em poucos tons chapados,
 * brilho de borda (rim) e contorno da silhueta por casca invertida.
 *
 * Tudo aqui é VIEW — o core nunca vê material nem shader. Quem aplica é
 * `useAnimatedModel.js`, uma vez por modelo clonado (e devolve o material
 * original no cleanup); o resto da view (tint em `CreatureView.jsx`, hit
 * flash via `material.emissive`, troca de `.map` por textura) continua
 * funcionando, porque `MeshToonMaterial` tem `color`, `map` e `emissive`
 * como o `MeshStandardMaterial` do `.glb`.
 *
 * O rim e o contorno são CLASSES (não `onBeforeCompile` pendurado na
 * instância): o `material.clone()` do three recria pelo construtor e não
 * copia funções da instância — com o gancho solto, o primeiro clone (hit
 * flash, tint) perdia o shader e o rim/contorno sumia.
 */

const { RENDER } = GAME_CONFIG

// Rampa de luz compartilhada por todos os materiais toon (não é dona de
// nenhuma entidade — nunca sofre dispose por consumidor, mesma regra de
// asset compartilhado do docs/rules/README.md, 5.3).
const toonRamp = new THREE.DataTexture(
  new Uint8Array(RENDER.TOON_RAMP),
  RENDER.TOON_RAMP.length,
  1,
  THREE.RedFormat,
)
toonRamp.minFilter = THREE.NearestFilter
toonRamp.magFilter = THREE.NearestFilter
toonRamp.generateMipmaps = false
toonRamp.needsUpdate = true

const rimColor = new THREE.Color(RENDER.RIM_COLOR)

/**
 * `MeshToonMaterial` com brilho de borda: acende onde a superfície vira de
 * lado pra câmera, numa faixa estreita (`RENDER.RIM_EDGE`) — dá o corte seco
 * do toon em vez de um degradê.
 */
export class ToonRimMaterial extends THREE.MeshToonMaterial {
  constructor(parameters) {
    super(parameters)
    this.onBeforeCompile = (shader) => {
      const [edgeStart, edgeEnd] = RENDER.RIM_EDGE
      shader.uniforms.rimColor = { value: rimColor }
      shader.uniforms.rimStrength = { value: RENDER.RIM_STRENGTH }
      shader.uniforms.rimEdge = { value: new THREE.Vector2(edgeStart, edgeEnd) }
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform vec2 rimEdge;\nvoid main() {',
        )
        .replace(
          '#include <dithering_fragment>',
          `float rim = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        gl_FragColor.rgb += rimColor * smoothstep(rimEdge.x, rimEdge.y, rim) * rimStrength;
        #include <dithering_fragment>`,
        )
    }
  }

  // Toda instância compartilha o MESMO programa de shader (sem isso o three
  // compilaria um por material clonado).
  customProgramCacheKey() {
    return 'toon-rim'
  }
}

/**
 * Casca do contorno: cor chapada, faces de dentro (`BackSide`), vértices
 * empurrados ao longo da normal por `RENDER.OUTLINE_WIDTH`.
 */
export class OutlineMaterial extends THREE.MeshBasicMaterial {
  constructor(parameters) {
    super({ color: RENDER.OUTLINE_COLOR, side: THREE.BackSide, ...parameters })
    this.onBeforeCompile = (shader) => {
      shader.uniforms.outlineWidth = { value: RENDER.OUTLINE_WIDTH }
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'uniform float outlineWidth;\nvoid main() {')
        .replace(
          '#include <begin_vertex>',
          'vec3 transformed = vec3(position) + normalize(objectNormal) * outlineWidth;',
        )
    }
  }

  customProgramCacheKey() {
    return 'toon-outline'
  }
}

/**
 * Converte o material vindo do `.glb` num material toon NOVO, copiando o que
 * define a aparência (textura, cor, cores por vértice, transparência). O
 * material original não é alterado — vem do cache do `useGLTF`. Quem chama é
 * dono do material devolvido (`dispose()` no cleanup).
 */
export function toToonMaterial(source) {
  const Material =
    RENDER.RIM_STRENGTH > 0 ? ToonRimMaterial : THREE.MeshToonMaterial
  return new Material({
    name: source.name,
    map: source.map ?? null,
    color: source.color ? source.color.clone() : new THREE.Color(0xffffff),
    vertexColors: source.vertexColors ?? false,
    transparent: source.transparent ?? false,
    opacity: source.opacity ?? 1,
    alphaTest: source.alphaTest ?? 0,
    side: source.side ?? THREE.FrontSide,
    gradientMap: toonRamp,
  })
}

/**
 * Quem ganha contorno: todo mesh, menos materiais transparentes e os
 * listados em `RENDER.OUTLINE_SKIP` (por nome de material — ex.: o fogo
 * da cauda, que é efeito e não "corpo").
 */
export function shouldOutline(mesh) {
  const { material } = mesh
  if (!material || material.transparent) return false
  return !RENDER.OUTLINE_SKIP.some((name) => material.name?.includes(name))
}

/**
 * Contorno da silhueta: cópia do mesh com `OutlineMaterial`. Em
 * `SkinnedMesh`, liga no MESMO esqueleto — o contorno acompanha qualquer
 * animação sem custo extra de lógica. Geometria é compartilhada com o mesh
 * original.
 */
export function createOutline(mesh) {
  const material = new OutlineMaterial()
  const outline = mesh.isSkinnedMesh
    ? new THREE.SkinnedMesh(mesh.geometry, material)
    : new THREE.Mesh(mesh.geometry, material)
  if (mesh.isSkinnedMesh) outline.bind(mesh.skeleton, mesh.bindMatrix)

  outline.name = `${mesh.name}-outline`
  outline.userData.isOutline = true
  outline.position.copy(mesh.position)
  outline.quaternion.copy(mesh.quaternion)
  outline.scale.copy(mesh.scale)
  outline.castShadow = false
  outline.receiveShadow = false
  outline.frustumCulled = mesh.frustumCulled
  mesh.parent.add(outline)
  return outline
}

/**
 * Contornos são meshes de verdade na cena — quem percorre `cloned` atrás de
 * meshes "do modelo" (índice de textura por ordem de encontro, tint, hit
 * flash) precisa pular eles, senão a ordem desloca e a textura cai no
 * mesh errado.
 */
export function isOutline(object) {
  return object.userData?.isOutline === true
}

/** Remove o contorno da cena e libera o material próprio (não a geometria, que é do mesh original). */
export function disposeOutline(outline) {
  outline.removeFromParent()
  outline.material.dispose()
}

/**
 * Aplica o visual toon nos meshes de um modelo clonado: troca cada material
 * por um toon próprio e cria os contornos. Devolve a função que desfaz tudo
 * (contornos fora, material original de volta, toons liberados) — o cleanup
 * do efeito que aplicou. Desfazer também deixa o efeito seguro pra rodar de
 * novo (StrictMode), sem converter toon em toon.
 */
export function applyToonLook(meshes) {
  const originals = meshes.map((mesh) => mesh.material)
  // os toons criados aqui — o mesh pode ter trocado de material depois (hit
  // flash e tint clonam), então quem é liberado é o que ESTE efeito criou
  const toons = originals.map(toToonMaterial)
  meshes.forEach((mesh, index) => {
    mesh.material = toons[index]
  })
  const outlines = meshes.filter(shouldOutline).map(createOutline)

  return () => {
    for (const outline of outlines) disposeOutline(outline)
    for (const toon of toons) toon.dispose()
    meshes.forEach((mesh, index) => {
      mesh.material = originals[index]
    })
  }
}
