/**
 * Sons dos itens no mundo (docs/features/055-itens-no-mundo.md) — arquivos
 * do Cobblemon (`public/assets/audio/world-items/`), com os volumes do
 * `sounds.json` dele. Mesmo formato dos da Pokébola (`pokeballSounds.js`):
 * `files` (variações; uma é sorteada), `volume` (0-1) e `refDistance` (m).
 *
 * - `pickup`: pegar um item do chão (o "pegar" do PC do Cobblemon);
 * - `rustle`: vasculhar um arbusto ou uma árvore (toca sempre);
 * - `harvest`: achou fruta (a colheita do arbusto de frutas).
 */
const BASE = '/assets/audio/world-items'
const file = (name) => `${BASE}/${name}.ogg`

export const WORLD_ITEM_SOUNDS = {
  pickup: { files: [file('pickup')], volume: 0.7, refDistance: 6 },
  rustle: {
    files: ['bush_1', 'bush_2', 'bush_3'].map(file),
    volume: 1,
    refDistance: 6,
  },
  harvest: {
    files: ['harvest_1', 'harvest_2', 'harvest_3'].map(file),
    volume: 0.4,
    refDistance: 6,
  },
}
