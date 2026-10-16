import { describe, expect, it } from 'vitest'
import {
  addTerm,
  addTrack,
  listTracks,
  peakOf,
  removeTerm,
  removeTrack,
  setTermField,
  setTermType,
  termsOf,
} from './cryClipEdit'
import { gameKeysByAnimation } from './nativeAnimationKeys'

const TRACK = { bone: 'head', property: 'rotation', axis: 'y' }

function clipWithSum() {
  return {
    name: 'creature-cry',
    bones: {
      head: {
        rotation: {
          y: {
            type: 'sum',
            curves: [
              { type: 'constant', value: 0.1 },
              {
                type: 'sine',
                amplitude: 0.2,
                frequencyScale: 1,
                phaseTurns: 0,
              },
            ],
          },
        },
      },
    },
  }
}

describe('edição do clipe do grito', () => {
  it('não muda o clipe recebido', () => {
    const clip = clipWithSum()
    const before = structuredClone(clip)
    setTermField(clip, TRACK, 1, 'amplitude', 0.5)
    addTerm(clip, TRACK, 'sine')
    removeTrack(clip, TRACK)
    expect(clip).toEqual(before)
  })

  it('lista uma trilha por osso/propriedade/eixo', () => {
    expect(listTracks(clipWithSum())).toEqual([expect.objectContaining(TRACK)])
  })

  it('muda só o campo do termo pedido', () => {
    const next = setTermField(clipWithSum(), TRACK, 1, 'amplitude', 0.5)
    const terms = termsOf(next.bones.head.rotation.y)
    expect(terms[1].amplitude).toBe(0.5)
    expect(terms[0]).toEqual(clipWithSum().bones.head.rotation.y.curves[0])
  })

  it('soma de um termo só volta a ser a curva solta; sem termo, a trilha sai', () => {
    const one = removeTerm(clipWithSum(), TRACK, 0)
    expect(one.bones.head.rotation.y.type).toBe('sine')
    const none = removeTerm(one, TRACK, 0)
    expect(none.bones.head).toBeUndefined()
  })

  it('trilha e termo novos começam zerados (não mexem no movimento)', () => {
    const next = addTrack(clipWithSum(), {
      bone: 'nose',
      property: 'position',
      axis: 'z',
    })
    expect(peakOf(next.bones.nose.position.z)).toBe(0)
    const more = addTerm(next, TRACK, 'absSine')
    expect(peakOf(more.bones.head.rotation.y)).toBeCloseTo(
      peakOf(clipWithSum().bones.head.rotation.y),
    )
  })

  it('trocar o tipo mantém os campos em comum', () => {
    const next = setTermType(clipWithSum(), TRACK, 1, 'absSine')
    const term = termsOf(next.bones.head.rotation.y)[1]
    expect(term.type).toBe('absSine')
    expect(term.amplitude).toBe(0.2)
  })

  it('o pico soma o módulo de cada termo', () => {
    const curve = clipWithSum().bones.head.rotation.y
    const [constant, sine] = curve.curves
    expect(peakOf(curve)).toBeCloseTo(constant.value + sine.amplitude)
  })
})

describe('gameKeysByAnimation', () => {
  it('liga cada animação do .glb às chaves que a tocam, em todo formato de entrada', () => {
    const keys = gameKeysByAnimation({
      idle: 'idle',
      walk: { animation: 'walk', speed: 1.5 },
      dash: { sequence: ['stepIn', { animation: 'stepInEnd', frames: 10 }] },
      faint: { start: 'faintStart', loop: 'faintLoop' },
      attackAlt: 'attack',
      tackle: 'attack',
    })
    expect(keys.idle).toEqual(['idle'])
    expect(keys.walk).toEqual(['walk'])
    expect(keys.stepInEnd).toEqual(['dash'])
    expect(keys.faintLoop).toEqual(['faint'])
    expect(keys.attack).toEqual(['attackAlt', 'tackle'])
  })
})
