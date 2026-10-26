/**
 * Relevo do chão do laboratório de golpes (docs/features/061-revisao-das-
 * skills.md): um perfil ao longo de Z (a linha atacante → alvo), igual em
 * todo X — morro, degrau ou rampa entre os dois, pra ver o golpe em alturas
 * diferentes. A mesma conta gera o colisor (malha de triângulos) e o desenho.
 *
 * `relief`: `{ kind, height, center, length }` — `center` é a fração da
 * distância atacante → alvo onde o relevo fica (0 = no atacante, 1 = no
 * alvo), `length` o comprimento (m) ao longo da linha e `height` a altura
 * (m; negativa = buraco/descida).
 */

export const RELIEF_KINDS = {
  none: 'nenhum',
  hill: 'morro',
  step: 'degrau',
  ramp: 'rampa',
}

// Passo (m) da malha ao longo de Z, e a folga do "paredão" do degrau.
const SAMPLE_STEP = 0.1
const WALL_WIDTH = 1e-3

/** Relevo resolvido no mundo: `center` em metros de Z. */
export function resolveRelief(relief, distance) {
  if (!relief || relief.kind === 'none') return { kind: 'none' }
  return {
    kind: relief.kind,
    height: relief.height,
    center: relief.center * distance,
    length: Math.max(relief.length, SAMPLE_STEP),
  }
}

/** Altura (m) do chão em `z` (o relevo é igual em todo X). */
export function reliefHeightAt(relief, z) {
  if (!relief || relief.kind === 'none') return 0
  const { kind, height, center, length } = relief
  const offset = z - center
  const half = length / 2
  switch (kind) {
    case 'hill':
      if (Math.abs(offset) >= half) return 0
      return (height * (1 + Math.cos((Math.PI * offset) / half))) / 2
    case 'ramp':
      if (offset <= -half) return 0
      if (offset >= half) return height
      return (height * (offset + half)) / length
    case 'step':
      return offset >= 0 ? height : 0
    default:
      return 0
  }
}

// Onde amostrar Z: a grade regular mais as quinas do perfil.
function sampleZs(relief, size) {
  const half = size / 2
  const zs = new Set()
  for (let z = -half; z <= half + 1e-9; z += SAMPLE_STEP) {
    zs.add(Number(z.toFixed(4)))
  }
  if (relief.kind !== 'none') {
    const { center, length } = relief
    for (const z of [center - length / 2, center, center + length / 2]) {
      if (Math.abs(z) < half) zs.add(z)
    }
    if (relief.kind === 'step') zs.add(relief.center - WALL_WIDTH)
  }
  return [...zs].sort((a, b) => a - b)
}

/**
 * Malha do chão (`size` × `size`, centrada na origem): uma faixa de dois
 * vértices (as bordas em X) por amostra de Z. `{ vertices, indices }` prontos
 * pro `ColliderDesc.trimesh` do Rapier e pro `BufferGeometry`.
 */
export function buildReliefMesh(relief, size) {
  const half = size / 2
  const zs = sampleZs(relief, size)
  const vertices = new Float32Array(zs.length * 2 * 3)
  zs.forEach((z, i) => {
    const y = reliefHeightAt(relief, z)
    vertices.set([-half, y, z, half, y, z], i * 6)
  })
  const indices = new Uint32Array((zs.length - 1) * 6)
  for (let i = 0; i < zs.length - 1; i++) {
    const a = i * 2
    // dois triângulos por faixa, virados pra cima
    indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6)
  }
  return { vertices, indices }
}

/**
 * Linhas da grade (uma a cada `spacing` m) desenhadas em cima do relevo, a
 * `lift` m dele.
 */
export function buildReliefGrid(relief, size, lift = 0, spacing = 1) {
  const half = size / 2
  const zs = sampleZs(relief, size)
  const points = []
  const lines = Math.round(size / spacing)
  // linhas ao longo de X (retas, na altura do Z delas)
  for (let i = 0; i <= lines; i++) {
    const z = -half + i * spacing
    const y = reliefHeightAt(relief, z) + lift
    points.push(-half, y, z, half, y, z)
  }
  // linhas ao longo de Z (seguem o perfil)
  for (let i = 0; i <= lines; i++) {
    const x = -half + i * spacing
    for (let k = 0; k < zs.length - 1; k++) {
      points.push(
        x,
        reliefHeightAt(relief, zs[k]) + lift,
        zs[k],
        x,
        reliefHeightAt(relief, zs[k + 1]) + lift,
        zs[k + 1],
      )
    }
  }
  return new Float32Array(points)
}
