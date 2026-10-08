'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'
import { lightingAt } from '@/core/time/dayCycle'
import {
  InputControlled,
  LocalWeather,
  Position,
  WorldClock,
} from '@/core/traits'
import { world } from '@/core/world/world'
import { flashLevel } from '@/view/systems/lightningSystem'
import { resolveSkyLook } from '@/view/weather/skyLook'

// Raio (m) da esfera do céu — dentro do alcance da câmera; o shader joga o
// céu para o fundo de qualquer jeito.
const SKY_RADIUS = 900
// Densidade da grade de estrelas no céu (células por radiano, mais ou
// menos): maior = estrelas menores e mais juntas.
const STAR_GRID = 380
// Fração das células com estrela.
const STAR_CHANCE = 0.0025
// Escala das nuvens no shader com `CLOUDS.SIZE` = 1.
const CLOUD_BASE_SCALE = 1.6
// Quanto andou das nuvens antes de voltar a zero (o número não cresce
// para sempre; o salto fica longe demais para alguém ver).
const CLOUD_OFFSET_WRAP = 10000

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // No fundo da cena: tudo o que tem profundidade fica na frente.
    gl_Position = clip.xyww;
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform float uSunSize;
  uniform float uMoonSize;
  uniform float uStars;
  uniform float uCelestial;
  uniform vec2 uCloudOffset;
  uniform float uCloudScale;
  uniform float uCloudCover;
  uniform float uCloudSoftness;
  uniform float uCloudOpacity;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(vec3(cell, 0.0));
    float b = hash(vec3(cell + vec2(1.0, 0.0), 0.0));
    float c = hash(vec3(cell + vec2(0.0, 1.0), 0.0));
    float d = hash(vec3(cell + vec2(1.0, 1.0), 0.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      sum += noise(p) * amplitude;
      p = p * 2.03 + vec2(17.1, 9.3);
      amplitude *= 0.5;
    }
    return sum / 0.96875;
  }

  float disc(vec3 direction, vec3 center, float size) {
    float closeness = dot(direction, center);
    return smoothstep(cos(size), cos(size * 0.85), closeness);
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float height = direction.y;
    vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.45, height));
    float aboveHorizon = smoothstep(-0.01, 0.02, height);

    if (uStars > 0.0) {
      float star = step(1.0 - ${STAR_CHANCE}, hash(floor(direction * ${STAR_GRID}.0)));
      color += vec3(star) * uStars * smoothstep(0.02, 0.25, height);
    }

    float sunGlow = pow(max(dot(direction, uSunDirection), 0.0), 48.0) * 0.4;
    color += uSunColor * (disc(direction, uSunDirection, uSunSize) + sunGlow)
      * uCelestial * aboveHorizon;
    color = mix(color, uMoonColor,
      disc(direction, uMoonDirection, uMoonSize) * uCelestial * aboveHorizon);

    // Nuvens: ruído projetado num teto plano (perto do horizonte elas
    // ficam pequenas e somem), por cima do sol, da lua e das estrelas.
    if (height > 0.0 && uCloudCover > 0.0) {
      vec2 uv = direction.xz / (height + 0.12) * uCloudScale + uCloudOffset;
      float shape = fbm(uv);
      float edge = 1.0 - uCloudCover;
      float density = smoothstep(edge, edge + uCloudSoftness, shape);
      vec3 cloud = mix(uCloudShade, uCloudLit,
        smoothstep(edge, 1.0, fbm(uv + vec2(0.08, 0.05))));
      color = mix(color, cloud,
        density * uCloudOpacity * smoothstep(0.0, 0.2, height));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

const toVector = ({ x, y, z }, out) => out.set(x, y, z)

function createSkyMaterial() {
  const { DAY_CYCLE } = GAME_CONFIG
  // As cores da config já são as da tela (sRGB): o shader as escreve como
  // estão, sem conversão.
  const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.NoColorSpace)
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDirection: { value: new THREE.Vector3() },
      uMoonDirection: { value: new THREE.Vector3() },
      uSunColor: { value: srgb(DAY_CYCLE.SUN_COLOR) },
      uMoonColor: { value: srgb(DAY_CYCLE.MOON_COLOR) },
      uSunSize: { value: DAY_CYCLE.SUN_SIZE },
      uMoonSize: { value: DAY_CYCLE.MOON_SIZE },
      uStars: { value: 0 },
      uCelestial: { value: 1 },
      uCloudOffset: { value: new THREE.Vector2() },
      uCloudScale: { value: CLOUD_BASE_SCALE },
      uCloudCover: { value: 0 },
      uCloudSoftness: { value: 0 },
      uCloudOpacity: { value: 0 },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
    },
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
}

/**
 * Dia, noite e céu (docs/features/048-dia-noite-e-clima.md): a cada frame
 * lê o relógio (`WorldClock`) e o clima (`LocalWeather`), monta a luz
 * (`lightingAt` + `resolveSkyLook`, com o clarão do relâmpago) e aplica:
 *
 * - **céu**: esfera presa à câmera, com degradê, sol, lua, estrelas e
 *   nuvens (`GAME_CONFIG.CLOUDS`, andando com o vento);
 * - **luz direta**: do sol de dia e da lua à noite; a área de sombra anda
 *   com quem está no controle (o mundo não tem borda). Só o sol faz sombra:
 *   sem ela (noite, céu fechado), o mapa de sombra nem é refeito — sem
 *   desligar `castShadow`, que recompilaria todos os materiais;
 * - **luz ambiente** e **cor da névoa** (o horizonte).
 *
 * `useFrame` aqui é a exceção das regras (3.4): componente só visual, que
 * só LÊ o ECS.
 */
export function DayNightView() {
  const { scene } = useThree()
  const skyRef = useRef(null)
  const lightRef = useRef(null)
  const ambientRef = useRef(null)
  const material = useMemo(createSkyMaterial, [])
  const geometry = useMemo(
    () => new THREE.SphereGeometry(SKY_RADIUS, 32, 16),
    [],
  )
  const target = useMemo(() => new THREE.Object3D(), [])
  const scratch = useMemo(() => new THREE.Vector3(), [])

  useEffect(
    () => () => {
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )

  // O céu é a esfera: sem fundo por trás.
  useEffect(() => {
    const previous = scene.background
    scene.background = null
    return () => {
      scene.background = previous
    }
  }, [scene])

  useFrame(({ camera }, delta) => {
    const { DAY_CYCLE, CLOUDS } = GAME_CONFIG
    const clock = world.get(WorldClock)
    const weather = world.get(LocalWeather)
    if (!clock || !weather) return
    const look = resolveSkyLook(lightingAt(clock.time), weather, flashLevel())

    const uniforms = material.uniforms
    uniforms.uTop.value.setRGB(...look.skyTop, THREE.NoColorSpace)
    uniforms.uHorizon.value.setRGB(...look.horizon, THREE.NoColorSpace)
    toVector(look.sun, uniforms.uSunDirection.value)
    toVector(look.moon, uniforms.uMoonDirection.value)
    uniforms.uStars.value = look.stars
    uniforms.uCelestial.value = look.celestial
    const drift = (delta * CLOUDS.SPEED) / CLOUDS.SIZE
    const offset = uniforms.uCloudOffset.value
    offset.set(
      (offset.x + Math.cos(CLOUDS.DIRECTION) * drift) % CLOUD_OFFSET_WRAP,
      (offset.y + Math.sin(CLOUDS.DIRECTION) * drift) % CLOUD_OFFSET_WRAP,
    )
    uniforms.uCloudScale.value = CLOUD_BASE_SCALE / CLOUDS.SIZE
    uniforms.uCloudCover.value = look.cloudCover
    uniforms.uCloudSoftness.value = CLOUDS.SOFTNESS
    uniforms.uCloudOpacity.value = CLOUDS.OPACITY
    uniforms.uCloudLit.value.setRGB(...look.cloudLit, THREE.NoColorSpace)
    uniforms.uCloudShade.value.setRGB(...look.cloudShade, THREE.NoColorSpace)
    skyRef.current?.position.copy(camera.position)

    scene.fog?.color.setRGB(...look.horizon, THREE.SRGBColorSpace)

    const ambient = ambientRef.current
    if (ambient) {
      ambient.color.setRGB(...look.ambient, THREE.SRGBColorSpace)
      ambient.intensity = look.ambientIntensity
    }

    const light = lightRef.current
    if (!light) return
    light.color.setRGB(...look.light, THREE.SRGBColorSpace)
    light.intensity = look.lightIntensity
    light.shadow.intensity = look.shadowIntensity
    light.shadow.autoUpdate = look.shadowIntensity > 0
    // Centro da sombra em quem está no controle, preso à grade de texels
    // do mapa de sombra (a sombra não tremula andando).
    const controlled = world.queryFirst(InputControlled, Position)
    const center = controlled?.get(Position) ?? camera.position
    const texel = DAY_CYCLE.SHADOW_AREA / DAY_CYCLE.SHADOW_MAP_SIZE
    target.position.set(
      Math.round(center.x / texel) * texel,
      Math.round(center.y / texel) * texel,
      Math.round(center.z / texel) * texel,
    )
    toVector(look.lightDirection, scratch)
    light.position
      .copy(target.position)
      .addScaledVector(scratch, DAY_CYCLE.SHADOW_DISTANCE)
    target.updateMatrixWorld()
  })

  const { SHADOW_AREA, SHADOW_DISTANCE, SHADOW_MAP_SIZE } =
    GAME_CONFIG.DAY_CYCLE
  const half = SHADOW_AREA / 2

  return (
    <>
      <mesh
        ref={skyRef}
        geometry={geometry}
        material={material}
        renderOrder={-1}
        frustumCulled={false}
      />
      <ambientLight ref={ambientRef} />
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        target={target}
        castShadow
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={SHADOW_DISTANCE * 2}
        shadow-bias={-0.0005}
      />
    </>
  )
}
