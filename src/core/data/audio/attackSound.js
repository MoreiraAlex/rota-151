import { resolveCreatureAttack } from '../../battle/creatureAttack'
import { resolveSkill } from '../skills'
import { listLearnset, resolveSpeciesMoveReference } from '../species/moves'
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
  // Bite — o `move.bite.target` do Cobblemon (`sounds/move/bite/`, volume 0.8
  // lá): as presas fechando, no instante da mordida (o Bite só tem o do alvo).
  'bite-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/bite-target/attack-01.ogg'],
  },
  // Bug Bite — o Cobblemon não tem o golpe: o `move.leechlife.target`
  // (`sounds/move/leechlife/`, a mordida do Leech Life, no mesmo volume do
  // Bite lá).
  'bug-bite-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/bug-bite-target/attack-01.ogg'],
  },
  // Peck — o Cobblemon não tem o golpe: o `move.aerialace.target`
  // (`sounds/move/aerialace/`, o corte do Aerial Ace batendo no alvo).
  'peck-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/peck-target/attack-01.ogg'],
  },
  // Assurance — o Cobblemon não tem o golpe: o `move.pursuit.target`
  // (`sounds/move/pursuit/`, o acerto do Pursuit, Sombrio como ele na série).
  'assurance-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/assurance-target/attack-01.ogg'],
  },
  // Leer — o `move.scaryface.actor` do Cobblemon (`sounds/move/scaryface/`),
  // que a linha do tempo do Leer de lá toca junto do brilho no olho; só o
  // começo dele (escolha do usuário), com um fade no corte.
  'leer-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/leer-actor/attack-01.ogg'],
  },
  // Wrap — o Cobblemon não tem o golpe: o `move.infestation.target`
  // (`sounds/move/infestation/`, o Infestation, que também prende), escolhido
  // de ouvido pelo usuário entre os candidatos.
  'wrap-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/wrap-target/attack-01.ogg'],
  },
  // Paralisia pegando (o Glare) — o `status.nonvolatile.paralysis.actor` do
  // Cobblemon (`sounds/status/nonvolatile/`), que lá toca quando as faíscas
  // da paralisia nascem.
  'paralysis-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/paralysis-target/attack-01.ogg'],
  },
  // Thunder Shock — o `move.thundershock.*` do Cobblemon (`sounds/move/
  // thundershock/`): o choque saindo de quem usa e acertando o alvo.
  'thunder-shock-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/thunder-shock-actor/attack-01.ogg'],
  },
  'thunder-shock-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/thunder-shock-target/attack-01.ogg'],
  },
  // Thunder Wave — o `move.thunderwave.*` do Cobblemon (`sounds/move/
  // thunderwave/`): a onda saindo e chegando no alvo.
  'thunder-wave-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/thunder-wave-actor/attack-01.ogg'],
  },
  'thunder-wave-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/thunder-wave-target/attack-01.ogg'],
  },
  // Double Team — o `move.doubleteam.actor` do Cobblemon (`sounds/move/
  // doubleteam/`).
  'double-team-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/double-team-actor/attack-01.ogg'],
  },
  // Electro Ball — o Cobblemon não tem o golpe: a bola saindo é a do Shadow
  // Ball (`sounds/move/shadowball/`) e o acerto, o do Thunderbolt
  // (`sounds/move/thunderbolt/`).
  'electro-ball-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/electro-ball-actor/attack-01.ogg'],
  },
  'electro-ball-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/electro-ball-target/attack-01.ogg'],
  },
  // Rapid Spin — o vento do pião, em loop na janela do giro
  // (`audio.actionGroup`); o Cobblemon não tem o golpe: o `gust_actor`
  // (`sounds/move/gust/`), escolhido de ouvido pelo usuário.
  'gust-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/gust-actor/attack-01.ogg'],
  },
  // Quick Attack — o `move.quickattack.*` do Cobblemon (`sounds/move/
  // quickattack/`): a arrancada (som de carga, enquanto ela corre) e o
  // acerto.
  'quick-attack-actor': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/quick-attack-actor/attack-01.ogg'],
  },
  'quick-attack-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/quick-attack-target/attack-01.ogg'],
  },
  // Gust — o `move.gust.target` (`sounds/move/gust/`): o vento batendo no
  // alvo (o do atacante é o `gust-actor`, acima).
  'gust-target': {
    volume: 0.18,
    refDistance: 2,
    clips: ['/assets/audio/attack/gust-target/attack-01.ogg'],
  },
  // String Shot — o `move.stringshot.*` do Cobblemon (`sounds/move/
  // stringshot/`): o disparo dos fios e a teia grudando no alvo, este mais
  // baixo (a mesma proporção de volume de lá).
  'string-shot-actor': {
    volume: 0.2,
    refDistance: 2,
    clips: ['/assets/audio/attack/string-shot-actor/attack-01.ogg'],
  },
  'string-shot-target': {
    volume: 0.1,
    refDistance: 2,
    clips: ['/assets/audio/attack/string-shot-target/attack-01.ogg'],
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
  'sand-attack',
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

// Razor Leaf — o Cobblemon tem DOIS sons de quem usa (`razorleaf_actor_1`, as
// folhas subindo, e `_actor_2`, o disparo) e o do alvo.
for (const part of ['actor-1', 'actor-2', 'target']) {
  ATTACK_SOUND_GROUPS[`razor-leaf-${part}`] = {
    volume: 0.18,
    refDistance: 2,
    clips: [`/assets/audio/attack/razor-leaf-${part}/attack-01.ogg`],
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
  // O do alvo espera o vento chegar (a pausa da linha do tempo do
  // Cobblemon, `GUST_TRAVEL` no visual).
  gust: [
    { group: 'gust-actor', delay: 0 },
    { group: 'gust-target', delay: 0.3 },
  ],
  // O do alvo espera a areia chegar (a pausa da linha do tempo do
  // Cobblemon, `SAND_TRAVEL` no visual).
  'sand-attack': [
    { group: 'sand-attack-actor', delay: 0 },
    { group: 'sand-attack-target', delay: 0.3 },
  ],
  // O do alvo espera os fios chegarem (a pausa da linha do tempo do
  // Cobblemon).
  // O Glare: o som do Scary Face (o mesmo trecho do Leer) e, quando o olhar
  // chega (`GLARE_DELAY` no visual), a paralisia pegando.
  // O Thunder Shock: lá o de quem usa toca no começo do gesto; aqui os dois
  // vão juntos no acerto (o som de carga repete e corta no `effectAt`).
  'thunder-shock': [
    { group: 'thunder-shock-actor', delay: 0 },
    { group: 'thunder-shock-target', delay: 0 },
  ],
  // O Thunder Wave: o do alvo espera a onda chegar (`WAVE_TRAVEL` no visual).
  'thunder-wave': [
    { group: 'thunder-wave-actor', delay: 0 },
    { group: 'thunder-wave-target', delay: 0.35 },
  ],
  // O Electro Ball: o do alvo espera a bola chegar (`BALL_TRAVEL` no visual).
  'electro-ball': [
    { group: 'electro-ball-actor', delay: 0 },
    { group: 'electro-ball-target', delay: 0.3 },
  ],
  glare: [
    { group: 'leer-actor', delay: 0 },
    { group: 'paralysis-target', delay: 0.3 },
  ],
  'string-shot': [
    { group: 'string-shot-actor', delay: 0 },
    { group: 'string-shot-target', delay: 0.3 },
  ],
  // O do alvo espera a semente pousar (o voo do visual, `leechSeedVfx.js`) —
  // aqui o efeito não é dano instantâneo, a 1ª drenagem só vem depois.
  'leech-seed': [
    { group: 'leech-seed-actor', delay: 0 },
    { group: 'leech-seed-target', delay: 0.35 },
  ],
  // Subida das folhas e acerto junto do 1º tick (o golpe é instantâneo); o
  // segundo som de quem usa vem no meio da rajada (no Cobblemon, o do alvo
  // espera as folhas chegarem).
  'razor-leaf': [
    { group: 'razor-leaf-actor-1', delay: 0 },
    { group: 'razor-leaf-target', delay: 0 },
    { group: 'razor-leaf-actor-2', delay: 0.35 },
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

/**
 * Chave do som de um ataque: o id do golpe
 * (docs/features/038-aprendizado-treino-e-dominio-de-golpes.md) — o golpe de
 * cada slot muda por criatura (aprender, reordenar, treinar), então o som é
 * registrado por golpe, não por slot.
 */
export function resolveAttackSoundKey(attack) {
  return attack?.id ?? null
}

/**
 * Todos os ataques que uma criatura da espécie pode usar, por chave de som:
 * cada golpe do learnset (kit + `moves`), com os overrides da espécie.
 */
function listSpeciesAttacks(species) {
  const attacks = []
  for (const { id } of listLearnset(species)) {
    const attack = resolveSkill(resolveSpeciesMoveReference(species, id))
    if (attack) attacks.push([id, attack])
  }
  return attacks
}

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
export function resolveAttackSound(species, slot) {
  return resolveAttackSoundParts(resolveCreatureAttack(species, slot))
}

/** As partes do som de UMA definição de ataque (ver `resolveAttackSound`). */
export function resolveAttackSoundParts(attack) {
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

/**
 * Os sons de TODOS os ataques que a espécie pode usar e que têm som:
 * `{ [chave]: partes }` (chave em `resolveAttackSoundKey`).
 */
export function resolveAttackSounds(species) {
  const sounds = {}
  for (const [key, attack] of listSpeciesAttacks(species)) {
    const parts = resolveAttackSoundParts(attack)
    if (parts) sounds[key] = parts
  }
  return sounds
}

/**
 * Sons em LOOP de cada ataque da espécie (um grupo simples de
 * `ATTACK_SOUND_GROUPS`): `{ [chave]: { clips, volume?, refDistance?, phase } }`
 * (chave em `resolveAttackSoundKey`).
 * `phase` diz QUANDO toca:
 *
 * - `'charge'` (`audio.chargeGroup`, ex.: o Growth): do disparo até o
 *   `effectAt` (enquanto `isAttackCharging`) — para no efeito ou numa
 *   interrupção.
 * - `'lunge'` (`audio.lungeGroup`, ex.: o Quick Attack): uma vez, inteiro,
 *   quando a arrancada começa (o `effectAt`).
 * - `'action'` (`audio.actionGroup`, ex.: o Tail Whip): do `effectAt` até a
 *   ação ACABAR (fim da `duration`) — cortado no fim se for mais longo,
 *   repetido se for mais curto.
 *
 * Um ataque tem no máximo um; com os dois configurados, vale o de carga. Quem
 * toca é `view/systems/attackAudioSystem.js`.
 */
export function resolveAttackLoopSounds(species) {
  const sounds = {}
  for (const [key, attack] of listSpeciesAttacks(species)) {
    const audio = attack.audio
    const phase = audio?.chargeGroup
      ? 'charge'
      : audio?.lungeGroup
        ? 'lunge'
        : 'action'
    const group = audio?.chargeGroup ?? audio?.lungeGroup ?? audio?.actionGroup
    const spec = group ? getAttackSoundGroup(group) : null
    if (spec) sounds[key] = { ...spec, phase }
  }
  return sounds
}
