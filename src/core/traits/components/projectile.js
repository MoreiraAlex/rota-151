import { trait } from 'koota'

/**
 * Objeto arremessado (ver docs/features/014-arremessar-usar-e-invocar.md,
 * revisado em docs/features/016-mira-e-arremesso.md) — `Position`/
 * `Velocity` (traits já existentes) cuidam de onde está e pra onde vai;
 * `lifetime` é quanto tempo (segundos) falta até desaparecer sozinho,
 * mesmo já tendo atingido algo. `hit` marca que já colidiu com o mundo
 * (chão/obstáculo) — a partir daí `projectileSystem` para de mover a
 * entidade (`Position` fica parada no ponto do impacto), só o `lifetime`
 * continua contando.
 *
 * Dono de escrita: `playerActionSystem` (spawna); `projectileSystem`
 * (integra posição/gravidade até colidir, detecta o impacto por raycast,
 * conta `lifetime` pra baixo, destrói a entidade ao chegar a zero).
 */
export const Projectile = trait({
  lifetime: 0,
  hit: false,
})
