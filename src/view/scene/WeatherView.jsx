'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { createRng } from '@/core/rng'
import { lightingAt } from '@/core/time/dayCycle'
import { LocalWeather, WorldClock } from '@/core/traits'
import { world } from '@/core/world/world'
import { flashLevel } from '@/view/systems/lightningSystem'
import { resolveSkyLook } from '@/view/weather/skyLook'

// Cor das gotas e dos flocos (antes da luz da hora). Já é a da tela
// (sRGB): o shader escreve como está.
const RAIN_COLOR = new THREE.Color().setStyle('#c8d6e8', THREE.NoColorSpace)
const SNOW_COLOR = new THREE.Color().setStyle('#ffffff', THREE.NoColorSpace)
// Transparência das gotas e dos flocos na força cheia.
const RAIN_OPACITY = 0.45
const SNOW_OPACITY = 0.9
// Tamanho (px a um metro da câmera) de um floco.
const SNOW_SIZE = 90
// Luz mínima das partículas à noite (fração da do dia).
const MIN_BRIGHTNESS = 0.25
// Gira o balanço da neve sem o número crescer para sempre.
const SWAY_WRAP = Math.PI * 2 * 1000

// Posição presa ao MUNDO, repetida numa caixa em volta da câmera: a mesma
// gota está sempre no mesmo lugar do mundo, e a caixa só escolhe qual
// "cópia" aparece — andar não arrasta a chuva junto.
const wrapGlsl = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uArea;
  uniform float uHeight;
  uniform float uFall;
  uniform vec2 uDrift;
  attribute vec3 aSeed;

  vec3 wrappedPosition() {
    vec3 base = aSeed * vec3(uArea, uHeight, uArea);
    vec2 corner = uCenter.xz - uArea * 0.5;
    vec2 xz = corner + mod(base.xz + uDrift - corner, uArea);
    float y = uCenter.y - uHeight * 0.5 + mod(base.y - uFall, uHeight);
    return vec3(xz.x, y, xz.y);
  }
`

const rainVertexShader = /* glsl */ `
  ${wrapGlsl}
  uniform vec2 uWind;
  uniform float uLength;
  attribute float aEnd;
  void main() {
    vec3 fall = normalize(vec3(uWind.x, -1.0, uWind.y));
    vec3 drop = wrappedPosition() + fall * uLength * aEnd;
    gl_Position = projectionMatrix * viewMatrix * vec4(drop, 1.0);
  }
`

const snowVertexShader = /* glsl */ `
  ${wrapGlsl}
  uniform float uSway;
  uniform float uSwayTime;
  uniform float uSize;
  void main() {
    vec3 flake = wrappedPosition();
    float phase = uSwayTime + aSeed.y * 40.0;
    flake.x += sin(phase) * uSway;
    flake.z += cos(phase * 0.8) * uSway;
    vec4 viewPosition = viewMatrix * vec4(flake, 1.0);
    gl_PointSize = uSize / max(-viewPosition.z, 0.1);
    gl_Position = projectionMatrix * viewPosition;
  }
`

const rainFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
  }
`

const snowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float fromCenter = length(gl_PointCoord - 0.5);
    if (fromCenter > 0.5) discard;
    gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.5, 0.2, fromCenter));
  }
`

// Sementes das partículas: sorteio fixo e só de aparência (`rng`).
function seeds(count, verticesEach, rng) {
  const values = new Float32Array(count * verticesEach * 3)
  for (let i = 0; i < count; i++) {
    const seed = [rng(), rng(), rng()]
    for (let v = 0; v < verticesEach; v++) {
      values.set(seed, (i * verticesEach + v) * 3)
    }
  }
  return values
}

function sharedUniforms() {
  const { PARTICLE_AREA, PARTICLE_HEIGHT } = GAME_CONFIG.WEATHER
  return {
    uCenter: { value: new THREE.Vector3() },
    uArea: { value: PARTICLE_AREA },
    uHeight: { value: PARTICLE_HEIGHT },
    uFall: { value: 0 },
    uDrift: { value: new THREE.Vector2() },
    uColor: { value: new THREE.Color() },
    uOpacity: { value: 0 },
  }
}

function createRain() {
  const { RAIN_DROPS, RAIN_LENGTH } = GAME_CONFIG.WEATHER
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'aSeed',
    new THREE.BufferAttribute(seeds(RAIN_DROPS, 2, createRng(1)), 3),
  )
  const ends = new Float32Array(RAIN_DROPS * 2)
  for (let i = 0; i < RAIN_DROPS; i++) ends[i * 2 + 1] = 1
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
  // Sem `position`, o Three não sabe quantos vértices desenhar.
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(RAIN_DROPS * 2 * 3), 3),
  )
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms(),
      uWind: { value: new THREE.Vector2() },
      uLength: { value: RAIN_LENGTH },
    },
    vertexShader: rainVertexShader,
    fragmentShader: rainFragmentShader,
    transparent: true,
    depthWrite: false,
  })
  return { geometry, material }
}

function createSnow() {
  const { SNOW_FLAKES, SNOW_SWAY } = GAME_CONFIG.WEATHER
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'aSeed',
    new THREE.BufferAttribute(seeds(SNOW_FLAKES, 1, createRng(2)), 3),
  )
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(SNOW_FLAKES * 3), 3),
  )
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms(),
      uSway: { value: SNOW_SWAY },
      uSwayTime: { value: 0 },
      uSize: { value: SNOW_SIZE },
    },
    vertexShader: snowVertexShader,
    fragmentShader: snowFragmentShader,
    transparent: true,
    depthWrite: false,
  })
  return { geometry, material }
}

/**
 * Chuva e neve (docs/features/048-dia-noite-e-clima.md): partículas numa
 * caixa em volta da câmera, presas ao mundo. A quantidade segue a força do
 * clima (`LocalWeather`): a chuva com a chuva e a tempestade (que inclina as
 * gotas com o vento), a neve com a neve. A cor segue a luz da hora (à
 * noite, escurece) e o clarão do relâmpago.
 *
 * Tudo no shader: a CPU só passa o quanto já caiu e o centro. `useFrame`
 * aqui é a exceção das regras (3.4): componente só visual, que só LÊ o
 * ECS.
 */
export function WeatherView() {
  const rain = useMemo(createRain, [])
  const snow = useMemo(createSnow, [])
  const rainRef = useRef(null)
  const snowRef = useRef(null)

  useEffect(
    () => () => {
      for (const { geometry, material } of [rain, snow]) {
        geometry.dispose()
        material.dispose()
      }
    },
    [rain, snow],
  )

  useFrame(({ camera }, delta) => {
    const {
      RAIN_DROPS,
      SNOW_FLAKES,
      RAIN_SPEED,
      SNOW_SPEED,
      STORM_WIND,
      PARTICLE_AREA,
      PARTICLE_HEIGHT,
    } = GAME_CONFIG.WEATHER
    const weather = world.get(LocalWeather)
    const clock = world.get(WorldClock)
    if (!weather || !clock) return

    const look = resolveSkyLook(lightingAt(clock.time), weather, flashLevel())
    const dayAmbient = Math.max(
      ...GAME_CONFIG.DAY_CYCLE.KEYFRAMES.map((k) => k.ambientIntensity),
    )
    const brightness = Math.min(
      1,
      Math.max(MIN_BRIGHTNESS, look.ambientIntensity / dayAmbient),
    )

    const wet = Math.min(1, weather.rain + weather.storm)
    const windShare = wet > 0 ? weather.storm / wet : 0
    const rainUniforms = rain.material.uniforms
    rainUniforms.uCenter.value.copy(camera.position)
    rainUniforms.uFall.value =
      (rainUniforms.uFall.value + delta * RAIN_SPEED) % PARTICLE_HEIGHT
    const wind = STORM_WIND * windShare
    rainUniforms.uWind.value.set(wind, wind * 0.4)
    rainUniforms.uDrift.value.set(
      (rainUniforms.uDrift.value.x + delta * RAIN_SPEED * wind) % PARTICLE_AREA,
      (rainUniforms.uDrift.value.y + delta * RAIN_SPEED * wind * 0.4) %
        PARTICLE_AREA,
    )
    rainUniforms.uColor.value.copy(RAIN_COLOR).multiplyScalar(brightness)
    rainUniforms.uOpacity.value = RAIN_OPACITY
    const drops = Math.floor(RAIN_DROPS * wet)
    rain.geometry.setDrawRange(0, drops * 2)
    if (rainRef.current) rainRef.current.visible = drops > 0

    const snowUniforms = snow.material.uniforms
    snowUniforms.uCenter.value.copy(camera.position)
    snowUniforms.uFall.value =
      (snowUniforms.uFall.value + delta * SNOW_SPEED) % PARTICLE_HEIGHT
    snowUniforms.uSwayTime.value =
      (snowUniforms.uSwayTime.value + delta) % SWAY_WRAP
    snowUniforms.uColor.value.copy(SNOW_COLOR).multiplyScalar(brightness)
    snowUniforms.uOpacity.value = SNOW_OPACITY
    const flakes = Math.floor(SNOW_FLAKES * weather.snow)
    snow.geometry.setDrawRange(0, flakes)
    if (snowRef.current) snowRef.current.visible = flakes > 0
  })

  return (
    <>
      <lineSegments
        ref={rainRef}
        geometry={rain.geometry}
        material={rain.material}
        frustumCulled={false}
        visible={false}
      />
      <points
        ref={snowRef}
        geometry={snow.geometry}
        material={snow.material}
        frustumCulled={false}
        visible={false}
      />
    </>
  )
}
