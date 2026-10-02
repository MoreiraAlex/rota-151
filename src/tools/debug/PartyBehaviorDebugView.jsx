'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useHas, useQuery, useTrait } from 'koota/react'
import { verticalClearance } from '@/core/physics/colliders'
import {
  AiMovement,
  CharacterController,
  InputControlled,
  PartyBehavior,
  Position,
  SummonedCreature,
} from '@/core/traits'
import {
  attackPlanLabel,
  combatantLabel,
  movementLabel,
} from './WildBehaviorDebugView'

// Mesma altura da etiqueta das selvagens (`WildBehaviorDebugView.jsx`).
const GROUND_LIFT = 0.05

function PartyBehaviorDebug({ entity }) {
  const groupRef = useRef()
  const behavior = useTrait(entity, PartyBehavior)
  const movement = useTrait(entity, AiMovement)
  const controlled = useHas(entity, InputControlled)

  useFrame(() => {
    const group = groupRef.current
    if (!group || !entity.has(Position)) return
    const pos = entity.get(Position)
    const body = entity.get(CharacterController)
    group.position.set(
      pos.x,
      pos.y - verticalClearance(body) + GROUND_LIFT,
      pos.z,
    )
  })

  // A controlada é o jogador quem move — a IA não vale pra ela.
  if (!behavior || controlled) return null
  const fighting = behavior.state === 'fight'
  const stateText = fighting
    ? `lutando → ${combatantLabel(behavior.target)}` +
      attackPlanLabel(entity, behavior) +
      movementLabel(movement)
    : 'seguindo'

  return (
    <group ref={groupRef}>
      <Html
        center
        transform={false}
        className="pointer-events-none select-none"
        zIndexRange={[1, 1]}
      >
        <div
          className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold"
          style={{ color: fighting ? '#ff9a3c' : '#6ab7ff' }}
        >
          DEFENSIVA
          <span className="font-normal text-white"> · {stateText}</span>
        </div>
      </Html>
    </group>
  )
}

/**
 * Debug (F2) da IA das criaturas do time fora do controle
 * (`PartyBehavior`, `partyBehaviorSystem.js`): etiqueta no chão, mesmo
 * estilo da das selvagens, com a postura (sempre defensiva) e se está
 * seguindo ou lutando — e contra quem.
 *
 * Só montado com o modo debug ligado (`src/app/(auth)/page.js`).
 * `useFrame` é a exceção documentada de debug: só acompanha a posição,
 * nunca escreve estado de jogo.
 */
export function PartyBehaviorDebugView() {
  const entities = useQuery(SummonedCreature, PartyBehavior, Position)

  return (
    <>
      {entities.map((entity) => (
        <PartyBehaviorDebug key={entity} entity={entity} />
      ))}
    </>
  )
}
