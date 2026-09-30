import { ActionState, AnimationState } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  isOneShotAnimationState,
  resolveAnimationFallback,
} from '@/core/data/animationStates'
import {
  applyAnimationClip,
  blendFromPose,
  capturePose,
  resolveClipSpeed,
} from '@/core/animation/applyAnimationClip'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'
import {
  advanceNativeAnimation,
  advanceNativePhase,
  enterNativeState,
  hasNativeAnimation,
  holdNativeExit,
  nativeStateBlend,
  nativeCyclePhase,
  stopNativeAnimation,
  updateNativeAnimationBlink,
} from '@/view/animation/nativeAnimationPlayer'

const { BLEND_DURATION } = GAME_CONFIG.ANIMATION

// Estado sem clipe ainda autorado (ex.: uma ação nova, antes do JSON existir
// em core/data/species/<id>/clips/) não deveria congelar no que sobrou do
// clipe anterior — vira "sem override nenhum", que sampleAnimationClip
// resolve como a pose de descanso pura. Mesmo raciocínio do reset-to-rest de
// applyAnimationClip.js, só que pro clipe inteiro faltar, não só um osso.
const EMPTY_CLIP = { bones: {} }

/**
 * Avança o relógio de animação de cada entidade registrada e aplica o clipe
 * procedural correspondente ao AnimationState atual (decidido no core, por
 * animationStateSystem).
 *
 * Troca de estado dispara um crossfade em vez de corte seco: a pose exibida
 * no frame da troca vira uma fotografia estática (`capturePose`), e o clipe
 * novo entra por cima dela ao longo de `BLEND_DURATION` segundos
 * (`blendFromPose`). Uma troca no meio de outra troca fotografa a pose já
 * misturada que está na tela, então nunca há um salto visível.
 *
 * `AnimationState.direction` (1 ou -1 — ver core/traits/components/animation.js)
 * controla pra que lado o relógio do clipe (`entry.elapsed`) avança: -1 faz
 * o mesmo clipe tocar de trás pra frente (aproximação de "andar de costas"
 * sem um clipe dedicado). É o RELÓGIO que inverte, não um multiplicador
 * aplicado só no sample — assim o valor de `elapsed` continua contínuo
 * quando a direção troca no meio do movimento (só a velocidade de
 * progressão muda de sinal), sem o salto que inverter a fase instantânea
 * causaria numa curva senoidal.
 *
 * `entry.elapsed` é um relógio ÚNICO, compartilhado por qualquer clipe que
 * essa entidade toque (não reinicia sozinho ao trocar de id) — pra um
 * ciclo de locomoção (walk/run/idle) isso não importa, não existe "fase
 * certa" de início. Mas um clipe de AÇÃO (`isOneShotAnimationState`, ver
 * core/data/animationStates.js — dash/arremesso hoje) É periódico por
 * construção (a curva fecha na pose inicial), então amostrar num
 * `elapsed` que já está alto de continuar rodando faz o clipe começar NO
 * MEIO do próprio gesto — visualmente, dispara a ação nova e ela primeiro
 * "termina" o que sobrou do gesto anterior antes de recomeçar do início.
 * Por isso, entrar num estado marcado `oneShot` reinicia `entry.elapsed`
 * pra 0 — a ação sempre começa do começo, não importa quando foi
 * disparada em relação ao relógio compartilhado.
 *
 * **Velocidade de playback** — pedido do usuário: "a gente não
 * consegue vincular as ações direto ao tempo da animação?" (antes de
 * colocar o status `speed` na conta). Pra um estado `oneShot` (ação —
 * dash/arremesso/consumo/invocar/recolher/ataque), a velocidade vem de
 * `ActionState.animationSpeed` (`1 / duration`, já calculada por quem
 * disparou a ação — ver docstring do campo, `core/traits/components/
 * action.js`), NÃO de `clip.speed` (o `speed` autorado no JSON do
 * clipe, que existia só pra isso e agora fica sem uso pra estes
 * estados — inofensivo deixar no arquivo, só é ignorado). Pra um
 * estado CÍCLICO (walk/run/idle/fall), nada muda: continua
 * `resolveClipSpeed(clip)` (mesmo `clip.speed || 1` de sempre — só ganha
 * um padrão melhor pra um clipe de KEYFRAMES sem `speed` próprio, ver
 * docstring lá), já que esses não têm uma "ação com duração" por trás —
 * são dirigidos pela velocidade de movimento de verdade, não por isso.
 *
 * **Formato do clipe** (procedural ou keyframes gravados,
 * `core/animation/applyAnimationClip.js`) é transparente aqui — os dois
 * recebem `speed`/`t` do mesmo jeito, e `entry.clips[anim.id]` pode ser
 * de qualquer um dos dois por estado, sem precisar dizer qual é.
 *
 * **Animações embutidas no `.glb`** (`species.nativeAnimations`, ver
 * `view/animation/nativeAnimationPlayer.js`): pro estado que tiver uma,
 * ela toca no lugar do clipe procedural (o `AnimationMixer` escreve nos
 * ossos); sem, cai no procedural de sempre. Crossfade com destino
 * embutido é feito pelo próprio mixer (`crossFadeFrom`/`fadeIn`, ver
 * `playPhase`); com destino procedural, pela fotografia + `blendFromPose`
 * — nunca pose escrita por fora num osso que o mixer controla. Sequência com `end` (faint: levantar) segura o próximo estado
 * CÍCLICO até terminar; um estado de ação interrompe.
 *
 * **Fallback de estado**: estado sem animação na espécie toca a do
 * `fallback` declarado em `core/data/animationStates.js` (battleIdle →
 * idle); trocar entre dois estados que tocam a mesma animação não
 * reinicia nada. **Piscar** (`species.nativeBlink`) é uma camada por cima
 * do corpo no mesmo mixer (`view/animation/nativeBlink.js`), não um estado.
 *
 * **Ação repetida** (ataque logo após ataque): o `AnimationState.id` não
 * muda, então a troca é detectada por `ActionState.elapsed` voltar pra
 * trás — reinicia o gesto (procedural ou embutido) como uma troca normal.
 *
 * Vive na view porque mexe direto nos ossos do objeto Three carregado.
 * Fase: presentation (passo variável).
 */
export function animationSystem(context) {
  const { world, delta } = context

  world.query(AnimationState, ActionState).forEach((entity) => {
    const entry = getAnimatedBonesEntry(entity)
    if (!entry) return

    const anim = entity.get(AnimationState)
    const action = entity.get(ActionState)

    updateShownState(entry, anim.id, action)

    if (entry.native?.action) {
      updateNativeAnimationBlink(entry.native, delta)
      advanceNativeAnimation(entry.native, delta, {
        animationSpeed: action.animationSpeed || 1,
        direction: anim.direction,
      })
      entry.cyclePhase = nativeCyclePhase(entry.native)
    } else {
      applyProceduralClip(entry, anim, action, delta)
      applyPendingBlend(entry, delta)
    }
  })
}

/** Decide qual estado é EXIBIDO neste frame (ver docstring acima). */
function updateShownState(entry, targetId, action) {
  const oneShot = isOneShotAnimationState(targetId)
  const restarted =
    oneShot &&
    targetId === entry.stateId &&
    action.elapsed < entry.lastActionElapsed
  entry.lastActionElapsed = action.elapsed

  const native = entry.native
  if (native) {
    advanceNativePhase(native, { fade: resolveBlend(native, native.stateId) })
  }

  // Voltou pro mesmo estado enquanto o `end` de SAÍDA tocava (desmaiou de
  // novo levantando) — não o `end` de uma ação, que toca dentro do estado.
  const reentering = native?.exiting && targetId === entry.stateId
  if (targetId === entry.stateId && !restarted && !reentering) return

  if (native && !oneShot && !restarted && !reentering && entry.stateId) {
    const fade = resolveBlend(native, native.stateId)
    if (holdNativeExit(native, { fade })) return
  }

  enterState(entry, targetId, {
    oneShot,
    restart: restarted || reentering,
    frames: oneShot ? action.animationFrames : null,
    duration: oneShot ? 1 / (action.animationSpeed || 1) : null,
  })
}

function enterState(entry, stateId, { oneShot, restart, frames, duration }) {
  const clipId = resolveClipId(entry, stateId)
  const previousClipId = entry.clipId
  entry.stateId = stateId

  // Estado novo que toca a MESMA animação (ex.: idle → battleIdle numa
  // espécie sem battleIdle, caindo no fallback idle): nada muda na tela.
  if (clipId === previousClipId && !oneShot && !restart) return

  const hadPrevious = previousClipId !== null
  entry.clipId = clipId
  if (oneShot) entry.elapsed = 0

  // Destino embutido: o crossfade é do próprio mixer (ver `playPhase` em
  // nativeAnimationPlayer.js) — nada de pose escrita por fora nos ossos.
  if (hasNativeAnimation(entry.native, clipId)) {
    entry.blend = null
    enterNativeState(entry.native, clipId, {
      oneShot,
      fade: hadPrevious ? resolveBlend(entry.native, clipId) : 0,
      frames,
      duration,
    })
    return
  }

  // Destino procedural: reescreve todo osso a cada frame, então a mistura
  // por pose (fotografia + `blendFromPose`) é segura aqui.
  if (hadPrevious) startBlend(entry)
  if (entry.native) stopNativeAnimation(entry.native)
}

/**
 * Qual animação toca pro estado: a dele, se a espécie tiver (embutida ou
 * procedural); senão a do `fallback` declarado em `animationStates.js`
 * (ex.: battleIdle → idle); senão o próprio id (pose de descanso).
 */
function resolveClipId(entry, stateId) {
  if (hasAnimation(entry, stateId)) return stateId
  const fallback = resolveAnimationFallback(stateId)
  return fallback && hasAnimation(entry, fallback) ? fallback : stateId
}

function hasAnimation(entry, id) {
  return hasNativeAnimation(entry.native, id) || Boolean(entry.clips?.[id])
}

function applyProceduralClip(entry, anim, action, delta) {
  const authored = entry.clips?.[entry.clipId]
  const clip = authored ?? EMPTY_CLIP
  const speed = isOneShotAnimationState(entry.stateId)
    ? action.animationSpeed || 1
    : resolveClipSpeed(clip)

  entry.elapsed += delta * anim.direction
  applyAnimationClip(clip, entry.bones, entry.elapsed, speed)

  const progress = entry.elapsed * speed
  entry.cyclePhase = authored ? progress - Math.floor(progress) : null
}

/**
 * Crossfade (s) pra entrar no estado `stateId` da animação embutida: o
 * `blend` declarado nele (`species.nativeAnimations`), ou o global.
 */
function resolveBlend(native, stateId) {
  return nativeStateBlend(native, stateId) ?? BLEND_DURATION
}

function startBlend(entry) {
  entry.blend = { fromPose: capturePose(entry.bones), elapsed: 0 }
}

function applyPendingBlend(entry, delta) {
  if (!entry.blend) return

  entry.blend.elapsed += delta
  if (entry.blend.elapsed >= BLEND_DURATION) {
    entry.blend = null
    return
  }

  blendFromPose(
    entry.blend.fromPose,
    entry.bones,
    entry.blend.elapsed / BLEND_DURATION,
  )
}
