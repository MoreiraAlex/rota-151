'use client'

import dynamic from 'next/dynamic'

// Laboratório de golpes (`tools/skillLab/`, docs/features/061-revisao-das-
// skills.md) — ferramenta, não faz parte do jogo. Só no cliente: Three/R3F
// não rodam no servidor.
const SkillLab = dynamic(
  () => import('@/tools/skillLab/SkillLab').then((m) => m.SkillLab),
  { ssr: false },
)

export default function SkillLabPage() {
  return <SkillLab />
}
