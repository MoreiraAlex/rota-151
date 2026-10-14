/**
 * Separa malhas fundidas: nos mapas do Let's Go todas as árvores (ou
 * plantas, pedras) de um tipo vêm numa malha só por material. Junta os
 * vértices em pedaços ligados (pelos triângulos) e os pedaços em objetos
 * quando as caixas deles se encostam no chão (XZ). Um tronco e a copa em
 * malhas diferentes viram o mesmo objeto (`clusterObjects` recebe os
 * pedaços de todas).
 */

function unionFind(count) {
  const parent = Int32Array.from({ length: count }, (_, i) => i)
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
  return { find, join }
}

/**
 * Pedaços ligados de uma malha: `{ boxes, vertexPiece }` — a caixa
 * `[minX, minY, minZ, maxX, maxY, maxZ]` de cada pedaço e o pedaço de cada
 * vértice.
 */
export function piecesOf(position, faceLists) {
  const vertexCount = position.length / 3
  const { find, join } = unionFind(vertexCount)
  for (const faces of faceLists) {
    for (let i = 0; i < faces.length; i += 3) {
      join(faces[i], faces[i + 1])
      join(faces[i + 2], faces[i + 1])
    }
  }
  const ids = new Map()
  const vertexPiece = new Int32Array(vertexCount)
  const boxes = []
  for (let v = 0; v < vertexCount; v++) {
    const root = find(v)
    if (!ids.has(root)) {
      ids.set(root, boxes.length)
      boxes.push([
        Infinity,
        Infinity,
        Infinity,
        -Infinity,
        -Infinity,
        -Infinity,
      ])
    }
    const piece = ids.get(root)
    vertexPiece[v] = piece
    const box = boxes[piece]
    for (let c = 0; c < 3; c++) {
      box[c] = Math.min(box[c], position[v * 3 + c])
      box[c + 3] = Math.max(box[c + 3], position[v * 3 + c])
    }
  }
  return { boxes, vertexPiece }
}

const touches = (a, b, margin) =>
  a[0] - margin <= b[3] &&
  b[0] - margin <= a[3] &&
  a[2] - margin <= b[5] &&
  b[2] - margin <= a[5]

/** Objetos a partir das caixas dos pedaços: o objeto de cada pedaço e a caixa de cada objeto. */
export function clusterObjects(boxes, margin = 0) {
  const { find, join } = unionFind(boxes.length)
  const cell = 200
  const grid = new Map()
  boxes.forEach((box, i) => {
    for (
      let gx = Math.floor((box[0] - margin) / cell);
      gx <= Math.floor((box[3] + margin) / cell);
      gx++
    ) {
      for (
        let gz = Math.floor((box[2] - margin) / cell);
        gz <= Math.floor((box[5] + margin) / cell);
        gz++
      ) {
        const key = `${gx},${gz}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(i)
      }
    }
  })
  for (const list of grid.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (touches(boxes[list[i]], boxes[list[j]], margin))
          join(list[i], list[j])
      }
    }
  }
  const ids = new Map()
  const pieceObject = new Int32Array(boxes.length)
  const objectBoxes = []
  boxes.forEach((box, i) => {
    const root = find(i)
    if (!ids.has(root)) {
      ids.set(root, objectBoxes.length)
      objectBoxes.push([
        Infinity,
        Infinity,
        Infinity,
        -Infinity,
        -Infinity,
        -Infinity,
      ])
    }
    const object = ids.get(root)
    pieceObject[i] = object
    const target = objectBoxes[object]
    for (let c = 0; c < 3; c++) {
      target[c] = Math.min(target[c], box[c])
      target[c + 3] = Math.max(target[c + 3], box[c + 3])
    }
  })
  return { pieceObject, objectBoxes }
}

/** Assinatura de tamanho (arredondada em `step`) — objetos iguais têm a mesma. */
export const sizeSignature = (box, step = 10) =>
  [box[3] - box[0], box[4] - box[1], box[5] - box[2]]
    .map((value) => Math.round(value / step) * step)
    .join('x')
