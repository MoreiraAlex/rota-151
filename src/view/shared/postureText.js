/**
 * Texto das posturas para o jogador (docs/features/064-revisao-da-ia-do-
 * parceiro.md, Parte 2): o nome e uma linha do que ela faz. Na ordem em que
 * aparecem no menu.
 */
export const POSTURE_TEXT = {
  aggressive: {
    name: 'Agressiva',
    description: 'Ataca toda selvagem que vê por perto.',
  },
  defensive: {
    name: 'Defensiva',
    description:
      'Defende o grupo: entra quando uma selvagem ataca ou parte para cima.',
  },
  neutral: {
    name: 'Neutra',
    description: 'Só luta se for atacada.',
  },
}
