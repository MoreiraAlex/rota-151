import * as THREE from 'three'
import {
  createNativeBlink,
  stopNativeBlink,
  updateNativeBlink,
} from './nativeBlink'

// Track de root motion dos rigs ripados (convenção `pm####`: nó `origin`,
// só em walk/run, só em Z — o deslocamento pra frente que o jogo já faz
// pela física). Mantida, arrastaria o modelo pra fora da cápsula a cada
// ciclo e voltaria de uma vez no loop.
const ROOT_MOTION_TRACK = 'origin.position'

// Clipe original (cache do `useGLTF`, compartilhado por toda instância do
// modelo) → cópia sem root motion. Um cache só por clipe: identidade
// estável pro `mixer.clipAction` e sem mutar o cache do drei.
const clipsWithoutRootMotion = new WeakMap()

/**
 * Toca as animações embutidas no `.glb` (`species.nativeAnimations`) via
 * `THREE.AnimationMixer` — um player por entidade, criado e descartado por
 * `useAnimatedModel.js` (dono do `dispose`), avançado só por
 * `animationSystem.js`.
 *
 * `species.nativeAnimations[stateId]` aceita duas formas:
 * - `'nome'` — um clipe só. Estado cíclico (walk/run/idle) repete; estado
 *   de ação (`oneShot`, `core/data/animationStates.js`) toca uma vez e
 *   segura o último frame.
 * - `{ start, loop, end }` — sequência (todas opcionais, exceto que ao
 *   menos uma exista): `start` toca uma vez ao entrar no estado, `loop`
 *   repete enquanto o estado durar, `end` toca uma vez ao SAIR — enquanto
 *   o `end` toca, o próximo estado cíclico espera (ver `holdNativeExit`).
 *   Ex.: faint = deita (`start`), fica deitada o tempo que `Fainted`
 *   durar (`loop`), levanta (`end`).
 * - `{ animation, blend? }` — o mesmo que `'nome'`, na forma de objeto
 *   (pra poder acompanhar `blend`).
 * - `{ sequence: ['a', 'b', 'c'], blend? }` (ou só o array) — cada clipe
 *   toca UMA vez, em ordem, sem loop (ex.: dash = entrada, impulso,
 *   recuperação). Numa ação, a lista inteira é esticada na mesma proporção
 *   pra caber em `duration`; fora de ação, velocidade original e segura o
 *   último frame. Cada item pode ser `{ animation, frames }` pra tocar só
 *   os `frames` primeiros keyframes daquele clipe (ex.: só o pouso do
 *   `stepInEnd`). Ver `resolveSequencePlan`.
 *
 * `blend` (s, opcional, em qualquer forma objeto): duração do crossfade ao
 * ENTRAR neste estado (e entre as fases dele) — ex.: `fall: { animation:
 * 'fallLoop', blend: 0.1 }` deixa jump → fall mais seco. Sem ele, vale o
 * global `GAME_CONFIG.ANIMATION.BLEND_DURATION` (ver `nativeStateBlend`).
 *
 * `speed` (multiplicador, opcional, em qualquer forma objeto; padrão 1):
 * velocidade do clipe gravado onde o tempo não vem de uma ação — estado
 * cíclico (ex.: `walk: { animation: 'walk', speed: 1.3 }`), o `loop` de
 * qualquer sequência, `start`/`end` fora de ação (faint) e a lista
 * `sequence` fora de ação. Numa ação, clipe único, `start`/`end` e
 * `sequence` continuam esticados pela `duration` (a duração manda; ver
 * `resolveTimeScale`). Os passos (`nativeCyclePhase`) acompanham sozinhos.
 *
 * `blinkConfig` (`species.nativeBlink`, opcional) liga o piscar por
 * animação — camada por cima do corpo, ver `nativeBlink.js`. `random` é
 * só o sorteio cosmético do intervalo de piscar.
 *
 * Não escreve nada fora dos ossos do próprio modelo, não conhece ECS.
 */
export function createNativeAnimationPlayer(
  root,
  animations,
  nativeAnimations,
  { blinkConfig = null, random = Math.random } = {},
) {
  const mixer = new THREE.AnimationMixer(root)
  const clipsByName = new Map(animations.map((clip) => [clip.name, clip]))
  return {
    mixer,
    root,
    clipsByName,
    nativeAnimations,
    blink: blinkConfig
      ? createNativeBlink(mixer, clipsByName, blinkConfig, random)
      : null,
    random,
    stateId: null,
    oneShot: false,
    phase: null,
    action: null,
    // Ação anterior ainda saindo num crossfade (ver `playPhase`).
    fadingOut: null,
    // Corte (s) da ação atual — `frames` pedido em `enterNativeState`.
    frames: null,
    endTime: null,
    // Sequência de uma AÇÃO (`oneShot` com start/loop/end) encaixada em
    // `duration` — ver `resolveActionSchedule`. `clock` conta o tempo real
    // desde que o estado começou.
    schedule: null,
    clock: 0,
    // Lista `sequence` em andamento — ver `resolveSequencePlan`.
    sequencePlan: null,
    // `end` tocando porque o estado SAIU (`holdNativeExit`) — diferente do
    // `end` de uma ação, que toca DENTRO do estado (`schedule`).
    exiting: false,
  }
}

export function disposeNativeAnimationPlayer(player) {
  player.mixer.stopAllAction()
  player.mixer.uncacheRoot(player.root)
}

/** Existe animação embutida resolvível pra esse estado? */
export function hasNativeAnimation(player, stateId) {
  if (!player) return false
  const spec = resolveSpec(player, stateId)
  if (!spec) return false
  if (spec.sequence) {
    return spec.sequence.some((item) =>
      resolveClip(player, sequenceItem(item).animation),
    )
  }
  return CLIP_KEYS.some((key) => resolveClip(player, spec[key]))
}

/** `blend` (s) declarado pro estado, ou `null` (usa o global). */
export function nativeStateBlend(player, stateId) {
  if (!player) return null
  return resolveSpec(player, stateId)?.blend ?? null
}

/**
 * Começa o estado do início (1ª fase da sequência, ou o clipe único).
 * `fade` (s): crossfade a partir do que estava tocando — ver `playPhase`.
 * `frames` (ação de clipe único, ex.: ataque — `ActionState.
 * animationFrames`): toca só os `frames` primeiros keyframes e para ali;
 * o trecho cortado é que é esticado pra caber na duração da ação.
 * `null` = o clipe inteiro.
 * `duration` (s, só ação): com sequência `{ start, loop, end }`, encaixa
 * a sequência inteira nesse tempo — ver `resolveActionSchedule`.
 */
export function enterNativeState(
  player,
  stateId,
  { oneShot, fade = 0, frames = null, duration = null },
) {
  const spec = resolveSpec(player, stateId)
  player.stateId = stateId
  player.oneShot = oneShot
  player.frames = frames
  player.clock = 0
  player.exiting = false

  if (spec.sequence) {
    player.schedule = null
    player.sequencePlan = resolveSequencePlan(
      player,
      spec.sequence,
      oneShot ? duration : null,
      spec.speed ?? 1,
    )
    playPhase(player, sequencePhase(0), fade)
    return
  }

  player.sequencePlan = null
  player.schedule =
    oneShot && !spec.main && duration > 0
      ? resolveActionSchedule(player, spec, duration)
      : null

  let phase = firstPhase(spec)
  if (player.schedule && phase === 'loop' && !player.schedule.loopFits) {
    phase = 'end'
  }
  playPhase(player, phase, fade)
}

export function stopNativeAnimation(player) {
  if (player.blink) stopNativeBlink(player.blink)
  player.fadingOut?.stop()
  player.fadingOut = null
  player.action?.stop()
  player.action = null
  player.stateId = null
  player.phase = null
  player.exiting = false
  player.sequencePlan = null
}

/**
 * Troca de fase dentro do estado. Estado cíclico (faint): `start`
 * terminou → `loop`. Ação com `schedule`: pelo relógio — `start` → `loop`
 * (ou direto `end`, se o loop não cabe) e `loop` → `end` no instante que
 * faz o `end` acabar junto com a ação; sem crossfade, as fases já emendam.
 * Devolve `true` quando trocou de clipe.
 */
export function advanceNativePhase(player, { fade = 0 } = {}) {
  const spec = resolveSpec(player, player.stateId)
  if (!spec) return false

  if (player.sequencePlan) return advanceSequence(player)

  const next = player.schedule
    ? resolveScheduledPhase(player, spec)
    : resolveCyclicPhase(player, spec)
  if (!next) return false

  playPhase(player, next, player.schedule ? 0 : fade)
  return true
}

/** Próximo clipe da lista quando o relógio passa do fim do atual. */
function advanceSequence(player) {
  const { items, boundaries } = player.sequencePlan
  const index = sequenceIndex(player.phase)
  if (index >= items.length - 1 || player.clock < boundaries[index]) {
    return false
  }
  playPhase(player, sequencePhase(index + 1), 0) // clipes já emendam
  return true
}

/**
 * Plano de uma lista `sequence`: só os clipes que existem no `.glb`, cada
 * um tocado uma vez. Com `duration` (ação), `scale` comprime/estica a
 * lista INTEIRA na mesma proporção pra somar exatamente `duration`; sem,
 * na velocidade `speed` do estado. `boundaries[i]` = instante (tempo real, desde a
 * entrada no estado) em que o clipe `i` termina.
 */
function resolveSequencePlan(player, sequence, duration, speed) {
  const items = sequence
    .map(sequenceItem)
    .map(({ animation, frames }) => {
      const clip = resolveClip(player, animation)
      if (!clip) return null
      // Corte por `frames`: o clipe para (e conta) só até esse keyframe.
      const endTime = frames ? resolveFrameTime(clip, frames) : null
      return { name: animation, endTime, length: endTime ?? clip.duration }
    })
    .filter(Boolean)
  const total = items.reduce((sum, item) => sum + item.length, 0)
  const scale = duration > 0 && total > 0 ? total / duration : speed

  let elapsed = 0
  const boundaries = items.map((item) => {
    elapsed += item.length / scale
    return elapsed
  })
  return { items, boundaries, scale }
}

/** Item da lista: `'nome'` ou `{ animation, frames? }`. */
function sequenceItem(item) {
  return typeof item === 'string' ? { animation: item, frames: null } : item
}

const SEQUENCE_PREFIX = 'sequence:'

function sequencePhase(index) {
  return `${SEQUENCE_PREFIX}${index}`
}

function sequenceIndex(phase) {
  return Number(phase.slice(SEQUENCE_PREFIX.length))
}

function isSequencePhase(phase) {
  return typeof phase === 'string' && phase.startsWith(SEQUENCE_PREFIX)
}

function resolveCyclicPhase(player, spec) {
  if (player.phase !== 'start' || !hasFinished(player.action)) return null
  return spec.loop ? 'loop' : null // sem loop: segura o último frame do start
}

function resolveScheduledPhase(player, spec) {
  const { startEndsAt, endStartsAt, loopFits } = player.schedule
  if (player.phase === 'start' && player.clock >= startEndsAt) {
    if (loopFits) return 'loop'
    return spec.end ? 'end' : null
  }
  if (player.phase === 'loop' && spec.end && player.clock >= endStartsAt) {
    return 'end'
  }
  return null
}

/**
 * Encaixa `{ start, loop, end }` de uma ação em `duration`: `start` e
 * `end` na velocidade original e o `loop` preenche o que sobra, com o
 * `end` começando a tempo de acabar junto com a ação. Se `start + end`
 * não cabe, os dois aceleram na mesma proporção (`scale`) e o loop é
 * pulado.
 */
function resolveActionSchedule(player, spec, duration) {
  const startLength = clipLength(player, spec.start)
  const endLength = clipLength(player, spec.end)
  const edges = startLength + endLength
  const fit = edges > 0 ? Math.min(1, duration / edges) : 1
  const startEndsAt = startLength * fit
  const endStartsAt = duration - endLength * fit
  return {
    scale: 1 / fit,
    startEndsAt,
    endStartsAt,
    loopFits:
      Boolean(resolveClip(player, spec.loop)) &&
      endStartsAt - startEndsAt > 1e-3,
  }
}

function clipLength(player, name) {
  return resolveClip(player, name)?.duration ?? 0
}

/**
 * Chamado quando o estado lógico já mudou. Se o estado exibido tem `end`,
 * toca ele (uma vez) e devolve `true` enquanto não terminar — o chamador
 * segura o estado novo até lá. Sem `end` (ou já terminado), `false`.
 */
export function holdNativeExit(player, { fade = 0 } = {}) {
  if (player.phase === 'end') return !hasFinished(player.action)

  const spec = resolveSpec(player, player.stateId)
  if (!spec?.end || !resolveClip(player, spec.end)) return false

  playPhase(player, 'end', fade)
  player.exiting = true
  return true
}

/**
 * Avança o mixer. `animationSpeed` (de `ActionState`, `1/duration`) estica
 * o clipe de ação inteiro pra caber na duração da ação — mesma regra do
 * motor procedural, convertida pra `timeScale` (que multiplica a duração
 * REAL do clipe, não um período normalizado em 1). `direction`
 * (`AnimationState.direction`, -1 = de costas) só vale pra fase que repete.
 */
export function advanceNativeAnimation(
  player,
  delta,
  { animationSpeed, direction },
) {
  if (!player.action) return
  player.clock += delta
  player.action.timeScale = resolveTimeScale(player, animationSpeed, direction)
  player.mixer.update(delta)

  // Corte por `frames`: segura no último frame pedido, não segue pro resto.
  if (player.endTime !== null && player.action.time > player.endTime) {
    player.action.time = player.endTime
    player.action.paused = true
    player.mixer.update(0)
  }

  // Crossfade terminou (peso chegou a 0 → `enabled` falso): solta a ação.
  if (player.fadingOut && !player.fadingOut.enabled) {
    player.fadingOut.stop()
    player.fadingOut = null
  }
}

/**
 * Conta o relógio do piscar (se a espécie tiver) contra o clipe do corpo
 * que está tocando agora — chamar antes de `advanceNativeAnimation`, que
 * é quem aplica a camada no mixer.
 */
export function updateNativeAnimationBlink(player, delta) {
  if (!player.blink || !player.action) return
  updateNativeBlink(player.blink, player.action.getClip(), delta, player.random)
}

/** Fase normalizada (0-1) do clipe atual — relógio pros passos. */
export function nativeCyclePhase(player) {
  if (!player.action) return null
  const duration = player.action.getClip().duration
  if (duration <= 0) return null
  return player.action.time / duration
}

const CLIP_KEYS = ['main', 'start', 'loop', 'end']

function resolveSpec(player, stateId) {
  const value = player.nativeAnimations?.[stateId]
  if (!value) return null
  if (typeof value === 'string') return { main: value }
  if (Array.isArray(value)) return { sequence: value }
  if (value.animation) {
    return { main: value.animation, blend: value.blend, speed: value.speed }
  }
  return value
}

/** `speed` declarado pro estado (ver docstring do player), padrão 1. */
function resolveSpecSpeed(player) {
  return resolveSpec(player, player.stateId)?.speed ?? 1
}

function firstPhase(spec) {
  if (spec.main) return 'main'
  if (spec.start) return 'start'
  return 'loop'
}

function isRepeatingPhase(player, phase) {
  return phase === 'loop' || (phase === 'main' && !player.oneShot)
}

/**
 * Troca o clipe tocando. Com `fade > 0`, o crossfade é feito PELO MIXER
 * (`crossFadeFrom`/`fadeIn`), nunca escrevendo pose nos ossos por fora:
 * o mixer só reescreve um osso quando o valor que ELE calcula muda, então
 * uma pose escrita por fora num osso parado no clipe novo nunca seria
 * corrigida (bug real: trocar de animação no meio de um blink deixava a
 * pálpebra presa semicerrada até o próximo blink). Sem ação anterior
 * (vindo do procedural), `fadeIn` mistura a partir da pose salva quando
 * os ossos entraram no mixer — a que estava na tela.
 */
function playPhase(player, phase, fade = 0) {
  const spec = resolveSpec(player, player.stateId)
  const name = isSequencePhase(phase)
    ? player.sequencePlan?.items[sequenceIndex(phase)]?.name
    : spec?.[phase]
  const clip = resolveClip(player, name)
  if (!clip) {
    stopNativeAnimation(player)
    return
  }

  const action = player.mixer.clipAction(clip)
  const previous = player.action
  if (player.fadingOut === action) player.fadingOut = null
  // Só um crossfade por vez: quem ainda estava saindo sai de vez.
  if (player.fadingOut && player.fadingOut !== previous) {
    player.fadingOut.stop()
    player.fadingOut = null
  }

  const repeating = isRepeatingPhase(player, phase)
  action.reset()
  action.setLoop(repeating ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
  action.clampWhenFinished = !repeating
  action.play()

  if (previous && previous !== action) {
    if (fade > 0) {
      action.crossFadeFrom(previous, fade, false)
      player.fadingOut = previous
    } else {
      previous.stop()
    }
  } else if (!previous && fade > 0) {
    action.fadeIn(fade)
  }

  player.action = action
  player.phase = phase
  player.endTime = resolvePhaseEndTime(player, phase, clip)
}

/** Corte por frames da fase: ação de clipe único ou item da lista. */
function resolvePhaseEndTime(player, phase, clip) {
  if (isSequencePhase(phase)) {
    return player.sequencePlan?.items[sequenceIndex(phase)]?.endTime ?? null
  }
  if (phase === 'main' && player.oneShot && player.frames) {
    return resolveFrameTime(clip, player.frames)
  }
  return null
}

/**
 * Instante do `frames`-ésimo keyframe do clipe (contado na track com mais
 * keyframes — a linha do tempo inteira). Pedido maior que o clipe = o
 * clipe todo.
 */
function resolveFrameTime(clip, frames) {
  let times = null
  for (const track of clip.tracks) {
    if (!times || track.times.length > times.length) times = track.times
  }
  if (!times || frames >= times.length) return null
  return times[Math.max(0, frames - 1)]
}

function resolveTimeScale(player, animationSpeed, direction) {
  if (isSequencePhase(player.phase)) return player.sequencePlan.scale
  if (player.phase === 'main' && player.oneShot) {
    const playedLength = player.endTime ?? player.action.getClip().duration
    return animationSpeed * playedLength
  }
  if (isRepeatingPhase(player, player.phase)) {
    return direction * resolveSpecSpeed(player)
  }
  return player.schedule?.scale ?? resolveSpecSpeed(player)
}

function hasFinished(action) {
  return Boolean(action) && action.time >= action.getClip().duration
}

function resolveClip(player, name) {
  if (!name) return null
  const clip = player.clipsByName.get(name)
  if (!clip) return null
  return withoutRootMotion(clip)
}

function withoutRootMotion(clip) {
  const cached = clipsWithoutRootMotion.get(clip)
  if (cached) return cached

  const hasRootMotion = clip.tracks.some(
    (track) => track.name === ROOT_MOTION_TRACK,
  )
  const result = hasRootMotion
    ? new THREE.AnimationClip(
        clip.name,
        clip.duration,
        clip.tracks.filter((track) => track.name !== ROOT_MOTION_TRACK),
      )
    : clip
  clipsWithoutRootMotion.set(clip, result)
  return result
}
