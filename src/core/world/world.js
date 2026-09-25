import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { getSpecies, PLAYER_SPECIES_ID } from '../data/species'
import { rollIndividualValues } from '../data/species/stats'
import { gameplayRng } from '../rng'
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
  Mood,
  ScanMode,
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

// Time inicial — sorteia o IV de cada um dos 3 iniciais aqui (não via
// `equiparCriatura`, `core/actions/party.js`: aquela action escreve num
// `trainer` que já existe, e o treinador ainda está sendo montado
// nesta chamada de `world.spawn`) e congela em `PartyIndividualValues`,
// mesmo mecanismo/range (`GAME_CONFIG.BATTLE.IV_MIN/MAX`) que
// `equiparCriatura` usa depois pra qualquer troca em tempo de jogo —
// "IV é aleatório pra todo mundo", pedido do usuário.
const STARTER_PARTY = {
  slot1: 'bulbasaur',
  slot2: 'charmander',
  slot3: 'squirtle',
}
const STARTER_INDIVIDUAL_VALUES = Object.fromEntries(
  Object.keys(STARTER_PARTY).map((slot) => [
    slot,
    rollIndividualValues(gameplayRng, {
      min: GAME_CONFIG.BATTLE.IV_MIN,
      max: GAME_CONFIG.BATTLE.IV_MAX,
    }),
  ]),
)

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
  // Começa com a mão e o time já equipados — sem isso o jogo abre sem
  // nada pra arremessar/invocar, mesmo já tendo itens/criaturas
  // disponíveis (Inventory já começa com um kit de teste, ver
  // core/traits/components/inventory.js). `rock` é um `throwable` do kit
  // inicial; `fox` é a primeira criatura `kind: 'pokemon'` do registro
  // (core/data/species/index.js) — nenhum dos dois é conteúdo de jogo de
  // verdade ainda, só o ponto de partida mais conveniente pra testar.
  HeldItem({ itemId: 'pokedex' }),
  Inventory,
  Party(STARTER_PARTY),
  PartyIndividualValues(STARTER_INDIVIDUAL_VALUES),
  ScanMode,
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

export const cameraEntity = world.spawn(
  OrbitCamera({
    yaw: GAME_CONFIG.CAMERA.INITIAL_YAW,
    pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
    distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
  }),
)
