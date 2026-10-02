import { GAME_CONFIG } from '../gameConfig'
import { isHitStunned } from '../actions/hitStun'
import {
  Velocity,
  Rotation,
  PhysicsBody,
  CharacterController,
  MovementStats,
  Vitals,
  Grounded,
  MovementBlocked,
  Jumped,
  Jumping,
  InputControlled,
  Fainted,
} from '../traits'
import {
  isPhysicsReady,
  getRapierWorld,
  getCharacterController,
  getCharacterAvoidanceController,
  charactersOnlyFilterFlags,
  terrainOnlyFilterFlags,
} from '../physics/physicsWorld'
import { quaternionFromAxisAngle } from '../math'
import { resolveFreeTurn } from '../physics/colliders'

// Deslocamento horizontal pedido (m, no tick) abaixo do qual o personagem
// conta como parado — `Velocity` zerada por quem controla, com folga pra
// resto numérico.
const STILL_REQUEST_EPSILON = 1e-6

/**
 * Aplica gravidade e pulo à Velocity vertical, resolve o movimento do
 * personagem contra o mundo com o KinematicCharacterController do Rapier e
 * agenda a nova translação/rotação do corpo. Atualiza as tags Grounded e
 * MovementBlocked, e adiciona o pulso `Jumped` no tick em que um pulo de
 * verdade dispara (consumido por `view/systems/jumpAudioSystem.js`, ver
 * docstring do trait em `core/traits/components/physics.js` pro motivo
 * de só ADICIONAR aqui, nunca remover).
 *
 * Genérico — qualquer entidade com `CharacterController`/`PhysicsBody`
 * passa por aqui, não só o jogador (`SummonedCreature` também, ver
 * `partySummonSystem.js` e docs/features/017-locomocao-e-recolhimento-de-
 * criaturas.md — precisa de gravidade/colisão real igual ao treinador).
 * Pular é a única parte exclusiva do jogador: gatiada por
 * `entity.has(InputControlled)`, porque `context.input` é um snapshot
 * GLOBAL (o único dispositivo de input é o do jogador) — sem esse filtro,
 * toda criatura pularia junto sempre que o jogador apertasse pular.
 *
 * O corpo físico também gira junto com `Rotation.y` (girar só translação
 * bastava enquanto a cápsula era sempre em pé — radialmente simétrica em Y,
 * então a rotação do corpo não importava pra colisão; uma cápsula deitada
 * (`CharacterController.capsuleAxis` 'x'/'z') deixa de ser simétrica, e sem
 * isso ficaria travada num eixo do mundo em vez de acompanhar a frente da
 * criatura ao virar).
 *
 * Esse giro NÃO passa pelo character controller (que só confere colisão no
 * deslocamento): colada noutra criatura, a cápsula deitada varreria a ponta
 * pra dentro dela ao virar (o golpe vira o corpo de uma vez pra mira, a
 * caminhada vira aos poucos), e o controller não sabe sair de uma
 * sobreposição — a criatura ficava presa, só soltando com pulo/dash. Por
 * isso só vale o pedaço do giro que não sobrepõe outro personagem
 * (`resolveFreeTurn`, `core/physics/colliders.js`), e este system corrige
 * `Rotation.y` pro giro que de fato aplicou — o único caso em que ele
 * escreve `Rotation` (quem pede o giro: `movementSystem`,
 * `creatureAttackSystem`, IA).
 *
 * `GROUNDED_STICK`/gravidade vêm do config global (epsilon técnico do
 * algoritmo de snap-to-ground, igual pra toda entidade); a força do pulo
 * (`jumpSpeed`) vem de MovementStats — dado por entidade. Pular custa
 * stamina (`Vitals.jumpStaminaCost`, por espécie — ver
 * docs/features/018-troca-de-controle-treinador-criatura.md — descontada
 * uma vez no disparo) — sem stamina suficiente, não pula, mesma forma que
 * `wasGrounded` já bloqueia.
 * `Vitals` continua na query mesmo só tendo uso dentro do bloco de pulo
 * (gatiado por `InputControlled`) — `entity.get()` fora da query ativa
 * devolve um retrato (`snapshot`), não a referência com escrita de volta
 * que `updateEach` dá pros traits SoA que estão de fato na query; mutar um
 * `entity.get()` avulso não persistiria (achado testando: a stamina não
 * descontava).
 *
 * `MovementBlocked` compara o deslocamento REAL (`computedMovement()`, já
 * resolvido contra o mundo) com o PEDIDO (`Velocity * delta`) no plano
 * XZ — se o real ficar bem abaixo do pedido
 * (`GAME_CONFIG.PHYSICS.CHARACTER.BLOCKED_MOVEMENT_RATIO`), tem algo
 * sólido na frente que quem gerou a `Velocity` não previu (ver
 * `creatureFollowSystem.js`, que usa isso pra desviar lateralmente — a
 * própria física reporta o bloqueio, mais direto e confiável do que tentar
 * prever de antemão toda geometria capaz de enganar a grade de
 * pathfinding, ver docs/features/017-locomocao-e-recolhimento-de-
 * criaturas.md). Só
 * entra na conta quando o pedido já passa de `MIN_BLOCKED_CHECK_DISTANCE`
 * (evita razão instável perto de zero quando a entidade já está quase
 * parada).
 *
 * Quem ANDA colide contra qualquer collider no caminho, jogador/criatura
 * incluídos (pedido explícito do usuário: personagens não podem se
 * atravessar). Não esbarrar feio nem empurrar em grupo é responsabilidade
 * de EVASÃO PROATIVA (`creatureFollowSystem.js` desvia de outros
 * personagens próximos antes de precisar colidir de verdade), não de
 * fingir que a colisão não existe.
 *
 * Quem está PARADO no chão (sem deslocamento horizontal pedido,
 * `STILL_REQUEST_EPSILON`) resolve o próprio movimento só contra o
 * terreno (`terrainOnlyFilterFlags`) — sem isso, o controlador dele o
 * tirava "de dentro" de quem encostasse, e correr contra uma criatura
 * parada ficava empurrando ela (pedido do usuário: não pode empurrar).
 * Quem anda contra ele continua barrado — a colisão é do lado de quem se
 * move. Desmaiada (`Fainted`) é sempre assim (e intangível pros outros,
 * collider desligado): só pisa no chão.
 *
 * Headless (Rapier-compat roda em Node). Fase: simulation, depois do
 * movementSystem/creatureFollowSystem e antes do physicsStepSystem.
 */
export function characterPhysicsSystem(context) {
  if (!isPhysicsReady()) return

  const { world, delta } = context
  const input = context.input ?? {}
  const cfg = GAME_CONFIG.PHYSICS
  const rapierWorld = getRapierWorld()
  const controller = getCharacterController()
  const avoidanceController = getCharacterAvoidanceController()

  world
    .query(
      CharacterController,
      MovementStats,
      Vitals,
      PhysicsBody,
      Velocity,
      Rotation,
    )
    .updateEach(([character, stats, vitals, body, vel, rot], entity) => {
      if (body.bodyHandle < 0) return

      const rigidBody = rapierWorld.getRigidBody(body.bodyHandle)
      const collider = rapierWorld.getCollider(body.colliderHandle)
      if (!rigidBody || !collider) return

      const wasGrounded = entity.has(Grounded)

      if (wasGrounded && vel.y <= 0) {
        vel.y = cfg.CHARACTER.GROUNDED_STICK
      } else {
        vel.y += cfg.GRAVITY * delta
      }

      if (
        input.jump &&
        wasGrounded &&
        entity.has(InputControlled) &&
        // atordoada (golpe interrompido) não faz nada, nem pular
        !isHitStunned(entity) &&
        vitals.stamina >= vitals.jumpStaminaCost
      ) {
        vel.y = stats.jumpSpeed
        vitals.stamina -= vitals.jumpStaminaCost
        vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
        // Pulso pro som de pulo (view/systems/jumpAudioSystem.js) — só
        // ADICIONA, nunca remove aqui (ver docstring de `Jumped`,
        // core/traits/components/physics.js).
        entity.add(Jumped)
        entity.add(Jumping)
      }

      const requestedX = vel.x * delta
      const requestedZ = vel.z * delta

      const requestedDistance = Math.hypot(requestedX, requestedZ)

      // Parado no chão, ou desmaiada: só o terreno — não é empurrado por
      // quem encosta/passa por cima (ver docstring).
      const standingStill =
        wasGrounded && requestedDistance < STILL_REQUEST_EPSILON
      const terrainOnly = entity.has(Fainted) || standingStill
      // Duas passadas (ver `getCharacterAvoidanceController`): primeiro o
      // movimento pedido contra os OUTROS personagens (sem o chão na
      // consulta), depois o que sobrou contra o terreno — que dá a palavra
      // final (autostep, snap, `grounded`). Juntos numa consulta só, o
      // controller do Rapier prende quem está colado noutro personagem.
      let desired = { x: requestedX, y: vel.y * delta, z: requestedZ }
      if (!terrainOnly) {
        avoidanceController.computeColliderMovement(
          collider,
          desired,
          charactersOnlyFilterFlags(),
        )
        desired = avoidanceController.computedMovement()
      }
      controller.computeColliderMovement(
        collider,
        desired,
        terrainOnlyFilterFlags(),
      )
      const movement = controller.computedMovement()
      const translation = rigidBody.translation()
      const nextTranslation = {
        x: translation.x + movement.x,
        y: translation.y + movement.y,
        z: translation.z + movement.z,
      }
      rigidBody.setNextKinematicTranslation(nextTranslation)
      // O giro não passa pelo controller: só vale o pedaço que não enfia a
      // cápsula (deitada) em outro personagem — ver `resolveFreeTurn`. Se não
      // coube inteiro, `rot.y` volta pro que foi aplicado (corpo e modelo
      // iguais; quem pediu o giro tenta de novo no próximo tick).
      rot.y = resolveFreeTurn(
        body.colliderHandle,
        nextTranslation,
        currentYaw(rigidBody),
        rot.y,
        character.capsuleAxis,
      )
      rigidBody.setNextKinematicRotation(quaternionFromAxisAngle('y', rot.y))

      const isGrounded = controller.computedGrounded()
      if (isGrounded && !wasGrounded) entity.add(Grounded)
      if (!isGrounded && wasGrounded) entity.remove(Grounded)
      if (isGrounded && vel.y < 0) vel.y = 0
      // Aterrissou (ou nunca saiu do chão): fim do pulo — ver `Jumping`.
      if (isGrounded && vel.y <= 0 && entity.has(Jumping)) {
        entity.remove(Jumping)
      }

      const isBlocked =
        requestedDistance > cfg.CHARACTER.MIN_BLOCKED_CHECK_DISTANCE &&
        Math.hypot(movement.x, movement.z) / requestedDistance <
          cfg.CHARACTER.BLOCKED_MOVEMENT_RATIO
      if (isBlocked && !entity.has(MovementBlocked)) {
        entity.add(MovementBlocked)
      } else if (!isBlocked && entity.has(MovementBlocked)) {
        entity.remove(MovementBlocked)
      }
    })
}

/** Yaw (rad) que o corpo tem agora — a rotação dele é só em torno de Y. */
function currentYaw(rigidBody) {
  const q = rigidBody.rotation()
  return 2 * Math.atan2(q.y, q.w)
}
