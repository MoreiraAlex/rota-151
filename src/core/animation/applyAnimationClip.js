import { evaluateCurve } from './curves'

const TWO_PI = Math.PI * 2
const ANIMATABLE_PROPERTIES = ['rotation', 'position', 'scale']

/**
 * Aplica um clipe de animação (dado declarativo — ver curves.js pros tipos de
 * curva disponíveis) a um conjunto de ossos resolvidos (ver resolveBones.js).
 *
 * Formato do clipe:
 * ```json
 * {
 *   "name": "quadruped-walk",
 *   "bones": {
 *     "frontRight": {
 *       "rotation": { "z": { "type": "sine", "amplitude": 0.5 } },
 *       "position": { "y": { "type": "absSine", "amplitude": 0.05 } }
 *     }
 *   }
 * }
 * ```
 * Cada osso pode animar `rotation`, `position` e/ou `scale` — cada uma com
 * suas próprias curvas por eixo. `clip.bones` usa os mesmos nomes semânticos
 * do mapa de ossos do modelo (não o nome real do osso) — por isso o mesmo
 * clipe funciona em qualquer rig que tenha um mapa de ossos com essas chaves,
 * sem reescrever nada.
 *
 * Cada eixo vira `rest[propriedade][eixo] + evaluateCurve(curva, t, freq)` —
 * nunca substitui a pose de descanso (ver resolveBones.js). Osso, propriedade
 * ou eixo do clipe sem correspondente no mapa resolvido é ignorado, não
 * lança erro.
 *
 * Antes de aplicar, **todo** osso do mapa volta pra pose de descanso. Sem
 * isso, um osso animado pelo clipe anterior (ex.: a perna no "walk") e
 * ausente do clipe atual (ex.: o "idle", que não mexe em perna) ficaria
 * travado no último valor que o clipe anterior escreveu, em vez de voltar a
 * ficar parado — é a troca de clipe que precisa ser "completa", não cada
 * clipe individualmente.
 */
export function applyAnimationClip(clip, bones, t, speed = 1) {
  const freq = speed * TWO_PI

  resetToRest(bones)

  for (const [boneName, properties] of Object.entries(clip.bones)) {
    const entry = bones[boneName]
    if (!entry) continue

    for (const [property, axes] of Object.entries(properties)) {
      const target = entry.bone[property]
      const rest = entry.rest[property]
      if (!target || !rest) continue

      for (const [axis, curve] of Object.entries(axes)) {
        target[axis] = rest[axis] + evaluateCurve(curve, t, freq)
      }
    }
  }
}

function resetToRest(bones) {
  for (const entry of Object.values(bones)) {
    if (!entry) continue

    for (const property of ANIMATABLE_PROPERTIES) {
      const target = entry.bone[property]
      const rest = entry.rest[property]
      if (!target || !rest) continue

      target.x = rest.x
      target.y = rest.y
      target.z = rest.z
    }
  }
}
