import { GAME_CONFIG } from '../gameConfig'
import { createRng, deriveSeed, randomInt } from '../rng'
import { createTerrainChunkSet } from '../terrain/terrainChunkSet'
import { verticalClearance } from '../physics/capsule'
import { getSpecies } from './species'

/**
 * Nível de teste.
 *
 * Fonte única: os colliders (core/physics), a grade de pathfinding
 * (core/pathfinding.js) e os meshes (view/scene/GameScene) são gerados a
 * partir daqui, então o visível bate com o colidível/andável.
 *
 * - terrain: o relevo — os chunks carregados agora, gerados pela seed do
 *   mundo (`core/terrain/terrainChunkSet.js`, docs/features/046-sistema-
 *   de-chunks.md). O mundo não tem borda: quem carrega e descarrega é o
 *   `chunkStreamingSystem`. Um nível sem chunks (os dos testes) pode ter
 *   `bounds` ({ minX, maxX, minZ, maxZ }): a área fixa que a grade de
 *   pathfinding cobre.
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

// Metade do lado (m) do quadrado em volta da origem onde os selvagens
// nascem — provisório até o spawn por chunk (053).
const WILD_AREA_HALF_SIZE = 84

// Objetos de treino (ver `trainingObjects` no cabeçalho) — x/z fixos, o y
// vem do relevo.
const TRAINING_SPOTS = [
  { id: 'training-log-1', kind: 'log', x: -9, z: -5, size: [0.8, 1.2, 0.8] },
  { id: 'training-rock-1', kind: 'rock', x: 9, z: -6, size: [1.2, 1, 1.2] },
]

const terrainSeed = () => deriveSeed(GAME_CONFIG.WORLD.SEED, 'terrain')

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
  const between = (min, max) => min + rng() * (max - min)

  return Array.from({ length: count }, (_, index) => {
    const speciesId =
      WILD_CREATURE_SPECIES[randomInt(rng, 0, WILD_CREATURE_SPECIES.length - 1)]
    const x = between(-WILD_AREA_HALF_SIZE, WILD_AREA_HALF_SIZE)
    const z = between(-WILD_AREA_HALF_SIZE, WILD_AREA_HALF_SIZE)
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

// O que sai da altura do relevo (não depende de chunk carregado).
function buildTerrainDependentLevel(terrain) {
  const trainingObjects = placeTrainingObjects(terrain)
  return {
    obstacles: trainingObstacles(trainingObjects),
    trainingObjects,
  }
}

const terrain = createTerrainChunkSet({ seed: terrainSeed() })
const initialLevel = buildTerrainDependentLevel(terrain)

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
  terrain,
  ...initialLevel,
  wildCreatures: generateWildCreatures(terrain, WILD_CREATURE_COUNT),
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
 * Refaz, com a config atual (`GAME_CONFIG.TERRAIN`/`BIOMES`/`WORLD.SEED` e
 * os biomas do registro), tudo do nível que sai do relevo: a receita do
 * terreno e os objetos de treino. Só
 * com nenhum chunk carregado (quem descarrega antes é `regenerarTerreno`).
 * Os selvagens já nascidos ficam (quem os sobe para a superfície é
 * `regenerarTerreno`). Só a ferramenta de debug chama isto.
 */
export function rebuildTerrainDependentLevel() {
  TEST_LEVEL.terrain.reconfigure(terrainSeed())
  Object.assign(TEST_LEVEL, buildTerrainDependentLevel(TEST_LEVEL.terrain))
  levelRevision += 1
  for (const listener of levelListeners) listener()
}
