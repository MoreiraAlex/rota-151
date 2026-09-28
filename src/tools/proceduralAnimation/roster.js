/**
 * Elenco de criaturas da cena de teste (/tools/procedural-fox). ESTE ARQUIVO
 * É SEU — o motor (page.js, applyAnimationClip.js, curves.js,
 * resolveBones.js) só depende do formato de cada entrada, nunca do conteúdo.
 * Adiciona, remove ou edita criaturas aqui à vontade; nada disso é tocado
 * por mim em nenhum refactor do motor.
 *
 * Formato de cada entrada (exemplo do Fox abaixo):
 * { id, model, scale, position, clips: { <ação>: <clipeJSON>, ... } }
 *
 * `clips` mapeia nome-da-ação → clipe daquela criatura especificamente — o
 * mesmo nome de ação ("walk") aponta pra um JSON diferente em cada uma,
 * porque os nomes de osso não se repetem entre rigs diferentes.
 */
// import FOX_WALK_CLIP from '@/core/data/species/fox/clips/walk.json'
// import FOX_RUN_CLIP from '@/core/data/species/fox/clips/run.json'

import BULBASAUR_WALK_CLIP from '@/core/data/species/001-bulbasaur/clips/walk.json'
import BULBASAUR_FAINT_CLIP from '@/core/data/species/001-bulbasaur/clips/faint.json'
import BULBASAUR_RUN_CLIP from '@/core/data/species/001-bulbasaur/clips/run.json'

// import ARCANINE_WALK_CLIP from '@/core/data/species/arcanine/clips/walk.json'
// import ARCANINE_RUN_CLIP from '@/core/data/species/arcanine/clips/run.json'

// import BOY_WALK_CLIP from '@/core/data/species/boy/clips/walk.json'
// import BOY_RUN_CLIP from '@/core/data/species/boy/clips/run.json'

import CHARMANDER_WALK_CLIP from '@/core/data/species/004-charmander/clips/walk.json'
import CHARMANDER_RUN_CLIP from '@/core/data/species/004-charmander/clips/faint.json'

import SQUIRTLE_FAINT_CLIP from '@/core/data/species/007-squirtle/clips/faint.json'
import SQUIRTLE_RUN_CLIP from '@/core/data/species/007-squirtle/clips/faint.json'


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
  //   clips: { walk: CHARMANDER_WALK_CLIP, run: CHARMANDER_RUN_CLIP },
  // },
  {
    id: 'squirtle',
    model: '/assets/models/007-squirtle.glb',
    scale: 0.03,
    position: [0, 0, 0],
    clips: { walk: SQUIRTLE_FAINT_CLIP, run: SQUIRTLE_RUN_CLIP },
  },
  //  {
  //   id: 'boy',
  //   model: '/assets/models/boy.glb',
  //   scale: 1,
  //   position: [10, 0, 0],
  //   clips: { walk: BOY_WALK_CLIP, run: BOY_RUN_CLIP },
  // },
  // Suas entradas (arcanine, bulbasaur, próximas...) — cola aqui, mesmo formato.
]
