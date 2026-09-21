/**
 * Arranhão — ver `../_template/index.js` pro que cada campo significa e
 * docs/features/025-ataque-comum-de-criatura.md pro histórico. Visual de
 * verdade (`EffCommonScratch`, rip convertido — ver `ScratchAttackEffect.jsx`),
 * som compartilhado com `../punch` (`audio.group: 'punch'` — só existe um
 * pacote de áudio de ataque hoje, os dois apontam pro mesmo).
 */
export const SCRATCH_ATTACK = {
  id: 'scratch',
  duration: 0.5,
  effectAt: 0.25,
  range: 1.4,
  radius: 0.3,
  staminaCost: 2,
  cooldown: 0,
  visual: {
    effectGroup: 'scratch',
    effectVisualDuration: 0.35,
    // Multiplicador de tamanho do VFX — pedido do usuário: "uma criatura
    // grande vai ter o efeito maior do que o de uma criatura pequena,
    // mesmo os 2 usando o mesmo efeito". `1` = tamanho de referência da
    // definição base; uma criatura fora do padrão sobrescreve só isto
    // (`attacks.primary.overrides.visual.scale`), sem duplicar o resto.
    // Multiplica por cima do `radius`/da constante de normalização do rip
    // (`SCRATCH_BASE_SCALE`, `ScratchAttackEffect.jsx`) — não a substitui.
    scale: 1,
    // Pedido do usuário: o efeito não aparece inteiro de uma vez — é
    // REVELADO progressivamente ao longo desses segundos (0% a 100% do
    // "traço" visível, depois fica revelado por inteiro até o fade).
    // Só o grupo 'scratch' usa isso (`ScratchAttackEffect.jsx`).
    revealDuration: 0.2,
    // Ajuste fino de orientação (graus), somado por cima da direção real
    // do golpe (pitch+yaw, `creatureAttackSystem.js`) — a malha
    // convertida do rip pode não ter o "forward" alinhado com a
    // convenção do jogo; corrige aqui olhando o resultado em jogo, sem
    // mexer em código.
    rotationOffset: { x: 0, y: 0, z: 0 },
  },
  audio: {
    group: 'scratch',
  },
  animation: {
    // Chave em `species.clips` que este ataque tocaria — hoje sempre
    // `'attack'` (`core/data/animationStates.js` resolve por esse id fixo,
    // não por ataque específico ainda). Ver `../_template/index.js`.
    clipKey: 'attack',
  },
  // Sistema de batalha ainda não desenhado (ver `stats`/`moves` vazios em
  // `core/data/species/*/index.js`) — placeholder, mesmo espírito.
  damage: null,
}
