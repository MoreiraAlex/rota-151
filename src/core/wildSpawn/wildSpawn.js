import { GAME_CONFIG } from '../gameConfig'
import { loadedFogRange } from '../terrain/fogRange'
import { waterDepthAt } from '../terrain/water'

/**
 * Spawn e despawn das selvagens (docs/features/062-spawn-estilo-
 * cobblemon.md) — as regras puras, sem world. Quem cria e destrói as
 * entidades são as actions de `core/actions/wildSpawn.js`; quem decide
 * quando, o `wildSpawnSystem` e o `wildDespawnSystem`.
 *
 * - **Quem nasce**: como no Cobblemon, cada tentativa sorteia primeiro a
 *   faixa de raridade (chance fixa de cada uma) e depois, entre as espécies
 *   dessa faixa cujo bioma casa com o do ponto (por id ou por tag), uma
 *   pelo peso — o multiplicador da fase do dia vezes o do clima. Faixa sem
 *   ninguém ali = a tentativa não nasce nada: a raridade vale em qualquer
 *   lugar, mesmo onde só uma espécie rara pode nascer. Bioma escondido
 *   (`BIOMES.HIDDEN`) e cidade nunca recebem ninguém.
 * - **Onde**: num anel em volta de quem a câmera segue — ou, andando, parte
 *   das vezes na frente, logo além da névoa —, longe de todos os pontos do
 *   jogador (treinador e criatura controlada), fora da vista, em terra
 *   firme carregada, sem encosta íngreme nem sólido em cima.
 * - **Quando some**: pela distância até o jogador, em três faixas — perto
 *   nunca, longe sempre, e no meio só quem está velho e fora da vista, com
 *   a chance crescendo com a idade.
 */

/** @typedef {{ x: number, z: number }} Point */
/** @typedef {{ x: number, z: number, yaw: number }} View */

const horizontalDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

/** A menor distância (m) de `point` até um dos `viewers`. */
export function nearestDistance(point, viewers) {
  let best = Infinity
  for (const viewer of viewers) {
    best = Math.min(best, horizontalDistance(point, viewer))
  }
  return best
}

// O bioma recebe selvagens na beta? Os escondidos e a cidade, não.
function isSpawnableBiome(biome, params) {
  if (!biome || biome.town) return false
  return !params.HIDDEN_BIOMES.includes(biome.id)
}

function matchesBiome(spawn, biome) {
  if (spawn.biomes?.includes(biome.id)) return true
  return Boolean(spawn.tags?.some((tag) => biome.tags?.includes(tag)))
}

/**
 * Peso da `species`, dentro da faixa dela, num ponto de bioma `biome`, na
 * fase do dia `phase` e no clima `weather`. Zero = não nasce ali agora.
 */
export function spawnWeightOf(
  species,
  { biome, phase, weather },
  params = spawnParams(),
) {
  const spawn = species?.spawn
  if (!spawn || !isSpawnableBiome(biome, params)) return 0
  if (!matchesBiome(spawn, biome)) return 0
  if (!(spawn.rarity in params.RARITY_CHANCES)) return 0
  const phaseFactor = spawn.phases?.[phase] ?? 1
  const weatherFactor = spawn.weather?.[weather] ?? 1
  return phaseFactor * weatherFactor
}

/**
 * As espécies de `speciesList` que podem nascer ali agora, com a faixa e o
 * peso.
 */
export function listSpawnCandidates(speciesList, context, params) {
  const candidates = []
  for (const species of speciesList) {
    const weight = spawnWeightOf(species, context, params)
    if (weight > 0) {
      candidates.push({
        speciesId: species.id,
        rarity: species.spawn.rarity,
        weight,
      })
    }
  }
  return candidates
}

/** Uma faixa de raridade, sorteada pela chance fixa de cada uma. */
export function rollRarity(rng, params = spawnParams()) {
  const entries = Object.entries(params.RARITY_CHANCES)
  const total = entries.reduce((sum, [, chance]) => sum + chance, 0)
  let roll = rng() * total
  for (const [rarity, chance] of entries) {
    roll -= chance
    if (roll < 0) return rarity
  }
  return entries[entries.length - 1][0]
}

/** Um dos `items` (`{ weight }`), sorteado pelo peso; sem nenhum, `null`. */
function pickByWeight(rng, items) {
  const total = items.reduce((sum, { weight }) => sum + weight, 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/**
 * A espécie da tentativa: sorteia a faixa (`rollRarity`) e, entre os
 * `candidates` dela, uma pelo peso. Faixa sem candidato = `null` (não
 * nasce nada).
 */
export function pickSpawnSpecies(rng, candidates, params = spawnParams()) {
  const rarity = rollRarity(rng, params)
  const pool = candidates.filter((candidate) => candidate.rarity === rarity)
  return pickByWeight(rng, pool)?.speciesId ?? null
}

/**
 * `point` está fora da vista de `view` (de onde a câmera olha, com o `yaw`
 * da órbita)? Fora do cone ou além da distância de visão. Sem `view`, tudo
 * está fora.
 */
export function isOutOfView(point, view, params = spawnParams()) {
  if (!view) return true
  const dx = point.x - view.x
  const dz = point.z - view.z
  const distance = Math.hypot(dx, dz)
  if (distance >= params.VIEW_DISTANCE) return true
  if (distance === 0) return false
  // Para onde a câmera olha no plano (`computeOrbitForward`).
  const forwardX = -Math.sin(view.yaw)
  const forwardZ = -Math.cos(view.yaw)
  const cos = (dx * forwardX + dz * forwardZ) / distance
  return cos < Math.cos(params.VIEW_HALF_ANGLE)
}

// Inclinação (altura por metro) do chão em volta de `(x, z)`.
function slopeAround(heightAt, x, z) {
  const dx = (heightAt(x + 1, z) - heightAt(x - 1, z)) / 2
  const dz = (heightAt(x, z + 1) - heightAt(x, z - 1)) / 2
  return Math.hypot(dx, dz)
}

function touchesSolid(ground, x, z, clearance) {
  const reach = clearance
  const footprints = ground.footprintsIn(
    x - reach,
    x + reach,
    z - reach,
    z + reach,
  )
  return footprints.some(
    (circle) =>
      Math.hypot(circle.x - x, circle.z - z) < circle.radius + clearance,
  )
}

/**
 * O ponto `(x, z)` serve para nascer: chunk carregado, terra seca, chão
 * pouco inclinado e longe dos sólidos. `ground` é o relevo do nível
 * (`heightAt`, `isLoadedAt`, `footprintsIn`).
 */
export function isSpawnableGround(ground, x, z, params = spawnParams()) {
  if (!ground.isLoadedAt(x, z)) return false
  if (waterDepthAt(ground.heightAt, x, z, params.WATER_LEVEL) > 0) return false
  if (slopeAround(ground.heightAt, x, z) > params.MAX_SLOPE) return false
  return !touchesSolid(ground, x, z, params.SOLID_CLEARANCE)
}

// Ângulo e raio de uma tentativa: com `heading` (andando), parte delas vai
// para a frente, logo além da névoa; o resto, no anel em volta.
function rollPlacement(rng, heading, params) {
  if (heading && rng() < params.AHEAD_CHANCE) {
    const spread = (rng() * 2 - 1) * params.AHEAD_HALF_ANGLE
    return {
      angle: Math.atan2(heading.x, heading.z) + spread,
      radius: params.VIEW_DISTANCE + rng() * params.AHEAD_DEPTH,
    }
  }
  return {
    angle: rng() * Math.PI * 2,
    radius: params.MIN_RADIUS + rng() * (params.MAX_RADIUS - params.MIN_RADIUS),
  }
}

/**
 * Um ponto para nascer em volta de `center`, longe de todos os `viewers`,
 * fora da vista de `view` e em chão bom. Andando (`heading`, a direção do
 * movimento, tamanho 1), parte das tentativas vai para a frente, logo além
 * da névoa (`AHEAD_CHANCE`); o resto, no anel. Uma tentativa só: `null` se
 * o ponto sorteado não serve.
 *
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function rollSpawnPoint(
  rng,
  { center, viewers, view, ground, heading = null },
  params = spawnParams(),
) {
  const { angle, radius } = rollPlacement(rng, heading, params)
  const point = {
    x: center.x + Math.sin(angle) * radius,
    z: center.z + Math.cos(angle) * radius,
  }
  if (nearestDistance(point, viewers) < params.MIN_RADIUS) return null
  if (!isOutOfView(point, view, params)) return null
  if (!isSpawnableGround(ground, point.x, point.z, params)) return null
  return { x: point.x, y: ground.heightAt(point.x, point.z), z: point.z }
}

/** Faixa do despawn pela distância até o jogador. */
export function despawnBand(distance, params = spawnParams()) {
  if (distance <= params.NEAR_RADIUS) return 'near'
  if (distance > params.FAR_RADIUS) return 'far'
  return 'mid'
}

/**
 * Chance (0–1) de quem está na faixa do meio sumir numa verificação, pela
 * idade: nada antes da mínima, certeza na máxima, e reta entre as duas.
 */
export function despawnChanceByAge(age, params = spawnParams()) {
  if (age < params.MIN_AGE) return 0
  if (age >= params.MAX_AGE) return 1
  return (age - params.MIN_AGE) / (params.MAX_AGE - params.MIN_AGE)
}

/**
 * Por que a selvagem some agora (`'far'` ou `'aged'`), ou `null` se fica.
 * `roll` (0–1) é o sorteio da faixa do meio. Protegida (captura em
 * andamento) nunca some.
 */
export function despawnReason(
  { distance, age, outOfView, isProtected },
  roll,
  params = spawnParams(),
) {
  if (isProtected) return null
  const band = despawnBand(distance, params)
  if (band === 'far') return 'far'
  if (band === 'near' || !outOfView) return null
  return roll < despawnChanceByAge(age, params) ? 'aged' : null
}

/**
 * Os parâmetros do spawn: `GAME_CONFIG.WILD_SPAWN` + o que vem de fora dele
 * — a distância de visão é onde a névoa da tela fecha
 * (`loadedFogRange`), medida de quem a câmera segue: a câmera fica atrás
 * dele, então dali para lá já está tudo escondido.
 */
export function spawnParams() {
  return {
    ...GAME_CONFIG.WILD_SPAWN,
    VIEW_DISTANCE: loadedFogRange(GAME_CONFIG.TERRAIN.CHUNK_SIZE).far,
    HIDDEN_BIOMES: GAME_CONFIG.BIOMES.HIDDEN,
    WATER_LEVEL: GAME_CONFIG.TERRAIN.WATER_LEVEL,
  }
}
