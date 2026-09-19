import { trait } from 'koota'

/**
 * Efeito visual passageiro de "a esfera se abre com um clarão de luz e a
 * criatura aparece" (ver docs/features/024-esfera-de-invocar.md) — mesmo
 * formato trivial de `ConsumeEffect` (`Position`/`Rotation` já existentes
 * cuidam de onde aparece; `lifetime` conta em segundos até desaparecer
 * sozinho; sem movimento, parado no ponto em que a `SummonBall` pousou).
 *
 * Dono de escrita: `summonBallSystem` (spawna, no exato ponto/tick em que
 * a `SummonedCreature` nasce — ver `resolveBall`); `summonEffectsSystem`
 * (conta `lifetime` pra baixo, destrói a entidade ao chegar a zero).
 */
export const SummonFlash = trait({
  lifetime: 0,
})
