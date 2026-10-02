// Tint por espécie placeholder (ver docs/features/013-criaturas-de-
// time.md e docs/features/014-arremessar-usar-e-invocar.md) — fica em
// `view/`, não em `core/data/species`, porque é só cosmético, não dado de
// jogo real (Pokémon de verdade não precisa disso). Hoje vazio — sem
// entrada, quem lê cai no cinza de sempre. Compartilhado entre a
// renderização 3D (`CreatureView.jsx`) e a esfera colorida do inventário
// (`tools/menu/InventoryPanel.jsx`) — mesma cor nos dois lugares, um só de
// onde ler.
export const CREATURE_TINTS = {}
