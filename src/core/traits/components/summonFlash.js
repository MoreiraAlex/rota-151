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

/**
 * A Pokébola abrindo depois de pousar, ao invocar (docs/features/043-
 * captura.md): só visual — fica parada em cima do ponto onde a criatura
 * nasceu (`Position`, o centro da bola), toca o clipe `summon` do `.glb` e
 * some. `itemId` é a bola do Pokémon (`Pokemon.ballId`); `elapsed`/
 * `duration` em segundos.
 *
 * Dono de escrita: `summonBallSystem` (spawna, junto da criatura);
 * `summonEffectsSystem` (conta e destrói).
 */
export const SummonBallOpen = trait({
  itemId: null,
  elapsed: 0,
  duration: 0,
})
