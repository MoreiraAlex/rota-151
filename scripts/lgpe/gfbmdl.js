import { rootTable } from './flatbuffers.js'

/**
 * Leitura do `.gfbmdl` (modelo da Game Freak no Switch — Let's Go), pelo
 * schema do gfbmdl_tools (`file_formats/gfbmdl.fbs`, lincoln-lm). Posições
 * em centímetros, Y para cima.
 */

// Bytes de cada componente, pelo `BufferFormat`.
export const FORMAT_SIZE = { 0: 4, 1: 2, 3: 1, 5: 2, 8: 1 }

// `VertexType` → nome do atributo.
const ATTRIBUTE_NAMES = {
  0: 'position',
  1: 'normal',
  2: 'tangent',
  3: 'uv0',
  4: 'uv1',
  5: 'uv2',
  7: 'color0',
  8: 'color1',
  11: 'joints',
  12: 'weights',
}

const entriesOf = (tables, read) =>
  Object.fromEntries(tables.map((entry) => [entry.string(0), read(entry)]))

function readMaterial(table) {
  const common = table.table(20)
  return {
    name: table.string(0),
    shader: table.string(1),
    blendMode: table.i32(6),
    cullMode: table.i32(7),
    textures: table.tables(11).map((map) => {
      const params = map.table(2)
      return {
        sampler: map.string(0),
        index: map.i32(1),
        wrapX: params ? params.u32(1) : 0,
        wrapY: params ? params.u32(2) : 0,
      }
    }),
    switches: entriesOf(table.tables(12), (entry) => Boolean(entry.u8(1))),
    values: entriesOf(table.tables(13), (entry) => entry.f32(1)),
    colors: entriesOf(table.tables(14), (entry) => entry.floats(1, 3)),
    commonValues: common ? entriesOf(common.tables(1), (e) => e.i32(1)) : {},
  }
}

function readMesh(table) {
  const attributes = table.tables(1).map((attribute) => ({
    type: attribute.u32(0),
    format: attribute.u32(1),
    count: attribute.u32(2),
  }))
  const stride = attributes.reduce(
    (sum, { format, count }) => sum + FORMAT_SIZE[format] * count,
    0,
  )
  const data = table.bytes(2)
  return {
    attributes,
    stride,
    data,
    vertexCount: data.length / stride,
    polygons: table.tables(0).map((polygon) => ({
      materialIndex: polygon.u32(0),
      faces: polygon.u16s(1),
    })),
  }
}

export function parseGfbmdl(buffer) {
  const model = rootTable(buffer)
  return {
    version: model.u32(0),
    bounding: model.floats(1, 6),
    textureNames: model.strings(2),
    materials: model.tables(6).map(readMaterial),
    groups: model.tables(7).map((group) => ({
      boneIndex: group.u32(0),
      meshIndex: group.u32(1),
    })),
    meshes: model.tables(8).map(readMesh),
    bones: model.tables(9).map((bone) => ({
      name: bone.string(0),
      parent: bone.i32(2, -1),
      scale: bone.floats(5, 3) ?? [1, 1, 1],
      rotation: bone.floats(6, 3) ?? [0, 0, 0],
      translation: bone.floats(7, 3) ?? [0, 0, 0],
    })),
  }
}

function halfToFloat(bits) {
  const sign = bits & 0x8000 ? -1 : 1
  const exponent = (bits & 0x7c00) >> 10
  const fraction = bits & 0x03ff
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024)
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024)
}

function readComponent(data, at, format) {
  switch (format) {
    case 0:
      return data.readFloatLE(at)
    case 1:
      return halfToFloat(data.readUInt16LE(at))
    case 3:
      return data.readUInt8(at)
    case 5:
      return data.readInt16LE(at)
    case 8:
      return data.readUInt8(at) / 255
  }
  throw new Error(`formato de vértice desconhecido: ${format}`)
}

/**
 * Os atributos de uma malha, cada um num `Float32Array` (`size`
 * componentes por vértice). A cor (`color0`) fica de 0 a 255.
 */
export function decodeVertices(mesh) {
  const decoded = {}
  let offset = 0
  for (const { type, format, count } of mesh.attributes) {
    const name = ATTRIBUTE_NAMES[type] ?? `attribute${type}`
    const array = new Float32Array(mesh.vertexCount * count)
    for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
      for (let component = 0; component < count; component++) {
        const at =
          vertex * mesh.stride + offset + component * FORMAT_SIZE[format]
        array[vertex * count + component] = readComponent(mesh.data, at, format)
      }
    }
    decoded[name] = { array, size: count }
    offset += FORMAT_SIZE[format] * count
  }
  return decoded
}

/** Caminho do osso (os nomes de hash da exportação ficam de fora). */
export function bonePath(model, boneIndex) {
  const names = []
  for (let i = boneIndex; i >= 0; i = model.bones[i].parent) {
    names.unshift(model.bones[i].name)
  }
  return names
    .slice(1)
    .filter((name) => !/^[0-9a-f]{12,}$/.test(name))
    .join('/')
}
