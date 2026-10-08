import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import {
  getSpecies,
  listSpecies,
  resolveSpeciesKind,
  PLAYER_SPECIES_ID,
} from '../data/species'
import { criarPokemon, colocarNoTime } from '../actions/pokemon'
import { adicionarItem } from '../actions/inventory'
import {
  Position,
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  MovementStats,
  OrbitCamera,
  CameraTarget,
  PhysicsBody,
  CharacterController,
  AnimationState,
  ActionState,
  vitalsFromSpecies,
  HeldItem,
  Inventory,
  Party,
  TrainerBehavior,
  PartyActionMenu,
  SlotHold,
  PathState,
  Mood,
  ScanMode,
  CaptureAim,
  CaptureAimStatus,
  PokedexEntries,
  ScanHistory,
} from '../traits'

export const world = createWorld()

// Jogador é só mais uma entrada do registro de espécies — corpo (cápsula) e
// movimento (velocidades) vêm de lá, não são constante global. PLAYER_SPECIES_ID
// mora em core/data/species/index.js — único lugar que define isso, também
// usado por view/scene/PlayerView.jsx, pra nunca ficarem apontando pra
// espécies diferentes um do outro.
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

const vitals = vitalsFromSpecies(PLAYER_SPECIES)

// Kit de TESTE (docs/features/042-itens-da-beta.md): a Pokédex e todos os
// itens da beta. O kit de verdade é definido na 060.
const STARTING_ITEMS = {
  pokedex: 1,
  'poke-ball': 10,
  'great-ball': 5,
  'ultra-ball': 3,
  potion: 5,
  'super-potion': 3,
  'hyper-potion': 2,
  'razz-berry': 5,
  'nanab-berry': 3,
  'pinap-berry': 2,
}

// Quem começa no time, por slot. Os outros Pokémon iniciais (um de cada
// espécie `kind: 'pokemon'`) começam no inventário.
const STARTER_PARTY = {
  slot1: 'bulbasaur',
  slot2: 'charmander',
  slot3: 'squirtle',
}

export const playerEntity = world.spawn(
  Position({ x: 0, y: 2, z: 0 }),
  Rotation,
  Velocity,
  InputState,
  InputControlled,
  MovementStats(PLAYER_SPECIES.movement),
  CameraTarget,
  PhysicsBody,
  CharacterController(PLAYER_SPECIES.body),
  AnimationState,
  ActionState,
  vitals,
  // Começa com a Pokédex na mão; o kit e os Pokémon entram logo abaixo
  // (`giveStartingKit`).
  HeldItem({ itemId: 'pokedex' }),
  Inventory,
  Party,
  // Treinador numa luta fora do controle (`trainerBattleSystem.js`).
  TrainerBehavior,
  // Menu de ações treinador↔Pokémon (segurar Q/E/R) fechado.
  PartyActionMenu,
  SlotHold,
  ScanMode,
  // Mira da Pokébola (docs/features/043-captura.md), desligada.
  CaptureAim,
  CaptureAimStatus,
  // Coleção de espécies já escaneadas (aba "Pokémons") e histórico dos
  // últimos scans (aba "Histórico") — ambas vivem só no treinador, quem
  // de fato escaneia (ver core/actions/scanning.js). Default vazio.
  PokedexEntries,
  ScanHistory,
  // Default vazio — só passa a ter uso se o treinador virar "o bot",
  // seguindo uma criatura sob controle do jogador (ver
  // creatureFollowSystem.js e docs/features/018-troca-de-controle-
  // treinador-criatura.md). Toda SummonedCreature já tinha isso desde a
  // feature 017; falta aqui pro treinador poder ser seguidor também.
  PathState,
  // Default 'awake' — sem uso real pro treinador ainda (sem `eyeStates`
  // configurado pra ele), mesmo trait universal simples que
  // `AnimationState`/`ActionState`, ver docs/features/023-estado-de-
  // humor-e-piscar-de-olhos.md.
  Mood,
)

giveStartingKit(world, playerEntity)

/**
 * Kit inicial do treinador: os itens de `STARTING_ITEMS` e um Pokémon de cada
 * espécie `kind: 'pokemon'` (IV sorteado, nível inicial da espécie), com os
 * de `STARTER_PARTY` já no time.
 */
function giveStartingKit(world, trainer) {
  for (const [itemId, amount] of Object.entries(STARTING_ITEMS)) {
    adicionarItem(world, trainer, itemId, amount)
  }
  const pokemonSpecies = listSpecies().filter(
    (species) => resolveSpeciesKind(species) === 'pokemon',
  )
  const created = new Map()
  for (const species of pokemonSpecies) {
    created.set(species.id, criarPokemon(world, trainer, species.id))
  }
  for (const [slot, speciesId] of Object.entries(STARTER_PARTY)) {
    const pokemon = created.get(speciesId)
    if (pokemon) colocarNoTime(trainer, pokemon, slot)
  }
}

export const cameraEntity = world.spawn(
  OrbitCamera({
    yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
    pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
    distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
  }),
)
