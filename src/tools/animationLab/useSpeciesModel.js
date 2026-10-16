import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { resolveBones } from '@/core/animation/resolveBones'
import { GAME_CONFIG } from '@/core/gameConfig'
import { applyToonLook, isOutline } from '@/view/materials/toonMaterial'
import { loadTexture } from '@/view/textures/textureCache'
import { resolveEyeState } from '@/view/shared/eyeState'

/**
 * O modelo de uma espécie pros laboratórios (`tools/animationLab/`,
 * `tools/bodyLab/`), com o mesmo visual do jogo (texturas por material e
 * toon) e uma animação do `.glb` em loop. Quem usa avança o `mixer` no
 * próprio `useFrame` (`mixer.update`) e pode escrever por cima nos ossos
 * (`bonesRef`, de `resolveBones`).
 */
export function useSpeciesModel(species, animation) {
  const { scene, animations } = useGLTF(species.model.path)
  const cloned = useMemo(() => cloneSkeleton(scene), [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned])
  // resolvido antes de tocar qualquer animação: o descanso é o do `.glb`
  const bones = useMemo(() => {
    let skeleton = null
    cloned.traverse((child) => {
      if (child.isSkinnedMesh && !skeleton) skeleton = child.skeleton
    })
    return skeleton ? resolveBones(skeleton) : {}
  }, [cloned])
  const bonesRef = useRef(bones)
  bonesRef.current = bones

  useEffect(() => {
    if (!GAME_CONFIG.RENDER.TOON) return
    const meshes = []
    cloned.traverse((child) => {
      if (child.isMesh) meshes.push(child)
    })
    return applyToonLook(meshes)
  }, [cloned])

  useSpeciesTextures(cloned, species)

  useEffect(() => {
    mixer.stopAllAction()
    restoreRest(Object.values(bonesRef.current))
    const clip = animations.find((candidate) => candidate.name === animation)
    if (!clip) return
    mixer.clipAction(clip).reset().setLoop(THREE.LoopRepeat, Infinity).play()
  }, [mixer, animations, animation])

  useEffect(() => () => mixer.stopAllAction(), [mixer])

  return { cloned, animations, mixer, bonesRef }
}

export function restoreRest(entries) {
  for (const entry of entries) {
    entry.bone.quaternion.set(
      entry.restQuaternion.x,
      entry.restQuaternion.y,
      entry.restQuaternion.z,
      entry.restQuaternion.w,
    )
    entry.bone.position.set(
      entry.rest.position.x,
      entry.rest.position.y,
      entry.rest.position.z,
    )
    entry.bone.scale.set(
      entry.rest.scale.x,
      entry.rest.scale.y,
      entry.rest.scale.z,
    )
  }
}

/** Texturas da espécie, pela ordem de encontro dos meshes (como o jogo). */
function useSpeciesTextures(cloned, species) {
  useEffect(() => {
    const texture = species.model.texture
    if (!texture) return
    const meshes = []
    cloned.traverse((child) => {
      if (child.isMesh && !isOutline(child)) meshes.push(child)
    })
    const perMaterial = typeof texture === 'object'
    const entries = perMaterial
      ? Object.entries(texture)
      : [['0', { path: texture }]]
    let cancelled = false

    for (const [index, entry] of entries) {
      loadTexture(entry.path).then((cached) => {
        if (!cached || cancelled) return
        // Atlas (olho com `eyeStates` ou `pan`): uma cópia própria recortada
        // na célula de olho aberto, como o jogo mostra ao carregar — sem
        // isso o olho aparece com o atlas inteiro.
        const cell = entry.eyeStates
          ? resolveEyeState(entry.eyeStates, 'awake')?.open
          : entry.pan
        const loaded = entry.repeat ? cached.clone() : cached
        if (entry.repeat) {
          loaded.repeat.set(entry.repeat.x ?? 1, entry.repeat.y ?? 1)
          loaded.offset.set(
            (1 - loaded.repeat.x) / 2 + (cell?.x ?? 0),
            (1 - loaded.repeat.y) / 2 + (cell?.y ?? 0),
          )
        }
        if (entry.flipY !== undefined) loaded.flipY = entry.flipY
        loaded.needsUpdate = true
        const targets = perMaterial ? [meshes[Number(index)]] : meshes
        for (const mesh of targets) {
          if (!mesh) continue
          mesh.material = mesh.material.clone()
          mesh.material.map = loaded
          mesh.material.needsUpdate = true
        }
      })
    }
    return () => {
      cancelled = true
    }
  }, [cloned, species])
}
