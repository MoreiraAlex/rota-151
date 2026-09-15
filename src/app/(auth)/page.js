'use client'

import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { WorldProvider } from '@/core/world/WorldProvider'
import { GameLoop } from '@/view/loop/GameLoop'
import { GameScene } from '@/view/scene/GameScene'
import { PhysicsDebugView } from '@/tools/debug/PhysicsDebugView'
import { DebugPanel } from '@/tools/debug/DebugPanel'

export default function GamePage() {
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'F2') return
      event.preventDefault()
      setShowDebug((current) => !current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <WorldProvider>
      <div className="relative h-screen w-screen overflow-hidden">
        <Canvas shadows>
          <GameLoop />
          <GameScene>{showDebug && <PhysicsDebugView />}</GameScene>
        </Canvas>

        {showDebug && <DebugPanel />}
      </div>
    </WorldProvider>
  )
}
