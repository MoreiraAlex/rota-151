import { resolveAttackDirection } from './attackAim'
import { resolveCreatureAttack, resolveSlotMove } from './creatureAttack'
import {
  resolveMasteryCooldownFactor,
  resolveMasteryCostFactor,
} from './moveMastery'
import {
  calculateAttackDurationFactor,
  calculateStat,
} from '../data/species/stats'
import {
  isChannelAttack,
  isSelfAttack,
  resolveChannelTickCount,
  rollChannelWeights,
} from './channelAttack'
import { isAttackCharging } from './attackTelegraph'
import { GAME_CONFIG } from '../gameConfig'
import { entrarEmCombate } from '../actions/combat'
import { gameplayRng } from '../rng'
import { AttackCooldowns } from '../traits'
import { withActionCost } from './actionCost'
import { resolveFormulaLevel } from '../data/species/formulaLevel'

/**
 * Fator do status `speed` da PRÓPRIA entidade (`calculateAttackDurationFactor`,
 * `GAME_CONFIG.BATTLE.ATTACK_SPEED`): em volta de 1, menor pra quem é rápido.
 * Encurta o básico (abaixo) e a recarga das habilidades (`withActionCost`,
 * docs/features/035-balanceamento-de-acoes-e-correcoes.md). `null` pra espécie sem
 * `stats.speed.base` (ex.: o treinador).
 */
export function resolveSpeedFactor(
  species,
  individualValues,
  level = species?.level ?? 1,
) {
  const speedStat = species?.stats?.speed
  if (!speedStat || speedStat.base == null) return null

  const speed = calculateStat({
    base: speedStat.base,
    iv: individualValues?.speed ?? 0,
    ev: speedStat.ev ?? 0,
    level: resolveFormulaLevel(level),
  })
  const { REFERENCE, MIN_FACTOR, MAX_FACTOR } = GAME_CONFIG.BATTLE.ATTACK_SPEED
  return calculateAttackDurationFactor(speed, {
    reference: REFERENCE,
    minFactor: MIN_FACTOR,
    maxFactor: MAX_FACTOR,
  })
}

/**
 * `duration`/`effectAt` do golpe escalados pelo status `speed` da PRÓPRIA
 * entidade — a criatura mais rápida ataca mais rápido (decisão do usuário na
 * docs/features/039-tipos-e-combate-classico.md, Parte 5: antes só o ataque
 * básico escalava).
 *
 * A BASE é a autorada na skill (`duration` e `effectAt`). O `speed` só
 * multiplica por um fator em volta de 1 (`resolveSpeedFactor`) — assim a
 * duração escolhida pra casar com a animação continua valendo, e uma criatura
 * mais rápida só encurta o golpe. `effectAt` escala junto. O corte de frames e
 * as fases da animação acompanham sozinhos (são proporcionais à duração).
 */
function resolveScaledDuration(attack, speedFactor) {
  return {
    duration: attack.duration * speedFactor,
    effectAt: attack.effectAt * speedFactor,
  }
}

/**
 * Resolve a definição de ataque de verdade pro `slot` desta entidade —
 * `resolveCreatureAttack` (o golpe do slot) +:
 * - o `duration`/`effectAt` pelo `speed` (acima);
 * - `staminaCost`/`cooldown` pela fórmula (`withActionCost`,
 *   `core/battle/actionCost.js`) quando a definição não escreve os seus.
 * Chamada várias vezes por ataque (disparo, cada tick de progresso, IA, HUD)
 * — sempre com o MESMO resultado pra um dado slot/entidade, já que
 * `IndividualValues` está congelado pra aquela entidade (o resultado muda
 * só quando ela sobe de nível).
 *
 * `level` — nível DESTA criatura (`resolveEntityLevel`); sem ele, o
 * `species.level` (previews da wiki).
 *
 * `moveSet` — golpes DESTA criatura por slot (`resolveEntityMoveSet`,
 * `core/battle/creatureAttack.js`); sem ele, o kit da espécie (wiki). O
 * domínio do golpe (docs/features/038-aprendizado-treino-e-dominio-de-
 * golpes.md) multiplica energia e recarga, e vai junto no ataque
 * (`attack.mastery`) pro sorteio de precisão/falha.
 */
export function resolveAttackForEntity(
  species,
  slot,
  individualValues,
  level = species?.level ?? 1,
  moveSet = null,
) {
  const attack = resolveCreatureAttack(species, slot, moveSet)
  if (!attack) return null

  const speedFactor = resolveSpeedFactor(species, individualValues, level)
  const timed =
    speedFactor !== null
      ? { ...attack, ...resolveScaledDuration(attack, speedFactor) }
      : attack
  const costed = withActionCost(timed, {
    level,
    speedFactor: speedFactor ?? 1,
  })
  return withMastery(costed, resolveSlotMove(species, slot, moveSet)?.mastery)
}

// Domínio baixo: mais energia e mais recarga. Sem domínio, igual.
function withMastery(attack, mastery) {
  if (mastery == null) return attack
  return {
    ...attack,
    mastery,
    staminaCost: attack.staminaCost * resolveMasteryCostFactor(mastery),
    cooldown: attack.cooldown * resolveMasteryCooldownFactor(mastery),
  }
}

// Ordem de prioridade de disparo por tick — Q/E/R na ordem de sempre (mesmos
// rótulos de `resolveActionSlots`/`species.skills[N]`, ver `core/data/
// actionSlots.js`). O clique esquerdo não dispara golpe nenhum (não há ataque
// básico) — só confirma a mira no `castMode: 'confirm'`. Reaproveita o padrão de `SLOTS` em
// `partySummonSystem.js` (array de `{ input, slot }`, só um processado
// por tick — segurar duas teclas juntas não empilha, só a primeira da
// lista com input+config válidos ganha).
export const ATTACK_SLOTS = [
  { input: 'secondary1', slot: 'secondary1' },
  { input: 'secondary2', slot: 'secondary2' },
  { input: 'secondary3', slot: 'secondary3' },
]

/**
 * Ataque do `slot` pronto pra lançar AGORA: configurado, ação livre,
 * stamina e cooldown ok. `null` se não der.
 */
function resolveCastableAttack(castContext, slot) {
  const {
    species,
    individualValues,
    level,
    moveSet,
    action,
    vitals,
    cooldowns,
  } = castContext
  if (action.current !== null) return null

  const attack = resolveAttackForEntity(
    species,
    slot,
    individualValues,
    level,
    moveSet,
  )
  if (!attack) return null
  if (vitals.stamina < attack.staminaCost) return null
  if (cooldowns[slot] > 0) return null
  return attack
}

/**
 * Direção horizontal (unitária) de `from` até `to` — a mira da IA. Alvo em
 * cima (distância ~0): mantém pra onde o corpo já está virado.
 */
export function resolveDirectionTo(from, to, rot) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  if (length < 1e-6) return resolveFacingDirection(rot)
  return { x: dx / length, y: 0, z: dz / length }
}

/** Pra onde o corpo está virado agora (horizontal, unitária). */
function resolveFacingDirection(rot) {
  return { x: Math.sin(rot.y), y: 0, z: Math.cos(rot.y) }
}

/**
 * Lança o ataque do `slot` se der (`resolveCastableAttack`): trava a
 * ação, desconta stamina, trava cooldown e trava a direção do golpe.
 * Devolve se lançou. `direction` (horizontal, unitária) é a mira pronta
 * da IA; sem ela, mira pela câmera (`resolveAttackDirection` — jogador).
 * `enterCombat: false` — o treino (`trainingSystem.js`) não põe a criatura
 * em modo combate.
 */
export function tryStartAttack(
  castContext,
  slot,
  direction = null,
  { enterCombat = true } = {},
) {
  const attack = resolveCastableAttack(castContext, slot)
  if (!attack) return false

  const { world, species, action, vitals, pos, rot, physicsBody } = castContext
  action.current = 'attack'
  action.pendingSlot = slot
  action.elapsed = 0
  // Ver docstring de `ActionState.animationSpeed` — `animationSystem.js`
  // toca o clipe de ataque nesta velocidade, então o gesto sempre cabe
  // exatamente em `attack.duration`.
  action.animationSpeed = attack.duration > 0 ? 1 / attack.duration : 1
  // Corte do clipe embutido (`overrides.animationFrames`) — ver `ActionState`.
  action.animationFrames = attack.animationFrames ?? null
  // Qual animação este ataque toca (`animation.clipKey`) — ver `ActionState`.
  action.animationKey = attack.animation?.clipKey ?? null
  // Canalizado: o dano total é repartido em frações sorteadas AGORA, uma
  // por tick (`resolveChannelTickDamage`) — ver `ActionState.channelWeights`.
  action.channelWeights = isChannelAttack(attack)
    ? rollChannelWeights(resolveChannelTickCount(attack), gameplayRng)
    : null
  action.channelTick = 0
  action.channelEffectTargets = isChannelAttack(attack) ? [] : null
  vitals.stamina -= attack.staminaCost
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
  // Cooldown NÃO começa aqui — só quando a ação terminar (passo 4).

  // Horizontal, pelo giro da câmera — ver `resolveAttackDirection`
  // (`core/battle/attackAim.js`). Golpe em SI
  // MESMO (Growth) não mira: fica a direção pra onde o corpo já está virado.
  const self = isSelfAttack(attack)
  const aim = self
    ? resolveFacingDirection(rot)
    : (direction ??
      resolveAttackDirection(world, pos, physicsBody.colliderHandle, species))
  action.dirX = aim.x
  action.dirY = aim.y
  action.dirZ = aim.z
  // O corpo encara a direção do golpe (só gira em Y) — menos no golpe em si
  // mesmo, que mantém a rotação travada até o fim da ação.
  if (!self) rot.y = Math.atan2(aim.x, aim.z)

  // Todo ataque lançado põe (ou mantém) a criatura em modo combate.
  if (enterCombat) entrarEmCombate(castContext.entity)
  return true
}

/**
 * `castMode` efetivo do ataque: `castModeOverride` (`context.settings`,
 * hoje só o modo debug — F2 força `'confirm'` em tudo) ganha da definição
 * do ataque; ausente na definição = `'instant'`.
 */
export function resolveCastMode(attack, castModeOverride) {
  if (castModeOverride) return castModeOverride
  return attack.castMode === 'confirm' ? 'confirm' : 'instant'
}

/**
 * Trata os botões de ataque apertados neste tick (fora a confirmação do
 * indicador, que o system trata antes), na ordem de prioridade de
 * `ATTACK_SLOTS` — o primeiro que "pega" encerra o tick:
 * - `castMode: 'confirm'`: abre o indicador desse slot (ou troca pra ele,
 *   se outro estava aberto), se o ataque existe e não está em cooldown.
 * - `castMode: 'instant'`: lança na hora, se der; senão tenta o próximo.
 */
export function handleAttackPress(castContext, aim, input, castModeOverride) {
  const { species, individualValues, level, moveSet, cooldowns } = castContext

  for (const { input: inputKey, slot } of ATTACK_SLOTS) {
    if (!input[inputKey] || slot === aim.slot) continue

    const attack = resolveAttackForEntity(
      species,
      slot,
      individualValues,
      level,
      moveSet,
    )
    if (!attack) continue

    if (resolveCastMode(attack, castModeOverride) === 'confirm') {
      if (cooldowns[slot] > 0) continue
      aim.slot = slot
      return
    }

    if (tryStartAttack(castContext, slot)) {
      aim.slot = null
      return
    }
  }
}

/**
 * Encerra a ação de ataque — no fim natural (`duration`) OU cancelada
 * (canalizado solto antes). O cooldown do slot começa a contar só AGORA,
 * nunca no disparo (pedido do usuário: contando desde o disparo, uma skill
 * com `duration` >= `cooldown` saía da ação já pronta de novo). `cooldowns`
 * é o objeto do trait quando quem chama já está numa query com
 * `AttackCooldowns` (escrever via `entity.set` ali seria sobrescrito no fim
 * do `updateEach`); senão, `entity.set`.
 */
export function finishAttack(entity, action, attack, cooldowns = null) {
  if (cooldowns) {
    cooldowns[action.pendingSlot] = attack.cooldown
  } else if (entity.has(AttackCooldowns)) {
    entity.set(AttackCooldowns, { [action.pendingSlot]: attack.cooldown })
  }
  action.current = null
  action.pendingSlot = null
  action.animationFrames = null
  action.animationKey = null
  action.channelWeights = null
  action.channelTick = 0
  action.channelEffectTargets = null
}

/**
 * O golpe em andamento exige o botão do slot SEGURADO agora? O canalizado,
 * o tempo todo (soltar corta o canal). O golpe em si mesmo (`area: 'self'`,
 * Growth), só durante a CARGA (`isAttackCharging`) — pedido do usuário,
 * igual ao canalizado: soltar antes do efeito cancela; depois que o efeito
 * saiu, o resto da animação não depende do botão.
 */
export function requiresHold(action, attack) {
  if (isChannelAttack(attack)) return true
  return isSelfAttack(attack) && isAttackCharging(action, attack)
}

/**
 * O botão do slot ainda está SEGURADO? (ataque canalizado — soltar
 * cancela). Q/E/R também aceitam o clique esquerdo segurado, já que o
 * `castMode: 'confirm'` confirma uma skill com clique.
 */
export function isSlotHeld(input, slot) {
  if (input.primaryHeld) return true
  return !!input[`${slot}Held`]
}
