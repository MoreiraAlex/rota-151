/**
 * Motor de partícula de chama — extraído de `tools/fireDemo/Campfire.jsx`
 * (spike de VFX) no momento em que um SEGUNDO consumidor de verdade
 * precisou da mesma mecânica: `view/hooks/useAnimatedModel.js` (fogo de
 * cauda do Charmander, ver docs/features/022-fogo-de-cauda-do-charmander.md)
 * — mesmo raciocínio já usado nesta sessão pra `createSimpleAudioRegistry.js`
 * (generaliza no 2º consumidor real, não antes). `Campfire.jsx` agora chama
 * `createFlame` daqui em vez de duplicar a lógica.
 *
 * Fica em `view/` (não em `tools/`) — direção de dependência do projeto é
 * `tools/` → `view/`/`core/`, nunca o contrário (ver `GameScene.jsx`).
 *
 * Estado de cada partícula é um objeto JS simples num array (não React
 * state nem trait de ECS) — mutado direto em `update()`, mesmo padrão
 * imperativo já usado no motor de verdade (`useAnimatedModel.js`,
 * `footstepAudioSystem.js`): nada disso precisa re-renderizar componente
 * nenhum, só mexer em `position`/`scale`/`material` do `THREE.Sprite` já
 * existente.
 *
 * Não decide POSIÇÃO/ESCALA GERAL/VELOCIDADE — isso fica por conta de quem
 * chama (`Campfire.jsx` embrulha o grupo num `<group scale={scale}>` e
 * multiplica `delta` por `speed` antes de chamar `update`; o fogo de cauda
 * encaixa o grupo num osso via `bone.add()` e corrige escala lendo o rig,
 * ver `view/systems/tailFireSystem.js`) — este módulo só sabe da FORMA/COR/
 * QUANTIDADE/OPACIDADE da chama em si.
 */
import * as THREE from 'three'

export const PALETTES = {
  fire: {
    sten: { start: '#ffcf5c', end: '#c23616' },
    core: { start: '#ffffff', end: '#ff9d2e' },
    embers: { start: '#ffdd88', end: '#7a1f0d' },
  },
  greenFlame: {
    sten: { start: '#c6ff5c', end: '#1c6b1f' },
    core: { start: '#ffffff', end: '#8aff5c' },
    embers: { start: '#d4ffb0', end: '#1f4d1a' },
  },
  blueFlame: {
    sten: { start: '#7fd6ff', end: '#1447a8' },
    core: { start: '#ffffff', end: '#4fa8ff' },
    embers: { start: '#bfe9ff', end: '#0d2c66' },
  },
  purpleFlame: {
    sten: { start: '#d59bff', end: '#4a1470' },
    core: { start: '#ffffff', end: '#b35cff' },
    embers: { start: '#e8c6ff', end: '#3a0d59' },
  },
}

// Multiplicador do raio (0-1) em função de `t` (fração da vida da
// partícula = fração da altura já percorrida) — é isso que dá o "formato"
// da chama, não a geometria de mesh nenhuma (tudo aqui continua sprite
// billboard). 'cone' é o formato de chama de verdade (base larga, ponta
// fina); os outros são pra outros efeitos elementais/explosões.
function shapeFactor(shape, t) {
  switch (shape) {
    case 'cone':
      return 1 - t
    case 'inverseCone':
      return t
    case 'sphere':
      return Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))
    case 'diamond':
      return 1 - Math.abs(2 * t - 1)
    case 'cylinder':
    default:
      return 1
  }
}

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

function respawnParticle(state, cfg, randomizeAge) {
  state.lifetime = randomRange(cfg.lifetime[0], cfg.lifetime[1])
  state.age = randomizeAge ? Math.random() * state.lifetime : 0
  state.baseX = randomRange(-cfg.radius, cfg.radius)
  state.baseZ = randomRange(-cfg.radius, cfg.radius)
  state.rise = randomRange(cfg.rise[0], cfg.rise[1])
  state.swayFreq = randomRange(2, 4)
  state.swayPhase = Math.random() * Math.PI * 2
  state.swayAmp = randomRange(cfg.sway[0], cfg.sway[1])
  state.maxScale = randomRange(cfg.scale[0], cfg.scale[1])
  state.maxOpacity = randomRange(cfg.opacity[0], cfg.opacity[1])
  state.sprite.position.set(state.baseX, cfg.baseY, state.baseZ)
}

function createLayer(texture, count, cfg) {
  const layer = []
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const state = { sprite: new THREE.Sprite(material) }
    respawnParticle(state, cfg, true)
    layer.push(state)
  }
  return layer
}

// Envelope triangular (0 → 1 → 0 ao longo da vida) — mesma curva pra
// escala e opacidade, cada partícula nasce pequena/fraca, pico no meio da
// vida, desaparece antes do respawn (sem "pop" visível na troca).
function envelopeAt(t) {
  return Math.sin(Math.PI * Math.min(Math.max(t, 0), 1))
}

function updateLayer(layer, cfg, delta, shape, turbulence, intensity) {
  for (const state of layer) {
    state.age += delta
    let t = state.age / state.lifetime
    if (t >= 1) {
      respawnParticle(state, cfg, false)
      t = 0
    }

    const { sprite } = state
    const radiusMul = shapeFactor(shape, t)
    sprite.position.y = cfg.baseY + t * state.rise
    const sway =
      Math.sin(state.age * state.swayFreq + state.swayPhase) * turbulence
    const swayPerp =
      Math.cos(state.age * state.swayFreq + state.swayPhase) * turbulence
    sprite.position.x = state.baseX * radiusMul + sway * state.swayAmp
    sprite.position.z = state.baseZ * radiusMul + swayPerp * state.swayAmp

    const envelope = envelopeAt(t)
    const scale = state.maxScale * envelope
    sprite.scale.set(scale, scale, 1)
    sprite.material.opacity = state.maxOpacity * envelope * intensity
    sprite.material.color.copy(cfg.colorStart).lerp(cfg.colorEnd, t)
  }
}

// `light: false` (ou `{ enabled: false }`) desliga a luz por completo —
// tudo opcional, default é uma luz quente moderada, ajustável por config.
// `castShadow` sai `false` por padrão de propósito — sombra de
// `PointLight` renderiza um cubemap (6 passes), caro repetido por
// entidade (várias criaturas com fogo ao mesmo tempo); liga só quem
// realmente quiser pagar o custo.
function buildLightConfig(light) {
  if (light === false || light?.enabled === false) return null
  const cfg = light ?? {}
  return {
    color: cfg.color ?? '#ff8a3d',
    distance: cfg.distance ?? 3,
    decay: cfg.decay ?? 2,
    baseIntensity: cfg.baseIntensity ?? 1.5,
    flickerSpeed: cfg.flickerSpeed ?? 18,
    flickerAmount: cfg.flickerAmount ?? 0.15,
    flickerNoise: cfg.flickerNoise ?? 0.1,
    position: cfg.position ?? { x: 0, y: 0.15, z: 0 },
    castShadow: cfg.castShadow ?? false,
    shadowMapSize: cfg.shadowMapSize ?? 512,
  }
}

function buildLayerConfigs({ width, height, palette }) {
  const colors = PALETTES[palette] ?? PALETTES.fire
  return {
    sten: {
      baseY: 0.1,
      radius: 0.22 * width,
      lifetime: [0.5, 0.9],
      rise: [0.9 * height, 1.4 * height],
      sway: [0.05, 0.15],
      scale: [0.5, 0.9],
      opacity: [0.5, 0.85],
      colorStart: new THREE.Color(colors.sten.start),
      colorEnd: new THREE.Color(colors.sten.end),
    },
    core: {
      baseY: 0.08,
      radius: 0.12 * width,
      lifetime: [0.35, 0.6],
      rise: [0.5 * height, 0.8 * height],
      sway: [0.03, 0.08],
      scale: [0.3, 0.55],
      opacity: [0.7, 1],
      colorStart: new THREE.Color(colors.core.start),
      colorEnd: new THREE.Color(colors.core.end),
    },
    embers: {
      baseY: 0.2,
      radius: 0.25 * width,
      lifetime: [1, 1.8],
      rise: [1.2 * height, 2.2 * height],
      sway: [0.2, 0.4],
      scale: [0.06, 0.12],
      opacity: [0.6, 1],
      colorStart: new THREE.Color(colors.embers.start),
      colorEnd: new THREE.Color(colors.embers.end),
    },
  }
}

/**
 * Monta uma chama (3 camadas — silhueta/"sten", brilho interno/"core" e
 * brasas — ver docstring do arquivo) num `THREE.Group` novo, pronto pra
 * ser adicionado em qualquer lugar da cena (posição/escala geral por conta
 * de quem chama).
 *
 * `textures`: `{ sten: THREE.Texture, core: THREE.Texture }` — já
 * carregadas por quem chama (drei `useTexture` num componente React, ou
 * `view/textures/textureCache.js#loadTexture` num `useEffect` imperativo —
 * este módulo não sabe nem precisa saber de onde vieram).
 *
 * `config` (todos os campos opcionais, default de "fogueira normal"):
 * `shape` (`'cone' | 'cylinder' | 'inverseCone' | 'sphere' | 'diamond'`,
 * perfil do raio ao longo da altura), `width`/`height` (multiplicadores de
 * raio da base / distância de subida), `density` (multiplicador de
 * quantidade de partícula por camada), `turbulence` (multiplicador do
 * balanço lateral), `palette` (`'fire' | 'greenFlame' | 'blueFlame' |
 * 'purpleFlame'`), `intensity` (multiplicador de opacidade geral — TAMBÉM
 * multiplica o brilho da luz, ver abaixo).
 *
 * `config.light` (opcional — objeto de ajuste, ou `false`/`{ enabled:
 * false }` pra desligar por completo): `THREE.PointLight` de verdade,
 * filha do MESMO `group` — acompanha a chama pra onde ela for de graça
 * (posição/escala/rotação de quem chama já afetam ela também, sem código
 * extra). Campos: `color`, `distance`, `decay` (mesmos parâmetros de
 * `THREE.PointLight`), `baseIntensity` (brilho base antes do flicker),
 * `flickerSpeed`/`flickerAmount` (frequência/amplitude da oscilação
 * senoidal) e `flickerNoise` (amplitude do tremor aleatório por cima —
 * mistura das duas dá o "tremeluzir" de fogo de verdade, não uma luz
 * estática), `position` (offset local dentro do grupo, mundo pequeno já
 * escalado como o resto da chama). `castShadow` (default `false` — sombra
 * de `PointLight` renderiza um cubemap, 6 passes, caro repetido por
 * entidade com fogo; liga só quem quiser pagar o custo) e `shadowMapSize`
 * (default 512, resolução do cubemap) — quando ligado, o plano de corte
 * distante da sombra usa o próprio `distance` da luz (não o default do
 * three, 500 — desperdiçaria quase toda a precisão do depth buffer numa
 * luz desse tamanho).
 *
 * Devolve `{ group, update(delta, overrides?), dispose() }`. `update`
 * aceita overrides pontuais de `shape`/`turbulence`/`intensity` (pra quem
 * precisar trocar isso ao vivo, tipo um slider — ver `Campfire.jsx`); sem
 * overrides, usa os valores de `config` (uso comum: `flame.update(delta)`
 * sozinho, ver `tailFireSystem.js`). O flicker da luz (se houver) avança
 * junto, mesma chamada.
 */
export function createFlame(textures, config = {}) {
  const {
    shape = 'cone',
    width = 1,
    height = 1,
    density = 1,
    turbulence = 1,
    palette = 'fire',
    intensity = 1,
  } = config

  const layerConfigs = buildLayerConfigs({ width, height, palette })
  const layers = {
    sten: createLayer(
      textures.sten,
      Math.round(22 * density),
      layerConfigs.sten,
    ),
    core: createLayer(
      textures.core,
      Math.round(14 * density),
      layerConfigs.core,
    ),
    embers: createLayer(
      textures.core,
      Math.round(8 * density),
      layerConfigs.embers,
    ),
  }

  const group = new THREE.Group()
  const allStates = [...layers.sten, ...layers.core, ...layers.embers]
  for (const state of allStates) group.add(state.sprite)

  const lightConfig = buildLightConfig(config.light)
  let light = null
  let flickerElapsed = 0
  if (lightConfig) {
    // Intensidade inicial 0 — a 1ª chamada de `update` já seta o valor de
    // verdade (com flicker); evita um flash na intensidade base "crua" no
    // frame entre criar a luz e o 1º `update`.
    light = new THREE.PointLight(
      lightConfig.color,
      0,
      lightConfig.distance,
      lightConfig.decay,
    )
    light.position.set(
      lightConfig.position.x,
      lightConfig.position.y,
      lightConfig.position.z,
    )
    if (lightConfig.castShadow) {
      light.castShadow = true
      light.shadow.mapSize.set(
        lightConfig.shadowMapSize,
        lightConfig.shadowMapSize,
      )
      // `distance` já é o alcance de verdade da luz — reusa como plano
      // de corte distante da sombra (senão o default do three, 500,
      // desperdiça quase toda a precisão do depth buffer numa luz desse
      // tamanho). `0` (sem limite) cai num far razoável (10) em vez de
      // 0, que deixaria a câmera de sombra sem profundidade nenhuma.
      light.shadow.camera.near = 0.01
      light.shadow.camera.far = lightConfig.distance || 10
    }
    group.add(light)
  }

  return {
    group,
    update(delta, overrides = {}) {
      const liveShape = overrides.shape ?? shape
      const liveTurbulence = overrides.turbulence ?? turbulence
      const liveIntensity = overrides.intensity ?? intensity
      updateLayer(
        layers.sten,
        layerConfigs.sten,
        delta,
        liveShape,
        liveTurbulence,
        liveIntensity,
      )
      updateLayer(
        layers.core,
        layerConfigs.core,
        delta,
        liveShape,
        liveTurbulence,
        liveIntensity,
      )
      updateLayer(
        layers.embers,
        layerConfigs.embers,
        delta,
        liveShape,
        liveTurbulence,
        liveIntensity,
      )

      if (light) {
        flickerElapsed += delta
        const flicker =
          0.85 +
          lightConfig.flickerAmount *
            Math.sin(flickerElapsed * lightConfig.flickerSpeed) +
          lightConfig.flickerNoise * (Math.random() - 0.5)
        light.intensity = lightConfig.baseIntensity * liveIntensity * flicker
      }
    },
    dispose() {
      for (const state of allStates) {
        group.remove(state.sprite)
        state.sprite.material.dispose()
      }
      if (light) group.remove(light)
    },
  }
}
