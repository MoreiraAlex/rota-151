'use client'

import dynamic from 'next/dynamic'

// Laboratório de corpo (`tools/bodyLab/`) — ferramenta, não faz parte do
// jogo. Só no cliente: Three/R3F não rodam no servidor.
const BodyLab = dynamic(
  () => import('@/tools/bodyLab/BodyLab').then((m) => m.BodyLab),
  { ssr: false },
)

export default function BodyLabPage() {
  return <BodyLab />
}
