'use client'

import dynamic from 'next/dynamic'

// Laboratório de biomas (`tools/biomeLab/`, docs/features/066-revisao-dos-
// biomas.md) — ferramenta, não faz parte do jogo. Só no cliente: Three/R3F
// e a física não rodam no servidor.
const BiomeLab = dynamic(
  () => import('@/tools/biomeLab/BiomeLab').then((m) => m.BiomeLab),
  { ssr: false },
)

export default function BiomeLabPage() {
  return <BiomeLab />
}
