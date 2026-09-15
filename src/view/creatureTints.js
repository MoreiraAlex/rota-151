// Tint por espécie placeholder de time (ver docs/features/013-criaturas-de-
// time.md e docs/features/014-arremessar-usar-e-invocar.md) — fica em
// `view/`, não em `core/data/species`, porque é só cosmético dos clones de
// `fox` que eu criei, não dado de jogo real (Pokémon de verdade não precisa
// disso). Compartilhado entre a renderização 3D (`CreatureView.jsx`) e a
// esfera colorida do inventário (`tools/menu/InventoryPanel.jsx`) — mesma
// cor nos dois lugares, um só de onde ler.
export const CREATURE_TINTS = {
  'fox-red': '#c0392b',
  'fox-green': '#2ecc71',
  'fox-blue': '#3498db',
}
