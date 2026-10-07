/**
 * Chicote de Cauda (Tail Whip) — skill de STATUS do Squirtle: não causa dano,
 * baixa a DEFESA dos inimigos no cone à frente (mesmo molde do `growl`, que
 * baixa o ataque — ver `../growl/index.js`). Com a defesa baixa, o alvo leva
 * mais dano de golpe físico (`defenderStages` em `core/battle/
 * calculateDamage.js`): -1 estágio = ×2/3 na defesa. Ver docs/features/
 * 033-skills-de-combate-e-vfx.md e `../_template/index.js` pro que cada campo
 * significa.
 *
 * `accuracy: 100` (como no Pokémon): passa pelo sorteio de acerto, então erra
 * se quem usa estiver com a precisão baixa (Smokescreen).
 *
 * Visual: UMA abanada (varrida e brilhos) na frente de quem usa, no `effectAt`
 * (`visual.actionGroup: 'tail-whip'`, `view/vfx/tailWhipVfx.js`, do Cobblemon).
 * Som: o `tailwhip_actor` do Cobblemon em loop do `effectAt` ao fim da
 * `duration` (`audio.actionGroup`). O "Defesa ↓" sai no `effectAt`; o feedback no
 * alvo é o brilho, o texto e o indicador na HUD.
 *
 * Valores de PARTIDA, sem validação em jogo.
 */
export const TAIL_WHIP_SKILL = {
  id: 'tail-whip',
  type: 'normal',
  duration: 1,
  effectAt: 0.6,
  range: 3,
  aim: 'ranged',
  castMode: 'instant',
  area: 'cone',
  // abertura do cone: `radius / range` (tangente do meio-ângulo)
  radius: 1.5,
  accuracy: 100,
  // Sem dano: nada "apanha", e `attackResolved` sai com `status: true`.
  damage: null,
  effects: [{ type: 'statStage', stat: 'defense', stages: -1, duration: 60 }],
  visual: {
    // sem visual de impacto: o efeito é o da AÇÃO (`actionGroup`)
    effectGroup: 'none',
    effectVisualDuration: 0,
    // uma abanada (varrida e brilhos) na frente da criatura, no `effectAt`,
    // presa à criatura (`view/vfx/tailWhipVfx.js`)
    actionGroup: 'tail-whip',
    scale: 3,
    revealDuration: 0,
    // aqui o efeito gira em volta do PRÓPRIO pivô (na frente do corpo), sem sair
    // do lugar: `y` vira a direção dos brilhos (0 = pro alvo) e `z` gira as
    // partículas no plano da tela — 180 vira o arco da varrida de "U" pra "∩",
    // lido como onda SAINDO do Squirtle (em 0 parece vir na direção dele)
    rotationOffset: { x: 0, y: 0, z: 180 },
    positionOffset: { x: 0, y: 0, z: 1 },
  },
  // sem ícone próprio ainda: reaproveita o do Growl
  sprite: {
    path: '/assets/sprites/abilities/tail-whip.png',
    scale: 1,
  },
  // o som da cauda toca em loop do `effectAt` ao fim da ação (`actionGroup`)
  audio: { group: null, actionGroup: 'tail-whip' },
  // o Squirtle não tem animação de abanar a cauda (no Cobblemon a criatura dá
  // as costas e abana); fica a de ataque
  animation: { clipKey: 'attack' },
}
