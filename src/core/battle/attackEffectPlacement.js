const DEG_TO_RAD = Math.PI / 180

/**
 * Orientação (Euler, radianos) do VFX do ataque a partir da direção 3D
 * completa do golpe (`direction`, já resolvida por `resolveAimDirection`)
 * mais o ajuste fino em graus da própria definição do ataque
 * (`attack.visual.rotationOffset` — ver `core/data/skills/`). Pedido
 * explícito do usuário: "o tackle fica limitado a uma orientação
 * horizontal [só `Rotation.y`]... quero que a orientação seja
 * configurável, permitindo rotacionar o efeito livremente" — duas partes:
 *
 * 1. `yaw`/`pitch` a partir do vetor 3D (não só o componente horizontal
 *    que `rot.y` do CORPO usa — o corpo não inclina pra cima/baixo de
 *    propósito, mas o VFX pode/deve, senão um golpe mirado pra cima
 *    nasce "deitado"). `pitch` usa `atan2` (não `asin`) por robustez
 *    numérica perto de `direction.y` ±1.
 * 2. `rotationOffset` (graus) somado por cima — a malha de rip
 *    convertida não tem "forward" garantidamente alinhado com a
 *    convenção do jogo (`forward = (sin(yaw), cos(yaw))` em pitch 0);
 *    este campo é o escape-hatch pra corrigir isso por config, sem
 *    mexer em código, olhando o resultado em jogo.
 *
 * `core/` não importa Three.js (a ponte ECS → Three mora na view) — por
 * isso graus→radianos é uma multiplicação simples aqui, não
 * `THREE.MathUtils.degToRad` (esse sim usado em `tailFireSystem.js`, que
 * é view).
 *
 * Exportada — mesmo motivo de `resolveAttackImpactPoint` (testável como
 * função pura, sem precisar montar um world/entidade inteiros).
 */
export function resolveEffectRotation(direction, rotationOffset) {
  const yaw = Math.atan2(direction.x, direction.z)
  const horizontalLength = Math.hypot(direction.x, direction.z)
  const pitch = Math.atan2(-direction.y, horizontalLength)
  const offset = rotationOffset ?? { x: 0, y: 0, z: 0 }

  return {
    x: pitch + offset.x * DEG_TO_RAD,
    y: yaw + offset.y * DEG_TO_RAD,
    z: offset.z * DEG_TO_RAD,
  }
}

/**
 * Ponto de PARTIDA do VFX: a origem do golpe (`origin`) deslocada por
 * `positionOffset` (metros, `attack.visual.positionOffset`) no referencial
 * da trajetória — o mesmo que `resolveEffectRotation` desenha: +Z = direção
 * do golpe, +Y = pra cima, +X = pro lado (esquerda de quem olha na direção
 * do golpe). Assim `{ y: 0.2 }` sobe a saída do golpe 20 cm, seja qual for
 * a direção do disparo. Só o VISUAL: o dano e o alcance continuam contados
 * a partir de `origin`, e o PONTO DE IMPACTO continua sendo o do `range`
 * — o efeito só se reorienta e se estica do novo ponto de partida até ele
 * (ver o spawn do `AttackEffect`). Independente do `rotationOffset` (que só
 * gira a malha): os eixos aqui são só os do yaw/pitch do golpe.
 *
 * Os eixos seguem a ordem de rotação que a view usa (`object.rotation.set(x,
 * y, z)` do Three, ordem XYZ — ver `syncTransformSystem.js`): `R = Rx(pitch)
 * · Ry(yaw)`. Sem offset (`null`/zeros) devolve `origin` como veio.
 *
 * Exportada — mesmo motivo de `resolveEffectRotation` (função pura, testável
 * sem montar um world).
 */
export function resolveEffectStart(origin, direction, positionOffset) {
  const offset = positionOffset ?? { x: 0, y: 0, z: 0 }
  const ox = offset.x ?? 0
  const oy = offset.y ?? 0
  const oz = offset.z ?? 0
  if (ox === 0 && oy === 0 && oz === 0) return origin

  const { x: pitch, y: yaw } = resolveEffectRotation(direction, null)
  const cosYaw = Math.cos(yaw)
  const sinYaw = Math.sin(yaw)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  return {
    x: origin.x + ox * cosYaw + oz * sinYaw,
    y:
      origin.y +
      ox * sinYaw * sinPitch +
      oy * cosPitch -
      oz * cosYaw * sinPitch,
    z:
      origin.z -
      ox * sinYaw * cosPitch +
      oy * sinPitch +
      oz * cosYaw * cosPitch,
  }
}

/**
 * Onde o VFX do golpe parte e como ele gira: orientado pela trajetória REAL
 * (`origin` → `impactPoint`), deslocado por `visual.positionOffset`
 * (`resolveEffectStart`) e reorientado da nova partida até o impacto, mais o
 * `visual.rotationOffset` (`resolveEffectRotation`). `direction` é a direção
 * travada do golpe — usada quando a trajetória tem comprimento ~0.
 */
export function resolveEffectPlacement(origin, direction, impactPoint, visual) {
  // VFX orientado pela trajetória REAL (inclina junto numa rampa);
  // trajetória de comprimento ~0 (encostado na parede) usa a
  // direção travada.
  const path = {
    x: impactPoint.x - origin.x,
    y: impactPoint.y - origin.y,
    z: impactPoint.z - origin.z,
  }
  const pathLength = Math.hypot(path.x, path.y, path.z)
  const pathDirection =
    pathLength > 1e-6
      ? {
          x: path.x / pathLength,
          y: path.y / pathLength,
          z: path.z / pathLength,
        }
      : direction
  // Ponto de partida VISUAL (`visual.positionOffset`): só a saída do
  // golpe anda; o impacto continua o do `range`. O efeito é
  // reorientado da nova partida até o impacto.
  const effectStart = resolveEffectStart(
    origin,
    pathDirection,
    visual.positionOffset,
  )
  const startPath = {
    x: impactPoint.x - effectStart.x,
    y: impactPoint.y - effectStart.y,
    z: impactPoint.z - effectStart.z,
  }
  const startPathLength = Math.hypot(startPath.x, startPath.y, startPath.z)
  const effectDirection =
    startPathLength > 1e-6
      ? {
          x: startPath.x / startPathLength,
          y: startPath.y / startPathLength,
          z: startPath.z / startPathLength,
        }
      : pathDirection
  const effectRotation = resolveEffectRotation(
    effectDirection,
    visual.rotationOffset,
  )

  return { effectStart, effectRotation }
}
