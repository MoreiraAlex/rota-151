'use client'

import dynamic from 'next/dynamic'

// Laboratório de luz de fogo (`tools/fireLightLab/`) — ferramenta, não faz
// parte do jogo. Só no cliente: Three/R3F não rodam no servidor.
const FireLightLab = dynamic(
  () => import('@/tools/fireLightLab/FireLightLab').then((m) => m.FireLightLab),
  { ssr: false },
)

export default function FireLightLabPage() {
  return <FireLightLab />
}
