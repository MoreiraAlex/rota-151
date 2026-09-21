import { DEFAULT_ATTACK_EFFECT_GROUP } from '@/core/traits'
import { ScratchAttackEffect } from './ScratchAttackEffect'
import { PunchAttackEffect } from './PunchAttackEffect'
import { VineWhipAttackEffect } from './VineWhipAttackEffect'
import { EmberAttackEffect } from './EmberAttackEffect'
import { WhirlpoolAttackEffect } from './WhirlpoolAttackEffect'

/**
 * Registro id de grupo → componente de VIEW do efeito visual do ataque
 * (ver docs/features/025-ataque-comum-de-criatura.md) — mesmo princípio
 * de `SPECIES_REGISTRY` (`core/data/species/index.js`): a definição de
 * ataque (`core/data/attacks/<id>/index.js`, `visual.effectGroup`) só
 * carrega o ID do grupo, dado puro, sem saber nada de Three/React; a
 * PONTE id→componente mora aqui, na view (core não pode importar React/
 * Three). Pedido explícito do usuário: "muitas criaturas vão
 * compartilhar o ataque básico de arranhar, outras vão ser específicas
 * como um chicote" — cada golpe visualmente distinto ganha sua própria
 * entrada aqui, sem sistema novo nenhum pra somar (só mais uma linha no
 * mapa + um componente).
 *
 * `'scratch'` (arranhão, malha de rip, revelado progressivamente — ver
 * `ScratchAttackEffect.jsx`) e `'punch'` (flash + onda de choque, também
 * rip) são os grupos do ataque COMUM (`attacks.primary`); `'vine-whip'`/
 * `'ember'`/`'whirlpool'` (9ª rodada, skills de verdade — ver
 * docs/features/025) são os grupos das 3 primeiras SKILLS
 * (`attacks.secondary1`), uma por Pokémon inicial. Cada um usado por um
 * subconjunto de espécies (ver `core/data/attacks/<id>/index.js` pras
 * definições, e `attacks.<slot>` em cada `core/data/species/<id>/
 * index.js` pra ver quem usa qual). Um golpe novo entra do mesmo jeito —
 * nova entrada + componente aqui, mais a definição em `core/data/
 * attacks/<id>/index.js` — `AttackEffectView.jsx` não muda nada.
 */
const ATTACK_EFFECT_COMPONENTS = {
  scratch: ScratchAttackEffect,
  punch: PunchAttackEffect,
  'vine-whip': VineWhipAttackEffect,
  ember: EmberAttackEffect,
  whirlpool: WhirlpoolAttackEffect,
}

/**
 * Resolve o componente pelo id de grupo — grupo desconhecido (não devia
 * acontecer, mas espécie mal configurada é sempre um risco) cai no
 * DEFAULT, mesmo espírito gracioso de outros fallbacks do projeto
 * (`resolveEyeState`, `hasPendingBall`, etc.) em vez de não renderizar
 * nada.
 */
export function resolveAttackEffectComponent(effectGroup) {
  return (
    ATTACK_EFFECT_COMPONENTS[effectGroup] ??
    ATTACK_EFFECT_COMPONENTS[DEFAULT_ATTACK_EFFECT_GROUP]
  )
}
