import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Ver o alvo através dos objetos (docs/features/052-assets-do-lgpe-e-
 * floresta.md): só o chão aproxima a câmera (`resolveCameraCollision`); o
 * que fica entre ela e o alvo — árvores, pedras, plantas, caixas — some em
 * pontilhado dentro de um cilindro em volta da linha câmera → alvo
 * (`CAMERA.SEE_THROUGH`). Pontilhado (descarta pixels por um ruído de
 * tela) em vez de transparência de verdade: sem ordenar nada e sem mexer
 * na sombra (o material de sombra é outro).
 *
 * Os materiais incluem o pedaço com `addSeeThrough(shader)` no
 * `onBeforeCompile`; `seeThroughUniforms` são os mesmos objetos em todos,
 * atualizados uma vez por quadro (`seeThroughSystem`).
 */

export const seeThroughUniforms = {
  uSeeCamera: { value: new THREE.Vector3() },
  uSeeTarget: { value: new THREE.Vector3() },
  // x: raio, y: borda, z: opacidade, w: folga no alvo.
  uSeeShape: { value: new THREE.Vector4() },
  // 0 desliga (primeira pessoa, `ENABLED` falso).
  uSeeEnabled: { value: 0 },
}

const VERTEX_HEADER = /* glsl */ `
varying vec3 vSeeWorld;
`

// Depois do `project_vertex` (todos os materiais da cena têm o de neblina
// logo depois): a posição de mundo do vértice, com a instância.
const VERTEX = /* glsl */ `
#include <fog_vertex>
vec4 seeLocal = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
seeLocal = instanceMatrix * seeLocal;
#endif
vSeeWorld = (modelMatrix * seeLocal).xyz;
`

const FRAGMENT_HEADER = /* glsl */ `
uniform vec3 uSeeCamera;
uniform vec3 uSeeTarget;
uniform vec4 uSeeShape;
uniform float uSeeEnabled;
varying vec3 vSeeWorld;

// Quanto do pixel fica (1 = tudo): dentro do cilindro câmera → alvo,
// a opacidade; fora, ou atrás do alvo, tudo.
float seeThroughOpacity(vec3 p) {
  vec3 line = uSeeTarget - uSeeCamera;
  float len = length(line);
  if (uSeeEnabled < 0.5 || len < 1e-3) return 1.0;
  vec3 dir = line / len;
  float along = dot(p - uSeeCamera, dir);
  if (along <= 0.0 || along >= len) return 1.0;
  float away = length(p - (uSeeCamera + dir * along));
  float inside = 1.0 - smoothstep(uSeeShape.x - uSeeShape.y, uSeeShape.x, away);
  float beforeTarget = smoothstep(0.0, max(uSeeShape.w, 1e-3), len - along);
  return mix(1.0, uSeeShape.z, inside * beforeTarget);
}

// Ruído de tela (interleaved gradient noise): o pontilhado.
float seeThroughDither(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}
`

const FRAGMENT = /* glsl */ `
#include <clipping_planes_fragment>
if (seeThroughOpacity(vSeeWorld) <= seeThroughDither(gl_FragCoord.xy)) discard;
`

/** Põe o ver-através no `shader` (dentro do `onBeforeCompile`). */
export function addSeeThrough(shader) {
  Object.assign(shader.uniforms, seeThroughUniforms)
  shader.vertexShader = (VERTEX_HEADER + shader.vertexShader).replace(
    '#include <fog_vertex>',
    VERTEX,
  )
  shader.fragmentShader = (FRAGMENT_HEADER + shader.fragmentShader).replace(
    '#include <clipping_planes_fragment>',
    FRAGMENT,
  )
}

/**
 * Atualiza os uniforms: a câmera em `camera`, o alvo em `target` (o ponto
 * que ela segue); `enabled` falso desliga (primeira pessoa).
 */
export function setSeeThrough(camera, target, enabled) {
  const { ENABLED, RADIUS, EDGE, OPACITY, TARGET_GAP } =
    GAME_CONFIG.CAMERA.SEE_THROUGH
  seeThroughUniforms.uSeeCamera.value.copy(camera)
  seeThroughUniforms.uSeeTarget.value.copy(target)
  seeThroughUniforms.uSeeShape.value.set(RADIUS, EDGE, OPACITY, TARGET_GAP)
  seeThroughUniforms.uSeeEnabled.value = ENABLED && enabled ? 1 : 0
}

/**
 * Liga o ver-através num material pronto (soma ao `onBeforeCompile` dele e
 * separa o programa no cache). Chamar de novo no mesmo material não faz
 * nada.
 */
export function withSeeThrough(material) {
  if (material.userData.seeThrough) return material
  material.userData.seeThrough = true
  const compile = material.onBeforeCompile
  const cacheKey = material.customProgramCacheKey
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer)
    addSeeThrough(shader)
  }
  material.customProgramCacheKey = () =>
    `${cacheKey.call(material)}-see-through`
  material.needsUpdate = true
  return material
}
