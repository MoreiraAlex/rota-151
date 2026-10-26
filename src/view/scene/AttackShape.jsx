'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  resolveAttackAreaStart,
  resolveAttackOrigin,
  resolveAttackReach,
  resolveCircleRadius,
  resolveGroundPoint,
} from '@/core/battle/attackGeometry'
import {
  isCircleAttack,
  isConeAttack,
  isSelfAttack,
} from '@/core/battle/channelAttack'
import { resolveAttackImpactPoint } from '@/core/battle/attackTrajectory'
import { castRay } from '@/core/physics/raycast'
import { capsuleShape, coneShape, discShape } from './attackShapeMesh'

const { GROUND_LIFT, DRAPE_STEP, DRAPE_RAY_UP, DRAPE_RAY_DOWN } =
  GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR

const DOWN = { x: 0, y: -1, z: 0 }
// Casas decimais da chave do cache de altura (pontos a menos de 1 cm
// dividem o mesmo raio).
const HEIGHT_CACHE_DECIMALS = 2

/**
 * Forma de um ataque pintada no chão — o que o golpe CALCULA, desenhado:
 * - golpe normal (impacto único): CÁPSULA — largura `2 * radius`, com a
 *   ponta de trás na borda do trigger de quem ataca e a da frente
 *   exatamente onde a trajetória para (o `range` é a distância máxima,
 *   `resolveAttackAreaStart`/`resolveCapsuleAreaEnd` — a mesma área do
 *   acerto);
 * - cone (canalizado ou `area: 'cone'`): "cone de sorvete" — ápice na
 *   borda do trigger, abertura `radius / range`, meia-lua na ponta
 *   (`isInsideAttackCone`);
 * - golpe em si mesmo: círculo nos pés.
 * Os dois primeiros param em parede (encurtam junto com a trajetória); o
 * cone NÃO para em criatura (pega todo mundo dentro dele).
 *
 * **Acompanha o relevo** (docs/features/061-revisao-das-skills.md): a forma
 * é uma malha subdividida (`attackShapeMesh.js`) e cada vértice desce até o
 * CHÃO por um raio (`groundOnly` — o relevo; árvore, pedra e caixa não
 * contam), então ela sobe rampa, passa por cima de morro e desce em vale,
 * em vez de um plano reto que some dentro do terreno. A malha é escrita
 * direto no MUNDO a cada frame (buffers da própria forma, que crescem quando
 * precisam — este componente é o dono e chama `dispose()`).
 *
 * Usado pelo indicador de mira e pelo aviso de golpe; `placeAttackShape`
 * posiciona por frame (com `progress` 0-1 do preenchimento, contorno sempre
 * inteiro). Sem lógica de jogo.
 */
export const AttackShape = forwardRef(function AttackShape(
  { fillColor, fillOpacity, edgeColor, edgeOpacity, depthTest, renderOrder },
  ref,
) {
  const rootRef = useRef()
  const fillRef = useRef()
  const edgeRef = useRef()

  useImperativeHandle(ref, () => ({
    root: rootRef.current,
    fill: fillRef.current,
    edge: edgeRef.current,
  }))

  useEffect(() => {
    const fill = fillRef.current
    const edge = edgeRef.current
    return () => {
      fill.geometry.dispose()
      edge.geometry.dispose()
    }
  }, [])

  return (
    <group ref={rootRef} visible={false}>
      {/* A malha muda de lugar todo frame: sem corte por frustum (a esfera
          de limite da geometria ficaria velha). */}
      <mesh ref={fillRef} renderOrder={renderOrder} frustumCulled={false}>
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          depthTest={depthTest}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineLoop
        ref={edgeRef}
        renderOrder={renderOrder + 1}
        frustumCulled={false}
      >
        <lineBasicMaterial
          color={edgeColor}
          transparent
          opacity={edgeOpacity}
          depthWrite={false}
          depthTest={depthTest}
        />
      </lineLoop>
    </group>
  )
})

/** Altura do chão (o relevo) em `(x, z)`, raio de cima de `topY`; `null` sem chão. */
function rayGroundAt(x, z, topY) {
  const hit = castRay(
    { x, y: topY + DRAPE_RAY_UP, z },
    DOWN,
    DRAPE_RAY_UP + DRAPE_RAY_DOWN,
    {
      groundOnly: true,
    },
  )
  return hit ? hit.point.y : null
}

// Do espaço local do golpe (origem, +Z pra frente) pro mundo, já no chão.
function createDraper(frame, groundAt) {
  const cos = Math.cos(frame.yaw)
  const sin = Math.sin(frame.yaw)
  const cache = new Map()
  return (localX, localZ, out, offset) => {
    const x = frame.x + localX * cos + localZ * sin
    const z = frame.z - localX * sin + localZ * cos
    const key = `${x.toFixed(HEIGHT_CACHE_DECIMALS)},${z.toFixed(HEIGHT_CACHE_DECIMALS)}`
    let y = cache.get(key)
    if (y === undefined) {
      y = groundAt(x, z, frame.topY) ?? frame.fallbackY
      cache.set(key, y)
    }
    out[offset] = x
    out[offset + 1] = y + GROUND_LIFT
    out[offset + 2] = z
  }
}

// Atributo de posição com espaço pra `count` vértices (cresce, nunca encolhe).
function positionBuffer(geometry, count) {
  const current = geometry.getAttribute('position')
  if (current && current.count >= count) return current
  const attribute = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  attribute.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', attribute)
  return attribute
}

function indexBuffer(geometry, count) {
  const current = geometry.getIndex()
  if (current && current.count >= count) return current
  const attribute = new THREE.BufferAttribute(new Uint32Array(count), 1)
  attribute.setUsage(THREE.DynamicDrawUsage)
  geometry.setIndex(attribute)
  return attribute
}

function writePoints(geometry, points, drape) {
  const count = points.length / 2
  const attribute = positionBuffer(geometry, count)
  for (let i = 0; i < count; i++) {
    drape(points[i * 2], points[i * 2 + 1], attribute.array, i * 3)
  }
  attribute.needsUpdate = true
  return count
}

function writeShape(shape, local, drape) {
  const fillGeometry = shape.fill.geometry
  writePoints(fillGeometry, local.fill.points, drape)
  const index = indexBuffer(fillGeometry, local.fill.indices.length)
  index.array.set(local.fill.indices)
  index.needsUpdate = true
  fillGeometry.setDrawRange(0, local.fill.indices.length)

  const edgeCount = writePoints(shape.edge.geometry, local.edge, drape)
  shape.edge.geometry.setDrawRange(0, edgeCount)
}

/**
 * Posiciona a forma do `attack` (ver `AttackShape`) pela MESMA trajetória
 * do golpe de verdade (`resolveAttackImpactPoint` — para em parede,
 * acompanha rampa), pintada no chão. `progress` (0-1) é quanto do
 * preenchimento aparece, a partir da origem — 1 = cheio. `groundAt(x, z,
 * topY)` dá a altura do chão (padrão: raio contra o relevo); sem chão, a
 * forma fica na altura do chão embaixo da criatura. `edge`: a borda do
 * trigger de quem ataca na direção do golpe (`resolveEntityTriggerEdge`), de
 * onde o `range` conta.
 */
export function placeAttackShape(
  shape,
  {
    pos,
    body,
    colliderHandle,
    attack,
    direction,
    edge,
    progress = 1,
    groundAt = rayGroundAt,
  },
) {
  if (!shape?.root) return
  const ground = resolveGroundPoint(pos, body)

  if (isSelfAttack(attack)) {
    const frame = {
      x: ground.x,
      z: ground.z,
      yaw: 0,
      topY: pos.y,
      fallbackY: ground.y,
    }
    const local = discShape({
      radius: Math.max(attack.radius, 1e-4),
      progress: Math.max(progress, 1e-4),
      step: DRAPE_STEP,
    })
    writeShape(shape, local, createDraper(frame, groundAt))
    return
  }

  // Círculo em volta de quem usa (`area: 'circle'`): o disco do tamanho do
  // golpe (`resolveCircleRadius`), enchendo do centro pra fora.
  if (isCircleAttack(attack)) {
    const frame = {
      x: ground.x,
      z: ground.z,
      yaw: 0,
      topY: pos.y,
      fallbackY: ground.y,
    }
    const local = discShape({
      radius: Math.max(resolveCircleRadius(attack, edge), 1e-4),
      progress: Math.max(progress, 1e-4),
      step: DRAPE_STEP,
    })
    writeShape(shape, local, createDraper(frame, groundAt))
    return
  }

  // Cone (canalizado, ou `area: 'cone'` como o Growl): só estrutura encurta
  // (mesma trajetória do dano). Cápsula: o golpe normal.
  const cone = isConeAttack(attack)
  const origin = resolveAttackOrigin(pos, direction, attack)
  const reach = resolveAttackReach(attack, edge)
  // Só terreno/estrutura encurtam a forma (como o dano): criatura no
  // caminho não.
  const pathEnd = resolveAttackImpactPoint(
    origin,
    direction,
    reach,
    colliderHandle,
    { terrainOnly: true },
  )
  // a forma começa na borda do trigger (a mesma área do acerto,
  // `resolveAttackAreaStart`), não de onde o VFX sai
  const start = resolveAttackAreaStart(
    pos,
    direction,
    edge,
    origin,
    pathEnd,
    attack,
  )
  const length = Math.hypot(pathEnd.x - start.x, pathEnd.z - start.z)
  const yaw =
    length > 1e-3
      ? Math.atan2(pathEnd.x - start.x, pathEnd.z - start.z)
      : Math.atan2(direction.x, direction.z)
  const frame = {
    x: start.x,
    z: start.z,
    yaw,
    topY: Math.max(start.y, pathEnd.y),
    fallbackY: ground.y,
  }

  const size = Math.max(length, 1e-4)
  const filled = Math.max(progress, 1e-4)
  const local = cone
    ? coneShape({
        slope: attack.range > 0 ? attack.radius / attack.range : 0,
        length: size,
        progress: filled,
        step: DRAPE_STEP,
      })
    : capsuleShape({
        radius: Math.max(attack.radius, 1e-4),
        // a PONTA da cápsula no fim da trajetória (`resolveCapsuleAreaEnd`)
        length: Math.max(length - attack.radius, 1e-4),
        progress: filled,
        step: DRAPE_STEP,
      })
  writeShape(shape, local, createDraper(frame, groundAt))
}

/**
 * Pinta no chão uma pílula de raio `radius` em volta do segmento `a → b`
 * (ex.: o trigger de acerto, `core/battle/hitTrigger.js`), acompanhando o
 * relevo como a forma do golpe. `topY`: de onde o raio procura o chão;
 * sem chão, fica em `fallbackY`.
 */
export function placeGroundPill(
  shape,
  { a, b, radius, topY, fallbackY, groundAt = rayGroundAt },
) {
  if (!shape?.root) return
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  const yaw = length > 1e-6 ? Math.atan2(b.x - a.x, b.z - a.z) : 0
  const local = capsuleShape({
    radius: Math.max(radius, 1e-4),
    length: Math.max(length, 1e-4),
    step: DRAPE_STEP,
  })
  writeShape(
    shape,
    local,
    createDraper({ x: a.x, z: a.z, yaw, topY, fallbackY }, groundAt),
  )
}

export function paintAttackShape(shape, { fill, edge }) {
  shape?.root?.traverse((object) => {
    if (object.isMesh) object.material.color.set(fill)
    else if (object.isLine) object.material.color.set(edge)
  })
}
