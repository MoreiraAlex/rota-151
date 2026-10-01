import { describe, it, expect, afterEach } from 'vitest'
import { createWorld } from 'koota'
import * as THREE from 'three'
import { ActionState, AnimationState } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolveBones } from '@/core/animation/resolveBones'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
  getAnimatedBonesEntry,
} from '@/view/registry/animationRegistry'
import { createNativeAnimationPlayer } from '@/view/animation/nativeAnimationPlayer'
import { clearHitStops, startHitStop } from '@/view/registry/hitStopRegistry'
import { animationSystem } from './animationSystem'

const { BLEND_DURATION } = GAME_CONFIG.ANIMATION

function hipY(name, duration, from, to) {
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack(
      'hip.position',
      [0, duration],
      [0, from, 0, 0, to, 0],
    ),
  ])
}

const ANIMATIONS = [
  hipY('idle', 1, 0, 0),
  hipY('attack', 1, 0, 1),
  hipY('down_start', 0.5, 0, -1),
  hipY('down_loop', 1, -1, -1),
  hipY('down_end', 0.5, -1, 0),
]

// `walk` só tem clipe procedural — mistura dos dois motores na mesma
// entidade, o caso real enquanto nem todo estado tem animação embutida.
const PROCEDURAL_CLIPS = {
  walk: {
    speed: 2,
    bones: { hip: { position: { x: { type: 'sine', amplitude: 1 } } } },
  },
}

function setup(world) {
  const root = new THREE.Object3D()
  const hip = new THREE.Bone()
  hip.name = 'hip'
  root.add(hip)

  const native = createNativeAnimationPlayer(root, ANIMATIONS, {
    idle: 'idle',
    attack: 'attack',
    faint: { start: 'down_start', loop: 'down_loop', end: 'down_end' },
  })
  const entity = world.spawn(AnimationState, ActionState)
  registerAnimatedBones(entity, {
    bones: resolveBones({ bones: [hip] }),
    clips: PROCEDURAL_CLIPS,
    native,
  })
  return { entity, hip, native, entry: getAnimatedBonesEntry(entity) }
}

function ctxClipName(native) {
  return native.action?.getClip().name
}

function tick(world, delta = 0.1) {
  animationSystem({ world, delta })
}

describe('animationSystem — animações embutidas', () => {
  let world
  let entity

  afterEach(() => {
    if (entity) unregisterAnimatedBones(entity)
    world?.destroy()
  })

  it('faint: deita, fica deitada enquanto o estado durar, levanta antes do próximo estado', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'faint' })
    tick(world)
    expect(ctx.native.phase).toBe('start')

    for (let i = 0; i < 30; i++) tick(world)
    expect(ctx.native.phase).toBe('loop')
    expect(ctx.hip.position.y).toBeCloseTo(-1)

    // Acordou: o lógico já é idle, mas o exibido segura até o end acabar.
    entity.set(AnimationState, { id: 'idle' })
    tick(world)
    expect(ctx.entry.stateId).toBe('faint')
    expect(ctx.native.phase).toBe('end')

    for (let i = 0; i < 6; i++) tick(world)
    expect(ctx.entry.stateId).toBe('idle')
    expect(ctx.native.stateId).toBe('idle')
  })

  it('uma ação interrompe o end na hora', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'faint' })
    for (let i = 0; i < 10; i++) tick(world)
    entity.set(AnimationState, { id: 'idle' })
    tick(world)
    expect(ctx.native.phase).toBe('end')

    entity.set(AnimationState, { id: 'attack' })
    tick(world)
    expect(ctx.entry.stateId).toBe('attack')
  })

  it('desmaiar de novo durante o end recomeça a sequência', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'faint' })
    for (let i = 0; i < 10; i++) tick(world)
    entity.set(AnimationState, { id: 'idle' })
    tick(world)
    entity.set(AnimationState, { id: 'faint' })
    tick(world)

    expect(ctx.native.phase).toBe('start')
  })

  it('ataque logo após ataque (mesmo AnimationState.id) recomeça o gesto', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'attack' })
    entity.set(ActionState, {
      current: 'attack',
      elapsed: 0,
      animationSpeed: 1,
    })
    tick(world)
    entity.set(ActionState, { elapsed: 0.9 })
    for (let i = 0; i < 9; i++) tick(world)
    expect(ctx.native.action.time).toBeGreaterThan(0.8)

    entity.set(ActionState, { elapsed: 0 }) // ação nova disparada
    tick(world)
    expect(ctx.native.action.time).toBeCloseTo(0.1)
  })

  it('estado sem animação embutida para o mixer e cai no clipe procedural', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'idle' })
    tick(world)
    expect(ctx.native.action).not.toBeNull()

    entity.set(AnimationState, { id: 'walk' })
    tick(world)
    expect(ctx.native.action).toBeNull()

    // Depois do crossfade, só o procedural escreve.
    for (let i = 0; i < Math.ceil(BLEND_DURATION / 0.05) + 1; i++) {
      tick(world, 0.05)
    }
    const expectedX = Math.sin(2 * Math.PI * 2 * ctx.entry.elapsed)
    expect(ctx.hip.position.x).toBeCloseTo(expectedX)
  })

  it('battleIdle sem animação própria toca a idle, sem reiniciar nem fazer crossfade', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'idle' })
    for (let i = 0; i < 5; i++) tick(world)
    const idleAction = ctx.native.action
    const timeBefore = idleAction.time

    entity.set(AnimationState, { id: 'battleIdle' })
    tick(world)

    expect(ctx.entry.stateId).toBe('battleIdle')
    expect(ctx.entry.clipId).toBe('idle')
    expect(ctx.native.action).toBe(idleAction)
    expect(idleAction.time).toBeCloseTo(timeBefore + 0.1)
    expect(ctx.entry.blend).toBeNull()
  })

  it('troca entre animações embutidas não deixa osso PARADO preso numa pose intermediária', () => {
    // Regressão: o crossfade escrevia pose por fora do mixer, e o mixer só
    // reescreve um osso quando o valor que ele calcula muda — num osso
    // parado no clipe novo, sobrava a última pose do crossfade (pálpebra
    // semicerrada depois de trocar de animação no meio de um blink).
    world = createWorld()
    const root = new THREE.Object3D()
    const hip = new THREE.Bone()
    hip.name = 'hip'
    root.add(hip)
    const native = createNativeAnimationPlayer(
      root,
      [hipY('idle', 1, 1, 1), hipY('attack', 1, 0, 0)],
      { idle: 'idle', attack: 'attack' },
    )
    entity = world.spawn(AnimationState, ActionState)
    registerAnimatedBones(entity, {
      bones: resolveBones({ bones: [hip] }),
      clips: {},
      native,
    })

    tick(world)
    expect(hip.position.y).toBeCloseTo(1)

    entity.set(AnimationState, { id: 'attack' })
    entity.set(ActionState, {
      current: 'attack',
      elapsed: 0,
      animationSpeed: 1,
    })
    for (let i = 0; i < 20; i++) tick(world, 0.05)

    expect(hip.position.y).toBeCloseTo(0, 5)
  })

  it('ataque com start/loop/end toca a sequência UMA vez, encaixada na duração da ação', () => {
    // Regressão: ao passar pro `end` dentro da ação, a regra do faint
    // ("no end e voltou pro mesmo estado = desmaiou de novo") reiniciava o
    // ataque — a sequência repetia 3-4x dentro de um ataque de 2s.
    world = createWorld()
    const root = new THREE.Object3D()
    const hip = new THREE.Bone()
    hip.name = 'hip'
    root.add(hip)
    const native = createNativeAnimationPlayer(
      root,
      [
        hipY('aStart', 0.5, 0, 1),
        hipY('aLoop', 0.3, 1, 1),
        hipY('aEnd', 0.5, 1, 0),
      ],
      { attack: { start: 'aStart', loop: 'aLoop', end: 'aEnd' } },
    )
    entity = world.spawn(AnimationState, ActionState)
    registerAnimatedBones(entity, {
      bones: resolveBones({ bones: [hip] }),
      clips: {},
      native,
    })
    tick(world)

    const duration = 2
    const dt = 1 / 60
    entity.set(AnimationState, { id: 'attack' })
    entity.set(ActionState, {
      current: 'attack',
      elapsed: 0,
      animationSpeed: 1 / duration,
    })

    const phases = []
    for (let t = 0; t < duration - dt / 2; t += dt) {
      entity.set(ActionState, { elapsed: t })
      tick(world, dt)
      if (phases.at(-1) !== native.phase) phases.push(native.phase)
    }

    expect(phases).toEqual(['start', 'loop', 'end'])
    expect(hip.position.y).toBeCloseTo(0, 1) // terminou no fim do `end`
  })

  it('`blend` do estado controla a duração do crossfade ao entrar nele', () => {
    world = createWorld()
    const root = new THREE.Object3D()
    const hip = new THREE.Bone()
    hip.name = 'hip'
    root.add(hip)
    const native = createNativeAnimationPlayer(
      root,
      [
        hipY('idle', 1, 0, 0),
        hipY('jumpLoop', 1, 1, 1),
        hipY('fallLoop', 1, 2, 2),
      ],
      {
        idle: 'idle',
        jump: 'jumpLoop', // sem blend → global
        fall: { animation: 'fallLoop', blend: 0.5 },
      },
    )
    entity = world.spawn(AnimationState, ActionState)
    registerAnimatedBones(entity, {
      bones: resolveBones({ bones: [hip] }),
      clips: {},
      native,
    })
    tick(world)

    // idle → jump: global (BLEND_DURATION) — já terminou depois dele.
    entity.set(AnimationState, { id: 'jump' })
    for (let t = 0; t < BLEND_DURATION + 0.05; t += 0.05) tick(world, 0.05)
    expect(hip.position.y).toBeCloseTo(1)

    // jump → fall com blend 0.5: na metade, ainda misturando.
    entity.set(AnimationState, { id: 'fall' })
    for (let i = 0; i < 5; i++) tick(world, 0.05) // 0.25s
    expect(hip.position.y).toBeGreaterThan(1.2)
    expect(hip.position.y).toBeLessThan(1.8)

    for (let i = 0; i < 6; i++) tick(world, 0.05) // passou de 0.5s
    expect(hip.position.y).toBeCloseTo(2)
  })

  it('ActionState.animationKey troca a animação do ataque (ex.: skill à distância), com fallback pra `attack`', () => {
    world = createWorld()
    const root = new THREE.Object3D()
    const hip = new THREE.Bone()
    hip.name = 'hip'
    root.add(hip)
    const native = createNativeAnimationPlayer(
      root,
      [hipY('idle', 1, 0, 0), hipY('attack', 1, 1, 1), hipY('ranged', 1, 2, 2)],
      { idle: 'idle', attack: 'attack', attackRanged: 'ranged' },
    )
    entity = world.spawn(AnimationState, ActionState)
    registerAnimatedBones(entity, {
      bones: resolveBones({ bones: [hip] }),
      clips: {},
      native,
    })
    tick(world)

    entity.set(AnimationState, { id: 'attack' })
    entity.set(ActionState, {
      current: 'attack',
      elapsed: 0,
      animationSpeed: 1,
      animationKey: 'attackRanged',
    })
    tick(world)
    expect(ctxClipName(native)).toBe('ranged')

    // Ataque seguinte sem chave própria que a espécie tenha → `attack`.
    entity.set(ActionState, { elapsed: 0, animationKey: 'nao-existe' })
    entity.set(AnimationState, { id: 'idle' })
    tick(world)
    entity.set(AnimationState, { id: 'attack' })
    tick(world)
    expect(ctxClipName(native)).toBe('attack')
  })

  it('hit stop congela o relógio da animação da entidade enquanto durar', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'idle' })
    tick(world, 0.1)
    const timeBefore = ctx.native.action.time

    startHitStop(entity, 0.15)
    tick(world, 0.1)
    expect(ctx.native.action.time).toBeCloseTo(timeBefore)

    clearHitStops()
    tick(world, 0.1)
    expect(ctx.native.action.time).toBeCloseTo(timeBefore + 0.1)
  })

  it('cyclePhase vem do motor que estiver tocando (pros passos)', () => {
    world = createWorld()
    const ctx = setup(world)
    entity = ctx.entity

    entity.set(AnimationState, { id: 'idle' })
    tick(world, 0.25)
    expect(ctx.entry.cyclePhase).toBeCloseTo(0.25)

    entity.set(AnimationState, { id: 'walk' })
    tick(world, 0.1)
    // procedural: fase = elapsed * speed, módulo 1
    const progress = ctx.entry.elapsed * 2
    expect(ctx.entry.cyclePhase).toBeCloseTo(progress - Math.floor(progress))
  })
})
