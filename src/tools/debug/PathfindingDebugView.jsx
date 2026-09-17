'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '@/core/world/world'
import {
  InputControlled,
  Position,
  PathState,
  SummonedCreature,
} from '@/core/traits'

// Eleva um pouco do chão — sem isso a linha some dentro do collider/mesh
// do chão (mesma altura, z-fighting).
const LINE_HEIGHT = 0.1

/**
 * Desenha, por `SummonedCreature`, o caminho que ela está seguindo AGORA —
 * uma polilinha da posição dela até cada waypoint restante de `PathState`
 * (`waypoints.slice(waypointIndex)`, ver `core/pathfinding.js`/
 * `creatureFollowSystem.js`). Sem waypoint nenhum restante (fallback de
 * linha reta — sem obstáculo relevante no meio, ou já alcançou o último),
 * desenha só o segmento direto até o treinador, que é o alvo real nesse
 * caso (mesma regra de `creatureFollowSystem.js`).
 *
 * Cada ponto usa a própria elevação (`waypoint.y`, vem do heightmap — ver
 * "Elevação (heightmap)" em `core/pathfinding.js`) em vez da altura atual
 * da criatura — a linha acompanha o relevo de verdade (sobe rampa/terraço
 * visualmente) em vez de flutuar reta na altura de quem está andando.
 *
 * Mesmo padrão de `PhysicsDebugView.jsx` — `useFrame` aqui é outra exceção
 * documentada da regra de "um único useFrame" (ver `GameLoop.jsx`): só
 * redesenha linhas de debug a cada frame, nunca mexe em estado de jogo.
 * Ferramenta de debug: opcional, montada só quando o toggle está ligado
 * (ver src/app/(auth)/page.js), nunca requisito de gameplay.
 */
export function PathfindingDebugView() {
  const geometryRef = useRef()

  useFrame(() => {
    if (!geometryRef.current) return

    const player = world.queryFirst(InputControlled, Position)
    const creatures = world.query(SummonedCreature, Position, PathState)

    const vertices = []
    for (const creature of creatures) {
      const pos = creature.get(Position)
      const { waypoints, waypointIndex } = creature.get(PathState)
      const remaining = waypoints.slice(waypointIndex)

      const points =
        remaining.length > 0
          ? [pos, ...remaining]
          : player
            ? [pos, player.get(Position)]
            : [pos]

      for (let i = 0; i < points.length - 1; i++) {
        vertices.push(points[i].x, points[i].y + LINE_HEIGHT, points[i].z)
        vertices.push(
          points[i + 1].x,
          points[i + 1].y + LINE_HEIGHT,
          points[i + 1].z,
        )
      }
    }

    geometryRef.current.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vertices), 3),
    )
  })

  return (
    <lineSegments renderOrder={999}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color="cyan" depthTest={false} linewidth={2} />
    </lineSegments>
  )
}
