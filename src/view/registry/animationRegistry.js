/**
 * Registro entidade → ossos resolvidos + clipes de animação procedural.
 * Mesmo padrão do viewRegistry: o componente registra no useEffect, o
 * animationSystem lê e aplica o clipe.
 *
 * `clips` mapeia o id de AnimationState (core/data/animationStates.js) para o
 * clipe JSON daquela espécie (core/data/species). `elapsed` é o relógio de
 * animação da entidade, avançado pelo animationSystem a cada frame — cada
 * entidade tem o seu, independente das outras.
 *
 * `native` é o player das animações embutidas no `.glb`
 * (`view/animation/nativeAnimationPlayer.js`), ou `null` pra espécie sem
 * `nativeAnimations` — criado e descartado por quem registra
 * (`useAnimatedModel.js`), não por este registry.
 *
 * `stateId` guarda o AnimationState.id EXIBIDO (pode ficar atrás do
 * lógico enquanto o `end` de uma sequência embutida toca); `clipId`, o id
 * cuja animação está tocando (difere de `stateId` quando o estado caiu no
 * `fallback`, ex.: battleIdle → idle). `blend`, quando
 * não nulo, é o crossfade em andamento (`{ fromPose, elapsed }` — ver
 * core/animation/applyAnimationClip.js). `lastActionElapsed` detecta uma
 * ação nova do MESMO tipo (ataque seguido de ataque). `cyclePhase` (0-1,
 * ou `null` sem animação) é a fase do clipe exibido, lida pelos passos.
 *
 * Dono de escrita dos campos mutáveis: `animationSystem.js`.
 */
const entries = new Map()

export function registerAnimatedBones(entity, { bones, clips, native = null }) {
  entries.set(entity, {
    bones,
    clips,
    native,
    elapsed: 0,
    stateId: null,
    clipId: null,
    blend: null,
    lastActionElapsed: 0,
    cyclePhase: null,
  })
}

export function unregisterAnimatedBones(entity) {
  entries.delete(entity)
}

export function getAnimatedBonesEntry(entity) {
  return entries.get(entity)
}
