import { registerSystem, GAME_PHASES } from '@/core/systems'
import { inputSystem } from '@/core/systems/inputSystem'
import { physicsBootstrapSystem } from '@/core/systems/physicsBootstrapSystem'
import { controlSwitchSystem } from '@/core/systems/controlSwitchSystem'
import { cameraControlSystem } from '@/core/systems/cameraControlSystem'
import { aimAnchorSystem } from '@/core/systems/aimAnchorSystem'
import { vitalsRegenSystem } from '@/core/systems/vitalsRegenSystem'
import { movementSystem } from '@/core/systems/movementSystem'
import { playerActionSystem } from '@/core/systems/playerActionSystem'
import { partySummonSystem } from '@/core/systems/partySummonSystem'
import { creatureFollowSystem } from '@/core/systems/creatureFollowSystem'
import { projectileSystem } from '@/core/systems/projectileSystem'
import { consumeEffectSystem } from '@/core/systems/consumeEffectSystem'
import { characterPhysicsSystem } from '@/core/systems/characterPhysicsSystem'
import { physicsStepSystem } from '@/core/systems/physicsStepSystem'
import { syncPhysicsSystem } from '@/core/systems/syncPhysicsSystem'
import { animationStateSystem } from '@/core/systems/animationStateSystem'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { cameraFollowSystem } from '@/view/systems/cameraFollowSystem'
import { animationSystem } from '@/view/systems/animationSystem'
import { heldItemViewSystem } from '@/view/systems/heldItemViewSystem'

let registered = false

/**
 * Registra os systems concretos nas fases do loop. É composição (conhece core
 * e view), por isso vive na camada view — não no core headless.
 *
 * A ordem dentro da fase `simulation` é parte do comportamento:
 *   bootstrap → troca de controle treinador/criatura (`controlSwitchSystem`,
 *   ver docs/features/018-troca-de-controle-treinador-criatura.md — precisa
 *   mover `InputControlled`/`CameraTarget` ANTES de qualquer system que leia
 *   essas tags neste mesmo tick) → controle de câmera → captura/libera o
 *   ponto de mira
 *   travado (`aimAnchorSystem`, precisa do yaw/pitch já atualizados pelo
 *   controle de câmera deste tick) → regeneração de HP/stamina → movimento
 *   (lê o `AimAnchor` já resolvido neste mesmo tick pra decidir orbitar ou
 *   não; Velocity, que drena stamina se estiver correndo) → ações do jogador
 *   (dash, que sobrescreve a Velocity enquanto ativo e também drena
 *   stamina) → character controller (KCC, que drena stamina no pulo) →
 *   step do Rapier → sync de volta para Position → resolve o estado de
 *   animação (já com Velocity/Grounded atualizados). Regenerar antes de
 *   drenar significa que o dreno deste tick desconta por cima do que já
 *   regenerou neste mesmo tick — não faz diferença perceptível no jogo
 *   real, só mantém a ordem simples de raciocinar.
 * Em `presentation`: sincroniza transforms, depois câmera, depois animação,
 * depois o item na mão (`heldItemViewSystem`, precisa dos ossos já
 * registrados — mas não de ordem exata com as duas anteriores, o encaixe
 * no osso é o próprio Three.js resolvendo as matrizes no render, não algo
 * que este system calcula por frame).
 *
 * `partySummonSystem`/`creatureFollowSystem`/`projectileSystem`/
 * `consumeEffectSystem` são independentes do resto (não leem nem escrevem
 * `Velocity`/`Grounded` do treinador) — a posição exata deles na fase
 * simulation não importa, ficam perto de `playerActionSystem` (quem spawna
 * o projétil/efeito) por proximidade de leitura, não por dependência real
 * de ordem.
 */
export function registerGameSystems() {
  if (registered) return
  registered = true

  registerSystem(GAME_PHASES.INPUT, inputSystem)

  registerSystem(GAME_PHASES.SIMULATION, physicsBootstrapSystem)
  registerSystem(GAME_PHASES.SIMULATION, controlSwitchSystem)
  registerSystem(GAME_PHASES.SIMULATION, cameraControlSystem)
  registerSystem(GAME_PHASES.SIMULATION, aimAnchorSystem)
  registerSystem(GAME_PHASES.SIMULATION, vitalsRegenSystem)
  registerSystem(GAME_PHASES.SIMULATION, movementSystem)
  registerSystem(GAME_PHASES.SIMULATION, playerActionSystem)
  registerSystem(GAME_PHASES.SIMULATION, projectileSystem)
  registerSystem(GAME_PHASES.SIMULATION, consumeEffectSystem)
  registerSystem(GAME_PHASES.SIMULATION, partySummonSystem)
  registerSystem(GAME_PHASES.SIMULATION, creatureFollowSystem)
  registerSystem(GAME_PHASES.SIMULATION, characterPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, physicsStepSystem)
  registerSystem(GAME_PHASES.SIMULATION, syncPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, animationStateSystem)

  registerSystem(GAME_PHASES.PRESENTATION, syncTransformSystem)
  registerSystem(GAME_PHASES.PRESENTATION, cameraFollowSystem)
  registerSystem(GAME_PHASES.PRESENTATION, animationSystem)
  registerSystem(GAME_PHASES.PRESENTATION, heldItemViewSystem)
}
