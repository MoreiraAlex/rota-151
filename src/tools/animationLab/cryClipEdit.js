/**
 * Edição do clipe do grito (`species.clips.cry`) no laboratório de animação
 * (`AnimationLab.jsx`). Funções puras: cada uma devolve um clipe NOVO, sem
 * mexer no recebido — o laboratório guarda o clipe em estado React e o motor
 * (`applyAnimationClip`) lê o atual a cada frame.
 *
 * Formato (`core/animation/curves.js`): `bones[osso][propriedade][eixo]` é
 * uma curva; uma curva `sum` vira uma lista de TERMOS no editor, e uma lista
 * de um termo só volta a ser a curva solta.
 */

export const PROPERTIES = ['rotation', 'position', 'scale']
export const AXES = ['x', 'y', 'z']
export const TERM_TYPES = ['constant', 'sine', 'clampedSine', 'absSine']

const TERM_DEFAULTS = {
  constant: { type: 'constant', value: 0 },
  sine: { type: 'sine', amplitude: 0, frequencyScale: 1, phaseTurns: 0 },
  clampedSine: {
    type: 'clampedSine',
    amplitude: 0,
    frequencyScale: 1,
    phaseTurns: 0,
    min: 0,
    max: 0,
  },
  absSine: { type: 'absSine', amplitude: 0, frequencyScale: 1, phaseTurns: 0 },
}

/** Os termos de uma curva: os da soma, ou ela mesma. */
export function termsOf(curve) {
  if (!curve) return []
  return curve.type === 'sum' ? curve.curves : [curve]
}

function curveOf(terms) {
  return terms.length === 1 ? terms[0] : { type: 'sum', curves: terms }
}

/** Termo novo do `type`, zerado (não muda o movimento até ser ajustado). */
export function newTerm(type) {
  return { ...TERM_DEFAULTS[type] }
}

/** As trilhas do clipe, em ordem: `{ bone, property, axis, curve }`. */
export function listTracks(clip) {
  const tracks = []
  for (const [bone, properties] of Object.entries(clip.bones ?? {})) {
    for (const property of PROPERTIES) {
      for (const axis of AXES) {
        const curve = properties[property]?.[axis]
        if (curve) tracks.push({ bone, property, axis, curve })
      }
    }
  }
  return tracks
}

function updateTerms(clip, { bone, property, axis }, change) {
  const next = structuredClone(clip)
  const terms = change(termsOf(next.bones[bone][property][axis]))
  if (terms.length === 0) return removeTrack(next, { bone, property, axis })
  next.bones[bone][property][axis] = curveOf(terms)
  return next
}

/** Trilha nova (osso/propriedade/eixo) com um seno zerado. */
export function addTrack(clip, { bone, property, axis }) {
  const next = structuredClone(clip)
  next.bones ??= {}
  next.bones[bone] ??= {}
  next.bones[bone][property] ??= {}
  next.bones[bone][property][axis] ??= newTerm('sine')
  return next
}

/** Tira a trilha; osso/propriedade que ficam vazios saem junto. */
export function removeTrack(clip, { bone, property, axis }) {
  const next = structuredClone(clip)
  const properties = next.bones?.[bone]
  if (!properties?.[property]) return next
  delete properties[property][axis]
  if (Object.keys(properties[property]).length === 0) {
    delete properties[property]
  }
  if (Object.keys(properties).length === 0) delete next.bones[bone]
  return next
}

export function addTerm(clip, track, type) {
  return updateTerms(clip, track, (terms) => [...terms, newTerm(type)])
}

export function removeTerm(clip, track, index) {
  return updateTerms(clip, track, (terms) =>
    terms.filter((_, i) => i !== index),
  )
}

/** Troca o tipo do termo, mantendo os campos que os dois tipos têm. */
export function setTermType(clip, track, index, type) {
  return updateTerms(clip, track, (terms) =>
    terms.map((term, i) => {
      if (i !== index) return term
      const fresh = newTerm(type)
      for (const field of Object.keys(fresh)) {
        if (field !== 'type' && term[field] !== undefined) {
          fresh[field] = term[field]
        }
      }
      return fresh
    }),
  )
}

export function setTermField(clip, track, index, field, value) {
  return updateTerms(clip, track, (terms) =>
    terms.map((term, i) => (i === index ? { ...term, [field]: value } : term)),
  )
}

/** Campos numéricos editáveis de um termo, na ordem de exibição. */
export function termFields(term) {
  return Object.keys(TERM_DEFAULTS[term.type] ?? {}).filter(
    (field) => field !== 'type',
  )
}

/**
 * O maior desvio que a curva pode dar a partir do descanso (limite de cima:
 * soma dos módulos de cada termo). Rotação em radianos, posição em metros.
 */
export function peakOf(curve) {
  return termsOf(curve).reduce((total, term) => {
    if (term.type === 'constant') return total + Math.abs(term.value ?? 0)
    const wave = Math.abs(term.amplitude ?? 0)
    if (term.type !== 'clampedSine') return total + wave
    const limit = Math.max(Math.abs(term.min ?? 0), Math.abs(term.max ?? 0))
    return total + Math.min(wave, limit)
  }, 0)
}
