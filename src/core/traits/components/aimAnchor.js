import { trait } from 'koota'

/**
 * Ponto de mira travado enquanto o jogador mira (botão direito segurado —
 * ver docs/features/016-mira-e-arremesso.md). `active` marca se há um
 * ponto travado agora; `x`/`y`/`z` é esse ponto, capturado uma única vez
 * no instante em que a mira começa (borda de subida de `input.aiming`) e
 * mantido fixo até soltar — não recalculado a cada frame conforme o
 * mouse mexe, de propósito: o ponto de mira pode saltar bastante com um
 * giro pequeno de câmera (de "perto de uma parede" pra "longe, no limite
 * do alcance"), e um alvo que troca de lugar a cada frame deixaria tanto
 * a câmera quanto o arremesso "derrapando" em vez de mirar de verdade.
 * (Chegou a se tentar recalcular durante a mira — rodadas 14–15 — mas
 * "andar sozinho, sem mexer o mouse" já deslocava o ponto contra a
 * geometria do cenário, o que não era o esperado; revertido pro
 * travamento único enquanto a proposta é reformulada.)
 *
 * `movementSystem.js` usa este ponto como referencial de movimento
 * enquanto `active` — "frente"/"trás" (radial) aproxima/afasta dele,
 * "esquerda"/"direita" (tangencial) circula ao redor — mas a rotação do
 * personagem continua seguindo o próprio movimento (WASD), não este
 * ponto (isso foi tentado, rodada 11, e revertido na 13). A câmera
 * (`cameraFollowSystem.js`) é quem de fato gira sozinha pra manter o
 * ponto em vista. O arremesso (`playerActionSystem.js`) também mira
 * direto neste ponto travado enquanto `active`, em vez de recalcular via
 * `resolveAimPoint` de novo no instante do disparo — é o mesmo ponto que
 * a câmera já está mostrando.
 *
 * Dono de escrita: `aimAnchorSystem` (captura/libera). Leem:
 * `cameraFollowSystem` (pra onde a câmera aponta), `movementSystem`
 * (referencial de movimento), `playerActionSystem` (pra onde o arremesso
 * vai).
 */
export const AimAnchor = trait({
  active: false,
  x: 0,
  y: 0,
  z: 0,
})
