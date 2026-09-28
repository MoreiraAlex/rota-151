'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '@/core/world/world'
import {
  CharacterController,
  InputControlled,
  Position,
  PathState,
  Velocity,
} from '@/core/traits'
import { resolvePathDebugPoints } from './pathDebugPoints'

// Eleva um pouco do chão — sem isso a linha some dentro do collider/mesh
// do chão (mesma altura, z-fighting).
const LINE_HEIGHT = 0.1

/**
 * Desenha, por personagem que navega sozinho (quem tem `CharacterController`
 * e não está com `InputControlled` — criatura do time seguindo, treinador
 * virado "bot", selvagem vagando/perseguindo/fugindo), o caminho que ele
 * está seguindo AGORA (`resolvePathDebugPoints`, `pathDebugPoints.js`): da
 * posição dele até cada waypoint restante de `PathState` ou, sem waypoint
 * sobrando, até o destino que a própria navegação gravou
 * (`PathState.target`). Parado ou sem destino, nada.
 *
 * Antes, sem waypoint sobrando, a linha ia sempre até quem está no
 * controle — certo só pra quem segue (`creatureFollowSystem.js`); a
 * selvagem vagando ficava apontando pro jogador entre um recálculo de
 * caminho e outro (relatado pelo usuário, duas vezes). O destino agora
 * vem de quem navega, não é adivinhado aqui.
 *
 * Cada waypoint usa a própria elevação (`waypoint.y`, vem do heightmap —
 * ver "Elevação (heightmap)" em `core/pathfinding.js`) em vez da altura
 * atual de quem está seguindo — a linha acompanha o relevo de verdade.
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

    const navigators = world
      .query(CharacterController, Position, Velocity, PathState)
      .filter((entity) => !entity.has(InputControlled))

    const vertices = []
    for (const entity of navigators) {
      const points = resolvePathDebugPoints(
        entity.get(Position),
        entity.get(PathState),
        entity.get(Velocity),
      )

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
