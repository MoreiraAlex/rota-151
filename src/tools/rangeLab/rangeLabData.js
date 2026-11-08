/**
 * Contas do laboratório de alcance (docs/features/062-spawn-estilo-
 * cobblemon.md), sem Three nem world.
 */

/** O alcance de um som: o do config dele ou o padrão. */
export function resolveSoundRange(config, defaults) {
  return {
    refDistance: config?.refDistance ?? defaults.refDistance,
    maxDistance: config?.maxDistance ?? defaults.maxDistance,
  }
}

/**
 * Os anéis da cena e do mapa, do menor para o maior: limites no mesmo raio
 * viram um anel só, com os nomes juntos. Entrada: `{ radius, label, color }`.
 */
export function buildRangeRings(limits) {
  const byRadius = new Map()
  for (const { radius, label, color } of limits) {
    const ring = byRadius.get(radius)
    if (ring) ring.labels.push(label)
    else byRadius.set(radius, { radius, color, labels: [label] })
  }
  return [...byRadius.values()].sort((a, b) => a.radius - b.radius)
}

/**
 * Um passo do "ir e voltar" entre `from` e `to` (em qualquer ordem): anda e,
 * ao chegar numa ponta, vira.
 */
export function stepShuttle(distance, direction, { from, to, speed }, delta) {
  const near = Math.min(from, to)
  const far = Math.max(from, to)
  const next = distance + direction * speed * delta
  if (next >= far) return { distance: far, direction: -1 }
  if (next <= near) return { distance: near, direction: 1 }
  return { distance: next, direction }
}

/**
 * Acompanha um som enquanto ele toca: `update` a cada quadro, com
 * `{ playing, distance, peak, left, right, bearing }` (`left`/`right` = pico
 * de cada canal, `bearing` = de onde vem, `bearingFrom`). Ao terminar,
 * devolve o resumo `{ distance, bearing, peak, left, right, clicked }`, com
 * distância e rumo do começo; antes disso, `null`. `clicked` = saiu som
 * acima de `threshold` estando fora do alcance do começo ao fim (é o estalo:
 * quem entra no alcance no meio do som toca de verdade).
 */
export function createPlayWatcher({ maxDistance, threshold }) {
  let current = null
  return {
    update({ playing, distance, peak, left = 0, right = 0, bearing = 0 }) {
      if (playing) {
        current ??= {
          distance,
          bearing,
          peak: 0,
          left: 0,
          right: 0,
          stayedOut: true,
        }
        current.peak = Math.max(current.peak, peak)
        current.left = Math.max(current.left, left)
        current.right = Math.max(current.right, right)
        if (distance < maxDistance) current.stayedOut = false
        return null
      }
      if (!current) return null
      const { stayedOut, ...summary } = current
      current = null
      return { ...summary, clicked: stayedOut && summary.peak > threshold }
    },
  }
}

const DEGREES = Math.PI / 180

/** Leva um ângulo (graus) para o intervalo de meia volta para cada lado. */
export function wrapAngle(angle) {
  const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

/**
 * O ponto do chão a `distance` da câmera, `angle` graus à direita da frente
 * do lab (para onde a câmera olha ao abrir: +z, com a direita em −x).
 */
export function pointAround(distance, angle) {
  const radians = angle * DEGREES
  return { x: -Math.sin(radians) * distance, z: Math.cos(radians) * distance }
}

/**
 * O rumo (como a `Rotation.y`: zero olhando para +z) de quem anda na direção
 * `{ x, z }`.
 */
export function headingOf({ x, z }) {
  return Math.atan2(x, z)
}

/** Um passo do "dar a volta": `speed` em graus por segundo. */
export function stepOrbit(angle, speed, delta) {
  return wrapAngle(angle + speed * delta)
}

/**
 * De onde vem o som visto da câmera, em graus: positivo à direita, negativo à
 * esquerda, perto de meia volta atrás. `forward`, `right` e `toSource` são
 * vetores no chão (`{ x, z }`).
 */
export function bearingFrom(forward, right, toSource) {
  const ahead = forward.x * toSource.x + forward.z * toSource.z
  const side = right.x * toSource.x + right.z * toSource.z
  return Math.atan2(side, ahead) / DEGREES
}

/**
 * Quanto do som vai para cada lado no pan `equalpower` do Web Audio, a partir
 * do rumo (`bearingFrom`). Atrás espelha na frente: esse pan não separa
 * frente de trás. Com os dois canais iguais, a parte de cada lado é a mesma
 * para som mono ou estéreo.
 */
export function equalPowerPan(bearing) {
  let azimuth = Math.max(-180, Math.min(180, bearing))
  if (azimuth < -90) azimuth = -180 - azimuth
  else if (azimuth > 90) azimuth = 180 - azimuth
  const half = ((azimuth + 90) / 180) * (Math.PI / 2)
  return { left: Math.cos(half), right: Math.sin(half) }
}

/** A parte (0–1) do som que sai na direita; `null` sem som. */
export function rightShare({ left, right }) {
  const total = left + right
  return total > 0 ? right / total : null
}

/** O rumo em palavras: "à frente", "à direita 45°", "atrás"... */
export function describeBearing(bearing, tolerance) {
  const size = Math.abs(bearing)
  if (size <= tolerance) return 'à frente'
  if (size >= 180 - tolerance) return 'atrás'
  const side = bearing > 0 ? 'direita' : 'esquerda'
  return `à ${side} ${Math.round(size)}°`
}

/** O começo do comparador de gritos: o primeiro a tocar é o A, já. */
export function createComparatorRun() {
  return { next: 'a', wait: 0 }
}

/**
 * Um quadro do comparador de gritos. `mode`: `'off'`, `'alternate'` (A, B,
 * A...), `'a'` ou `'b'` (só um, repetindo). Espera `gap` segundos depois de
 * cada grito acabar. Devolve o novo `run` e qual lado tocar agora
 * (`play`: `'a'`, `'b'` ou `null`); quem chama só fica com o `run` novo se
 * conseguiu tocar (o som pode ainda não ter carregado).
 */
export function stepComparator(run, { mode, gap }, playing, delta) {
  if (mode === 'off') return { run: createComparatorRun(), play: null }
  if (playing) return { run: { ...run, wait: gap }, play: null }
  const wait = run.wait - delta
  if (wait > 0) return { run: { ...run, wait }, play: null }
  const slot = mode === 'alternate' ? run.next : mode
  return { run: { next: slot === 'a' ? 'b' : 'a', wait: gap }, play: slot }
}

/**
 * Os volumes mexidos no comparador que ficaram diferentes do config, como
 * `{ speciesId, from, to }`, na ordem das espécies.
 */
export function volumeChanges(overrides, configVolumeOf, speciesIds) {
  return speciesIds
    .filter((id) => id in overrides && overrides[id] !== configVolumeOf(id))
    .map((id) => ({
      speciesId: id,
      from: configVolumeOf(id),
      to: overrides[id],
    }))
}
