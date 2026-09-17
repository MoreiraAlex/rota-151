/**
 * Fábrica do padrão "grupo compartilhado + override individual" — o
 * mesmo princípio de `footstepGroups.js` (docs/features/019-som-
 * ambiente-e-passos.md), extraído aqui pra som de dash/pulo reusarem sem
 * duplicar a função de resolução de novo. Som de passo continua com o
 * próprio módulo — tem DOIS arrays (`walk`/`run`), não cabe no formato
 * genérico `{ clips, volume?, refDistance? }` que dash/pulo usam.
 *
 * `groups`: objeto `{ <id>: { clips: [...], volume?, refDistance? } }`.
 * `individualKey`/`groupKey`: nomes dos campos em `species.sounds` (ex.:
 * `'dash'`/`'dashGroup'`) — individual vence se declarado; senão cai no
 * grupo compartilhado; sem nenhum dos dois, `null` (espécie sem esse som
 * ainda, mesmo fallback gracioso de todo o resto do projeto).
 *
 * Sem intervalo (diferente de voz/ambiente): som de AÇÃO toca no INSTANTE
 * do evento (dash disparado, pulo disparado), não por temporizador.
 */
export function createActionSoundResolver(groups, { individualKey, groupKey }) {
  function getGroup(id) {
    return groups[id] ?? null
  }

  function resolve(species) {
    const sounds = species?.sounds
    if (!sounds) return null
    if (sounds[individualKey]) return sounds[individualKey]
    if (sounds[groupKey]) return getGroup(sounds[groupKey])
    return null
  }

  return { getGroup, resolve }
}
