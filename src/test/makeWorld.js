import { createWorld } from 'koota'
import { GAME_CONFIG } from '@/core/gameConfig'
import { getSpecies } from '@/core/data/species'
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
  PartyIndividualValues,
  PathState,
  ScanMode,
  PokedexEntries,
  ScanHistory,
} from '@/core/traits'

// Fixado em 'fox' de propósito, não em PLAYER_SPECIES_ID — os testes usam
// uma espécie estável que eu mantenho, independente de qual espécie está
// configurada como jogador na build real (isso é o que quem estiver
// testando um modelo novo vai estar mexendo o tempo todo). Isso só vale
// pra movement/vitals do PRÓPRIO player de teste — config exclusiva de
// treinador (`actions`/`party`, ver `core/data/species/bot/index.js`) é
// sempre resolvida pela identidade fixa `PLAYER_SPECIES_ID` (`bot` de
// verdade, via `getPlayerSpecies()`), não por este `PLAYER_SPECIES` local
// — ver docs/features/018-troca-de-controle-treinador-criatura.md.
const PLAYER_SPECIES = getSpecies('fox')

const vitals = vitalsFromSpecies(PLAYER_SPECIES)

/**
 * Cria um world koota isolado para testes, com um player e uma câmera compostos
 * como em `core/world/world.js` — mas sem o singleton, para os testes não
 * vazarem estado entre si.
 *
 * Retorna `{ world, player, camera }`.
 */
export function makeWorld({ playerPosition = { x: 0, y: 2, z: 0 } } = {}) {
  const world = createWorld()

  const player = world.spawn(
    Position(playerPosition),
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
    HeldItem,
    Inventory,
    Party,
    // Party de teste nasce vazia (sem starters) — trait ainda entra
    // junto, mesma composição de `core/world/world.js`, pra
    // `equiparCriatura` (`core/actions/party.js`) poder ser chamada num
    // player de teste sem precisar de `.add()` antes de `.set()`.
    PartyIndividualValues,
    PathState,
    ScanMode,
    PokedexEntries,
    ScanHistory,
  )

  const camera = world.spawn(
    OrbitCamera({
      yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
      pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
      distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
    }),
  )

  return { world, player, camera }
}
