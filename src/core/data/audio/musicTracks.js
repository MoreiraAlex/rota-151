/**
 * Música de fundo (docs/features/065-sons-do-mundo.md, Partes 2 e 3), no
 * estilo do Minecraft: uma música toca inteira, uma vez, e depois vem um
 * silêncio sorteado até a próxima. Tocada por `view/systems/musicSystem.js`.
 * Convertidas por `scripts/audio/sons-do-mundo.sh` (volume igualado entre
 * elas).
 *
 * Por faixa:
 * - `path`: o arquivo;
 * - `volume`: multiplica o canal de música;
 * - `loopStart` / `loopEnd` (s, só a da batalha, que repete): o trecho que
 *   repete. A primeira vez toca do começo do arquivo; ao chegar no
 *   `loopEnd`, volta pro `loopStart`. Medidos comparando o áudio com ele
 *   mesmo.
 */
const MUSIC_DIR = '/assets/audio/music'

const song = (id) => ({ path: `${MUSIC_DIR}/${id}.ogg`, volume: 1 })

// Músicas de exploração: as das áreas e da noite do Legends Arceus.
const SONG_IDS = [
  'plains-day-1',
  'plains-day-2',
  'plains-day-3',
  'forest-day-1',
  'forest-day-2',
  'forest-day-3',
  'savanna-day-1',
  'savanna-day-2',
  'savanna-day-3',
  'city-day-1',
  'city-day-2',
  'night-1',
  'night-2',
  'night-3',
  'night-4',
]

export const MUSIC_TRACKS = {
  ...Object.fromEntries(SONG_IDS.map((id) => [id, song(id)])),
  // Battle! (Wild Pokémon), do Brilliant Diamond / Shining Pearl.
  'battle-wild': {
    path: `${MUSIC_DIR}/battle-wild.ogg`,
    volume: 1,
    loopStart: 17,
    loopEnd: 74.3795,
  },
}

// A noite é a mesma lista em todo lugar.
const NIGHT = ['night-1', 'night-2', 'night-3', 'night-4']

/**
 * As músicas que podem tocar em cada bioma, de dia e de noite; a próxima é
 * sorteada da lista do lugar e da hora no momento de começar. Bioma sem
 * entrada (os escondidos, só vistos pelo F2) usa a do
 * `MUSIC_FALLBACK_BIOME`.
 */
export const BIOME_MUSIC = {
  plains: {
    day: ['plains-day-1', 'plains-day-2', 'plains-day-3'],
    night: NIGHT,
  },
  forest: {
    day: ['forest-day-1', 'forest-day-2', 'forest-day-3'],
    night: NIGHT,
  },
  savanna: {
    day: ['savanna-day-1', 'savanna-day-2', 'savanna-day-3'],
    night: NIGHT,
  },
  city: { day: ['city-day-1', 'city-day-2'], night: NIGHT },
}

export const MUSIC_FALLBACK_BIOME = 'plains'

/**
 * Frequência da música, que o jogador escolhe na tela "Som": o silêncio
 * entre uma música e a próxima (s), sorteado entre `min` e `max`.
 */
export const MUSIC_FREQUENCIES = {
  rare: { min: 240, max: 600 },
  normal: { min: 120, max: 300 },
  always: { min: 3, max: 8 },
}

export const DEFAULT_MUSIC_FREQUENCY = 'normal'

export const MUSIC = {
  // Silêncio (s) entre entrar no mundo e a primeira música.
  FIRST_DELAY: { min: 5, max: 20 },
  // Quanto tempo (s) a música leva pra sumir quando é interrompida (a de
  // exploração quando a luta começa, a de batalha quando ela acaba).
  FADE_OUT: 2.5,
  // A música da batalha (Parte 3).
  BATTLE_TRACK: 'battle-wild',
  // Quanto tempo (s) depois de a luta acabar (nenhuma selvagem perseguindo
  // o grupo e ninguém do time lutando) até a música da batalha sair.
  BATTLE_HOLD: 4,
}
