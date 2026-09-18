import { trait } from 'koota'

/**
 * Humor/estado atual da criatura ("acordada", "dormindo", "braba", etc.) —
 * string livre, sem enum fechado: cada espécie declara suas próprias
 * chaves em `species.model.texture[materialIndex].eyeStates` (ver docs/
 * features/023-estado-de-humor-e-piscar-de-olhos.md), então o valor válido
 * varia por espécie, não faz sentido travar um conjunto fixo aqui.
 *
 * Começa em `'awake'`. Sem sistema de IA/comportamento ainda decidindo
 * isso sozinho — por enquanto só o seletor de debug (`DebugPanel.jsx`)
 * escreve aqui, mesmo estágio que `Party` teve antes de existir captura de
 * verdade (docs/features/013-criaturas-de-time.md). `view/systems/
 * eyeBlinkSystem.js` é quem lê — escolhe qual célula do atlas de olho usar
 * (aberto/fechado) de acordo com o humor atual.
 *
 * Adicionado por padrão a toda entidade jogável (treinador, `SummonedCreature`,
 * `WildCreature`), mesmo espírito de `AnimationState`/`ActionState` —
 * espécie sem `eyeStates` configurado simplesmente nunca tem isso lido,
 * sem custo.
 */
export const Mood = trait({
  state: 'awake',
})
