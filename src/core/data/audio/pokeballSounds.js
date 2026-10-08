/**
 * Sons da Pokébola (docs/features/043-captura.md) — arquivos do Cobblemon
 * (`public/assets/audio/pokeball/`), com os volumes do `sounds.json` dele.
 * Cada momento: `files` (variações; uma é sorteada), `volume` (0-1) e
 * `refDistance` (m — até onde toca no volume cheio; depois, cai com a
 * distância). Volume 0 desliga o momento.
 *
 * - `throw`: a bola sai da mão (captura e invocar);
 * - `hit`: a bola de captura acerta o selvagem;
 * - `open`: a bola abre (absorvendo o selvagem);
 * - `shut`: fecha com ele dentro;
 * - `bounce`: bate no chão (caindo pra balançar, ou a que errou quicando);
 * - `shake`: cada balançada;
 * - `caught`: capturado;
 * - `break`: ele escapou (a bola estoura) ou a que errou quebrou;
 * - `sendOut`: a bola abrindo ao invocar;
 * - `recall`: o feixe de recolher.
 */
const BASE = '/assets/audio/pokeball'
const file = (name) => `${BASE}/${name}.ogg`

export const POKEBALL_SOUNDS = {
  throw: {
    files: ['throw_1', 'throw_2', 'throw_3', 'throw_4'].map(file),
    volume: 0.8,
    refDistance: 6,
  },
  hit: { files: [file('hit')], volume: 0.4, refDistance: 6 },
  open: { files: [file('open')], volume: 0.7, refDistance: 6 },
  shut: { files: [file('shut')], volume: 0.7, refDistance: 6 },
  bounce: { files: [file('bounce')], volume: 0.1, refDistance: 6 },
  shake: {
    files: ['shake_1', 'shake_2', 'shake_3', 'shake_4'].map(file),
    volume: 0.7,
    refDistance: 6,
  },
  caught: { files: [file('capture_succeeded')], volume: 0.7, refDistance: 8 },
  break: { files: [file('break')], volume: 0.9, refDistance: 6 },
  sendOut: { files: [file('send_out')], volume: 0.7, refDistance: 8 },
  recall: { files: [file('recall')], volume: 0.7, refDistance: 8 },
}
