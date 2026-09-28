'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useQuery, useTrait } from 'koota/react'
import * as THREE from 'three'
import { resolveBehaviorRadius } from '@/core/battle/wildBehavior'
import { verticalClearance } from '@/core/physics/colliders'
import {
  CharacterController,
  Fainted,
  Party,
  Position,
  WildBehavior,
  WildCreature,
  resolveCreatureSpeciesId,
} from '@/core/traits'
import { formatSpeciesName } from '@/view/shared/statusDisplay'

// Levanta um pouco do chão — sem isso o círculo some dentro do piso.
const GROUND_LIFT = 0.05
const RING_SEGMENTS = 64
const RING_INNER = 0.97

const TEMPERAMENT_LABEL = { hostile: 'HOSTIL', peaceful: 'PACÍFICO' }
const TEMPERAMENT_COLOR = { hostile: '#ff5a5a', peaceful: '#5ad16a' }
const STATE_LABEL = {
  wander: 'vagando',
  chase: 'perseguindo',
  flee: 'fugindo',
}
/**
 * Nome curto de um combatente pro debug — a espécie da criatura, ou
 * "treinador". Exportado: `PartyBehaviorDebugView.jsx` usa o mesmo.
 */
export function combatantLabel(entity) {
  if (entity == null || !entity.isAlive()) return '?'
  if (entity.has(Party)) return 'treinador'
  const speciesId = resolveCreatureSpeciesId(entity)
  return speciesId ? formatSpeciesName(speciesId) : '?'
}

const STATE_RING_COLOR = {
  wander: '#ffb000',
  chase: '#ff3030',
  flee: '#3fa9ff',
}

function WildBehaviorDebug({ entity }) {
  const groupRef = useRef()
  const behavior = useTrait(entity, WildBehavior)
  const fainted = useTrait(entity, Fainted)

  useFrame(() => {
    const group = groupRef.current
    if (!group || !entity.has(Position)) return
    const pos = entity.get(Position)
    const body = entity.get(CharacterController)
    // Pé da criatura (`Position` é o centro da cápsula).
    group.position.set(
      pos.x,
      pos.y - verticalClearance(body) + GROUND_LIFT,
      pos.z,
    )
  })

  if (!behavior) return null
  // Desmaiada: sem círculo (não reage a ninguém), só o tempo pra acordar.
  const radius = fainted ? null : resolveBehaviorRadius(behavior)
  // Alvo do tick (ameaça, senão proximidade — `wildBehaviorSystem.js`).
  const targetText = behavior.target
    ? ` → ${combatantLabel(behavior.target)}`
    : ''
  const stateText = fainted
    ? `desmaiada (${Math.ceil(fainted.timeLeft)}s)`
    : STATE_LABEL[behavior.state] +
      (behavior.provoked ? ' (provocada)' : '') +
      targetText

  return (
    <group ref={groupRef}>
      {radius !== null && (
        <mesh rotation-x={-Math.PI / 2} scale={radius} renderOrder={999}>
          <ringGeometry args={[RING_INNER, 1, RING_SEGMENTS]} />
          <meshBasicMaterial
            color={STATE_RING_COLOR[behavior.state]}
            side={THREE.DoubleSide}
            transparent
            opacity={0.55}
            depthTest={false}
          />
        </mesh>
      )}
      <Html
        center
        transform={false}
        className="pointer-events-none select-none"
        // z-index baixo e fixo, mesmo motivo da `NameplateView.jsx`.
        zIndexRange={[1, 1]}
      >
        <div
          className="whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold"
          style={{ color: TEMPERAMENT_COLOR[behavior.temperament] }}
        >
          {TEMPERAMENT_LABEL[behavior.temperament]}
          <span className="font-normal text-white"> · {stateText}</span>
        </div>
      </Html>
    </group>
  )
}

/**
 * Debug (F2) do comportamento das selvagens (`WildBehavior`,
 * `wildBehaviorSystem.js`): em cada uma, uma etiqueta no chão (embaixo,
 * pra não brigar com a etiqueta de nome em cima da cabeça) com o
 * temperamento, o que está fazendo e o alvo (`WildBehavior.target` —
 * quem mais causou dano nela, senão o mais perto), e um círculo no chão com o limite que
 * vale agora (`resolveBehaviorRadius`, `core/battle/wildBehavior.js` — a
 * MESMA regra que o system usa pra decidir), medido a partir da criatura.
 * Cor do círculo: laranja = raio de aggro, vermelho = limite pra desistir
 * da perseguição, azul = distância segura da fuga.
 *
 * Só montado com o modo debug ligado (`src/app/(auth)/page.js`).
 * `useFrame` é a exceção documentada de debug: só acompanha a posição,
 * nunca escreve estado de jogo.
 */
export function WildBehaviorDebugView() {
  const entities = useQuery(WildCreature, WildBehavior, Position)

  return (
    <>
      {entities.map((entity) => (
        <WildBehaviorDebug key={entity} entity={entity} />
      ))}
    </>
  )
}
