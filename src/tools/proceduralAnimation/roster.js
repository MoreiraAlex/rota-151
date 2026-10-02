/**
 * Formato de cada entrada (exemplo do Fox abaixo):
 * { id, model, scale, position, clips: { <ação>: <clipeJSON>, ... } }
 *
 * `clips` mapeia nome-da-ação → clipe daquela criatura especificamente — o
 * mesmo nome de ação ("walk") aponta pra um JSON diferente em cada uma,
 * porque os nomes de osso não se repetem entre rigs diferentes.
 */
// import FOX_WALK_CLIP from '@/core/data/species/fox/clips/walk.json'
// import FOX_RUN_CLIP from '@/core/data/species/fox/clips/run.json'

// import ARCANINE_WALK_CLIP from '@/core/data/species/arcanine/clips/walk.json'
// import ARCANINE_RUN_CLIP from '@/core/data/species/arcanine/clips/run.json'

// import BOY_WALK_CLIP from '@/core/data/species/boy/clips/walk.json'
// import BOY_RUN_CLIP from '@/core/data/species/boy/clips/run.json'

export const CREATURES = [
  // {
  //   id: 'fox',
  //   model: '/assets/models/fox-debug.glb',
  //   scale: 0.03,
  //   position: [-4, 0, 0],
  //   clips: { walk: FOX_WALK_CLIP, run: FOX_RUN_CLIP },
  // },
  // {
  //   id: 'arcanine',
  //   model: '/assets/models/arcanine.glb',
  //   scale: 1,
  //   position: [0, 0, 0],
  //   clips: { walk: ARCANINE_WALK_CLIP, run: ARCANINE_RUN_CLIP },
  // },
  // {
  //   id: 'bulbasaur',
  //   model: '/assets/models/001-bulbasaur.glb',
  //   scale: 0.03,
  //   position: [4, 0, 0],
  //   clips: { walk: BULBASAUR_FAINT_CLIP, run: BULBASAUR_RUN_CLIP },
  // },
  // {
  //   id: 'bulbasaur',
  //   model: '/assets/models/001-bulbasaur.glb',
  //   scale: 0.03,
  //   position: [0, 0, 0],
  //   clips: { walk: BULBASAUR_WALK_CLIP, run: BULBASAUR_RUN_CLIP },
  // },
  // {
  //   id: 'charmander',
  //   model: '/assets/models/004-charmander.glb',
  //   scale: 0.03,
  //   position: [0, 0, 0],
  //   clips: {
  //     idle: CHARMANDER_IDLE_CLIP,
  //     walk: CHARMANDER_WALK_CLIP,
  //     run: CHARMANDER_RUN_CLIP,
  //     faint: CHARMANDER_FAINT_CLIP,
  //     attack: CHARMANDER_ATTACK_CLIP
  //   },
  // },
  //  {
  //   id: 'boy',
  //   model: '/assets/models/boy.glb',
  //   scale: 1,
  //   position: [10, 0, 0],
  //   clips: { walk: BOY_WALK_CLIP, run: BOY_RUN_CLIP },
  // },
  // Suas entradas (arcanine, bulbasaur, próximas...) — cola aqui, mesmo formato.
]
