import {
  avancarDash,
  iniciarDash,
  isDashReady,
  travarRecargaDoDash,
} from '../actions/dash'
import { resolveMoveSpeed } from '../actions/movementSpeed'
import { resolveDashCost } from '../actions/stamina'
import { gastarItem } from '../actions/inventory'
import { comecarAComer, podeComer } from '../actions/eating'
import { getItem } from '../data/items'
import { getPlayerSpecies } from '../data/species'
import { resolveAimPoint, resolveHandOrigin } from '../aim'
import { isAimingCapture } from '../actions/capture'
import {
  ActionState,
  Position,
  Rotation,
  Velocity,
  Vitals,
  HeldItem,
  Grounded,
  InputControlled,
  InputState,
  MovementStats,
  Projectile,
  ConsumeEffect,
  PhysicsBody,
  CaptureAim,
  CaptureBall,
  OwnedBy,
  Party,
  applyHeal,
} from '../traits'

/**
 * Velocidade de lançamento do arremesso: reto na direção de `aimPoint`,
 * módulo fixo em `THROW.SPEED` — sem arco/parábola (o projétil não sofre
 * gravidade em voo, ver `projectileSystem.js`).
 *
 * `aimPoint` já vem resolvido por quem chama (`resolveAimPoint`, sempre —
 * sem mira travada/botão direito, ver docs/features/029-*.md) — respeita
 * `aimRange`: sem nada no caminho dentro desse alcance, mira no ponto
 * mais distante mesmo, em vez de "infinito". `resolveHandOrigin` (origem
 * da trajetória) mora em `core/aim.js` — reaproveitado por
 * `partySummonSystem.js` (a `SummonBall`, ver docs/features/024-esfera-
 * de-invocar.md, nasce da mesma aproximação de mão, não do centro do
 * corpo).
 */
function resolveThrowLaunch(aimPoint, throwOrigin, throwConfig) {
  const { speed } = throwConfig

  const dx = aimPoint.x - throwOrigin.x
  const dy = aimPoint.y - throwOrigin.y
  const dz = aimPoint.z - throwOrigin.z
  const distance = Math.hypot(dx, dy, dz)

  if (distance === 0) {
    return { x: 0, y: 0, z: speed }
  }

  return {
    x: (dx / distance) * speed,
    y: (dy / distance) * speed,
    z: (dz / distance) * speed,
  }
}

/**
 * Se o clique primário arremessa o `item`: `throwable` (reto) ou Pokébola
 * (em arco, captura — docs/features/043-captura.md). Pokébola só o
 * treinador arremessa (`Party`), nunca a criatura pilotada.
 */
function isThrownItem(item, entity) {
  if (item?.category === 'throwable') return true
  // Pokébola: só mirando (`captureAimSystem`) — o arremesso usa a mira.
  return (
    item?.category === 'pokeball' &&
    entity.has(Party) &&
    isAimingCapture(entity)
  )
}

/**
 * Gasta uma unidade do item em mãos (`gastarItem`); sem nenhuma sobrando, a
 * mão desequipa. `Inventory` fica FORA da query deste system de propósito:
 * `gastarItem` escreve com `entity.set()`, e um `set` no meio do
 * `updateEach` pra um trait que está na mesma query some (o `updateEach`
 * grava o valor de antes por cima no fim da iteração).
 */
function spendHeldItem(entity, heldItem) {
  const left = gastarItem(entity, heldItem.itemId)
  if (!(left > 0)) heldItem.itemId = null
}

// Movido pra `core/actions/dash.js` (a IA também dá dash); reexportado aqui
// pros leitores de sempre.
export { resolveDashSpeed } from '../actions/dash'

/**
 * Velocidade que o `movementSystem` vai dar logo depois do dash, pelo
 * input de agora: parado → 0; andando → `walkSpeed`; segurando correr →
 * `runSpeed` (proporcional à intensidade do input, mesma conta de lá). Não
 * checa stamina da corrida — se faltar, o `movementSystem` cai pra andar
 * no tick seguinte.
 */
function resolveDashExitSpeed(entity) {
  const input = entity.get(InputState)
  const stats = entity.get(MovementStats)
  if (!input || !stats) return 0

  const intent = Math.min(1, Math.hypot(input.x, input.z))
  if (intent === 0) return 0
  return intent * resolveMoveSpeed(stats, entity.get(Vitals), input.run)
}

/**
 * Inicia, avança e encerra ações disparadas por input (dash, arremesso,
 * uso de item) — o mecanismo genérico descrito em
 * docs/features/007-sistema-de-acoes-do-jogador.md, estendido em
 * docs/features/014-arremessar-usar-e-invocar.md.
 *
 * Ao contrário da locomoção (idle/walk/run, resolvida a cada frame a partir
 * de velocidade/grounded), uma ação tem começo e fim: só inicia com um
 * gatilho de borda ("apertou agora", não "está segurando").
 *
 * Dash e arremesso custam stamina, descontada uma vez no disparo — sem
 * stamina suficiente, a ação simplesmente não dispara (mesma forma que a
 * precondição de `Grounded` já bloqueia o dash). Uso de consumível não
 * custa stamina. Quem decide se `primary` dispara algo é a categoria do
 * item em `HeldItem` (`throwable` → arremesso reto; `pokeball` → arremesso
 * em arco da bola de captura, só o treinador; `consumable` → uso, só com
 * a vida abaixo do máximo; `berry` → começa a comer, ver
 * `core/actions/eating.js`; sem item ou outra → nada). `primary` (clique esquerdo) dispara sozinho —
 * não precisa mais segurar o botão direito antes (mira removida, ver
 * docs/features/029-*.md).
 *
 * Cada ação com efeito no meio da duração (arremesso spawna o projétil, uso
 * aplica a cura) detecta o instante comparando o `elapsed` antes/depois do
 * `delta` deste tick cruzar `EFFECT_AT` — dispara exatamente uma vez, sem
 * precisar de um campo "já disparei" extra no trait.
 *
 * `ActionState` também é usado por `partySummonSystem.js` (invocar/
 * recolher criatura, ver docs/features/017-locomocao-e-recolhimento-de-
 * criaturas.md) — as duas fontes só iniciam uma ação nova quando
 * `current` já está `null`, então nunca se sobrepõem. Este system
 * explicitamente ignora (retorna sem tocar `elapsed`) qualquer
 * `action.current` que não seja `'dash'`/`'throw'`/`'consume'` — sem
 * isso, o incremento de `elapsed` (incondicional, mais abaixo) dobraria a
 * velocidade de uma ação de invocar/recolher já em andamento, que
 * `partySummonSystem.js` avança por conta própria.
 *
 * Headless. Fase: simulation, depois do movementSystem (cuja Rotation.y já
 * reflete a direção do input deste frame — é essa direção que o dash trava)
 * e antes do characterPhysicsSystem (que resolve a Velocity contra o
 * mundo). O arremesso mira pela câmera, não por `Rotation.y` (ver
 * `resolveThrowLaunch`, acima) — mas escreve em `Rotation.y` no disparo,
 * virando o corpo pra encarar a direção arremessada (ver
 * docs/features/016-mira-e-arremesso.md).
 */
export function playerActionSystem(context) {
  const { world, delta } = context
  const input = context.input ?? {}
  // Lido a cada tick (não guardado num const no topo do módulo) pra
  // manipular via menu de configurações (ver
  // docs/features/015-menu-de-pausa-e-configuracoes.md) valer na hora.
  // O dash (`core/actions/dash.js`, `PLAYER_ACTIONS.dash`) é global —
  // funciona igual pra qualquer entidade controlada; o custo é da entidade
  // × vida (`resolveDashCost`) e a recarga é a mesma pra todos
  // (`isDashReady`/`travarRecargaDoDash`, 035). `THROW`/`CONSUME` são
  // exclusivos do treinador (`getPlayerSpecies().actions`, ver
  // docs/features/018-troca-de-controle-treinador-criatura.md) — só ele
  // arremessa/consome de verdade (item real só existe nele).
  const { throw: THROW, consume: CONSUME } = getPlayerSpecies().actions

  world
    .query(
      InputControlled,
      ActionState,
      Vitals,
      HeldItem,
      Position,
      Velocity,
      Rotation,
      PhysicsBody,
    )
    .updateEach(([action, vitals, heldItem, pos, vel, rot, body], entity) => {
      if (action.current === null) {
        const canDash =
          input.dash &&
          entity.has(Grounded) &&
          isDashReady(entity) &&
          vitals.stamina >= resolveDashCost(vitals)

        if (canDash) {
          iniciarDash(action, vitals, Math.sin(rot.y), Math.cos(rot.y))
          travarRecargaDoDash(entity)
        } else if (input.primary) {
          const item = heldItem.itemId ? getItem(heldItem.itemId) : null

          if (
            isThrownItem(item, entity) &&
            vitals.stamina >= THROW.staminaCost
          ) {
            action.current = 'throw'
            action.elapsed = 0
            // Ver docstring de `ActionState.animationSpeed` — o
            // clipe de arremesso toca nesta velocidade em vez de um
            // `speed` fixo no JSON do clipe.
            action.animationSpeed = THROW.duration > 0 ? 1 / THROW.duration : 1
            const throwOrigin = resolveHandOrigin(pos, rot.y, THROW)
            const aimPoint = resolveAimPoint(world, pos, body.colliderHandle)
            // Pokébola: o arco da mira (043, a mesma velocidade que a mira
            // mostrou); o resto, reto.
            const velocity =
              item.category === 'pokeball'
                ? { ...entity.get(CaptureAim).velocity }
                : resolveThrowLaunch(aimPoint, throwOrigin, THROW)
            action.dirX = velocity.x
            action.dirY = velocity.y
            action.dirZ = velocity.z
            // Encara a direção do arremesso (só o componente horizontal —
            // o corpo não inclina pra cima/baixo, só gira em Y) — antes o
            // corpo continuava olhando pra onde já estava andando, mesmo
            // arremessando pra outro lado.
            rot.y = Math.atan2(velocity.x, velocity.z)
            vitals.stamina -= THROW.staminaCost
            vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
          } else if (
            item?.category === 'consumable' &&
            vitals.hp < vitals.maxHp
          ) {
            // Com a vida cheia não usa (não gasta a poção à toa).
            action.current = 'consume'
            action.elapsed = 0
            // Ver docstring de `ActionState.animationSpeed` — o
            // clipe de consumo toca nesta velocidade em vez de um
            // `speed` fixo no JSON do clipe.
            action.animationSpeed =
              CONSUME.duration > 0 ? 1 / CONSUME.duration : 1
          } else if (item?.category === 'berry' && podeComer(entity, action)) {
            // Fruta: começa a comer (a ação `'eat'`, avançada pelo
            // `eatingSystem`) e já gasta — interrompido, ela cai no chão.
            comecarAComer(entity, item, action)
            spendHeldItem(entity, heldItem)
            return
          } else {
            // Nada na mão (ou item sem uso direto): nada acontece.
            return
          }
        } else {
          return
        }
      }

      // `action.current` pode ser uma ação que este system não conhece —
      // 'summon'/'recall' (ver `partySummonSystem.js`), que progride e
      // encerra a própria ação sozinho. Sem esse corte, o incremento de
      // `elapsed` abaixo (incondicional) rodaria em cima de uma ação que
      // já está sendo avançada por outro system, dobrando a velocidade
      // com que ela progride.
      if (
        action.current !== 'dash' &&
        action.current !== 'throw' &&
        action.current !== 'consume'
      ) {
        return
      }

      if (action.current === 'dash') {
        // No tick do fim, já deixa a velocidade de saída — o
        // `movementSystem` (que roda ANTES) zerou a velocidade por ainda
        // ver o dash ativo; sem isso sobrava um tick parado no fim.
        avancarDash(action, vel, delta, resolveDashExitSpeed(entity))
        return
      }

      const previousElapsed = action.elapsed
      action.elapsed += delta

      if (action.current === 'throw') {
        if (
          previousElapsed < THROW.effectAt &&
          action.elapsed >= THROW.effectAt
        ) {
          const item = heldItem.itemId ? getItem(heldItem.itemId) : null
          const origin = resolveHandOrigin(pos, rot.y, THROW)
          // dirX/dirY/dirZ já são a velocidade de lançamento resolvida
          // no disparo (ver resolveThrowLaunch/resolveArcLaunch) — não uma
          // direção unitária pra multiplicar por `speed` aqui.
          const launch = { x: action.dirX, y: action.dirY, z: action.dirZ }
          if (item?.category === 'pokeball') {
            // A bola de captura (`captureBallSystem.js`), de quem arremessou.
            world.spawn(
              Position(origin),
              Rotation, // exigido por syncTransformSystem
              Velocity(launch),
              CaptureBall({ itemId: item.id }),
              OwnedBy(entity),
            )
          } else {
            world.spawn(
              Position(origin),
              Rotation, // exigido por syncTransformSystem — sem uso real (esfera)
              Velocity(launch),
              Projectile({ lifetime: THROW.lifetime }),
            )
          }
          spendHeldItem(entity, heldItem)
        }

        if (action.elapsed >= THROW.duration) {
          action.current = null
        }
        return
      }

      if (action.current === 'consume') {
        if (
          previousElapsed < CONSUME.effectAt &&
          action.elapsed >= CONSUME.effectAt
        ) {
          const item = heldItem.itemId ? getItem(heldItem.itemId) : null
          if (item?.consumable) {
            vitals.hp = applyHeal(vitals, item.consumable.healAmount).hp
          }
          world.spawn(
            Position({ x: pos.x, y: pos.y + 1, z: pos.z }),
            Rotation, // exigido por syncTransformSystem — sem uso real (partículas)
            ConsumeEffect({ lifetime: CONSUME.effectVisualDuration }),
          )
          spendHeldItem(entity, heldItem)
        }

        if (action.elapsed >= CONSUME.duration) {
          action.current = null
        }
      }
    })
}
