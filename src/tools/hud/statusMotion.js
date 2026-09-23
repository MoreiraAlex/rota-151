/**
 * Convenção de `layoutId` compartilhada entre `PartyHud.jsx` e
 * `StatusHud.jsx` — pedido do usuário: "quero ver a troca sendo
 * realizada" (transição suave, não só aparecer/sumir), com três partes:
 * "HUD da criatura subir até o topo quando ela for controlada", "HUD do
 * treinador fazendo um swip com o principal" e "demais HUDs das
 * criaturas se adequarem à ordem" (docs/features/027-hud-de-status-e-habilidades.md, "8ª rodada").
 *
 * `layoutId` (Framer Motion) faz a "mágica": quando um `motion.*` com um
 * `layoutId` sai da árvore no MESMO commit em que outro `motion.*` com o
 * MESMO `layoutId` entra — em QUALQUER lugar da página, não precisa ser
 * parente/filho — a lib anima a transição de posição/tamanho entre os
 * dois automaticamente (é o mecanismo por trás das "shared layout
 * animations" da doc oficial do Framer Motion, o mesmo truque do
 * clássico exemplo de abas com barrinha deslizante). Uma STRING errada
 * aqui (ex.: `status-slot1` de um lado, `status-Slot1` do outro) quebra
 * o pareamento silenciosamente — por isso esta função única, em vez de
 * template strings soltas nos dois arquivos.
 *
 * - `statusLayoutId('trainer')` — identidade do TREINADOR, usada tanto
 *   no card PRINCIPAL do `StatusHud` (quando ele está no controle)
 *   quanto no card COMPACTO secundário (quando uma criatura está no
 *   controle) — o MESMO id nos dois estados faz o treinador "encolher"/
 *   "crescer" entre as duas posições em vez de só sumir/aparecer (pedido
 *   "fazendo um swip com o principal").
 * - `statusLayoutId(slot)` (`'slot1'|'slot2'|'slot3'`) — identidade de
 *   UMA criatura do time, usada tanto no card dela dentro de
 *   `PartyHud.jsx` (quando NÃO está no controle) quanto no card
 *   PRINCIPAL do `StatusHud` (quando ela passa a estar) — o MESMO id
 *   nos dois lugares faz o card "subir" da lista do time até o topo em
 *   vez de só sumir de um lado e aparecer do outro.
 */
export function statusLayoutId(slot) {
  return `status-${slot}`
}

export const CARD_TRANSITION = { type: 'spring', duration: 0.25, bounce: 0.5 }
