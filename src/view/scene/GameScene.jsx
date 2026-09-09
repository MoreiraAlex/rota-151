import { PerspectiveCamera, Sky } from '@react-three/drei'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { PlayerView } from './PlayerView'

function obstacleRotation(rotation) {
  if (!rotation) return [0, 0, 0]
  return [
    rotation.axis === 'x' ? rotation.angle : 0,
    rotation.axis === 'y' ? rotation.angle : 0,
    rotation.axis === 'z' ? rotation.angle : 0,
  ]
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
        <meshStandardMaterial color="#4a7c3a" />
      </mesh>

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
            color={obstacle.type === 'ramp' ? '#b08968' : '#8a8a8a'}
          />
        </mesh>
      ))}
    </>
  )
}

export function GameScene() {
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

      <TestLevelView />

      <PlayerView />
    </>
  )
}
