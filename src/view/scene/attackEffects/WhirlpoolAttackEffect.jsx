import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useAdditiveEffectMesh } from './useAdditiveEffectMesh'

// Mesmo valor de `visual.effectVisualDuration` da definição de ataque
// (`core/data/attacks/whirlpool/index.js`, 0.45 — um pouco mais longo que
// as demais skills, o vórtice "gira" antes de esvair).
const IMPACT_DURATION = 0.45
const WHIRLPOOL_MODEL_PATH = '/assets/effects/whirlpool.glb'
const WHIRLPOOL_COLOR = '#4fc3f7'
// Rotação em torno do próprio eixo Y local (rad/s) — flourish barato:
// a malha já É um vórtice (`EffCommonWhirlwindL`, formato de tornado no
// rip original), girar em cima disso reforça a leitura de "redemoinho"
// sem esforço nenhum (rotação LOCAL, independente da `Rotation` do ECS
// que já orienta o grupo pai pra direção do golpe).
const SPIN_SPEED = 6
// Constante de NORMALIZAÇÃO do rip (`EffCommonWhirlwindL`, malha original
// ~22 unidades de diâmetro — mesmo espírito de `SCRATCH_BASE_SCALE`, ver
// docstring completa em `ScratchAttackEffect.jsx`) — NÃO é o
// multiplicador de tamanho por criatura (`WHIRLPOOL_ATTACK.visual.scale`
// cuida disso). Valor de PARTIDA, ajustar olhando o resultado em jogo.
const WHIRLPOOL_BASE_SCALE = 0.11

/**
 * Visual do grupo `'whirlpool'` (skill do Squirtle — ver
 * docs/features/025-ataque-comum-de-criatura.md, "9ª rodada": "pode fazer
 * as habilidades agora?... procura um efeito na pasta de Effects").
 * `EffCommonWhirlwindL` (rip de Pokémon, uma coluna girando — formato de
 * tornado, radialmente simétrica no plano XZ) tingida de AZUL
 * (`WHIRLPOOL_COLOR`) — escolhida em vez de `EffCommonIce` porque o
 * `.mtl` do Ice referencia uma textura QUEBRADA (arquivo inexistente,
 * ~26% da malha) — ver docstring completa em `core/data/attacks/
 * whirlpool/index.js`.
 *
 * Simétrica no plano XZ (X e Z de -11 a +11 nos dois materiais de anel,
 * conferido no `.glb` gerado) — livre do bug de "atravessar parede" que
 * o `'scratch'` teve (nenhum vértice sobra além da origem na direção do
 * golpe), sem precisar de `alignForwardTip`.
 *
 * Mesma técnica de material/clone de `ScratchAttackEffect.jsx`/
 * `PunchAttackEffect.jsx` (`useAdditiveEffectMesh.js`, compartilhado).
 * Cresce/esvai como os outros grupos, mais uma ROTAÇÃO própria em Y
 * (`SPIN_SPEED`) — a única diferença estrutural entre os 4 grupos de
 * efeito hoje, puramente cosmética.
 *
 * `scale` (de `attack.visual.scale`) é o tamanho FINAL configurável,
 * mesmo mecanismo de todos os outros grupos — ver docstring completa em
 * `ScratchAttackEffect.jsx`.
 */
export function WhirlpoolAttackEffect({ radius, scale = 1 }) {
  const whirlpool = useAdditiveEffectMesh(WHIRLPOOL_MODEL_PATH, WHIRLPOOL_COLOR)
  const elapsedRef = useRef(0)

  useFrame((_state, delta) => {
    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / IMPACT_DURATION, 1)

    whirlpool.object.scale.setScalar(
      radius * WHIRLPOOL_BASE_SCALE * scale * (0.6 + t * 0.6),
    )
    whirlpool.object.rotation.y += delta * SPIN_SPEED
    for (const material of whirlpool.materials) material.opacity = 1 - t
  })

  return <primitive object={whirlpool.object} />
}

useGLTF.preload(WHIRLPOOL_MODEL_PATH)
