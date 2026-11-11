import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  clearNameplate,
  setNameplateShown,
  trackSilhouettes,
  updateSilhouettes,
} from './silhouetteVisibility'

// Quando a silhueta atrás das plantas aparece (066).
const make = () => new THREE.Object3D()

describe('silhueta e nameplate', () => {
  it('a da selvagem nasce escondida e só aparece com o nameplate à mostra', () => {
    const entity = {}
    const silhouette = make()
    const untrack = trackSilhouettes(entity, [silhouette], { wild: true })
    expect(silhouette.visible).toBe(false)

    updateSilhouettes(false)
    expect(silhouette.visible).toBe(false)

    setNameplateShown(entity, true)
    updateSilhouettes(false)
    expect(silhouette.visible).toBe(true)

    setNameplateShown(entity, false)
    updateSilhouettes(false)
    expect(silhouette.visible).toBe(false)

    setNameplateShown(entity, true)
    clearNameplate(entity)
    updateSilhouettes(false)
    expect(silhouette.visible).toBe(false)
    untrack()
  })

  it('a do seu lado aparece sempre, sem nameplate, de dia e de noite', () => {
    const ally = {}
    const silhouette = make()
    const untrack = trackSilhouettes(ally, [silhouette])
    updateSilhouettes(false)
    expect(silhouette.visible).toBe(true)
    updateSilhouettes(true)
    expect(silhouette.visible).toBe(true)
    untrack()
  })

  it('a que some à noite: só de dia; a outra, de dia e de noite', () => {
    const wild = {}
    const ally = {}
    const wildSilhouette = make()
    const allySilhouette = make()
    const untrackWild = trackSilhouettes(wild, [wildSilhouette], {
      wild: true,
      hideAtNight: true,
    })
    const untrackAlly = trackSilhouettes(ally, [allySilhouette], {
      wild: true,
    })
    setNameplateShown(wild, true)
    setNameplateShown(ally, true)

    updateSilhouettes(true)
    expect(wildSilhouette.visible).toBe(false)
    expect(allySilhouette.visible).toBe(true)

    updateSilhouettes(false)
    expect(wildSilhouette.visible).toBe(true)
    expect(allySilhouette.visible).toBe(true)
    untrackWild()
    untrackAlly()
    clearNameplate(wild)
    clearNameplate(ally)
  })

  it('depois de parar, a silhueta não é mais mexida', () => {
    const entity = {}
    const silhouette = make()
    const untrack = trackSilhouettes(entity, [silhouette], { wild: true })
    untrack()
    setNameplateShown(entity, true)
    updateSilhouettes(false)
    expect(silhouette.visible).toBe(false)
    clearNameplate(entity)
  })
})
