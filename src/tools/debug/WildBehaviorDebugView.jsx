'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useQuery, useTrait } from 'koota/react'
import * as THREE from 'three'
import { resolveCreatureAttack } from '@/core/battle/creatureAttack'
import { resolveBehaviorRadius } from '@/core/battle/wildBehavior'
import { getSpecies } from '@/core/data/species'
import { verticalClearance } from '@/core/physics/colliders'
import {
  AiMovement,
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

/**
 * Golpe da IA pro debug (`attackSlot`/`lastAttackSlot` de `WildBehavior` ou
 * `PartyBehavior`, `planAiAttack`): o planejado (`· próximo: ember`) ou, sem
 * plano (golpe em andamento, nada pronto), o último pedido
 * (`· último: tackle`), ou `· descansando` com a energia baixa. Exportado: `PartyBehaviorDebugView.jsx` usa o mesmo.
 */
export function attackPlanLabel(entity, behavior) {
  // Energia baixa: sem golpe até recuperar (`resolveResting`).
  if (behavior.resting) return ' · descansando'
  const slot = behavior.attackSlot ?? behavior.lastAttackSlot
  if (!slot) return ''
  const speciesId = resolveCreatureSpeciesId(entity)
  const attack = speciesId
    ? resolveCreatureAttack(getSpecies(speciesId), slot)
    : null
  const name = slot === 'primary' ? 'básico' : (attack?.id ?? slot)
  return ` · ${behavior.attackSlot ? 'próximo' : 'último'}: ${name}`
}

const MOVEMENT_LABEL = {
  approach: 'aproximando',
  dodge: 'desviando',
  retreat: 'recuando',
  strafe: 'rodeando',
  dash: 'dash',
  aim: 'mirando',
}

/**
 * Movimento da IA na luta pro debug (`AiMovement.mode`, `aiMovement.js`):
 * `· desviando`, `· recuando`, `· rodeando`... Vazio parada ou sem o trait.
 * Exportado: `PartyBehaviorDebugView.jsx` usa o mesmo.
 */
export function movementLabel(movement) {
  const label = movement?.mode ? MOVEMENT_LABEL[movement.mode] : null
  return label ? ` · ${label}` : ''
}

const STATE_RING_COLOR = {
  wander: '#ffb000',
  chase: '#ff3030',
  flee: '#3fa9ff',
}

function WildBehaviorDebug({ entity }) {
  const groupRef = useRef()
  const behavior = useTrait(entity, WildBehavior)
  const movement = useTrait(entity, AiMovement)
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
    ? ` → ${combatantLabel(behavior.target)}` +
      (behavior.state === 'chase'
        ? attackPlanLabel(entity, behavior) + movementLabel(movement)
        : '')
    : ''
  const stateText = fainted
    ? `desmaiada (${Math.ceil(fainted.timeLeft)}s)`
    : STATE_LABEL[behavior.state] +
      (behavior.provoked ? ' (provocada)' : '') +
      // Fugiu com a vida baixa: não briga até se recuperar.
      (behavior.shaken ? ' (abalada)' : '') +
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
