'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GAME_CONFIG } from '@/core/gameConfig'
import {
  getRenderSettingsRevision,
  subscribeRenderSettings,
} from './renderSettings'
import {
  applyColorGrade,
  createColorGradeShader,
  isNeutralGrade,
} from './colorGrade'

const TONE_MAPPINGS = {
  aces: THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
}

/**
 * Pós-processamento: a correção de cor (`colorGrade.js`,
 * docs/features/066-revisao-dos-biomas.md) e o SMAA por cima da cena. A
 * cena é desenhada num alvo com a curva de cor e o sRGB já aplicados,
 * igual à tela — o céu (`DayNightView`) escreve cor de tela direto, e um
 * pós-processamento comum (curva aplicada no fim) mudaria a cor dele. O
 * three só aplica curva e sRGB fora da tela num alvo marcado como de XR
 * (`isXRRenderTarget`); com `HalfFloatType`, o sRGB fica no valor guardado,
 * sem conversão do hardware. A correção e o SMAA leem esse alvo e escrevem
 * na tela como está. A correção lê `RENDER.GRADE` a cada quadro e, neutra,
 * fica desligada.
 *
 * `useFrame` com prioridade: assume o desenho do quadro no lugar do R3F —
 * exceção das regras (3.4), só visual.
 */
function PostComposer({ smaa }) {
  const { gl, scene, camera, size, viewport } = useThree()

  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      // O stencil dos personagens (materials/characterStencil.js).
      stencilBuffer: true,
    })
    const result = new EffectComposer(gl, target)
    for (const buffer of [result.renderTarget1, result.renderTarget2]) {
      buffer.isXRRenderTarget = true
      buffer.texture.colorSpace = THREE.SRGBColorSpace
    }
    result.addPass(new RenderPass(scene, camera))
    const grade = new ShaderPass(createColorGradeShader())
    result.addPass(grade)
    if (smaa) result.addPass(new SMAAPass())
    return { composer: result, grade }
  }, [gl, scene, camera, smaa])

  // A densidade entra junto: a resolução do menu muda sem mudar o tamanho.
  useEffect(() => {
    composer.composer.setPixelRatio(gl.getPixelRatio())
    composer.composer.setSize(size.width, size.height)
  }, [composer, gl, size, viewport.dpr])

  useEffect(() => () => composer.composer.dispose(), [composer])

  useFrame((_, delta) => {
    const { GRADE } = GAME_CONFIG.RENDER
    composer.grade.enabled = !isNeutralGrade(GRADE)
    if (composer.grade.enabled) applyColorGrade(composer.grade.uniforms, GRADE)
    composer.composer.render(delta)
  }, 1)
  return null
}

/**
 * Curva de cor da cena (ACES ou Neutral), a correção de cor e o SMAA
 * (`GAME_CONFIG.RENDER`; o pós-processamento só monta com um dos dois, e
 * quem muda a correção ao vivo avisa por `notifyRenderSettingsChanged`).
 * A resolução do desenho 3D é do `GameCanvas` (o menu "Gráficos"); o
 * pós-processamento acompanha a densidade dele. Trocar a curva recompila
 * os materiais (ela entra no shader).
 */
export function RenderSettingsView() {
  const revision = useSyncExternalStore(
    subscribeRenderSettings,
    getRenderSettingsRevision,
    getRenderSettingsRevision,
  )
  const { gl, scene } = useThree()

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

  const { SMAA, GRADE } = GAME_CONFIG.RENDER
  return SMAA || !isNeutralGrade(GRADE) ? <PostComposer smaa={SMAA} /> : null
}
