import { ActionState, AnimationState } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { isOneShotAnimationState } from '@/core/data/animationStates'
import {
  applyAnimationClip,
  applyBlendedAnimationClip,
  capturePose,
} from '@/core/animation/applyAnimationClip'
import { getAnimatedBonesEntry } from '@/view/registry/animationRegistry'

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
 * (`applyBlendedAnimationClip`). Uma troca no meio de outra troca só atualiza
 * o alvo — a fotografia de partida continua sendo a mesma da troca anterior,
 * então nunca há um salto visível, só uma curva de mistura mais curta.
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
 * estado CÍCLICO (walk/run/idle/fall), nada muda: continua `clip.speed
 * || 1`, já que esses não têm uma "ação com duração" por trás — são
 * dirigidos pela velocidade de movimento de verdade, não por isso.
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
    const clip = entry.clips[anim.id] ?? EMPTY_CLIP
    const oneShot = isOneShotAnimationState(anim.id)
    const speed = oneShot ? action.animationSpeed || 1 : clip.speed || 1

    entry.elapsed += delta * anim.direction

    if (entry.stateId === null) {
      entry.stateId = anim.id
      if (oneShot) entry.elapsed = 0
    } else if (anim.id !== entry.stateId) {
      entry.blend = { fromPose: capturePose(entry.bones), elapsed: 0 }
      entry.stateId = anim.id
      if (oneShot) entry.elapsed = 0
    }

    if (!entry.blend) {
      applyAnimationClip(clip, entry.bones, entry.elapsed, speed)
      return
    }

    entry.blend.elapsed += delta
    if (entry.blend.elapsed >= BLEND_DURATION) {
      entry.blend = null
      applyAnimationClip(clip, entry.bones, entry.elapsed, speed)
      return
    }

    const alpha = entry.blend.elapsed / BLEND_DURATION
    applyBlendedAnimationClip(
      entry.blend.fromPose,
      clip,
      entry.bones,
      entry.elapsed,
      alpha,
      speed,
    )
  })
}
