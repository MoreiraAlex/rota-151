import { resolveCreatureAttack } from '../attacks'

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
  scratch: {
    volume: 0.18,
    refDistance: 2,
    clips: [
      '/assets/audio/attack/scratch/attack-01.wav',
      '/assets/audio/attack/scratch/attack-02.wav',
    ],
  },
}

export function getAttackSoundGroup(id, groups = ATTACK_SOUND_GROUPS) {
  return groups[id] ?? null
}

/**
 * Resolve o som do ataque de uma espécie — diferente de `dashSound.js`/
 * `jumpSound.js` (que leem `species.sounds.<key>` direto), o som de
 * ataque agora vive DENTRO da definição de ataque resolvida (`audio`,
 * ver `core/data/attacks/index.js`, seção "reorganização da config" em
 * docs/features/025-ataque-comum-de-criatura.md) — não mais em
 * `species.sounds`. `audio.clips` (som PRÓPRIO deste ataque) vence se
 * declarado; senão cai em `audio.group` (`ATTACK_SOUND_GROUPS`); sem
 * nenhum dos dois, ou sem `species.attacks.primary` configurado, `null`
 * — mesmo fallback gracioso de sempre.
 *
 * **Limitação conhecida (9ª rodada, docs/features/025)**: só resolve o
 * ataque `primary` — `secondary1-3` já têm skills de verdade
 * (`vine-whip`/`ember`/`whirlpool`, ver `core/data/attacks/`), mas ainda
 * sem som PRÓPRIO (`audio.group: null` de propósito nas três, esperando
 * o usuário trazer os arquivos) e sem o pulso (`AttackPulse`,
 * `creatureAttackSystem.js`) carregar qual slot disparou — generalizar
 * esta função (e `attackAudioSystem.js`/`useAnimatedModel.js`, que hoje
 * registram um único nó de áudio por criatura) é trabalho da rodada de
 * áudio das skills, não desta.
 */
export function resolveAttackSound(species) {
  const attack = resolveCreatureAttack(species?.attacks?.primary)
  const audio = attack?.audio
  if (!audio) return null
  if (audio.clips) return audio
  if (audio.group) return getAttackSoundGroup(audio.group)
  return null
}
