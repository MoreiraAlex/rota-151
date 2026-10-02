import * as THREE from 'three'
import {
  consumeSpawns,
  frameAt,
  particleSize,
  resolveBeamBasis,
  sampleGradient,
  spawnParticle,
  stepParticle,
  stepPathParticle,
} from './particleSimulation'

// Fração final da vida em que a partícula some em fade, pra não "estalar"
// de uma vez (várias não encolhem a zero sozinhas, ex.: as faíscas).
const FADE_OUT_FRACTION = 0.15

/**
 * Sistema de partículas de UM golpe: vários emissores (specs de
 * `emberVfx.js`) agendados numa linha do tempo própria, cada partícula um
 * `THREE.Sprite` (billboard — sempre de frente pra câmera, como o
 * `facing_camera_mode` do Bedrock). Nada aqui é estado do ECS nem do React,
 * mesmo padrão imperativo de `flameParticles.js`.
 *
 * Cada sprite tem a PRÓPRIA cópia da textura (`clone()` reusa a imagem, não
 * duplica na GPU) porque o quadro do flipbook é um `offset` da textura —
 * partículas em quadros diferentes ao mesmo tempo precisam de offsets
 * diferentes. Sprites de partículas que morreram voltam pra um pool por
 * emissor e são reaproveitados dentro do mesmo golpe.
 *
 * `textures`: `{ [chave]: THREE.Texture }` (as chaves que os specs citam em
 * `texture`). `length`: distância da criatura até o impacto. `radius`:
 * raio do golpe. `scale`: multiplicador de tamanho (`visual.scale`).
 * `density`: multiplicador da taxa de TODOS os emissores (1 = fiel ao
 * original) — o jeito de aliviar um efeito pesado sem mexer nos specs.
 *
 * Devolve `{ group, update(delta), isDone(), dispose(), ... }` — `group` já vai
 * no espaço local do efeito (impacto na origem, +Z na direção do golpe).
 *
 * **Efeito que acompanha quem se move** (o dash): `setFrame({ origin, yaw,
 * height, length? })` define de onde os emissores soltam as partículas A PARTIR DE
 * AGORA; elas nascem no MUNDO (o `group` fica na raiz da cena) e ficam pra
 * trás conforme a criatura anda — ver `ctx.frame` em `particleSimulation.js`.
 * Emissor `continuous: true` solta até `endEmission()` (o dash acabou); depois
 * disso o que já existe termina sozinho. Emissor com `every` (segundos) REPETE
 * a própria linha do tempo (`start`, `duration`/`burst`) a cada `every` s, também
 * até `endEmission()` — o padrão que se repete enquanto o golpe dura (o abanar
 * de cauda do Tail Whip).
 *
 * **Linha de velocidade** (`facing: 'direction'`, o `lookat_direction` do
 * Bedrock): em vez de um sprite que sempre encara a câmera, um quadro esticado
 * na direção do movimento com a face virada pra câmera — `setCameraPosition`
 * (atualizada a cada frame por quem usa) diz onde ela está.
 */

// Geometria do quadro das linhas de velocidade — compartilhada por todas.
const BEAM_GEOMETRY = new THREE.PlaneGeometry(1, 1)
export function createParticleSystem({
  emitters,
  textures,
  length,
  radius,
  scale = 1,
  density = 1,
  random = Math.random,
}) {
  const group = new THREE.Group()
  const runtimes = emitters.map((spec) => ({
    spec,
    carry: 0,
    emittedUntil: 0,
    burstDone: false,
    cycle: 0,
  }))
  const live = []
  const pools = new Map()
  const allSprites = []
  let time = 0
  let frame = null
  let cameraPosition = null
  let emissionEnded = false

  function acquireSprite(spec) {
    const pool = pools.get(spec.id)
    if (pool?.length) {
      const sprite = pool.pop()
      sprite.visible = true
      return sprite
    }
    const texture = textures[spec.texture].clone()
    // quadros lado a lado (padrão) ou empilhados na vertical (`vertical`);
    // `columns`/`column`: atlas vertical com mais de uma coluna, usa só uma
    // (o impacto de aço tem 2 colunas e usa a da direita). `rows`/`row`: o
    // mesmo pra um atlas horizontal com mais de uma linha (`row` 0 = a de
    // CIMA, convenção do Bedrock — o orbe do Giga Drain tem 2 linhas)
    const columns = spec.columns ?? 1
    const rows = spec.rows ?? 1
    texture.repeat.set(
      spec.vertical ? 1 / columns : 1 / spec.strip,
      spec.vertical ? 1 / spec.strip : 1 / rows,
    )
    if (spec.vertical && columns > 1) {
      texture.offset.x = (spec.column ?? 0) / columns
    }
    if (!spec.vertical && rows > 1) {
      // o `offset.y` do Three conta de baixo pra cima
      texture.offset.y = (rows - 1 - (spec.row ?? 0)) / rows
    }
    // pixel art ampliada: sem suavização, igual ao jogo de origem
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false
    texture.needsUpdate = true
    const materialOptions = {
      map: texture,
      transparent: true,
      depthWrite: false,
      blending:
        spec.blending === 'additive'
          ? THREE.AdditiveBlending
          : THREE.NormalBlending,
    }
    const sprite =
      spec.facing === 'direction'
        ? new THREE.Mesh(
            BEAM_GEOMETRY,
            new THREE.MeshBasicMaterial({
              ...materialOptions,
              side: THREE.DoubleSide,
            }),
          )
        : new THREE.Sprite(new THREE.SpriteMaterial(materialOptions))
    group.add(sprite)
    allSprites.push(sprite)
    return sprite
  }

  function releaseSprite(spec, sprite) {
    sprite.visible = false
    if (!pools.has(spec.id)) pools.set(spec.id, [])
    pools.get(spec.id).push(sprite)
  }

  function emit(runtime, emitterAge) {
    const { spec } = runtime
    const ctx = {
      age: emitterAge,
      progress: spec.duration
        ? Math.min(Math.max(emitterAge / spec.duration, 0), 1)
        : 0,
      // o quadro pode trazer o comprimento de agora (o feixe que segue a mira
      // muda de tamanho a cada frame); senão, o do sistema
      length: frame?.length ?? length,
      radius,
      scale,
      frame,
      height: frame?.height ?? 0,
    }
    live.push({
      spec,
      state: spawnParticle(spec, ctx, random),
      sprite: acquireSprite(spec),
    })
  }

  function runEmitters() {
    for (const runtime of runtimes) {
      const { spec } = runtime
      let age = time - spec.start
      if (age < 0) continue

      // `every`: a linha do tempo recomeça a cada ciclo, até `endEmission()`
      if (spec.every) {
        if (emissionEnded) continue
        const cycle = Math.floor(age / spec.every)
        if (cycle !== runtime.cycle) {
          runtime.cycle = cycle
          runtime.burstDone = false
          runtime.emittedUntil = 0
        }
        age -= cycle * spec.every
      }

      // rajada instantânea (`burst`: nº de partículas, de uma vez)
      // `burst` presente (inclusive 0): rajada, mesmo sem nenhuma partícula
      if (spec.burst !== undefined) {
        if (!runtime.burstDone) {
          runtime.burstDone = true
          // `burst`: número fixo ou função do contexto (ex.: depende do comprimento)
          const count =
            typeof spec.burst === 'function'
              ? spec.burst({ age: 0, length, radius, scale, frame })
              : spec.burst
          for (let i = 0; i < count; i++) emit(runtime, 0)
        }
        continue
      }

      // `continuous`: solta até `endEmission()`, sem janela de duração
      if (spec.continuous && emissionEnded) continue
      const to = spec.continuous ? age : Math.min(age, spec.duration)
      const dt = to - runtime.emittedUntil
      if (dt <= 0) continue
      const ctxRate = { age: to, length, radius, scale, frame }
      const { count, carry } = consumeSpawns(
        runtime.carry,
        spec.rate(ctxRate) * density,
        dt,
      )
      runtime.carry = carry
      // espalha as partículas deste passo ao longo dele (não todas no mesmo
      // instante), pra o emissor "andar" suavemente pelo trajeto
      for (let i = 0; i < count; i++) {
        emit(runtime, runtime.emittedUntil + (dt * (i + 1)) / count)
      }
      runtime.emittedUntil = to
    }
  }

  function render({ spec, state, sprite }) {
    const t = state.age / state.life
    const size = particleSize(spec, state)
    sprite.position.set(state.x, state.y, state.z)
    const [sizeX, sizeY] = Array.isArray(size) ? size : [size, size]
    sprite.scale.set(sizeX, sizeY, 1)
    if (spec.facing === 'direction') orientBeam(sprite, state)
    // `tintAt` (opcional): o gradiente nem sempre anda na mesma velocidade
    // da vida (ex.: `interpolant` do Flamethrower multiplica por uma random)
    const tintT = spec.tintAt ? spec.tintAt(t, state.rnd) : t
    const [r, g, b] = sampleGradient(spec.tint, tintT)
    sprite.material.color.setRGB(r, g, b, THREE.SRGBColorSpace)
    // `opacity` (opcional): o alfa fixo do `tinting` do Bedrock (ex.: 0.56)
    sprite.material.opacity =
      (spec.opacity ?? 1) * Math.min(1, (1 - t) / FADE_OUT_FRACTION)
    if (spec.facing !== 'direction') {
      sprite.material.rotation = state.spin * (Math.PI / 2) + (state.roll ?? 0)
    }
    const frame = frameAt(state.age, spec.frames, state.life)
    if (spec.vertical) {
      // quadro 0 é o de CIMA da imagem (convenção do Bedrock); no Three o
      // `offset.y` conta de baixo pra cima
      sprite.material.map.offset.y = 1 - (frame + 1) / spec.strip
    } else {
      sprite.material.map.offset.x = frame / spec.strip
    }
  }

  // Deita o quadro ao longo do movimento da partícula, com a face pra câmera.
  const beamBasis = {
    x: new THREE.Vector3(),
    y: new THREE.Vector3(),
    z: new THREE.Vector3(),
  }
  const beamMatrix = new THREE.Matrix4()
  function orientBeam(mesh, state) {
    const toCamera = cameraPosition
      ? [
          cameraPosition.x - state.x,
          cameraPosition.y - state.y,
          cameraPosition.z - state.z,
        ]
      : [0, 0, 1]
    const basis = resolveBeamBasis([state.vx, state.vy, state.vz], toCamera)
    beamBasis.x.fromArray(basis.x)
    beamBasis.y.fromArray(basis.y)
    beamBasis.z.fromArray(basis.z)
    beamMatrix.makeBasis(beamBasis.x, beamBasis.y, beamBasis.z)
    mesh.quaternion.setFromRotationMatrix(beamMatrix)
  }

  function isEmitting() {
    return runtimes.some(({ spec, burstDone }) => {
      if (spec.every) return !emissionEnded
      if (spec.burst !== undefined) return !burstDone
      if (spec.continuous) return !emissionEnded
      return time < spec.start + spec.duration
    })
  }

  return {
    group,
    update(delta) {
      time += delta
      runEmitters()
      for (let i = live.length - 1; i >= 0; i--) {
        const particle = live[i]
        const alive = particle.spec.path
          ? stepPathParticle(particle.spec, particle.state, delta)
          : stepParticle(particle.state, delta)
        if (alive) {
          render(particle)
        } else {
          releaseSprite(particle.spec, particle.sprite)
          live.splice(i, 1)
        }
      }
    },
    /**
     * Onde (e pra onde) os emissores soltam as partículas daqui pra frente:
     * `{ origin: [x, y, z], yaw, roll?, height }` no MUNDO — ver o cabeçalho.
     */
    setFrame(next) {
      frame = next
    },
    /** Posição da câmera (`{ x, y, z }`), pra orientar as linhas de velocidade. */
    setCameraPosition(position) {
      cameraPosition = position
    },
    /** Os emissores `continuous` param de soltar; o que existe termina sozinho. */
    endEmission() {
      emissionEnded = true
    },
    get emissionEnded() {
      return emissionEnded
    },
    /** `true` quando nenhum emissor tem mais o que soltar e não resta partícula viva. */
    isDone() {
      return !isEmitting() && live.length === 0
    },
    get liveCount() {
      return live.length
    },
    dispose() {
      for (const sprite of allSprites) {
        group.remove(sprite)
        sprite.material.map.dispose()
        sprite.material.dispose()
      }
      allSprites.length = 0
      live.length = 0
      pools.clear()
    },
  }
}
