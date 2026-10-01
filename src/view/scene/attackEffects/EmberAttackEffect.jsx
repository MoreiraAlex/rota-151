import { EMBER_EMITTERS } from '@/view/vfx/emberVfx'
import { useParticleAttackEffect } from './useParticleAttackEffect'

/**
 * Visual do grupo `'ember'` (skill do Charmander — ver docs/features/
 * 033-skills-de-combate-e-vfx.md): nuvem de fogo saindo da boca,
 * brasas viajando até o alvo e um estouro no impacto, em partículas
 * traduzidas do Cobblemon (config e linha do tempo em `view/vfx/
 * emberVfx.js`). Substitui a malha única `HitFire` (cartão plano que só
 * crescia no ponto de impacto) — Brasa é um golpe canalizado à distância.
 *
 * O `AttackEffect` nasce no PONTO DE IMPACTO, orientado pela trajetória
 * (+Z local = direção do golpe); a criatura fica em (0, 0, -`length`) —
 * por isso o componente recebe `length` (ver `creatureAttackSystem.js`).
 *
 * `scale` (de `attack.visual.scale`) multiplica o TAMANHO das partículas;
 * `radius` (de `attack.radius`) dá o raio das brasas que sobem do alvo.
 */
export function EmberAttackEffect({ radius, length = 0, scale = 1 }) {
  const groupRef = useParticleAttackEffect({
    emitters: EMBER_EMITTERS,
    length,
    radius,
    scale,
  })

  return <group ref={groupRef} />
}
