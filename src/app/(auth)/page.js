'use client'

import { Canvas } from '@react-three/fiber'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GameLoop } from '@/view/loop/GameLoop'
import { GameScene } from '@/view/scene/GameScene'

export default function GamePage() {
  return (
    <WorldProvider>
      <div className="h-screen w-screen">
        <Canvas shadows>
          <GameLoop />
          <GameScene />
        </Canvas>
      </div>
    </WorldProvider>
  )
}
