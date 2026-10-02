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
import { resolveAttackImpact } from '../battle/attackImpact'
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
} from '../traits'

/**
 * Ataques de criatura — do time E selvagens — num system só, em cinco
 * passadas por tick: (1) cooldowns de todo atacante; (2) disparo pelo
 * input da criatura controlada; (3) disparo da IA — selvagem ou criatura
 * do time fora do controle com `WantsToAttack` (posto pelo
 * `wildBehaviorSystem.js`/`partyBehaviorSystem.js`) lança o ataque básico
 * mirando no alvo do pedido (`tryStartAttack` com direção pronta — mesmo
 * caminho, stamina/cooldown/modo combate iguais); (4)
 * avanço do golpe de todo atacante; (5) interrupção do golpe de status em
 * carga de quem levou dano no tick. O golpe de criatura do time acerta
 * selvagens; o de selvagem acerta o lado do jogador (criaturas do time e
 * treinador) — `resolveAttackTarget`, `targetSide`.
 *
 * Disparo pelo input: dispara e avança o ataque/skill de uma criatura controlada — botão
 * ESQUERDO do mouse (`primary`, ataque comum) OU Q/E/R (`secondary1-3`,
 * skills — a partir da 9ª rodada de docs/features/025-ataque-comum-de-
 * criatura.md: "pode fazer as habilidades agora?"), sem precisar de
 * nenhum gatilho extra. A direção do golpe vem de
 * `resolveAttackDirection` (`core/battle/attackAim.js`): sempre horizontal, a
 * partir do giro horizontal da câmera; a assistência de mira (puxar pro alvo
 * à frente) só entra no ataque BÁSICO. Trava o corpo (`rot.y`, só o
 * componente horizontal — o corpo não inclina) e a trajetória do golpe
 * (`action.dirX/dirY/dirZ`). A direção é resolvida no disparo e, na criatura
 * CONTROLADA, de novo a cada tick até o `effectAt` ("direcionar durante o
 * aviso", `GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING`): o jogador pode
 * redirecionar o golpe enquanto o aviso vermelho carrega, e a direção trava
 * no instante do golpe, que é quando o efeito/dano de fato acontecem — depois
 * disso a câmera é livre pra girar (mesmo motivo de sempre,
 * `beginSummon`/`resolveThrowLaunch`, docs/features/024-esfera-de-
 * invocar.md).
 *
 * **Um único slot dispara por vez** (`ATTACK_SLOTS`, `core/battle/attackCasting.js`): a cada tick
 * livre (`action.current === null`), percorre mouse→Q→E→R na ordem, e o
 * PRIMEIRO com tecla pressionada + `species.basicAttack`/`species.skills[N]` resolvido +
 * stamina/cooldown livres ganha — os outros três nem são considerados
 * naquele tick (mesmo padrão de "só um por tick" de `partySummonSystem.js`).
 * `action.pendingSlot` (reaproveitado do mesmo campo que invocar/recolher
 * já usa, com outro significado — ver docstring de `ActionState`) grava
 * QUAL slot ganhou, porque `action.current` vira só `'attack'` pras
 * quatro fontes (mouse e as três teclas) — sem o slot, o `effectAt`/
 * `duration` no meio do gesto não saberia se deve reler
 * `basicAttack` ou `skills[1]`, por exemplo.
 *
 * **Respeita o trajeto, não só o destino** (`resolveAttackImpactPoint`,
 * `core/battle/attackTrajectory.js`): com um `range` grande (simulando o alcance de um golpe tipo
 * chicote), o ponto de impacto não "teleporta" através de parede/
 * obstáculo nem desnível — a trajetória acompanha o terreno e para no
 * primeiro bloqueio (ver docstring de `resolveAttackImpactPoint`). Vale pra QUALQUER
 * slot (mouse ou skill) — mecanismo genérico, sem branch nenhum por id/
 * grupo de efeito.
 *
 * **Config vem de `core/data/skills/`, não mais inline na espécie**
 * (reorganização pedida pelo usuário — ver docs/features/025-ataque-
 * comum-de-criatura.md, seção "reorganização da config"):
 * `resolveCreatureAttack(getSpecies(id), slot)` é só uma REFERÊNCIA (string id, ou
 * `{ id, overrides }`); `resolveCreatureAttack` (`core/data/skills/
 * index.js`) resolve a definição de verdade, mesclando overrides da
 * criatura por cima da base do ataque quando houver. Sem
 * `species.basicAttack`/`species.skills[N]` configurado, ou id desconhecido, aquele slot
 * simplesmente não é candidato a disparar — mesmo fallback gracioso de
 * sempre (hoje só `primary` é universal; `secondary1` só as 3 espécies
 * iniciais configuram, `secondary2`/`secondary3` nenhuma ainda).
 *
 * **`duration`/`effectAt` do `primary` são dinâmicos, por ENTIDADE**
 * (`resolveAttackForEntity`, `core/battle/attackCasting.js` — ver docs/features/029-*.md):
 * antes, cada espécie calculava isso uma vez, no module load, com um
 * `iv` de `speed` fixo; agora que IV é sorteado por indivíduo
 * (`IndividualValues`, nunca mais um literal na espécie), esse cálculo
 * só pode acontecer aqui — duas criaturas da MESMA espécie, com
 * `speed` diferente, atacam em ritmos diferentes. Só pra `primary`;
 * skills (`secondary1-3`) mantêm `duration`/`effectAt` PRÓPRIOS da
 * definição do ataque.
 *
 * Mesmo mecanismo genérico de `ActionState` que dash/arremesso/uso/summon/
 * recall já usam: trava `current` no disparo, o efeito de verdade só
 * acontece no instante `effectAt`, e `current` volta a `null` em
 * `duration`. Não é dono de `'dash'`/`'throw'`/`'consume'`/`'summon'`/
 * `'recall'` — outros systems progridem essas; este só entende `'attack'`,
 * mesmo padrão de exclusão mútua já usado por `playerActionSystem.js`/
 * `partySummonSystem.js`. Isso também significa que os QUATRO slots
 * (mouse + Q/E/R) compartilham a MESMA `ActionState` — usar uma skill
 * (Q) trava o ataque do mouse até `duration` acabar, e vice-versa, mesma
 * exclusão mútua que dash/ataque já tinham entre si.
 *
 * `SummonedCreature` na query (não `resolveSpeciesKind`) — mesmo critério
 * já usado alhures pra "isto é uma criatura, não o treinador": só uma
 * `SummonedCreature` de verdade chega a ter
 * `InputControlled`+`ActionState`+`Position`+`Rotation` juntos por essa
 * via (o treinador nunca tem `SummonedCreature`). `basicAttack`/`skills[N]` é
 * exclusivo de espécie `kind: 'pokemon'` (o treinador não tem — sem arma
 * direta no design, ver docs/backlog.md).
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
 * stamina de sobra — os outros três continuam livres (pedido implícito
 * da 9ª rodada: skills de verdade configuram cooldown > 0, então um
 * campo único e compartilhado travaria o ataque do mouse pelo mesmo
 * tempo de usar uma skill, o que não faz sentido). `0` (padrão do ataque
 * comum) é um no-op — só stamina trava de verdade nesse caso.
 *
 * **Som do impacto**: `entity.add(AttackPulse)` no mesmo instante
 * `effectAt` em que o VFX nasce — pulso de um tick (`core/traits/
 * components/attackEffect.js`) consumido por `attackAudioSystem.js`
 * (view, fase presentation), mesmo mecanismo de `Jumped`/`SummonPulse`/
 * `RecallPulse`. Toca `attack.audio` (`core/data/audio/attackSound.js`)
 * — este system não sabe nada de áudio de verdade, só marca O INSTANTE.
 * **Limitação conhecida (9ª rodada)**: o pulso não carrega QUAL slot
 * disparou, e `attackAudioSystem.js`/`resolveAttackSound` ainda só
 * resolvem `basicAttack` — uma skill nova (`vine-whip`/`ember`/
 * `whirlpool`, todas com `audio.group: null` de propósito) não tem som
 * PRÓPRIO ainda; até a rodada de áudio generalizar isso (quando o usuário
 * trouxer os arquivos), o pulso de uma skill só reaproveita o som que já
 * estiver registrado pro ataque comum da criatura, se houver.
 *
 * Headless. Fase: simulation, junto de `playerActionSystem`/
 * `partySummonSystem` (mesma família de "ações disparadas por input").
 */
export function creatureAttackSystem(context) {
  const { world, delta, events } = context
  const input = context.input ?? {}
  const castModeOverride = context.settings?.castModeOverride ?? null

  // 1. Cooldowns de TODO atacante (criatura do time ou selvagem) — correm
  // independente de qual ação está em andamento, antes de qualquer disparo.
  world.query(AttackCooldowns).updateEach(([cooldowns]) => {
    for (const { slot } of ATTACK_SLOTS) {
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
        const castContext = {
          entity,
          world,
          species: getSpecies(creature.speciesId),
          individualValues,
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
            castContext.species,
            action.pendingSlot,
            individualValues,
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
  // `partyBehaviorSystem.js`) lança o ataque básico mirando no alvo do
  // pedido. Pedido que não dá pra atender agora (ocupada/stamina/
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
        if (!isActiveCombatant(target)) return
        const speciesId = resolveCreatureSpeciesId(entity)
        if (!speciesId) return

        const castContext = {
          entity,
          world,
          species: getSpecies(speciesId),
          individualValues,
          action,
          cooldowns,
          vitals,
          pos,
          rot,
          physicsBody,
        }
        tryStartAttack(
          castContext,
          'primary',
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
        const targetSide = entity.has(WildCreature) ? 'player' : 'wild'
        const ATTACK = resolveAttackForEntity(
          species,
          action.pendingSlot,
          individualValues,
        )
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
            ATTACK,
            action.pendingSlot,
          )
          action.dirX = aim.x
          action.dirY = aim.y
          action.dirZ = aim.z
          rot.y = Math.atan2(aim.x, aim.z)
        }

        if (
          previousElapsed < ATTACK.effectAt &&
          action.elapsed >= ATTACK.effectAt
        ) {
          resolveAttackImpact(world, events, {
            entity,
            action,
            species,
            individualValues,
            attack: ATTACK,
            pos,
            controller,
            physicsBody,
            targetSide,
            damaged,
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
