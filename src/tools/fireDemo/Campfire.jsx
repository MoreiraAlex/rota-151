'use client'

/**
 * Spike de VFX — NÃO faz parte do jogo, mesmo espírito de
 * `tools/proceduralAnimation` (página própria, sem tocar em core/view do
 * jogo). Fogueira feita de partículas em duas camadas (mesma ideia de
 * "Sten"/silhueta + "Core"/brilho interno que os arquivos de textura da
 * chama do Charmander sugerem — ver docs/features/021-pokemons-iniciais-e-
 * selvagens-por-sorteio.md, "pontos de atenção" — usa exatamente esses dois
 * PNGs, reaproveitados do próprio rip) mais um punhado de brasas.
 *
 * A mecânica de partícula E a luz com flicker moram em
 * `view/vfx/flameParticles.js` (`createFlame` já cria a `THREE.PointLight`
 * como filha do próprio grupo, ver docstring de lá) — reaproveitada de
 * verdade agora pelo fogo de cauda do Charmander no jogo
 * (`useAnimatedModel.js`/`tailFireSystem.js`, ver docs/features/022-fogo-
 * de-cauda-do-charmander.md). Este arquivo só cuida do que é específico de
 * SER uma fogueira solta na cena: toras, mancha de cinza, e o carregamento
 * de textura via `useTexture` do drei (componente React comum — não
 * precisa do loader assíncrono imperativo que o hook do jogo usa).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { createFlame } from '@/view/vfx/flameParticles'

/**
 * Parâmetros (todos opcionais, com default de "fogueira normal") — ver
 * `createFlame` em `view/vfx/flameParticles.js` pro que cada um
 * (`shape`/`width`/`height`/`density`/`turbulence`/`palette`/`intensity`)
 * faz de verdade na partícula. Aqui embaixo:
 * - `speed`: multiplica o `delta` passado pra `flame.update` — chama mais
 *   rápida/lenta sem mudar contagem de partícula nenhuma.
 * - `scale`: diferente de `width`/`height` (que mudam o FORMATO da chama,
 *   internos ao `createFlame`) — escala o `<group>` inteiro (partículas,
 *   luz, toras, mancha de cinza) de uma vez, tamanho geral do efeito na
 *   cena.
 */
export function Campfire({
  shape = 'cone',
  width = 1,
  height = 1,
  density = 1,
  turbulence = 1,
  palette = 'fire',
  intensity = 1,
  speed = 1,
  scale = 1,
}) {
  const sten = useTexture(
    '/assets/textures/004-charmander/default/pm0004_00_FireStenA1.png',
  )
  const core = useTexture(
    '/assets/textures/004-charmander/default/pm0004_00_FireCoreA1.png',
  )

  const groupRef = useRef()

  const flame = useMemo(
    () =>
      createFlame(
        { sten, core },
        {
          shape,
          width,
          height,
          density,
          turbulence,
          palette,
          intensity,
          light: {
            color: '#ff8a3d',
            // `distance` (alcance da luz) é em unidades de mundo — ao
            // contrário de posição/geometria, NÃO escala sozinho com o
            // `scale` do `<group>` lá embaixo, precisa ser multiplicado na
            // mão pra continuar iluminando proporcionalmente num fogo
            // grande (por isso `scale` também entra nos deps abaixo).
            distance: 8 * scale,
            decay: 2,
            baseIntensity: 2.2,
            position: { x: 0, y: 0.6, z: 0 },
          },
        },
      ),
    // `shape`/`turbulence`/`intensity` são passados de novo pro `update`
    // no useFrame abaixo (live, sem recriar) — só entram aqui pra dar um
    // valor inicial coerente antes do 1º frame. `width`/`height`/
    // `density`/`palette`/`scale` SÃO motivo de recriar (mudam contagem/
    // raio/cor de base de cada partícula, ou o `distance` da luz — não dá
    // pra só sobrescrever ao vivo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sten, core, width, height, density, palette, scale],
  )

  useEffect(() => {
    const group = groupRef.current
    group.add(flame.group)
    return () => {
      group.remove(flame.group)
      flame.dispose()
    }
  }, [flame])

  useFrame((_, rawDelta) => {
    flame.update(rawDelta * speed, { shape, turbulence, intensity })
  })

  return (
    <group scale={scale}>
      <group ref={groupRef} />

      {/* Toras cruzadas, só pra não parecer fogo flutuando no vazio. */}
      <group position={[0, 0.03, 0]}>
        <mesh rotation={[0, 0.3, Math.PI / 2.3]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 8]} />
          <meshStandardMaterial color="#4a2f1c" />
        </mesh>
        <mesh rotation={[0, -0.4, Math.PI / 1.9]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.7, 8]} />
          <meshStandardMaterial color="#3c2716" />
        </mesh>
      </group>

      {/* Mancha de cinza/terra queimada embaixo. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshStandardMaterial color="#2b2620" />
      </mesh>
    </group>
  )
}

useTexture.preload(
  '/assets/textures/004-charmander/default/pm0004_00_FireStenA1.png',
)
useTexture.preload(
  '/assets/textures/004-charmander/default/pm0004_00_FireCoreA1.png',
)
