/**
 * Olho das espécies do Let's Go com piscar (Rattata, Spearow — docs/
 * features/059-as-10-especies.md): o conversor
 * (`scripts/blender/convert-pokemon-lgpe.py`) monta um atlas com a mesma
 * grade de expressões do LGPE — colunas normal e brava; linhas, de cima para
 * baixo, aberto, meio fechado, fechado e apertado — e cada célula tem a
 * textura de olho inteira. Entra na entrada de textura do olho
 * (`model.texture[i]`), no formato do `eyeStates` (docs/features/023).
 */

const COLUMNS = 2
const ROWS = 4

// Célula (coluna, linha) → deslocamento do `eyeStates`, que conta a partir
// do centro da textura (`(1 - repeat) / 2 + célula`).
const cell = (column, row) => ({
  x: (column - (COLUMNS - 1) / 2) / COLUMNS,
  y: (row - (ROWS - 1) / 2) / ROWS,
})

const NORMAL = 0
const ANGRY = 1
const OPEN = 0
// Linha do olho fechado: na coluna normal vem depois do meio fechado; na
// brava, logo depois do aberto.
const CLOSED = 2
const ANGRY_CLOSED = 1

export const LGPE_EYE_ATLAS = {
  repeat: { x: 1 / COLUMNS, y: 1 / ROWS },
  eyeStates: {
    awake: { open: cell(NORMAL, OPEN), closed: cell(NORMAL, CLOSED) },
    sleeping: { open: cell(NORMAL, CLOSED), closed: cell(NORMAL, CLOSED) },
    angry: { open: cell(ANGRY, OPEN), closed: cell(ANGRY, ANGRY_CLOSED) },
  },
}
