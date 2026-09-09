import { PerspectiveCamera, Sky } from '@react-three/drei'
import { PlayerView } from './PlayerView'

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

      {/* Chão de referência para leitura do movimento. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#4a7c3a" />
      </mesh>

      {/* Grade para dar sensação de deslocamento. */}
      <gridHelper args={[50, 50, '#ffffff', '#6b6b6b']} />

      <PlayerView />
    </>
  )
}
