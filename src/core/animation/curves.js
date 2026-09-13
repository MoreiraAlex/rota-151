import { clamp } from '@/core/math'

const TWO_PI = Math.PI * 2

/**
 * Avaliadores de curva — os "tipos de movimento" que um clipe JSON pode
 * descrever por osso/eixo (ver applyAnimationClip.js). Nada de string de
 * expressão livre (ao contrário do Molang do Cobblemon): cada tipo é uma
 * fórmula fixa e segura, parametrizada por número. Cobre os mesmos padrões
 * que o Cobblemon usa por trás (seno, seno limitado, soma de senos) sem
 * precisar interpretar código arbitrário.
 *
 * - constant: valor fixo.
 * - sine: onda senoidal — amplitude * sin(ângulo).
 * - clampedSine: como sine, mas o resultado é limitado a [min, max]. É o que
 *   dá o "só sobe na metade do ciclo" (o Cobblemon faz isso com
 *   math.clamp(math.sin(...), min, max)).
 * - absSine: |sine| — duas "batidas" positivas por ciclo em vez de uma
 *   positiva e uma negativa. Bom pra afundo de quadril/corpo.
 * - sum: soma várias curvas — pra combinar padrões (ex.: dois senos com
 *   frequências diferentes, como o Cobblemon faz na perna do Bulbasaur).
 *
 * `frequencyScale`, `phaseTurns` e `timeOffset` são opcionais em todo tipo
 * baseado em seno: `phaseTurns` desloca em fração de ciclo (0.5 = meio ciclo,
 * equivalente a π radianos) — mais fácil de escrever à mão que radianos.
 * `timeOffset` desloca em segundos (fixo, não escala com a velocidade) — é o
 * que dá o efeito de atraso/chicote entre segmentos de um rabo, por exemplo.
 */
export function evaluateCurve(curve, t, freq) {
  switch (curve.type) {
    case 'constant':
      return curve.value ?? 0
    case 'sine':
      return sineWave(curve, t, freq)
    case 'clampedSine':
      return clamp(sineWave(curve, t, freq), curve.min, curve.max)
    case 'absSine':
      return Math.abs(sineWave(curve, t, freq))
    case 'sum':
      return curve.curves.reduce(
        (total, inner) => total + evaluateCurve(inner, t, freq),
        0,
      )
    default:
      return 0
  }
}

function sineWave(curve, t, freq) {
  const angle =
    (t - (curve.timeOffset ?? 0)) * freq * (curve.frequencyScale ?? 1) +
    (curve.phaseTurns ?? 0) * TWO_PI
  return Math.sin(angle) * curve.amplitude
}
