import * as THREE from 'three'
import { EVENT_TYPES } from '@/core/events'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/colliders'
import { CharacterController, Position } from '@/core/traits'
import { damageNumberPool } from '../vfx/damageNumberPool'
import { formatSpeciesName } from '../shared/formatName'
import { resolveFeedbackColor, resolveSide } from '../vfx/feedbackColors'

const { LIFETIME, CRIT_LIFETIME, HEAD_MARGIN, SPREAD } =
  GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER
// Deslocamento lateral por número seguido: centro, esquerda, direita...
const SPREAD_PATTERN = [0, -1, 1]

const cameraRight = new THREE.Vector3()

const STAT_LABELS = {
  attack: 'Ataque',
  defense: 'Defesa',
  sp_atk: 'Atq. Esp.',
  sp_def: 'Def. Esp.',
  accuracy: 'Precisão',
}

/** Texto de status: "Ataque ↓" (uma seta por estágio, no máximo 3). */
export function formatStatChange(stat, delta) {
  const arrow = delta < 0 ? '↓' : '↑'
  return `${STAT_LABELS[stat] ?? stat} ${arrow.repeat(Math.min(Math.abs(delta), 3))}`
}

/** Texto do ganho de XP: "+N XP". */
export function formatExperienceGain(amount) {
  return `+${Math.round(amount)} XP`
}

/** Texto da subida de nível: "Nível N!". */
export function formatLevelUp(level) {
  return `Nível ${level}!`
}

/** "Pode aprender Smokescreen!" (um ou mais golpes aptos ao subir de nível). */
export function formatMoveUnlocked(moveIds) {
  return `Pode aprender ${moveIds.map(formatSpeciesName).join(', ')}!`
}

/** "Aprendeu Smokescreen!" */
export function formatMoveLearned(moveId) {
  return `Aprendeu ${formatSpeciesName(moveId)}!`
}

/** Texto do número: inteiro, nunca menos que 1 num acerto. */
export function formatDamage(amount) {
  return String(Math.max(1, Math.round(amount)))
}

/**
 * Número de dano: pra cada `attackResolved` com `hit` em
 * `context.frameEvents`, nasce um número logo acima da cabeça do alvo
 * (topo da cápsula + `HEAD_MARGIN`) e vai subindo/sumindo
 * (a cor vem do lado do alvo e do tipo, `FEEDBACK_COLORS`)
 * (`DamageNumbersView.jsx` desenha; este system só cuida do pool). Crítico
 * fica mais tempo (`CRIT_LIFETIME`) e ganha outro visual na view.
 * Números seguidos se afastam de lado (`SPREAD`, na direita da câmera)
 * pra golpes rápidos não empilharem.
 *
 * O dano de verdade continua com casas decimais no `Vitals` — só o texto
 * é arredondado (`formatDamage`).
 *
 * Também os avisos em texto: "Errou!", "Interrompido!", "+N XP" e "Nível N!"
 * (só da criatura em campo — a que está na bola não mostra nada).
 *
 * Fase: presentation.
 */
export function damageNumberSystem(context) {
  const { delta, frameEvents, camera } = context

  damageNumberPool.advance(delta)

  cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
  for (const event of frameEvents) {
    if (event.type === EVENT_TYPES.STAT_STAGE_CHANGED) {
      spawnStatText(event, cameraRight)
      continue
    }
    if (event.type === EVENT_TYPES.ATTACK_INTERRUPTED) {
      spawnInterruptText(event, cameraRight)
      continue
    }
    if (event.type === EVENT_TYPES.LEECH_SEED_DRAINED) {
      spawnLeechNumbers(event, cameraRight)
      continue
    }
    if (event.type === EVENT_TYPES.EXPERIENCE_GAINED) {
      spawnNotice(
        event.creature,
        formatExperienceGain(event.amount),
        GAME_CONFIG.FEEDBACK.XP_COLOR,
        cameraRight,
      )
      continue
    }
    if (event.type === EVENT_TYPES.ATTACK_FAILED) {
      spawnNotice(
        event.entity,
        'Falhou!',
        GAME_CONFIG.FEEDBACK.FAIL_COLOR,
        cameraRight,
      )
      continue
    }
    if (event.type === EVENT_TYPES.MOVE_UNLOCKED) {
      spawnNotice(
        event.creature,
        formatMoveUnlocked(event.moveIds),
        GAME_CONFIG.FEEDBACK.MOVE_NOTICE_COLOR,
        cameraRight,
      )
      continue
    }
    if (event.type === EVENT_TYPES.MOVE_LEARNED) {
      spawnNotice(
        event.creature,
        formatMoveLearned(event.moveId),
        GAME_CONFIG.FEEDBACK.MOVE_NOTICE_COLOR,
        cameraRight,
      )
      continue
    }
    if (event.type === EVENT_TYPES.LEVELED_UP) {
      spawnNotice(
        event.creature,
        formatLevelUp(event.level),
        GAME_CONFIG.FEEDBACK.LEVEL_UP_COLOR,
        cameraRight,
      )
      continue
    }
    if (event.type !== EVENT_TYPES.ATTACK_RESOLVED) continue
    if (event.missed) {
      spawnMissText(event, cameraRight)
      continue
    }
    if (event.result !== 'hit') continue
    // golpe de status (sem dano): quem mostra é o texto do atributo
    if (event.status) continue
    if (!event.target.has(Position)) continue

    const pos = event.target.get(Position)
    const body = event.target.get(CharacterController)
    const top = pos.y + verticalClearance(body) + HEAD_MARGIN
    const slot = damageNumberPool.spawn({
      position: { x: pos.x, y: top, z: pos.z },
      text: formatDamage(event.damage),
      critical: event.critical,
      lifetime: event.critical ? CRIT_LIFETIME : LIFETIME,
      // dano: vermelho no oponente, rosa no aliado; crítico: dourado no
      // oponente, rosa-claro no aliado — com o contorno na cor de dano do lado
      // (`FEEDBACK_COLORS`)
      color: resolveFeedbackColor(
        event.critical ? 'crit' : 'damage',
        resolveSide(event.target),
      ),
      glow: resolveFeedbackColor('damage', resolveSide(event.target)),
    })

    const side = SPREAD_PATTERN[slot.serial % SPREAD_PATTERN.length] * SPREAD
    slot.x += cameraRight.x * side
    slot.z += cameraRight.z * side
  }
}

/**
 * Uma drenagem do Leech Seed: o número de dano no alvo (cor de dano do lado
 * dele) e "+N" na cor de atributo que sobe em quem plantou, se ele recuperou
 * alguma coisa (já cheio, recolhido ou desmaiado: nada).
 */
function spawnLeechNumbers(event, right) {
  const { target, source, damage, healed } = event
  spawnHeadNumber(target, {
    text: formatDamage(damage),
    kind: 'damage',
    color: resolveFeedbackColor('damage', resolveSide(target)),
    right,
  })
  if (healed > 0 && source) {
    spawnHeadNumber(source, {
      text: `+${formatDamage(healed)}`,
      kind: 'buff',
      color: resolveFeedbackColor('buff', resolveSide(source)),
      right,
    })
  }
}

// Número acima da cabeça (sem crítico), espalhado pro lado como os de dano.
function spawnHeadNumber(entity, { text, kind, color, right }) {
  if (!entity?.isAlive() || !entity.has(Position)) return
  const pos = entity.get(Position)
  const body = entity.get(CharacterController)
  const top = pos.y + verticalClearance(body) + HEAD_MARGIN
  const slot = damageNumberPool.spawn({
    position: { x: pos.x, y: top, z: pos.z },
    text,
    critical: false,
    lifetime: LIFETIME,
    kind,
    color,
  })
  const side = SPREAD_PATTERN[slot.serial % SPREAD_PATTERN.length] * SPREAD
  slot.x += right.x * side
  slot.z += right.z * side
}

/** Texto "Ataque ↓" logo acima da cabeça de quem teve o atributo alterado. */
function spawnStatText(event, right) {
  const { target, stat, delta } = event
  if (!target.isAlive() || !target.has(Position)) return

  const pos = target.get(Position)
  const body = target.get(CharacterController)
  const top = pos.y + verticalClearance(body) + HEAD_MARGIN
  const slot = damageNumberPool.spawn({
    position: { x: pos.x, y: top, z: pos.z },
    text: formatStatChange(stat, delta),
    critical: false,
    lifetime: LIFETIME,
    kind: delta < 0 ? 'debuff' : 'buff',
    color: resolveFeedbackColor(
      delta < 0 ? 'debuff' : 'buff',
      resolveSide(target),
    ),
  })

  const side = SPREAD_PATTERN[slot.serial % SPREAD_PATTERN.length] * SPREAD
  slot.x += right.x * side
  slot.z += right.z * side
}

/** "Errou!" acima de quem o golpe errou no sorteio de precisão. */
function spawnMissText(event, right) {
  spawnNotice(event.target, 'Errou!', GAME_CONFIG.FEEDBACK.MISS_COLOR, right)
}

/** "Interrompido!" acima de quem perdeu o golpe de status na carga. */
function spawnInterruptText(event, right) {
  spawnNotice(
    event.entity,
    'Interrompido!',
    GAME_CONFIG.FEEDBACK.INTERRUPT_COLOR,
    right,
  )
}

// Aviso em texto acima da cabeça (não é número de dano nem atributo) —
// mesmo tamanho e vida do "Errou!" (`kind: 'miss'`).
function spawnNotice(entity, text, color, right) {
  if (!entity?.isAlive() || !entity.has(Position)) return

  const pos = entity.get(Position)
  const body = entity.get(CharacterController)
  const top = pos.y + verticalClearance(body) + HEAD_MARGIN
  const slot = damageNumberPool.spawn({
    position: { x: pos.x, y: top, z: pos.z },
    text,
    critical: false,
    lifetime: LIFETIME,
    kind: 'miss',
    color,
  })

  const side = SPREAD_PATTERN[slot.serial % SPREAD_PATTERN.length] * SPREAD
  slot.x += right.x * side
  slot.z += right.z * side
}
