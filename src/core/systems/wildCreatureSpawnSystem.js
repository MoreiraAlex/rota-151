import { TEST_LEVEL } from '../data/testLevel'
import { getSpecies } from '../data/species'
import { GAME_CONFIG } from '../gameConfig'
import { isPhysicsReady } from '../physics/physicsWorld'
import { createCharacterBody } from '../physics/colliders'
import {
  ActionState,
  AnimationState,
  CharacterController,
  Mood,
  MovementStats,
  PathState,
  PhysicsBody,
  Position,
  Rotation,
  Velocity,
  vitalsFromSpecies,
  WanderState,
  WildCreature,
} from '../traits'

/**
 * Spawna `TEST_LEVEL.wildCreatures` — UMA VEZ, no início do jogo. Não usa o
 * mecanismo de `partySummonSystem`/`SummonedCreature` (invocar/recolher de
 * um slot do time do treinador) — criatura selvagem não pertence a time
 * nenhum, nasce direto do nível e nunca é destruída (ver docs/features/020-
 * fox-selvagens-cena-e-texturas.md).
 *
 * Idempotência: se já existe QUALQUER `WildCreature` no world, não faz
 * nada — mais simples que um flag global dedicado (`isLevelBuilt`, ver
 * `physicsBootstrapSystem.js`) porque o próprio resultado do trabalho já
 * responde "já rodei?" sem estado extra.
 *
 * Corpo físico: mesmo padrão de `applySummon` (`partySummonSystem.js`) —
 * `isPhysicsReady()` decide entre `createCharacterBody` de verdade ou um
 * placeholder `{ bodyHandle: -1, colliderHandle: -1 }` (`characterPhysicsSystem.js`
 * ignora qualquer entidade com `bodyHandle < 0`, sem crash). NÃO bloqueia o
 * spawn em si esperando física — o jogo inicia com WASM carregando
 * assincronamente, e travar o spawn até lá adiaria as criaturas selvagens
 * aparecerem sem necessidade: `physicsBootstrapSystem.js` já varre TODA
 * entidade `CharacterController`+`PhysicsBody` (não só o treinador) no
 * exato tick em que a física fica pronta, então um placeholder spawnado
 * antes disso é preenchido com handles de verdade automaticamente, sem
 * este system precisar saber quando isso acontece.
 *
 * Mesmo conjunto de traits que `applySummon` (`partySummonSystem.js`) dá a
 * uma `SummonedCreature`, MENOS o que só faz sentido pra quem pode ser
 * controlado (`InputState`/`AimAnchor`/`HeldItem` — criatura selvagem nunca
 * ganha `InputControlled`) e trocando `SummonedCreature`/`PathState` sozinho
 * por `WildCreature` + `PathState` + `WanderState` (ver `wildWanderSystem.js`).
 * `Vitals` (via `vitalsFromSpecies`) é exigido mesmo sem combate ainda —
 * `characterPhysicsSystem.js` inclui `Vitals` na query que integra
 * `Velocity` contra o mundo físico, sem ele a criatura nunca se moveria de
 * verdade.
 *
 * Headless. Fase: simulation, junto de `partySummonSystem`/
 * `creatureFollowSystem` — antes de `characterPhysicsSystem` (que precisa
 * do corpo físico já criado).
 */
export function wildCreatureSpawnSystem(context) {
  const { world } = context

  if (world.queryFirst(WildCreature)) return

  const { MIN_PAUSE, MAX_PAUSE } = GAME_CONFIG.WILD_WANDER

  for (const entry of TEST_LEVEL.wildCreatures ?? []) {
    const species = getSpecies(entry.speciesId)
    if (!species) continue

    const [x, y, z] = entry.position
    const physicsBody = isPhysicsReady()
      ? createCharacterBody(
          { x, y, z },
          {
            radius: species.body.capsuleRadius,
            halfHeight: species.body.capsuleHalfHeight,
            axis: species.body.capsuleAxis,
          },
        )
      : { bodyHandle: -1, colliderHandle: -1 }

    world.spawn(
      Position({ x, y, z }),
      Rotation,
      WildCreature({ speciesId: entry.speciesId }),
      AnimationState,
      ActionState,
      Velocity,
      CharacterController(species.body),
      MovementStats(species.movement),
      vitalsFromSpecies(species.vitals),
      PhysicsBody(physicsBody),
      PathState,
      WanderState({
        homeX: x,
        homeZ: z,
        targetX: x,
        targetZ: z,
        // Atraso inicial sorteado — evita todas as criaturas selvagens
        // começarem a andar no exato mesmo instante.
        pauseTimer: MIN_PAUSE + Math.random() * (MAX_PAUSE - MIN_PAUSE),
        chaseTimer: 0,
      }),
      // Default 'awake' — mesmo trait universal simples de AnimationState/
      // ActionState acima, ver docs/features/023-estado-de-humor-e-piscar-
      // de-olhos.md.
      Mood,
    )
  }
}
