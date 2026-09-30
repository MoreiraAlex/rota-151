import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  advanceNativeAnimation,
  createNativeAnimationPlayer,
  enterNativeState,
  updateNativeAnimationBlink,
} from './nativeAnimationPlayer'

// Rig mínimo: uma pálpebra (`lid`, gira em X) e um osso de corpo (`hip`).
// Pálpebra aberta = rotação 0; fechada = 30° em X.
const OPEN = [0, 0, 0, 1]
const CLOSED = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 6)
  .toArray()

function lidTrack(frames) {
  const times = frames.map((_, i) => i * 0.1)
  return new THREE.QuaternionKeyframeTrack(
    'lid.quaternion',
    times,
    frames.flat(),
  )
}

function hipTrack(duration, value) {
  return new THREE.VectorKeyframeTrack(
    'hip.position',
    [0, duration],
    [0, value, 0, 0, value, 0],
  )
}

function makeAnimations() {
  return [
    // Corpo com a pálpebra PARADA e aberta — pode piscar.
    new THREE.AnimationClip('idle', 1, [
      hipTrack(1, 0),
      lidTrack([OPEN, OPEN]),
    ]),
    // Olho fechado o tempo todo (faint) — não pisca.
    new THREE.AnimationClip('faintLoop', 1, [
      hipTrack(1, -1),
      lidTrack([CLOSED, CLOSED]),
    ]),
    // Mexe a pálpebra por conta própria (appeal) — não pisca por cima.
    new THREE.AnimationClip('appeal', 0.2, [
      hipTrack(0.2, 0),
      lidTrack([OPEN, CLOSED, OPEN]),
    ]),
    // Blink: abre → fecha → abre. `hip` parado (não entra na camada).
    new THREE.AnimationClip('blink', 0.2, [
      hipTrack(0.2, 0),
      lidTrack([OPEN, CLOSED, OPEN]),
    ]),
  ]
}

function makePlayer() {
  const root = new THREE.Object3D()
  const hip = new THREE.Bone()
  hip.name = 'hip'
  const lid = new THREE.Bone()
  lid.name = 'lid'
  root.add(hip, lid)

  const animations = makeAnimations()
  const player = createNativeAnimationPlayer(
    root,
    animations,
    { idle: 'idle', faint: { loop: 'faintLoop' }, appeal: 'appeal' },
    {
      blinkConfig: { animation: 'blink', minInterval: 1, maxInterval: 1 },
      random: () => 0,
    },
  )
  return { player, lid, hip, animations }
}

/** Avança até o piscar disparar e mais `after` segundos. */
function stepPastBlink(player, after) {
  const speed = { animationSpeed: 1, direction: 1 }
  updateNativeAnimationBlink(player, 1)
  advanceNativeAnimation(player, 0, speed)
  updateNativeAnimationBlink(player, after)
  advanceNativeAnimation(player, after, speed)
}

function lidAngle(lid) {
  return 2 * Math.acos(Math.min(1, Math.abs(lid.quaternion.w)))
}

describe('nativeBlink — piscar por animação', () => {
  it('no idle (pálpebra aberta e parada), fecha no meio do piscar e reabre no fim', () => {
    const { player, lid } = makePlayer()
    enterNativeState(player, 'idle', { oneShot: false })

    stepPastBlink(player, 0.1)
    expect(lidAngle(lid)).toBeCloseTo(Math.PI / 6)

    updateNativeAnimationBlink(player, 0.15)
    advanceNativeAnimation(player, 0.15, { animationSpeed: 1, direction: 1 })
    expect(lidAngle(lid)).toBeCloseTo(0)
  })

  it('não pisca com o olho fechado (faint) — a pálpebra fica como o corpo manda', () => {
    const { player, lid } = makePlayer()
    enterNativeState(player, 'faint', { oneShot: false })

    stepPastBlink(player, 0.1)

    expect(player.blink.action.isRunning()).toBe(false)
    expect(lidAngle(lid)).toBeCloseTo(Math.PI / 6)
  })

  it('não pisca por cima de um clipe que mexe a pálpebra sozinho (appeal)', () => {
    const { player } = makePlayer()
    enterNativeState(player, 'appeal', { oneShot: true })

    stepPastBlink(player, 0.05)

    expect(player.blink.action.isRunning()).toBe(false)
  })

  it('só as tracks que o blink move entram na camada, sem mutar o clipe do cache', () => {
    const { player, hip, animations } = makePlayer()
    enterNativeState(player, 'idle', { oneShot: false })
    const blinkSource = animations.find((clip) => clip.name === 'blink')
    const valuesBefore = Array.from(blinkSource.tracks[1].values)

    stepPastBlink(player, 0.1)

    expect(player.blink.action.getClip().tracks).toHaveLength(1)
    expect(hip.position.y).toBeCloseTo(0)
    expect(Array.from(blinkSource.tracks[1].values)).toEqual(valuesBefore)
  })

  it('espécie sem o clipe de blink declarado fica sem piscar, sem quebrar', () => {
    const root = new THREE.Object3D()
    const player = createNativeAnimationPlayer(
      root,
      makeAnimations(),
      { idle: 'idle' },
      {
        blinkConfig: {
          animation: 'nao-existe',
          minInterval: 1,
          maxInterval: 2,
        },
      },
    )
    enterNativeState(player, 'idle', { oneShot: false })

    expect(player.blink).toBeNull()
    expect(() => updateNativeAnimationBlink(player, 5)).not.toThrow()
  })
})
