import { PerspectiveCamera, Sky } from '@react-three/drei'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { AmbientAudio } from '@/view/audio/AmbientAudio'
import { PlayerView } from './PlayerView'
import { ProjectilesView } from './ProjectileView'
import { SummonBallsView } from './SummonBallView'
import { SummonFlashesView } from './SummonFlashView'
import { RecallBeamsView } from './RecallBeamView'
import { ConsumeEffectsView } from './ConsumeEffectView'
import { AttackEffectsView } from './AttackEffectView'
import { AttackIndicatorView } from './AttackIndicatorView'
import { AttackTelegraphView } from './AttackTelegraphView'
import { DashEffectsView } from './DashEffectsView'
import { ContinuousAttackEffectsView } from './ContinuousAttackEffectsView'
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
 * colliders em core/physics, então o visível bate com o colidível.
 */
function TestLevelView() {
  const { ground, obstacles } = TEST_LEVEL

  return (
    <>
      <mesh position={[0, -ground.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[ground.size, ground.thickness, ground.size]} />
        <meshStandardMaterial color="#35271f" />
      </mesh>
      <gridHelper args={[ground.size, ground.size]} />

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

      <Sky
        distance={450000}
        sunPosition={[0, 1, 0]}
        inclination={0}
        azimuth={0.25}
      />

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />

      <AmbientAudio />

      <TestLevelView />

      <PlayerView />
      <ProjectilesView />
      <SummonBallsView />
      <SummonFlashesView />
      <RecallBeamsView />
      <ConsumeEffectsView />
      <AttackEffectsView />
      <AttackIndicatorView />
      <AttackTelegraphView />
      <DashEffectsView />
      <ContinuousAttackEffectsView />
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
