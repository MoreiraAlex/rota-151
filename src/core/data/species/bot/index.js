import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'


export const BOT = {
  id: 'bot',
  dexNumber: null,
  model: {
    path: '/assets/models/bot.glb',
    scale: 0.015,
  },
  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
  },
  body: {
    capsuleRadius: 0.4,
    capsuleHalfHeight: 0.95,
    capsuleAxis: 'y',
    modelOffset: [0, -1.4, 0],
  },
  movement: {
    walkSpeed: 4,
    runSpeed: 10,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  stats: {},
  moves: [],
}
