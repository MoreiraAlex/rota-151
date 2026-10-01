import { FLAMETHROWER_EMITTERS } from '@/view/vfx/flamethrowerVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

// Fração da taxa do original (o `actor` solta 150 partículas/s por 1 s,
// mais o alvo e dois estouros — dezenas de sprites com material próprio).
// Valor de PARTIDA pra aliviar o custo; 1 = fiel ao Cobblemon. Ajustar
// olhando o resultado e o desempenho em jogo.
const DENSITY = 0.6

/**
 * Visual do grupo `'flamethrower'` (Lança-chamas) — jato contínuo de fogo
 * da boca (1 s), fogo e estouros no alvo e brasinhas subindo, em
 * partículas traduzidas do Cobblemon (config, diferenças e linha do tempo
 * em `view/vfx/flamethrowerVfx.js`). Mesmo esquema de `EmberAttackEffect.jsx`
 * (efeito nasce no impacto, criatura em (0, 0, -`length`)); o jato escala
 * por `length` pra alcançar o alvo do golpe.
 *
 * Dura ~2.4 s — a skill precisa de `visual.effectVisualDuration` ≥ isso,
 * senão o efeito some no meio.
 */
export function FlamethrowerAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: FLAMETHROWER_EMITTERS,
    length,
    radius,
    scale,
    density: DENSITY,
  })

  return <group ref={groupRef} />
}
