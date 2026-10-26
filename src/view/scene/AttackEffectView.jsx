import { useLayoutEffect, useMemo, useRef } from 'react'
import { useQuery } from 'koota/react'
import { AttackEffect, AttackPath, Position, Rotation } from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import { resolveAttackEffectComponent } from './attackEffects/registry'

/**
 * Visual de um `AttackEffect` (ataque comum de criatura, ver
 * docs/features/025-ataque-comum-de-criatura.md) — parado no CENTRO da
 * área efetiva (não na criatura — ver `creatureAttackSystem.js`); some
 * sozinha quando `attackEffectSystem` destrói a entidade ao `lifetime`
 * zerar. Este componente é só o WRAPPER (registro de ref + posição) — o
 * visual de verdade é escolhido por `effectGroup` (congelado no spawn,
 * `attack.visual.effectGroup` — ver `core/data/skills/`) via
 * `resolveAttackEffectComponent` (`attackEffects/registry.js`): "muitas
 * criaturas vão compartilhar o ataque básico de arranhar, outras vão ser
 * específicas como um chicote" (pedido do usuário) — cada grupo é um
 * componente próprio, sem inchar este arquivo por golpe novo.
 *
 * `revealDuration` (de `attack.visual.revealDuration`) só é usado por
 * componentes que suportam revelação progressiva (`tackleAttackEffect.jsx`
 * hoje) — repassado pra todos igual, componentes que não usam (ex.:
 * `PunchAttackEffect.jsx`) simplesmente ignoram o prop. `impactType` (tipo do golpe) idem — só `ImpactAttackEffect.jsx`. `length` (distância da
 * origem do golpe até onde o efeito nasce) idem — só os grupos que SAEM da
 * criatura (`EmberAttackEffect.jsx`) usam. `visualScale` (de
 * `attack.visual.scale`) é o multiplicador de TAMANHO do VFX — pedido do
 * usuário: "uma criatura grande vai ter o efeito maior do que o de uma
 * criatura pequena, mesmo os 2 usando o mesmo efeito" — cada componente
 * usa isso junto de `radius` e da própria constante de normalização do
 * rip (ver `tackleAttackEffect.jsx`/`PunchAttackEffect.jsx`). `rise` (de
 * `AttackPath`, `resolveEffectRise`) é o perfil do terreno ao longo do golpe,
 * no espaço do efeito — os grupos de partículas seguem o chão com ele (numa
 * rampa, sobem até o alvo); os de malha ignoram. `body` (`{ width, length,
 * height }` do alvo, só no efeito que nasce nele) — quem cobre o corpo (a
 * teia do String Shot) acompanha o tamanho dele; os outros ignoram.
 */
export function AttackEffectView({
  entity,
  radius,
  effectGroup,
  revealDuration,
  visualScale,
  length,
  impactType,
  bodyWidth = 0,
  bodyLength = 0,
  bodyHeight = 0,
}) {
  const groupRef = useRef()
  // o caminho é fixo desde o spawn: o perfil sai uma vez por efeito
  const rise = useMemo(() => resolveEffectRise(entity), [entity])
  const body = useMemo(
    () =>
      bodyHeight > 0
        ? { width: bodyWidth, length: bodyLength, height: bodyHeight }
        : null,
    [bodyWidth, bodyLength, bodyHeight],
  )

  useLayoutEffect(() => {
    registerView(entity, groupRef.current)
    return () => unregisterView(entity)
  }, [entity])

  const EffectComponent = resolveAttackEffectComponent(effectGroup)

  return (
    <group ref={groupRef}>
      <EffectComponent
        radius={radius}
        revealDuration={revealDuration}
        scale={visualScale}
        length={length}
        impactType={impactType}
        rise={rise}
        body={body}
      />
    </group>
  )
}

/**
 * O perfil do terreno do golpe (`AttackPath`) no espaço do efeito — que fica
 * no impacto, virado na direção do golpe (`Rotation.y`): `[[z, y], ...]`, o Z
 * local de cada ponto (a criatura em `-length`) e a altura dele em relação ao
 * efeito, em ordem de Z. `null` sem caminho (golpe em si mesmo).
 */
export function resolveEffectRise(entity) {
  const points = entity.get(AttackPath)?.points
  if (!points?.length) return null
  const pos = entity.get(Position)
  const yaw = entity.get(Rotation).y
  const forwardX = Math.sin(yaw)
  const forwardZ = Math.cos(yaw)
  return points
    .map((point) => [
      (point.x - pos.x) * forwardX + (point.z - pos.z) * forwardZ,
      point.y - pos.y,
    ])
    .sort((a, b) => a[0] - b[0])
}

/**
 * Renderiza uma `AttackEffectView` por `AttackEffect` ativo — `useQuery` é
 * reativo (koota/react), monta/desmonta sozinho ao entrar/sair do
 * resultado, mesmo padrão de `ProjectilesView`.
 */
export function AttackEffectsView() {
  const effects = useQuery(AttackEffect, Position, Rotation)

  return (
    <>
      {effects.map((entity) => {
        const effect = entity.get(AttackEffect)
        return (
          <AttackEffectView
            key={entity}
            entity={entity}
            radius={effect.radius}
            effectGroup={effect.effectGroup}
            revealDuration={effect.revealDuration}
            visualScale={effect.visualScale}
            length={effect.length}
            impactType={effect.impactType}
            bodyWidth={effect.bodyWidth}
            bodyLength={effect.bodyLength}
            bodyHeight={effect.bodyHeight}
          />
        )
      })}
    </>
  )
}
