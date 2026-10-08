import * as THREE from 'three'
import { resolveClipTimeScale } from './captureBallMotion'

/**
 * Toca um clipe do `.glb` de uma Pokébola (docs/features/043-captura.md) —
 * a de captura, a do invocar e a da mão. `entry` guarda, entre frames,
 * `model` (de `ItemModel` → `onModel`: `root` + `animations`), o `mixer` e o
 * `clip` tocando (a `key` do plano).
 *
 * `plan`: `{ key, name, loop, fitTo, onlyShrink }` — recomeça quando a `key`
 * muda; repete ou para no fim; velocidade que encaixa o clipe em `fitTo`
 * segundos (`resolveClipTimeScale`). Sem plano (ou sem o clipe no `.glb`),
 * para tudo e o modelo volta à pose dele. Devolve se tem clipe tocando.
 * Quem chama avança o `entry.mixer` com o delta do frame.
 */
export function playBallClip(entry, plan) {
  const model = entry.model
  const clip = plan && model?.animations?.find((c) => c.name === plan.name)
  if (!clip) {
    if (entry.clip) {
      entry.mixer?.stopAllAction()
      entry.clip = null
    }
    return false
  }
  if (entry.clip === plan.key) return true

  entry.mixer ??= new THREE.AnimationMixer(model.root)
  entry.mixer.stopAllAction()
  const action = entry.mixer.clipAction(clip)
  action.reset()
  action.setLoop(plan.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
  action.clampWhenFinished = !plan.loop
  action.timeScale = resolveClipTimeScale(
    clip.duration,
    plan.fitTo,
    plan.onlyShrink,
  )
  action.play()
  entry.clip = plan.key
  return true
}

/** Troca o modelo do `entry` (carregou, ou descarregou com `null`). */
export function setBallClipModel(entry, model) {
  entry.mixer?.stopAllAction()
  entry.model = model
  entry.mixer = null
  entry.clip = null
}
