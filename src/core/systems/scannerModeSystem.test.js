import { describe, it, expect, afterEach } from 'vitest'
import { makeWorld } from '@/test/makeWorld'
import {
  HeldItem,
  OrbitCamera,
  PhysicsBody,
  PokedexEntries,
  Position,
  Rotation,
  ScanHistory,
  ScanMode,
  Scanned,
  Targeting,
  WildCreature,
} from '@/core/traits'
import {
  initPhysics,
  disposePhysics,
  stepPhysics,
} from '@/core/physics/physicsWorld'
import { createCharacterBody } from '@/core/physics/colliders'
import { getItem } from '@/core/data/items'
import { scannerModeSystem } from './scannerModeSystem'

const spawnedWorlds = []
afterEach(() => {
  while (spawnedWorlds.length) spawnedWorlds.pop().destroy()
})

function setup() {
  const created = makeWorld()
  spawnedWorlds.push(created.world)
  const tick = (input = {}) =>
    scannerModeSystem({ world: created.world, input })
  return { ...created, tick }
}

// Corpo físico de verdade (não o handle -1 default de `makeWorld`/testes
// sem física) — o raio do scanner precisa de um collider de VERDADE no
// mundo do Rapier pra ter algo pra acertar.
function spawnWildCreature(world, position) {
  const { bodyHandle, colliderHandle } = createCharacterBody(position, {
    radius: 1,
    halfHeight: 1,
    axis: 'y',
  })
  return world.spawn(
    Position(position),
    Rotation,
    WildCreature({ speciesId: 'fox' }),
    PhysicsBody({ bodyHandle, colliderHandle }),
  )
}

// `boy` (PLAYER_SPECIES_ID) — targetHeight real do treinador, mesma
// altura de olho que `scannerModeSystem.js` resolve via
// `getPlayerSpecies()` (não a espécie 'fox' que `makeWorld()` usa só
// pra movement/vitals do player de teste).
const TRAINER_EYE_HEIGHT = 2 + 1.2

describe('scannerModeSystem', () => {
  it('sem item scanner equipado, segurar o botão direito não liga o modo', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pebble' }) // throwable, não scanner

    tick({ secondaryHeld: true })

    expect(player.get(ScanMode).active).toBe(false)
  })

  it('com pokedex equipada, segurar o botão direito liga o modo', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ secondaryHeld: true })

    expect(player.get(ScanMode).active).toBe(true)
  })

  it('continuar segurando mantém o modo ligado em vários ticks', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ secondaryHeld: true })
    tick({ secondaryHeld: true })
    tick({ secondaryHeld: true })

    expect(player.get(ScanMode).active).toBe(true)
  })

  it('soltar o botão direito desliga o modo', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ secondaryHeld: true })
    expect(player.get(ScanMode).active).toBe(true)

    tick({ secondaryReleased: true }) // secondaryHeld já false, mesmo tick do mouseup
    expect(player.get(ScanMode).active).toBe(false)
  })

  it('sem segurar, não muda nada mesmo com item scanner equipado', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({})

    expect(player.get(ScanMode).active).toBe(false)
  })

  it('trocar de item pra um não-scanner desliga o modo sozinho', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })
    tick({ secondaryHeld: true })
    expect(player.get(ScanMode).active).toBe(true)

    player.set(HeldItem, { itemId: 'potion' })
    tick({ secondaryHeld: true }) // ainda "segurando" fisicamente, mas o item mudou

    expect(player.get(ScanMode).active).toBe(false)
  })

  it('desequipar (mão vazia) desliga o modo sozinho', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })
    tick({ secondaryHeld: true })
    expect(player.get(ScanMode).active).toBe(true)

    player.set(HeldItem, { itemId: null })
    tick({ secondaryHeld: true })

    expect(player.get(ScanMode).active).toBe(false)
  })
})

describe('scannerModeSystem — rastreio e confirmação de alvo', () => {
  afterEach(() => {
    disposePhysics()
  })

  it('com uma criatura selvagem na mira, Targeting aponta pra ela', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    const wild = spawnWildCreature(world, {
      x: 0,
      y: TRAINER_EYE_HEIGHT,
      z: -10,
    })
    stepPhysics()

    tick({ secondaryHeld: true }) // liga e já rastreia no mesmo tick

    expect(player.targetFor(Targeting)).toBe(wild)
  })

  it('criatura além do alcance configurado no item não é alvo', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    const { range } = getItem('pokedex').scanner
    spawnWildCreature(world, {
      x: 0,
      y: TRAINER_EYE_HEIGHT,
      z: -(range + 10), // bem além do alcance do item
    })
    stepPhysics()

    tick({ secondaryHeld: true })

    expect(player.targetFor(Targeting)).toBeFalsy()
  })

  it('criatura dentro do alcance configurado no item é alvo', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    const { range } = getItem('pokedex').scanner
    const wild = spawnWildCreature(world, {
      x: 0,
      y: TRAINER_EYE_HEIGHT,
      z: -(range - 5), // dentro do alcance, perto do limite
    })
    stepPhysics()

    tick({ secondaryHeld: true })

    expect(player.targetFor(Targeting)).toBe(wild)
  })

  it('sem nada na mira (olhando pro lado oposto), Targeting fica vazio', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: Math.PI, pitch: 0, distance: 10 })

    spawnWildCreature(world, { x: 0, y: TRAINER_EYE_HEIGHT, z: -10 })
    stepPhysics()

    tick({ secondaryHeld: true })

    expect(player.targetFor(Targeting)).toBeFalsy()
  })

  it('clique esquerdo enquanto segura o direito, com alvo travado, confirma o scan', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    const wild = spawnWildCreature(world, {
      x: 0,
      y: TRAINER_EYE_HEIGHT,
      z: -10,
    })
    stepPhysics()

    tick({ secondaryHeld: true }) // segura, mira, rastreia
    tick({ secondaryHeld: true, primary: true }) // confirma SEM soltar o direito

    expect(player.targetFor(Scanned)).toBe(wild)
    // ainda segurando o direito — a câmera continua em primeira pessoa
    // até soltar de verdade (confirmar e sair são ações separadas agora)
    expect(player.get(ScanMode).active).toBe(true)
  })

  it('soltar o direito depois de confirmar desliga o modo, sem confirmar de novo', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    spawnWildCreature(world, { x: 0, y: TRAINER_EYE_HEIGHT, z: -10 })
    stepPhysics()

    tick({ secondaryHeld: true })
    tick({ secondaryHeld: true, primary: true }) // confirma
    tick({ secondaryReleased: true }) // solta — só sai, não confirma de novo

    expect(player.get(ScanMode).active).toBe(false)
    expect(player.get(ScanHistory).entries).toHaveLength(1)
  })

  it('confirmar o scan registra a espécie na Pokédex e no histórico', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    spawnWildCreature(world, { x: 0, y: TRAINER_EYE_HEIGHT, z: -10 })
    stepPhysics()

    tick({ secondaryHeld: true })
    tick({ secondaryHeld: true, primary: true })

    expect(player.get(PokedexEntries).speciesIds).toEqual(['fox'])
    expect(player.get(ScanHistory).entries[0].speciesId).toBe('fox')
  })

  it('clique esquerdo enquanto segura, SEM alvo travado, não confirma nada', async () => {
    await initPhysics()
    const { player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    tick({ secondaryHeld: true })
    tick({ secondaryHeld: true, primary: true })

    expect(player.targetFor(Scanned)).toBeFalsy()
    // continua segurando — nada travado pra confirmar, mas o modo
    // continua ligado (só sai soltando)
    expect(player.get(ScanMode).active).toBe(true)
  })

  it('soltar sem nunca ter clicado o esquerdo cancela (desliga sem confirmar)', async () => {
    await initPhysics()
    const { world, player, camera, tick } = setup()
    player.set(Position, { x: 0, y: 2, z: 0 })
    player.set(HeldItem, { itemId: 'pokedex' })
    camera.set(OrbitCamera, { yaw: 0, pitch: 0, distance: 10 })

    spawnWildCreature(world, { x: 0, y: TRAINER_EYE_HEIGHT, z: -10 })
    stepPhysics()

    tick({ secondaryHeld: true }) // segura, mira, rastreia — nunca clica o esquerdo
    tick({ secondaryReleased: true }) // solta direto

    expect(player.targetFor(Scanned)).toBeFalsy()
    expect(player.get(ScanMode).active).toBe(false)
  })

  it('soltar sem nunca ter segurado (sem estado prévio) não faz nada', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ secondaryReleased: true })

    expect(player.targetFor(Scanned)).toBeFalsy()
    expect(player.get(ScanMode).active).toBe(false)
  })
})

describe('scannerModeSystem — clique esquerdo abre o menu da Pokédex', () => {
  it('clique esquerdo fora do modo scanner incrementa o pedido de abrir o menu', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ primary: true })

    expect(player.get(ScanMode).menuOpenRequests).toBe(1)
  })

  it('clique esquerdo repetido incrementa a cada vez (contador, não toggle)', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ primary: true })
    tick({ primary: true })

    expect(player.get(ScanMode).menuOpenRequests).toBe(2)
  })

  it('sem item scanner equipado, clique esquerdo não pede pra abrir o menu', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pebble' })

    tick({ primary: true })

    expect(player.get(ScanMode).menuOpenRequests).toBe(0)
  })

  it('clique esquerdo enquanto segura o botão direito não pede pra abrir o menu', () => {
    const { player, tick } = setup()
    player.set(HeldItem, { itemId: 'pokedex' })

    tick({ secondaryHeld: true, primary: true })

    expect(player.get(ScanMode).menuOpenRequests).toBe(0)
  })
})
