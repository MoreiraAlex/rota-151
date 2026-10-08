/**
 * O nível de teste de antes do relevo (docs/features/045-terreno-de-um-
 * chunk.md): chão plano de 150 m (uma caixa, topo em y = 0, muros em ±75) com as peças
 * de sempre — parede em z = -7, degrau, bloco, rampa, plataforma, pilar,
 * corredor, pedras, a trilha de 4 terraços e os objetos de treino. Para os
 * testes de física/navegação que dependem dessas peças, no lugar do
 * `TEST_LEVEL` do jogo:
 *
 *   vi.mock('@/core/data/testLevel', async (importOriginal) => {
 *     const { withFlatTestLevel } = await import('@/test/flatTestLevel')
 *     return withFlatTestLevel(await importOriginal())
 *   })
 */

const SIZE = 150

const TRAINING_OBJECTS = [
  {
    id: 'training-log-1',
    kind: 'log',
    position: [-9, 0.6, -5],
    size: [0.8, 1.2, 0.8],
  },
  {
    id: 'training-rock-1',
    kind: 'rock',
    position: [9, 0.5, -6],
    size: [1.2, 1, 1.2],
  },
]

export const FLAT_TEST_OBSTACLES = [
  {
    id: 'boundary-north',
    type: 'box',
    position: [0, 2, -75],
    size: [151, 4, 1],
  },
  {
    id: 'boundary-south',
    type: 'box',
    position: [0, 2, 75],
    size: [151, 4, 1],
  },
  { id: 'boundary-east', type: 'box', position: [75, 2, 0], size: [1, 4, 151] },
  {
    id: 'boundary-west',
    type: 'box',
    position: [-75, 2, 0],
    size: [1, 4, 151],
  },
  { id: 'rock-1', type: 'box', position: [30, 0.75, 40], size: [2, 1.5, 2] },
  { id: 'rock-2', type: 'box', position: [45, 1, -20], size: [3, 2, 2.5] },
  {
    id: 'rock-3',
    type: 'box',
    position: [-40, 0.6, -35],
    size: [1.8, 1.2, 1.8],
  },
  { id: 'rock-4', type: 'box', position: [-55, 1.1, 30], size: [2.5, 2.2, 2] },
  { id: 'rock-5', type: 'box', position: [20, 0.9, -50], size: [2, 1.8, 3] },
  {
    id: 'rock-6',
    type: 'box',
    position: [-25, 0.7, 55],
    size: [2.2, 1.4, 2.2],
  },
  { id: 'rock-7', type: 'box', position: [55, 0.8, 55], size: [1.6, 1.6, 1.6] },
  { id: 'rock-8', type: 'box', position: [-60, 0.9, -55], size: [2.8, 1.8, 2] },
  { id: 'wall', type: 'box', position: [0, 1, -7], size: [10, 2, 0.5] },
  { id: 'step-low', type: 'box', position: [-6, 0.15, 1], size: [3, 0.3, 3] },
  { id: 'block-high', type: 'box', position: [-6, 0.75, 5], size: [3, 1.5, 3] },
  {
    id: 'ramp',
    type: 'ramp',
    position: [6, 0.55, 0],
    size: [5, 0.3, 3],
    rotation: { axis: 'z', angle: 0.32 },
  },
  {
    id: 'platform',
    type: 'floor',
    position: [10.5, 0.9, 0],
    size: [4, 1.8, 3],
  },
  { id: 'pillar', type: 'box', position: [3, 1.5, -1], size: [1, 3, 1] },
  {
    id: 'corridor-wall-left',
    type: 'box',
    position: [-2, 1.25, -14],
    size: [0.5, 2.5, 8],
  },
  {
    id: 'corridor-wall-right',
    type: 'box',
    position: [2, 1.25, -14],
    size: [0.5, 5, 8],
  },
  {
    id: 'ramp0-a',
    type: 'ramp',
    position: [-26.137, 0.9, 15],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  {
    id: 'ramp0-b',
    type: 'ramp',
    position: [-26.137, 0.9, 25],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  {
    id: 'spine0',
    type: 'box',
    position: [-26.137, 4, 20],
    size: [3.726, 8, 6],
  },
  {
    id: 'tier1',
    type: 'floor',
    position: [-21.774, 0.9, 20],
    size: [5, 1.8, 14],
  },
  {
    id: 'ramp1-a',
    type: 'ramp',
    position: [-17.411, 2.7, 15],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  {
    id: 'ramp1-b',
    type: 'ramp',
    position: [-17.411, 2.7, 25],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  {
    id: 'spine1',
    type: 'box',
    position: [-17.411, 4, 20],
    size: [3.726, 8, 6],
  },
  {
    id: 'tier2',
    type: 'floor',
    position: [-13.047, 1.8, 20],
    size: [5, 3.6, 14],
  },
  {
    id: 'ramp2-a',
    type: 'ramp',
    position: [-8.684, 4.5, 15],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  {
    id: 'ramp2-b',
    type: 'ramp',
    position: [-8.684, 4.5, 25],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  { id: 'spine2', type: 'box', position: [-8.684, 4, 20], size: [3.726, 8, 6] },
  {
    id: 'tier3',
    type: 'floor',
    position: [-4.321, 2.7, 20],
    size: [5, 5.4, 14],
  },
  {
    id: 'ramp3-a',
    type: 'ramp',
    position: [0.042, 6.3, 15],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  {
    id: 'ramp3-b',
    type: 'ramp',
    position: [0.042, 6.3, 25],
    size: [4.138, 0.3, 4],
    rotation: { axis: 'z', angle: 0.45 },
  },
  { id: 'spine3', type: 'box', position: [0.042, 4, 20], size: [3.726, 8, 6] },
  {
    id: 'tier4',
    type: 'floor',
    position: [4.405, 3.6, 20],
    size: [5, 7.2, 14],
  },
  ...TRAINING_OBJECTS.map(({ id, kind, position, size }) => ({
    id,
    type: 'box',
    position,
    size,
    trainingKind: kind,
  })),
]

// Sem chunk de relevo: o chão é uma caixa (a de antes), não heightfield — o
// Rapier erra raios em células PLANAS de heightfield (medido em 0.20), e
// aqui seria tudo plano. O `heightAt` plano segue valendo pra navegação.
const GROUND = {
  id: 'ground',
  type: 'box',
  position: [0, -0.5, 0],
  size: [SIZE, 1, SIZE],
}

// Um relevo plano sem chunk carregável: a área toda conta como carregada
// (ninguém congela) e o chão é a caixa `GROUND`.
function flatTerrain() {
  return {
    heightAt: () => 0,
    isLoaded: () => true,
    isLoadedAt: () => true,
    loadedChunks: () => [],
  }
}

/** O nível plano: `{ terrain, bounds, obstacles, trainingObjects }`. */
export function makeFlatTestLevel() {
  const half = SIZE / 2
  return {
    terrain: flatTerrain(),
    bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
    obstacles: [GROUND, ...FLAT_TEST_OBSTACLES],
    trainingObjects: TRAINING_OBJECTS,
  }
}

/**
 * O módulo `core/data/testLevel` com o `TEST_LEVEL` trocado pelo nível plano
 * (o resto do nível — som, selvagens — fica o do jogo).
 */
export function withFlatTestLevel(actualModule) {
  return {
    ...actualModule,
    TEST_LEVEL: { ...actualModule.TEST_LEVEL, ...makeFlatTestLevel() },
  }
}
