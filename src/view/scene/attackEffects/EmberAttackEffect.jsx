import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useAdditiveEffectMesh } from './useAdditiveEffectMesh'

// Mesmo valor de `visual.effectVisualDuration` — ver docstring de
// `ScratchAttackEffect.jsx`.
const IMPACT_DURATION = 0.35
const FIRE_MODEL_PATH = '/assets/effects/ember-fire.glb'
// Neutro (branco) — a textura de origem (`eff_cmn_hit_fire.png`) já tem
// as cores de fogo (laranja/vermelho) desenhadas nela, diferente das
// outras malhas (mapas de brilho em cinza puro que dependem do tint pra
// ter cor nenhuma) — tingir de branco deixa a cor original passar sem
// alteração.
const FIRE_COLOR = '#ffffff'
// Constante de NORMALIZAÇÃO do rip (`EffCommonHitFire`, malha original
// ~11 unidades no eixo mais longo — mesmo espírito de `SCRATCH_BASE_SCALE`,
// ver docstring completa em `ScratchAttackEffect.jsx`) — NÃO é o
// multiplicador de tamanho por criatura (`EMBER_ATTACK.visual.scale`
// cuida disso). Valor de PARTIDA, ajustar olhando o resultado em jogo.
const FIRE_BASE_SCALE = 0.18

/**
 * Visual do grupo `'ember'` (skill do Charmander — ver docs/features/025-
 * ataque-comum-de-criatura.md, "9ª rodada": "pode fazer as habilidades
 * agora?... procura um efeito na pasta de Effects"). Malha única
 * (`EffCommonHitFire`, rip de Pokémon, plana no eixo Z — mesmo "cartão"
 * fino de `EffCommonHitCut`, sem profundidade que possa "atravessar
 * parede"), sem combo de duas malhas (diferente de `'punch'`/
 * `'vine-whip'`) — um estouro de fogo único, sem onda de choque separada.
 *
 * Mesma técnica de material/clone de `ScratchAttackEffect.jsx`/
 * `PunchAttackEffect.jsx` (`useAdditiveEffectMesh.js`, compartilhado).
 * Sem `reveal`/`alignForwardTip` — instantâneo (estouro, não um traço
 * progressivo) e sem profundidade nenhuma pra "atravessar" nada.
 *
 * `scale` (de `attack.visual.scale`) é o tamanho FINAL configurável,
 * mesmo mecanismo de todos os outros grupos — ver docstring completa em
 * `ScratchAttackEffect.jsx`.
 */
export function EmberAttackEffect({ radius, scale = 1 }) {
  const fire = useAdditiveEffectMesh(FIRE_MODEL_PATH, FIRE_COLOR)
  const elapsedRef = useRef(0)

  useFrame((_state, delta) => {
    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / IMPACT_DURATION, 1)

    fire.object.scale.setScalar(
      radius * FIRE_BASE_SCALE * scale * (0.7 + t * 0.6),
    )
    for (const material of fire.materials) material.opacity = 1 - t
  })

  return <primitive object={fire.object} />
}

useGLTF.preload(FIRE_MODEL_PATH)
