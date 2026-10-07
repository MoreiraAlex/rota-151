import { resolveAttackDirection } from '../battle/attackAim'
import { getSpecies } from '../data/species'
import {
  countChannelTicks,
  isBeamAttack,
  isChannelAttack,
  isSelfAttack,
} from '../battle/channelAttack'
import { GAME_CONFIG } from '../gameConfig'
import { isActiveCombatant } from '../battle/combatTargets'
import {
  ATTACK_SLOTS,
  finishAttack,
  handleAttackPress,
  isSlotHeld,
  requiresHold,
  resolveAttackForEntity,
  resolveDirectionTo,
  tryStartAttack,
} from '../battle/attackCasting'
import { resolveAiTarget, steerAiBeam } from '../battle/aiMovement'
import { resolveAttackImpact } from '../battle/attackImpact'
import { TRAINING_SLOT, resolveEntityMoveSet } from '../battle/creatureAttack'
import { registrarUsoDeGolpe } from '../battle/moveMasteryUse'
import { applyChannelTick } from '../battle/attackChannelTick'
import { interruptStatusAttacks } from '../battle/attackStatusEffects'
import {
  ActionState,
  AttackAim,
  AttackCooldowns,
  CharacterController,
  IndividualValues,
  InputControlled,
  PhysicsBody,
  Position,
  Rotation,
  SummonedCreature,
  Vitals,
  WantsToAttack,
  WildCreature,
  resolveCreatureSpeciesId,
  resolveEntityLevel,
} from '../traits'

/**
 * Ataques de criatura — do time E selvagens — num system só, em cinco
 * passadas por tick: (1) cooldowns de todo atacante; (2) disparo pelo
 * input da criatura controlada; (3) disparo da IA — selvagem ou criatura
 * do time fora do controle com `WantsToAttack` (posto pelo
 * `wildBehaviorSystem.js`/`partyBehaviorSystem.js`) lança o golpe do slot
 * pedido (`planAiAttack`) mirando no alvo do pedido (`tryStartAttack` com direção pronta — mesmo
 * caminho, stamina/cooldown/modo combate iguais); (4)
 * avanço do golpe de todo atacante; (5) interrupção do golpe de status em
 * carga de quem levou dano no tick. O golpe de criatura do time acerta
 * selvagens; o de selvagem acerta o lado do jogador (criaturas do time e
 * treinador) — `resolveAttackTarget`, `targetSide`.
 *
 * Disparo pelo input: dispara e avança o golpe de uma criatura controlada —
 * Q/E/R (`secondary1-3`). Não existe ataque básico (docs/features/039-tipos-e-combate-classico.md, Parte 5): o clique esquerdo só CONFIRMA o golpe aberto no
 * indicador (`castMode: 'confirm'`, abaixo). A direção do golpe vem de
 * `resolveAttackDirection` (`core/battle/attackAim.js`): sempre horizontal,
 * o giro horizontal da câmera, sem assistência de mira. Trava o corpo
 * (`rot.y`, só o componente horizontal — o corpo não inclina) e a trajetória
 * do golpe (`action.dirX/dirY/dirZ`). A direção é resolvida no disparo e, na
 * criatura CONTROLADA, de novo a cada tick até o `effectAt` ("direcionar
 * durante o aviso", `GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING`): o jogador
 * pode redirecionar o golpe enquanto o aviso vermelho carrega, e a direção
 * trava no instante do golpe, que é quando o efeito/dano de fato acontecem.
 *
 * **Um único slot dispara por vez** (`ATTACK_SLOTS`, `core/battle/attackCasting.js`): a cada tick
 * livre (`action.current === null`), percorre Q→E→R na ordem, e o PRIMEIRO
 * com tecla pressionada + golpe resolvido + stamina/cooldown livres ganha.
 * `action.pendingSlot` grava QUAL slot ganhou, porque `action.current` vira
 * só `'attack'` pras três teclas — sem o slot, o `effectAt`/`duration` no
 * meio do gesto não saberia qual golpe reler.
 *
 * **Respeita o trajeto, não só o destino** (`resolveAttackImpactPoint`,
 * `core/battle/attackTrajectory.js`): com um `range` grande (simulando o alcance de um golpe tipo
 * chicote), o ponto de impacto não "teleporta" através de parede/
 * obstáculo nem desnível — a trajetória acompanha o terreno e para no
 * primeiro bloqueio (ver docstring de `resolveAttackImpactPoint`). Vale pra QUALQUER
 * golpe — mecanismo genérico, sem branch nenhum por id/
 * grupo de efeito.
 *
 * **O golpe vem da criatura**: `resolveEntityAttack` (`core/battle/
 * creatureAttack.js`) resolve o golpe do slot no `moveSet` dela (com os
 * `overrides` da espécie). Slot vazio ou id desconhecido simplesmente não é
 * candidato a disparar.
 *
 * **`duration`/`effectAt` são dinâmicos, por ENTIDADE**
 * (`resolveAttackForEntity`, `core/battle/attackCasting.js`): a base é a da
 * skill, escalada pelo `speed` DESTA criatura (IV sorteado por indivíduo) —
 * duas criaturas da mesma espécie atacam em ritmos diferentes.
 *
 * Mesmo mecanismo genérico de `ActionState` que dash/arremesso/uso/summon/
 * recall já usam: trava `current` no disparo, o efeito de verdade só
 * acontece no instante `effectAt`, e `current` volta a `null` em
 * `duration`. Não é dono de `'dash'`/`'throw'`/`'consume'`/`'summon'`/
 * `'recall'` — outros systems progridem essas; este só entende `'attack'`,
 * mesmo padrão de exclusão mútua já usado por `playerActionSystem.js`/
 * `partySummonSystem.js`. Isso também significa que os três slots
 * compartilham a MESMA `ActionState` — usar um golpe trava os outros até
 * `duration` acabar, mesma exclusão mútua que dash/ataque já tinham.
 *
 * `SummonedCreature` na query (não `resolveSpeciesKind`) — mesmo critério
 * já usado alhures pra "isto é uma criatura, não o treinador": só uma
 * `SummonedCreature` de verdade chega a ter
 * `InputControlled`+`ActionState`+`Position`+`Rotation` juntos por essa
 * via (o treinador nunca tem `SummonedCreature`). Golpe é exclusivo de
 * espécie `kind: 'pokemon'` (o treinador não tem — sem arma direta no
 * design, ver docs/backlog.md).
 *
 * **Indicador antes de lançar** (`attack.castMode`, por ataque): com
 * `'confirm'`, apertar o botão só abre o indicador (`AttackAim.slot`,
 * desenhado por `view/scene/AttackIndicatorView.jsx`); clique ou a mesma
 * tecla de novo lança, botão direito cancela, outra tecla de ataque troca
 * de indicador. Com `'instant'` (ou sem o campo), lança na hora. O modo
 * debug (F2) força `'confirm'` em todos via `context.settings.
 * castModeOverride` (`GameLoop.jsx`).
 *
 * **Dano** (docs/features/030-sistema-de-dano-de-ataques.md): no mesmo
 * instante `effectAt` em que o VFX nasce, `resolveAttackTarget` (`core/battle/attackTargets.js`)
 * acha a primeira `WildCreature` viva ao longo da trajetória do golpe,
 * no mesmo plano de combate e com alcance/raio medidos na horizontal
 * (combate 2.5D) e, se achar,
 * `resolveDamageAmount` (`core/battle/calculateDamage.js`) calcula o
 * dano a partir de `ATTACK.damage` (`power`/`category`/`type` —
 * `core/data/skills/<id>/index.js`) e dos status de ambos
 * (`resolveCreatureStats`), aplicado via `applyDamage` (contrato único
 * de qualquer fonte de dano, `core/traits/components/vitals.js`). Sem
 * `ATTACK.damage` configurado (`null`), nenhum dano é calculado — mesmo
 * fallback gracioso de sempre. **Só `WildCreature` é alvo válido** hoje
 * (decisão consciente, não esquecimento — ver docstring de
 * `resolveAttackTarget`): sem IA de ataque selvagem, PvP ou conceito de
 * time/dono no ECS, não existe "fogo amigo" a evitar ainda.
 *
 * **Custa stamina** (`attack.staminaCost`): descontada uma vez no
 * disparo, não por segundo. Sem stamina suficiente, aquele slot
 * simplesmente não é candidato a disparar naquele tick (a próxima tecla
 * da lista ainda é tentada). Reseta `vitals.staminaRegenDelay` pro valor
 * da PRÓPRIA criatura (`staminaRegenDelayAfterUse`), mesmo princípio de
 * correr/pular/dash.
 *
 * **Cooldown** (`attack.cooldown`, segundos ALÉM da stamina —
 * `AttackCooldowns.<slot>`, `core/traits/components/attackEffect.js`):
 * decrementado TODO tick, POR SLOT, não só enquanto aquele slot está em
 * andamento — corre em paralelo a qualquer outra coisa que a criatura
 * esteja fazendo. Travado em `attack.cooldown` no FIM da ação daquele
 * slot (não no disparo — a contagem só começa depois da `duration`);
 * enquanto `> 0`, só aquele slot específico não dispara, mesmo com
 * stamina de sobra — os outros continuam livres.
 *
 * **Som do impacto**: `entity.add(AttackPulse)` no mesmo instante
 * `effectAt` em que o VFX nasce — pulso de um tick (`core/traits/
 * components/attackEffect.js`) consumido por `attackAudioSystem.js`
 * (view, fase presentation), mesmo mecanismo de `Jumped`/`SummonPulse`/
 * `RecallPulse`. Toca `attack.audio` (`core/data/audio/attackSound.js`)
 * — este system não sabe nada de áudio de verdade, só marca O INSTANTE.
 *
 * Headless. Fase: simulation, junto de `playerActionSystem`/
 * `partySummonSystem` (mesma família de "ações disparadas por input").
 */
// Todo slot com recarga própria: os dos botões e o do golpe em treino.
const COOLDOWN_SLOTS = [...ATTACK_SLOTS.map(({ slot }) => slot), TRAINING_SLOT]

export function creatureAttackSystem(context) {
  const { world, delta, events } = context
  const input = context.input ?? {}
  const castModeOverride = context.settings?.castModeOverride ?? null

  // 1. Cooldowns de TODO atacante (criatura do time ou selvagem) — correm
  // independente de qual ação está em andamento, antes de qualquer disparo.
  world.query(AttackCooldowns).updateEach(([cooldowns]) => {
    for (const slot of COOLDOWN_SLOTS) {
      if (cooldowns[slot] > 0) {
        cooldowns[slot] = Math.max(0, cooldowns[slot] - delta)
      }
    }
  })

  // 2. Disparo pelo input: a criatura que o jogador controla.
  world
    .query(
      InputControlled,
      SummonedCreature,
      ActionState,
      AttackCooldowns,
      AttackAim,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
      IndividualValues,
    )
    .updateEach(
      (
        [
          creature,
          action,
          cooldowns,
          aim,
          physicsBody,
          vitals,
          pos,
          rot,
          individualValues,
        ],
        entity,
      ) => {
        const species = getSpecies(creature.speciesId)
        const castContext = {
          entity,
          world,
          species,
          individualValues,
          level: resolveEntityLevel(entity, species),
          // Golpes DESTA criatura por slot (docs/features/038-*).
          moveSet: resolveEntityMoveSet(entity, species),
          action,
          cooldowns,
          vitals,
          pos,
          rot,
          physicsBody,
        }

        // Golpe que exige o botão segurado (`requiresHold`): soltar o botão
        // do slot cancela (e o cooldown começa, como no fim normal).
        if (action.current === 'attack') {
          const running = resolveAttackForEntity(
            species,
            action.pendingSlot,
            individualValues,
            castContext.level,
            castContext.moveSet,
          )
          if (
            requiresHold(action, running) &&
            !isSlotHeld(input, action.pendingSlot)
          ) {
            finishAttack(entity, action, running, cooldowns)
          }
        }

        // Botão direito cancela o indicador aberto (como no LoL).
        if (aim.slot && input.secondaryHeld) aim.slot = null

        if (aim.slot) {
          // Indicador aberto: clique ou a MESMA tecla de novo confirma.
          // Sem conseguir lançar agora (ocupado/cooldown/stamina), o
          // indicador continua aberto.
          if (input.primary || input[aim.slot]) {
            if (tryStartAttack(castContext, aim.slot)) aim.slot = null
          } else {
            handleAttackPress(castContext, aim, input, castModeOverride)
          }
        } else {
          handleAttackPress(castContext, aim, input, castModeOverride)
        }
      },
    )

  // 3. Disparo da IA: criatura (selvagem, ou do time fora do controle)
  // que pediu golpe (`WantsToAttack`, posto pelo `wildBehaviorSystem.js`/
  // `partyBehaviorSystem.js`) lança o golpe do slot pedido mirando no alvo
  // do pedido. Pedido que não dá pra atender agora (ocupada/stamina/
  // cooldown, alvo fora da luta) é descartado — o comportamento pede de
  // novo depois.
  const requested = []
  world
    .query(
      WantsToAttack,
      ActionState,
      AttackCooldowns,
      PhysicsBody,
      Vitals,
      Position,
      Rotation,
      IndividualValues,
    )
    .updateEach(
      (
        [
          request,
          action,
          cooldowns,
          physicsBody,
          vitals,
          pos,
          rot,
          individualValues,
        ],
        entity,
      ) => {
        requested.push(entity)
        const target = request.target
        if (!request.slot || !isActiveCombatant(target)) return
        const speciesId = resolveCreatureSpeciesId(entity)
        if (!speciesId) return

        const species = getSpecies(speciesId)
        const castContext = {
          entity,
          world,
          species,
          individualValues,
          level: resolveEntityLevel(entity, species),
          // Golpes DESTA criatura por slot (docs/features/038-*).
          moveSet: resolveEntityMoveSet(entity, species),
          action,
          cooldowns,
          vitals,
          pos,
          rot,
          physicsBody,
        }
        tryStartAttack(
          castContext,
          request.slot,
          resolveDirectionTo(pos, target.get(Position), rot),
        )
      },
    )
  // Fora do `updateEach`: remover trait muda a query iterada.
  for (const entity of requested) entity.remove(WantsToAttack)

  // Quem levou dano neste tick (alvo de golpe ou de tick de canal) — o
  // passo 5 interrompe o golpe de status que eles estavam carregando.
  const damaged = new Set()

  // 4. Avanço do golpe de TODO atacante: impacto no `effectAt`, fim em
  // `duration`. O golpe de uma criatura do time acerta selvagens; o de
  // uma selvagem acerta o lado do jogador (criaturas do time e treinador).
  world
    .query(
      ActionState,
      CharacterController,
      PhysicsBody,
      Position,
      Rotation,
      IndividualValues,
    )
    .updateEach(
      (
        [action, controller, physicsBody, pos, rot, individualValues],
        entity,
      ) => {
        if (action.current !== 'attack') return

        const species = getSpecies(resolveCreatureSpeciesId(entity))
        const level = resolveEntityLevel(entity, species)
        const targetSide = entity.has(WildCreature) ? 'player' : 'wild'
        const ATTACK = resolveAttackForEntity(
          species,
          action.pendingSlot,
          individualValues,
          level,
          resolveEntityMoveSet(entity, species),
        )
        // O golpe do slot deixou de existir no meio da ação (ex.: treino
        // parado durante uma repetição): a ação acaba aqui.
        if (!ATTACK) {
          finishAttack(entity, action, { cooldown: 0 })
          return
        }
        const previousElapsed = action.elapsed
        action.elapsed += delta
        // Canalizado: dano no CONE a cada `damageInterval`, do `effectAt`
        // até o fim — o impacto único no fim da trajetória não se aplica.
        const channel = isChannelAttack(ATTACK)

        // Direcionar enquanto o aviso carrega: antes do `effectAt` a criatura
        // CONTROLADA (a IA mira uma vez, no disparo) reaponta pra onde a
        // câmera olha agora — o aviso vermelho (`AttackTelegraphView`) lê
        // `action.dir*` a cada frame, então acompanha. No tick que cruza o
        // `effectAt` a direção já é a mais recente e daí trava pro golpe —
        // menos no canalizado em feixe (`isBeamAttack`), que continua mirando
        // o canal inteiro.
        if (
          GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING &&
          !isSelfAttack(ATTACK) &&
          (previousElapsed < ATTACK.effectAt || isBeamAttack(ATTACK)) &&
          entity.has(InputControlled)
        ) {
          const aim = resolveAttackDirection(
            world,
            pos,
            physicsBody.colliderHandle,
            species,
          )
          action.dirX = aim.x
          action.dirY = aim.y
          action.dirZ = aim.z
          rot.y = Math.atan2(aim.x, aim.z)
        } else if (isBeamAttack(ATTACK) && !entity.has(InputControlled)) {
          // Feixe da IA: segue o alvo dela o canal inteiro, com giro limitado
          // (`steerAiBeam`) — dá pra escapar correndo de lado.
          const aiTarget = resolveAiTarget(entity)
          if (aiTarget) {
            rot.y = steerAiBeam(action, pos, aiTarget.get(Position), delta)
          }
        }

        if (
          previousElapsed < ATTACK.effectAt &&
          action.elapsed >= ATTACK.effectAt
        ) {
          const { failed } = resolveAttackImpact(world, events, {
            entity,
            action,
            species,
            individualValues,
            level,
            attack: ATTACK,
            pos,
            controller,
            physicsBody,
            targetSide,
            damaged,
          })
          // Golpe que falhou por falta de domínio (docs/features/038-*):
          // acaba aqui — no canalizado, o canal inteiro.
          if (failed) {
            finishAttack(entity, action, ATTACK)
            return
          }
          registrarUsoDeGolpe(world, events, {
            entity,
            attack: ATTACK,
            slot: action.pendingSlot,
            pos,
          })
        }

        if (channel && ATTACK.damage) {
          const ticks = countChannelTicks(
            previousElapsed,
            action.elapsed,
            ATTACK,
          )
          for (let tick = 0; tick < ticks; tick++) {
            applyChannelTick(world, events, {
              entity,
              action,
              species,
              individualValues,
              level,
              attack: ATTACK,
              pos,
              controller,
              physicsBody,
              targetSide,
              damaged,
            })
          }
        }

        if (action.elapsed >= ATTACK.duration) {
          finishAttack(entity, action, ATTACK)
        }
      },
    )

  // 5. Quem levou dano neste tick e estava CARREGANDO um golpe de status
  // perde o golpe — fora do `updateEach` acima, pra não mexer na ação de
  // outra entidade no meio da passada.
  interruptStatusAttacks(events, damaged)
}
