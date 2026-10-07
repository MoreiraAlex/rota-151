import { resolveAimDirection } from '../aim'

function horizontalOf(direction) {
  const length = Math.hypot(direction.x, direction.z)
  return { x: direction.x / length, y: 0, z: direction.z / length }
}

/**
 * Direção do golpe (travada no `effectAt` por `creatureAttackSystem.js` e
 * reusada pelo indicador de alcance, `AttackIndicatorView.jsx`, pros dois
 * nunca divergirem). **Sempre horizontal** (`y: 0`) — combate 2.5D, sem
 * mira vertical: a altura quem resolve é a trajetória, acompanhando o
 * terreno (`resolveAttackImpactPoint`). É o giro horizontal da câmera, sem
 * assistência nenhuma — quem mira é o jogador (e pode redirecionar enquanto o
 * aviso carrega, ver `creatureAttackSystem.js`). A assistência de mira corpo a
 * corpo saiu junto com o ataque básico (docs/features/039-tipos-e-combate-classico.md, Parte 5).
 */
export function resolveAttackDirection(
  world,
  pos,
  excludeColliderHandle,
  species,
) {
  return horizontalOf(
    resolveAimDirection(
      world,
      pos,
      excludeColliderHandle,
      species?.camera?.targetHeight,
      species?.camera?.shoulderOffset,
    ),
  )
}
