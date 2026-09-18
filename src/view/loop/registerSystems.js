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
import { wildCreatureSpawnSystem } from '@/core/systems/wildCreatureSpawnSystem'
import { wildWanderSystem } from '@/core/systems/wildWanderSystem'
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
import { tailFireSystem } from '@/view/systems/tailFireSystem'
import { audioListenerSystem } from '@/view/systems/audioListenerSystem'
import { footstepAudioSystem } from '@/view/systems/footstepAudioSystem'
import { voiceAudioSystem } from '@/view/systems/voiceAudioSystem'
import { ambientAudioSystem } from '@/view/systems/ambientAudioSystem'
import { dashAudioSystem } from '@/view/systems/dashAudioSystem'
import { jumpAudioSystem } from '@/view/systems/jumpAudioSystem'

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
 * que este system calcula por frame) e o fogo de cauda (`tailFireSystem`,
 * docs/features/022-fogo-de-cauda-do-charmander.md — mesma observação de
 * ordem do item na mão; só avança a simulação de partícula e corrige
 * escala, a posição vem de graça do osso), depois o listener de áudio
 * (`audioListenerSystem`, ver docs/features/019-som-ambiente-e-passos.md
 * — precisa da posição FINAL da câmera neste frame, já depois de
 * `cameraFollowSystem` mover ela) e por último o som de passo
 * (`footstepAudioSystem` — depende do relógio de animação que
 * `animationSystem` já avançou E do listener já reposicionado neste
 * mesmo frame). `voiceAudioSystem` (vocalização periódica, por
 * temporizador — não pelo ciclo de andar/correr), `ambientAudioSystem`
 * (mesma ideia, mas GLOBAL — som ambiente do nível, não de uma entidade),
 * `dashAudioSystem` (borda de subida de `ActionState.current === 'dash'`)
 * e `jumpAudioSystem` (consome o pulso `Jumped`, ver core/traits/
 * components/physics.js) ficam perto dele, sem dependência real de ordem
 * entre eles.
 *
 * `partySummonSystem`/`creatureFollowSystem`/`projectileSystem`/
 * `consumeEffectSystem` são independentes do resto (não leem nem escrevem
 * `Velocity`/`Grounded` do treinador) — a posição exata deles na fase
 * simulation não importa, ficam perto de `playerActionSystem` (quem spawna
 * o projétil/efeito) por proximidade de leitura, não por dependência real
 * de ordem. `wildCreatureSpawnSystem`/`wildWanderSystem` (docs/features/020-
 * fox-selvagens-cena-e-texturas.md) seguem o mesmo raciocínio — ficam perto
 * de `partySummonSystem`/`creatureFollowSystem` (mesma família: criaturas
 * não-jogador que precisam existir/se mover antes de `characterPhysicsSystem`
 * integrar a `Velocity` delas), sem depender de ordem exata com eles
 * (`WildCreature` e `SummonedCreature` nunca são a mesma entidade).
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
  registerSystem(GAME_PHASES.SIMULATION, wildCreatureSpawnSystem)
  registerSystem(GAME_PHASES.SIMULATION, wildWanderSystem)
  registerSystem(GAME_PHASES.SIMULATION, characterPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, physicsStepSystem)
  registerSystem(GAME_PHASES.SIMULATION, syncPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, animationStateSystem)

  registerSystem(GAME_PHASES.PRESENTATION, syncTransformSystem)
  registerSystem(GAME_PHASES.PRESENTATION, cameraFollowSystem)
  registerSystem(GAME_PHASES.PRESENTATION, animationSystem)
  registerSystem(GAME_PHASES.PRESENTATION, heldItemViewSystem)
  registerSystem(GAME_PHASES.PRESENTATION, tailFireSystem)
  registerSystem(GAME_PHASES.PRESENTATION, audioListenerSystem)
  registerSystem(GAME_PHASES.PRESENTATION, footstepAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, voiceAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, ambientAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, dashAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, jumpAudioSystem)
}
