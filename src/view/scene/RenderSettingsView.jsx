'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  getRenderSettingsRevision,
  subscribeRenderSettings,
} from './renderSettings'

const TONE_MAPPINGS = {
  aces: THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
}

/**
 * SMAA por cima da cena. A cena é desenhada num alvo com a curva de cor e
 * o sRGB já aplicados, igual à tela — o céu (`DayNightView`) escreve cor de
 * tela direto, e um pós-processamento comum (curva aplicada no fim) mudaria
 * a cor dele. O three só aplica curva e sRGB fora da tela num alvo marcado
 * como de XR (`isXRRenderTarget`); com `HalfFloatType`, o sRGB fica no valor
 * guardado, sem conversão do hardware. O SMAA lê esse alvo e escreve na
 * tela como está.
 *
 * `useFrame` com prioridade: assume o desenho do quadro no lugar do R3F —
 * exceção das regras (3.4), só visual.
 */
function SmaaComposer() {
  const { gl, scene, camera, size } = useThree()

  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
    })
    const result = new EffectComposer(gl, target)
    for (const buffer of [result.renderTarget1, result.renderTarget2]) {
      buffer.isXRRenderTarget = true
      buffer.texture.colorSpace = THREE.SRGBColorSpace
    }
    result.addPass(new RenderPass(scene, camera))
    result.addPass(new SMAAPass())
    return result
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
  }, [composer, gl, size])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame((_, delta) => composer.render(delta), 1)
  return null
}

/**
 * Curva de cor da cena (ACES ou Neutral), o SMAA (`GAME_CONFIG.RENDER`) e
 * a densidade de pixels máxima da qualidade (`VEGETATION_QUALITY`),
 * docs/features/049-vegetacao-e-floresta.md. Trocar a curva recompila os
 * materiais (ela entra no shader).
 */
export function RenderSettingsView() {
  const revision = useSyncExternalStore(
    subscribeRenderSettings,
    getRenderSettingsRevision,
    getRenderSettingsRevision,
  )
  const { gl, scene, setDpr } = useThree()

  // Densidade de pixels: a da tela, até o máximo da qualidade.
  useEffect(() => {
    const { VEGETATION_QUALITY } = GAME_CONFIG
    const { maxDpr } = VEGETATION_QUALITY[VEGETATION_QUALITY.CURRENT]
    setDpr(Math.min(window.devicePixelRatio || 1, maxDpr))
  }, [setDpr, revision])

  useEffect(() => {
    const toneMapping =
      TONE_MAPPINGS[GAME_CONFIG.RENDER.TONE_MAPPING] ?? TONE_MAPPINGS.aces
    if (gl.toneMapping === toneMapping) return
    gl.toneMapping = toneMapping
    scene.traverse((object) => {
      const materials = [object.material, object.customDepthMaterial].flat()
      for (const material of materials) {
        if (material) material.needsUpdate = true
      }
    })
  }, [gl, scene, revision])

  return GAME_CONFIG.RENDER.SMAA ? <SmaaComposer /> : null
}
