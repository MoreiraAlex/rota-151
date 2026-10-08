import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getItem, listItems } from '@/core/data/items'
import { rigLikeSource, scalePositionTracks } from './itemRig'
import { stripRootMotion, trimDeadTail } from './itemClipCleanup'

function loadGlb(path) {
  const buffer = readFileSync(`public${path}`)
  const data = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
  return new Promise((resolve, reject) =>
    new GLTFLoader().parse(data, '', resolve, reject),
  )
}

function worldBox(object) {
  object.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(object)
}

const RIGGED = listItems().filter((item) => item.model?.clipsFrom)

describe('itemRig — Pokébolas com os clipes de outra', () => {
  const loaded = {}
  beforeAll(async () => {
    for (const item of RIGGED) {
      const source = getItem(item.model.clipsFrom)
      loaded[item.id] = {
        target: await loadGlb(item.model.path),
        source: await loadGlb(source.model.path),
      }
    }
  })

  it('existe pelo menos uma bola herdando clipes', () => {
    expect(RIGGED.length).toBeGreaterThan(0)
  })

  it('monta os mesmos grupos da origem e pendura as peças sem tirar do lugar', () => {
    for (const item of RIGGED) {
      const { target, source } = loaded[item.id]
      const clone = target.scene.clone(true)
      const turned = new THREE.Group()
      turned.rotation.set(
        ...['x', 'y', 'z'].map(
          (axis) => ((item.model.rig?.rotation?.[axis] ?? 0) * Math.PI) / 180,
        ),
      )
      const reference = target.scene.clone(true)
      turned.add(reference)
      const before = worldBox(turned)

      const { object, scale } = rigLikeSource(
        clone,
        source.scene,
        item.model.rig,
      )

      expect(worldBox(object).min.distanceTo(before.min)).toBeLessThan(
        1e-3 * scale + 1e-6,
      )
      expect(worldBox(object).max.distanceTo(before.max)).toBeLessThan(
        1e-3 * scale + 1e-6,
      )
      source.scene.traverse((node) => {
        if (!node.name || node.isMesh) return
        expect(object.getObjectByName(node.name)).toBeTruthy()
      })
      // Cada peça com o nome da origem fica embaixo do grupo pai dela lá.
      source.scene.traverse((node) => {
        if (!node.isMesh) return
        const part = object.getObjectByName(node.name)
        expect(part?.parent?.name).toBe(node.parent.name)
      })
    }
  })

  it('os clipes da origem tocam na bola sem desmontar (fica do tamanho dela)', () => {
    for (const item of RIGGED) {
      const { target, source } = loaded[item.id]
      const { object, scale } = rigLikeSource(
        target.scene.clone(true),
        source.scene,
        item.model.rig,
      )
      const rest = worldBox(object)
      const size = rest.getSize(new THREE.Vector3()).length()
      const rootNames = source.scene.children.map((child) => child.name)
      const mixer = new THREE.AnimationMixer(object)

      for (const raw of source.animations) {
        const clip = scalePositionTracks(
          stripRootMotion(trimDeadTail(raw.clone()), rootNames),
          scale,
        )
        mixer.stopAllAction()
        mixer.clipAction(clip).play()
        for (let t = 0; t <= clip.duration; t += clip.duration / 10) {
          mixer.setTime(t)
          const box = worldBox(object)
          // Não some nem voa: o centro fica perto, o tamanho na mesma ordem.
          const center = box.getCenter(new THREE.Vector3())
          expect(
            center.distanceTo(rest.getCenter(new THREE.Vector3())),
          ).toBeLessThan(size)
          expect(box.getSize(new THREE.Vector3()).length()).toBeLessThan(
            size * 2,
          )
        }
      }
    }
  })
})
