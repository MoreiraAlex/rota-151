import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  advanceNativeAnimation,
  advanceNativePhase,
  createNativeAnimationPlayer,
  disposeNativeAnimationPlayer,
  enterNativeState,
  hasNativeAnimation,
  holdNativeExit,
  nativeCyclePhase,
  stopNativeAnimation,
} from './nativeAnimationPlayer'

// Rig mínimo no formato dos `.glb` ripados: um osso animado (`hip`) e o
// nó de root motion (`origin`).
function makeRig() {
  const root = new THREE.Object3D()
  const hip = new THREE.Bone()
  hip.name = 'hip'
  const origin = new THREE.Bone()
  origin.name = 'origin'
  root.add(origin)
  origin.add(hip)
  return { root, hip, origin }
}

function positionTrack(name, times, values) {
  return new THREE.VectorKeyframeTrack(`${name}.position`, times, values)
}

function hipY(name, duration, from, to) {
  return new THREE.AnimationClip(name, duration, [
    positionTrack('hip', [0, duration], [0, from, 0, 0, to, 0]),
  ])
}

function makeAnimations() {
  return [
    new THREE.AnimationClip('walk', 1, [
      positionTrack('hip', [0, 1], [0, 0, 0, 1, 0, 0]),
      positionTrack('origin', [0, 1], [0, 0, 0, 0, 0, 1]),
    ]),
    hipY('attack', 2, 0, 2),
    hipY('down_start', 0.5, 0, -1),
    hipY('down_loop', 1, -1, -1),
    hipY('down_end', 0.5, -1, 0),
  ]
}

const NATIVE_ANIMATIONS = {
  walk: 'walk',
  attack: 'attack',
  faint: { start: 'down_start', loop: 'down_loop', end: 'down_end' },
  combo: { start: 'down_start', loop: 'down_loop', end: 'down_end' },
  typo: 'nao-existe',
}

function makePlayer() {
  const rig = makeRig()
  const animations = makeAnimations()
  const player = createNativeAnimationPlayer(
    rig.root,
    animations,
    NATIVE_ANIMATIONS,
  )
  return { ...rig, animations, player }
}

const CYCLIC = { animationSpeed: 1, direction: 1 }

describe('nativeAnimationPlayer', () => {
  it('descarta o root motion (origin.position) sem mexer no clipe original do cache', () => {
    const { player, hip, origin, animations } = makePlayer()

    enterNativeState(player, 'walk', { oneShot: false })
    advanceNativeAnimation(player, 0.5, CYCLIC)

    expect(hip.position.x).toBeCloseTo(0.5)
    expect(origin.position.z).toBe(0)
    expect(animations[0].tracks).toHaveLength(2)
  })

  it('estado cíclico repete e a fase normalizada acompanha o tempo', () => {
    const { player } = makePlayer()

    enterNativeState(player, 'walk', { oneShot: false })
    advanceNativeAnimation(player, 1.25, CYCLIC)

    expect(nativeCyclePhase(player)).toBeCloseTo(0.25)
  })

  it('direction -1 toca o ciclo de trás pra frente', () => {
    const { player } = makePlayer()

    enterNativeState(player, 'walk', { oneShot: false })
    advanceNativeAnimation(player, 0.25, { animationSpeed: 1, direction: -1 })

    expect(nativeCyclePhase(player)).toBeCloseTo(0.75)
  })

  it('ação estica o clipe inteiro pra caber na duração da ação (animationSpeed = 1/duration)', () => {
    // Clipe de 2s, ação de 0.5s → na metade da ação, metade do clipe.
    const { player, hip } = makePlayer()
    const speed = { animationSpeed: 1 / 0.5, direction: 1 }

    enterNativeState(player, 'attack', { oneShot: true })
    advanceNativeAnimation(player, 0.25, speed)
    expect(player.action.time).toBeCloseTo(1)

    advanceNativeAnimation(player, 0.5, speed)
    expect(player.action.time).toBeCloseTo(2) // segura o último frame
    expect(hip.position.y).toBeCloseTo(2)
  })

  it('frames: toca só os N primeiros keyframes, esticados pra caber na ação, e segura ali', () => {
    // Clipe de 2s com 5 keyframes (0, .5, 1, 1.5, 2) → 3 frames = até 1s.
    const rig = makeRig()
    const attack = new THREE.AnimationClip('attack', 2, [
      positionTrack(
        'hip',
        [0, 0.5, 1, 1.5, 2],
        [0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0],
      ),
    ])
    const player = createNativeAnimationPlayer(rig.root, [attack], {
      attack: 'attack',
    })
    const speed = { animationSpeed: 1 / 0.5, direction: 1 } // ação de 0.5s

    enterNativeState(player, 'attack', { oneShot: true, frames: 3 })
    advanceNativeAnimation(player, 0.25, speed)
    expect(player.action.time).toBeCloseTo(0.5) // metade da ação = metade do trecho

    advanceNativeAnimation(player, 0.5, speed)
    expect(player.action.time).toBeCloseTo(1)
    expect(rig.hip.position.y).toBeCloseTo(2) // frame 3, não o final (4)
  })

  it('frames ausente ou maior que o clipe = clipe inteiro', () => {
    const { player } = makePlayer()
    const speed = { animationSpeed: 1 / 0.5, direction: 1 }

    enterNativeState(player, 'attack', { oneShot: true, frames: 999 })
    advanceNativeAnimation(player, 0.25, speed)

    expect(player.action.time).toBeCloseTo(1) // clipe de 2s, metade
  })

  it('reentrar na mesma ação recomeça do início', () => {
    const { player } = makePlayer()

    enterNativeState(player, 'attack', { oneShot: true })
    advanceNativeAnimation(player, 1, CYCLIC)
    enterNativeState(player, 'attack', { oneShot: true })

    expect(player.action.time).toBe(0)
  })

  it('sequência: start toca uma vez, depois loop repete enquanto durar', () => {
    const { player } = makePlayer()

    enterNativeState(player, 'faint', { oneShot: false })
    expect(player.phase).toBe('start')

    advanceNativeAnimation(player, 0.3, CYCLIC)
    expect(advanceNativePhase(player)).toBe(false)

    advanceNativeAnimation(player, 0.3, CYCLIC)
    expect(advanceNativePhase(player)).toBe(true)
    expect(player.phase).toBe('loop')

    for (let i = 0; i < 5; i++) {
      advanceNativeAnimation(player, 0.7, CYCLIC)
      expect(advanceNativePhase(player)).toBe(false)
    }
    expect(player.phase).toBe('loop')
  })

  it('sequência: ao sair, segura até o end terminar', () => {
    const { player, hip } = makePlayer()
    enterNativeState(player, 'faint', { oneShot: false })
    advanceNativeAnimation(player, 0.6, CYCLIC)
    advanceNativePhase(player)

    expect(holdNativeExit(player)).toBe(true)
    expect(player.phase).toBe('end')

    advanceNativeAnimation(player, 0.25, CYCLIC)
    expect(holdNativeExit(player)).toBe(true)

    advanceNativeAnimation(player, 0.3, CYCLIC)
    expect(holdNativeExit(player)).toBe(false)
    expect(hip.position.y).toBeCloseTo(0)
  })

  it('estado sem end não segura a saída', () => {
    const { player } = makePlayer()
    enterNativeState(player, 'walk', { oneShot: false })

    expect(holdNativeExit(player)).toBe(false)
  })

  it('só reconhece estado com nome que existe no .glb', () => {
    const { player } = makePlayer()

    expect(hasNativeAnimation(player, 'walk')).toBe(true)
    expect(hasNativeAnimation(player, 'faint')).toBe(true)
    expect(hasNativeAnimation(player, 'typo')).toBe(false)
    expect(hasNativeAnimation(player, 'run')).toBe(false)
  })

  it('stop e dispose param o que está tocando', () => {
    const { player } = makePlayer()
    enterNativeState(player, 'walk', { oneShot: false })
    const action = player.action

    stopNativeAnimation(player)
    expect(player.action).toBeNull()
    expect(action.isRunning()).toBe(false)

    enterNativeState(player, 'walk', { oneShot: false })
    disposeNativeAnimationPlayer(player)
    expect(player.action.isRunning()).toBe(false)
  })
})

describe('nativeAnimationPlayer — sequência numa ação respeita duration', () => {
  // start 0.5s, loop 1s, end 0.5s (ver makeAnimations).
  function runAction(duration) {
    const { player, hip } = makePlayer()
    const speed = { animationSpeed: 1 / duration, direction: 1 }
    const phases = []
    enterNativeState(player, 'combo', { oneShot: true, duration })
    const dt = 1 / 100
    for (let t = 0; t < duration - 1e-9; t += dt) {
      advanceNativePhase(player)
      advanceNativeAnimation(player, dt, speed)
      phases.push(player.phase)
    }
    return { player, hip, phases }
  }

  it('com folga: start e end na velocidade original, loop preenche o meio, end acaba junto com a ação', () => {
    const { player, hip, phases } = runAction(3)

    expect(phases[10]).toBe('start') // t=0.1
    expect(phases[100]).toBe('loop') // t=1.0
    expect(phases[260]).toBe('end') // t=2.6 (end começa em 3 - 0.5)
    expect(player.action.time).toBeCloseTo(0.5, 1) // end inteiro tocado
    expect(hip.position.y).toBeCloseTo(0, 1) // pose final do end
  })

  it('sem folga (duration < start + end): acelera start e end na mesma proporção e pula o loop', () => {
    // 0.5s pra 1s de start+end → 2x mais rápido: start até 0.25, end até 0.5.
    const { player, phases } = runAction(0.5)

    expect(phases).not.toContain('loop')
    expect(phases[10]).toBe('start') // t=0.1
    expect(phases[35]).toBe('end') // t=0.35
    expect(player.action.time).toBeCloseTo(0.5, 1) // end inteiro, comprimido
  })

  it('estado cíclico com sequência (faint) continua sem prazo: loop até o estado sair', () => {
    const { player } = makePlayer()
    enterNativeState(player, 'faint', { oneShot: false, duration: 1 })

    expect(player.schedule).toBeNull()
  })
})

describe('nativeAnimationPlayer — lista `sequence` (cada clipe uma vez)', () => {
  // down_start 0.5s + down_loop 1s + down_end 0.5s = 2s de clipe.
  function makeSequencePlayer(spec) {
    const rig = makeRig()
    const player = createNativeAnimationPlayer(rig.root, makeAnimations(), {
      dash: spec,
    })
    return { player, hip: rig.hip }
  }

  function run(player, duration, seconds) {
    const speed = { animationSpeed: 1 / duration, direction: 1 }
    const phases = []
    const dt = 1 / 100
    for (let t = 0; t < seconds - 1e-9; t += dt) {
      advanceNativePhase(player)
      advanceNativeAnimation(player, dt, speed)
      if (phases.at(-1) !== player.phase) phases.push(player.phase)
    }
    return phases
  }

  it('numa ação, toca os três uma vez, esticados na mesma proporção pra caber em duration', () => {
    // 2s de clipe em 4s de ação → metade da velocidade: 0-1, 1-3, 3-4.
    const { player, hip } = makeSequencePlayer({
      sequence: ['down_start', 'down_loop', 'down_end'],
    })
    enterNativeState(player, 'dash', { oneShot: true, duration: 4 })

    const phases = run(player, 4, 4)

    expect(phases).toEqual(['sequence:0', 'sequence:1', 'sequence:2'])
    expect(player.action.getClip().name).toBe('down_end')
    expect(player.action.time).toBeCloseTo(0.5, 1) // terminou o último
    expect(hip.position.y).toBeCloseTo(0, 1)
  })

  it('o do meio NÃO repete — cada clipe toca uma vez só', () => {
    const { player } = makeSequencePlayer([
      'down_start',
      'down_loop',
      'down_end',
    ]) // forma array
    enterNativeState(player, 'dash', { oneShot: true, duration: 4 })

    run(player, 4, 2.5) // no meio do `down_loop` esticado (1s → 2s reais)
    expect(player.action.getClip().name).toBe('down_loop')
    expect(player.action.time).toBeCloseTo(0.75, 1) // 1.5s reais × 0.5
  })

  it('ignora nome que não existe no .glb, sem quebrar', () => {
    const { player } = makeSequencePlayer({
      sequence: ['down_start', 'nao-existe', 'down_end'],
    })
    enterNativeState(player, 'dash', { oneShot: true, duration: 1 })

    const phases = run(player, 1, 1)

    expect(phases).toEqual(['sequence:0', 'sequence:1'])
    expect(player.action.getClip().name).toBe('down_end')
  })

  it('item `{ animation, frames }` toca só os N primeiros keyframes e o corte entra no esticamento', () => {
    // Clipe de 1s com 5 keyframes (0, .25, .5, .75, 1):
    const rig = makeRig()
    const land = new THREE.AnimationClip('land', 1, [
      positionTrack(
        'hip',
        [0, 0.25, 0.5, 0.75, 1],
        [0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0],
      ),
    ])
    const player = createNativeAnimationPlayer(
      rig.root,
      [...makeAnimations(), land],
      { dash: { sequence: ['down_start', { animation: 'land', frames: 3 }] } },
    )
    // down_start 0.5s + land cortado em 0.5s (frame 3 = t 0.5) = 1s de
    // clipe numa ação de 1s → velocidade original.
    enterNativeState(player, 'dash', { oneShot: true, duration: 1 })

    const phases = run(player, 1, 1)

    expect(phases).toEqual(['sequence:0', 'sequence:1'])
    expect(player.action.time).toBeCloseTo(0.5, 1) // parou no frame 3
    expect(rig.hip.position.y).toBeCloseTo(2, 1) // não seguiu pro resto
  })
})

describe('nativeAnimationPlayer — `speed` do estado', () => {
  function makeSpeedPlayer(nativeAnimations) {
    const rig = makeRig()
    const player = createNativeAnimationPlayer(
      rig.root,
      makeAnimations(),
      nativeAnimations,
    )
    return { player, hip: rig.hip }
  }

  function run(player, seconds, speed = CYCLIC) {
    const dt = 1 / 100
    for (let t = 0; t < seconds - 1e-9; t += dt) {
      advanceNativePhase(player)
      advanceNativeAnimation(player, dt, speed)
    }
  }

  it('estado cíclico toca na velocidade pedida (e os passos acompanham)', () => {
    const { player } = makeSpeedPlayer({
      walk: { animation: 'walk', speed: 2 },
    })
    enterNativeState(player, 'walk', { oneShot: false })

    advanceNativeAnimation(player, 0.25, CYCLIC)

    expect(nativeCyclePhase(player)).toBeCloseTo(0.5)
  })

  it('de costas, na mesma velocidade pedida', () => {
    const { player } = makeSpeedPlayer({
      walk: { animation: 'walk', speed: 2 },
    })
    enterNativeState(player, 'walk', { oneShot: false })

    advanceNativeAnimation(player, 0.125, { animationSpeed: 1, direction: -1 })

    expect(nativeCyclePhase(player)).toBeCloseTo(0.75)
  })

  it('numa ação, a duração manda: clipe único ignora o speed', () => {
    // Clipe de 2s, ação de 0.5s → na metade da ação, metade do clipe.
    const { player } = makeSpeedPlayer({
      attack: { animation: 'attack', speed: 3 },
    })
    enterNativeState(player, 'attack', { oneShot: true })

    advanceNativeAnimation(player, 0.25, { animationSpeed: 2, direction: 1 })

    expect(player.action.time).toBeCloseTo(1)
  })

  it('start/loop fora de ação (faint): start acelera e o loop entra antes', () => {
    // down_start 0.5s a 2x → acaba em 0.25s.
    const { player } = makeSpeedPlayer({
      faint: {
        start: 'down_start',
        loop: 'down_loop',
        end: 'down_end',
        speed: 2,
      },
    })
    enterNativeState(player, 'faint', { oneShot: false })

    run(player, 0.3)

    expect(player.phase).toBe('loop')
  })

  it('lista `sequence` fora de ação: cada clipe na velocidade pedida', () => {
    // down_start 0.5s a 2x → o segundo começa em 0.25s.
    const { player } = makeSpeedPlayer({
      dash: { sequence: ['down_start', 'down_loop'], speed: 2 },
    })
    enterNativeState(player, 'dash', { oneShot: false })

    run(player, 0.2)
    expect(player.phase).toBe('sequence:0')
    run(player, 0.1)
    expect(player.phase).toBe('sequence:1')
  })

  it('sem speed, velocidade original', () => {
    const { player } = makeSpeedPlayer({ walk: { animation: 'walk' } })
    enterNativeState(player, 'walk', { oneShot: false })

    advanceNativeAnimation(player, 0.25, CYCLIC)

    expect(nativeCyclePhase(player)).toBeCloseTo(0.25)
  })
})
