'use client'

import Logout from '@/shared/components/button/logout'
import { Canvas } from '@react-three/fiber'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GameLoop } from '@/core/app'
import { GameScene } from '@/view/scene/GameScene'

export default function GamePage() {
  return (
    <WorldProvider>
      <div className="h-screen w-screen">
        {/* <Logout /> */}

        <Canvas>
          <GameLoop />
          <GameScene />
        </Canvas>
      </div>
    </WorldProvider>
  )
}
