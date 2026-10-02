import { DEFAULT_ATTACK_EFFECT_GROUP } from '@/core/traits'
import { TackleAttackEffect } from './TackleAttackEffect'
import { ScratchAttackEffect } from './ScratchAttackEffect'
import { ImpactAttackEffect } from './ImpactAttackEffect'
import { PunchAttackEffect } from './PunchAttackEffect'
import { VineWhipAttackEffect } from './VineWhipAttackEffect'
import { EmberAttackEffect } from './EmberAttackEffect'
import { FlamethrowerAttackEffect } from './FlamethrowerAttackEffect'
import { GrowlAttackEffect } from './GrowlAttackEffect'
import { StatupAttackEffect } from './StatupAttackEffect'
import {
  LeechDrainAttackEffect,
  LeechDrainSoloAttackEffect,
  LeechSeedAttackEffect,
} from './LeechSeedAttackEffect'
import {
  WaterGunAttackEffect,
  WaterGunHitAttackEffect,
} from './WaterGunAttackEffect'
import { SmokescreenAttackEffect } from './SmokescreenAttackEffect'
import { SmokescreenTargetAttackEffect } from './SmokescreenTargetAttackEffect'
import { WhirlpoolAttackEffect } from './WhirlpoolAttackEffect'

/**
 * Registro id de grupo → componente de VIEW do efeito visual do ataque
 * (ver docs/features/025-ataque-comum-de-criatura.md) — mesmo princípio
 * de `SPECIES_REGISTRY` (`core/data/species/index.js`): a definição de
 * ataque (`core/data/skills/<id>/index.js`, `visual.effectGroup`) só
 * carrega o ID do grupo, dado puro, sem saber nada de Three/React; a
 * PONTE id→componente mora aqui, na view (core não pode importar React/
 * Three). Pedido explícito do usuário: "muitas criaturas vão
 * compartilhar o ataque básico de arranhar, outras vão ser específicas
 * como um chicote" — cada golpe visualmente distinto ganha sua própria
 * entrada aqui, sem sistema novo nenhum pra somar (só mais uma linha no
 * mapa + um componente).
 *
 * `'tackle'` (arranhão, malha de rip, revelado progressivamente — ver
 * `TackleAttackEffect.jsx`) e `'punch'` (flash + onda de choque, também
 * rip) são os grupos do ataque COMUM (`basicAttack`); `'vine-whip'`/
 * `'ember'`/`'whirlpool'` (9ª rodada, skills de verdade — ver
 * docs/features/025) são os grupos das 3 primeiras SKILLS
 * (`skills[1]`), uma por Pokémon inicial. Cada um usado por um
 * subconjunto de espécies (ver `core/data/skills/<id>/index.js` pras
 * definições, e `basicAttack`/`skills[N]` em cada `core/data/species/<id>/
 * index.js` pra ver quem usa qual). Um golpe novo entra do mesmo jeito —
 * nova entrada + componente aqui, mais a definição em `core/data/
 * attacks/<id>/index.js` — `AttackEffectView.jsx` não muda nada.
 */
const ATTACK_EFFECT_COMPONENTS = {
  tackle: TackleAttackEffect,
  scratch: ScratchAttackEffect,
  impact: ImpactAttackEffect,
  punch: PunchAttackEffect,
  'vine-whip': VineWhipAttackEffect,
  ember: EmberAttackEffect,
  flamethrower: FlamethrowerAttackEffect,
  whirlpool: WhirlpoolAttackEffect,
  growl: GrowlAttackEffect,
  statup: StatupAttackEffect,
  'leech-seed': LeechSeedAttackEffect,
  'leech-drain': LeechDrainAttackEffect,
  'leech-drain-solo': LeechDrainSoloAttackEffect,
  'water-gun': WaterGunAttackEffect,
  'water-gun-hit': WaterGunHitAttackEffect,
  smokescreen: SmokescreenAttackEffect,
  'smokescreen-target': SmokescreenTargetAttackEffect,
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
