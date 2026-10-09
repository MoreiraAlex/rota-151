import * as THREE from 'three'

// Vértices até esta fração da altura da folha, a partir do pé, contam como
// a raiz dela.
const ROOT_BAND = 0.05

/**
 * As folhas do tufo de grama (docs/features/049-vegetacao-e-floresta.md),
 * para o shader virar cada uma para a câmera: cada folha é um pedaço ligado
 * da malha (triângulos que dividem vértice, ou vértices no mesmo lugar). O
 * atributo `aBlade` (vec4, por vértice) leva, da folha do vértice, a raiz
 * (xyz — o meio do pé dela, no ponto mais baixo) e o giro (w — o ângulo,
 * no chão, da normal da folha; de 0 a π, a folha é de dois lados).
 *
 * @param {THREE.BufferGeometry} geometry - o tufo, com índice
 * @returns {THREE.BufferAttribute}
 */
export function bladePivotsOf(geometry) {
  const position = geometry.attributes.position
  const index = geometry.index
  const blades = groupBlades(position, index)
  const pivots = new Float32Array(position.count * 4)

  for (const vertices of blades) {
    const root = bladeRoot(position, vertices)
    const turn = bladeTurn(position, index, new Set(vertices))
    for (const vertex of vertices) {
      pivots.set([root.x, root.y, root.z, turn], vertex * 4)
    }
  }
  return new THREE.BufferAttribute(pivots, 4)
}

// Os vértices de cada folha (união pelos triângulos e pela posição).
function groupBlades(position, index) {
  const parent = Array.from({ length: position.count }, (_, i) => i)
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const join = (a, b) => {
    parent[find(a)] = find(b)
  }

  for (let i = 0; i < index.count; i += 3) {
    join(index.getX(i), index.getX(i + 1))
    join(index.getX(i), index.getX(i + 2))
  }
  const byPlace = new Map()
  for (let i = 0; i < position.count; i++) {
    const place = placeOf(position, i)
    if (byPlace.has(place)) join(i, byPlace.get(place))
    else byPlace.set(place, i)
  }

  const groups = new Map()
  for (let i = 0; i < position.count; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(i)
  }
  return [...groups.values()]
}

function bladeRoot(position, vertices) {
  const heights = vertices.map((vertex) => position.getY(vertex))
  const bottom = Math.min(...heights)
  const band = (Math.max(...heights) - bottom) * ROOT_BAND
  // Cada lugar uma vez só (vértice repetido na costura não puxa a média).
  const foot = new Map()
  for (const vertex of vertices) {
    if (position.getY(vertex) > bottom + band) continue
    foot.set(placeOf(position, vertex), vertex)
  }
  const sum = (axis) =>
    [...foot.values()].reduce(
      (total, vertex) => total + position[axis](vertex),
      0,
    )
  return { x: sum('getX') / foot.size, y: bottom, z: sum('getZ') / foot.size }
}

const placeOf = (position, vertex) =>
  [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
    .map((value) => value.toFixed(5))
    .join(',')

// A normal da folha no chão: média das normais dos triângulos em ângulo
// dobrado (a normal virada para o outro lado conta igual).
function bladeTurn(position, index, vertices) {
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let cos2 = 0
  let sin2 = 0
  for (let i = 0; i < index.count; i += 3) {
    if (!vertices.has(index.getX(i))) continue
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    const normal = b.sub(a).cross(c.sub(a))
    cos2 += normal.x * normal.x - normal.z * normal.z
    sin2 += 2 * normal.x * normal.z
  }
  const turn = Math.atan2(sin2, cos2) / 2
  return turn < 0 ? turn + Math.PI : turn
}
