'use client'

import { TEST_LEVEL } from '@/core/data/testLevel'
import { useLevelRevision } from '@/view/hooks/useLevelRevision'
import { TownLakeView } from './TownLakeView'

/**
 * A primeira cidade fixa no mundo procedural (docs/features/069-revisao-
 * do-bioma-cidade.md — Viridian, a cidade inicial, montada à mão): o
 * relevo é o chão dela e os objetos vêm com os chunks; aqui só a água do
 * lago dela (`TownLakeView`). Sempre montada no mundo aberto (some com o
 * resto dele dentro dos prédios e no lugar à parte).
 */
export function FixedTownView() {
  // A receita do relevo troca com o nível (o F2 refaz o mundo).
  useLevelRevision()
  const fixedTown = TEST_LEVEL.terrain.fixedTown?.() ?? null
  if (!fixedTown) return null
  return <TownLakeView fixedTown={fixedTown} />
}
