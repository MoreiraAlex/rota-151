import { trait } from 'koota'

/**
 * Objeto arremessado (ver docs/features/014-arremessar-usar-e-invocar.md) —
 * `Position`/`Velocity` (traits já existentes) cuidam de onde está e pra
 * onde vai; `lifetime` é quanto tempo (segundos) falta até desaparecer
 * sozinho. Sem colisão com o mundo ou outra entidade — atravessa tudo.
 *
 * Dono de escrita: `playerActionSystem` (spawna); `projectileSystem`
 * (integra posição/gravidade, conta `lifetime` pra baixo, destrói a
 * entidade ao chegar a zero).
 */
export const Projectile = trait({
  lifetime: 0,
})
