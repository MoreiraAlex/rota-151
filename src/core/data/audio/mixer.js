/**
 * Canais de volume (docs/features/065-sons-do-mundo.md, Parte 1). Todo som
 * do jogo passa por um canal; o jogador ajusta cada um na tela "Som" do
 * menu, e o `master` multiplica todos. Os volumes ficam no treinador
 * (`SoundSettings`) e vão no save da conta.
 *
 * - `music`: a música de fundo;
 * - `ambient`: o ambiente — fundo dos biomas, clima e água;
 * - `effects`: o resto — passos, vozes, golpes, pokébola, itens.
 */
export const SOUND_CHANNELS = ['music', 'ambient', 'effects']

/** As chaves de volume que o jogador ajusta: o geral e um por canal. */
export const VOLUME_KEYS = ['master', ...SOUND_CHANNELS]

/** Volume de quem nunca mexeu (0 a 1). */
export const DEFAULT_VOLUMES = {
  master: 1,
  music: 0.02,
  ambient: 0.05,
  effects: 0.75,
}
