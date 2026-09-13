'use client'

/**
 * Spike de comparação visual — NÃO faz parte do jogo. O motor de animação
 * procedural em si (applyAnimationClip.js, curves.js, resolveBones.js) já foi
 * promovido pra src/core/animation — é o mecanismo real do jogo agora, usado
 * pelo treinador (ver PlayerView.jsx) e por qualquer criatura futura.
 *
 * Esta página continua existindo como ferramenta de pré-visualização: o
 * elenco mostrado (modelos, escalas, clipes) fica inteiro em roster.js — este
 * arquivo aqui só monta a cena, não sabe qual criatura está renderizando.
 *
 * Como este componente é uma raiz R3F própria, fora do Canvas/GameLoop do
 * jogo, o `useFrame` aqui não viola a regra de "um único useFrame" do projeto
 * (essa regra vale pro loop do jogo em src/view/loop/GameLoop.jsx).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { resolveBones } from '@/core/animation/resolveBones'
import { applyAnimationClip } from '@/core/animation/applyAnimationClip'
import { CREATURES } from '@/tools/proceduralAnimation/roster'

// Ações disponíveis nos botões — união das ações que aparecem em CREATURES.
const ACTIONS = [...new Set(CREATURES.flatMap((c) => Object.keys(c.clips)))]

function AnimatedCreature({ model, scale, position, clip, speed }) {
  const { scene } = useGLTF(model)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])
  const bonesRef = useRef(null)

  useEffect(() => {
    let skeleton = null
    cloned.traverse((child) => {
      if (child.isSkinnedMesh) skeleton = child.skeleton
    })
    bonesRef.current = skeleton ? resolveBones(skeleton) : null
  }, [cloned])

  useFrame((state) => {
    if (!bonesRef.current || !clip) return
    applyAnimationClip(clip, bonesRef.current, state.clock.elapsedTime, speed)
  })

  return (
    <group position={position}>
      <primitive object={cloned} scale={scale} />
    </group>
  )
}

export default function ProceduralFoxPage() {
  const [speed, setSpeed] = useState(1)
  const [action, setAction] = useState(ACTIONS[0])

  return (
    <div className="relative h-screen w-screen bg-neutral-900">
      <Canvas shadows camera={{ position: [0, 3, 10], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
        <OrbitControls />
        <gridHelper args={[20, 20]} />
        {CREATURES.map((creature) => (
          <AnimatedCreature
            key={creature.id}
            model={creature.model}
            scale={creature.scale}
            position={creature.position}
            clip={creature.clips[action]}
            speed={speed}
          />
        ))}
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 space-y-2 rounded bg-black/60 p-3 text-sm text-white">
        <div className="pointer-events-auto flex gap-2">
          {ACTIONS.map((name) => (
            <button
              key={name}
              onClick={() => setAction(name)}
              className={`rounded px-2 py-1 ${
                name === action ? 'bg-white text-black' : 'bg-white/20'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="pointer-events-auto flex items-center gap-2 pt-1">
          Velocidade
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.1"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
          <span>{speed.toFixed(1)}x</span>
        </label>
      </div>
    </div>
  )
}

for (const creature of CREATURES) useGLTF.preload(creature.model)
