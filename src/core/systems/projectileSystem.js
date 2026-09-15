import { castRay } from '../physics/raycast'
import {
  Projectile,
  Position,
  Velocity,
  InputControlled,
  PhysicsBody,
} from '../traits'

/**
 * Move todo `Projectile` (spawnado por `playerActionSystem` ao arremessar,
 * ver docs/features/014-arremessar-usar-e-invocar.md, revisado em
 * docs/features/016-mira-e-arremesso.md): integra posição em linha reta —
 * sem gravidade, de propósito (arremesso direto, não parábola: pedido
 * explícito depois de experimentar o arco balístico da primeira versão) —
 * e conta `lifetime` pra baixo, destruindo a entidade ao chegar a zero.
 *
 * Colisão com o mundo (chão/obstáculos) por raycast varrido — não
 * `Position` atual pro `Position` do PRÓXIMO tick (não um raycast pontual
 * na posição atual, que nunca "veria" o mundo entre um tick e outro; um
 * projétil rápido o bastante atravessaria uma parede fina sem isso). Ao
 * colidir, `Position` para exatamente no ponto de impacto e `Projectile.hit`
 * vira `true` — a partir daí a entidade só conta `lifetime` pra baixo, sem
 * mais se mover (ver `DebugPanel`, que lista os projéteis ativos e mostra
 * onde cada um bateu). Exclui a cápsula de quem arremessou (se a entidade
 * ainda existir) — sem isso, um projétil spawnado bem perto do próprio
 * corpo do jogador podia se autoacertar no primeiro tick.
 *
 * Headless. Fase: simulation — independente da ordem com os outros
 * systems de física (não lê nem escreve `Velocity`/`Position` de mais
 * ninguém).
 */
export function projectileSystem(context) {
  const { world, delta } = context

  const shooter = world.queryFirst(InputControlled, PhysicsBody)
  const excludeColliderHandle = shooter?.get(PhysicsBody).colliderHandle

  world
    .query(Projectile, Position, Velocity)
    .updateEach(([projectile, pos, vel], entity) => {
      if (!projectile.hit) {
        const segX = vel.x * delta
        const segY = vel.y * delta
        const segZ = vel.z * delta
        const segLength = Math.hypot(segX, segY, segZ)

        const hit =
          segLength > 0
            ? castRay(
                pos,
                {
                  x: segX / segLength,
                  y: segY / segLength,
                  z: segZ / segLength,
                },
                segLength,
                { excludeColliderHandle },
              )
            : null

        if (hit) {
          pos.x = hit.point.x
          pos.y = hit.point.y
          pos.z = hit.point.z
          vel.x = 0
          vel.y = 0
          vel.z = 0
          projectile.hit = true
        } else {
          pos.x += segX
          pos.y += segY
          pos.z += segZ
        }
      }

      projectile.lifetime -= delta
      if (projectile.lifetime <= 0) {
        entity.destroy()
      }
    })
}
