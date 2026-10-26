import { useTexture } from '@react-three/drei'
import {
  STRING_SHOT_EMITTERS,
  STRING_SHOT_TARGET_EMITTERS,
  STRING_SHOT_TEXTURE_PATHS,
} from '@/view/vfx/stringShotVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'string-shot'` (skill de status String Shot, docs/
 * features/061-revisao-das-skills.md): os fios de seda e o borrifo saindo da
 * boca e abrindo no leque do cone (config em `view/vfx/stringShotVfx.js`). O
 * `AttackEffect` nasce na ponta do cone orientado pro golpe; a criatura fica
 * em (0, 0, -`length`).
 */
export function StringShotAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: STRING_SHOT_EMITTERS,
    texturePaths: STRING_SHOT_TEXTURE_PATHS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}

/**
 * Visual do grupo `'string-shot-target'`: os fios girando e a teia enrolando
 * CADA alvo atingido (o `AttackEffect` nasce no corpo do alvo, virado como
 * ele, e `body` é o tamanho dele). A teia que fica no corpo enquanto a
 * Velocidade está baixa é do `StatusConditionEffectsView`.
 */
export function StringShotTargetAttackEffect({
  rise,
  radius,
  length = 0,
  scale = 1,
  body = null,
}) {
  const groupRef = useParticleAttackEffect({
    rise,
    emitters: STRING_SHOT_TARGET_EMITTERS,
    texturePaths: STRING_SHOT_TEXTURE_PATHS,
    length,
    radius,
    scale,
    body,
  })

  return <group ref={groupRef} />
}

useTexture.preload(Object.values(STRING_SHOT_TEXTURE_PATHS))
