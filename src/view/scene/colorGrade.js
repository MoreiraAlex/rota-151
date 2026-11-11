/**
 * Correção de cor no fim da imagem (docs/features/066-revisao-dos-
 * biomas.md): uma etapa do pós-processamento (`RenderSettingsView`) que
 * lê a imagem já com a curva de cor e em cor de tela e aplica, nesta
 * ordem, exposição, temperatura, contraste, saturação e gama
 * (`GAME_CONFIG.RENDER.GRADE`).
 */

/** Os valores que não mudam nada. */
export const NEUTRAL_GRADE = Object.freeze({
  SATURATION: 1,
  CONTRAST: 1,
  EXPOSURE: 0,
  GAMMA: 1,
  TEMPERATURE: 0,
})

const EPSILON = 1e-4

/** A correção não muda nada (a etapa nem precisa rodar)? */
export function isNeutralGrade(grade) {
  if (!grade) return true
  return Object.entries(NEUTRAL_GRADE).every(
    ([key, neutral]) => Math.abs((grade[key] ?? neutral) - neutral) < EPSILON,
  )
}

// Quanto a temperatura puxa o vermelho e o azul no extremo (±1).
const TEMPERATURE_REACH = 0.12

/**
 * A correção de uma cor de tela (0 a 1 por canal) — a mesma conta do
 * shader, para testar.
 *
 * @param {number[]} rgb
 * @param {typeof NEUTRAL_GRADE} grade
 * @returns {number[]}
 */
export function gradeColor(rgb, grade) {
  const exposure = 2 ** grade.EXPOSURE
  let [r, g, b] = rgb.map((channel) => channel * exposure)
  r *= 1 + TEMPERATURE_REACH * grade.TEMPERATURE
  b *= 1 - TEMPERATURE_REACH * grade.TEMPERATURE
  ;[r, g, b] = [r, g, b].map(
    (channel) => (channel - 0.5) * grade.CONTRAST + 0.5,
  )
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
  ;[r, g, b] = [r, g, b].map(
    (channel) => luma + (channel - luma) * grade.SATURATION,
  )
  return [r, g, b].map(
    (channel) => Math.min(1, Math.max(0, channel)) ** (1 / grade.GAMMA),
  )
}

/** O shader da etapa (para o `ShaderPass`). */
export function createColorGradeShader() {
  return {
    name: 'ColorGrade',
    uniforms: {
      tDiffuse: { value: null },
      uSaturation: { value: 1 },
      uContrast: { value: 1 },
      uExposure: { value: 1 },
      uGamma: { value: 1 },
      uTemperature: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uSaturation;
      uniform float uContrast;
      uniform float uExposure;
      uniform float uGamma;
      uniform float uTemperature;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec3 color = texel.rgb * uExposure;
        color.r *= 1.0 + ${TEMPERATURE_REACH.toFixed(4)} * uTemperature;
        color.b *= 1.0 - ${TEMPERATURE_REACH.toFixed(4)} * uTemperature;
        color = (color - 0.5) * uContrast + 0.5;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = luma + (color - luma) * uSaturation;
        color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / uGamma));
        gl_FragColor = vec4(color, texel.a);
      }
    `,
  }
}

/** Põe os valores do `grade` nos uniforms do shader. */
export function applyColorGrade(uniforms, grade) {
  uniforms.uSaturation.value = grade.SATURATION
  uniforms.uContrast.value = grade.CONTRAST
  uniforms.uExposure.value = 2 ** grade.EXPOSURE
  uniforms.uGamma.value = grade.GAMMA
  uniforms.uTemperature.value = grade.TEMPERATURE
}
