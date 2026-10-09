import { PerspectiveCamera } from '@react-three/drei'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { AmbientAudio } from '@/view/audio/AmbientAudio'
import { PlayerView } from './PlayerView'
import { TerrainView } from './TerrainView'
import { VegetationView } from '../vegetation/VegetationView'
import { WaterView } from '../water/WaterView'
import { RenderSettingsView } from './RenderSettingsView'
import { FogView } from './FogView'
import { DayNightView } from './DayNightView'
import { WeatherView } from './WeatherView'
import { WeatherAudio } from '@/view/audio/WeatherAudio'
import { useLevelRevision } from '../hooks/useLevelRevision'
import { ProjectilesView } from './ProjectileView'
import { SummonBallOpensView, SummonBallsView } from './SummonBallView'
import { CaptureBallsView, GroundBallsView } from './CaptureBallView'
import { CaptureAimView } from './CaptureAimView'
import { HeldItemView } from './HeldItemView'
import { HandBallView } from './HandBallView'
import { WorldSoundsView } from '../audio/WorldSoundsView'
import { PokeballVfxView } from './PokeballVfxView'
import { SummonFlashesView } from './SummonFlashView'
import { RecallBeamsView } from './RecallBeamView'
import { ConsumeEffectsView } from './ConsumeEffectView'
import { DroppedFoodsView } from './DroppedFoodView'
import { EatingFoodsView } from './EatingFoodView'
import { EatingVfxView } from './EatingVfxView'
import { AttackEffectsView } from './AttackEffectView'
import { AttackIndicatorView } from './AttackIndicatorView'
import { AttackTelegraphView } from './AttackTelegraphView'
import { DashEffectsView } from './DashEffectsView'
import { ContinuousAttackEffectsView } from './ContinuousAttackEffectsView'
import { StatusConditionEffectsView } from './StatusConditionEffectsView'
import { JumpDustView } from './JumpDustView'
import { ActionTimerRingView } from './ActionTimerRingView'
import { CreaturesView, WildCreaturesView } from './CreatureView'
import { NameplatesView } from './NameplateView'
import { DamageNumbersView } from './DamageNumbersView'

function obstacleRotation(rotation) {
  if (!rotation) return [0, 0, 0]
  return [
    rotation.axis === 'x' ? rotation.angle : 0,
    rotation.axis === 'y' ? rotation.angle : 0,
    rotation.axis === 'z' ? rotation.angle : 0,
  ]
}

// Cor por tipo — 'floor' (terraço andável, ver "Elevação (heightmap)" em
// core/pathfinding.js) num tom de pedra, diferente do marrom de 'ramp' e do
// cinza padrão de 'box'.
const OBSTACLE_COLOR = {
  ramp: '#b08968',
  floor: '#9c9182',
}

// Cor dos objetos de treino (`trainingKind`, ver `trainingObjects` em
// core/data/testLevel.js) — destacados do resto do cenário.
const TRAINING_OBJECT_COLOR = {
  log: '#7a4a24',
  rock: '#6f7b86',
  dummy: '#c9a66b',
}

/**
 * Desenha o nível de teste a partir de TEST_LEVEL — o mesmo dado que gera os
 * colliders em core/physics, então o visível bate com o colidível. O relevo
 * é o `TerrainView`; aqui ficam os obstáculos.
 */
function TestLevelView() {
  // Relevo ajustado em tempo real (debug) refaz os obstáculos e o terreno.
  useLevelRevision()
  const { obstacles } = TEST_LEVEL

  return (
    <>
      <TerrainView />
      {/* Grama, flores e árvores (049). */}
      <VegetationView />
      {/* Superfície da água, só visual (049; a de verdade é da 056). */}
      <WaterView />

      {obstacles.map((obstacle) => (
        <mesh
          key={obstacle.id}
          position={obstacle.position}
          rotation={obstacleRotation(obstacle.rotation)}
          castShadow
          receiveShadow
        >
          <boxGeometry args={obstacle.size} />
          <meshStandardMaterial
            color={
              TRAINING_OBJECT_COLOR[obstacle.trainingKind] ??
              OBSTACLE_COLOR[obstacle.type] ??
              '#8a8a8a'
            }
          />
        </mesh>
      ))}
    </>
  )
}

/**
 * `children` é um slot pra conteúdo opcional composto por quem monta a cena
 * (a página, em app/) — é assim que ferramentas de debug (tools/) entram na
 * mesma árvore sem a view/ precisar importar de tools/ (a direção de
 * dependência do projeto é tools → view, nunca o inverso).
 */
export function GameScene({ children }) {
  return (
    <>
      {/* Posição inicial aproximada da órbita padrão; a suavização ajusta o resto. */}
      <PerspectiveCamera makeDefault position={[0, 5.6, 11.3]} fov={60} />

      {/* Curva de cor e SMAA (049). */}
      <RenderSettingsView />

      {/* Névoa que esconde a borda do mundo carregado (046). */}
      <FogView />

      {/* Céu, sol, lua e luz pela hora e pelo clima; chuva e neve (048). */}
      <DayNightView />
      <WeatherView />

      <AmbientAudio />
      <WeatherAudio />

      <TestLevelView />

      <PlayerView />
      <ProjectilesView />
      <SummonBallsView />
      <SummonBallOpensView />
      <CaptureBallsView />
      <CaptureAimView />
      <HeldItemView />
      <HandBallView />
      <WorldSoundsView />
      <PokeballVfxView />
      <GroundBallsView />
      <SummonFlashesView />
      <RecallBeamsView />
      <ConsumeEffectsView />
      <DroppedFoodsView />
      <EatingFoodsView />
      <EatingVfxView />
      <AttackEffectsView />
      <AttackIndicatorView />
      <AttackTelegraphView />
      <DashEffectsView />
      <ContinuousAttackEffectsView />
      <StatusConditionEffectsView />
      <JumpDustView />
      <ActionTimerRingView />
      <CreaturesView />
      <WildCreaturesView />
      <NameplatesView />
      <DamageNumbersView />

      {children}
    </>
  )
}
