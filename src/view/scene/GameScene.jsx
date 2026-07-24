import { PerspectiveCamera, Sky } from '@react-three/drei'
import { CubeView } from './CubeView'

export function GameScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 10]} />

      <Sky
        distance={450000}
        sunPosition={[0, 1, 0]}
        inclination={0}
        azimuth={0.25}
        // {...props}
      />

      {/* <ambientLight /> */}

      {/* <directionalLight /> */}

      <CubeView />
    </>
  )
}
