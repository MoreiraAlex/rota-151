'use client'

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GameLoop } from '@/view/loop/GameLoop'
import { GameScene } from '@/view/scene/GameScene'
import { PhysicsDebugView } from '@/tools/debug/PhysicsDebugView'
import { DebugPanel } from '@/tools/debug/DebugPanel'

export default function GamePage() {
  const [showDebug, setShowDebug] = useState(false)

  return (
    <WorldProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        <Canvas shadows>
          <GameLoop />
          <GameScene>{showDebug && <PhysicsDebugView />}</GameScene>
        </Canvas>

        <label className="absolute right-4 top-4 flex items-center gap-2 rounded bg-black/60 px-3 py-2 text-sm text-white">
          <input
            type="checkbox"
            checked={showDebug}
            onChange={(event) => setShowDebug(event.target.checked)}
          />
          Debug físico
        </label>

        {showDebug && <DebugPanel />}
      </div>
    </WorldProvider>
  )
}
