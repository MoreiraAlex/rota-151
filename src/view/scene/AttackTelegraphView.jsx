'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { world } from '@/core/world/world'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSpecies } from '@/core/data/species'
import { resolveEntityAttack } from '@/core/battle/creatureAttack'
import { resolveAttackTelegraphProgress } from '@/core/battle/attackTelegraph'
import { isSelfAttack } from '@/core/battle/channelAttack'
import {
  ActionState,
  CharacterController,
  PhysicsBody,
  Position,
  resolveCreatureSpeciesId,
} from '@/core/traits'
import { AttackShape, paintAttackShape, placeAttackShape } from './AttackShape'

const {
  FILL_COLOR,
  FILL_OPACITY,
  EDGE_COLOR,
  EDGE_OPACITY,
  SELF_FILL_COLOR,
  SELF_EDGE_COLOR,
  POOL_SIZE,
} = GAME_CONFIG.FEEDBACK.ATTACK_TELEGRAPH
const POOL = Array.from({ length: POOL_SIZE }, (_, index) => index)

// Cores de cada tipo de aviso: o golpe comum e a CARGA de um golpe em si
// mesmo (Growth — círculo nos pés, que ainda pode ser interrompido).
const PAINT = {
  attack: { fill: FILL_COLOR, edge: EDGE_COLOR },
  self: { fill: SELF_FILL_COLOR, edge: SELF_EDGE_COLOR },
}

/**
 * Aviso de golpe: enquanto QUALQUER criatura (time ou selvagem) executa
 * um ataque, a área aparece no chão — a MESMA que o golpe calcula
 * (cápsula no golpe normal, leque no canalizado — `AttackShape.jsx`):
 * contorno com a área inteira e preenchimento crescendo da origem até a
 * ponta, completando no instante do dano (`resolveAttackTelegraphProgress`). Mostra onde vai
 * acertar e dá tempo de desviar. Sempre ligado, sem parâmetro por ataque.
 * Golpe em si mesmo (`area: 'self'`): um círculo nos pés, em outra cor
 * (`SELF_FILL_COLOR`), mostrando a carga que ainda pode ser interrompida.
 *
 * Mesma forma e trajetória do indicador de mira (`placeAttackShape`), mas na
 * direção TRAVADA no disparo (`ActionState.dirX/dirZ`), não na da câmera.
 * Respeita profundidade (diferente do indicador de mira): corpos e
 * obstáculos tampam o leque normalmente.
 * Pool fixo de `POOL_SIZE` leques (efeito que nasce várias vezes por
 * segundo — regra do projeto); atacantes além disso ficam sem aviso.
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual:
 * só LÊ estado do ECS e reposiciona os próprios meshes.
 */
export function AttackTelegraphView() {
  const shapeRefs = useRef([])
  // tipo de aviso com que cada forma do pool está pintada agora
  const paintedRefs = useRef([])

  useFrame(() => {
    let used = 0
    world
      .query(ActionState, CharacterController, PhysicsBody, Position)
      .forEach((entity) => {
        if (used >= POOL_SIZE) return
        const action = entity.get(ActionState)
        if (action.current !== 'attack') return

        const species = getSpecies(resolveCreatureSpeciesId(entity))
        const attack = resolveEntityAttack(entity, species, action.pendingSlot)
        const progress = resolveAttackTelegraphProgress(action, attack)
        if (progress === null) return

        const shape = shapeRefs.current[used]
        if (!shape?.root) return
        const kind = isSelfAttack(attack) ? 'self' : 'attack'
        if (paintedRefs.current[used] !== kind) {
          paintAttackShape(shape, PAINT[kind])
          paintedRefs.current[used] = kind
        }
        placeAttackShape(shape, {
          pos: entity.get(Position),
          body: entity.get(CharacterController),
          colliderHandle: entity.get(PhysicsBody).colliderHandle,
          species,
          attack,
          direction: { x: action.dirX, y: action.dirY, z: action.dirZ },
          progress,
        })
        shape.root.visible = true
        used++
      })

    for (let index = used; index < POOL_SIZE; index++) {
      const shape = shapeRefs.current[index]
      if (shape?.root) shape.root.visible = false
    }
  })

  return POOL.map((index) => (
    <AttackShape
      key={index}
      ref={(handle) => (shapeRefs.current[index] = handle)}
      fillColor={FILL_COLOR}
      fillOpacity={FILL_OPACITY}
      edgeColor={EDGE_COLOR}
      edgeOpacity={EDGE_OPACITY}
      depthTest
      // Acima do anel de tempo da ação (`ActionTimerRingView`, ordens 14 e 15):
      // onde os dois se sobrepõem, o aviso fica POR CIMA do anel.
      renderOrder={16}
    />
  ))
}
