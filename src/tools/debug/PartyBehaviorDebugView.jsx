'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useHas, useQuery, useTarget, useTrait } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/colliders'
import { normalizePosture } from '@/core/party/posture'
import { POSTURE_TEXT } from '@/view/shared/postureText'
import {
  AiMovement,
  CharacterController,
  FollowWatch,
  InputControlled,
  PartyBehavior,
  Pokemon,
  Position,
  SummonedCreature,
  SummonedFrom,
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
  const watch = useTrait(entity, FollowWatch)
  const controlled = useHas(entity, InputControlled)
  // A postura é do registro (064): acompanha a troca no menu.
  const pokemon = useTarget(entity, SummonedFrom)
  const record = useTrait(pokemon, Pokemon)

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
  const posture = POSTURE_TEXT[normalizePosture(record?.posture)].name
  const stateText = fighting
    ? `lutando → ${combatantLabel(behavior.target)}` +
      attackPlanLabel(entity, behavior) +
      movementLabel(movement)
    : 'seguindo'
  // Tentando seguir sem sair do lugar (064): quanto falta pra voltar à bola.
  const stuckText =
    watch?.stuckTime > 0 ? ` · preso ${watch.stuckTime.toFixed(1)}s` : ''

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
          {posture.toUpperCase()}
          <span className="font-normal text-white">
            {' '}
            · {stateText}
            {stuckText} · dif. {GAME_CONFIG.PARTY_DIFFICULTY.LEVEL}
          </span>
        </div>
      </Html>
    </group>
  )
}

/**
 * Debug (F2) da IA das criaturas do time fora do controle
 * (`PartyBehavior`, `partyBehaviorSystem.js`): etiqueta no chão, mesmo
 * estilo da das selvagens, com a postura do Pokémon (064) e se está
 * seguindo ou lutando — e contra quem —, há quanto tempo está presa
 * (`FollowWatch`) e a dificuldade do time (`PARTY_DIFFICULTY.LEVEL`)
 * (docs/features/064-revisao-da-ia-do-parceiro.md).
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
