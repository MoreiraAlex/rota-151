import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getItem, listItems, resolveItemAnimations } from '@/core/data/items'
import {
  resolveBallClip,
  resolveClickScale,
  resolveClipTimeScale,
  resolveGlowScale,
  resolveStarOffset,
  resolveVanishScale,
  resolveWobbleAngle,
} from './captureBallMotion'

const BALL = GAME_CONFIG.FEEDBACK.CAPTURE_BALL
const WOBBLE = {
  angle: BALL.WOBBLE_ANGLE,
  cycles: BALL.WOBBLE_CYCLES,
  duration: BALL.WOBBLE_DURATION,
}

describe('captureBallMotion', () => {
  it('a balançada começa e termina em pé e não passa do ângulo', () => {
    expect(resolveWobbleAngle(0, WOBBLE)).toBe(0)
    expect(resolveWobbleAngle(WOBBLE.duration, WOBBLE)).toBe(0)
    expect(resolveWobbleAngle(-1, WOBBLE)).toBe(0)
    for (let t = 0; t < WOBBLE.duration; t += WOBBLE.duration / 50) {
      expect(Math.abs(resolveWobbleAngle(t, WOBBLE))).toBeLessThanOrEqual(
        (WOBBLE.angle * Math.PI) / 180 + 1e-9,
      )
    }
  })

  it('a balançada vai pros dois lados', () => {
    const samples = []
    for (let t = 0; t < WOBBLE.duration; t += WOBBLE.duration / 50) {
      samples.push(resolveWobbleAngle(t, WOBBLE))
    }
    expect(Math.max(...samples)).toBeGreaterThan(0)
    expect(Math.min(...samples)).toBeLessThan(0)
  })

  it('o brilho cresce até o máximo no meio e some nas pontas', () => {
    expect(resolveGlowScale(0, BALL.GLOW_MAX_SCALE)).toBe(0)
    expect(resolveGlowScale(0.5, BALL.GLOW_MAX_SCALE)).toBeCloseTo(
      BALL.GLOW_MAX_SCALE,
    )
    expect(resolveGlowScale(1, BALL.GLOW_MAX_SCALE)).toBe(0)
  })

  it('as estrelinhas saem do centro, vão até a distância e somem', () => {
    const start = resolveStarOffset(0, BALL.STAR_COUNT, 0, BALL.STAR_DISTANCE)
    const end = resolveStarOffset(0, BALL.STAR_COUNT, 1, BALL.STAR_DISTANCE)
    expect(Math.hypot(start.x, start.z)).toBe(0)
    expect(Math.hypot(end.x, end.z)).toBeCloseTo(BALL.STAR_DISTANCE)
    expect(end.scale).toBe(0)
  })

  it('o clique encolhe e volta; o sumiço encolhe só no fim', () => {
    expect(resolveClickScale(0.5, BALL.CLICK_SQUASH)).toBeCloseTo(
      1 - BALL.CLICK_SQUASH,
    )
    expect(resolveClickScale(1, BALL.CLICK_SQUASH)).toBe(1)
    expect(resolveVanishScale(0, 1, 0.2)).toBe(1)
    expect(resolveVanishScale(0.9, 1, 0.2)).toBeCloseTo(0.5)
    expect(resolveVanishScale(1, 1, 0.2)).toBe(0)
  })
})

describe('clipes do .glb da bola', () => {
  const CAPTURE = GAME_CONFIG.CAPTURE
  const CLIPS = {
    flying: 'voo',
    absorb: 'puxa',
    close: 'fecha',
    shake: 'balanca',
    caught: 'pegou',
    escaped: 'escapou',
  }

  it('cada fase toca o seu clipe; o voo repete, o resto para no fim', () => {
    expect(resolveBallClip('flying', 0, CLIPS, CAPTURE)).toMatchObject({
      name: CLIPS.flying,
      loop: true,
    })
    expect(resolveBallClip('absorbing', 0, CLIPS, CAPTURE)).toMatchObject({
      name: CLIPS.absorb,
      loop: false,
      fitTo: CAPTURE.ABSORB_DURATION,
    })
    expect(resolveBallClip('caught', 3, CLIPS, CAPTURE).name).toBe(CLIPS.caught)
    expect(resolveBallClip('escaped', 1, CLIPS, CAPTURE).name).toBe(
      CLIPS.escaped,
    )
    expect(resolveBallClip('missed', 0, CLIPS, CAPTURE)).toBe(null)
  })

  it('caindo fecha e segura fechada até a 1ª balançada; cada balançada recomeça o clipe', () => {
    expect(resolveBallClip('falling', 0, CLIPS, CAPTURE).name).toBe(CLIPS.close)
    expect(resolveBallClip('shaking', 0, CLIPS, CAPTURE).key).toBe('close')
    const noClose = { ...CLIPS, close: undefined }
    expect(resolveBallClip('falling', 0, noClose, CAPTURE).key).toBe('absorb')
    const first = resolveBallClip('shaking', 1, CLIPS, CAPTURE)
    const second = resolveBallClip('shaking', 2, CLIPS, CAPTURE)
    expect(first.name).toBe(CLIPS.shake)
    expect(first.key).not.toBe(second.key)
  })

  it('sem clipe pra fase (ou sem clipes), fica o procedural', () => {
    expect(resolveBallClip('flying', 0, { absorb: 'x' }, CAPTURE)).toBe(null)
    expect(resolveBallClip('absorbing', 0, undefined, CAPTURE)).toBe(null)
  })

  it('encaixe: o clipe vira a duração da fase; só acelera quando não cabe', () => {
    expect(resolveClipTimeScale(2, 1)).toBe(2)
    expect(resolveClipTimeScale(0.5, 1)).toBe(0.5)
    expect(resolveClipTimeScale(0.5, 1, true)).toBe(1)
    expect(resolveClipTimeScale(2, 1, true)).toBe(2)
    expect(resolveClipTimeScale(2, null)).toBe(1)
  })

  it('toda bola aponta pra clipes que existem no .glb dela', () => {
    for (const item of listItems()) {
      const names = Object.values(resolveItemAnimations(item) ?? {})
      if (names.length === 0) continue
      const clipsItem = item.model.clipsFrom
        ? getItem(item.model.clipsFrom)
        : item
      const glbClips = readGlbClipNames(`public${clipsItem.model.path}`)
      for (const name of names) expect(glbClips).toContain(name)
    }
  })
})

/** Nomes dos clipes de um `.glb` (o JSON do primeiro chunk). */
function readGlbClipNames(path) {
  const buffer = readFileSync(path)
  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString())
  return (json.animations ?? []).map((animation) => animation.name)
}
