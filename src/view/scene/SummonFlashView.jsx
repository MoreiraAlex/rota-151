import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQuery } from 'koota/react'
import { SummonFlash, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'

// Mesmo valor de `actions.summon.flashDuration` (core/data/species/bot/
// index.js) — só usado aqui pra saber quanto tempo animar o fade (a view
// não lê o `lifetime` do trait a cada frame de propósito, ver docstring
// do componente).
const FLASH_DURATION = 0.35
const FLASH_COLOR = '#fff3c4'

/**
 * Visual de um `SummonFlash` (ver docs/features/024-esfera-de-invocar.md
 * — "a esfera se abre com um clarão de luz e a criatura aparece"): uma
 * esfera emissiva que cresce e esvai, mais uma luz pontual que acompanha
 * o mesmo fade, dando o "clarão" no instante exato em que a criatura
 * nasce.
 *
 * Anima via `useFrame` (relógio do R3F, não o tick da simulação) — mesmo
 * espírito de `ConsumeEffectView` delegando a animação pra fora do ECS:
 * é um efeito cosmético de curta duração, não precisa ser determinístico/
 * sincronizado a mais nada. `FLASH_DURATION` é só a duração da ANIMAÇÃO
 * visual — o `lifetime` de verdade (quando a entidade morre de fato,
 * `summonEffectsSystem.js`) é configurado à parte, em `bot/index.js`; os
 * dois devem ficar parecidos (ver `flashDuration` lá) pra não sumir
 * abruptamente no meio do fade nem sobrar tempo com o alpha já zerado.
 */
export function SummonFlashView({ entity }) {
  const groupRef = useRef()
  const meshRef = useRef()
  const lightRef = useRef()
  const elapsedRef = useRef(0)

  useEffect(() => {
    registerView(entity, groupRef.current)
    return () => unregisterView(entity)
  }, [entity])

  useFrame((_state, delta) => {
    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / FLASH_DURATION, 1)
    const fade = 1 - t

    if (meshRef.current) {
      meshRef.current.scale.setScalar(0.25 + t * 1.35)
      meshRef.current.material.opacity = fade
    }
    if (lightRef.current) {
      lightRef.current.intensity = fade * 8
    }
  })

  return (
    <group ref={groupRef}>
      <pointLight ref={lightRef} color={FLASH_COLOR} distance={4} decay={2} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={FLASH_COLOR} transparent opacity={1} />
      </mesh>
    </group>
  )
}

/**
 * Renderiza uma `SummonFlashView` por `SummonFlash` ativo — mesmo padrão
 * de `ConsumeEffectsView`/`ProjectilesView`.
 */
export function SummonFlashesView() {
  const flashes = useQuery(SummonFlash, Position, Rotation)

  return (
    <>
      {flashes.map((entity) => (
        <SummonFlashView key={entity} entity={entity} />
      ))}
    </>
  )
}
