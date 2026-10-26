import { OVERRIDABLE_SECTIONS } from '@/core/data/skills'

/**
 * Camadas de um golpe no laboratório de golpes (docs/features/061-revisao-
 * das-skills.md, Parte 1): a BASE (`core/data/skills/<id>/index.js`) e os
 * `overrides` da ESPÉCIE (a entrada dele em `moves`), mesclados como o
 * `resolveSkill` faz — campo a campo dentro de `OVERRIDABLE_SECTIONS`,
 * inteiro no resto. Tudo aqui é puro: recebe objetos e devolve objetos novos.
 *
 * Caminho de campo: `'duration'`, `'visual.scale'`, `'damage.power'`.
 */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const splitPath = (path) => path.split('.')

export function readPath(object, path) {
  let current = object
  for (const key of splitPath(path)) {
    if (!isPlainObject(current)) return undefined
    current = current[key]
  }
  return current
}

export function hasPath(object, path) {
  const keys = splitPath(path)
  let current = object
  for (const key of keys) {
    if (!isPlainObject(current) || !(key in current)) return false
    current = current[key]
  }
  return true
}

/** Cópia de `object` com `value` em `path` (cria os objetos do caminho). */
export function withPath(object, path, value) {
  const [key, ...rest] = splitPath(path)
  const source = isPlainObject(object) ? object : {}
  if (rest.length === 0) return { ...source, [key]: value }
  return { ...source, [key]: withPath(source[key], rest.join('.'), value) }
}

/** Cópia de `object` sem `path`; objeto que fica vazio no caminho sai junto. */
export function withoutPath(object, path) {
  if (!isPlainObject(object)) return object
  const [key, ...rest] = splitPath(path)
  if (!(key in object)) return object
  const copy = { ...object }
  if (rest.length === 0) {
    delete copy[key]
    return copy
  }
  const inner = withoutPath(copy[key], rest.join('.'))
  if (isPlainObject(inner) && Object.keys(inner).length === 0) delete copy[key]
  else copy[key] = inner
  return copy
}

export function deepEqual(a, b) {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every((key) => deepEqual(a[key], b[key]))
  }
  return false
}

const isMergedSection = (key) => OVERRIDABLE_SECTIONS.includes(key)

/**
 * Onde um campo mora nos `overrides` da espécie: o caminho inteiro numa seção
 * mesclada campo a campo; a chave de topo no resto (o override troca a seção
 * inteira — `damage`, `ai`, `effects`...).
 */
export function overrideKeyOf(path) {
  const [top] = splitPath(path)
  return isMergedSection(top) ? path : top
}

/** O golpe como o jogo vê: base + overrides (igual ao `resolveSkill`). */
export function mergeLayers(base, overrides) {
  if (!overrides) return base
  const merged = { ...base, ...overrides }
  for (const section of OVERRIDABLE_SECTIONS) {
    if (overrides[section]) {
      merged[section] = { ...base[section], ...overrides[section] }
    }
  }
  return merged
}

/** De onde vem o valor do campo: `'species'`, `'base'` ou `'default'`. */
export function resolveOrigin(base, overrides, path) {
  if (hasPath(overrides, overrideKeyOf(path))) return 'species'
  if (hasPath(base, path)) return 'base'
  return 'default'
}

/**
 * Escreve `value` em `path` na camada `layer` (`'base'` | `'species'`).
 * Na espécie, um campo de seção que não se mescla leva a seção inteira, com o
 * que o jogo vê hoje nela (senão o resto da seção sumiria).
 */
export function editLayer({ base, overrides }, layer, path, value) {
  if (layer === 'base') {
    return { base: withPath(base, path, value), overrides }
  }
  const key = overrideKeyOf(path)
  if (key === path) {
    return { base, overrides: withPath(overrides ?? {}, path, value) }
  }
  const current = mergeLayers(base, overrides)[key]
  const rest = path.slice(key.length + 1)
  return {
    base,
    overrides: withPath(overrides ?? {}, key, withPath(current, rest, value)),
  }
}

/** Tira o campo da camada — o valor volta a vir da camada de baixo. */
export function clearLayer({ base, overrides }, layer, path) {
  if (layer === 'base') return { base: withoutPath(base, path), overrides }
  return { base, overrides: withoutPath(overrides ?? {}, overrideKeyOf(path)) }
}

/**
 * Só os `overrides` que mudam alguma coisa em relação à base (o que é igual à
 * base não precisa estar na espécie). `{}` = nenhum.
 */
export function minimalOverrides(base, overrides) {
  const result = {}
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (isMergedSection(key) && isPlainObject(value)) {
      for (const [field, fieldValue] of Object.entries(value)) {
        if (!deepEqual(base?.[key]?.[field], fieldValue)) {
          result[key] = { ...result[key], [field]: fieldValue }
        }
      }
    } else if (!deepEqual(base?.[key], value)) {
      result[key] = value
    }
  }
  return result
}

/**
 * O que mudou na base em relação ao arquivo: `changes` (só os campos
 * mudados — campo a campo nas seções mescladas; o resto inteiro, como o
 * `resolveSkill` troca) e `removed` (caminhos que saíram).
 */
export function diffBase(original, draft) {
  const changes = {}
  const removed = []
  const keys = new Set([...Object.keys(original), ...Object.keys(draft)])
  for (const key of keys) {
    const before = original[key]
    const after = draft[key]
    if (deepEqual(before, after)) continue
    if (!(key in draft)) {
      removed.push(key)
    } else if (
      isMergedSection(key) &&
      isPlainObject(before) &&
      isPlainObject(after)
    ) {
      for (const field of new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ])) {
        if (deepEqual(before[field], after[field])) continue
        if (!(field in after)) removed.push(`${key}.${field}`)
        else changes[key] = { ...changes[key], [field]: after[field] }
      }
    } else {
      changes[key] = after
    }
  }
  return { changes, removed }
}

// Número sem o ruído do controle deslizante.
const round = (value) => Number(value.toFixed(4))

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const formatKey = (key) => (IDENTIFIER.test(key) ? key : `'${key}'`)

// Largura até onde um objeto/lista fica numa linha só.
const INLINE_WIDTH = 72

/** Valor JS no estilo do projeto (aspas simples, sem `;`). */
export function formatJs(value, indent = '') {
  if (value === null) return 'null'
  if (typeof value === 'number') return String(round(value))
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`
  if (typeof value !== 'object') return String(value)

  const inner = `${indent}  `
  const items = Array.isArray(value)
    ? value.map((item) => formatJs(item, inner))
    : Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => `${formatKey(key)}: ${formatJs(item, inner)}`)
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{ ', ' }']
  if (items.length === 0) return Array.isArray(value) ? '[]' : '{}'

  const inline = Array.isArray(value)
    ? `[${items.join(', ')}]`
    : `${open}${items.join(', ')}${close}`
  if (inline.length + indent.length <= INLINE_WIDTH && !inline.includes('\n')) {
    return inline
  }
  const [openLine, closeLine] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return `${openLine}\n${items.map((item) => `${inner}${item},`).join('\n')}\n${indent}${closeLine}`
}

/** Trecho com o que mudou na base do golpe (pra aplicar no arquivo dele). */
export function formatBaseChanges(skillId, { changes, removed }) {
  const lines = [`// ${skillId} — core/data/skills/${skillId}/index.js`]
  if (Object.keys(changes).length === 0 && removed.length === 0) {
    lines.push('// (nada mudou na base)')
    return lines.join('\n')
  }
  for (const [key, value] of Object.entries(changes)) {
    lines.push(`${formatKey(key)}: ${formatJs(value)},`)
  }
  for (const path of removed) lines.push(`// remover: ${path}`)
  return lines.join('\n')
}

// Recuo de uma entrada de `moves` no `index.js` da espécie.
const ENTRY_INDENT = '    '

/**
 * A entrada do golpe em `moves` da espécie (onde ficam os overrides — o kit,
 * `skills`, só aponta o id), pronta pra trocar a de hoje, com o `requires`.
 * Sem overrides vira `{ id, requires? }`.
 */
export function formatSpeciesEntry({ id, requires, overrides }) {
  const hasOverrides = overrides && Object.keys(overrides).length > 0
  const entry = { id }
  if (requires) entry.requires = requires
  if (hasOverrides) entry.overrides = overrides
  return `${ENTRY_INDENT}${formatJs(entry, ENTRY_INDENT)},`
}
