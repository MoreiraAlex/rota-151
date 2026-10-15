'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { lightingAt } from '@/core/time/dayCycle'
import { LocalWeather, WorldClock } from '@/core/traits'
import { world } from '@/core/world/world'
import { flashLevel } from '@/view/systems/lightningSystem'
import { resolveSkyLook } from '@/view/weather/skyLook'
import { buildBackdropLayer, mountainColor } from './backdropGeometry'

const VERTEX = /* glsl */ `
uniform float uTopHeight;
varying float vRise;
void main() {
  // Altura acima do horizonte, em fração da crista mais alta da camada.
  vRise = position.y / uTopHeight;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // No fundo da cena, logo à frente do céu: tudo o que tem profundidade
  // fica na frente.
  gl_Position = clip.xyww;
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uFogColor;
uniform vec3 uMountain;
uniform float uMist;
varying float vRise;
void main() {
  // A cor da camada (mountainColor), saindo da névoa do horizonte para
  // cima (onde encontra o chão enevoado).
  float solid = smoothstep(0.0, max(uMist, 1e-3), vRise);
  vec3 color = mix(uFogColor, uMountain, solid);
  // Sem curva de cor: a névoa dos outros materiais entra depois dela (o
  // trecho fog_fragment) — só a conversão para a tela, como a deles.
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`

/**
 * As serras do fundo (docs/features/058-ajuste-dos-biomas.md,
 * `backdropGeometry.js`): na névoa fechada, as camadas de `BACKDROP.LAYERS`
 * em volta da câmera, na cor do horizonte da hora e do clima escurecida
 * por camada (`shade`) e puxada para o tom dela (`tint`, `mountainColor`),
 * com a base na névoa (`mist`) — e a névoa toma a cor da camada da frente
 * (`fogColorOf`, no DayNightView): o mundo some direto nela. Vão com a
 * câmera, como o céu. Montadas uma vez (pela seed); a cor muda a cada
 * quadro.
 *
 * `useFrame` aqui é a exceção das regras (3.4): componente só visual.
 */
// O céu de agora (hora, clima e relâmpago), como o do DayNightView.
function currentLook() {
  const clock = world.get(WorldClock)
  const weather = world.get(LocalWeather)
  if (!clock || !weather) return null
  return resolveSkyLook(lightingAt(clock.time), weather, flashLevel())
}

export function BackdropView() {
  const groupRef = useRef(null)
  const horizon = useMemo(() => new THREE.Color(), [])
  const layers = useMemo(() => {
    const { BACKDROP, WORLD } = GAME_CONFIG
    // Da mais longe (desenhada primeiro) à mais perto.
    return BACKDROP.LAYERS.map((layer, index) => {
      const geometry = buildBackdropLayer(WORLD.SEED, index, layer, {
        radius: BACKDROP.RADIUS,
        segments: BACKDROP.SEGMENTS,
      })
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uFogColor: { value: new THREE.Color() },
          uMountain: { value: new THREE.Color() },
          uMist: { value: layer.mist },
          uTopHeight: {
            value: Math.tan((layer.maxAngle * Math.PI) / 180) * BACKDROP.RADIUS,
          },
        },
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      // Depois do céu (-1), antes de todo o resto.
      mesh.renderOrder = -1 + (index + 1) / (BACKDROP.LAYERS.length + 1)
      return mesh
    })
  }, [])

  useEffect(
    () => () => {
      for (const mesh of layers) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
    },
    [layers],
  )

  useFrame(({ camera, scene }) => {
    const group = groupRef.current
    if (!group || !scene.fog) return
    group.position.copy(camera.position)
    // A cor de cada camada pela do horizonte e pela config (o F2 mexe ao
    // vivo; a forma só ao abrir o jogo). A névoa já vem na cor da camada da
    // frente (`fogColorOf`, no DayNightView).
    const look = currentLook()
    if (!look) return
    horizon.setRGB(...look.horizon, THREE.SRGBColorSpace)
    layers.forEach((mesh, index) => {
      const layer = GAME_CONFIG.BACKDROP.LAYERS[index]
      const { uniforms } = mesh.material
      uniforms.uFogColor.value.copy(scene.fog.color)
      mountainColor(horizon, layer, uniforms.uMountain.value)
      uniforms.uMist.value = layer.mist
    })
  })

  return (
    <group ref={groupRef}>
      {layers.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  )
}
