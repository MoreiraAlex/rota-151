import { describe, it, expect } from 'vitest'
import {
  applyAnimationClip,
  capturePose,
  applyBlendedAnimationClip,
  resolveClipSpeed,
} from './applyAnimationClip'
import { quaternionFromAxisAngle, multiplyQuaternions } from '@/core/math'

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

describe('applyAnimationClip — clipe de keyframes gravados', () => {
  // Rotação: identidade → 180° em Z, em 3 frames (0, meio, fim) — fácil de
  // conferir por slerp. Posição: sobe em Y de 0 a 2. `fps` deliberadamente
  // "errado" pra duração real (3 frames a 10fps = 0.3s) — os testes de
  // ONE-SHOT abaixo provam que isso não importa pro `speed` vindo de fora
  // (`ActionState.animationSpeed`, ver docstring de `applyAnimationClip`).
  const HALF_TURN_Z = quaternionFromAxisAngle('z', Math.PI)
  const clip = {
    name: 'recorded-gesture',
    type: 'keyframes',
    fps: 10,
    bones: {
      arm: {
        quaternion: [IDENTITY, HALF_TURN_Z, IDENTITY],
        position: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 2, z: 0 },
        ],
      },
      // Só posição — a rotação deve continuar no descanso (identidade).
      spine: {
        position: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      },
    },
  }

  it('no frame exato (t=0), aplica o valor gravado sem interpolar', () => {
    const bones = { arm: makeEntry(), spine: makeEntry() }
    applyAnimationClip(clip, bones, 0, 1)
    expectQuaternionCloseTo(bones.arm.bone.quaternion, IDENTITY)
    expect(bones.arm.bone.position.y).toBeCloseTo(0)
  })

  it('a meio caminho entre dois frames, interpola: slerp na rotação, lerp na posição', () => {
    const bones = { arm: makeEntry() }
    // 3 frames = 1 ciclo inteiro do array; t=1/6 com speed=1 cai bem no
    // meio do segmento frame 0 → frame 1 (1/3 do ciclo, alpha 0.5).
    applyAnimationClip(clip, bones, 1 / 6, 1)

    expect(bones.arm.bone.position.y).toBeCloseTo(0.5)
    // Meio caminho (slerp) de identidade a 180° em Z é 90° em Z.
    expectQuaternionCloseTo(
      bones.arm.bone.quaternion,
      quaternionFromAxisAngle('z', Math.PI / 2),
    )
  })

  it('osso só com `position` gravada não mexe na rotação (fica no descanso)', () => {
    const bones = { spine: makeEntry() }
    applyAnimationClip(clip, bones, 1 / 6, 1) // meio do único segmento
    expectQuaternionCloseTo(bones.spine.bone.quaternion, IDENTITY)
    expect(bones.spine.bone.position.x).toBeCloseTo(0.5)
  })

  it('é cíclico: depois do último frame, envolve de volta pro frame 0', () => {
    const bones = { arm: makeEntry() }
    applyAnimationClip(clip, bones, 1, 1) // 1 ciclo inteiro decorrido
    expectQuaternionCloseTo(bones.arm.bone.quaternion, IDENTITY)
    expect(bones.arm.bone.position.y).toBeCloseTo(0)
  })

  it('osso do clipe ausente do mapa resolvido (rig sem ele) não lança erro', () => {
    const bones = { spine: makeEntry() } // sem "arm", que o clipe também anima
    expect(() => applyAnimationClip(clip, bones, 0.5, 1)).not.toThrow()
  })

  it('clipe sem nenhum array de frame (malformado) mantém o descanso, sem lançar', () => {
    const bones = { arm: makeEntry() }
    applyAnimationClip({ type: 'keyframes', bones: { arm: {} } }, bones, 1, 1)
    expectQuaternionCloseTo(bones.arm.bone.quaternion, IDENTITY)
  })

  describe('resolveClipSpeed — padrão do keyframes vindo de fps', () => {
    it('sem `speed` declarado, usa fps / total de frames (1 volta no tempo real gravado)', () => {
      expect(resolveClipSpeed(clip)).toBeCloseTo(10 / 3)
    })

    it('`speed` explícito no clipe sempre ganha do padrão calculado', () => {
      expect(resolveClipSpeed({ ...clip, speed: 2 })).toBe(2)
    })

    it('clipe procedural (sem type) cai no fallback de sempre (1), fps é ignorado', () => {
      expect(resolveClipSpeed({ fps: 10, bones: {} })).toBe(1)
    })
  })

  it('one-shot: `speed = 1/duration` estica o clipe GRAVADO inteiro pra caber na duração — não usa `fps`', () => {
    // Mesmo clipe (3 frames @ 10fps → duração "natural" de 0.3s), mas a
    // ação que o dispara dura 2s — bem diferente da duração natural.
    // `ActionState.animationSpeed` (aqui, o `speed` passado direto) manda
    // sozinho: o gesto inteiro (frame 0 → o último) tem que caber EXATAMENTE
    // nesses 2s, do mesmo jeito que já acontece pra um clipe procedural
    // (ver docstring de `applyAnimationClip` e `ActionState.animationSpeed`).
    const duration = 2
    const speed = 1 / duration
    const bones = { arm: makeEntry() }

    applyAnimationClip(clip, bones, 0, speed)
    expect(bones.arm.bone.position.y).toBeCloseTo(0) // começo do gesto

    // 3 frames = 1 ciclo inteiro; 1/3 do caminho cai exatamente no frame do
    // meio (sem interpolar) — 1/3 de 2s, não a metade dos 2s.
    applyAnimationClip(clip, bones, duration / 3, speed)
    expect(bones.arm.bone.position.y).toBeCloseTo(1) // no frame do meio

    applyAnimationClip(clip, bones, duration, speed) // fim exato do gesto
    expectQuaternionCloseTo(bones.arm.bone.quaternion, IDENTITY)
    expect(bones.arm.bone.position.y).toBeCloseTo(0) // envolveu de volta ao frame 0 — mesma pose do início, o gesto "fechou"
  })
})
