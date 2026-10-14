/**
 * Grava um `.glb` (glTF 2.0 binário) simples: um nó, uma malha, uma
 * primitiva por material (só o nome do material — as texturas e o resto
 * ficam no manifesto, a página monta o material).
 *
 * @typedef {object} Primitive
 * @property {string} material
 * @property {Float32Array} position
 * @property {Float32Array} [normal]
 * @property {Float32Array} [uv0]
 * @property {Float32Array} [uv1]
 * @property {Uint8Array} [color] - RGBA 0–255 por vértice
 * @property {Uint32Array} indices
 */

const FLOAT = 5126
const UNSIGNED_BYTE = 5121
const UNSIGNED_SHORT = 5123
const UNSIGNED_INT = 5125

const pad4 = (length) => (length + 3) & ~3

function boundsOf(position) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < position.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c], position[i + c])
      max[c] = Math.max(max[c], position[i + c])
    }
  }
  return { min, max }
}

/** @param {Primitive[]} primitives */
export function writeGlb(name, primitives) {
  const chunks = []
  const bufferViews = []
  const accessors = []
  let byteLength = 0

  function addView(typed, target) {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)
    bufferViews.push({
      buffer: 0,
      byteOffset: byteLength,
      byteLength: bytes.length,
      target,
    })
    chunks.push(bytes, Buffer.alloc(pad4(bytes.length) - bytes.length))
    byteLength += pad4(bytes.length)
    return bufferViews.length - 1
  }

  function addAccessor(
    typed,
    { type, componentType, normalized, target, bounds },
  ) {
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type]
    const accessor = {
      bufferView: addView(typed, target),
      componentType,
      count: typed.length / components,
      type,
    }
    if (normalized) accessor.normalized = true
    if (bounds) Object.assign(accessor, bounds)
    accessors.push(accessor)
    return accessors.length - 1
  }

  const materialNames = [...new Set(primitives.map(({ material }) => material))]
  const meshPrimitives = primitives.map((primitive) => {
    const attributes = {
      POSITION: addAccessor(primitive.position, {
        type: 'VEC3',
        componentType: FLOAT,
        target: 34962,
        bounds: boundsOf(primitive.position),
      }),
    }
    if (primitive.normal) {
      attributes.NORMAL = addAccessor(primitive.normal, {
        type: 'VEC3',
        componentType: FLOAT,
        target: 34962,
      })
    }
    if (primitive.uv0) {
      attributes.TEXCOORD_0 = addAccessor(primitive.uv0, {
        type: 'VEC2',
        componentType: FLOAT,
        target: 34962,
      })
    }
    if (primitive.uv1) {
      attributes.TEXCOORD_1 = addAccessor(primitive.uv1, {
        type: 'VEC2',
        componentType: FLOAT,
        target: 34962,
      })
    }
    if (primitive.color) {
      attributes.COLOR_0 = addAccessor(primitive.color, {
        type: 'VEC4',
        componentType: UNSIGNED_BYTE,
        normalized: true,
        target: 34962,
      })
    }
    const vertexCount = primitive.position.length / 3
    const indices =
      vertexCount <= 65535
        ? Uint16Array.from(primitive.indices)
        : primitive.indices
    return {
      attributes,
      indices: addAccessor(indices, {
        type: 'SCALAR',
        componentType: vertexCount <= 65535 ? UNSIGNED_SHORT : UNSIGNED_INT,
        target: 34963,
      }),
      material: materialNames.indexOf(primitive.material),
    }
  })

  const json = {
    asset: { version: '2.0', generator: 'rota-151 scripts/lgpe' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: meshPrimitives }],
    materials: materialNames.map((materialName) => ({
      name: materialName,
      pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 },
    })),
    buffers: [{ byteLength }],
    bufferViews,
    accessors,
  }

  const jsonBytes = Buffer.from(JSON.stringify(json))
  const jsonChunk = Buffer.concat([
    jsonBytes,
    Buffer.alloc(pad4(jsonBytes.length) - jsonBytes.length, 0x20),
  ])
  const binChunk = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunkHeader = (length, type) => {
    const buffer = Buffer.alloc(8)
    buffer.writeUInt32LE(length, 0)
    buffer.writeUInt32LE(type, 4)
    return buffer
  }
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, 0x4e4f534a),
    jsonChunk,
    chunkHeader(binChunk.length, 0x004e4942),
    binChunk,
  ])
}

/**
 * As posições de cada primitiva de um `.glb` gravado por `writeGlb` (um nó,
 * uma malha, atributos sem intercalar): `[{ material, position }]`.
 */
export function readGlbPositions(bytes) {
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  const binStart = 20 + jsonLength + 8
  return json.meshes[0].primitives.map((primitive) => {
    const accessor = json.accessors[primitive.attributes.POSITION]
    const view = json.bufferViews[accessor.bufferView]
    const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const position = new Float32Array(accessor.count * 3)
    for (let i = 0; i < position.length; i++) {
      position[i] = bytes.readFloatLE(start + i * 4)
    }
    return { material: json.materials[primitive.material].name, position }
  })
}
