import { GAME_CONFIG } from '../gameConfig'
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
  InputControlled,
} from '../traits'
import {
  isPhysicsReady,
  getRapierWorld,
  getCharacterController,
} from '../physics/physicsWorld'
import { quaternionFromAxisAngle } from '../math'

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
 * `computeColliderMovement` NÃO filtra outros personagens — colide contra
 * qualquer collider no caminho, jogador/criatura incluídos (pedido
 * explícito do usuário: personagens não podem se atravessar). Não esbarrar
 * feio nem empurrar em grupo é responsabilidade de EVASÃO PROATIVA
 * (`creatureFollowSystem.js` desvia de outros personagens próximos antes
 * de precisar colidir de verdade), não de fingir que a colisão não existe.
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

  world
    .query(
      CharacterController,
      MovementStats,
      Vitals,
      PhysicsBody,
      Velocity,
      Rotation,
    )
    .updateEach(([, stats, vitals, body, vel, rot], entity) => {
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
        vitals.stamina >= vitals.jumpStaminaCost
      ) {
        vel.y = stats.jumpSpeed
        vitals.stamina -= vitals.jumpStaminaCost
        vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
        // Pulso pro som de pulo (view/systems/jumpAudioSystem.js) — só
        // ADICIONA, nunca remove aqui (ver docstring de `Jumped`,
        // core/traits/components/physics.js).
        entity.add(Jumped)
      }

      const requestedX = vel.x * delta
      const requestedZ = vel.z * delta

      controller.computeColliderMovement(collider, {
        x: requestedX,
        y: vel.y * delta,
        z: requestedZ,
      })
      const movement = controller.computedMovement()
      const translation = rigidBody.translation()
      rigidBody.setNextKinematicTranslation({
        x: translation.x + movement.x,
        y: translation.y + movement.y,
        z: translation.z + movement.z,
      })
      rigidBody.setNextKinematicRotation(quaternionFromAxisAngle('y', rot.y))

      const isGrounded = controller.computedGrounded()
      if (isGrounded && !wasGrounded) entity.add(Grounded)
      if (!isGrounded && wasGrounded) entity.remove(Grounded)
      if (isGrounded && vel.y < 0) vel.y = 0

      const requestedDistance = Math.hypot(requestedX, requestedZ)
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
