'use client'

import { WorldProvider as KootaWorldProvider } from 'koota/react'
import { world } from './world'

export function WorldProvider({ children }) {
  return <KootaWorldProvider world={world}>{children}</KootaWorldProvider>
}
