import { trait } from 'koota'

/**
 * Handles do corpo e do collider Rapier associados à entidade.
 * `-1` = ainda não criado.
 *
 * Dono de escrita: `physicsBootstrapSystem` (entidades que já existem no
 * instante em que o WASM termina de carregar — hoje só o jogador) OU
 * quem spawna a entidade DEPOIS disso, na hora (`partySummonSystem.js`,
 * pra uma `SummonedCreature` — o bootstrap só roda uma vez, não alcança
 * entidades futuras; ver docs/features/017-locomocao-e-recolhimento-de-
 * criaturas.md). Handles reais vêm de `createCharacterBody`
 * (`core/physics/colliders.js`) nos dois casos — só muda QUANDO é
 * chamado. Desfeito por `destroyCharacterBody` quando a entidade some
 * (hoje só no recolhimento de uma criatura).
 * Leem: characterPhysicsSystem, syncPhysicsSystem.
 */
export const PhysicsBody = trait({
  bodyHandle: -1,
  colliderHandle: -1,
})

/**
 * Entidade movida pelo KinematicCharacterController do Rapier. Além de
 * marcar a entidade (uso em queries como tag), carrega a forma do collider
 * cápsula — vem de `core/data/species/<id>/index.js` (`body`), copiado no
 * spawn; cada entidade pode ter um corpo de tamanho diferente.
 *
 * `capsuleAxis` é o eixo LOCAL (relativo ao corpo, não ao mundo) ao longo do
 * qual a cápsula é comprida: `'y'` (padrão) é em pé, como um humanoide;
 * `'x'`/`'z'` deita a cápsula de lado, pra corpos alongados na horizontal
 * (quadrúpedes). Como o corpo físico agora gira junto com `Rotation.y` (ver
 * characterPhysicsSystem), uma cápsula deitada continua alinhada com a
 * frente da criatura conforme ela vira, em vez de ficar presa a um eixo do
 * mundo.
 *
 * Dono de escrita: spawn (`world.js`/`test/makeWorld.js` pro jogador,
 * `partySummonSystem.js` pra uma `SummonedCreature`).
 * Lê: `physicsBootstrapSystem`/`partySummonSystem.js`, ao criar o
 * collider (`createCharacterBody`, ver `PhysicsBody` acima).
 */
export const CharacterController = trait({
  capsuleRadius: 0.5,
  capsuleHalfHeight: 0.01,
  capsuleAxis: 'y',
})

/**
 * Tag: presente quando o character controller reporta contato com o chão.
 * Adicionada/removida por frame pelo characterPhysicsSystem.
 */
export const Grounded = trait()

/**
 * Tag: presente quando o deslocamento de fato aplicado neste tick
 * (`controller.computedMovement()`, já resolvido contra o mundo) ficou
 * bem abaixo do que a `Velocity` pediu no plano XZ — sinal direto de que
 * tem algo sólido na frente que a intenção de movimento não previu.
 * Adicionada/removida por frame pelo `characterPhysicsSystem` (mesmo
 * padrão de `Grounded` — tag calculada ali, não escrita por quem gera a
 * `Velocity`).
 *
 * Não é acionada por deslizar normalmente contra uma parede em ângulo (o
 * KCC já faz isso, e é bom — mantém progresso na direção que dá) — só um
 * estancamento quase total (ver `GAME_CONFIG.PHYSICS.CHARACTER.
 * BLOCKED_MOVEMENT_RATIO`) conta. Consumida por `creatureFollowSystem`
 * pra desviar lateralmente por um tick em vez de continuar empurrando reto
 * contra o que travou — ver docs/features/017-locomocao-e-recolhimento-
 * de-criaturas.md
 * ("Evasão local"). O jogador também ganha a tag (o system é genérico),
 * mas nada consome pra ele ainda.
 */
export const MovementBlocked = trait()

/**
 * Tag: PULSO de um tick — presente exatamente no tick em que a entidade
 * dispara um pulo de verdade (`characterPhysicsSystem`, mesma condição
 * que aplica `vel.y = stats.jumpSpeed`: `input.jump && wasGrounded &&
 * entity.has(InputControlled) && stamina suficiente`). Usado por
 * `view/systems/jumpAudioSystem.js` (docs/features/019-som-ambiente-e-
 * passos.md) pra tocar o som de pulo no instante certo, sem precisar
 * inferir "acabou de pular" a partir de `Grounded`/`Velocity` na view
 * (impreciso — a queda de `Grounded` some 1-2 ticks DEPOIS do disparo de
 * verdade, e uma cápsula quase parada no topo de uma queda também tem
 * `vel.y` perto de zero, ambíguo com "acabou de aterrissar").
 *
 * Diferente de `Grounded`/`MovementBlocked` (estado CONTÍNUO, recalculado
 * do zero todo tick): `characterPhysicsSystem` só ADICIONA esta tag,
 * nunca remove — quem CONSOME (`jumpAudioSystem.js`) é quem tira depois
 * de tocar o som, exatamente uma vez por pulo. Isso importa porque a fase
 * `simulation` pode rodar mais de um tick fixo por frame renderizado
 * (acúmulo de atraso, ver `GameLoop.jsx`) — se `characterPhysicsSystem`
 * limpasse a tag nos ticks sem pulo novo, um pulo disparado no primeiro
 * tick fixo do frame podia ser apagado antes da fase `presentation` (que
 * roda só uma vez por frame) ter a chance de ver e tocar o som.
 */
export const Jumped = trait()
