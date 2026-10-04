import { resolveAttackDirection } from './attackAim'
import { resolveCreatureAttack } from './creatureAttack'
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
 * `duration`/`effectAt` do ataque BÁSICO (`primary`) escalados pelo
 * status `speed` da PRÓPRIA entidade — pedido original do usuário:
 * "preciso que o status speed influencie na velocidade de ataque básico
 * da criatura".
 *
 * A BASE é a autorada no ataque básico da própria espécie
 * (`species.basicAttack`, `core/data/species/<id>/basicAttack.js` —
 * `duration` e `effectAt`). O `speed` só multiplica por um fator em volta de 1
 * (`resolveSpeedFactor`) — assim a duração escolhida pra casar com a animação
 * continua valendo, e uma criatura mais rápida só encurta o golpe. (Antes, o
 * `speed` gerava a duração inteira, 0.05–0.5s — curto demais pros clipes
 * embutidos, e por isso o override da espécie passou a ignorá-lo; ver
 * docs/features/032-*.) `effectAt` escala junto. O corte de frames e as fases
 * da animação acompanham sozinhos (são proporcionais à duração).
 */
function resolvePrimaryDuration(attack, speedFactor) {
  return {
    duration: attack.duration * speedFactor,
    effectAt: attack.effectAt * speedFactor,
  }
}

/**
 * Resolve a definição de ataque de verdade pro `slot` desta entidade —
 * `resolveCreatureAttack` (básico da espécie ou skill do registro) +:
 * - só pra `primary`, o `duration`/`effectAt` pelo `speed` (acima);
 * - `staminaCost`/`cooldown` pela fórmula (`withActionCost`,
 *   `core/battle/actionCost.js`) quando a definição não escreve os seus.
 * Chamada várias vezes por ataque (disparo, cada tick de progresso, IA, HUD)
 * — sempre com o MESMO resultado pra um dado slot/entidade, já que
 * `IndividualValues` está congelado pra aquela entidade (o resultado muda
 * só quando ela sobe de nível).
 *
 * `level` — nível DESTA criatura (`resolveEntityLevel`); sem ele, o
 * `species.level` (previews da wiki).
 */
export function resolveAttackForEntity(
  species,
  slot,
  individualValues,
  level = species?.level ?? 1,
) {
  const attack = resolveCreatureAttack(species, slot)
  if (!attack) return null

  const speedFactor = resolveSpeedFactor(species, individualValues, level)
  const timed =
    slot === 'primary' && speedFactor !== null
      ? { ...attack, ...resolvePrimaryDuration(attack, speedFactor) }
      : attack
  return withActionCost(timed, {
    slot,
    level,
    speedFactor: speedFactor ?? 1,
  })
}

// Ordem de prioridade de disparo por tick — botão esquerdo do mouse
// primeiro, depois Q/E/R na ordem de sempre (mesmos rótulos de
// `resolveActionSlots`/`species.basicAttack`/`species.skills[N]`, ver `core/data/
// actionSlots.js`). Reaproveita o padrão de `SLOTS` em
// `partySummonSystem.js` (array de `{ input, slot }`, só um processado
// por tick — segurar duas teclas juntas não empilha, só a primeira da
// lista com input+config válidos ganha).
export const ATTACK_SLOTS = [
  { input: 'primary', slot: 'primary' },
  { input: 'secondary1', slot: 'secondary1' },
  { input: 'secondary2', slot: 'secondary2' },
  { input: 'secondary3', slot: 'secondary3' },
]

/**
 * Ataque do `slot` pronto pra lançar AGORA: configurado, ação livre,
 * stamina e cooldown ok. `null` se não der.
 */
function resolveCastableAttack(castContext, slot) {
  const { species, individualValues, level, action, vitals, cooldowns } =
    castContext
  if (action.current !== null) return null

  const attack = resolveAttackForEntity(species, slot, individualValues, level)
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
 */
export function tryStartAttack(castContext, slot, direction = null) {
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
  vitals.stamina -= attack.staminaCost
  vitals.staminaRegenDelay = vitals.staminaRegenDelayAfterUse
  // Cooldown NÃO começa aqui — só quando a ação terminar (passo 4).

  // Horizontal, com assistência no corpo a corpo — ver
  // `resolveAttackDirection` (`core/battle/attackAim.js`). Golpe em SI
  // MESMO (Growth) não mira: fica a direção pra onde o corpo já está virado.
  const self = isSelfAttack(attack)
  const aim = self
    ? resolveFacingDirection(rot)
    : (direction ??
      resolveAttackDirection(
        world,
        pos,
        physicsBody.colliderHandle,
        species,
        attack,
        slot,
      ))
  action.dirX = aim.x
  action.dirY = aim.y
  action.dirZ = aim.z
  // O corpo encara a direção do golpe (só gira em Y) — menos no golpe em si
  // mesmo, que mantém a rotação travada até o fim da ação.
  if (!self) rot.y = Math.atan2(aim.x, aim.z)

  // Todo ataque lançado põe (ou mantém) a criatura em modo combate.
  entrarEmCombate(castContext.entity)
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
  const { species, individualValues, level, cooldowns } = castContext

  for (const { input: inputKey, slot } of ATTACK_SLOTS) {
    if (!input[inputKey] || slot === aim.slot) continue

    const attack = resolveAttackForEntity(
      species,
      slot,
      individualValues,
      level,
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
  return slot !== 'primary' && !!input[`${slot}Held`]
}
