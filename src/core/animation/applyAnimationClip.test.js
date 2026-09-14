import { describe, it, expect } from 'vitest'
import {
  applyAnimationClip,
  capturePose,
  applyBlendedAnimationClip,
} from './applyAnimationClip'
import { quaternionFromAxisAngle, multiplyQuaternions } from '@/core/math'
import FOX_WALK_CLIP from '@/core/data/species/fox/clips/walk.json'

const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }

/** Compõe um quaternion de descanso a partir de uma tripla Euler XYZ (mesma
 * convenção do three.js: q = qx·qy·qz) — só pra montar fixtures de teste;
 * o motor de verdade nunca faz essa conversão (lê `bone.quaternion` direto). */
function eulerXYZToQuaternion({ x = 0, y = 0, z = 0 } = {}) {
  return multiplyQuaternions(
    multiplyQuaternions(
      quaternionFromAxisAngle('x', x),
      quaternionFromAxisAngle('y', y),
    ),
    quaternionFromAxisAngle('z', z),
  )
}

function makeEntry({ rotation, position, scale, restQuaternion } = {}) {
  const defaultAxes = { x: 0, y: 0, z: 0 }
  const quaternion = { ...IDENTITY }
  return {
    bone: {
      quaternion: {
        ...quaternion,
        set(x, y, z, w) {
          this.x = x
          this.y = y
          this.z = z
          this.w = w
        },
      },
      position: { ...defaultAxes },
      scale: { x: 1, y: 1, z: 1 },
    },
    rest: {
      rotation: { ...defaultAxes, ...rotation },
      position: { ...defaultAxes, ...position },
      scale: { x: 1, y: 1, z: 1, ...scale },
    },
    restQuaternion: restQuaternion ?? eulerXYZToQuaternion(rotation),
  }
}

function expectQuaternionCloseTo(actual, expected, precision = 5) {
  expect(actual.x).toBeCloseTo(expected.x, precision)
  expect(actual.y).toBeCloseTo(expected.y, precision)
  expect(actual.z).toBeCloseTo(expected.z, precision)
  expect(actual.w).toBeCloseTo(expected.w, precision)
}

describe('applyAnimationClip — mecânica básica', () => {
  it('rotation: curva de um eixo compõe uma rotação pura naquele eixo local, em cima do descanso', () => {
    const bones = { frontRight: makeEntry() } // descanso na identidade
    const clip = {
      bones: {
        frontRight: { rotation: { z: { type: 'sine', amplitude: 0.5 } } },
      },
    }

    applyAnimationClip(clip, bones, 0, 1)
    // t=0 → sine(0)=0 → delta 0 → continua na identidade
    expectQuaternionCloseTo(bones.frontRight.bone.quaternion, IDENTITY)
  })

  it('anima position do mesmo jeito de sempre — soma escalar à posição de descanso', () => {
    const bones = { hip: makeEntry({ position: { y: 2.5 } }) }
    const clip = {
      bones: { hip: { position: { y: { type: 'constant', value: 0.1 } } } },
    }

    applyAnimationClip(clip, bones, 0, 1)
    expect(bones.hip.bone.position.y).toBeCloseTo(2.6)
    // rotation não foi declarada no clipe — fica no quaternion de descanso
    expectQuaternionCloseTo(bones.hip.bone.quaternion, IDENTITY)
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
    const bones = { hip: makeEntry({ position: { x: 0.1, y: 0.2, z: 0.3 } }) }
    const clip = {
      bones: { hip: { position: { x: { type: 'constant', value: 0.05 } } } },
    }

    applyAnimationClip(clip, bones, 0, 1)

    expect(bones.hip.bone.position.x).toBeCloseTo(0.15) // 0.1 (rest) + 0.05
    expect(bones.hip.bone.position.y).toBeCloseTo(0.2) // não animado → rest
    expect(bones.hip.bone.position.z).toBeCloseTo(0.3) // idem
  })

  it('trocar de clipe devolve à pose de descanso o que o clipe anterior mexeu', () => {
    // Reproduz o bug do idle: a perna anima no "walk" e não é mencionada no
    // "idle" — precisa voltar a ficar parada, não travar no último quadro.
    const bones = { leg: makeEntry() }
    const walk = {
      bones: { leg: { rotation: { z: { type: 'sine', amplitude: 0.5 } } } },
    }
    const idle = { bones: {} } // não menciona "leg"

    applyAnimationClip(walk, bones, 0.25, 1) // meio de ciclo: longe do repouso
    expect(bones.leg.bone.quaternion.w).not.toBeCloseTo(1)

    applyAnimationClip(idle, bones, 0, 1)
    expectQuaternionCloseTo(bones.leg.bone.quaternion, IDENTITY)
  })

  it('rest longe da identidade: curva em X gira no eixo local do osso, não invertida nem "vazando" pra outro eixo (rig Mixamo)', () => {
    // Coxa do rig Mixamo descansa a 180° em Z — o caso que expôs o bug: soma
    // de Euler component-a-component não bate com composição de quaternion
    // quando o resto tem rotação forte em outro eixo.
    const restQuaternion = quaternionFromAxisAngle('z', Math.PI)
    const bones = { thigh: makeEntry({ restQuaternion }) }
    const clip = {
      bones: { thigh: { rotation: { x: { type: 'constant', value: 0.4 } } } },
    }

    applyAnimationClip(clip, bones, 0, 1)

    const expected = multiplyQuaternions(
      restQuaternion,
      quaternionFromAxisAngle('x', 0.4),
    )
    expectQuaternionCloseTo(bones.thigh.bone.quaternion, expected)
    // não é a mesma coisa que "somar 0.4 no x do Euler de descanso" — é
    // exatamente esse contraste que o motor antigo (soma escalar) errava.
  })

  it('múltiplos eixos do mesmo osso compõem na ordem fixa x, y, z', () => {
    const bones = { spine: makeEntry() }
    const clip = {
      bones: {
        spine: {
          rotation: {
            x: { type: 'constant', value: 0.1 },
            y: { type: 'constant', value: 0.2 },
            z: { type: 'constant', value: 0.3 },
          },
        },
      },
    }

    applyAnimationClip(clip, bones, 0, 1)

    const expected = multiplyQuaternions(
      multiplyQuaternions(
        multiplyQuaternions(IDENTITY, quaternionFromAxisAngle('x', 0.1)),
        quaternionFromAxisAngle('y', 0.2),
      ),
      quaternionFromAxisAngle('z', 0.3),
    )
    expectQuaternionCloseTo(bones.spine.bone.quaternion, expected)
  })
})

describe('capturePose / applyBlendedAnimationClip — crossfade', () => {
  it('capturePose fotografa o quaternion atual do osso, não o de descanso', () => {
    const bones = { leg: makeEntry() }
    const live = quaternionFromAxisAngle('z', 0.9)
    bones.leg.bone.quaternion.set(live.x, live.y, live.z, live.w)

    const pose = capturePose(bones)
    expectQuaternionCloseTo(pose.leg.quaternion, live)
  })

  it('alpha 0 mantém a pose congelada; alpha 1 é o clipe novo puro', () => {
    const bones = { leg: makeEntry() }
    const fromPose = capturePose(bones) // congelado na identidade
    const clip = {
      bones: { leg: { rotation: { z: { type: 'constant', value: 2 } } } },
    }

    applyBlendedAnimationClip(fromPose, clip, bones, 0, 0, 1)
    expectQuaternionCloseTo(bones.leg.bone.quaternion, IDENTITY)

    applyBlendedAnimationClip(fromPose, clip, bones, 0, 1, 1)
    expectQuaternionCloseTo(
      bones.leg.bone.quaternion,
      quaternionFromAxisAngle('z', 2),
    )
  })

  it('alpha intermediário faz slerp — nunca lerp linear de Euler', () => {
    const bones = { leg: makeEntry() }
    const fromPose = capturePose(bones) // congelado na identidade
    const clip = {
      bones: { leg: { rotation: { z: { type: 'constant', value: 2 } } } },
    }

    applyBlendedAnimationClip(fromPose, clip, bones, 0, 0.5, 1)

    // metade do caminho angular entre identidade e z=2, não a média
    // aritmética dos componentes (que não seria sequer um quaternion válido)
    const q = bones.leg.bone.quaternion
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1) // continua normalizado
  })

  it('troca no meio de um crossfade não perde o congelamento original', () => {
    // Fotografa parado, começa a misturar pra "correr", mas troca de alvo
    // antes de terminar — a fotografia original continua sendo o ponto de
    // partida (é o animationSystem que decide não re-fotografar).
    const bones = { leg: makeEntry() }
    const fromPose = capturePose(bones)
    const runClip = {
      bones: { leg: { rotation: { z: { type: 'constant', value: 3 } } } },
    }
    const idleClip = { bones: {} }

    applyBlendedAnimationClip(fromPose, runClip, bones, 0, 0.3, 1)
    const midRun = { ...bones.leg.bone.quaternion }

    applyBlendedAnimationClip(fromPose, idleClip, bones, 0, 0.3, 1)
    // idleClip não sobrescreve "leg" — a mistura cai de volta pra
    // interpolar entre a mesma fotografia e a pose de descanso (identidade),
    // então o resultado não é igual ao instante anterior (alvo mudou).
    expect(bones.leg.bone.quaternion.z).not.toBeCloseTo(midRun.z)
    expectQuaternionCloseTo(bones.leg.bone.quaternion, IDENTITY)
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
        makeEntry(), // rest identidade — o rig do Fox é assim de verdade
      ]),
    )
  }

  it('pernas diagonais (frontRight/backLeft) ficam sempre na mesma fase', () => {
    // "Mesma fase" aqui é por phaseTurns, não pelo sinal bruto do ângulo: o
    // osso de braço (frontRight) e o de perna (backLeft) têm convenções de
    // eixo local opostas no rig do Fox, então a amplitude de um é o negativo
    // do outro por convenção — visualmente sincronizados, numericamente
    // espelhados. Todos os ossos deste describe só têm curva em Z e
    // descansam na identidade, então `signedZAngle` reproduz exatamente o
    // antigo `bone.rotation.z` (sem a ambiguidade de sinal do módulo).
    const bones = makeFoxBones()
    for (let t = 0; t < 2; t += 0.05) {
      applyAnimationClip(FOX_WALK_CLIP, bones, t, 1)
      expect(
        Math.abs(signedZAngle(bones[BONE.frontRight].bone.quaternion)),
      ).toBeCloseTo(
        Math.abs(signedZAngle(bones[BONE.backLeft].bone.quaternion)),
      )
    }
  })

  it('os dois pares diagonais estão defasados em meio ciclo', () => {
    const bones = makeFoxBones()
    applyAnimationClip(FOX_WALK_CLIP, bones, 0.1, 1)
    expect(signedZAngle(bones[BONE.frontRight].bone.quaternion)).toBeCloseTo(
      -signedZAngle(bones[BONE.frontLeft].bone.quaternion),
    )
  })

  it('o membro inferior nunca dobra além do limite do clipe', () => {
    const bones = makeFoxBones()
    const { max } = FOX_WALK_CLIP.bones[BONE.frontRightLower].rotation.z
    for (let t = 0; t < 2; t += 0.05) {
      applyAnimationClip(FOX_WALK_CLIP, bones, t, 1)
      const angle = signedZAngle(bones[BONE.frontRightLower].bone.quaternion)
      expect(angle).toBeLessThanOrEqual(max + 1e-9)
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
    const tailNow = signedYAngle(bones[BONE.tail].bone.quaternion)

    applyAnimationClip(FOX_WALK_CLIP, bones, 0.4 + lag, 1)
    const tail2Later = signedYAngle(bones[BONE.tail2].bone.quaternion)

    expect(tail2Later).toBeCloseTo(tailNow)
  })
})

// Só valem pra uma rotação pura no eixo em questão (rest identidade, curva
// só naquele eixo) — é o caso de todo osso deste describe. Reproduzem
// exatamente o antigo `bone.rotation.<eixo>` sem reintroduzir Euler no
// motor: 2*atan2(componente, w) extrai o ângulo assinado de volta.
function signedZAngle(q) {
  return 2 * Math.atan2(q.z, q.w)
}

function signedYAngle(q) {
  return 2 * Math.atan2(q.y, q.w)
}
