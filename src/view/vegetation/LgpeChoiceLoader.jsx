'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  getRequestedLgpeIds,
  markLgpeModelsReady,
  subscribeLgpeChoices,
} from './lgpeChoices'
import { useLgpeFiles, useLgpeManifest } from './useVegetationModels'

/**
 * Carrega os modelos do LGPE que o painel (F2) pediu
 * (`requestLgpeModels`, docs/features/053-planicie-com-assets-do-lgpe.md)
 * e os marca prontos. Fica num `<Suspense>` próprio, para a cena não
 * parar enquanto chegam.
 */
export function LgpeChoiceLoader() {
  const requested = useSyncExternalStore(
    subscribeLgpeChoices,
    getRequestedLgpeIds,
    getRequestedLgpeIds,
  )
  return requested.length > 0 ? <LgpeFilesLoader ids={requested} /> : null
}

function LgpeFilesLoader({ ids }) {
  const manifest = useLgpeManifest()
  useLgpeFiles(manifest, ids)
  useEffect(() => markLgpeModelsReady(ids), [ids])
  return null
}
