import { registerSystem, GAME_PHASES } from '@/core/systems'
import { inputSystem } from '@/core/systems/inputSystem'
import { physicsBootstrapSystem } from '@/core/systems/physicsBootstrapSystem'
import { cameraControlSystem } from '@/core/systems/cameraControlSystem'
import { vitalsRegenSystem } from '@/core/systems/vitalsRegenSystem'
import { movementSystem } from '@/core/systems/movementSystem'
import { playerActionSystem } from '@/core/systems/playerActionSystem'
import { partySummonSystem } from '@/core/systems/partySummonSystem'
import { creatureFollowSystem } from '@/core/systems/creatureFollowSystem'
import { projectileSystem } from '@/core/systems/projectileSystem'
import { characterPhysicsSystem } from '@/core/systems/characterPhysicsSystem'
import { physicsStepSystem } from '@/core/systems/physicsStepSystem'
import { syncPhysicsSystem } from '@/core/systems/syncPhysicsSystem'
import { animationStateSystem } from '@/core/systems/animationStateSystem'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { cameraFollowSystem } from '@/view/systems/cameraFollowSystem'
import { animationSystem } from '@/view/systems/animationSystem'

let registered = false

/**
 * Registra os systems concretos nas fases do loop. É composição (conhece core
 * e view), por isso vive na camada view — não no core headless.
 *
 * A ordem dentro da fase `simulation` é parte do comportamento:
 *   bootstrap → controle de câmera → regeneração de HP/stamina → movimento
 *   (Velocity, que drena stamina se estiver correndo) → ações do jogador
 *   (dash, que sobrescreve a Velocity enquanto ativo e também drena
 *   stamina) → character controller (KCC, que drena stamina no pulo) →
 *   step do Rapier → sync de volta para Position → resolve o estado de
 *   animação (já com Velocity/Grounded atualizados). Regenerar antes de
 *   drenar significa que o dreno deste tick desconta por cima do que já
 *   regenerou neste mesmo tick — não faz diferença perceptível no jogo
 *   real, só mantém a ordem simples de raciocinar.
 * Em `presentation`: sincroniza transforms, depois câmera, depois animação
 * (a ordem entre as duas últimas não importa — nenhuma lê a outra).
 *
 * `partySummonSystem`/`creatureFollowSystem`/`projectileSystem` (v0.0.14)
 * são independentes do resto (não leem nem escrevem `Velocity`/`Grounded`
 * do treinador) — a posição exata deles na fase simulation não importa,
 * ficam perto de `playerActionSystem` (quem spawna o projétil) por
 * proximidade de leitura, não por dependência real de ordem.
 */
export function registerGameSystems() {
  if (registered) return
  registered = true

  registerSystem(GAME_PHASES.INPUT, inputSystem)

  registerSystem(GAME_PHASES.SIMULATION, physicsBootstrapSystem)
  registerSystem(GAME_PHASES.SIMULATION, cameraControlSystem)
  registerSystem(GAME_PHASES.SIMULATION, vitalsRegenSystem)
  registerSystem(GAME_PHASES.SIMULATION, movementSystem)
  registerSystem(GAME_PHASES.SIMULATION, playerActionSystem)
  registerSystem(GAME_PHASES.SIMULATION, projectileSystem)
  registerSystem(GAME_PHASES.SIMULATION, partySummonSystem)
  registerSystem(GAME_PHASES.SIMULATION, creatureFollowSystem)
  registerSystem(GAME_PHASES.SIMULATION, characterPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, physicsStepSystem)
  registerSystem(GAME_PHASES.SIMULATION, syncPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, animationStateSystem)

  registerSystem(GAME_PHASES.PRESENTATION, syncTransformSystem)
  registerSystem(GAME_PHASES.PRESENTATION, cameraFollowSystem)
  registerSystem(GAME_PHASES.PRESENTATION, animationSystem)
}
