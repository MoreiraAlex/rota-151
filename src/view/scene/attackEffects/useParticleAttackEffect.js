import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { createParticleSystem } from '@/view/vfx/particleEmitter'
import { FIRE_TEXTURE_PATHS } from '@/view/vfx/fireParticleKit'

// Passo máximo da simulação — um frame longo (aba em segundo plano, hit
// stop) não pode virar um salto enorme das partículas.
const MAX_STEP = 1 / 20
// Golpe colado numa parede tem comprimento ~0; sem um mínimo o jato (e as
// velocidades, que dependem do comprimento) degeneram.
const MIN_LENGTH = 0.5

// Câmera no espaço LOCAL do efeito, reaproveitado entre frames.
const localCamera = new THREE.Vector3()

/**
 * Monta um efeito de golpe feito de partículas (`view/vfx/particleEmitter.js`)
 * e o faz rodar enquanto o componente existir — o miolo comum de
 * `EmberAttackEffect.jsx` e `FlamethrowerAttackEffect.jsx`. Devolve o ref
 * do `<group>` que o componente renderiza (`<group ref={groupRef} />`).
 *
 * O sistema é criado em `useEffect` (não `useMemo`) pra sobreviver ao
 * mount→unmount→mount do StrictMode: um sistema criado em `useMemo` e
 * descartado no cleanup voltaria a ser usado já destruído.
 *
 * `length`/`radius`/`scale` vêm do `AttackEffect` (ver `AttackEffectView.jsx`);
 * `density` alivia um efeito pesado (multiplica a taxa de todos os emissores).
 * `texturePaths`: `{ [chave]: caminho }` das texturas que os specs citam (padrão:
 * as de fogo, `fireParticleKit.js`).
 */
export function useParticleAttackEffect({
  emitters,
  texturePaths = FIRE_TEXTURE_PATHS,
  length = 0,
  radius,
  scale = 1,
  density = 1,
}) {
  const textures = useTexture(texturePaths)
  const groupRef = useRef()
  const systemRef = useRef(null)

  useEffect(() => {
    const system = createParticleSystem({
      emitters,
      textures,
      length: Math.max(length, MIN_LENGTH),
      radius,
      scale,
      density,
    })
    const parent = groupRef.current
    parent.add(system.group)
    systemRef.current = system
    return () => {
      parent.remove(system.group)
      system.dispose()
      systemRef.current = null
    }
  }, [emitters, textures, length, radius, scale, density])

  useFrame((state, delta) => {
    const system = systemRef.current
    if (!system) return
    // Partículas `facing: 'direction'` (as ondas do Growl, os riscos do
    // statup) viram a face pra câmera — no espaço do `group`, que é o local
    // do efeito (girado pela trajetória do golpe).
    localCamera.copy(state.camera.position)
    groupRef.current.worldToLocal(localCamera)
    system.setCameraPosition(localCamera)
    system.update(Math.min(delta, MAX_STEP))
  })

  return groupRef
}

useTexture.preload(Object.values(FIRE_TEXTURE_PATHS))
