'use client'

import dynamic from 'next/dynamic'

// Laboratório da cidade (`tools/cityLab/`, docs/features/069-revisao-do-
// bioma-cidade.md) — ferramenta, não faz parte do jogo. Só no cliente:
// Three/R3F e a física não rodam no servidor.
const CityLab = dynamic(
  () => import('@/tools/cityLab/CityLab').then((m) => m.CityLab),
  { ssr: false },
)

export default function CityLabPage() {
  return <CityLab />
}
