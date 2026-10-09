import { clamp } from './clamp'

/**
 * Passagem suave de 0 a 1 entre `edge0` e `edge1` (a `smoothstep` do GLSL).
 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
