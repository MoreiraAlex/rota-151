import { GAME_CONFIG } from '../gameConfig'
import { Projectile, Position, Velocity } from '../traits'

/**
 * Move todo `Projectile` (spawnado por `playerActionSystem` ao arremessar,
 * ver docs/features/014-arremessar-usar-e-invocar.md): integra posição,
 * aplica a mesma gravidade do personagem, e conta `lifetime` pra baixo,
 * destruindo a entidade ao chegar a zero.
 *
 * Sem colisão com o mundo ou outra entidade — atravessa tudo e some por
 * tempo. Colisão de projétil é feature própria, pra quando houver algo de
 * verdade pra acertar.
 *
 * Headless. Fase: simulation — independente da ordem com os outros
 * systems (não lê nem escreve nada além dos próprios projéteis).
 */
export function projectileSystem(context) {
  const { world, delta } = context

  world
    .query(Projectile, Position, Velocity)
    .updateEach(([projectile, pos, vel], entity) => {
      vel.y += GAME_CONFIG.PHYSICS.GRAVITY * delta

      pos.x += vel.x * delta
      pos.y += vel.y * delta
      pos.z += vel.z * delta

      projectile.lifetime -= delta
      if (projectile.lifetime <= 0) {
        entity.destroy()
      }
    })
}
