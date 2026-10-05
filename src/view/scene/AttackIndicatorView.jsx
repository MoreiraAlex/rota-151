'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { world } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolveAttackDirection } from '@/core/battle/attackAim'
import { getSpecies } from '@/core/data/species'
import { resolveEntityAttack } from '@/core/battle/creatureAttack'
import { isSelfAttack } from '@/core/battle/channelAttack'
import { AttackShape, placeAttackShape } from './AttackShape'
import {
  AttackAim,
  CharacterController,
  InputControlled,
  PhysicsBody,
  Position,
  SummonedCreature,
} from '@/core/traits'

const { FILL_COLOR, FILL_OPACITY, EDGE_COLOR, EDGE_OPACITY, ALWAYS_ON_TOP } =
  GAME_CONFIG.FEEDBACK.ATTACK_INDICATOR

/**
 * Indicador de alcance do ataque com `castMode: 'confirm'` — aparece
 * enquanto `AttackAim.slot` da criatura controlada estiver aberto
 * (`creatureAttackSystem.js`), antes do golpe ser lançado. Forma azulada
 * preenchida com contorno claro, deitada no chão, estilo "skillshot" do
 * LoL — a MESMA área que o golpe calcula (cápsula no golpe normal, leque
 * no canalizado — `AttackShape.jsx`), apontando pra onde o golpe iria
 * AGORA (`resolveAttackDirection`). Depois de lançado, quem mostra o
 * golpe é o aviso que se preenche (`AttackTelegraphView.jsx`).
 *
 * `ALWAYS_ON_TOP` (config) desliga o teste de profundidade: a forma é
 * desenhado por cima de tudo, então a própria criatura não tampa o
 * pedaço embaixo dela (e ele também aparece através de parede).
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual:
 * só LÊ estado do ECS e reposiciona o próprio mesh, nunca escreve gameplay.
 */
export function AttackIndicatorView() {
  const shapeRef = useRef()

  useFrame(() => {
    const shape = shapeRef.current
    if (!shape?.root) return

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
    const resolved = species
      ? resolveEntityAttack(controlled, species, slot)
      : null
    // golpe em si mesmo (Growth) não tem pra onde mirar: sem indicador
    const attack = isSelfAttack(resolved) ? null : resolved
    shape.root.visible = !!attack
    if (!attack) return

    const pos = controlled.get(Position)
    const physicsBody = controlled.get(PhysicsBody)
    placeAttackShape(shape, {
      pos,
      body: controlled.get(CharacterController),
      colliderHandle: physicsBody.colliderHandle,
      species,
      attack,
      direction: resolveAttackDirection(
        world,
        pos,
        physicsBody.colliderHandle,
        species,
        attack,
        slot,
      ),
    })
  })

  return (
    <AttackShape
      ref={shapeRef}
      fillColor={FILL_COLOR}
      fillOpacity={FILL_OPACITY}
      edgeColor={EDGE_COLOR}
      edgeOpacity={EDGE_OPACITY}
      depthTest={!ALWAYS_ON_TOP}
      renderOrder={10}
    />
  )
}
