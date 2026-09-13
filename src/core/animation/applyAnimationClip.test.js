import { describe, it, expect } from 'vitest'
import { applyAnimationClip } from './applyAnimationClip'
import FOX_WALK_CLIP from '@/core/data/species/fox/clips/walk.json'

function makeEntry(rest) {
  const defaultAxes = { x: 0, y: 0, z: 0 }
  return {
    bone: {
      rotation: { ...defaultAxes },
      position: { ...defaultAxes },
      scale: { x: 1, y: 1, z: 1 },
    },
    rest: {
      rotation: { ...defaultAxes, ...rest?.rotation },
      position: { ...defaultAxes, ...rest?.position },
      scale: { x: 1, y: 1, z: 1, ...rest?.scale },
    },
  }
}

describe('applyAnimationClip — mecânica básica', () => {
  it('soma o deslocamento à rotação de descanso, nunca substitui', () => {
    const bones = { frontRight: makeEntry({ rotation: { z: 1.2 } }) }
    const clip = {
      bones: {
        frontRight: { rotation: { z: { type: 'sine', amplitude: 0.5 } } },
      },
    }

    applyAnimationClip(clip, bones, 0, 1)
    expect(bones.frontRight.bone.rotation.z).toBeCloseTo(1.2)
  })

  it('anima position do mesmo jeito — soma à posição de descanso', () => {
    const bones = { hip: makeEntry({ position: { y: 2.5 } }) }
    const clip = {
      bones: { hip: { position: { y: { type: 'constant', value: 0.1 } } } },
    }

    applyAnimationClip(clip, bones, 0, 1)
    expect(bones.hip.bone.position.y).toBeCloseTo(2.6)
    // rotation não foi declarada no clipe — fica intacta
    expect(bones.hip.bone.rotation.y).toBe(0)
  })

  it('ignora osso do clipe que não existe no mapa resolvido', () => {
    const bones = {}
    const clip = {
      bones: {
        naoExiste: { rotation: { z: { type: 'sine', amplitude: 0.5 } } },
      },
    }
    expect(() => applyAnimationClip(clip, bones, 0, 1)).not.toThrow()
  })

  it('eixo não animado pelo clipe reflete a pose de descanso, não fica em zero à toa', () => {
    const bones = { hip: makeEntry({ rotation: { x: 0.1, y: 0.2, z: 0.3 } }) }
    const clip = {
      bones: { hip: { rotation: { x: { type: 'constant', value: 0.05 } } } },
    }

    applyAnimationClip(clip, bones, 0, 1)

    expect(bones.hip.bone.rotation.x).toBeCloseTo(0.15) // 0.1 (rest) + 0.05
    expect(bones.hip.bone.rotation.y).toBeCloseTo(0.2) // não animado → rest
    expect(bones.hip.bone.rotation.z).toBeCloseTo(0.3) // idem
  })

  it('trocar de clipe devolve à pose de descanso o que o clipe anterior mexeu', () => {
    // Reproduz o bug do idle: a perna anima no "walk" e não é mencionada no
    // "idle" — precisa voltar a ficar parada, não travar no último quadro.
    const bones = { leg: makeEntry({ rotation: { z: 0 } }) }
    const walk = {
      bones: { leg: { rotation: { z: { type: 'sine', amplitude: 0.5 } } } },
    }
    const idle = { bones: {} } // não menciona "leg"

    applyAnimationClip(walk, bones, 0.25, 1) // meio de ciclo: longe do repouso
    expect(bones.leg.bone.rotation.z).not.toBeCloseTo(0)

    applyAnimationClip(idle, bones, 0, 1)
    expect(bones.leg.bone.rotation.z).toBeCloseTo(0)
  })
})

describe('applyAnimationClip — clipe real (fox-walk.json)', () => {
  // Ossos usados pelo próprio clipe, com nomes reais do rig do Fox — deriva
  // do arquivo em vez de listar à mão, então continua válido se o clipe
  // ganhar/perder ossos.
  const BONE = {
    frontRight: 'b_RightUpperArm_06',
    frontLeft: 'b_LeftUpperArm_09',
    backLeft: 'b_LeftLeg01_015',
    frontRightLower: 'b_RightForeArm_07',
    hip: 'b_Hip_01',
    tail: 'b_Tail01_012',
    tail2: 'b_Tail02_013',
  }

  function makeFoxBones() {
    return Object.fromEntries(
      Object.keys(FOX_WALK_CLIP.bones).map((boneName) => [
        boneName,
        makeEntry(),
      ]),
    )
  }

  it('pernas diagonais (frontRight/backLeft) ficam sempre na mesma fase', () => {
    // "Mesma fase" aqui é por phaseTurns, não pelo sinal bruto do ângulo: o
    // osso de braço (frontRight) e o de perna (backLeft) têm convenções de
    // eixo local opostas no rig do Fox, então a amplitude de um é o negativo
    // do outro por convenção — visualmente sincronizados, numericamente
    // espelhados. O que importa pro trote é a magnitude bater em todo t.
    const bones = makeFoxBones()
    for (let t = 0; t < 2; t += 0.05) {
      applyAnimationClip(FOX_WALK_CLIP, bones, t, 1)
      expect(Math.abs(bones[BONE.frontRight].bone.rotation.z)).toBeCloseTo(
        Math.abs(bones[BONE.backLeft].bone.rotation.z),
      )
    }
  })

  it('os dois pares diagonais estão defasados em meio ciclo', () => {
    const bones = makeFoxBones()
    applyAnimationClip(FOX_WALK_CLIP, bones, 0.1, 1)
    expect(bones[BONE.frontRight].bone.rotation.z).toBeCloseTo(
      -bones[BONE.frontLeft].bone.rotation.z,
    )
  })

  it('o membro inferior nunca dobra além do limite do clipe', () => {
    const bones = makeFoxBones()
    const { max } = FOX_WALK_CLIP.bones[BONE.frontRightLower].rotation.z
    for (let t = 0; t < 2; t += 0.05) {
      applyAnimationClip(FOX_WALK_CLIP, bones, t, 1)
      expect(bones[BONE.frontRightLower].bone.rotation.z).toBeLessThanOrEqual(
        max + 1e-9,
      )
    }
  })

  it('o quadril também sobe/desce em position, não só gira', () => {
    const bones = makeFoxBones()
    const { amplitude } = FOX_WALK_CLIP.bones[BONE.hip].position.y
    for (let t = 0; t < 2; t += 0.05) {
      applyAnimationClip(FOX_WALK_CLIP, bones, t, 1)
      expect(bones[BONE.hip].bone.position.y).toBeGreaterThanOrEqual(-1e-9)
      expect(bones[BONE.hip].bone.position.y).toBeLessThanOrEqual(
        amplitude + 1e-9,
      )
    }
  })

  it('os segmentos do rabo repetem o valor um do outro, com atraso', () => {
    const bones = makeFoxBones()
    const lag = FOX_WALK_CLIP.bones[BONE.tail2].rotation.y.timeOffset

    applyAnimationClip(FOX_WALK_CLIP, bones, 0.4, 1)
    const tailNow = bones[BONE.tail].bone.rotation.y

    applyAnimationClip(FOX_WALK_CLIP, bones, 0.4 + lag, 1)
    const tail2Later = bones[BONE.tail2].bone.rotation.y

    expect(tail2Later).toBeCloseTo(tailNow)
  })
})
