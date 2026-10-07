import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IMPACT_TYPES } from '../impactTypes'
import {
  ATTACK_SOUND_COMPOSITES,
  ATTACK_SOUND_GROUPS,
  getAttackSoundGroup,
  resolveAttackSound,
  resolveAttackLoopSounds,
  resolveAttackSoundKey,
  resolveAttackSoundParts,
  resolveAttackSounds,
} from './attackSound'
import { resolveCreatureAttack } from '../../battle/creatureAttack'
import { getSpecies } from '../species'
import { listSkills } from '../skills'

const PUBLIC = join(process.cwd(), 'public')

describe('grupos de som de impacto por tipo', () => {
  it('existe um grupo impact-<tipo> pra cada um dos 18 tipos, com 8 variações .ogg', () => {
    for (const type of IMPACT_TYPES) {
      const group = getAttackSoundGroup(`impact-${type}`)
      expect(group, type).not.toBeNull()
      expect(group.clips, type).toHaveLength(8)
      expect(group.clips.every((clip) => clip.endsWith('.ogg'))).toBe(true)
    }
  })

  it('o tipo normal usa os sons do lutador (como no Cobblemon)', () => {
    expect(ATTACK_SOUND_GROUPS['impact-normal'].clips).toEqual(
      ATTACK_SOUND_GROUPS['impact-fighting'].clips,
    )
  })

  it('todo clipe de todo grupo aponta pra um arquivo que existe em public/', () => {
    for (const [id, group] of Object.entries(ATTACK_SOUND_GROUPS)) {
      for (const clip of group.clips) {
        expect(existsSync(join(PUBLIC, clip)), `${id}: ${clip}`).toBe(true)
      }
    }
  })
})

describe('resolveAttackSound — grupo "impact"', () => {
  it('resolve o grupo do TIPO do golpe (visual.impactType)', () => {
    const parts = resolveAttackSoundParts({
      audio: { group: 'impact' },
      visual: { impactType: 'fire' },
      damage: null,
    })
    expect(parts).toEqual([{ ...ATTACK_SOUND_GROUPS['impact-fire'], delay: 0 }])
  })

  it('sem visual.impactType usa o tipo do golpe; sem nenhum, normal', () => {
    const soundFor = (type) =>
      resolveAttackSoundParts({ audio: { group: 'impact' }, visual: {}, type })
    expect(soundFor('water')).toEqual([
      { ...ATTACK_SOUND_GROUPS['impact-water'], delay: 0 },
    ])
    expect(soundFor(undefined)).toEqual([
      { ...ATTACK_SOUND_GROUPS['impact-normal'], delay: 0 },
    ])
  })

  it('os grupos antigos e o clips próprio continuam funcionando', () => {
    expect(
      resolveAttackSoundParts({ audio: { group: 'tackle' }, visual: {} }),
    ).toEqual([{ ...ATTACK_SOUND_GROUPS.tackle, delay: 0 }])
    const own = { clips: ['/x.ogg'], volume: 1 }
    expect(resolveAttackSoundParts({ audio: own, visual: {} })).toEqual([
      { ...own, delay: 0 },
    ])
    expect(
      resolveAttackSoundParts({ audio: { group: null }, visual: {} }),
    ).toBeNull()
  })
})

describe('sons dos golpes de fogo (atacante + alvo)', () => {
  it('Brasa e Lança-chamas têm grupo de atacante e de alvo, cada um com 1 arquivo .ogg', () => {
    for (const group of [
      'ember-actor',
      'ember-target',
      'flamethrower-actor',
      'flamethrower-target',
    ]) {
      expect(getAttackSoundGroup(group).clips, group).toHaveLength(1)
    }
  })

  it('o grupo composto vira duas partes (atacante e alvo), as duas no instante do golpe', () => {
    const resolve = (group) =>
      resolveAttackSoundParts({ audio: { group }, visual: {} })

    const ember = resolve('ember')
    expect(ember.map((p) => p.delay)).toEqual([0, 0])
    expect(ember[0].clips).toEqual(ATTACK_SOUND_GROUPS['ember-actor'].clips)
    expect(ember[1].clips).toEqual(ATTACK_SOUND_GROUPS['ember-target'].clips)

    const flame = resolve('flamethrower')
    expect(flame.map((p) => p.delay)).toEqual([0, 0])
    expect(flame[1].clips).toEqual(
      ATTACK_SOUND_GROUPS['flamethrower-target'].clips,
    )
  })

  it('o som do alvo toca no instante do impacto (o golpe é instantâneo, o visual não viaja)', () => {
    expect(ATTACK_SOUND_COMPOSITES.ember[1].delay).toBe(0)
    expect(ATTACK_SOUND_COMPOSITES.flamethrower[1].delay).toBe(0)
  })
})

describe('resolveAttackSound por slot / resolveAttackSounds', () => {
  const species = {
    skills: {
      2: { id: 'ember' },
      3: { id: 'flamethrower' },
    },
  }

  it('habilidades (secondary1-3) resolvem o som da skill do slot', () => {
    const ember = resolveAttackSound(species, 'secondary2')
    expect(ember.map((p) => p.delay)).toEqual([0, 0])
    const flame = resolveAttackSound(species, 'secondary3')
    expect(flame.map((p) => p.delay)).toEqual([0, 0])
  })

  it('slot sem ataque configurado não tem som', () => {
    expect(resolveAttackSound(species, 'secondary1')).toBeNull()
  })

  it('resolveAttackSounds junta, por id do golpe, só os que têm som', () => {
    const sounds = resolveAttackSounds(species)
    expect(Object.keys(sounds)).toEqual(['ember', 'flamethrower'])
    expect(sounds.ember).toHaveLength(2)
  })

  it('golpe do learnset (fora do kit) também ganha som — pode ser aprendido', () => {
    const sounds = resolveAttackSounds({ ...species, moves: [{ id: 'punch' }] })
    expect(Object.keys(sounds)).toContain('punch')
  })

  it('a chave do som é o id do golpe', () => {
    expect(resolveAttackSoundKey({ id: 'ember' })).toBe('ember')
    expect(resolveAttackSoundKey(null)).toBeNull()
  })

  it('o Charmander real: cada golpe do kit resolve o som que a sua skill declara (qualquer que seja o conjunto de skills)', () => {
    const species = getSpecies('charmander')
    const sounds = resolveAttackSounds(species)

    for (const slot of ['secondary1', 'secondary2', 'secondary3']) {
      const attack = resolveCreatureAttack(species, slot)
      const key = resolveAttackSoundKey(attack)
      const audio = attack?.audio
      const composite = ATTACK_SOUND_COMPOSITES[audio?.group]
      if (composite) {
        // grupo composto: uma parte por som (ex.: Brasa = atacante + alvo)
        expect(sounds[key], slot).toHaveLength(composite.length)
      } else if (audio?.cry && !audio.group) {
        // skill que só vocaliza (Growl): nenhum som de ATAQUE
        expect(sounds[key], slot).toBeUndefined()
      }
    }
  })
})

describe('Growl — o som é o grito da criatura, não um som de ataque', () => {
  it('resolveAttackSound devolve null (audio.cry toca pela voz, via CryPulse)', () => {
    const growl = {
      audio: { group: null, cry: true },
      visual: {},
      damage: null,
    }

    expect(resolveAttackSoundParts(growl)).toBeNull()
  })
})

describe('som de atributo subiu (statup)', () => {
  it('o grupo "statup" tem 1 arquivo, e ele existe em public/', () => {
    const { clips } = getAttackSoundGroup('statup')
    expect(clips).toHaveLength(1)
    expect(existsSync(join(PUBLIC, clips[0]))).toBe(true)
  })
})

describe('som do Tail Whip', () => {
  it('o grupo "tail-whip" tem 1 arquivo, e ele existe em public/', () => {
    const { clips } = getAttackSoundGroup('tail-whip')
    expect(clips).toHaveLength(1)
    expect(existsSync(join(PUBLIC, clips[0]))).toBe(true)
  })
})

describe('som de carga (audio.chargeGroup)', () => {
  // Golpes de verdade com som em loop (sem fixar qual): um de carga e um da
  // ação inteira.
  const chargeSkill = listSkills().find((skill) => skill.audio?.chargeGroup)
  const actionSkill = listSkills().find((skill) => skill.audio?.actionGroup)
  const plainSkill = listSkills().find(
    (skill) => !skill.audio?.chargeGroup && !skill.audio?.actionGroup,
  )

  it('o golpe com chargeGroup ganha o som de carga; os outros não', () => {
    expect(resolveAttackLoopSounds({ skills: { 1: plainSkill.id } })).toEqual(
      {},
    )
    const sounds = resolveAttackLoopSounds({
      skills: { 1: plainSkill.id, 2: chargeSkill.id },
    })
    expect(Object.keys(sounds)).toEqual([chargeSkill.id])
    expect(sounds[chargeSkill.id].clips).toEqual(
      ATTACK_SOUND_GROUPS[chargeSkill.audio.chargeGroup].clips,
    )
  })

  it('o som de carga vem marcado com a fase "charge"', () => {
    const sounds = resolveAttackLoopSounds({ skills: { 1: chargeSkill.id } })
    expect(sounds[chargeSkill.id].phase).toBe('charge')
  })

  it('o som da AÇÃO inteira (audio.actionGroup) vem marcado com a fase "action"', () => {
    const sounds = resolveAttackLoopSounds({ skills: { 1: actionSkill.id } })
    expect(sounds[actionSkill.id].phase).toBe('action')
    expect(sounds[actionSkill.id].clips).toEqual(
      ATTACK_SOUND_GROUPS[actionSkill.audio.actionGroup].clips,
    )
  })

  it('o arquivo do som de carga existe em public/', () => {
    for (const clip of ATTACK_SOUND_GROUPS['absorb-charge'].clips) {
      expect(existsSync(join(PUBLIC, clip))).toBe(true)
    }
  })
})

describe('sons do Leech Seed', () => {
  it('grupo composto: o de quem lança na hora, o do alvo quando a semente pousa', () => {
    const parts = resolveAttackSoundParts({
      audio: { group: 'leech-seed' },
      visual: {},
    })
    expect(parts.map((p) => p.delay)).toEqual([0, 0.35])
  })

  it('os arquivos existem em public/', () => {
    for (const group of ['leech-seed-actor', 'leech-seed-target']) {
      for (const clip of ATTACK_SOUND_GROUPS[group].clips) {
        expect(existsSync(join(PUBLIC, clip)), clip).toBe(true)
      }
    }
  })
})

describe('sons do Water Gun', () => {
  it('o de quem atira e o do alvo juntos (golpe instantâneo); os arquivos existem', () => {
    const parts = resolveAttackSoundParts({
      audio: { group: 'water-gun' },
      visual: {},
    })
    expect(parts.map((p) => p.delay)).toEqual([0, 0])
    for (const group of ['water-gun-actor', 'water-gun-target']) {
      for (const clip of ATTACK_SOUND_GROUPS[group].clips) {
        expect(existsSync(join(PUBLIC, clip)), clip).toBe(true)
      }
    }
  })
})
