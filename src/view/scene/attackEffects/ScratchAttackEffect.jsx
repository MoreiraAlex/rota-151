import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useAdditiveEffectMesh } from './useAdditiveEffectMesh'

// Mesmo valor de `visual.effectVisualDuration` da definição de ataque
// (`core/data/attacks/scratch/index.js`) — só usada aqui pra dimensionar
// a curva da animação; a entidade de verdade morre pelo `lifetime` do
// trait (`attackEffectSystem.js`), à parte (mesmo desacoplamento que
// `SummonFlashView.jsx` já documenta pro clarão de invocar).
const IMPACT_DURATION = 0.35
const SCRATCH_MODEL_PATH = '/assets/effects/scratch.glb'
const SCRATCH_COLOR = '#fff3c4'
// Constante de NORMALIZAÇÃO do rip (`.exemple/Effects/EffCommonScratch.obj`,
// malha original ~22 unidades no eixo mais longo — nada a ver com metro
// do jogo) — só converte a unidade arbitrária do `.obj` pra algo perto de
// 1 antes de aplicar `radius`/`scale` (config, ver `SCRATCH_ATTACK.
// visual.scale`); NÃO é o multiplicador de tamanho por criatura (esse
// agora é dado, não código — pedido do usuário: "a escala dos efeitos
// deveria estar na config do ataque, pois uma criatura grande vai ter o
// efeito maior... mesmo os 2 usando o mesmo efeito"). Valor de PARTIDA,
// ajustar olhando o resultado em jogo, mesmo processo de `model.scale`
// em `core/data/species/*/index.js`.
const SCRATCH_BASE_SCALE = 0.25

/**
 * Visual do grupo `'scratch'` (ver docs/features/025-ataque-comum-de-
 * criatura.md) — malha de verdade (`EffCommonScratch`, rip de efeito
 * comum de Pokémon, convertida de `.obj`/`.mtl` pra `.glb` via
 * `obj2gltf`/`gltf-pipeline -d`, ver `public/assets/effects/scratch.glb`)
 * no lugar do impacto procedural das rodadas anteriores — pedido do
 * usuário depois de disponibilizar a pasta `.exemple/Effects/`.
 * Material/clone via `useAdditiveEffectMesh.js` (compartilhado com
 * `PunchAttackEffect.jsx`), com `reveal: true` — ver docstring lá pro
 * mecanismo do shader.
 *
 * `revealDuration` (segundos, de `attack.visual.revealDuration` —
 * `core/data/attacks/scratch/index.js`) — pedido explícito do usuário: o
 * efeito não aparece inteiro de uma vez, é REVELADO progressivamente (0%
 * a 100% do traço visível ao longo desse tempo, depois fica revelado por
 * inteiro), dando a sensação de golpe partindo de um ponto até outro.
 * `0` (ou omitido) = revelado por inteiro desde o primeiro frame — sem
 * divisão por zero, só pula a interpolação. Relógio PRÓPRIO
 * (`elapsedRef`, o mesmo que já cronometra o fade), independente de
 * `IMPACT_DURATION` — a revelação pode terminar bem antes do efeito
 * começar a esvair, ou não, dependendo de como `revealDuration` for
 * configurado em relação a `effectVisualDuration`.
 *
 * Anima por um `t` (0→1) ao longo de `IMPACT_DURATION` (`useFrame`, mesmo
 * espírito cosmético de `SummonFlashView.jsx` — não lê o `lifetime` do
 * ECS a cada frame): cresce um pouco e esvai. A ORIENTAÇÃO (pra onde o
 * "rasgão" aponta) vem de fora — `AttackEffect.Rotation`, setada por
 * `creatureAttackSystem.js` com a direção 3D do golpe (mais o ajuste fino
 * de `attack.visual.rotationOffset`), aplicada pelo `syncTransformSystem`
 * no grupo pai (`AttackEffectView.jsx`); este componente só cuida de
 * escala/opacidade/revelação locais.
 *
 * `scale` (de `attack.visual.scale`, multiplicador — ver
 * `SCRATCH_ATTACK.visual.scale`) é o tamanho FINAL configurável — uma
 * criatura grande sobrescreve só isto pra ter o mesmo arranhão maior,
 * sem duplicar o resto do ataque. Multiplica junto de `radius` e
 * `SCRATCH_BASE_SCALE` (a normalização técnica do rip, não mexe nisso
 * pra ajustar tamanho por criatura).
 *
 * `alignForwardTip: true` — bug real, relatado jogando: "o efeito do
 * Scratch está atravessando o muro". Ver docstring completa em
 * `useAdditiveEffectMesh.js`; resumo: a malha do rip não nasce "puxada
 * pra trás" da própria origem, então metade dela desenhava ALÉM do
 * ponto de impacto (dentro da parede que `resolveAttackImpactPoint` já
 * travou antes). Corrige alinhando a ponta mais distante da malha com a
 * origem — só este grupo usa (`PunchAttackEffect.jsx` não precisa, malha
 * radialmente simétrica ao redor do próprio centro).
 */
export function ScratchAttackEffect({ radius, revealDuration = 0, scale = 1 }) {
  const { object, materials, revealUniforms } = useAdditiveEffectMesh(
    SCRATCH_MODEL_PATH,
    SCRATCH_COLOR,
    { reveal: true, alignForwardTip: true },
  )
  const elapsedRef = useRef(0)

  useFrame((_state, delta) => {
    elapsedRef.current += delta
    const t = Math.min(elapsedRef.current / IMPACT_DURATION, 1)

    object.scale.setScalar(
      radius * SCRATCH_BASE_SCALE * scale * (0.8 + t * 0.4),
    )
    for (const material of materials) material.opacity = 1 - t

    const revealProgress =
      revealDuration > 0 ? Math.min(elapsedRef.current / revealDuration, 1) : 1
    for (const uniform of revealUniforms) uniform.value = revealProgress
  })

  return <primitive object={object} />
}

useGLTF.preload(SCRATCH_MODEL_PATH)
