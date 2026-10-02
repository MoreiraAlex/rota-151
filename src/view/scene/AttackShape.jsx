'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  resolveAttackOrigin,
  resolveGroundPoint,
  resolveRoundedCone,
} from '@/core/battle/attackGeometry'
import { isConeAttack, isSelfAttack } from '@/core/battle/channelAttack'
import { resolveAttackImpactPoint } from '@/core/battle/attackTrajectory'

const { GROUND_LIFT } = GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR

// Todas as peças são UNITÁRIAS, no plano XZ, com o "pra frente" em +Z
// (`Object3D.lookAt` aponta o +Z local pro alvo). Cada uma é escalada por
// frame pelo tamanho real do ataque — sem recriar geometria.
const ARC_SEGMENTS = 24

function geometryFrom(vertices, indices = null) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  )
  if (indices) geometry.setIndex(indices)
  return geometry
}

/** Pontos de meio círculo de raio 1: `sign` 1 = pra frente (+Z), -1 = pra trás. */
function halfCirclePoints(sign) {
  const points = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = (i / ARC_SEGMENTS) * Math.PI
    points.push(Math.cos(angle), 0, sign * Math.sin(angle))
  }
  return points
}

function halfDiscGeometry(sign) {
  const vertices = [0, 0, 0, ...halfCirclePoints(sign)]
  const indices = []
  for (let i = 1; i <= ARC_SEGMENTS; i++) indices.push(0, i, i + 1)
  return geometryFrom(vertices, indices)
}

// Leque (canal): "cone de sorvete" de comprimento 1 — triângulo saindo do
// ápice + meia-lua na ponta (`resolveRoundedCone`, a MESMA conta do dano).
// A forma depende só da abertura (`radius / range`), então a geometria é
// criada uma vez por abertura e reaproveitada (cache abaixo); o tamanho
// real vem da escala uniforme pelo comprimento.
const roundedConesBySlope = new Map()

function resolveRoundedConeGeometry(slope) {
  const key = slope.toFixed(4)
  const cached = roundedConesBySlope.get(key)
  if (cached) return cached

  const { capCenter, capRadius } = resolveRoundedCone({
    length: 1,
    range: 1,
    radius: slope,
  })
  // Contorno da meia-lua, da lateral esquerda (-x) pela ponta até a direita.
  const outline = []
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = Math.PI - (i / ARC_SEGMENTS) * Math.PI
    outline.push(
      capRadius * Math.cos(angle),
      0,
      capCenter + capRadius * Math.sin(angle),
    )
  }
  // Forma convexa: leque de triângulos a partir do ápice cobre exatamente
  // triângulo + meia-lua.
  const indices = []
  for (let i = 1; i <= ARC_SEGMENTS; i++) indices.push(0, i, i + 1)
  const cone = {
    fill: geometryFrom([0, 0, 0, ...outline], indices),
    edge: geometryFrom([0, 0, 0, ...outline]),
  }
  roundedConesBySlope.set(key, cone)
  return cone
}

const INITIAL_CONE = resolveRoundedConeGeometry(0.5)
// Cápsula (golpe normal): retângulo x∈[-1,1], z∈[0,1] + tampas.
const RECT_FILL = geometryFrom(
  [-1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1],
  [0, 1, 2, 0, 2, 3],
)
const RECT_SIDES = geometryFrom([-1, 0, 0, -1, 0, 1, 1, 0, 0, 1, 0, 1])
const FRONT_CAP_FILL = halfDiscGeometry(1)
const BACK_CAP_FILL = halfDiscGeometry(-1)
const FRONT_CAP_EDGE = geometryFrom(halfCirclePoints(1))
const BACK_CAP_EDGE = geometryFrom(halfCirclePoints(-1))

/**
 * Forma de um ataque deitada no chão — o que o golpe CALCULA, desenhado:
 * - golpe normal (impacto único): CÁPSULA — retângulo de largura
 *   `2 * radius` da origem até onde a trajetória para, com pontas
 *   arredondadas (`resolveAttackTarget` mede a distância até esse
 *   segmento, então a área é exatamente essa);
 * - canalizado (`damageMode: 'channel'`): LEQUE em "cone de sorvete" —
 *   ápice na origem, abertura `radius / range`, meia-lua na ponta (sempre
 *   arredondada, estreito ou largo) — `isInsideAttackCone`.
 * Os dois param em parede (encurtam junto com a trajetória); o leque NÃO
 * para em criatura (pega todo mundo dentro dele).
 *
 * Usado pelo indicador de mira e pelo aviso de golpe; `placeAttackShape`
 * posiciona por frame (com `progress` 0-1 do preenchimento, contorno
 * sempre inteiro). Sem lógica de jogo.
 */
export const AttackShape = forwardRef(function AttackShape(
  { fillColor, fillOpacity, edgeColor, edgeOpacity, depthTest, renderOrder },
  ref,
) {
  const parts = {
    root: useRef(),
    fan: useRef(),
    fanFill: useRef(),
    fanEdge: useRef(),
    tube: useRef(),
    rectFill: useRef(),
    frontCapFill: useRef(),
    rectSides: useRef(),
    frontCapEdge: useRef(),
    backCapFill: useRef(),
    backCapEdge: useRef(),
  }
  useImperativeHandle(ref, () =>
    Object.fromEntries(
      Object.entries(parts).map(([key, part]) => [key, part.current]),
    ),
  )

  const fill = (
    <meshBasicMaterial
      color={fillColor}
      transparent
      opacity={fillOpacity}
      depthWrite={false}
      depthTest={depthTest}
      side={THREE.DoubleSide}
    />
  )
  const edge = (
    <lineBasicMaterial
      color={edgeColor}
      transparent
      opacity={edgeOpacity}
      depthWrite={false}
      depthTest={depthTest}
    />
  )
  const fillOrder = renderOrder
  const edgeOrder = renderOrder + 1

  return (
    <group ref={parts.root} visible={false}>
      <group ref={parts.fan}>
        <mesh
          ref={parts.fanFill}
          geometry={INITIAL_CONE.fill}
          renderOrder={fillOrder}
        >
          {fill}
        </mesh>
        <lineLoop
          ref={parts.fanEdge}
          geometry={INITIAL_CONE.edge}
          renderOrder={edgeOrder}
        >
          {edge}
        </lineLoop>
      </group>
      <group ref={parts.tube}>
        <mesh ref={parts.rectFill} geometry={RECT_FILL} renderOrder={fillOrder}>
          {fill}
        </mesh>
        <mesh
          ref={parts.frontCapFill}
          geometry={FRONT_CAP_FILL}
          renderOrder={fillOrder}
        >
          {fill}
        </mesh>
        <mesh
          ref={parts.backCapFill}
          geometry={BACK_CAP_FILL}
          renderOrder={fillOrder}
        >
          {fill}
        </mesh>
        <lineSegments
          ref={parts.rectSides}
          geometry={RECT_SIDES}
          renderOrder={edgeOrder}
        >
          {edge}
        </lineSegments>
        <line
          ref={parts.frontCapEdge}
          geometry={FRONT_CAP_EDGE}
          renderOrder={edgeOrder}
        >
          {edge}
        </line>
        <line
          ref={parts.backCapEdge}
          geometry={BACK_CAP_EDGE}
          renderOrder={edgeOrder}
        >
          {edge}
        </line>
      </group>
    </group>
  )
})

/**
 * Posiciona a forma do `attack` (ver `AttackShape`) pela MESMA trajetória
 * do golpe de verdade (`resolveAttackImpactPoint` — para em parede,
 * acompanha rampa), só que na altura do chão. `progress` (0-1) é quanto
 * do preenchimento aparece, a partir da origem — 1 = cheio.
 */
export function placeAttackShape(
  shape,
  { pos, body, colliderHandle, species, attack, direction, progress = 1 },
) {
  if (!shape?.root) return
  if (isSelfAttack(attack)) {
    placeSelfCircle(shape, { pos, body, attack, progress })
    return
  }
  // Cone (canalizado, ou `area: 'cone'` como o Growl): só estrutura encurta
  // (mesma trajetória do dano). Cápsula: o golpe normal.
  const channel = isConeAttack(attack)
  const origin = resolveAttackOrigin(pos, species.body?.attackOriginHeight)
  const pathEnd = resolveAttackImpactPoint(
    origin,
    direction,
    attack.range,
    colliderHandle,
    { terrainOnly: channel },
  )

  // Desce a trajetória (que anda na altura da origem acima do terreno)
  // até o chão — a forma fica "pintada" no piso, como no LoL.
  const ground = resolveGroundPoint(pos, body)
  const drop = origin.y - ground.y - GROUND_LIFT
  shape.root.position.set(origin.x, origin.y - drop, origin.z)

  const length = Math.hypot(pathEnd.x - origin.x, pathEnd.z - origin.z)
  if (length > 1e-3) {
    shape.root.lookAt(pathEnd.x, pathEnd.y - drop, pathEnd.z)
  } else {
    shape.root.lookAt(
      origin.x + direction.x,
      origin.y - drop,
      origin.z + direction.z,
    )
  }

  shape.fan.visible = channel
  shape.tube.visible = !channel
  if (channel) {
    placeCone(shape, attack, length, progress)
  } else {
    placeCapsule(shape, attack.radius, length, progress)
  }
}

/**
 * Golpe em SI MESMO (`area: 'self'`, Growth): um círculo de raio
 * `attack.radius` no chão, nos pés de quem usa — a carga que ainda pode ser
 * interrompida. O preenchimento cresce do centro até a borda com
 * `progress`. Usa as duas meias-luas da cápsula com comprimento zero (um
 * disco); o retângulo do meio fica zerado.
 */
function placeSelfCircle(shape, { pos, body, attack, progress }) {
  const ground = resolveGroundPoint(pos, body)
  shape.root.position.set(ground.x, ground.y + GROUND_LIFT, ground.z)
  shape.root.rotation.set(0, 0, 0)

  shape.fan.visible = false
  shape.tube.visible = true
  const r = Math.max(attack.radius, 1e-4)
  const filled = Math.max(r * progress, 1e-4)
  shape.rectFill.scale.set(r, 1, 1e-4)
  shape.rectSides.scale.set(1e-4, 1, 1e-4)
  shape.frontCapFill.scale.set(filled, 1, filled)
  shape.frontCapFill.position.set(0, 0, 0)
  shape.backCapFill.scale.set(filled, 1, filled)
  shape.frontCapEdge.scale.set(r, 1, r)
  shape.frontCapEdge.position.set(0, 0, 0)
  shape.backCapEdge.scale.set(r, 1, r)
}

/**
 * Pinta a forma inteira — preenchimento (`fill`) e contorno (`edge`), cores
 * `#rrggbb`. Pra um pool de formas que mostra golpes de tipos diferentes (o
 * aviso: vermelho no golpe comum, outra cor na carga de um golpe em si mesmo).
 */
export function paintAttackShape(shape, { fill, edge }) {
  shape?.root?.traverse((object) => {
    if (object.isMesh) object.material.color.set(fill)
    else if (object.isLine) object.material.color.set(edge)
  })
}

function placeCone(shape, attack, length, progress) {
  // Comprimento `length` (encurtado pela parede) com a abertura do ataque
  // inteiro — mesma conta de `isInsideAttackCone`.
  const slope = attack.range > 0 ? attack.radius / attack.range : 0
  const cone = resolveRoundedConeGeometry(slope)
  shape.fanFill.geometry = cone.fill
  shape.fanEdge.geometry = cone.edge
  const size = Math.max(length, 1e-4)
  shape.fan.scale.set(size, 1, size)
  const p = Math.max(progress, 1e-4)
  shape.fanFill.scale.set(p, 1, p)
}

function placeCapsule(shape, radius, length, progress) {
  const r = Math.max(radius, 1e-4)
  const filled = Math.max(length * progress, 1e-4)
  shape.rectFill.scale.set(r, 1, filled)
  shape.frontCapFill.scale.set(r, 1, r)
  shape.frontCapFill.position.set(0, 0, filled)
  shape.backCapFill.scale.set(r, 1, r)
  shape.rectSides.scale.set(r, 1, Math.max(length, 1e-4))
  shape.frontCapEdge.scale.set(r, 1, r)
  shape.frontCapEdge.position.set(0, 0, length)
  shape.backCapEdge.scale.set(r, 1, r)
}
