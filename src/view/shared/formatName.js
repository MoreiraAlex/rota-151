/** "bulbasaur" → "Bulbasaur", "leech-seed" → "Leech Seed" — sem apelido
 * individual (nenhuma criatura tem nome próprio hoje), só a espécie (ou o
 * golpe) formatado. Sem JSX: também usado por systems da view
 * (`damageNumberSystem.js`). */
export function formatSpeciesName(id) {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
