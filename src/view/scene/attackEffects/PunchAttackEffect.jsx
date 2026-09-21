import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useAdditiveEffectMesh } from './useAdditiveEffectMesh'

// Mesmo valor de `visual.effectVisualDuration` — ver docstring de
// `ScratchAttackEffect.jsx`.
const IMPACT_DURATION = 0.35
const HIT_MODEL_PATH = '/assets/effects/hit-normal.glb'
const SHOCKWAVE_MODEL_PATH = '/assets/effects/hit-normal-shockwave.glb'
const HIT_COLOR = '#fff3c4'
const SHOCKWAVE_COLOR = '#ffffff'
// Constantes de NORMALIZAÇÃO dos rips (`.exemple/Effects/
// EffCommonHitNormalA.obj`/`EffCommonHitNormalShockWave.obj`, malhas
// originais bem maiores — ~104 e ~94 unidades no eixo mais longo, escala
// PRÓPRIA de cada rip, nada a ver com metro do jogo nem uma com a outra)
// — só convertem a unidade arbitrária do `.obj` pra algo perto de 1;
// NÃO são o multiplicador de tamanho por criatura (esse é dado, ver
// `PUNCH_ATTACK.visual.scale`/docstring completa em
// `ScratchAttackEffect.jsx`). Valores de PARTIDA, ajustar olhando o
// resultado em jogo, mesmo processo de `model.scale` em `core/data/
// species/*/index.js`.
const HIT_BASE_SCALE = 0.05
const SHOCKWAVE_BASE_SCALE = 0.025

/**
 * Visual do grupo `'punch'` (ver docs/features/025-ataque-comum-de-
 * criatura.md) — segundo grupo de efeito real, pedido pelo usuário junto
 * do `'scratch'`: duas malhas de rip de Pokémon combinadas
 * (`EffCommonHitNormalA` — o flash de impacto — + `EffCommonHitNormalShockWave`
 * — a onda de choque —, convertidas pra `.glb` via `obj2gltf`/
 * `gltf-pipeline -d`). Virou o padrão de toda espécie nova
 * (`attacks.primary: 'punch'`).
 *
 * Mesma técnica de material/clone de `ScratchAttackEffect.jsx`
 * (`useAdditiveEffectMesh.js`, compartilhado). As duas malhas animam
 * juntas, mas com curvas ligeiramente diferentes — o flash cresce pouco e
 * esvai rápido (o "nó" do impacto), a onda de choque se expande bem mais
 * (a "explosão" ao redor) — mesmo princípio de `SummonFlashView.jsx`
 * (`t`/`fade` locais, não lê o `lifetime` do ECS a cada frame).
 *
 * `scale` (de `attack.visual.scale`) multiplica as DUAS malhas juntas,
 * mantendo a proporção relativa entre `HIT_BASE_SCALE`/
 * `SHOCKWAVE_BASE_SCALE` — mesmo mecanismo de tamanho configurável de
 * `ScratchAttackEffect.jsx`, ver docstring completa lá.
 *
 * `alignForwardTip` só na ONDA DE CHOQUE — bug encontrado por inspeção
 * (não relatado jogando, achado enquanto investigava o mesmo problema no
 * `'scratch'`, ver docs/features/025, "Correção: efeito do 'scratch'
 * atravessando parede"): o eixo Z de `EffCommonHitNormalShockWave` vai de
 * `+4.78` a `+72` (accessor de posição do `.glb`) — TODO positivo, ou
 * seja, a malha inteira nasce ALÉM do ponto de impacto na direção do
 * golpe (mesma classe de bug do `'scratch'`, só que na direção oposta —
 * lá a malha ficava metade além, aqui é o rip INTEIRO). O flash
 * (`EffCommonHitNormalA`, Z de `-15` a `-8`, todo NEGATIVO) não precisa —
 * já nasce inteiro atrás do ponto de impacto, nunca atravessa nada.
 */
export function PunchAttackEffect({ radius, scale = 1 }) {
  const hit = useAdditiveEffectMesh(HIT_MODEL_PATH, HIT_COLOR)
  const shockwave = useAdditiveEffectMesh(SHOCKWAVE_MODEL_PATH, SHOCKWAVE_COLOR, {
    alignForwardTip: true,
  })
  const elapsedRef = useRef(0)

  useFrame((_state, delta) => {
    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / IMPACT_DURATION, 1)
    const fade = 1 - t

    hit.object.scale.setScalar(
      radius * HIT_BASE_SCALE * scale * (0.7 + t * 0.5),
    )
    for (const material of hit.materials) material.opacity = fade

    shockwave.object.scale.setScalar(
      radius * SHOCKWAVE_BASE_SCALE * scale * (0.3 + t * 1.4),
    )
    for (const material of shockwave.materials) material.opacity = fade * 0.8
  })

  return (
    <group>
      <primitive object={hit.object} />
      <primitive object={shockwave.object} />
    </group>
  )
}

useGLTF.preload(HIT_MODEL_PATH)
useGLTF.preload(SHOCKWAVE_MODEL_PATH)
