import { registerSystem, GAME_PHASES } from '@/core/systems'
import { inputSystem } from '@/core/systems/inputSystem'
import { physicsBootstrapSystem } from '@/core/systems/physicsBootstrapSystem'
import { controlSwitchSystem } from '@/core/systems/controlSwitchSystem'
import { chunkStreamingSystem } from '@/core/systems/chunkStreamingSystem'
import { worldClockSystem } from '@/core/systems/worldClockSystem'
import { weatherSystem } from '@/core/systems/weatherSystem'
import { lightningSystem } from '@/view/systems/lightningSystem'
import { weatherAudioSystem } from '@/view/systems/weatherAudioSystem'
import { chunkFreezeSystem } from '@/core/systems/chunkFreezeSystem'
import { chunkObjectCleanupSystem } from '@/core/systems/chunkObjectCleanupSystem'
import { cameraControlSystem } from '@/core/systems/cameraControlSystem'
import { vitalsRegenSystem } from '@/core/systems/vitalsRegenSystem'
import { movementSystem } from '@/core/systems/movementSystem'
import { playerActionSystem } from '@/core/systems/playerActionSystem'
import { dashCooldownSystem } from '@/core/systems/dashCooldownSystem'
import { scannerModeSystem } from '@/core/systems/scannerModeSystem'
import { creatureAttackSystem } from '@/core/systems/creatureAttackSystem'
import { combatModeSystem } from '@/core/systems/combatModeSystem'
import { faintSystem } from '@/core/systems/faintSystem'
import { attackEffectSystem } from '@/core/systems/attackEffectSystem'
import { statStageSystem } from '@/core/systems/statStageSystem'
import { partySummonSystem } from '@/core/systems/partySummonSystem'
import { summonBallSystem } from '@/core/systems/summonBallSystem'
import { creatureAppealSystem } from '@/core/systems/creatureAppealSystem'
import { creatureHitStunSystem } from '@/core/systems/creatureHitStunSystem'
import { leechSeedSystem } from '@/core/systems/leechSeedSystem'
import { burnSystem } from '@/core/systems/burnSystem'
import { storedConditionSystem } from '@/core/systems/storedConditionSystem'
import { captureBallSystem } from '@/core/systems/captureBallSystem'
import { captureAimSystem } from '@/core/systems/captureAimSystem'
import { creatureFollowSystem } from '@/core/systems/creatureFollowSystem'
import { wildCreatureSpawnSystem } from '@/core/systems/wildCreatureSpawnSystem'
import { trainingObjectSpawnSystem } from '@/core/systems/trainingObjectSpawnSystem'
import { trainingSystem } from '@/core/systems/trainingSystem'
import { partyActionMenuInputSystem } from '@/core/systems/partyActionMenuInputSystem'
import { wildWanderSystem } from '@/core/systems/wildWanderSystem'
import { wildBehaviorSystem } from '@/core/systems/wildBehaviorSystem'
import { wildReactionSystem } from '@/core/systems/wildReactionSystem'
import { partyBehaviorSystem } from '@/core/systems/partyBehaviorSystem'
import { partyReactionSystem } from '@/core/systems/partyReactionSystem'
import { trainerBattleSystem } from '@/core/systems/trainerBattleSystem'
import { projectileSystem } from '@/core/systems/projectileSystem'
import { consumeEffectSystem } from '@/core/systems/consumeEffectSystem'
import { eatingSystem } from '@/core/systems/eatingSystem'
import { eatingInterruptSystem } from '@/core/systems/eatingInterruptSystem'
import { droppedFoodSystem } from '@/core/systems/droppedFoodSystem'
import { autosaveSystem } from '@/core/systems/autosaveSystem'
import { summonEffectsSystem } from '@/core/systems/summonEffectsSystem'
import { characterPhysicsSystem } from '@/core/systems/characterPhysicsSystem'
import { physicsStepSystem } from '@/core/systems/physicsStepSystem'
import { syncPhysicsSystem } from '@/core/systems/syncPhysicsSystem'
import { animationStateSystem } from '@/core/systems/animationStateSystem'
import { syncTransformSystem } from '@/view/systems/syncTransformSystem'
import { cameraFollowSystem } from '@/view/systems/cameraFollowSystem'
import { animationSystem } from '@/view/systems/animationSystem'
import { hitStopSystem } from '@/view/systems/hitStopSystem'
import { heldItemViewSystem } from '@/view/systems/heldItemViewSystem'
import { eatingFoodViewSystem } from '@/view/systems/eatingFoodViewSystem'
import { droppedFoodViewSystem } from '@/view/systems/droppedFoodViewSystem'
import { captureBallViewSystem } from '@/view/systems/captureBallViewSystem'
import { captureAimViewSystem } from '@/view/systems/captureAimViewSystem'
import { summonBallViewSystem } from '@/view/systems/summonBallViewSystem'
import { handBallViewSystem } from '@/view/systems/handBallViewSystem'
import { pokeballFeedbackSystem } from '@/view/systems/pokeballFeedbackSystem'
import { tailFireSystem } from '@/view/systems/tailFireSystem'
import { audioListenerSystem } from '@/view/systems/audioListenerSystem'
import { footstepAudioSystem } from '@/view/systems/footstepAudioSystem'
import { voiceAudioSystem } from '@/view/systems/voiceAudioSystem'
import { ambientAudioSystem } from '@/view/systems/ambientAudioSystem'
import { dashAudioSystem } from '@/view/systems/dashAudioSystem'
import { jumpAudioSystem } from '@/view/systems/jumpAudioSystem'
import { eyeBlinkSystem } from '@/view/systems/eyeBlinkSystem'
import { mouthSyncSystem } from '@/view/systems/mouthSyncSystem'
import { summonAudioSystem } from '@/view/systems/summonAudioSystem'
import { recallAudioSystem } from '@/view/systems/recallAudioSystem'
import { attackAudioSystem } from '@/view/systems/attackAudioSystem'
import { hitFlashSystem } from '@/view/systems/hitFlashSystem'
import { damageNumberSystem } from '@/view/systems/damageNumberSystem'
import { battleLogSystem } from '@/view/systems/battleLogSystem'

let registered = false

/**
 * Registra os systems concretos nas fases do loop. É composição (conhece core
 * e view), por isso vive na camada view — não no core headless.
 *
 * A ordem dentro da fase `simulation` é parte do comportamento:
 *   bootstrap → troca de controle treinador/criatura (`controlSwitchSystem`,
 *   ver docs/features/018-troca-de-controle-treinador-criatura.md — precisa
 *   mover `InputControlled`/`CameraTarget` ANTES de qualquer system que leia
 *   essas tags neste mesmo tick) → controle de câmera → regeneração de
 *   HP/stamina → movimento (Velocity, que drena stamina se estiver
 *   correndo) → ações do jogador
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
 * `dashAudioSystem` (borda de subida de `ActionState.current === 'dash'`),
 * `jumpAudioSystem` (consome o pulso `Jumped`, ver core/traits/
 * components/physics.js), `summonAudioSystem`/`recallAudioSystem`
 * (docs/features/023-estado-de-humor-e-piscar-de-olhos.md, seção "Som de
 * invocar/recolher" — consomem `SummonPulse`/`RecallPulse`, mesmo
 * princípio de `Jumped`, ver core/traits/components/party.js) e
 * `attackAudioSystem` (docs/features/025-ataque-comum-de-criatura.md,
 * seção "mecanismo de som" — consome `AttackPulse`, mesmo princípio,
 * ver core/traits/components/attackEffect.js) ficam perto dele, sem
 * dependência real de ordem entre eles. `eyeBlinkSystem`
 * (docs/features/023-estado-de-humor-e-
 * piscar-de-olhos.md — alterna célula de atlas de olho aberto/fechado por
 * temporizador, mesma família de "efeito periódico por entidade" que
 * `voiceAudioSystem`) fica na mesma vizinhança, também sem dependência
 * real de ordem. `mouthSyncSystem` (docs/features/023-estado-de-humor-e-
 * piscar-de-olhos.md, seção "Boca sincronizada com o grito") é DIFERENTE
 * dos outros da vizinhança — precisa rodar
 * DEPOIS de `animationSystem` de verdade (senão o clipe de idle/walk/run
 * escreveria por cima do overlay de boca no mesmo frame), por isso fica
 * registrado por último, não só por proximidade.
 *
 * `scannerModeSystem` (docs/features/031-*.md — liga/desliga o modo
 * scanner com um item `scanner` equipado, botão direito do mouse) fica
 * logo depois de `playerActionSystem` por proximidade (mesma família de
 * "ações disparadas por input"), e ANTES de `cameraFollowSystem`
 * (presentation) — que precisa do `ScanMode` já atualizado neste mesmo
 * tick pra decidir câmera normal/primeira pessoa.
 *
 * `creatureAttackSystem` (docs/features/025-ataque-comum-de-criatura.md —
 * ataque comum de criatura controlada, botão esquerdo do mouse) fica logo
 * depois de `playerActionSystem` por proximidade (mesma família de "ações
 * disparadas por input", ambos escrevem `ActionState` respeitando a mesma
 * exclusão mútua), sem dependência real de ordem entre os dois (nunca é a
 * mesma entidade — um só processa o treinador via `HeldItem`, o outro só
 * uma `SummonedCreature`). `attackEffectSystem` (conta o `lifetime` do
 * `AttackEffect` que ele spawna) fica perto de `consumeEffectSystem`,
 * mesma família visual.
 *
 * `partySummonSystem`/`creatureFollowSystem`/`projectileSystem`/
 * `consumeEffectSystem`/`summonEffectsSystem` (este último conta o
 * `lifetime` de `SummonFlash`/`RecallBeam`, ver docs/features/024-esfera-
 * de-invocar.md — mesma família de `consumeEffectSystem`, puramente
 * visual, sem dependência de ordem com mais ninguém) são independentes
 * do resto (não leem nem escrevem
 * `Velocity`/`Grounded` do treinador) — a posição exata deles na fase
 * simulation não importa, ficam perto de `playerActionSystem` (quem spawna
 * o projétil/efeito) por proximidade de leitura, não por dependência real
 * de ordem. `wildCreatureSpawnSystem`/`wildWanderSystem` (docs/features/020-
 * fox-selvagens-cena-e-texturas.md) seguem o mesmo raciocínio — ficam perto
 * de `partySummonSystem`/`creatureFollowSystem` (mesma família: criaturas
 * não-jogador que precisam existir/se mover antes de `characterPhysicsSystem`
 * integrar a `Velocity` delas), sem depender de ordem exata com eles
 * (`WildCreature` e `SummonedCreature` nunca são a mesma entidade).
 * `summonBallSystem` (docs/features/024-esfera-de-invocar.md) É uma
 * dependência real, ao contrário dos vizinhos acima: registrado logo
 * DEPOIS de `partySummonSystem` (que pode spawnar uma `SummonBall` nova
 * neste mesmo tick, no `effectAt` da ação `summon`) e ANTES de
 * `creatureFollowSystem`/`characterPhysicsSystem` (que precisam da
 * `SummonedCreature` já existir, se a esfera pousar neste mesmo tick em
 * que nasceu).
 */
export function registerGameSystems() {
  if (registered) return
  registered = true

  registerSystem(GAME_PHASES.INPUT, inputSystem)
  // Toque × segurar em Q/E/R no modo treinador (segurar abre o menu de
  // ações) e bloqueio de input com o menu aberto — docs/features/038-*.
  registerSystem(GAME_PHASES.INPUT, partyActionMenuInputSystem)

  registerSystem(GAME_PHASES.SIMULATION, physicsBootstrapSystem)
  registerSystem(GAME_PHASES.SIMULATION, controlSwitchSystem)
  // Chunks em volta do treinador e da criatura controlada (já com a troca
  // de controle deste tick); quem ficou em chunk descarregado congela e os
  // objetos soltos de lá somem — antes de qualquer IA ou física
  // (docs/features/046-sistema-de-chunks.md).
  registerSystem(GAME_PHASES.SIMULATION, chunkStreamingSystem)
  registerSystem(GAME_PHASES.SIMULATION, chunkFreezeSystem)
  registerSystem(GAME_PHASES.SIMULATION, chunkObjectCleanupSystem)
  // Relógio e clima do mundo (docs/features/048-dia-noite-e-clima.md): o
  // clima usa a hora e o lugar de quem está no controle (já trocado neste
  // tick); ninguém da simulação depende deles ainda.
  registerSystem(GAME_PHASES.SIMULATION, worldClockSystem)
  registerSystem(GAME_PHASES.SIMULATION, weatherSystem)
  registerSystem(GAME_PHASES.SIMULATION, cameraControlSystem)
  // Mira da Pokébola (043): com a órbita deste tick, antes do movimento
  // (que vira o corpo pra mira) e do arremesso (que usa a mira).
  registerSystem(GAME_PHASES.SIMULATION, captureAimSystem)
  registerSystem(GAME_PHASES.SIMULATION, vitalsRegenSystem)
  registerSystem(GAME_PHASES.SIMULATION, movementSystem)
  registerSystem(GAME_PHASES.SIMULATION, dashCooldownSystem)
  registerSystem(GAME_PHASES.SIMULATION, playerActionSystem)
  registerSystem(GAME_PHASES.SIMULATION, scannerModeSystem)
  // Objetos de treino do nível (uma vez) e o treino automático de golpe —
  // antes do ataque, que lança o golpe de treino pedido aqui no mesmo tick.
  registerSystem(GAME_PHASES.SIMULATION, trainingObjectSpawnSystem)
  registerSystem(GAME_PHASES.SIMULATION, trainingSystem)
  registerSystem(GAME_PHASES.SIMULATION, creatureAttackSystem)
  // Logo depois do ataque: avança o atordoamento de quem teve um golpe de
  // status interrompido (a ação `'hit'`, iniciada pelo ataque).
  registerSystem(GAME_PHASES.SIMULATION, creatureHitStunSystem)
  // Antes do desmaio: quem a drenagem do Leech Seed zerar desmaia no mesmo tick.
  registerSystem(GAME_PHASES.SIMULATION, leechSeedSystem)
  // Idem pra queimadura.
  registerSystem(GAME_PHASES.SIMULATION, burnSystem)
  // A queimadura de quem está na bola (recolhido/capturado) continua —
  // docs/features/043-captura.md.
  registerSystem(GAME_PHASES.SIMULATION, storedConditionSystem)
  // Quem come uma fruta cura aos poucos (docs/features/042-itens-da-beta.md)
  // — depois do dano do tick, antes do desmaio.
  registerSystem(GAME_PHASES.SIMULATION, eatingSystem)
  // Logo depois do ataque: quem zerou o HP desmaia no mesmo tick do golpe
  // (e antes do partySummonSystem, que recolhe a do time desmaiada).
  registerSystem(GAME_PHASES.SIMULATION, faintSystem)
  // Depois do ataque: um golpe neste tick renova o combate antes de contar.
  registerSystem(GAME_PHASES.SIMULATION, combatModeSystem)
  registerSystem(GAME_PHASES.SIMULATION, projectileSystem)
  // A Pokébola de captura (docs/features/043-captura.md) — depois do
  // desmaio (quem desmaiou na bola já está desmaiado ao resolver).
  registerSystem(GAME_PHASES.SIMULATION, captureBallSystem)
  registerSystem(GAME_PHASES.SIMULATION, consumeEffectSystem)
  registerSystem(GAME_PHASES.SIMULATION, droppedFoodSystem)
  registerSystem(GAME_PHASES.SIMULATION, attackEffectSystem)
  registerSystem(GAME_PHASES.SIMULATION, statStageSystem)
  registerSystem(GAME_PHASES.SIMULATION, summonEffectsSystem)
  registerSystem(GAME_PHASES.SIMULATION, partySummonSystem)
  registerSystem(GAME_PHASES.SIMULATION, summonBallSystem)
  // Logo depois do spawn: a recém-invocada começa a apresentação no mesmo
  // tick (e antes do follow/IA, que respeitam a ação em andamento).
  registerSystem(GAME_PHASES.SIMULATION, creatureAppealSystem)
  // Antes do follow: quem está lutando pra defender o grupo não segue.
  registerSystem(GAME_PHASES.SIMULATION, partyBehaviorSystem)
  // Treinador fora do controle numa luta: longe dela, desviando, fugindo pro
  // time (antes do follow, que o pula fora de 'follow').
  registerSystem(GAME_PHASES.SIMULATION, trainerBattleSystem)
  registerSystem(GAME_PHASES.SIMULATION, creatureFollowSystem)
  registerSystem(GAME_PHASES.SIMULATION, wildCreatureSpawnSystem)
  // Antes do vagar: decide perseguir/fugir/voltar a vagar e move quem
  // persegue/foge; quem voltou a vagar já vaga no mesmo tick.
  registerSystem(GAME_PHASES.SIMULATION, wildBehaviorSystem)
  registerSystem(GAME_PHASES.SIMULATION, wildWanderSystem)
  registerSystem(GAME_PHASES.SIMULATION, characterPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, physicsStepSystem)
  registerSystem(GAME_PHASES.SIMULATION, syncPhysicsSystem)
  registerSystem(GAME_PHASES.SIMULATION, animationStateSystem)

  // Reação de gameplay a eventos do passo (`context.events.stepEvents()`):
  // selvagem que apanhou soma ameaça e revida/foge/persegue; o time entra
  // na luta contra a selvagem que acertou alguém do grupo.
  registerSystem(GAME_PHASES.EVENTS, wildReactionSystem)
  registerSystem(GAME_PHASES.EVENTS, partyReactionSystem)
  // Tomar dano comendo derruba a fruta.
  registerSystem(GAME_PHASES.EVENTS, eatingInterruptSystem)
  // Pede o save automático (por tempo e depois de uma captura) — por último:
  // o passo já terminou de mudar o estado (docs/features/044-*.md).
  registerSystem(GAME_PHASES.EVENTS, autosaveSystem)

  registerSystem(GAME_PHASES.PRESENTATION, syncTransformSystem)
  registerSystem(GAME_PHASES.PRESENTATION, cameraFollowSystem)
  // Antes da animação: o acerto deste frame já congela o clipe agora.
  registerSystem(GAME_PHASES.PRESENTATION, hitStopSystem)
  registerSystem(GAME_PHASES.PRESENTATION, animationSystem)
  registerSystem(GAME_PHASES.PRESENTATION, heldItemViewSystem)
  // A fruta de quem come, na mão/no chão — depois da animação (ossos na
  // pose deste frame).
  registerSystem(GAME_PHASES.PRESENTATION, eatingFoodViewSystem)
  // A fruta caída rolando e respingando ao quicar.
  registerSystem(GAME_PHASES.PRESENTATION, droppedFoodViewSystem)
  // A Pokébola de captura girando, balançando e quebrando (043) — depois
  // do sync (o grupo de fora já está no lugar).
  registerSystem(GAME_PHASES.PRESENTATION, captureBallViewSystem)
  // O arco e o círculo da mira da Pokébola (043, modo 'arc').
  registerSystem(GAME_PHASES.PRESENTATION, captureAimViewSystem)
  // A Pokébola do invocar em voo e abrindo, e a da mão no invocar/recolher
  // (043) — a da mão depois da animação (osso na pose deste frame).
  registerSystem(GAME_PHASES.PRESENTATION, summonBallViewSystem)
  registerSystem(GAME_PHASES.PRESENTATION, handBallViewSystem)
  registerSystem(GAME_PHASES.PRESENTATION, tailFireSystem)
  registerSystem(GAME_PHASES.PRESENTATION, audioListenerSystem)
  registerSystem(GAME_PHASES.PRESENTATION, footstepAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, voiceAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, ambientAudioSystem)
  // Clima (048): clarão e trovão dos relâmpagos do frame, e o volume dos
  // sons de chuva e vento pela força do clima.
  registerSystem(GAME_PHASES.PRESENTATION, lightningSystem)
  registerSystem(GAME_PHASES.PRESENTATION, weatherAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, dashAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, jumpAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, summonAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, recallAudioSystem)
  registerSystem(GAME_PHASES.PRESENTATION, attackAudioSystem)
  // Sons e partículas da Pokébola (043): captura, invocar e recolher.
  registerSystem(GAME_PHASES.PRESENTATION, pokeballFeedbackSystem)
  // Brilho em quem tomou dano — consome `attackResolved` de
  // `context.frameEvents` (ver `GameLoop.jsx`).
  registerSystem(GAME_PHASES.PRESENTATION, hitFlashSystem)
  // Número de dano acima de quem apanhou — mesmo evento.
  registerSystem(GAME_PHASES.PRESENTATION, damageNumberSystem)
  // Log de batalha em texto ("Charmander usou Ember!") — mesmos eventos.
  registerSystem(GAME_PHASES.PRESENTATION, battleLogSystem)
  registerSystem(GAME_PHASES.PRESENTATION, eyeBlinkSystem)
  registerSystem(GAME_PHASES.PRESENTATION, mouthSyncSystem)
}
