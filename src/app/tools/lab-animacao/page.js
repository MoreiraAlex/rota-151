'use client'

import dynamic from 'next/dynamic'

// Laboratório de animação (`tools/animationLab/`) — ferramenta, não faz parte
// do jogo. Só no cliente: Three/R3F não rodam no servidor.
const AnimationLab = dynamic(
  () => import('@/tools/animationLab/AnimationLab').then((m) => m.AnimationLab),
  { ssr: false },
)

export default function AnimationLabPage() {
  return <AnimationLab />
}
