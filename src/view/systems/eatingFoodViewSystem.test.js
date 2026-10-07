import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createWorld } from 'koota'
import { listSpecies } from '@/core/data/species'
import { GAME_CONFIG } from '@/core/gameConfig'
import { drainFoodVfx } from '../vfx/foodVfxQueue'
import { verticalClearance } from '@/core/physics/colliders'
import {
  CharacterController,
  Eating,
  Position,
  Rotation,
  SummonedCreature,
} from '@/core/traits'
import {
  registerAnimatedBones,
  unregisterAnimatedBones,
} from '../registry/animationRegistry'
import {
  registerEatingFood,
  setEatingFoodModel,
  unregisterEatingFood,
} from '../registry/eatingFoodRegistry'
import { eatingFoodViewSystem } from './eatingFoodViewSystem'

// Um Pokémon de cada âncora, lido dos dados (sem fixar qual). Cada teste
// começa com `position`/`scale` neutros, pra conferir só o que testa.
const pokemon = listSpecies().filter((species) => species.kind !== 'trainer')
const handsSpecies = pokemon.find(
  (species) => species.vfx?.eatFood?.hands?.length === 2,
)
const groundSpecies = pokemon.find((species) => species.vfx?.eatFood?.ground)
const [leftHand, rightHand] = handsSpecies.vfx.eatFood.hands
const mouthBone = groundSpecies.vfx.eatFood.ground

const originalConfigs = new Map(
  [handsSpecies, groundSpecies].map((species) => [
    species,
    species.vfx.eatFood,
  ]),
)

const cleanup = []
beforeEach(() => {
  for (const [species, config] of originalConfigs) {
    species.vfx.eatFood = {
      ...config,
      position: null,
      rotation: null,
      scale: 1,
    }
  }
})
afterEach(() => {
  while (cleanup.length) cleanup.pop()()
  drainFoodVfx()
  for (const [species, config] of originalConfigs) {
    species.vfx.eatFood = config
  }
})

function boneAt(x, y, z) {
  const bone = new THREE.Object3D()
  bone.position.set(x, y, z)
  bone.updateMatrixWorld(true)
  return { bone }
}

// Ticka com tempo até a mola da mordida assentar.
function settle(world, seconds = 3) {
  for (let i = 0; i < seconds * 60; i++) {
    eatingFoodViewSystem({ world, delta: 1 / 60 })
  }
}

function handsAt(y) {
  return { [leftHand]: boneAt(0, y, 0), [rightHand]: boneAt(0, y, 0) }
}

function setup(species, bones, eating = {}) {
  const world = createWorld()
  const eater = world.spawn(
    SummonedCreature({ slot: 'slot1', speciesId: species.id }),
    Position({ x: 0, y: 1, z: 0 }),
    Rotation,
    CharacterController,
    Eating({ itemId: 'x', duration: 2, healTotal: 10, healed: 0, ...eating }),
  )
  const group = new THREE.Group()
  registerEatingFood(eater, group)
  registerAnimatedBones(eater, { bones, clips: {} })
  cleanup.push(() => {
    unregisterEatingFood(eater)
    unregisterAnimatedBones(eater)
    world.destroy()
  })
  return { world, eater, group }
}

describe('eatingFoodViewSystem', () => {
  it('leva à boca: a fruta fica no ponto médio das mãos', () => {
    const { world, group } = setup(handsSpecies, {
      [leftHand]: boneAt(-0.2, 1.5, 0.3),
      [rightHand]: boneAt(0.2, 1.7, 0.3),
    })

    eatingFoodViewSystem({ world })

    expect(group.visible).toBe(true)
    expect(group.position.x).toBeCloseTo(0)
    expect(group.position.y).toBeCloseTo(1.6)
    expect(group.position.z).toBeCloseTo(0.3)
  })

  it('come do chão: a fruta fica no chão embaixo da boca, e não escorrega', () => {
    const mouth = boneAt(0.1, 0.5, 0.4)
    const { world, eater, group } = setup(groundSpecies, {
      [mouthBone]: mouth,
    })
    const groundY = 1 - verticalClearance(eater.get(CharacterController))

    eatingFoodViewSystem({ world })
    const first = group.position.clone()
    mouth.bone.position.set(0.3, 0.2, 0.9)
    mouth.bone.updateMatrixWorld(true)
    eatingFoodViewSystem({ world })

    expect(first.x).toBeCloseTo(0.1)
    expect(first.z).toBeCloseTo(0.4)
    expect(first.y).toBeCloseTo(groundY)
    expect(group.position.x).toBeCloseTo(first.x)
    expect(group.position.z).toBeCloseTo(first.z)
  })

  it('`position` desloca a fruta no referencial do corpo (gira com ele)', () => {
    handsSpecies.vfx.eatFood.position = { x: 0, y: 0.1, z: 0.5 }
    const { world, eater, group } = setup(handsSpecies, handsAt(1))
    // Virado pra +x: "pra frente" vira +x no mundo.
    eater.set(Rotation, { y: Math.PI / 2 })

    eatingFoodViewSystem({ world })

    expect(group.position.x).toBeCloseTo(0.5)
    expect(group.position.y).toBeCloseTo(1.1)
    expect(group.position.z).toBeCloseTo(0)
  })

  it('encolhe conforme a cura sai, por cima do `scale` da espécie', () => {
    const fresh = setup(handsSpecies, handsAt(1))
    const half = setup(handsSpecies, handsAt(1), { healed: 5 })

    eatingFoodViewSystem({ world: fresh.world })
    eatingFoodViewSystem({ world: half.world })
    expect(fresh.group.scale.x).toBe(1)
    expect(half.group.scale.x).toBeLessThan(1)

    handsSpecies.vfx.eatFood.scale = 2
    eatingFoodViewSystem({ world: fresh.world })
    expect(fresh.group.scale.x).toBe(2)
  })

  it('sem os ossos das mãos (modelo carregando), fica escondida', () => {
    const { world, group } = setup(handsSpecies, {})

    eatingFoodViewSystem({ world })

    expect(group.visible).toBe(false)
  })

  it('fruta com modelo troca de pedaço conforme é comida, sem encolher', () => {
    // Sem mordidas pelo relógio: só a troca de pedaço morde.
    handsSpecies.vfx.eatFood.biteInterval = Number.POSITIVE_INFINITY
    const stages = [new THREE.Group(), new THREE.Group(), new THREE.Group()]
    const { world, eater, group } = setup(handsSpecies, handsAt(1))
    setEatingFoodModel(eater, { stages, pivot: null })
    const visibleIndex = () => stages.findIndex((stage) => stage.visible)

    eatingFoodViewSystem({ world })
    expect(visibleIndex()).toBe(0)
    expect(group.scale.x).toBe(1)

    const eating = eater.get(Eating)
    eater.set(Eating, { ...eating, healed: eating.healTotal * 0.9 })
    eatingFoodViewSystem({ world })
    expect(visibleIndex()).toBe(stages.length - 1)
    expect(stages.filter((stage) => stage.visible)).toHaveLength(1)
    // A troca de pedaço é uma mordida (aperta); assentada, o tamanho é o
    // mesmo de antes — o modelo não encolhe.
    settle(world)
    expect(group.scale.x).toBeCloseTo(1)
  })

  it('a cada mordida a fruta aperta e pede suco e farelos onde ela está', () => {
    const { BITE_INTERVAL } = GAME_CONFIG.FEEDBACK.EAT_FOOD
    const { world, group } = setup(handsSpecies, handsAt(1))
    drainFoodVfx()

    let requests = []
    for (let t = 0; t <= BITE_INTERVAL * 1.1 && !requests.length; t += 1 / 60) {
      eatingFoodViewSystem({ world, delta: 1 / 60 })
      requests = drainFoodVfx()
    }

    expect(requests).toHaveLength(1)
    expect(requests[0].kind).toBe('bite')
    expect(requests[0].position[1]).toBeGreaterThanOrEqual(1)
    expect(group.scale.y).toBeLessThan(1)
  })

  it('no chão, a fruta pula um pouco depois da mordida e volta pro chão', () => {
    const { BITE_INTERVAL } = GAME_CONFIG.FEEDBACK.EAT_FOOD
    const { world, eater, group } = setup(groundSpecies, {
      [mouthBone]: boneAt(0, 0.5, 0.4),
    })
    const groundY = 1 - verticalClearance(eater.get(CharacterController))

    let highest = groundY
    for (let t = 0; t < BITE_INTERVAL + 0.4; t += 1 / 60) {
      eatingFoodViewSystem({ world, delta: 1 / 60 })
      highest = Math.max(highest, group.position.y)
    }

    expect(highest).toBeGreaterThan(groundY)
    settle(world, BITE_INTERVAL * 0.9)
    expect(group.position.y).toBeGreaterThanOrEqual(groundY)
  })

  it('`rotation` da espécie gira a fruta (graus)', () => {
    handsSpecies.vfx.eatFood.rotation = { x: 0, y: 90, z: 0 }
    const { world, group } = setup(handsSpecies, handsAt(1))

    eatingFoodViewSystem({ world })

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion)
    expect(forward.x).toBeCloseTo(1)
    expect(forward.z).toBeCloseTo(0)
  })

  it('gira e aperta no pivô do modelo, sem mexer no grupo de fora', () => {
    handsSpecies.vfx.eatFood.rotation = { x: 30, y: 45, z: 0 }
    const pivot = new THREE.Group()
    const { world, eater, group } = setup(handsSpecies, handsAt(1))
    setEatingFoodModel(eater, { stages: [], pivot })

    eatingFoodViewSystem({ world })

    expect(group.quaternion.equals(new THREE.Quaternion())).toBe(true)
    expect(pivot.quaternion.equals(new THREE.Quaternion())).toBe(false)
    expect(group.position.y).toBeCloseTo(1)
  })
})
