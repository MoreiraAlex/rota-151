import { GAME_CONFIG } from '../gameConfig'
import {
  CameraTarget,
  InputControlled,
  OrbitCamera,
  Party,
  Position,
  Velocity,
} from '../traits'

/**
 * Os jogadores ativos para o spawn das selvagens (docs/features/062-spawn-
 * estilo-cobblemon.md): cada treinador (quem tem `Party`), com os pontos
 * de onde o jogador está (`viewers`: o treinador e a criatura controlada)
 * e de onde a câmera olha (`view`: a posição de quem ela segue e o `yaw` da
 * órbita, ou `null` sem câmera) e para onde ele anda (`heading`: a direção
 * da velocidade de quem está no controle, tamanho 1, ou `null` parado).
 *
 * Offline há um jogador só: a criatura controlada e a câmera são dele. No
 * multiplayer (079) cada um traz as suas.
 *
 * @returns {{ trainer: import('koota').Entity, viewers: {x:number,z:number}[], view: {x:number,z:number,yaw:number} | null, heading: {x:number,z:number} | null }[]}
 */
export function listSpawnPlayers(world) {
  const controlled = world.query(Position, InputControlled)
  const positions = controlled.map((entity) => entity.get(Position))
  const view = resolveView(world)
  const heading = resolveHeading(controlled[0])

  return world.query(Position, Party).map((trainer) => ({
    trainer,
    viewers: [trainer.get(Position), ...positions],
    view,
    heading,
  }))
}

// Direção do movimento de quem está no controle; parado (abaixo de
// `MOVING_SPEED`), `null`.
function resolveHeading(entity) {
  const velocity = entity?.get(Velocity)
  if (!velocity) return null
  const speed = Math.hypot(velocity.x, velocity.z)
  if (speed < GAME_CONFIG.WILD_SPAWN.MOVING_SPEED) return null
  return { x: velocity.x / speed, z: velocity.z / speed }
}

function resolveView(world) {
  const rig = world.queryFirst(OrbitCamera)
  const target = world.queryFirst(CameraTarget, Position)
  if (!rig || !target) return null
  const { x, z } = target.get(Position)
  return { x, z, yaw: rig.get(OrbitCamera).yaw }
}
