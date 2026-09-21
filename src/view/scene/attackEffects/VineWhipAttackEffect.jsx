import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useAdditiveEffectMesh } from './useAdditiveEffectMesh'

// Mesmo valor de `visual.effectVisualDuration` — ver docstring de
// `ScratchAttackEffect.jsx`.
const IMPACT_DURATION = 0.35
const CUT_MODEL_PATH = '/assets/effects/vine-whip-cut.glb'
const SHOCKWAVE_MODEL_PATH = '/assets/effects/vine-whip-shockwave.glb'
const CUT_COLOR = '#7ee787'
const SHOCKWAVE_COLOR = '#c8f5c0'
// Constantes de NORMALIZAÇÃO dos rips (`EffCommonHitCut`/
// `HitCutShockWave`, malhas originais bem maiores que 1 unidade de jogo
// — mesmo espírito de `SCRATCH_BASE_SCALE`/`HIT_BASE_SCALE`, ver
// docstring completa em `ScratchAttackEffect.jsx`) — NÃO são o
// multiplicador de tamanho por criatura (`VINE_WHIP_ATTACK.visual.scale`
// cuida disso). Valores de PARTIDA, ajustar olhando o resultado em jogo.
const CUT_BASE_SCALE = 0.05
const SHOCKWAVE_BASE_SCALE = 0.025

/**
 * Visual do grupo `'vine-whip'` (skill do Bulbasaur — ver
 * docs/features/025-ataque-comum-de-criatura.md, "9ª rodada": "pode fazer
 * as habilidades agora?... procura um efeito na pasta de Effects").
 * Combina duas malhas de rip de Pokémon (`EffCommonHitCut` — o corte
 * plano, sem profundidade no eixo Z, então livre do bug de "atravessar
 * parede" que o `'scratch'` teve — ver "Correção" em docs/features/025 —
 * + `EffCommonHitCutShockWave` — a onda de choque que acompanha, mesma
 * dupla flash+onda de `PunchAttackEffect.jsx`), tingidas de VERDE
 * (`CUT_COLOR`/`SHOCKWAVE_COLOR`) — as texturas de origem são mapas de
 * brilho em escala de cinza, então a cor final vem inteira do tint
 * (`color`, `useAdditiveEffectMesh.js`), mesma técnica de sempre.
 *
 * Mesma técnica de material/clone de `ScratchAttackEffect.jsx`/
 * `PunchAttackEffect.jsx` (`useAdditiveEffectMesh.js`, compartilhado).
 * Sem `alignForwardTip`/reveal — a malha do corte é praticamente plana no
 * eixo que vira "direção do golpe" (Z ≈ 0, um "cartão" fino, não um
 * traço com profundidade como o `'scratch'`), e a onda de choque nasce
 * inteira em Z negativo (atrás do ponto de impacto, nunca além dele) —
 * nenhuma das duas malhas tem o problema geométrico que motivou
 * `alignForwardTip` (ver `useAdditiveEffectMesh.js`).
 *
 * `scale` (de `attack.visual.scale`) multiplica as duas malhas juntas,
 * mantendo a proporção entre `CUT_BASE_SCALE`/`SHOCKWAVE_BASE_SCALE` —
 * mesmo mecanismo de `PunchAttackEffect.jsx`.
 */
export function VineWhipAttackEffect({ radius, scale = 1 }) {
  const cut = useAdditiveEffectMesh(CUT_MODEL_PATH, CUT_COLOR)
  const shockwave = useAdditiveEffectMesh(SHOCKWAVE_MODEL_PATH, SHOCKWAVE_COLOR)
  const elapsedRef = useRef(0)

  useFrame((_state, delta) => {
    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / IMPACT_DURATION, 1)
    const fade = 1 - t

    cut.object.scale.setScalar(radius * CUT_BASE_SCALE * scale * (0.7 + t * 0.5))
    for (const material of cut.materials) material.opacity = fade

    shockwave.object.scale.setScalar(
      radius * SHOCKWAVE_BASE_SCALE * scale * (0.3 + t * 1.4),
    )
    for (const material of shockwave.materials) material.opacity = fade * 0.8
  })

  return (
    <group>
      <primitive object={cut.object} />
      <primitive object={shockwave.object} />
    </group>
  )
}

useGLTF.preload(CUT_MODEL_PATH)
useGLTF.preload(SHOCKWAVE_MODEL_PATH)
