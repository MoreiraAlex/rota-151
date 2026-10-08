import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed, randomInt } from '../rng'
import { createTerrainArea } from '../terrain/terrainArea'
import { verticalClearance } from '../physics/capsule'
import { getSpecies } from './species'

/**
 * Nível de teste.
 *
 * Fonte única: os colliders (core/physics), a grade de pathfinding
 * (core/pathfinding.js) e os meshes (view/scene/GameScene) são gerados a
 * partir daqui, então o visível bate com o colidível/andável.
 *
 * - terrain: o relevo — área fixa de chunks gerada pela seed do mundo
 *   (`core/terrain/terrainArea.js`, docs/features/045-terreno-de-um-chunk.md).
 * - bounds: limites da área andável ({ minX, maxX, minZ, maxZ }), os mesmos
 *   do terreno; a grade de pathfinding cobre isso.
 * - obstacles: `{ id, type: 'box' | 'ramp' | 'floor', position, size,
 *   rotation? }` — position é o centro.
 * - size: dimensões completas [largura(x), altura(y), profundidade(z)], em unidades.
 * - rotation (opcional): giro em um eixo — { axis: 'x' | 'y' | 'z', angle } (rad).
 * - ambientSound (opcional): som ambiente ESPORÁDICO do nível — toca uma
 *   variação aleatória de `clips` de vez em quando (intervalo também
 *   aleatório, entre `minInterval`/`maxInterval`), não uma faixa em loop
 *   contínuo (ver `core/data/audio/ambientSound.js`/`view/audio/
 *   AmbientAudio.jsx`/docs/features/019-som-ambiente-e-passos.md pro
 *   porquê). Sem este campo, o jogo fica em silêncio ambiente (mesmo
 *   fallback gracioso de qualquer conteúdo que ainda não existe).
 * - wildCreatures (opcional): criaturas selvagens spawnadas UMA VEZ pelo
 *   `wildCreatureSpawnSystem.js` no início do jogo — `{ id, speciesId,
 *   position: [x,y,z], levelRange? }`. `levelRange: [min, max]` (opcional)
 *   é a faixa do nível sorteado no spawn; sem ela, a padrão
 *   (`GAME_CONFIG.EXPERIENCE.WILD_LEVEL_MIN/MAX`). Vagam sozinhas (`wildWanderSystem.js`), sem
 *   pertencer ao time do treinador. Ver docs/features/020-fox-selvagens-
 *   cena-e-texturas.md.
 * - trainingObjects (opcional): objetos de treino fixos (tronco, pedra,
 *   boneco) — `{ id, kind, position, size }`. Perto de um deles a criatura do
 *   time pode treinar um golpe (docs/features/038-aprendizado-treino-e-
 *   dominio-de-golpes.md). Também entram em `obstacles` (colisão, pathfind e
 *   mesh, com a cor do `kind`) — ver `TRAINING_OBJECTS` abaixo.
 */

const WILD_CREATURE_COUNT = 10

const WILD_CREATURE_SPECIES = ['bulbasaur', 'charmander', 'squirtle']

// Distância (m) da borda da área em que nenhum selvagem nasce.
const WILD_AREA_MARGIN = 12

// Muros provisórios na borda da área — sem eles, sair do terreno é queda
// livre (não há chão fora da área). Saem com o carregar de chunks (046).
// Espessura (m) e quanto sobem (m) acima do ponto mais alto do relevo.
const WALL_THICKNESS = 1
const WALL_HEIGHT = 4

// Objetos de treino (ver `trainingObjects` no cabeçalho) — x/z fixos, o y
// vem do relevo.
const TRAINING_SPOTS = [
  { id: 'training-log-1', kind: 'log', x: -9, z: -5, size: [0.8, 1.2, 0.8] },
  { id: 'training-rock-1', kind: 'rock', x: 9, z: -6, size: [1.2, 1, 1.2] },
]

const generateTerrain = () =>
  createTerrainArea({ seed: deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain') })

// Chão mais baixo debaixo de uma caixa (centro e cantos) — a caixa nunca
// fica com um canto flutuando numa encosta.
const groundUnder = (terrain, x, z, halfW, halfD) =>
  Math.min(
    terrain.heightAt(x, z),
    terrain.heightAt(x - halfW, z - halfD),
    terrain.heightAt(x + halfW, z - halfD),
    terrain.heightAt(x - halfW, z + halfD),
    terrain.heightAt(x + halfW, z + halfD),
  )

// Sorteio de geração (regra 3.5): mesmas selvagens, nos mesmos lugares, a
// cada vez que o jogo abre.
function generateWildCreatures(terrain, count) {
  const rng = createRng(deriveSeed(GAME_CONFIG.WORLD.SEED, 'wild-spawn'))
  const { minX, maxX, minZ, maxZ } = terrain.bounds
  const between = (min, max) =>
    min + WILD_AREA_MARGIN + rng() * (max - min - 2 * WILD_AREA_MARGIN)

  return Array.from({ length: count }, (_, index) => {
    const speciesId =
      WILD_CREATURE_SPECIES[randomInt(rng, 0, WILD_CREATURE_SPECIES.length - 1)]
    const x = between(minX, maxX)
    const z = between(minZ, maxZ)
    // Pés acima do chão (o centro fica a `verticalClearance` deles).
    const y =
      terrain.heightAt(x, z) +
      verticalClearance(getSpecies(speciesId).body) +
      GAME_CONFIG.TERRAIN.SPAWN_HEIGHT
    return { id: `wild-${index + 1}`, speciesId, position: [x, y, z] }
  })
}

// Objetos de treino apoiados no relevo.
const placeTrainingObjects = (terrain) =>
  TRAINING_SPOTS.map(({ id, kind, x, z, size }) => {
    const [w, h, d] = size
    const y = groundUnder(terrain, x, z, w / 2, d / 2) + h / 2
    return { id, kind, position: [x, y, z], size }
  })

// Os objetos de treino viram também obstáculos `box` comuns — sem mecanismo
// novo em colliders/pathfinding/mesh.
const trainingObstacles = (trainingObjects) =>
  trainingObjects.map(({ id, kind, position, size }) => ({
    id,
    type: 'box',
    position,
    size,
    trainingKind: kind,
  }))

function generateBoundaryWalls(terrain) {
  const { minX, maxX, minZ, maxZ } = terrain.bounds
  const bottom = terrain.minHeight
  const top = terrain.maxHeight + WALL_HEIGHT
  const y = (bottom + top) / 2
  const height = top - bottom
  const width = maxX - minX + WALL_THICKNESS
  const depth = maxZ - minZ + WALL_THICKNESS
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2

  return [
    {
      id: 'boundary-north',
      position: [centerX, y, minZ],
      size: [width, height, WALL_THICKNESS],
    },
    {
      id: 'boundary-south',
      position: [centerX, y, maxZ],
      size: [width, height, WALL_THICKNESS],
    },
    {
      id: 'boundary-east',
      position: [maxX, y, centerZ],
      size: [WALL_THICKNESS, height, depth],
    },
    {
      id: 'boundary-west',
      position: [minX, y, centerZ],
      size: [WALL_THICKNESS, height, depth],
    },
  ].map((wall) => ({ ...wall, type: 'box' }))
}

// Tudo do nível que sai do relevo.
function buildTerrainDependentLevel() {
  const terrain = generateTerrain()
  const trainingObjects = placeTrainingObjects(terrain)
  return {
    terrain,
    bounds: terrain.bounds,
    obstacles: [
      ...generateBoundaryWalls(terrain),
      ...trainingObstacles(trainingObjects),
    ],
    trainingObjects,
  }
}

const initialLevel = buildTerrainDependentLevel()

export const TEST_LEVEL = {
  ambientSound: {
    clips: [
      '/assets/audio/ambient/wind-01.wav',
      '/assets/audio/ambient/wind-02.wav',
    ],
    volume: 0.02,
    minInterval: 2,
    maxInterval: 5,
  },
  ...initialLevel,
  wildCreatures: generateWildCreatures(
    initialLevel.terrain,
    WILD_CREATURE_COUNT,
  ),
}

// Ajuste do relevo em tempo real (debug — `regenerarTerreno`,
// core/actions/terrain.js): quem desenha o nível assina as mudanças.
let levelRevision = 0
const levelListeners = new Set()

/** Número que muda a cada vez que o relevo do nível é refeito. */
export function getLevelRevision() {
  return levelRevision
}

/** Avisa `listener` quando o relevo do nível é refeito; devolve o cancelar. */
export function subscribeLevelChanges(listener) {
  levelListeners.add(listener)
  return () => levelListeners.delete(listener)
}

/**
 * Refaz, com a config atual (`GAME_CONFIG.TERRAIN`/`WORLD.SEED`), tudo do
 * nível que sai do relevo: o terreno, os limites, os muros e os objetos de
 * treino. Os selvagens já nascidos ficam (quem os sobe para a superfície é
 * `regenerarTerreno`). Só a ferramenta de debug chama isto.
 */
export function rebuildTerrainDependentLevel() {
  Object.assign(TEST_LEVEL, buildTerrainDependentLevel())
  levelRevision += 1
  for (const listener of levelListeners) listener()
}
