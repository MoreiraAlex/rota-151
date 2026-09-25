/**
 * Chicote de Videira — primeira SKILL de verdade (não o ataque comum),
 * ver `../_template/index.js` pro que cada campo significa e
 * docs/features/025-ataque-comum-de-criatura.md pro histórico ("9ª
 * rodada" — pedido do usuário: "pode fazer as habilidades agora?...
 * procura um efeito na pasta de Effects e me sugere as habilidades... uma
 * para cada um dos 3 pokémons iniciais"). Reservada pro slot
 * `secondary1` (tecla Q) do Bulbasaur — ver `core/data/species/001-
 * bulbasaur/index.js`.
 *
 * Visual de verdade (`EffCommonHitCut` + `EffCommonHitCutShockWave`, rips
 * convertidos — ver `VineWhipAttackEffect.jsx`): a malha de corte plana
 * (`hit-cut`, sem profundidade no eixo Z — não sofre do bug de
 * "atravessar parede" que o `'scratch'` teve, ver seção "Correção" em
 * docs/features/025) representa o golpe de chicote/vinha; a onda de
 * choque (`hit-cut-shockwave`) acompanha, mesma dupla flash+onda de
 * `'punch'`.
 *
 * `range` (2.2) maior que o `'punch'`/`'scratch'` base (1.4) — reflete o
 * alcance de CHICOTE que o usuário já pediu desde a 2ª rodada ("se eu
 * determinar um range alto, simulando que vai ser o chicote de uma
 * criatura"); esta é a primeira skill que usa isso de verdade (o
 * `resolveAttackImpactPoint` já respeita obstáculo no caminho, mesmo
 * mecanismo do ataque comum, sem código novo).
 *
 * `staminaCost`/`cooldown` mais altos que o ataque comum (2/0) — skill de
 * verdade, não o soco/arranhão básico e spammable. Valores de PARTIDA,
 * sem validação em jogo (sandbox sem navegador nesta sessão) — ajustar
 * depois olhando o resultado real.
 */
export const VINE_WHIP_ATTACK = {
  id: 'vine-whip',
  duration: 0.2,
  effectAt: 0.1,
  range: 2.2,
  aim: 'melee',
  castMode: 'confirm',
  radius: 0.35,
  staminaCost: 0.25,
  cooldown: 0,
  visual: {
    effectGroup: 'vine-whip',
    effectVisualDuration: 0.35,
    scale: 1,
    revealDuration: 0,
    rotationOffset: { x: 0, y: 0, z: 0 },
  },
  sprite: {
    path: '/assets/sprites/abilities/vine-whip.png',
    scale: 1,
  },
  // Som ainda não definido — usuário vai atrás dos arquivos depois de
  // confirmar a skill (ver docs/features/025). `null` = sem som nenhum
  // por enquanto, não "compartilha com outro grupo" (evita tocar um som
  // errado emprestado até ter o de verdade) — ver `resolveAttackSound`/
  // `ATTACK_SOUND_GROUPS`, `core/data/audio/attackSound.js`.
  audio: {
    group: 'scratch',
  },
  animation: {
    clipKey: 'attack',
  },
  // Físico, poder 45 — mesmo valor de "Vine Whip" nos jogos originais
  // (golpe físico apesar do tipo Grass). Ver comentário sobre `type:
  // null` em `../scratch/index.js`.
  damage: { power: 5, category: 'physical', type: null },
}
