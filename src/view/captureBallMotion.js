/**
 * Movimento da Pokébola de captura (docs/features/043-captura.md) —
 * matemática pura, sem Three.js, usada pelo `captureBallViewSystem.js`. Os
 * parâmetros vêm de `GAME_CONFIG.FEEDBACK.CAPTURE_BALL`.
 */

const DEG = Math.PI / 180

/**
 * Inclinação (rad) de uma balançada `t` segundos depois de começar: vai de
 * um lado pro outro `cycles` vezes em `duration`, até `angle` (graus), e
 * amortece até parar em pé. Fora da balançada, 0.
 */
export function resolveWobbleAngle(t, { angle, cycles, duration }) {
  if (!(duration > 0) || t < 0 || t >= duration) return 0
  const progress = t / duration
  return (
    angle * DEG * Math.sin(2 * Math.PI * cycles * progress) * (1 - progress)
  )
}

/**
 * Escala do brilho da absorção em `progress` (0–1 da absorção): cresce até
 * `max` no meio e some no fim.
 */
export function resolveGlowScale(progress, max) {
  if (progress <= 0 || progress >= 1) return 0
  return max * Math.sin(Math.PI * progress)
}

/**
 * Estrelinha `index` de `count` do "Capturado!" em `progress` (0–1): sai do
 * centro em leque, subindo um pouco, até `distance`; some no fim.
 * `{ x, y, z, scale }` (em volta da bola).
 */
export function resolveStarOffset(index, count, progress, distance) {
  const p = Math.min(1, Math.max(0, progress))
  const angle = (index / count) * Math.PI * 2
  const reach = distance * (1 - (1 - p) * (1 - p))
  return {
    x: Math.cos(angle) * reach,
    y: reach * 0.6 + Math.sin(p * Math.PI) * distance * 0.3,
    z: Math.sin(angle) * reach,
    scale: p < 1 ? 1 - p : 0,
  }
}

/** "Clique" no fim: a bola encolhe `squash` e volta, em `progress` (0–1). */
export function resolveClickScale(progress, squash) {
  if (progress <= 0 || progress >= 1) return 1
  return 1 - squash * Math.sin(Math.PI * progress)
}

/**
 * Escala da bola que vai sumir nos últimos `duration` segundos antes de
 * `end` (o estouro do escape, a quebra da que errou): 1 até lá, depois
 * encolhe até 0.
 */
export function resolveVanishScale(time, end, duration) {
  if (!(duration > 0)) return time >= end ? 0 : 1
  const left = end - time
  if (left >= duration) return 1
  return Math.max(0, left / duration)
}

/**
 * Qual clipe do `.glb` da bola tocar agora (`item.model.animations`, ver
 * `core/data/items/_template/`), pela fase da captura:
 * `{ key, name, loop, fitTo }` — `key` muda quando o clipe tem que
 * recomeçar (cada balançada é uma), `fitTo` (s) encaixa a duração do clipe
 * nesse tempo. `null`: sem clipe pra essa fase (fica o procedural).
 *
 * Caindo, fecha (`close`) e segura fechada até a primeira balançada; sem
 * `close`, segura o fim da absorção.
 */
export function resolveBallClip(state, shakes, clips, capture) {
  if (!clips) return null
  const absorb = clips.absorb
    ? {
        key: 'absorb',
        name: clips.absorb,
        loop: false,
        fitTo: capture.ABSORB_DURATION,
      }
    : null

  const close = clips.close
    ? { key: 'close', name: clips.close, loop: false, fitTo: null }
    : absorb

  switch (state) {
    case 'flying':
      return clips.flying
        ? { key: 'flying', name: clips.flying, loop: true, fitTo: null }
        : null
    case 'absorbing':
      return absorb
    case 'falling':
      return close
    case 'shaking':
      if (shakes === 0 || !clips.shake) return close
      return {
        key: `shake-${shakes}`,
        name: clips.shake,
        loop: false,
        fitTo: capture.SHAKE_INTERVAL,
        onlyShrink: true,
      }
    case 'caught':
      return clips.caught
        ? { key: 'caught', name: clips.caught, loop: false, fitTo: null }
        : null
    case 'escaped':
      return clips.escaped
        ? { key: 'escaped', name: clips.escaped, loop: false, fitTo: null }
        : null
    default:
      return null
  }
}

/**
 * Velocidade de um clipe de `clipDuration` encaixado em `fitTo` segundos.
 * `onlyShrink`: só acelera quando o clipe não cabe (mais curto, toca normal).
 */
export function resolveClipTimeScale(clipDuration, fitTo, onlyShrink = false) {
  if (!(fitTo > 0) || !(clipDuration > 0)) return 1
  const scale = clipDuration / fitTo
  return onlyShrink ? Math.max(1, scale) : scale
}
