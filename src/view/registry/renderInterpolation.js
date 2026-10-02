import { lerpAngle } from '@/core/math'
import { Position, Rotation } from '@/core/traits'

/**
 * Interpolação de apresentação entre passos fixos ("Fix Your Timestep").
 *
 * A simulação roda em passo fixo (`GAME_CONFIG.LOOP.FIXED_TIMESTEP`); o
 * render roda na taxa do monitor, e cada frame executa 0, 1 ou 2+ passos
 * (o que couber no acumulador do `GameLoop.jsx`). Lendo `Position` crua, o
 * que aparece na tela anda em degraus irregulares: num frame não anda, no
 * seguinte anda dois passos. Isso acontece sempre num monitor mais rápido
 * que o passo fixo e de vez em quando num igual (o tempo de frame oscila em
 * torno do passo e a fase do acumulador cai na borda) — o "às vezes treme".
 *
 * O loop guarda Position/Rotation de toda entidade ANTES de cada passo fixo
 * (`captureRenderTransforms`) e, depois dos passos do frame, quanto do
 * próximo passo já passou (`setRenderAlpha` = acumulador ÷ passo). A
 * apresentação desenha entre o estado anterior e o atual
 * (`resolveRenderPosition`/`resolveRenderRotation`) — no máximo um passo
 * atrás da simulação, sem suavização nenhuma além disso.
 *
 * Só apresentação: a simulação continua lendo/escrevendo `Position` crua.
 * Chaveado pela entidade do koota (o número carrega a geração, então id
 * reciclado não herda o estado anterior de quem morreu); entidade sem
 * captura (nasceu no último passo) usa o estado atual.
 */
const previous = new Map()
let alpha = 1

export function captureRenderTransforms(world) {
  previous.clear()
  world.query(Position).forEach((entity) => {
    const pos = entity.get(Position)
    const rot = entity.get(Rotation)
    previous.set(entity, {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rx: rot?.x ?? 0,
      ry: rot?.y ?? 0,
      rz: rot?.z ?? 0,
    })
  })
}

export function setRenderAlpha(value) {
  alpha = Math.min(1, Math.max(0, value))
}

/** Position da entidade pra desenhar agora (`out` reaproveitável). */
export function resolveRenderPosition(entity, out = {}) {
  const pos = entity.get(Position)
  if (!pos) return null
  const prev = previous.get(entity)
  if (!prev) {
    out.x = pos.x
    out.y = pos.y
    out.z = pos.z
    return out
  }
  out.x = prev.x + (pos.x - prev.x) * alpha
  out.y = prev.y + (pos.y - prev.y) * alpha
  out.z = prev.z + (pos.z - prev.z) * alpha
  return out
}

/** Rotation da entidade pra desenhar agora (pelo menor ângulo). */
export function resolveRenderRotation(entity, out = {}) {
  const rot = entity.get(Rotation)
  if (!rot) return null
  const prev = previous.get(entity)
  if (!prev) {
    out.x = rot.x
    out.y = rot.y
    out.z = rot.z
    return out
  }
  out.x = lerpAngle(prev.rx, rot.x, alpha)
  out.y = lerpAngle(prev.ry, rot.y, alpha)
  out.z = lerpAngle(prev.rz, rot.z, alpha)
  return out
}

/** Só pra testes. */
export function resetRenderInterpolation() {
  previous.clear()
  alpha = 1
}
