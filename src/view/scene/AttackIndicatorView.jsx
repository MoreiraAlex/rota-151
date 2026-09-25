'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolveAttackDirection } from '@/core/battle/attackAim'
import {
  resolveAttackOrigin,
  resolveGroundPoint,
} from '@/core/battle/attackGeometry'
import { resolveAttackImpactPoint } from '@/core/systems/creatureAttackSystem'
import { getSpecies } from '@/core/data/species'
import { resolveCreatureAttack } from '@/core/data/attacks'
import {
  AttackAim,
  CharacterController,
  InputControlled,
  PhysicsBody,
  Position,
  SummonedCreature,
} from '@/core/traits'

const { FILL_COLOR, FILL_OPACITY, EDGE_COLOR, EDGE_OPACITY, GROUND_LIFT } =
  GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR

// Leque unitário: ápice em (0,0,0), base em (-1,0,1)/(1,0,1). A base fica
// em +Z porque `Object3D.lookAt` aponta o +Z local de um MESH pro alvo.
// Escalado por (radius, 1, range) — base com `2 * radius` de largura a
// `range` metros do ápice. Compartilhado entre preenchimento e contorno.
const FAN_VERTICES = [0, 0, 0, -1, 0, 1, 1, 0, 1]
const FILL_GEOMETRY = new THREE.BufferGeometry()
FILL_GEOMETRY.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(FAN_VERTICES, 3),
)
FILL_GEOMETRY.setIndex([0, 1, 2])
const EDGE_GEOMETRY = new THREE.BufferGeometry()
EDGE_GEOMETRY.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(FAN_VERTICES, 3),
)

/**
 * Indicador de alcance do ataque com `castMode: 'confirm'` — aparece
 * enquanto `AttackAim.slot` da criatura controlada estiver aberto
 * (`creatureAttackSystem.js`), antes do golpe ser lançado. Leque azulado
 * preenchido com contorno claro, deitado no chão, estilo "skillshot" do
 * LoL: ápice sob a criatura, `range` de comprimento e `2 * radius` de
 * largura (valores do próprio ataque), apontando pra onde o golpe iria
 * AGORA — mesma direção e trajetória do golpe de verdade
 * (`resolveAttackDirection` + `resolveAttackImpactPoint`), só que na
 * altura do chão, acompanhando rampa.
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual:
 * só LÊ estado do ECS e reposiciona o próprio mesh, nunca escreve gameplay.
 */
export function AttackIndicatorView() {
  const groupRef = useRef()

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const controlled = world.queryFirst(
      InputControlled,
      SummonedCreature,
      AttackAim,
      CharacterController,
      PhysicsBody,
      Position,
    )
    const slot = controlled?.get(AttackAim).slot
    const species = slot
      ? getSpecies(controlled.get(SummonedCreature).speciesId)
      : null
    const attack = species
      ? resolveCreatureAttack(species.attacks?.[slot])
      : null
    group.visible = !!attack
    if (!attack) return

    const pos = controlled.get(Position)
    const body = controlled.get(CharacterController)
    const physicsBody = controlled.get(PhysicsBody)
    const origin = resolveAttackOrigin(pos, species.body?.attackOriginHeight)
    const direction = resolveAttackDirection(
      world,
      pos,
      physicsBody.colliderHandle,
      species,
      attack,
    )
    const pathEnd = resolveAttackImpactPoint(
      origin,
      direction,
      attack.range,
      physicsBody.colliderHandle,
    )

    // Desce a trajetória (que anda na altura da origem acima do terreno)
    // até o chão — o leque fica "pintado" no piso, como no LoL.
    const ground = resolveGroundPoint(pos, body)
    const drop = origin.y - ground.y - GROUND_LIFT
    group.position.set(origin.x, origin.y - drop, origin.z)

    const reachesSomewhere =
      Math.hypot(pathEnd.x - origin.x, pathEnd.z - origin.z) > 1e-3
    if (reachesSomewhere) {
      group.lookAt(pathEnd.x, pathEnd.y - drop, pathEnd.z)
    } else {
      group.lookAt(
        origin.x + direction.x,
        origin.y - drop,
        origin.z + direction.z,
      )
    }
    group.scale.set(attack.radius, 1, attack.range)
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={FILL_GEOMETRY} renderOrder={10}>
        <meshBasicMaterial
          color={FILL_COLOR}
          transparent
          opacity={FILL_OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineLoop geometry={EDGE_GEOMETRY} renderOrder={11}>
        <lineBasicMaterial
          color={EDGE_COLOR}
          transparent
          opacity={EDGE_OPACITY}
          depthWrite={false}
        />
      </lineLoop>
    </group>
  )
}
