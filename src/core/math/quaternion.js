/**
 * Matemática de quaternion pura — sem depender de `three` (core continua
 * headless). Usada tanto pra girar a cápsula/collider de física quanto pra
 * compor rotação de osso na animação procedural (ver
 * `core/animation/applyAnimationClip.js`).
 */

/**
 * Quaternion de uma rotação pura em torno de um eixo cardinal do referencial
 * local (`'x' | 'y' | 'z'`), em radianos.
 */
export function quaternionFromAxisAngle(axis, angle) {
  const half = angle / 2
  const s = Math.sin(half)
  return {
    x: axis === 'x' ? s : 0,
    y: axis === 'y' ? s : 0,
    z: axis === 'z' ? s : 0,
    w: Math.cos(half),
  }
}

/**
 * Produto de Hamilton `a * b` — compõe duas rotações: o resultado aplica `b`
 * primeiro, depois `a` no referencial já girado por `a` (mesma convenção do
 * `Quaternion.multiply` do three.js). É assim que uma curva de rotação entra
 * "por cima" da pose de descanso: `multiplyQuaternions(restQuaternion, delta)`.
 */
export function multiplyQuaternions(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

/**
 * Interpolação esférica entre dois quaternions, com correção de sinal — `q`
 * e `-q` representam a mesma rotação, e sem essa correção o caminho mais
 * curto entre dois quadros pode virar o mais longo (uma volta de 360°
 * indesejada). Perto de `alpha` extremos, cai pra lerp normalizado — evita
 * dividir por `sin(θ)` perto de zero quando os dois quaternions já estão
 * quase iguais.
 */
export function slerpQuaternions(a, b, alpha) {
  let { x: bx, y: by, z: bz, w: bw } = b
  let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw

  if (dot < 0) {
    dot = -dot
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }

  if (dot > 0.9995) {
    return normalizeQuaternion({
      x: a.x + (bx - a.x) * alpha,
      y: a.y + (by - a.y) * alpha,
      z: a.z + (bz - a.z) * alpha,
      w: a.w + (bw - a.w) * alpha,
    })
  }

  const theta0 = Math.acos(dot)
  const theta = theta0 * alpha
  const sinTheta0 = Math.sin(theta0)
  const sinTheta = Math.sin(theta)

  const ratioA = Math.cos(theta) - (dot * sinTheta) / sinTheta0
  const ratioB = sinTheta / sinTheta0

  return {
    x: ratioA * a.x + ratioB * bx,
    y: ratioA * a.y + ratioB * by,
    z: ratioA * a.z + ratioB * bz,
    w: ratioA * a.w + ratioB * bw,
  }
}

function normalizeQuaternion(q) {
  const length = Math.hypot(q.x, q.y, q.z, q.w) || 1
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length }
}
