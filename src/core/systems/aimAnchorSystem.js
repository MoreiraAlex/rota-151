import { resolveAimPoint } from '../aim'
import { AimAnchor, Position, PhysicsBody, InputControlled } from '../traits'

/**
 * Captura/libera o ponto de mira travado (`AimAnchor`, ver docstring do
 * trait) — na borda de subida de `input.aiming` (botão direito acabou de
 * ser apertado), resolve o ponto de mira atual (`resolveAimPoint`, mesma
 * conta que o arremesso usa) e trava; na borda de descida (soltou o
 * botão), libera. Enquanto segurado, não recalcula — o ponto fica fixo
 * até soltar (ver docstring de `AimAnchor` pro motivo). Chegou a se
 * tentar recalcular durante a mira (rodadas 14–15, acompanhando o mouse
 * livre) — revertido a pedido do usuário de volta pro travamento único,
 * enquanto a proposta de câmera livre é reformulada.
 *
 * Headless. Fase: simulation, antes do cameraFollowSystem (que precisa do
 * `AimAnchor` já atualizado neste mesmo tick pra saber pra onde olhar) e
 * do playerActionSystem (o arremesso mira nesse mesmo ponto travado, ver
 * docs/features/016-mira-e-arremesso.md).
 */
export function aimAnchorSystem(context) {
  const { world } = context
  const aiming = !!context.input?.aiming

  world
    .query(InputControlled, AimAnchor, Position, PhysicsBody)
    .updateEach(([anchor, pos, body]) => {
      if (aiming && !anchor.active) {
        const point = resolveAimPoint(world, pos, body.colliderHandle)
        anchor.active = true
        anchor.x = point.x
        anchor.y = point.y
        anchor.z = point.z
      } else if (!aiming && anchor.active) {
        anchor.active = false
      }
    })
}
