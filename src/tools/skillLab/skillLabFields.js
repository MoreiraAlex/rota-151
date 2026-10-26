import { GAME_CONFIG } from '@/core/gameConfig'
import { IMPACT_TYPES } from '@/core/data/impactTypes'
import { listTypes } from '@/core/data/types'
import { listConditions, resolveConditionEffect } from '@/core/data/conditions'
import { STAT_STAGE_KEYS, STAT_STAGE_LIMIT } from '@/core/battle/statStages'
import {
  ATTACK_SOUND_COMPOSITES,
  ATTACK_SOUND_GROUPS,
} from '@/core/data/audio/attackSound'

/**
 * Os campos de um golpe que o laboratório de golpes edita (docs/features/
 * 061-revisao-das-skills.md, Parte 1), por seção, na ordem do molde
 * (`core/data/skills/_template/index.js`). As faixas dos controles são só do
 * laboratório (até onde o controle deslizante vai), não do jogo.
 *
 * Tipos de campo (`kind`): `number`, `select`, `bool`, `vec3`, `list`
 * (texto, um por linha), `types` (vários tipos), `effects` (a lista de
 * efeitos de status) e `section` (seção que pode ser `null`, ex.: golpe sem
 * dano — `empty` é o que ela vira ao ligar). `optional`: pode ficar ausente (vale o padrão);
 * `nullable`: `null` é um valor de verdade (ex.: sem som, nunca erra).
 */

const options = (values) => values.map((value) => ({ value, label: value }))

const typeIds = () => listTypes().map((type) => type.id)

/** Campos de cada tipo de efeito de status (`effects`). */
export const EFFECT_FIELDS = {
  statStage: [
    { key: 'stat', kind: 'select', options: options(STAT_STAGE_KEYS) },
    {
      key: 'stages',
      kind: 'number',
      min: -STAT_STAGE_LIMIT,
      max: STAT_STAGE_LIMIT,
      step: 1,
    },
    { key: 'duration', kind: 'number', min: 0, max: 120, step: 1, unit: 's' },
  ],
  // A condição dá os valores (`core/data/conditions/`); os `optional` são
  // o que o golpe troca por cima — ausentes, valem os da condição.
  condition: [
    {
      key: 'condition',
      kind: 'select',
      options: options(listConditions().map((condition) => condition.id)),
    },
    {
      key: 'chance',
      kind: 'number',
      min: 0,
      max: 1,
      step: 0.01,
      optional: true,
    },
    {
      key: 'duration',
      kind: 'number',
      min: 0,
      max: 60,
      step: 0.5,
      unit: 's',
      optional: true,
    },
    {
      key: 'tick.fraction',
      kind: 'number',
      min: 0,
      max: 0.5,
      step: 0.0025,
      optional: true,
    },
    {
      key: 'tick.interval',
      kind: 'number',
      min: 0.1,
      max: 10,
      step: 0.1,
      unit: 's',
      optional: true,
    },
    {
      key: 'modifiers.attack',
      kind: 'number',
      min: 0,
      max: 2,
      step: 0.05,
      optional: true,
    },
    { key: 'immuneTypes', kind: 'types', optional: true },
  ],
}

/** Efeito novo de cada tipo (o primeiro valor de cada campo obrigatório). */
export function createEffect(type) {
  const effect = { type }
  for (const field of EFFECT_FIELDS[type]) {
    if (field.optional) continue
    if (field.kind === 'select') effect[field.key] = field.options[0].value
    else if (field.kind === 'types') effect[field.key] = []
    else effect[field.key] = field.min
  }
  return effect
}

/** O valor de `key` (`'tick.fraction'`) em `object`, ou `undefined`. */
export function readEffectField(object, key) {
  return key.split('.').reduce((value, part) => value?.[part], object)
}

/** `effect` com `key` (`'tick.fraction'`) trocado por `value`. */
export function writeEffectField(effect, key, value) {
  const [head, ...rest] = key.split('.')
  if (!rest.length) return { ...effect, [head]: value }
  return {
    ...effect,
    [head]: writeEffectField(effect[head] ?? {}, rest.join('.'), value),
  }
}

/**
 * O valor que um campo de efeito mostra: o escrito no efeito ou, ausente, o
 * que vale no jogo (a condição, no efeito `condition`).
 */
export function resolveEffectField(effect, key) {
  const own = readEffectField(effect, key)
  if (own !== undefined) return own
  return readEffectField(resolveConditionEffect(effect), key)
}

/**
 * As seções de campos. `groups`: os ids que vêm da VIEW (`effectGroups` de
 * `attackEffects/registry.js`, `continuousGroups` de
 * `ContinuousAttackEffectsView.jsx`) e as chaves de animação da espécie
 * (`clipKeys`).
 */
export function buildFieldSections({
  effectGroups,
  continuousGroups,
  clipKeys,
}) {
  const soundGroups = [
    'impact',
    ...Object.keys(ATTACK_SOUND_COMPOSITES),
    ...Object.keys(ATTACK_SOUND_GROUPS),
  ]
  const simpleSoundGroups = Object.keys(ATTACK_SOUND_GROUPS)

  return [
    {
      title: 'Tempo e forma',
      fields: [
        {
          path: 'duration',
          label: 'duração',
          kind: 'number',
          min: 0,
          max: 5,
          step: 0.05,
          unit: 's',
        },
        {
          path: 'effectAt',
          label: 'instante do efeito',
          kind: 'number',
          min: 0,
          max: 5,
          step: 0.05,
          unit: 's',
        },
        {
          path: 'group',
          label: 'grupo',
          kind: 'select',
          options: options(Object.keys(GAME_CONFIG.ATTACK_GROUPS)),
        },
        {
          path: 'execution',
          label: 'execução',
          kind: 'select',
          options: options(['instant', 'charge', 'channel']),
          optional: true,
        },
        {
          path: 'damageInterval',
          label: 'intervalo do canal',
          kind: 'number',
          min: 0.05,
          max: 2,
          step: 0.05,
          unit: 's',
          optional: true,
        },
        {
          path: 'multiHit.counts',
          label: 'acertos possíveis',
          kind: 'numbers',
          optional: true,
        },
        {
          path: 'multiHit.weights',
          label: 'peso de cada um',
          kind: 'numbers',
          optional: true,
        },
        {
          path: 'multiHit.interval',
          label: 'intervalo entre acertos',
          kind: 'number',
          min: 0.05,
          max: 1,
          step: 0.01,
          unit: 's',
          optional: true,
        },
        {
          path: 'lunge.distance',
          label: 'arrancada (distância)',
          kind: 'number',
          min: 0,
          max: 8,
          step: 0.05,
          unit: 'm',
          optional: true,
        },
        {
          path: 'lunge.duration',
          label: 'arrancada (tempo)',
          kind: 'number',
          min: 0,
          max: 2,
          step: 0.01,
          unit: 's',
          optional: true,
        },
      ],
    },
    {
      title: 'Animação',
      fields: [
        {
          path: 'animation.clipKey',
          label: 'clipe',
          kind: 'select',
          options: options(clipKeys),
        },
        {
          path: 'animationFrames',
          label: 'frames do clipe',
          kind: 'number',
          min: 1,
          max: 240,
          step: 1,
          optional: true,
        },
      ],
    },
    {
      title: 'Visual',
      fields: [
        {
          path: 'visual.effectGroup',
          label: 'efeito',
          kind: 'select',
          options: options(['none', ...effectGroups]),
        },
        {
          path: 'visual.impactType',
          label: 'tipo do impacto',
          kind: 'select',
          options: options(IMPACT_TYPES),
          optional: true,
        },
        {
          path: 'visual.scale',
          label: 'escala',
          kind: 'number',
          min: 0,
          max: 5,
          step: 0.05,
          unit: '×',
        },
        {
          path: 'visual.boostedScale',
          label: 'escala no poder maior',
          kind: 'number',
          min: 0,
          max: 5,
          step: 0.05,
          unit: '×',
          optional: true,
        },
        {
          path: 'visual.afterimages.count',
          label: 'vultos',
          kind: 'number',
          min: 0,
          max: 8,
          step: 1,
          optional: true,
        },
        {
          path: 'visual.afterimages.spread',
          label: 'vultos (afastamento)',
          kind: 'number',
          min: 0,
          max: 2,
          step: 0.05,
          unit: 'm',
          optional: true,
        },
        {
          path: 'visual.afterimages.duration',
          label: 'vultos (duração)',
          kind: 'number',
          min: 0.1,
          max: 3,
          step: 0.05,
          unit: 's',
          optional: true,
        },
        {
          path: 'visual.afterimages.opacity',
          label: 'vultos (opacidade)',
          kind: 'number',
          min: 0,
          max: 1,
          step: 0.05,
          optional: true,
        },
        {
          path: 'visual.afterimages.flicker',
          label: 'vultos (piscadas)',
          kind: 'number',
          min: 0,
          max: 20,
          step: 1,
          unit: '/s',
          optional: true,
        },
        {
          path: 'visual.effectVisualDuration',
          label: 'duração do efeito',
          kind: 'number',
          min: 0,
          max: 5,
          step: 0.05,
          unit: 's',
        },
        {
          path: 'visual.revealDuration',
          label: 'revelação',
          kind: 'number',
          min: 0,
          max: 2,
          step: 0.05,
          unit: 's',
          optional: true,
        },
        {
          path: 'visual.rotationOffset',
          label: 'giro',
          kind: 'vec3',
          min: -180,
          max: 180,
          step: 1,
          unit: '°',
          optional: true,
        },
        {
          path: 'visual.positionOffset',
          label: 'saída',
          kind: 'vec3',
          min: -3,
          max: 3,
          step: 0.01,
          unit: 'm',
          optional: true,
        },
        {
          path: 'visual.targetEffectGroup',
          label: 'efeito no alvo',
          kind: 'select',
          options: options(effectGroups),
          optional: true,
        },
        {
          path: 'visual.targetEffectVisualDuration',
          label: 'duração no alvo',
          kind: 'number',
          min: 0,
          max: 10,
          step: 0.1,
          unit: 's',
          optional: true,
        },
        {
          path: 'visual.lungeGroup',
          label: 'efeito da arrancada',
          kind: 'select',
          options: options(continuousGroups),
          optional: true,
        },
        {
          path: 'visual.chargeGroup',
          label: 'efeito de carga',
          kind: 'select',
          options: options(continuousGroups),
          optional: true,
        },
        {
          path: 'visual.channelGroup',
          label: 'efeito do canal',
          kind: 'select',
          options: options(continuousGroups),
          optional: true,
        },
        {
          path: 'visual.channelHitGroup',
          label: 'efeito do tick',
          kind: 'select',
          options: options(effectGroups),
          optional: true,
        },
        {
          path: 'visual.channelHitVisualDuration',
          label: 'duração do tick',
          kind: 'number',
          min: 0,
          max: 5,
          step: 0.05,
          unit: 's',
          optional: true,
        },
        {
          path: 'visual.actionGroup',
          label: 'efeito da ação',
          kind: 'select',
          options: options(continuousGroups),
          optional: true,
        },
      ],
    },
    {
      title: 'Som',
      fields: [
        {
          path: 'audio.group',
          label: 'grupo',
          kind: 'select',
          options: options(soundGroups),
          optional: true,
          nullable: true,
        },
        {
          path: 'audio.cry',
          label: 'grito da espécie',
          kind: 'bool',
          optional: true,
        },
        {
          path: 'audio.lungeGroup',
          label: 'som da arrancada',
          kind: 'select',
          options: options(simpleSoundGroups),
          optional: true,
        },
        {
          path: 'audio.chargeGroup',
          label: 'som da carga',
          kind: 'select',
          options: options(simpleSoundGroups),
          optional: true,
        },
        {
          path: 'audio.actionGroup',
          label: 'som da ação',
          kind: 'select',
          options: options(simpleSoundGroups),
          optional: true,
        },
        {
          path: 'audio.clips',
          label: 'sons próprios',
          kind: 'list',
          optional: true,
        },
        {
          path: 'audio.volume',
          label: 'volume',
          kind: 'number',
          min: 0,
          max: 3,
          step: 0.05,
          optional: true,
        },
        {
          path: 'audio.refDistance',
          label: 'distância do som',
          kind: 'number',
          min: 0,
          max: 20,
          step: 0.5,
          unit: 'm',
          optional: true,
        },
      ],
    },
    {
      title: 'Gameplay',
      fields: [
        {
          path: 'type',
          label: 'tipo',
          kind: 'select',
          options: options(typeIds()),
        },
        {
          path: 'damage',
          label: 'tem dano',
          kind: 'section',
          empty: { power: 0, category: 'physical' },
        },
        {
          path: 'damage.power',
          label: 'poder',
          kind: 'number',
          min: 0,
          max: 250,
          step: 5,
        },
        {
          path: 'damage.category',
          label: 'categoria',
          kind: 'select',
          options: options(['physical', 'special']),
        },
        {
          path: 'damage.speedPower',
          label: 'poder pela Velocidade',
          kind: 'tiers',
          keys: ['ratio', 'power'],
          optional: true,
        },
        {
          path: 'damage.recentDamageBoost.window',
          label: 'apanhou há pouco (janela)',
          kind: 'number',
          min: 0,
          max: 10,
          step: 0.1,
          unit: 's',
          optional: true,
        },
        {
          path: 'damage.recentDamageBoost.multiplier',
          label: 'apanhou há pouco (× poder)',
          kind: 'number',
          min: 1,
          max: 4,
          step: 0.1,
          optional: true,
        },
        {
          path: 'accuracy',
          label: 'precisão',
          kind: 'number',
          min: 0,
          max: 100,
          step: 5,
          unit: '%',
          optional: true,
          nullable: true,
        },
        {
          path: 'immuneTypes',
          label: 'tipos imunes',
          kind: 'types',
          optional: true,
        },
        { path: 'effects', label: 'efeitos', kind: 'effects', optional: true },
        {
          path: 'staminaCost',
          label: 'energia',
          kind: 'number',
          min: 0,
          max: 50,
          step: 0.5,
          optional: true,
        },
        {
          path: 'cooldown',
          label: 'recarga',
          kind: 'number',
          min: 0,
          max: 30,
          step: 0.5,
          unit: 's',
          optional: true,
        },
        {
          path: 'trainingHours',
          label: 'horas de treino',
          kind: 'number',
          min: 0,
          max: 48,
          step: 0.5,
          unit: 'h',
          optional: true,
        },
        {
          path: 'ai.weight',
          label: 'peso na IA',
          kind: 'number',
          min: 0,
          max: 3,
          step: 0.05,
          optional: true,
        },
      ],
    },
  ]
}

/** Lista de tipos pros campos `types`. */
export function listTypeIds() {
  return typeIds()
}
