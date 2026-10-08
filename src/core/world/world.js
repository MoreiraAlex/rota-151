import { createWorld } from 'koota'
import { GAME_CONFIG } from '../gameConfig'
import { getSpecies, PLAYER_SPECIES_ID } from '../data/species'
import { TEST_LEVEL } from '../data/testLevel'
import { verticalClearance } from '../physics/capsule'
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
  SaveClock,
  WorldClock,
  LocalWeather,
} from '../traits'

export const world = createWorld()

// Relógio e clima do mundo (docs/features/048-dia-noite-e-clima.md): traits
// do MUNDO, não de uma entidade. O horário salvo volta no
// `prepararTreinador`.
world.add(WorldClock, LocalWeather)

// Jogador é só mais uma entrada do registro de espécies — corpo (cápsula) e
// movimento (velocidades) vêm de lá, não são constante global. PLAYER_SPECIES_ID
// mora em core/data/species/index.js — único lugar que define isso, também
// usado por view/scene/PlayerView.jsx, pra nunca ficarem apontando pra
// espécies diferentes um do outro.
const PLAYER_SPECIES = getSpecies(PLAYER_SPECIES_ID)

const vitals = vitalsFromSpecies(PLAYER_SPECIES)

export const playerEntity = world.spawn(
  // Nasce com os pés acima do relevo na origem e cai até pousar
  // (docs/features/045-terreno-de-um-chunk.md).
  Position({
    x: 0,
    y:
      TEST_LEVEL.terrain.heightAt(0, 0) +
      verticalClearance(PLAYER_SPECIES.body) +
      GAME_CONFIG.TERRAIN.SPAWN_HEIGHT,
    z: 0,
  }),
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
  // Mão vazia e sem itens nem Pokémon: o que ele tem vem do save, ou do kit
  // inicial na primeira entrada (`prepararTreinador`, docs/features/044-
  // salvar-o-jogo.md), antes do jogo começar.
  HeldItem,
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
  // Relógio do save automático (`autosaveSystem.js`).
  SaveClock,
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
