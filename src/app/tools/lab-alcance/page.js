'use client'

import dynamic from 'next/dynamic'

// Laboratório de alcance (`tools/rangeLab/`, docs/features/062-spawn-estilo-
// cobblemon.md) — ferramenta, não faz parte do jogo. Só no cliente: Three/R3F
// não rodam no servidor.
const RangeLab = dynamic(
  () => import('@/tools/rangeLab/RangeLab').then((m) => m.RangeLab),
  { ssr: false },
)

export default function RangeLabPage() {
  return <RangeLab />
}
