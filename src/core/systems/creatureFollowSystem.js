import { GAME_CONFIG } from '../gameConfig'
import { InputControlled, Position, SummonedCreature } from '../traits'

/**
 * Toda `SummonedCreature` anda em direção à posição do treinador — decidido
 * em docs/features/013-criaturas-de-time.md ("segue o jogador"), construído
 * aqui. Acha o treinador via `InputControlled` (não um singleton importado),
 * mesma técnica que qualquer system headless já usa pra achar "o jogador" —
 * funciona igual em teste (`makeWorld`) e no jogo real.
 *
 * Sem colisão, sem rotação/animação — só a posição anda, parando a
 * `FOLLOW_MIN_DISTANCE` do treinador pra não empilhar em cima dele.
 *
 * Headless. Fase: simulation.
 */
export function creatureFollowSystem(context) {
  const { world, delta } = context
  // Lido a cada tick pra manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  const { FOLLOW_SPEED, FOLLOW_MIN_DISTANCE } = GAME_CONFIG.PARTY

  const player = world.queryFirst(InputControlled, Position)
  if (!player) return
  const playerPos = player.get(Position)

  world.query(SummonedCreature, Position).updateEach(([, pos]) => {
    const dx = playerPos.x - pos.x
    const dz = playerPos.z - pos.z
    const distance = Math.hypot(dx, dz)

    if (distance <= FOLLOW_MIN_DISTANCE) return

    const step = Math.min(FOLLOW_SPEED * delta, distance - FOLLOW_MIN_DISTANCE)
    pos.x += (dx / distance) * step
    pos.z += (dz / distance) * step
  })
}
