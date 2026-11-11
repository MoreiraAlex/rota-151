import { GAME_CONFIG } from '@/core/gameConfig'
import { skipCharacters } from './characterStencil'

/**
 * O aviso de golpe por cima da grama e dos arbustos (docs/features/066-
 * revisao-dos-biomas.md): o golpe não colide com eles, então o aviso não
 * pode sumir atrás deles. No vertex shader, a profundidade do aviso (no
 * chão) é puxada para a câmera o bastante para passar à frente de uma
 * camada de `OVER_PLANTS.HEIGHT` m acima do chão — o raio da câmera até o
 * chão atravessa essa camada num trecho maior quanto mais baixa a câmera
 * (altura ÷ seno do ângulo dela, com o ângulo no mínimo `MIN_ANGLE`). O
 * lugar na tela não muda, só a profundidade: pedra e tronco mais altos que
 * a camada continuam tampando. Os personagens não ficam por baixo do aviso
 * (`skipCharacters`, stencil).
 *
 * Aplicar antes do primeiro desenho do material.
 */
export function applyOverPlants(material) {
  skipCharacters(material)
  const uniforms = {
    uOverPlantsHeight: { value: 0 },
    uOverPlantsMinSin: { value: 0.2 },
  }
  material.userData.overPlants = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader =
      `uniform float uOverPlantsHeight;\nuniform float uOverPlantsMinSin;\n` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
{
  float viewDistance = length(mvPosition.xyz);
  vec3 viewRay = mvPosition.xyz / max(viewDistance, 1e-4);
  vec3 upView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float rise = max(abs(dot(viewRay, upView)), uOverPlantsMinSin);
  float pull = min(uOverPlantsHeight / rise, viewDistance * 0.9);
  vec4 pulled = projectionMatrix * vec4(viewRay * (viewDistance - pull), 1.0);
  gl_Position.z = pulled.z / pulled.w * gl_Position.w;
}`,
      )
  }
  material.customProgramCacheKey = () => 'over-plants'
  updateOverPlants(material)
  return material
}

/** Passa os números do config (`FEEDBACK.ATTACK_TELEGRAPH.OVER_PLANTS`). */
export function updateOverPlants(material) {
  const uniforms = material.userData.overPlants
  if (!uniforms) return
  const { ENABLED, HEIGHT, MIN_ANGLE } =
    GAME_CONFIG.FEEDBACK.ATTACK_TELEGRAPH.OVER_PLANTS
  uniforms.uOverPlantsHeight.value = ENABLED ? HEIGHT : 0
  uniforms.uOverPlantsMinSin.value = Math.sin(MIN_ANGLE)
}
