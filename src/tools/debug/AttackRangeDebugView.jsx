'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world } from '@/core/world/world'
import { resolveAimDirection } from '@/core/aim'
import { getSpecies } from '@/core/data/species'
import { resolveAttackImpactPoint } from '@/core/systems/creatureAttackSystem'
import { resolveCreatureAttack } from '@/core/data/attacks'
import {
  CharacterController,
  InputControlled,
  PhysicsBody,
  Position,
  SummonedCreature,
} from '@/core/traits'

// Eleva um pouco do chão — mesmo motivo de `LINE_HEIGHT` em
// `PathfindingDebugView.jsx` (sem isso o anel some dentro do chão, z-fighting).
const RING_HEIGHT = 0.05
// Anel/esfera unitários (raio ~1) — escalados por `attack.range`/`radius`
// a cada frame (`scale.setScalar`) em vez de recriar geometria, mesmo
// truque que `RecallBeamView.jsx` documenta pra forma simples que só
// precisa mudar de TAMANHO. Segmentos BAIXOS de propósito — ferramenta de
// debug, sem exigência nenhuma de suavidade visual, e as duas formas são
// redesenhadas (posição/escala) todo frame; manter a contagem de
// triângulo mínima evita pagar esse custo por nada (pergunta do usuário
// sobre performance da esfera detalhada da v1 — a geometria em si nunca
// era RECRIADA por frame, só escalada/reposicionada, mas não tinha motivo
// nenhum pra ela ter mais detalhe que isto).
const RING_SEGMENTS = 24
const RING_INNER_RADIUS = 0.96
const RING_OUTER_RADIUS = 1
// Icosaedro de detalhe 0 (12 vértices, 20 triângulos) em vez da esfera UV
// de 16×12 segmentos (~380 triângulos) da v1 — muito mais barato, e uma
// aproximação grosseira de esfera é suficiente pra um indicador de área,
// mesmo raciocínio de `ENVELOPE_DETAIL: 1` em `RecallBeamView.jsx` (forma
// abstrata/de baixo-poli, não precisa ser lisa).
const AREA_DETAIL = 0

// Um par de cores (anel/área) por slot — mesmos rótulos de
// `species.attacks.<slot>`/`resolveActionSlots` (`core/data/
// actionSlots.js`). `primary` (mouse) mantém as cores originais da v1;
// os três novos (Q/E/R, 9ª rodada — ver docs/features/025) ganham cores
// PRÓPRIAS pra não confundir qual guia é de qual botão quando mais de um
// slot está configurado ao mesmo tempo (hoje só `secondary1` tem
// conteúdo, mas o mecanismo já suporta os quatro).
const SLOT_GUIDE_COLORS = {
  primary: { ring: 'cyan', area: 'orange' },
  secondary1: { ring: 'magenta', area: 'yellow' },
  secondary2: { ring: 'lime', area: 'deeppink' },
  secondary3: { ring: 'white', area: 'red' },
}
const ATTACK_SLOTS = Object.keys(SLOT_GUIDE_COLORS)

/**
 * Visualização de debug (F2, ver `src/app/(auth)/page.js`) do alcance e da
 * área efetiva de TODO ataque/skill configurado da criatura controlada
 * (`attacks.primary` E `secondary1-3`, ver docs/features/025-ataque-
 * comum-de-criatura.md — generalizado na 9ª rodada, quando Q/E/R
 * ganharam conteúdo de verdade) — SEMPRE visível enquanto uma
 * `SummonedCreature` estiver no controle (`InputControlled`), não só
 * durante o ataque em si: o objetivo é deixar claro, ANTES de
 * clicar/apertar, onde cada golpe vai acertar. Um guia (anel+área, cores
 * em `SLOT_GUIDE_COLORS`) por slot configurado — criatura sem nenhuma
 * skill em `secondary1-3` (a maioria ainda) só mostra o guia do mouse,
 * igual antes.
 *
 * Dois desenhos por slot, um por conceito:
 * - **Anel** (`ring`, plano, ao redor da criatura) — o ALCANCE NOMINAL
 *   (`attack.range`): a distância máxima configurada, sempre do mesmo
 *   tamanho não importa o que houver no caminho (é o orçamento, não o
 *   resultado). Simétrico, não depende de direção nenhuma.
 * - **Icosaedro wireframe** (`area`) — a ÁREA EFETIVA (`attack.radius`),
 *   centrada exatamente onde `creatureAttackSystem.js` spawnaria o
 *   `AttackEffect` de verdade AGORA — mesma fórmula
 *   (`resolveAttackImpactPoint`, reusada daqui, ver docstring lá): direção
 *   da câmera (`resolveAimDirection`) MENOS o que raycast (`castRay`)
 *   encontrar no caminho antes de `range` — pedido explícito do usuário:
 *   um `range` grande (chicote) não devia "teleportar" através de
 *   parede/obstáculo, e o guia de debug precisa mostrar isso, não um
 *   destino desatualizado que ignoraria a mesma parede que o ataque de
 *   verdade vai respeitar.
 *
 * Todos os guias seguem a câmera AO VIVO, recalculados todo frame (não
 * travados, diferente do disparo de verdade em `creatureAttackSystem.js`,
 * que congela a direção no instante do clique/tecla) — mesma direção pra
 * todos os slots (a criatura só tem UMA câmera), então cada guia mostra
 * "se eu apertar ESTE botão agora, o golpe vai daqui até ali".
 *
 * Sem controlar uma `SummonedCreature` (treinador no controle), o grupo
 * inteiro fica invisível (`visible = false`); com criatura controlada mas
 * sem NENHUM slot configurado, todos os guias individuais ficam
 * invisíveis (mesmo resultado prático) — ferramenta de debug, nunca
 * requisito de gameplay, mesmo princípio de `PathfindingDebugView.jsx`/
 * `PhysicsDebugView.jsx`. `useFrame` aqui é a mesma exceção documentada de
 * sempre (só redesenha debug, nunca mexe em estado de jogo).
 */
export function AttackRangeDebugView() {
  const originRef = useRef()
  const ringRefs = useRef([])
  const areaRefs = useRef([])

  useFrame(() => {
    const origin = originRef.current
    if (!origin) return

    const controlled = world.queryFirst(
      InputControlled,
      SummonedCreature,
      CharacterController,
      PhysicsBody,
      Position,
    )
    origin.visible = !!controlled
    if (!controlled) return

    const pos = controlled.get(Position)
    const body = controlled.get(CharacterController)
    const physicsBody = controlled.get(PhysicsBody)
    const species = getSpecies(controlled.get(SummonedCreature).speciesId)
    const direction = resolveAimDirection(
      world,
      pos,
      physicsBody.colliderHandle,
    )
    const impactOrigin = {
      x: pos.x,
      y: pos.y + body.capsuleRadius + body.capsuleHalfHeight,
      z: pos.z,
    }
    origin.position.set(pos.x, pos.y, pos.z)

    ATTACK_SLOTS.forEach((slot, i) => {
      const ring = ringRefs.current[i]
      const area = areaRefs.current[i]
      if (!ring || !area) return

      const attack = resolveCreatureAttack(species?.attacks?.[slot])
      ring.visible = !!attack
      area.visible = !!attack
      if (!attack) return

      const impactPoint = resolveAttackImpactPoint(
        impactOrigin,
        direction,
        attack.range,
        physicsBody.colliderHandle,
      )

      ring.scale.setScalar(attack.range)
      area.position.set(
        impactPoint.x - pos.x,
        impactPoint.y - pos.y,
        impactPoint.z - pos.z,
      )
      area.scale.setScalar(attack.radius)
    })
  })

  return (
    <group ref={originRef} visible={false}>
      {ATTACK_SLOTS.map((slot, i) => (
        <group key={slot}>
          <mesh
            ref={(el) => (ringRefs.current[i] = el)}
            position-y={RING_HEIGHT}
            rotation-x={-Math.PI / 2}
          >
            <ringGeometry
              args={[RING_INNER_RADIUS, RING_OUTER_RADIUS, RING_SEGMENTS]}
            />
            <meshBasicMaterial
              color={SLOT_GUIDE_COLORS[slot].ring}
              side={THREE.DoubleSide}
              transparent
              opacity={0.6}
              depthTest={false}
            />
          </mesh>
          <mesh ref={(el) => (areaRefs.current[i] = el)} renderOrder={999}>
            <icosahedronGeometry args={[1, AREA_DETAIL]} />
            <meshBasicMaterial
              color={SLOT_GUIDE_COLORS[slot].area}
              wireframe
              depthTest={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
