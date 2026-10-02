import { resolveCreatureAttack } from '../../battle/creatureAttack'
import { IMPACT_TYPES, resolveAttackImpactType } from '../impactTypes'

/**
 * Sons de ataque agrupados por "estilo", mesmo princípio de
 * `dashSound.js`/`jumpSound.js`/`footstepGroups.js` — vários ataques
 * compartilham o mesmo som (e as mesmas configs de volume/alcance) sem
 * repetir dado. `clips` é um array de variações (toca uma ao acaso a cada
 * impacto, ver `view/systems/attackAudioSystem.js`).
 *
 * Toca no instante do IMPACTO (`effectAt`, ver `AttackPulse` em
 * `core/traits/components/attackEffect.js`), não no início do gesto —
 * mesmo instante em que o VFX (`AttackEffect`) aparece.
 *
 * Arquivos em `public/assets/audio/attack/<grupo>/attack-0N.<ext>` (mesma
 * convenção de `public/assets/audio/dash/<grupo>/`,
 * `public/assets/audio/jump/<grupo>/`).
 */
export const ATTACK_SOUND_GROUPS = {
  punch: {
    volume: 0.18,
    refDistance: 2,
    clips: [
      '/assets/audio/attack/punch/attack-01.wav',
      '/assets/audio/attack/punch/attack-02.wav',
    ],
  },
  tackle: {
    volume: 0.18,
    refDistance: 2,
    clips: [
      '/assets/audio/attack/tackle/attack-01.wav',
      '/assets/audio/attack/tackle/attack-02.wav',
    ],
  },
  // Atributo SUBIU em quem usou o golpe (Growth) — o `status.up.actor` do
  // Cobblemon (`sounds/status/stat_up_actor.ogg`), que o `statup_actor` toca
  // ao nascer.
  statup: {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/statup/attack-01.ogg'],
  },
  // Tail Whip — o `move.tailwhip.actor` do Cobblemon (`sounds/move/tailwhip/
  // tailwhip_actor.ogg`, volume 0.8 lá); só tem o som de quem usa.
  'tail-whip': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/tail-whip/attack-01.ogg'],
  },
  // CARGA de absorver energia (`audio.chargeGroup` — toca em loop enquanto o
  // golpe carrega, ver `resolveAttackChargeSounds`): o `gigadrain_actor` do
  // Cobblemon (`sounds/move/gigadrain/`, 1.8 s).
  'absorb-charge': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/absorb-charge/attack-01.ogg'],
  },
}

// Impacto genérico por TIPO (`audio.group: 'impact'` — ver
// `resolveAttackSound`): 8 variações por tipo, do pacote de sons do Cobblemon
// (`move/impact_generic`). Mesmo critério dele: o tipo `normal` não tem
// sons próprios e usa os do `fighting`. Arquivos em
// `public/assets/audio/attack/impact-<tipo>/attack-0N.ogg`.
// `volume`/`refDistance` de PARTIDA (mesmos dos outros grupos) — os arquivos
// têm loudness própria; ajustar de ouvido.
const IMPACT_VARIATIONS = 8
const IMPACT_SOUND_FOLDER = { normal: 'fighting' }

function buildImpactGroup(type) {
  const folder = IMPACT_SOUND_FOLDER[type] ?? type
  return {
    volume: 0.18,
    refDistance: 2,
    clips: Array.from(
      { length: IMPACT_VARIATIONS },
      (_, i) => `/assets/audio/attack/impact-${folder}/attack-0${i + 1}.ogg`,
    ),
  }
}

for (const type of IMPACT_TYPES) {
  ATTACK_SOUND_GROUPS[`impact-${type}`] = buildImpactGroup(type)
}

// Sons do ATACANTE (`_actor`, quando o golpe sai) e do ALVO (`_target`, no
// impacto) dos golpes de fogo — pacote de sons do Cobblemon
// (`move/<golpe>/<golpe>_actor.ogg`). Cada golpe tem os seus: não existe um
// som genérico de fogo. Arquivos em
// `public/assets/audio/attack/<golpe>-<actor|target>/attack-01.ogg`.
for (const move of [
  'ember',
  'flamethrower',
  'smokescreen',
  'leech-seed',
  'water-gun',
]) {
  for (const part of ['actor', 'target']) {
    ATTACK_SOUND_GROUPS[`${move}-${part}`] = {
      volume: 0.18,
      refDistance: 2,
      clips: [`/assets/audio/attack/${move}-${part}/attack-01.ogg`],
    }
  }
}

/**
 * Grupos COMPOSTOS: um golpe com VÁRIOS sons, cada um com o seu atraso
 * (segundos depois do `effectAt`, o instante em que o visual nasce e o dano
 * acontece). Hoje o som do atacante e o do alvo tocam JUNTOS (`delay: 0`): o
 * golpe é instantâneo — o impacto acontece no `effectAt`, então o som do alvo
 * também (no Cobblemon o do alvo espera 0.5 s no Brasa e 0.9 s no
 * Lança-chamas, o tempo do fogo viajar; aqui o fogo não viaja, ver
 * `view/vfx/emberVfx.js`). O mecanismo de atraso continua aí pra um efeito
 * que precise. Usado como `audio.group: 'ember'` na skill. Cada parte é um
 * grupo de `ATTACK_SOUND_GROUPS`.
 */
export const ATTACK_SOUND_COMPOSITES = {
  ember: [
    { group: 'ember-actor', delay: 0 },
    { group: 'ember-target', delay: 0 },
  ],
  flamethrower: [
    { group: 'flamethrower-actor', delay: 0 },
    { group: 'flamethrower-target', delay: 0 },
  ],
  smokescreen: [
    { group: 'smokescreen-actor', delay: 0 },
    { group: 'smokescreen-target', delay: 0 },
  ],
  // O do alvo espera a semente pousar (o voo do visual, `leechSeedVfx.js`) —
  // aqui o efeito não é dano instantâneo, a 1ª drenagem só vem depois.
  'leech-seed': [
    { group: 'leech-seed-actor', delay: 0 },
    { group: 'leech-seed-target', delay: 0.35 },
  ],
  // O do alvo junto do jato: o golpe é instantâneo (no Cobblemon, 0.3 s depois).
  'water-gun': [
    { group: 'water-gun-actor', delay: 0 },
    { group: 'water-gun-target', delay: 0 },
  ],
}

export function getAttackSoundGroup(id, groups = ATTACK_SOUND_GROUPS) {
  return groups[id] ?? null
}

/** Slots de ataque que podem ter som: o básico (mouse) e as 3 habilidades (Q/E/R). */
export const ATTACK_AUDIO_SLOTS = [
  'primary',
  'secondary1',
  'secondary2',
  'secondary3',
]

function toPart(spec, delay) {
  return { ...spec, delay: delay ?? spec.delay ?? 0 }
}

/**
 * Resolve o(s) som(ns) do ataque de UM slot da espécie, como uma lista de
 * PARTES `{ clips, volume?, refDistance?, delay }` — `delay` em segundos
 * depois do impacto (`effectAt`); `0` toca na hora. `null` se o slot não
 * tem som. O som vive DENTRO da definição de ataque resolvida (`audio`, ver
 * `core/data/skills/index.js`):
 *
 * - `audio.clips` (som PRÓPRIO deste ataque) vence se declarado;
 * - `audio.group: 'impact'` → o som do TIPO do golpe (`impact-<tipo>`, o
 *   mesmo tipo do visual — `resolveAttackImpactType`);
 * - `audio.group` de um grupo COMPOSTO (`ATTACK_SOUND_COMPOSITES`, ex.:
 *   `'ember'`) → uma parte por som, cada uma com o seu atraso;
 * - `audio.group` de um grupo simples (`ATTACK_SOUND_GROUPS`) → uma parte;
 * - sem nenhum dos dois, ou slot sem ataque configurado, `null` — mesmo
 *   fallback gracioso de sempre.
 */
export function resolveAttackSound(species, slot = 'primary') {
  const attack = resolveCreatureAttack(species, slot)
  const audio = attack?.audio
  if (!audio) return null
  if (audio.clips) return [toPart(audio)]
  if (!audio.group) return null

  if (audio.group === 'impact') {
    const group = getAttackSoundGroup(
      `impact-${resolveAttackImpactType(attack)}`,
    )
    return group ? [toPart(group)] : null
  }

  const composite = ATTACK_SOUND_COMPOSITES[audio.group]
  if (composite) {
    const parts = composite
      .map(({ group, delay }) => {
        const spec = getAttackSoundGroup(group)
        return spec ? toPart(spec, delay) : null
      })
      .filter(Boolean)
    return parts.length > 0 ? parts : null
  }

  const group = getAttackSoundGroup(audio.group)
  return group ? [toPart(group)] : null
}

/** Os sons de TODOS os slots da espécie que têm som: `{ [slot]: partes }`. */
export function resolveAttackSounds(species) {
  const sounds = {}
  for (const slot of ATTACK_AUDIO_SLOTS) {
    const parts = resolveAttackSound(species, slot)
    if (parts) sounds[slot] = parts
  }
  return sounds
}

/**
 * Sons em LOOP do ataque de cada slot (um grupo simples de
 * `ATTACK_SOUND_GROUPS`): `{ [slot]: { clips, volume?, refDistance?, phase } }`.
 * `phase` diz QUANDO toca:
 *
 * - `'charge'` (`audio.chargeGroup`, ex.: o Growth): do disparo até o
 *   `effectAt` (enquanto `isAttackCharging`) — para no efeito ou numa
 *   interrupção.
 * - `'action'` (`audio.actionGroup`, ex.: o Tail Whip): do `effectAt` até a
 *   ação ACABAR (fim da `duration`) — cortado no fim se for mais longo,
 *   repetido se for mais curto.
 *
 * Um slot tem no máximo um; com os dois configurados, vale o de carga. Quem
 * toca é `view/systems/attackAudioSystem.js`.
 */
export function resolveAttackLoopSounds(species) {
  const sounds = {}
  for (const slot of ATTACK_AUDIO_SLOTS) {
    const audio = resolveCreatureAttack(species, slot)?.audio
    const phase = audio?.chargeGroup ? 'charge' : 'action'
    const group = audio?.chargeGroup ?? audio?.actionGroup
    const spec = group ? getAttackSoundGroup(group) : null
    if (spec) sounds[slot] = { ...spec, phase }
  }
  return sounds
}
